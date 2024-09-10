from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.utils.text import slugify
import itertools # Permet de faire les itération pour les slug du meme nom 

class Person(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    email = models.EmailField()

    def __str__(self):
        return self.user.username

    class Meta:
        verbose_name = _("Person")
        verbose_name_plural = _("People")


# class Session(models.Model):
#     name = models.CharField(max_length=255)
#     description = models.TextField()
#     date_limit = models.DateField()
#     created_at = models.DateTimeField(auto_now_add=True)
#     person = models.ForeignKey('Person', on_delete=models.SET_NULL, blank=True, null=True)

#     def __str__(self):
#         return self.name

#     def clean(self):
#         if self.date_limit < timezone.now().date():
#             raise ValidationError(_("The date limit must be a future date."))

#     class Meta:
#         verbose_name = _("Session")
#         verbose_name_plural = _("Sessions")
#         ordering = ['-created_at']



class Session(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    date_limit = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    person = models.ForeignKey('Person', on_delete=models.SET_NULL, blank=True, null=True)
    slug = models.SlugField(unique=True, max_length=255, blank=True, null=True)

    def __str__(self):
        return self.name

    def clean(self):
        if self.date_limit < timezone.now().date():
            raise ValidationError(_("The date limit must be a future date."))

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            for i in itertools.count(1):
                if not Session.objects.filter(slug=slug).exists():
                    break
                slug = f'{base_slug}-{i}'
            self.slug = slug
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = _("Session")
        verbose_name_plural = _("Sessions")
        ordering = ['-created_at']

class Gemarot(models.Model):
    name = models.CharField(max_length=255)
    livre = models.CharField(max_length=255)
    link = models.URLField(blank=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = _("Gemarot")
        verbose_name_plural = _("Gemarot")


class Gemara(models.Model):
    session = models.ForeignKey('Session', on_delete=models.CASCADE)
    chosen_by = models.ForeignKey('Person', on_delete=models.SET_NULL, blank=True, null=True)
    choose_gemarot = models.ForeignKey('Gemarot', on_delete=models.CASCADE)
    available = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.choose_gemarot} - Session: {self.session.name}"

    class Meta:
        verbose_name = _("Gemara")
        verbose_name_plural = _("Gemarot")
