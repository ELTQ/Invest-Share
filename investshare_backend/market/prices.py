# investshare_backend/market/prices.py
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
import math
from typing import Dict, List

import yfinance as yf
from django.db.models import QuerySet

from market.models import PriceSnapshot
from portfolios.models import Portfolio


def _D(x) -> Decimal:
    try:
        if x is None:
            return Decimal("0")
        return Decimal(str(x))
    except Exception:
        return Decimal("0")


def _finite_float(x) -> float | None:
    try:
        f = float(x)
        return f if math.isfinite(f) else None
    except Exception:
        return None


def get_latest_price(ticker: str) -> float:
    """
    Last known price (close) for non-time-sensitive reads:
      1) snapshots table
      2) Yahoo fast_info last/regularMarketPrice
      3) Yahoo daily history close
      4) 0.0
    """
    snap = PriceSnapshot.objects.filter(ticker=ticker).order_by("-date").first()
    if snap:
        f = _finite_float(snap.close)
        if f is not None:
            return f

    try:
        t = yf.Ticker(ticker)
        fi = getattr(t, "fast_info", {}) or {}
        last = fi.get("last_price") or fi.get("regularMarketPrice")
        f = _finite_float(last)
        if f is not None and f > 0:
            return f

        hist = t.history(period="2d", interval="1d")
        if hist is not None and not hist.empty:
            last_close = hist["Close"].iloc[-1]
            f = _finite_float(last_close)
            if f is not None and f > 0:
                try:
                    PriceSnapshot.objects.update_or_create(
                        ticker=ticker,
                        date=hist.index[-1].date(),
                        defaults={"close": float(f)},
                    )
                except Exception:
                    pass
                return f
    except Exception:
        pass

    return 0.0


def get_open_and_last(ticker: str) -> tuple[float | None, float | None]:
    """
    Today’s open and current/last intraday price.
    """
    try:
        t = yf.Ticker(ticker)
        fi = getattr(t, "fast_info", {}) or {}

        last = fi.get("last_price") or fi.get("regularMarketPrice")
        open_ = fi.get("open") or fi.get("regularMarketOpen")

        f_last = _finite_float(last)
        f_open = _finite_float(open_)
        if f_last is not None and f_open is not None and f_open > 0:
            return f_open, f_last

        hist = t.history(period="1d", interval="1m")
        if hist is not None and not hist.empty:
            f_open = _finite_float(hist["Open"].iloc[0])
            f_last = _finite_float(hist["Close"].iloc[-1])
            if f_open is not None and f_open > 0 and f_last is not None:
                return f_open, f_last
    except Exception:
        pass

    return None, None


def get_trade_price(ticker: str) -> float:
    """
    Use intraday last for orders to reflect real-time-ish execution prices.
    Falls back to get_latest_price if we cannot get intraday.
    """
    _, last = get_open_and_last(ticker)
    if last is not None and last > 0:
        return last
    return get_latest_price(ticker)


def get_intraday_change_pct(ticker: str) -> float:
    """
    % change from today's open to current/last price.
    """
    open_, last = get_open_and_last(ticker)
    if open_ is None or last is None or open_ == 0:
        return 0.0
    pct = (Decimal(str(last)) - Decimal(str(open_))) / Decimal(str(open_)) * Decimal("100")
    return float(pct)


def _portfolio_value_from_prices(p: Portfolio, price_map: Dict[str, Decimal]) -> Decimal:
    total = _D(p.cash)
    for h in p.holdings.all():
        q = _D(h.quantity)
        px = price_map.get(h.ticker)
        if px is not None:
            total += q * px
    return total


def portfolio_value_on(p: Portfolio, d: date) -> Decimal:
    snaps: QuerySet[PriceSnapshot] = PriceSnapshot.objects.filter(
        date=d, ticker__in=p.holdings.values_list("ticker", flat=True)
    )
    price_map: Dict[str, Decimal] = {}

    if snaps.exists():
        for s in snaps:
            f = _finite_float(s.close)
            if f is not None:
                price_map[s.ticker] = _D(f)
    else:
        for h in p.holdings.all():
            px = get_latest_price(h.ticker)
            f = _finite_float(px)
            if f is not None:
                price_map[h.ticker] = _D(f)

    return _portfolio_value_from_prices(p, price_map)


def _filter_dates_for_range(all_dates: List[date], range_param: str) -> List[date]:
    if not all_dates:
        return []
    if range_param == "1d":
        return [all_dates[-1]]
    if range_param == "1w":
        return all_dates[-5:]
    if range_param == "ytd":
        y = date.today().year
        return [d for d in all_dates if d.year == y]
    if range_param == "1y":
        cutoff = date.today() - timedelta(days=365)
        return [d for d in all_dates if d >= cutoff]
    return all_dates


def get_portfolio_timeseries(p: Portfolio, range_param: str):
    tickers = list(p.holdings.values_list("ticker", flat=True))
    if not tickers:
        return [{"date": date.today().isoformat(), "value": float(_D(p.cash))}]

    qs = PriceSnapshot.objects.filter(ticker__in=tickers)
    all_dates = sorted(set(qs.values_list("date", flat=True)))
    dates = _filter_dates_for_range(all_dates, range_param)

    series: List[dict] = []

    for d in dates:
        try:
            v = portfolio_value_on(p, d)
            f = float(v)
            if math.isfinite(f):
                series.append({"date": d.isoformat(), "value": f})
        except Exception:
            continue

    # Always include a today point
    today = date.today()
    try:
        v_today = portfolio_value_on(p, today)
        f_today = float(v_today)
        if math.isfinite(f_today):
            # replace if exists
            series = [pt for pt in series if pt["date"] != today.isoformat()]
            series.append({"date": today.isoformat(), "value": f_today})
    except Exception:
        pass

    series.sort(key=lambda x: x["date"])
    return series


def get_allocations_treemap(p: Portfolio):
    total = Decimal("0")
    latest_prices: Dict[str, Decimal] = {}

    for h in p.holdings.all():
        px = _D(get_latest_price(h.ticker))
        latest_prices[h.ticker] = px
        total += (_D(h.quantity) * px)

    total += _D(p.cash)

    data = []
    for h in p.holdings.all():
        q = _D(h.quantity)
        value = q * latest_prices[h.ticker]
        w = float((value / total) * Decimal("100")) if total != 0 else 0.0
        data.append({
            "ticker": h.ticker,
            "weight": w,
            "value": float(value) if math.isfinite(float(value)) else 0.0,
            "change_pct": get_intraday_change_pct(h.ticker),
            "position": "long" if q >= 0 else "short",
        })

    if _D(p.cash) > 0:
        w_cash = float((_D(p.cash) / total) * Decimal("100")) if total != 0 else 0.0
        data.append({
            "ticker": "CASH",
            "weight": w_cash,
            "value": float(_D(p.cash)),
            "change_pct": 0.0,
            "position": "cash",
        })

    return {"total": float(total) if math.isfinite(float(total)) else 0.0, "data": data}
