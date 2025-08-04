from django.urls import path
from .views import TickerSearchView, TickerDetailView

urlpatterns = [
    path("tickers/search/", TickerSearchView.as_view()),
    path("tickers/<str:symbol>/", TickerDetailView.as_view()),
]
