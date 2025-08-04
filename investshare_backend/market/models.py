from django.db import models

class PriceSnapshot(models.Model):
    ticker = models.CharField(max_length=15, db_index=True)
    date = models.DateField()
    close = models.DecimalField(max_digits=18, decimal_places=4)
    dividend = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    split = models.DecimalField(max_digits=10, decimal_places=4, default=1)

    class Meta:
        unique_together = ("ticker","date")
        ordering = ["ticker","date"]

class TickerInfo(models.Model):
    ticker = models.CharField(max_length=15, primary_key=True)
    market_cap = models.BigIntegerField(null=True, blank=True)
    pe = models.FloatField(null=True, blank=True)
    eps = models.FloatField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
