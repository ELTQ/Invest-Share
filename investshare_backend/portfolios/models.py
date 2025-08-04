# portfolios/models.py
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from decimal import Decimal

class Portfolio(models.Model):
    VISIBILITY_CHOICES = [("public","Public"), ("private","Private")]
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="portfolio")
    name = models.CharField(max_length=100, default="My Portfolio")
    visibility = models.CharField(max_length=7, choices=VISIBILITY_CHOICES, default="public")
    cash = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    performance_cache = models.JSONField(blank=True, null=True)
    last_calc_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.owner.username}'s portfolio"


class Holding(models.Model):
    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name="holdings")
    ticker = models.CharField(max_length=15)
    quantity = models.DecimalField(max_digits=20, decimal_places=6, default=0)
    avg_cost = models.DecimalField(max_digits=18, decimal_places=4, default=0)

    class Meta:
        unique_together = ("portfolio", "ticker")

    def __str__(self):
        return f"{self.ticker} ({self.quantity})"


class Trade(models.Model):
    class Type(models.TextChoices):
        BUY = "BUY", "Buy"
        SELL = "SELL", "Sell"
        CASH_IN = "CASH_IN", "Cash In"
        CASH_OUT = "CASH_OUT", "Cash Out"
        SHORT_COVER = "SHORT_COVER", "Short Cover"

    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name="trades")
    type = models.CharField(max_length=12, choices=Type.choices)
    ticker = models.CharField(max_length=15, blank=True)
    quantity = models.DecimalField(max_digits=20, decimal_places=6, default=0, validators=[MinValueValidator(0)])
    price = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    cash_delta = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    executed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.type} {self.ticker} {self.quantity} @ {self.price}"
