from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import PortfolioViewSet, TradeViewSet
from .views import PublicPortfolioListView

router = DefaultRouter()
router.register(r"portfolios", PortfolioViewSet, basename="portfolio")

# Nested trades
trade_list = TradeViewSet.as_view({"get":"list"})
urlpatterns = [
    path("", include(router.urls)),
    path("portfolios/<int:portfolio_pk>/trades/", trade_list, name="trade-list"),
    path("portfolios/<int:portfolio_pk>/trades/buy/", TradeViewSet.as_view({"post":"buy"})),
    path("portfolios/<int:portfolio_pk>/trades/sell/", TradeViewSet.as_view({"post":"sell"})),
    path("portfolios/<int:portfolio_pk>/trades/cash-in/", TradeViewSet.as_view({"post":"cash_in"})),
    path("portfolios/<int:portfolio_pk>/trades/cash-out/", TradeViewSet.as_view({"post":"cash_out"})),
    path("public-portfolios/", PublicPortfolioListView.as_view(), name="public-portfolios"),
]
