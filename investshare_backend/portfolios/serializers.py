# investshare_backend/portfolios/serializers.py
from __future__ import annotations
from market.prices import _latest_trade
import math
from decimal import Decimal
from typing import Optional, Tuple

import yfinance as yf
from rest_framework import serializers

from .models import Portfolio, Trade
from market.prices import _latest_trade, get_latest_price 

# ───────────────────────────── helpers ──────────────────────────────
def _dec(x) -> Optional[Decimal]:
    """
    Convert *x* to Decimal – return None on NaN / ±Inf / bad input.
    This keeps any math/JSON serialisation safe.
    """
    try:
        if x is None:
            return None
        if isinstance(x, float) and (math.isnan(x) or math.isinf(x)):
            return None
        return Decimal(str(x))
    except Exception:
        return None


def _live_prev_open(symbol: str) -> Tuple[Optional[Decimal],
                                          Optional[Decimal],
                                          Optional[Decimal]]:
    """
    Return (latest_price, prev_close, today_open) as Decimals or None.

    • latest_price comes from the most-recent trade **including
      pre-/post-market**, then fast_info, then daily close cache.
    """
    price = prev_cls = today_open = None

    # ── ❶ after-hours aware: 1-min bar (same as trade execution) ──
    lt = _latest_trade(symbol)          # (ts, price) or None
    if lt:
        price = lt[1]

    # ── ❷ cheap fast_info -------------------------------------------------
    try:
        fi = (yf.Ticker(symbol).fast_info) or {}
        price = price or fi.get("postMarketPrice") or fi.get("last_price") \
                or fi.get("regularMarketPrice")

        prev_cls   = fi.get("previous_close") or fi.get("regularMarketPreviousClose")
        today_open = fi.get("open")           or fi.get("regularMarketOpen")
    except Exception:
        pass

    # ── ❸ tiny history fall-backs -----------------------------------------
    try:
        if price is None or today_open is None:
            hist_1d = yf.Ticker(symbol).history(period="1d", interval="1m",
                                                actions=False, auto_adjust=False)
            if not hist_1d.empty:
                today_open = today_open or hist_1d["Open"].iloc[0]
                price      = price      or hist_1d["Close"].iloc[-1]

        if prev_cls is None:
            hist_5d = yf.Ticker(symbol).history(period="5d", interval="1d",
                                                actions=False, auto_adjust=False)
            if not hist_5d.empty:
                prev_cls = hist_5d["Close"].iloc[-2 if len(hist_5d) >= 2 else -1]
    except Exception:
        pass

    # ── ❹ last-resort cached close ----------------------------------------
    if price is None:
        price = get_latest_price(symbol)

    return _dec(price), _dec(prev_cls), _dec(today_open)

# ───────────────────────────── serializers ─────────────────────────
class TradeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Trade
        fields = ["id", "type", "ticker", "quantity", "price", "cash_delta", "executed_at"]


class PortfolioSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    total_value    = serializers.SerializerMethodField()
    todays_change  = serializers.SerializerMethodField()
    holdings       = serializers.SerializerMethodField()

    class Meta:
        model  = Portfolio
        fields = [
            "id", "name", "visibility", "cash", "owner_username",
            "total_value", "todays_change", "holdings", "created_at",
        ]

    # ── live positions table ───────────────────────────────────────
    def get_holdings(self, obj: Portfolio):
        rows = []
        for h in obj.holdings.all():
            qty   = _dec(h.quantity)  or Decimal("0")
            avg   = _dec(h.avg_cost)  or Decimal("0")
            price, _prev, openp = _live_prev_open(h.ticker)

            value = pl_abs = pl_pct = day_abs = day_pct = None
            if price is not None:
                value = qty * price
                if avg:
                    pl_abs = qty * (price - avg)
                    pl_pct = (price - avg) / avg * Decimal("100")
                if openp:
                    day_abs = qty * (price - openp)
                    day_pct = (price - openp) / openp * Decimal("100")

            rows.append(
                {
                    "id":       h.id,
                    "ticker":   h.ticker,
                    "quantity": str(h.quantity),
                    "avg_cost": str(h.avg_cost),
                    "value":    float(value)   if value   is not None else None,
                    "pl_abs":   float(pl_abs)  if pl_abs  is not None else None,
                    "pl_pct":   float(pl_pct)  if pl_pct  is not None else None,
                    "day_abs":  float(day_abs) if day_abs is not None else None,
                    "day_pct":  float(day_pct) if day_pct is not None else None,
                }
            )
        return rows

    # ── live total equity ───────────────────────────────────────────
    def get_total_value(self, obj: Portfolio) -> float:
        total = _dec(obj.cash) or Decimal("0")
        for h in obj.holdings.all():
            qty = _dec(h.quantity) or Decimal("0")
            px, _, _ = _live_prev_open(h.ticker)
            if px:
                total += qty * px
        return float(total)

    # ── intraday portfolio change (open → now) ──────────────────────
    def get_todays_change(self, obj: Portfolio):
        now_val  = _dec(obj.cash) or Decimal("0")
        open_val = _dec(obj.cash) or Decimal("0")

        for h in obj.holdings.all():
            qty = _dec(h.quantity) or Decimal("0")
            price, _prev, openp = _live_prev_open(h.ticker)
            if price:
                now_val += qty * price
            if openp:
                open_val += qty * openp

        if open_val == 0:
            return {"abs": 0.0, "pct": 0.0}

        diff = now_val - open_val
        pct  = diff / open_val * Decimal("100")
        return {"abs": float(diff), "pct": float(pct)}


class PublicPortfolioSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    total_value    = serializers.SerializerMethodField()
    todays_change  = serializers.SerializerMethodField()

    class Meta:
        model  = Portfolio
        fields = ["id", "owner_username", "total_value", "todays_change"]

    def get_total_value(self, obj: Portfolio) -> float:
        tot = _dec(obj.cash) or Decimal("0")
        for h in obj.holdings.all():
            qty = _dec(h.quantity) or Decimal("0")
            px  = _dec(get_latest_price(h.ticker)) or Decimal("0")
            tot += qty * px
        return float(tot)

    def get_todays_change(self, obj: Portfolio):
        now_val  = _dec(obj.cash) or Decimal("0")
        open_val = _dec(obj.cash) or Decimal("0")

        for h in obj.holdings.all():
            qty = _dec(h.quantity) or Decimal("0")
            price, _prev, openp = _live_prev_open(h.ticker)
            if price:
                now_val += qty * price
            if openp:
                open_val += qty * openp

        if open_val == 0:
            return {"abs": 0.0, "pct": 0.0}

        diff = now_val - open_val
        pct  = diff / open_val * Decimal("100")
        return {"abs": float(diff), "pct": float(pct)}
