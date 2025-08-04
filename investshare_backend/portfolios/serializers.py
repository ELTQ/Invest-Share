from rest_framework import serializers
from .models import Portfolio, Holding, Trade

class HoldingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Holding
        fields = ["id", "ticker", "quantity", "avg_cost"]

class PortfolioSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    holdings = HoldingSerializer(many=True, read_only=True)
    total_value = serializers.SerializerMethodField()
    todays_change = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = ["id","name","visibility","cash","owner_username",
                  "total_value","todays_change","holdings","created_at"]

    def get_total_value(self, obj):
        from portfolios.services import portfolio_equity
        return float(portfolio_equity(obj))

    def get_todays_change(self, obj):
        # simple EOD compare
        from market.prices import get_change_today_portfolio
        return get_change_today_portfolio(obj)

class TradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trade
        fields = ["id","type","ticker","quantity","price","cash_delta","executed_at"]

class PublicPortfolioSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    total_value = serializers.SerializerMethodField()
    todays_change = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = ["id", "owner_username", "total_value", "todays_change"]

    def get_total_value(self, obj):
        from portfolios.services import portfolio_equity
        return float(portfolio_equity(obj))

    def get_todays_change(self, obj):
        from market.prices import get_change_today_portfolio
        return get_change_today_portfolio(obj)
