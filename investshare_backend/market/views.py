# market/views.py
from rest_framework import views, permissions
from rest_framework.response import Response
from .models import TickerInfo, PriceSnapshot
from .serializers import TickerInfoSerializer
from .prices import get_latest_price
from datetime import date, timedelta
import yfinance as yf
from django.core.cache import cache
from django.utils.timezone import now
from .fundamentals import fetch_fundamentals


CACHE_5M = 60*5



class TickerSearchView(views.APIView):
    def get(self, request):
        q = request.query_params.get("q","").upper()
        if not q:
            return Response([])
        key = f"ticker_search_{q}"
        cached = cache.get(key)
        if cached:
            return Response(cached)
        try:
            info = yf.Ticker(q).fast_info  # faster than history
            if not info: 
                data = []
            else:
                data = [{"ticker": q, "exchange": info.get("exchange",""), "name": info.get("shortName","")}]
        except Exception:
            data = []
        cache.set(key, data, CACHE_5M)
        return Response(data)
    

class TickerDetailView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, symbol):
        symbol = symbol.upper()
        cache_key = f"ticker_detail_{symbol}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        # --- Price & change (robust fallbacks) ---
        # 1) fast_info for instant price / previous close
        t = yf.Ticker(symbol)
        fast = getattr(t, "fast_info", {}) or {}
        price = (
            fast.get("last_price")
            or fast.get("lastPrice")
            or fast.get("regularMarketPrice")
            or fast.get("last_trade_price")
        )
        if price is None:
            price = get_latest_price(symbol)  # fallback to our snapshots/fetcher

        prev_close = (
            fast.get("previous_close")
            or fast.get("previousClose")
            or fast.get("regularMarketPreviousClose")
        )

        change_abs = change_pct = None
        if prev_close:
            change_abs = float(price) - float(prev_close)
            if float(prev_close) != 0:
                change_pct = change_abs / float(prev_close) * 100
        else:
            # fallback to yesterday snapshot if we have one
            yday = date.today() - timedelta(days=1)
            prev_snap = PriceSnapshot.objects.filter(ticker=symbol, date=yday).first()
            if prev_snap:
                change_abs = float(price) - float(prev_snap.close)
                if prev_snap.close:
                    change_pct = change_abs / float(prev_snap.close) * 100

        # --- Fundamentals (cache in DB, refresh <= 24h) ---
        info, _ = TickerInfo.objects.get_or_create(ticker=symbol)
        if not info.market_cap or (now() - info.updated_at) > timedelta(hours=24):
            f = fetch_fundamentals(symbol)
            info.market_cap = f["market_cap"]
            info.pe = f["pe"]
            info.eps = f["eps"]
            info.save()

        payload = TickerInfoSerializer(info).data
        payload["price"] = float(price)
        payload["change_abs"] = round(change_abs, 4) if change_abs is not None else None
        payload["change_pct"] = round(change_pct, 4) if change_pct is not None else None

        cache.set(cache_key, payload, CACHE_5M)
        return Response(payload)