# market/serializers.py
from rest_framework import serializers
from .models import TickerInfo

class TickerInfoSerializer(serializers.ModelSerializer):
    price = serializers.FloatField(read_only=True)
    change_pct = serializers.FloatField(read_only=True)
    change_abs = serializers.FloatField(read_only=True)

    class Meta:
        model = TickerInfo
        fields = ["ticker","market_cap","pe","eps","price","change_pct","change_abs"]
