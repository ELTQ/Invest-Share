from decimal import Decimal
from django.db import transaction
from .models import Portfolio, Holding, Trade
from market.prices import get_latest_price

from decimal import Decimal
from django.db import transaction
from .models import Portfolio, Holding, Trade
from market.prices import get_latest_price

def _market_price(ticker: str) -> Decimal:
    return Decimal(str(get_latest_price(ticker)))

def execute_trade(portfolio: Portfolio, *, trade_type: str, ticker: str | None,
                  quantity: Decimal = Decimal("0"),
                  price: Decimal | None = None,          # kept for signature compatibility
                  cash_amount: Decimal | None = None):

    with transaction.atomic():
        portfolio = Portfolio.objects.select_for_update().get(pk=portfolio.pk)

        if trade_type in ("BUY", "SELL", "SHORT_COVER"):
            if not ticker:
                raise ValueError("ticker required")
            price = _market_price(ticker)                # ← ALWAYS server price
            cost = quantity * price
            holding, _ = Holding.objects.get_or_create(portfolio=portfolio, ticker=ticker)

            if trade_type == "BUY":
                if portfolio.cash < cost:
                    raise ValueError("Not enough cash")
                total_shares = holding.quantity + quantity
                holding.avg_cost = (
                    (holding.avg_cost * holding.quantity + cost) / total_shares
                    if total_shares else Decimal("0")
                )
                holding.quantity = total_shares
                portfolio.cash -= cost
                trade = Trade.objects.create(
                    portfolio=portfolio, type=Trade.Type.BUY, ticker=ticker,
                    quantity=quantity, price=price, cash_delta=-cost
                )

            elif trade_type == "SELL":
                if holding.quantity < quantity:
                    short_qty = quantity - holding.quantity
                    if not _short_ok(portfolio, short_qty, price):
                        raise ValueError("Short exposure exceeds equity")
                    holding.quantity -= quantity          # can go negative
                else:
                    holding.quantity -= quantity
                proceeds = cost
                portfolio.cash += proceeds
                trade = Trade.objects.create(
                    portfolio=portfolio, type=Trade.Type.SELL, ticker=ticker,
                    quantity=quantity, price=price, cash_delta=proceeds
                )
                if holding.quantity == 0:
                    holding.avg_cost = Decimal("0")

            elif trade_type == "SHORT_COVER":
                if holding.quantity >= 0:
                    raise ValueError("You are not short this ticker")
                if portfolio.cash < cost:
                    raise ValueError("Not enough cash to cover")
                holding.quantity += quantity
                portfolio.cash -= cost
                trade = Trade.objects.create(
                    portfolio=portfolio, type=Trade.Type.SHORT_COVER, ticker=ticker,
                    quantity=quantity, price=price, cash_delta=-cost
                )
                if holding.quantity == 0:
                    holding.avg_cost = Decimal("0")

            holding.save()

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

def _short_ok(portfolio: Portfolio, short_qty: Decimal, price: Decimal) -> bool:
    short_value = short_qty * price
    equity = portfolio_equity(portfolio)
    return short_value <= equity

def portfolio_equity(portfolio: Portfolio) -> Decimal:
    from market.prices import get_latest_price
    total = portfolio.cash
    for h in portfolio.holdings.all():
        px = Decimal(str(get_latest_price(h.ticker)))
        total += h.quantity * px
    return total
