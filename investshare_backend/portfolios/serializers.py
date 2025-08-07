# investshare_backend/portfolios/serializers.py
from __future__ import annotations

from decimal import Decimal
from rest_framework import serializers
import yfinance as yf

from .models import Portfolio, Trade
from market.prices import get_latest_price  # your cached/snapshot helper


def _live_prev_open(symbol: str) -> tuple[Decimal | None, Decimal | None, Decimal | None]:
    """
    Return (last_price, prev_close, today_open) as Decimals (or None).
    - last_price: current/last trade (fast_info last_price/regularMarketPrice or history fallback)
    - prev_close: previous session close (fast_info previous_close/regularMarketPreviousClose or history fallback)
    - today_open: today's regular session open (fast_info open/regularMarketOpen or history fallback)
    """
    price = prev = openp = None

    try:
        t = yf.Ticker(symbol)
        fast = getattr(t, "fast_info", {}) or {}
        price = fast.get("last_price") or fast.get("regularMarketPrice")
        prev  = fast.get("previous_close") or fast.get("regularMarketPreviousClose")
        openp = fast.get("open") or fast.get("regularMarketOpen")
    except Exception:
        pass

    # History fallbacks
    try:
        # 1D 1m: first row Open is today's open (if regular session occurred)
        if openp is None or price is None:
            hist_1d = yf.Ticker(symbol).history(period="1d", interval="1m", auto_adjust=False)
            if hist_1d is not None and not hist_1d.empty:
                if openp is None:
                    openp = float(hist_1d["Open"].iloc[0])
                if price is None:
                    price = float(hist_1d["Close"].iloc[-1])

        # 5D 1D: prev close
        if prev is None:
            hist_5d = yf.Ticker(symbol).history(period="5d", interval="1d", auto_adjust=False)
            if hist_5d is not None and not hist_5d.empty:
                if len(hist_5d) >= 2:
                    prev = float(hist_5d["Close"].iloc[-2])
                else:
                    prev = float(hist_5d["Close"].iloc[-1])
    except Exception:
        pass

    # As a last resort for price, use your snapshot latest
    if price is None:
        try:
            price = get_latest_price(symbol)
        except Exception:
            price = None

    try:
        price = Decimal(str(price)) if price is not None else None
        prev  = Decimal(str(prev))  if prev  is not None else None
        openp = Decimal(str(openp)) if openp is not None else None
    except Exception:
        price = prev = openp = None

    return price, prev, openp


class TradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trade
        fields = ["id", "type", "ticker", "quantity", "price", "cash_delta", "executed_at"]


class PortfolioSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    total_value = serializers.SerializerMethodField()
    todays_change = serializers.SerializerMethodField()
    holdings = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = [
            "id", "name", "visibility", "cash", "owner_username",
            "total_value", "todays_change", "holdings", "created_at"
        ]

    def get_holdings(self, obj: Portfolio):
        """
        Returns positions with live value and P/L metrics.
        day_pct is computed from TODAY'S OPEN -> current price.
        """
        out = []
        for h in obj.holdings.all():
            q = Decimal(str(h.quantity))
            avg = Decimal(str(h.avg_cost))
            price, prev, openp = _live_prev_open(h.ticker)

            value = pl_abs = pl_pct = day_abs = day_pct = None
            if price is not None:
                value = q * price
                if avg and avg > 0:
                    pl_abs = q * (price - avg)
                    pl_pct = (price - avg) / avg * Decimal("100")
                # intraday change from OPEN
                if openp not in (None, 0, Decimal("0")):
                    day_abs = q * (price - openp)
                    day_pct = (price - openp) / openp * Decimal("100")

            out.append({
                "id": h.id,
                "ticker": h.ticker,
                "quantity": str(h.quantity),
                "avg_cost": str(h.avg_cost),
                "value": float(value) if value is not None else None,
                "pl_abs": float(pl_abs) if pl_abs is not None else None,
                "pl_pct": float(pl_pct) if pl_pct is not None else None,
                "day_abs": float(day_abs) if day_abs is not None else None,
                "day_pct": float(day_pct) if day_pct is not None else None,
            })
        return out

    def get_total_value(self, obj: Portfolio):
        total = Decimal(str(obj.cash or 0))
        for h in obj.holdings.all():
            try:
                q = Decimal(str(h.quantity))
                price, _, _ = _live_prev_open(h.ticker)
                if price is not None:
                    total += q * price
            except Exception:
                pass
        return float(total)

    def get_todays_change(self, obj: Portfolio):
        """
        Intraday portfolio change from today's open -> now.
        (If an open isn't available for a ticker, it contributes 0 to intraday change.)
        """
        now_val = Decimal(str(obj.cash or 0))
        open_val = Decimal(str(obj.cash or 0))
        for h in obj.holdings.all():
            try:
                q = Decimal(str(h.quantity))
                price, _, openp = _live_prev_open(h.ticker)
                if price is not None:
                    now_val += q * price
                if openp not in (None, 0, Decimal("0")):
                    open_val += q * openp
            except Exception:
                pass
        if open_val == 0:
            return {"abs": 0.0, "pct": 0.0}
        diff = now_val - open_val
        pct = diff / open_val * Decimal("100")
        return {"abs": float(diff), "pct": float(pct)}


class PublicPortfolioSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    total_value = serializers.SerializerMethodField()
    todays_change = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = ["id", "owner_username", "total_value", "todays_change"]

    def get_total_value(self, obj: Portfolio):
        total = Decimal(str(obj.cash or 0))
        for h in obj.holdings.all():
            try:
                q = Decimal(str(h.quantity))
                px = Decimal(str(get_latest_price(h.ticker)))
                total += q * px
            except Exception:
                pass
        return float(total)

    def get_todays_change(self, obj: Portfolio):
        # Use the same intraday (open -> now) portfolio change
        now_val = Decimal(str(obj.cash or 0))
        open_val = Decimal(str(obj.cash or 0))
        for h in obj.holdings.all():
            try:
                q = Decimal(str(h.quantity))
                price, _, openp = _live_prev_open(h.ticker)
                if price is not None:
                    now_val += q * price
                if openp not in (None, 0, Decimal("0")):
                    open_val += q * openp
            except Exception:
                pass
        if open_val == 0:
            return {"abs": 0.0, "pct": 0.0}
        diff = now_val - open_val
        pct = diff / open_val * Decimal("100")
        return {"abs": float(diff), "pct": float(pct)}
