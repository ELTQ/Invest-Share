from decimal import Decimal
from datetime import date, timedelta
import yfinance as yf
from .models import PriceSnapshot
from portfolios.models import Portfolio

def get_latest_price(ticker: str) -> float:
    snap = PriceSnapshot.objects.filter(ticker=ticker).order_by("-date").first()
    if snap:
        return float(snap.close)
    # fallback fetch on demand
    data = yf.Ticker(ticker).history(period="1d")
    if data.empty:
        raise ValueError("Ticker not found")
    price = float(data["Close"].iloc[-1])
    PriceSnapshot.objects.update_or_create(
        ticker=ticker, date=data.index[-1].date(),
        defaults={"close": price}
    )
    return price

def get_change_today_portfolio(p):
    today = date.today()
    prev  = today - timedelta(days=1)

    v_today = portfolio_value_on(p, today)
    v_prev  = portfolio_value_on(p, prev)

    if v_today is None or v_prev is None or v_prev == 0:
        return {"abs": 0.0, "pct": 0.0}

    diff = Decimal(v_today) - Decimal(v_prev)
    pct  = (diff / Decimal(v_prev)) * 100
    return {"abs": float(diff), "pct": float(pct)}


def portfolio_value_on(p: Portfolio, d: date):
    snaps = PriceSnapshot.objects.filter(date=d, ticker__in=p.holdings.values_list("ticker", flat=True))
    # If we don't have snapshots, fall back to latest price for each ticker
    if not snaps.exists():
        # use latest price so we always have a value
        total = p.cash
        for h in p.holdings.all():
            px = Decimal(str(get_latest_price(h.ticker)))
            total += h.quantity * px
        return total
    tickers_prices = {s.ticker: Decimal(str(s.close)) for s in snaps}
    total = p.cash
    for h in p.holdings.all():
        px = tickers_prices.get(h.ticker)
        if px:
            total += h.quantity * px
    return total


def get_portfolio_timeseries(p: Portfolio, range_param: str):
    # naive: build from snapshots intersection
    qs = PriceSnapshot.objects.filter(ticker__in=p.holdings.values_list("ticker", flat=True))
    dates = sorted(qs.values_list("date", flat=True).distinct())
    if range_param == "1d": dates = dates[-1:]
    elif range_param == "1w": dates = dates[-5:]
    elif range_param == "ytd":
        dates = [d for d in dates if d.year == date.today().year]
    elif range_param == "1y":
        cutoff = date.today() - timedelta(days=365)
        dates = [d for d in dates if d >= cutoff]
    series = []
    for d in dates:
        v = portfolio_value_on(p, d)
        if v is not None:
            series.append({"date": d.isoformat(), "value": float(v)})
    return series

def get_allocations_treemap(p: Portfolio):
    total = Decimal("0")
    latest_prices = {h.ticker: Decimal(str(get_latest_price(h.ticker))) for h in p.holdings.all()}
    for h in p.holdings.all():
        total += h.quantity * latest_prices[h.ticker]
    total += p.cash
    data = []
    for h in p.holdings.all():
        value = h.quantity * latest_prices[h.ticker]
        weight = float(value / total * 100) if total else 0
        data.append({"ticker": h.ticker, "weight": weight, "value": float(value)})
    if p.cash > 0:
        data.append({"ticker": "CASH", "weight": float(p.cash/total*100) if total else 0, "value": float(p.cash)})
    return {"total": float(total), "data": data}
