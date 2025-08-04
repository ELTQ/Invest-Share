from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import generics
from django.shortcuts import get_object_or_404
from .models import Portfolio, Trade
from .serializers import PortfolioSerializer, TradeSerializer, PublicPortfolioSerializer
from .services import execute_trade, portfolio_equity
from market.prices import get_portfolio_timeseries, get_allocations_treemap

class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return obj.visibility == "public" or obj.owner == request.user
        return obj.owner == request.user

class PortfolioViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return Portfolio.objects.all()
        return Portfolio.objects.filter(visibility="public")

    def perform_create(self, serializer):
        # enforce one per user
        if hasattr(self.request.user, "portfolio"):
            raise ValueError("User already has a portfolio")
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get"])
    def chart(self, request, pk=None):
        portfolio = self.get_object()
        range_param = request.query_params.get("range","all")
        data = get_portfolio_timeseries(portfolio, range_param)
        return Response(data)

    @action(detail=True, methods=["get"])
    def allocations(self, request, pk=None):
        portfolio = self.get_object()
        data = get_allocations_treemap(portfolio)
        return Response(data)

class TradeViewSet(viewsets.ReadOnlyModelViewSet):
    throttle_scope = "trade"
    serializer_class = TradeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        pid = self.kwargs.get("portfolio_pk")
        portfolio = get_object_or_404(Portfolio, pk=pid)
        if portfolio.visibility == "private" and portfolio.owner != self.request.user:
            return Trade.objects.none()
        return portfolio.trades.all()

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

        # Reject manual price
        if "price" in request.data and request.data.get("price") not in (None, "", 0, "0", 0.0):
            return Response(
                {"error": {"code": "price_not_allowed",
                           "message": "Manual price is not allowed. Orders execute at the current market price."}},
                status=400
            )

        ticker = request.data.get("ticker")
        qty = request.data.get("quantity")

        from decimal import Decimal
        try:
            trade = execute_trade(
                portfolio,
                trade_type=ttype,
                ticker=ticker,
                quantity=Decimal(str(qty)),
                price=None,                      # explicitly ignore client price
            )
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
        amount = request.data.get("amount")
        from decimal import Decimal
        try:
            trade = execute_trade(portfolio, trade_type=ttype, ticker=None, cash_amount=Decimal(str(amount)))
            portfolio.refresh_from_db()
            return Response({
                "trade": TradeSerializer(trade).data,
                "portfolio": PortfolioSerializer(portfolio, context={"request": request}).data
            }, status=201)
        except Exception as e:
            return Response({"error": {"code": "trade_failed", "message": str(e)}}, status=400)
        
        
class PublicPortfolioListView(generics.ListAPIView):
    """
    Returns username, portfolio value, today's return for PUBLIC portfolios.
    """
    serializer_class = PublicPortfolioSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Portfolio.objects.filter(visibility="public").select_related("owner")
