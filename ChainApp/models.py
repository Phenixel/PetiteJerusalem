from django.db import models
from django.contrib.auth.models import User


class Person(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)

    def __str__(self):
        return self.user.username


class Session(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    date_limit = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    person = models.ForeignKey('Person', on_delete=models.SET_NULL, blank=True, null=True)

    def __str__(self):
        return self.name


class Gemarot(models.Model):
    name = models.CharField(max_length=255)
    livre = models.CharField(max_length=255)
    link = models.URLField(blank=True)

    def __str__(self):
        return self.name


class Gemara(Gemarot):
    session = models.ForeignKey('Session', on_delete=models.CASCADE)
    chosen_by = models.ForeignKey('Person', on_delete=models.SET_NULL, blank=True, null=True)
    available = models.BooleanField(default=True)
    gemarot_ptr = models.OneToOneField(Gemarot, parent_link=True, on_delete=models.CASCADE, default=1)

    def __str__(self):
        return f"{self.name} - Session: {self.session.name}"

