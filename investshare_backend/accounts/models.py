# accounts/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    email = models.EmailField(unique=True)
    bio = models.TextField(blank=True)
    avatar_url = models.URLField(blank=True)

    REQUIRED_FIELDS = ["email"]

    def __str__(self):
        return self.username
