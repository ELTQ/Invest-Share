# portfolios/services.py
from __future__ import annotations

from decimal import Decimal
from datetime import date
from django.db import transaction
from django.utils import timezone

from .models import Portfolio, Holding, Trade
from market.models import PriceSnapshot
from market.prices import get_trade_price, get_latest_price


def _D(x) -> Decimal:
    try:
        return Decimal(str(x))
    except Exception:
        return Decimal("0")


def _weighted_avg(old_qty_abs: Decimal, old_avg: Decimal, add_qty: Decimal, add_price: Decimal) -> Decimal:
    # old_qty_abs, add_qty are positive magnitudes
    total = old_qty_abs + add_qty
    if total == 0:
        return Decimal("0")
    return (old_avg * old_qty_abs + add_price * add_qty) / total


@transaction.atomic
def execute_trade(
    portfolio: Portfolio,
    *,
    trade_type: str,
    ticker: str | None,
    quantity: Decimal = Decimal("0"),
    price: Decimal | None = None,        # ignored for market orders
    cash_amount: Decimal | None = None,
):
    """
    Executes BUY/SELL/CASH_IN/CASH_OUT.

    - BUY/SELL: executes at current market (intraday) price via get_trade_price()
    - CASH_IN/OUT: adjusts cash only
    """
    # lock the portfolio row
    portfolio = Portfolio.objects.select_for_update().get(pk=portfolio.pk)

    if trade_type in ("BUY", "SELL"):
        if not ticker:
            raise ValueError("ticker required")
        if quantity is None or quantity <= 0:
            raise ValueError("positive quantity required")

        # Use intraday last for execution so prices can differ trade-to-trade within the same day
        px = _D(get_trade_price(ticker))
        if px <= 0:
            raise ValueError("Could not fetch market price")

        holding, _ = Holding.objects.select_for_update().get_or_create(
            portfolio=portfolio, ticker=ticker, defaults={"quantity": Decimal("0"), "avg_cost": Decimal("0")}
        )

        q = _D(holding.quantity)  # may be negative for short
        qty = _D(quantity)
        cost = qty * px

        if trade_type == "BUY":
            # BUY reduces short or increases long
            if q < 0:
                # cover short first
                cover_qty = min(qty, -q)
                if _D(portfolio.cash) < cover_qty * px:
                    raise ValueError("Not enough cash to cover")
                portfolio.cash = _D(portfolio.cash) - cover_qty * px
                q = q + cover_qty
                remaining_buy = qty - cover_qty

                if remaining_buy > 0:
                    # crossed through zero → now long with remaining at current price
                    q = remaining_buy
                    holding.avg_cost = px
                # if still short or exactly zero, keep existing short avg_cost
            else:
                # was flat/long: average cost (DCA)
                if _D(portfolio.cash) < cost:
                    raise ValueError("Not enough cash")
                new_total = q + qty
                holding.avg_cost = _weighted_avg(abs(q), _D(holding.avg_cost), qty, px)
                q = new_total
                portfolio.cash = _D(portfolio.cash) - cost

            trade = Trade.objects.create(
                portfolio=portfolio,
                type=Trade.Type.BUY if hasattr(Trade, "Type") else "BUY",
                ticker=ticker,
                quantity=qty,
                price=px,
                cash_delta=-cost,
                executed_at=timezone.now(),
            )

        else:  # SELL
            proceeds = cost

            if q > 0:
                sell_from_long = min(qty, q)
                q = q - sell_from_long
                portfolio.cash = _D(portfolio.cash) + sell_from_long * px
                remaining_sell = qty - sell_from_long
            else:
                remaining_sell = qty

            if remaining_sell > 0:
                # open/extend short
                old_abs = abs(q)  # q <= 0 here
                q = q - remaining_sell  # more negative
                if old_abs == 0:
                    holding.avg_cost = px
                else:
                    holding.avg_cost = _weighted_avg(old_abs, _D(holding.avg_cost), remaining_sell, px)
                portfolio.cash = _D(portfolio.cash) + remaining_sell * px

            trade = Trade.objects.create(
                portfolio=portfolio,
                type=Trade.Type.SELL if hasattr(Trade, "Type") else "SELL",
                ticker=ticker,
                quantity=qty,
                price=px,
                cash_delta=proceeds,
                executed_at=timezone.now(),
            )

        # finalize qty
        holding.quantity = q

        # remove row if quantity is exactly zero
        if holding.quantity == 0:
            holding.delete()
        else:
            holding.save()

        # Save portfolio cash
        portfolio.save(update_fields=["cash"])

        # Upsert a snapshot for TODAY so downstream charts/allocations have a fresh point
        try:
            PriceSnapshot.objects.update_or_create(
                ticker=ticker,
                date=date.today(),
                defaults={"close": float(px)},
            )
        except Exception:
            # non-fatal
            pass

        return trade

    elif trade_type in ("CASH_IN", "CASH_OUT"):
        if cash_amount is None or cash_amount <= 0:
            raise ValueError("positive cash_amount required")

        delta = _D(cash_amount) if trade_type == "CASH_IN" else -_D(cash_amount)
        if _D(portfolio.cash) + delta < 0:
            raise ValueError("Not enough cash")

        portfolio.cash = _D(portfolio.cash) + delta
        trade = Trade.objects.create(
            portfolio=portfolio,
            type=trade_type,
            cash_delta=delta,
            executed_at=timezone.now(),
        )
        portfolio.save(update_fields=["cash"])
        return trade

    else:
        raise ValueError("Unsupported trade type")


def portfolio_equity(portfolio: Portfolio) -> Decimal:
    """
    Current equity = cash + Σ(quantity * latest_price).
    (Uses latest price; charts/allocations can use snapshots + intraday as needed.)
    """
    total = _D(portfolio.cash)
    for h in Holding.objects.filter(portfolio=portfolio):
        price = _D(get_latest_price(h.ticker))
        total += _D(h.quantity) * price
    return total
