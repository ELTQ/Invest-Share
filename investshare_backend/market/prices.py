# investshare_backend/market/prices.py
from __future__ import annotations

from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Dict, List, Tuple, Optional
from functools import reduce

import math
import pandas as pd
import pytz
import yfinance as yf
from django.db.models import QuerySet

from market.models import PriceSnapshot
from portfolios.models import Portfolio

# ────────────────────────────── constants ──────────────────────────────
UTC = pytz.UTC
EASTERN = pytz.timezone("US/Eastern")  # Yahoo intraday bar timezone


# ────────────────────────────── helpers ────────────────────────────────
def _D(x) -> Decimal:
    """Cheap, NaN-safe Decimal conversion (None ⇒ 0)."""
    try:
        return Decimal(str(x)) if x is not None else Decimal("0")
    except Exception:
        return Decimal("0")


def _finite_float(x) -> Optional[float]:
    """
    Return finite float or None. Unwraps 1-element Series/ndarray (common with pandas).
    """
    try:
        if hasattr(x, "__len__") and not isinstance(x, (str, bytes)) and len(x) == 1:
            x = x.iloc[0] if hasattr(x, "iloc") else x[0]
        f = float(x)
        return f if math.isfinite(f) and not pd.isna(f) else None
    except Exception:
        return None


def _safe_tz_to_eastern(idx: pd.DatetimeIndex) -> pd.DatetimeIndex:
    """
    Convert a DatetimeIndex to US/Eastern robustly (handles naive or tz-aware).
    """
    try:
        if idx.tz is None:
            # yfinance usually returns tz-aware, but if not, assume UTC then convert
            idx = idx.tz_localize(UTC)
        return idx.tz_convert(EASTERN)
    except Exception:
        # best-effort fallback: leave as-is
        return idx


def _align_ffill(frames: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
    """
    Union-index align + forward-fill 1-minute dataframes.
    (Avoids pandas .union_many for wider version compatibility.)
    """
    if not frames:
        return {}
    it = iter(frames.values())
    base = next(it).index
    union_idx = reduce(lambda a, b: a.union(b), (df.index for df in it), base)
    return {t: df.reindex(union_idx).ffill() for t, df in frames.items()}


def _clean_ticker(t: str) -> str:
    """
    Minimal ticker sanitation to avoid weird inputs. Don’t over-restrict valid symbols.
    """
    if not isinstance(t, str):
        return ""
    return t.strip()[:20]  # keep it short-ish; avoids accidental abuse


# ─────────────────── real-time/extended-hours prices ───────────────────
def _latest_trade(symbol: str) -> Optional[Tuple[datetime, float]]:
    """
    Return (timestamp, price) of the most recent trade including pre/post hours.
    None if Yahoo serves no intraday bars.
    """
    sym = _clean_ticker(symbol)
    if not sym:
        return None

    now_eastern = datetime.now(EASTERN)
    try:
        bars = (
            yf.Ticker(sym)
            .history(period="5d", interval="1m", prepost=True, actions=False)
            .dropna(subset=["Close"])
        )
        if bars.empty:
            return None

        # drop any future-dated rows (rare but possible)
        idx_eastern = _safe_tz_to_eastern(bars.index)
        bars = bars[idx_eastern <= now_eastern]
        if bars.empty:
            return None

        ts = _safe_tz_to_eastern(bars.index)[-1]
        px = _finite_float(bars["Close"].iloc[-1])
        if px and px > 0:
            return ts, px
    except Exception:
        pass

    return None


def get_latest_price(ticker: str) -> float:
    """
    Public helper used across the backend.

    1) True last trade from 1m bars (pre/post included)
    2) fall back to fast_info (post/last/regular)
    3) fall back to cached daily close in PriceSnapshot or recent 1d daily download

    Always returns finite float or 0.0.
    """
    lt = _latest_trade(ticker)
    if lt:
        return lt[1]

    try:
        fi = yf.Ticker(_clean_ticker(ticker)).fast_info or {}
        px = fi.get("postMarketPrice") or fi.get("last_price") or fi.get("regularMarketPrice")
        f = _finite_float(px)
        if f and f > 0:
            return f
    except Exception:
        pass

    snap = PriceSnapshot.objects.filter(ticker=ticker).order_by("-date").first()
    if snap:
        f = _finite_float(snap.close)
        if f and f > 0:
            return f

    # last-resort: a tiny daily fetch to refresh snapshot
    try:
        d = yf.download(
            _clean_ticker(ticker),
            period="2d",
            interval="1d",
            progress=False,
            prepost=True,
            auto_adjust=False,
        )
        if d is not None and not d.empty:
            close = _finite_float(d["Close"].iloc[-1])
            if close:
                PriceSnapshot.objects.update_or_create(
                    ticker=ticker,
                    date=d.index[-1].date(),
                    defaults={"close": float(close)},
                )
                return close
    except Exception:
        pass

    return 0.0


def get_trade_price(ticker: str) -> float:
    """
    Execution price for market orders – extended-hours aware.
    """
    lt = _latest_trade(ticker)
    if lt:
        return lt[1]
    return get_latest_price(ticker)


# ─────────────────────────── 24h change for treemap ──────────────────────────
def get_change_24h_pct(ticker: str) -> float:
    """
    % change over the last 24 hours using 1-minute extended-hours data.
    Fallback: last two daily closes.
    """
    sym = _clean_ticker(ticker)
    if not sym:
        return 0.0

    try:
        bars = (
            yf.Ticker(sym)
            .history(period="5d", interval="1m", prepost=True, actions=False)
            .dropna(subset=["Close"])
        )
        if not bars.empty:
            idx_eastern = _safe_tz_to_eastern(bars.index)
            last_ts = idx_eastern[-1]
            earlier_ts = last_ts - pd.Timedelta(hours=24)

            # price ~24h ago (use last bar at/earlier than earlier_ts)
            earlier_mask = idx_eastern <= earlier_ts
            if earlier_mask.any():
                earlier_px = _finite_float(bars.loc[earlier_mask, "Close"].iloc[-1])
            else:
                earlier_px = _finite_float(bars["Close"].iloc[0])

            last_px = _finite_float(bars["Close"].iloc[-1])

            if earlier_px and last_px and earlier_px != 0:
                return (last_px - earlier_px) / earlier_px * 100.0
    except Exception:
        pass

    # Fallback to daily closes
    try:
        d = yf.download(
            sym,
            period="5d",
            interval="1d",
            progress=False,
            prepost=True,
            auto_adjust=False,
        )
        if d is not None and not d.empty:
            closes = d["Close"].dropna()
            if len(closes) >= 2:
                prev = _finite_float(closes.iloc[-2])
                last = _finite_float(closes.iloc[-1])
                if prev and last and prev != 0:
                    return (last - prev) / prev * 100.0
    except Exception:
        pass

    return 0.0


# ──────────────── intraday (rolling 24h) equity series ─────────────────
def _intraday_series(p: Portfolio) -> List[dict]:
    end_dt = datetime.utcnow().replace(tzinfo=UTC)
    start_dt = end_dt - timedelta(hours=24)

    tickers: List[str] = list(p.holdings.values_list("ticker", flat=True))
    if not tickers:
        cash = float(_D(p.cash))
        return [
            {"date": start_dt.isoformat(), "value": cash},
            {"date": end_dt.isoformat(), "value": cash},
        ]

    frames: Dict[str, pd.DataFrame] = {}
    for tkr in tickers:
        try:
            df = yf.download(
                _clean_ticker(tkr),
                start=start_dt,
                end=end_dt + timedelta(minutes=1),
                interval="1m",
                progress=False,
                prepost=True,
                auto_adjust=False,
            )
            if df is not None and not df.empty:
                frames[tkr] = df[["Close"]]
        except Exception:
            pass

    if not frames:
        total = _D(p.cash)
        for h in p.holdings.all():
            total += _D(h.quantity) * _D(get_latest_price(h.ticker))
        return [{"date": end_dt.isoformat(), "value": float(total)}]

    aligned = _align_ffill(frames)
    series: List[dict] = []

    # Use the aligned index directly (UTC/naive acceptable for JSON)
    ref_key = next(iter(aligned))
    for ts in aligned[ref_key].index:
        if ts < start_dt:
            continue
        total = _D(p.cash)
        for h in p.holdings.all():
            if h.ticker in aligned:
                px = aligned[h.ticker].loc[ts, "Close"]
                f = _finite_float(px)
                if f is not None:
                    total += _D(h.quantity) * _D(f)
        f_total = _finite_float(total)
        if f_total is not None:
            # ts may be pandas Timestamp – ensure ISO string
            series.append({"date": pd.Timestamp(ts).to_pydatetime().isoformat(), "value": f_total})

    return series


# ────────────── historical snapshots & chart selection ───────────────
def portfolio_value_on(p: Portfolio, d: date) -> Decimal:
    snaps: QuerySet[PriceSnapshot] = PriceSnapshot.objects.filter(
        date=d, ticker__in=p.holdings.values_list("ticker", flat=True)
    )
    price_map = {s.ticker: _D(s.close) for s in snaps}
    if not price_map:
        price_map = {h.ticker: _D(get_latest_price(h.ticker)) for h in p.holdings.all()}

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

    qs = PriceSnapshot.objects.filter(ticker__in=tickers)
    dates = _filter_dates(sorted({d for (d,) in qs.values_list("date")}), rng)

    series: List[dict] = []
    for d in dates:
        v = portfolio_value_on(p, d)
        f = _finite_float(v)
        if f is not None:
            series.append({"date": d.isoformat(), "value": f})

    # Ensure “today” is present
    today_val = _finite_float(portfolio_value_on(p, date.today()))
    if today_val is not None:
        series = [pt for pt in series if pt["date"] != date.today().isoformat()]
        series.append({"date": date.today().isoformat(), "value": today_val})

    return sorted(series, key=lambda x: x["date"])


# ───────────────────────── allocation / treemap ───────────────────────
def get_allocations_treemap(p: Portfolio) -> dict:
    total = _D(p.cash)
    latest: Dict[str, Decimal] = {h.ticker: _D(get_latest_price(h.ticker)) for h in p.holdings.all()}
    total += sum(_D(h.quantity) * latest[h.ticker] for h in p.holdings.all())

    data = []
    for h in p.holdings.all():
        q = _D(h.quantity)
        value = q * latest[h.ticker]
        weight = float((value / total) * 100) if total != 0 else 0.0
        data.append(
            {
                "ticker": h.ticker,
                "weight": weight,
                "value": float(value),
                "change_pct": get_change_24h_pct(h.ticker),  # ← 24h change for color/tooltip
                "position": "long" if q >= 0 else "short",
            }
        )

    if _D(p.cash) > 0:
        data.append(
            {
                "ticker": "CASH",
                "weight": float((_D(p.cash) / total) * 100) if total != 0 else 0.0,
                "value": float(_D(p.cash)),
                "change_pct": 0.0,
                "position": "cash",
            }
        )

    return {"total": float(total), "data": data}
