from django.db import models


class Session(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    date_limit = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Gemara(models.Model):
    name = models.CharField(max_length=255)
    available = models.BooleanField(default=True)
    session = models.ForeignKey('Session', on_delete=models.CASCADE, blank=True, null=True)

    def __str__(self):
        return self.name
