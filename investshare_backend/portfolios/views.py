# investshare_backend/portfolios/views.py
from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation

from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import Portfolio, Trade
from .serializers import (
    PortfolioSerializer,
    PublicPortfolioSerializer,
    TradeSerializer,
)
from .services import execute_trade
from market.prices import get_allocations_treemap, get_portfolio_timeseries

SYMBOL_RE = re.compile(r"^[A-Z0-9.\-]{1,20}$")

def _clean_symbol(value) -> str | None:
    s = (value or "").upper().strip()
    return s if SYMBOL_RE.match(s) else None

def _as_positive_decimal(value, field: str) -> Decimal:
    try:
        d = Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise ValidationError({field: "Invalid number."})
    if d <= 0:
        raise ValidationError({field: "Must be greater than 0."})
    return d

class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj: Portfolio):
        if request.method in permissions.SAFE_METHODS:
            return obj.visibility == "public" or obj.owner == request.user
        return obj.owner == request.user

class TenPerPage(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100

class PortfolioViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        base = (
            Portfolio.objects
            .select_related("owner")
            .prefetch_related("holdings")
            .order_by("-id")  # stable ordering to avoid UnorderedObjectListWarning
        )
        if self.request.user.is_authenticated:
            return base
        return base.filter(visibility="public")

    def perform_create(self, serializer):
        if hasattr(self.request.user, "portfolio"):
            raise ValidationError({"detail": "User already has a portfolio."})
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def mine(self, request):
        """Return the current user's portfolio (or 404)."""
        p = (
            Portfolio.objects
            .filter(owner=request.user)
            .select_related("owner")
            .prefetch_related("holdings")
            .first()
        )
        if not p:
            return Response({"detail": "not_found"}, status=404)
        return Response(PortfolioSerializer(p, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def chart(self, request, pk=None):
        portfolio = self.get_object()
        range_param = request.query_params.get("range", "all")
        try:
            data = get_portfolio_timeseries(portfolio, range_param)
            return Response(data)
        except Exception:
            return Response([{"date": date.today().isoformat(), "value": float(portfolio.cash or 0.0)}])

    @action(detail=True, methods=["get"])
    def allocations(self, request, pk=None):
        portfolio = self.get_object()
        try:
            data = get_allocations_treemap(portfolio)
            return Response(data)
        except Exception:
            return Response({
                "total": float(portfolio.cash or 0.0),
                "data": [{
                    "ticker": "CASH",
                    "value": float(portfolio.cash or 0.0),
                    "weight": 100.0,
                    "change_pct": 0.0,
                    "position": "cash",
                }],
            })

class TradeViewSet(viewsets.ReadOnlyModelViewSet):
    throttle_scope = "trade"
    serializer_class = TradeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = TenPerPage

    def get_queryset(self):
        pid = self.kwargs.get("portfolio_pk")
        portfolio = get_object_or_404(Portfolio, pk=pid)
        if portfolio.visibility == "private" and portfolio.owner != self.request.user:
            return Trade.objects.none()
        return portfolio.trades.all().order_by("-executed_at", "-id")

    @action(detail=False, methods=["post"], url_path="buy")
    def buy(self, request, portfolio_pk=None):
        return self._trade_action(request, portfolio_pk, "BUY")

    @action(detail=False, methods=["post"], url_path="sell")
    def sell(self, request, portfolio_pk=None):
        return self._trade_action(request, portfolio_pk, "SELL")

    @action(detail=False, methods=["post"], url_path="cash-in")
    def cash_in(self, request, portfolio_pk=None):
        return self._cash_action(request, portfolio_pk, "CASH_IN")

    @action(detail=False, methods=["post"], url_path="cash-out")
    def cash_out(self, request, portfolio_pk=None):
        return self._cash_action(request, portfolio_pk, "CASH_OUT")

    def _trade_action(self, request, portfolio_pk, ttype):
        portfolio = get_object_or_404(Portfolio, pk=portfolio_pk)
        if portfolio.owner != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        if request.data.get("price") not in (None, "", 0, "0", 0.0):
            return Response(
                {"error": {"code": "price_not_allowed", "message": "Manual price is not allowed. Orders execute at the current market price."}},
                status=400
            )

        ticker = _clean_symbol(request.data.get("ticker"))
        if not ticker:
            return Response({"error": {"code": "bad_ticker", "message": "Invalid ticker symbol."}}, status=400)

        try:
            qty_dec = _as_positive_decimal(request.data.get("quantity"), "quantity")
        except ValidationError as ve:
            return Response({"error": {"code": "bad_quantity", "message": ve.detail}}, status=400)

        try:
            trade = execute_trade(portfolio, trade_type=ttype, ticker=ticker, quantity=qty_dec, price=None)
            portfolio.refresh_from_db()
            return Response({
                "trade": TradeSerializer(trade).data,
                "portfolio": PortfolioSerializer(portfolio, context={"request": request}).data
            }, status=201)
        except Exception as e:
            return Response({"error": {"code": "trade_failed", "message": str(e)}}, status=400)

    def _cash_action(self, request, portfolio_pk, ttype):
        portfolio = get_object_or_404(Portfolio, pk=portfolio_pk)
        if portfolio.owner != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            amt_dec = _as_positive_decimal(request.data.get("amount"), "amount")
        except ValidationError as ve:
            return Response({"error": {"code": "bad_amount", "message": ve.detail}}, status=400)

        try:
            trade = execute_trade(portfolio, trade_type=ttype, ticker=None, cash_amount=amt_dec)
            portfolio.refresh_from_db()
            return Response({
                "trade": TradeSerializer(trade).data,
                "portfolio": PortfolioSerializer(portfolio, context={"request": request}).data
            }, status=201)
        except Exception as e:
            return Response({"error": {"code": "trade_failed", "message": str(e)}}, status=400)

class PublicPortfolioListView(generics.ListAPIView):
    serializer_class = PublicPortfolioSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return (
            Portfolio.objects
            .filter(visibility="public")
            .select_related("owner")
            .prefetch_related("holdings")
            .order_by("-id")
        )
