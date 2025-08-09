# market/views.py
from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Optional

import pandas as pd
import yfinance as yf
from django.core.cache import cache
from django.utils.timezone import now
from rest_framework import permissions, views
from rest_framework.response import Response

from .fundamentals import fetch_fundamentals
from .models import PriceSnapshot, TickerInfo
from .prices import get_latest_price
from .serializers import TickerInfoSerializer

CACHE_5M = 60 * 5
SYMBOL_RE = re.compile(r"^[A-Z0-9.\-]{1,20}$")


def _finite(x) -> Optional[float]:
    """Return finite float or None."""
    try:
        # unwrap 1-length pandas/np
        if hasattr(x, "__len__") and not isinstance(x, (str, bytes)) and len(x) == 1:
            x = x.iloc[0] if hasattr(x, "iloc") else x[0]
        f = float(x)
        if pd.isna(f):
            return None
        if f == float("inf") or f == float("-inf"):
            return None
        return f
    except Exception:
        return None


class TickerSearchView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = (request.query_params.get("q") or "").upper().strip()
        if not q or not SYMBOL_RE.match(q):
            return Response([])

        key = f"ticker_search_{q}"
        cached = cache.get(key)
        if cached:
            return Response(cached)

        data = []
        try:
            t = yf.Ticker(q)
            fi = getattr(t, "fast_info", {}) or {}
            # fast_info typically won’t include company name; keep exchange if present.
            data = [{
                "ticker": q,
                "exchange": fi.get("exchange", "") or fi.get("market", ""),
                "name": "",  # avoid expensive .info lookup
            }]
        except Exception:
            data = []

        cache.set(key, data, CACHE_5M)
        return Response(data)


class TickerDetailView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get_prev_close(self, symbol: str) -> Optional[float]:
        """
        Robust previous close:
          1) fast_info.previous_close/regularMarketPreviousClose
          2) 5d daily Close → use the previous row if available (handles weekends/holidays)
        """
        try:
            fi = (yf.Ticker(symbol).fast_info) or {}
            prev = _finite(fi.get("previous_close") or fi.get("regularMarketPreviousClose"))
            if prev:
                return prev
        except Exception:
            pass

        try:
            hist = yf.Ticker(symbol).history(period="5d", interval="1d", auto_adjust=False)
            if hist is not None and not hist.empty:
                closes = hist["Close"].dropna()
                if len(closes) >= 2:
                    return _finite(closes.iloc[-2])
                elif len(closes) == 1:
                    return _finite(closes.iloc[-1])
        except Exception:
            pass
        return None

    def get(self, request, symbol: str):
        symbol = (symbol or "").upper().strip()
        if not SYMBOL_RE.match(symbol):
            return Response({"detail": "Invalid symbol."}, status=400)

        cache_key = f"ticker_detail_{symbol}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        # --- Price (always after-hours aware) ---
        price = _finite(get_latest_price(symbol)) or 0.0

        # --- Previous close (robust) ---
        prev_close = self.get_prev_close(symbol)

        change_abs = change_pct = None
        if prev_close is not None and prev_close != 0:
            change_abs = price - prev_close
            change_pct = (change_abs / prev_close) * 100.0

        # --- Fundamentals (refresh ≤ 24h) ---
        try:
            info, _ = TickerInfo.objects.get_or_create(ticker=symbol)
            if (not info.market_cap) or (now() - info.updated_at) > timedelta(hours=24):
                f = fetch_fundamentals(symbol)
                # Guard expected keys
                info.market_cap = f.get("market_cap")
                info.pe = f.get("pe")
                info.eps = f.get("eps")
                info.save()
            payload = TickerInfoSerializer(info).data
        except Exception:
            # If fundamentals explode, still return price/change.
            payload = {"ticker": symbol, "market_cap": None, "pe": None, "eps": None}

        payload["price"] = round(price, 6)  # JSON-safe finite
        payload["change_abs"] = round(change_abs, 6) if change_abs is not None else None
        payload["change_pct"] = round(change_pct, 6) if change_pct is not None else None

        cache.set(cache_key, payload, CACHE_5M)
        return Response(payload)
