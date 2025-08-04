# portfolios/services.py
from decimal import Decimal
from django.db import transaction
from .models import Portfolio, Holding, Trade
from market.prices import get_latest_price

def _mkt_price(ticker: str) -> Decimal:
    return Decimal(str(get_latest_price(ticker)))

def _weighted_avg(old_qty_abs: Decimal, old_avg: Decimal, add_qty: Decimal, add_price: Decimal) -> Decimal:
    # old_qty_abs, add_qty are positive magnitudes
    total = old_qty_abs + add_qty
    if total == 0:
        return Decimal("0")
    return (old_avg * old_qty_abs + add_price * add_qty) / total

@transaction.atomic
def execute_trade(portfolio: Portfolio, *,
                  trade_type: str,
                  ticker: str | None,
                  quantity: Decimal = Decimal("0"),
                  price: Decimal | None = None,
                  cash_amount: Decimal | None = None):

    portfolio = Portfolio.objects.select_for_update().get(pk=portfolio.pk)

    if trade_type in ("BUY", "SELL"):
        if not ticker:
            raise ValueError("ticker required")
        price = _mkt_price(ticker)  # market orders only
        cost = quantity * price

        holding, _ = Holding.objects.get_or_create(portfolio=portfolio, ticker=ticker)
        q = holding.quantity  # may be negative for short

        if trade_type == "BUY":
            # BUY reduces short or increases long
            if q < 0:
                # covering the short first
                cover_qty = min(quantity, -q)
                if portfolio.cash < cover_qty * price:
                    raise ValueError("Not enough cash to cover")
                portfolio.cash -= cover_qty * price
                q += cover_qty
                remaining_buy = quantity - cover_qty

                if remaining_buy > 0:
                    # crossed through zero: now long with remaining_buy at current price
                    q = remaining_buy
                    holding.avg_cost = price
                # if still short or exactly zero, avg_cost for short remains as-is
            else:
                # was flat/long: average cost upwards (DCA)
                if portfolio.cash < cost:
                    raise ValueError("Not enough cash")
                new_total = q + quantity
                holding.avg_cost = _weighted_avg(q, holding.avg_cost, quantity, price)
                q = new_total
                portfolio.cash -= cost

            trade = Trade.objects.create(
                portfolio=portfolio, type=Trade.Type.BUY,
                ticker=ticker, quantity=quantity, price=price, cash_delta=-cost
            )

        elif trade_type == "SELL":
            # SELL reduces long or opens/extends short
            proceeds = cost

            if q > 0:
                sell_from_long = min(quantity, q)
                q -= sell_from_long
                portfolio.cash += sell_from_long * price
                remaining_sell = quantity - sell_from_long
            else:
                remaining_sell = quantity

            if remaining_sell > 0:
                # open/extend short
                old_abs = abs(q)  # q <= 0 here
                q -= remaining_sell  # more negative
                if old_abs == 0:
                    holding.avg_cost = price
                else:
                    holding.avg_cost = _weighted_avg(old_abs, holding.avg_cost, remaining_sell, price)
                portfolio.cash += remaining_sell * price

            trade = Trade.objects.create(
                portfolio=portfolio, type=Trade.Type.SELL,
                ticker=ticker, quantity=quantity, price=price, cash_delta=proceeds
            )

        # finalize qty
        holding.quantity = q

        # remove row if quantity is exactly zero
        if holding.quantity == 0:
            holding.delete()
        else:
            holding.save()

        portfolio.save()
        return trade

    elif trade_type in ("CASH_IN", "CASH_OUT"):
        if cash_amount is None:
            raise ValueError("cash_amount required")
        if trade_type == "CASH_OUT" and portfolio.cash < cash_amount:
            raise ValueError("Not enough cash")

        delta = cash_amount if trade_type == "CASH_IN" else -cash_amount
        portfolio.cash += delta
        trade = Trade.objects.create(
            portfolio=portfolio, type=trade_type, cash_delta=delta
        )
        portfolio.save()
        return trade

    else:
        raise ValueError("Unsupported trade type")

def portfolio_equity(portfolio: Portfolio) -> Decimal:
    """
    Current equity = cash + Σ(quantity * latest_price) for all holdings.
    Works for both long (quantity > 0) and short (quantity < 0).
    """
    total = Decimal(str(portfolio.cash))
    for h in Holding.objects.filter(portfolio=portfolio):
        price = Decimal(str(get_latest_price(h.ticker)))
        total += Decimal(str(h.quantity)) * price
    return total
