# investshare_backend/market/prices.py
from __future__ import annotations

from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Dict, List, Tuple, Optional

import math
import pandas as pd
import pytz
import yfinance as yf
from django.db.models import QuerySet

from market.models import PriceSnapshot
from portfolios.models import Portfolio

###############################################################################
# CONSTANTS
###############################################################################
UTC     = pytz.UTC
EASTERN = pytz.timezone("US/Eastern")          # Yahoo intraday bar tz


###############################################################################
# LOW-LEVEL HELPERS
###############################################################################
def _D(x) -> Decimal:
    """Cheap, NaN-safe Decimal conversion (None ⇒ 0)."""
    try:
        return Decimal(str(x)) if x is not None else Decimal("0")
    except Exception:                    # noqa: BLE001 – never raise to caller
        return Decimal("0")


def _finite_float(x) -> Optional[float]:
    """
    Return a finite float or None.

    • Filters NaN / ±Inf  
    • Transparently unwraps length-1 Series / ndarray (pandas quirk)
    """
    try:
        if hasattr(x, "__len__") and not isinstance(x, (str, bytes)) and len(x) == 1:
            x = x.iloc[0] if hasattr(x, "iloc") else x[0]
        f = float(x)
        return f if math.isfinite(f) and not pd.isna(f) else None
    except Exception:                    # noqa: BLE001
        return None


def _align_ffill(frames: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
    """Union-index align + forward-fill 1-minute OHLC frames."""
    idx = frames[next(iter(frames))].index.union_many([df.index for df in frames.values()])
    return {t: df.reindex(idx).ffill() for t, df in frames.items()}


###############################################################################
# REAL-TIME PRICE — ALWAYS AFTER-HOURS AWARE
###############################################################################
def _latest_trade(symbol: str) -> Optional[Tuple[datetime, float]]:
    """
    Return (timestamp, price) of **last trade**, including pre/post market.
    None if Yahoo serves no intraday bars (very thin ADRs, old delisted names).
    """
    now = datetime.now(EASTERN)

    try:
        bars = (
            yf.Ticker(symbol)
            .history(period="5d", interval="1m", prepost=True, actions=False)
            .dropna(subset=["Close"])
        )
        if bars.empty:
            return None

        # Rarely, Yahoo sneaks in a future-dated bar – discard it
        bars = bars[bars.index.tz_convert(EASTERN) <= now]

        ts  = bars.index[-1].tz_convert(EASTERN)
        px  = _finite_float(bars["Close"].iloc[-1])
        if px and px > 0:
            return ts, px
    except Exception:                    # noqa: BLE001
        pass

    return None


def get_latest_price(ticker: str) -> float:
    """
    Public helper used across the backend.

    ✅ 1. True last trade from 1-minute bars (pre/post included)  
    ✅ 2. Falls back to `fast_info` (cheap)  
    ✅ 3. Falls back to cached daily close (`PriceSnapshot`)  
    Always returns a **positive finite float** or 0.0 on total failure.
    """
    lt = _latest_trade(ticker)
    if lt:
        return lt[1]

    try:
        fi = yf.Ticker(ticker).fast_info or {}
        px = fi.get("postMarketPrice") or fi.get("last_price") or fi.get("regularMarketPrice")
        f  = _finite_float(px)
        if f and f > 0:
            return f
    except Exception:                    # noqa: BLE001
        pass

    snap = PriceSnapshot.objects.filter(ticker=ticker).order_by("-date").first()
    if snap:
        f = _finite_float(snap.close)
        if f and f > 0:
            return f

    return 0.0


def get_trade_price(ticker: str) -> float:
    """
    Execution price for a *market* trade – guaranteed to be the most recent
    extended-hours tick.  Fallbacks guarantee the function never raises.
    """
    lt = _latest_trade(ticker)
    if lt:
        return lt[1]
    return get_latest_price(ticker)      # will never return NaN / Inf


###############################################################################
# 24-HOUR INTRADAY EQUITY CURVE (1-minute, extended hours)
###############################################################################
def _intraday_series(p: Portfolio) -> List[dict]:
    end_dt   = datetime.utcnow().replace(tzinfo=UTC)
    start_dt = end_dt - timedelta(hours=24)

    tickers: List[str] = list(p.holdings.values_list("ticker", flat=True))
    if not tickers:
        cash = float(_D(p.cash))
        return [
            {"date": start_dt.isoformat(), "value": cash},
            {"date": end_dt.isoformat(),   "value": cash},
        ]

    frames: Dict[str, pd.DataFrame] = {}
    for tkr in tickers:
        try:
            df = yf.download(
                tkr,
                start=start_dt,
                end=end_dt + timedelta(minutes=1),
                interval="1m",
                progress=False,
                prepost=True,
                auto_adjust=False,
            )
            if not df.empty:
                frames[tkr] = df[["Close"]]
        except Exception:                # noqa: BLE001
            pass

    if not frames:                       # network hiccup → single point
        total = _D(p.cash)
        for h in p.holdings.all():
            total += _D(h.quantity) * _D(get_latest_price(h.ticker))
        return [{"date": end_dt.isoformat(), "value": float(total)}]

    aligned = _align_ffill(frames)
    series  = []

    for ts in aligned[next(iter(aligned))].index:
        if ts < start_dt:
            continue
        total = _D(p.cash)
        for h in p.holdings.all():
            px = aligned[h.ticker].loc[ts, "Close"] if h.ticker in aligned else None
            f  = _finite_float(px)
            if f:
                total += _D(h.quantity) * _D(f)
        f_total = _finite_float(total)
        if f_total:
            series.append({"date": ts.isoformat(), "value": f_total})

    return series


###############################################################################
# HISTORICAL SNAPSHOTS & CHART RANGE
###############################################################################
def portfolio_value_on(p: Portfolio, d: date) -> Decimal:
    snaps: QuerySet[PriceSnapshot] = PriceSnapshot.objects.filter(
        date=d, ticker__in=p.holdings.values_list("ticker", flat=True)
    )
    price_map = {s.ticker: _D(s.close) for s in snaps} or {
        h.ticker: _D(get_latest_price(h.ticker)) for h in p.holdings.all()
    }

    total = _D(p.cash)
    for h in p.holdings.all():
        total += _D(h.quantity) * price_map.get(h.ticker, Decimal("0"))
    return total


def _filter_dates(dates: List[date], rng: str) -> List[date]:
    if not dates:
        return []
    today = date.today()
    if rng == "1d":
        return [dates[-1]]
    if rng == "1w":
        return dates[-5:]
    if rng == "ytd":
        return [d for d in dates if d.year == today.year]
    if rng == "1y":
        return [d for d in dates if d >= today - timedelta(days=365)]
    return dates


def get_portfolio_timeseries(p: Portfolio, rng: str) -> List[dict]:
    if rng == "1d":
        return _intraday_series(p)

    tickers = list(p.holdings.values_list("ticker", flat=True))
    if not tickers:
        return [{"date": date.today().isoformat(), "value": float(_D(p.cash))}]

    qs     = PriceSnapshot.objects.filter(ticker__in=tickers)
    dates  = _filter_dates(sorted({d for d, in qs.values_list("date")}), rng)
    series = [
        {"date": d.isoformat(), "value": _finite_float(portfolio_value_on(p, d))}
        for d in dates
        if _finite_float(portfolio_value_on(p, d)) is not None
    ]

    # Ensure “today” is present
    today_val = _finite_float(portfolio_value_on(p, date.today()))
    if today_val is not None:
        series = [pt for pt in series if pt["date"] != date.today().isoformat()]
        series.append({"date": date.today().isoformat(), "value": today_val})

    return sorted(series, key=lambda x: x["date"])


###############################################################################
# ALLOCATION / TREEMAP
###############################################################################
def get_intraday_change_pct(ticker: str) -> float:
    try:
        fi   = yf.Ticker(ticker).fast_info or {}
        open_ = _finite_float(fi.get("open") or fi.get("regularMarketOpen"))
        last  = _finite_float(
            fi.get("postMarketPrice")
            or fi.get("last_price")
            or fi.get("regularMarketPrice")
        )
        if open_ and last and open_ != 0:
            return float((Decimal(str(last)) - Decimal(str(open_))) / Decimal(str(open_)) * 100)
    except Exception:                    # noqa: BLE001
        pass
    return 0.0


def get_allocations_treemap(p: Portfolio) -> dict:
    total  = _D(p.cash)
    latest = {h.ticker: _D(get_latest_price(h.ticker)) for h in p.holdings.all()}
    total += sum(_D(h.quantity) * latest[h.ticker] for h in p.holdings.all())

    data = []
    for h in p.holdings.all():
        q     = _D(h.quantity)
        value = q * latest[h.ticker]
        data.append(
            {
                "ticker":   h.ticker,
                "weight":   float((value / total) * 100) if total else 0.0,
                "value":    float(value),
                "change_pct": get_intraday_change_pct(h.ticker),
                "position": "long" if q >= 0 else "short",
            }
        )

    if _D(p.cash) > 0:
        data.append(
            {
                "ticker":   "CASH",
                "weight":   float((_D(p.cash) / total) * 100) if total else 0.0,
                "value":    float(_D(p.cash)),
                "change_pct": 0.0,
                "position": "cash",
            }
        )

    return {"total": float(total), "data": data}
