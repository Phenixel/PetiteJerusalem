from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.utils.text import slugify
import itertools


class Person(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    email = models.EmailField()

    def __str__(self):
        return self.user.username

    class Meta:
        verbose_name = _("Person")
        verbose_name_plural = _("People")


class Guest(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField()

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = _("Guest")
        verbose_name_plural = _("Guests")


class Session(models.Model):
    SESSION_TYPE_CHOICES = (
        (True, 'Mishna'),
        (False, 'Gemara'),
    )

    name = models.CharField(max_length=255)
    description = models.TextField()
    date_limit = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    person = models.ForeignKey('Person', on_delete=models.SET_NULL, blank=True, null=True)
    slug = models.SlugField(unique=True, max_length=255, blank=True, null=True)
    session_is = models.BooleanField(choices=SESSION_TYPE_CHOICES, default=False)

    def __str__(self):
        return self.name

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
        
    def clean(self):
        # Vérifier si la date limite est dans le futur
        if self.date_limit <= timezone.now().date():
            raise ValidationError("La date limite doit être dans le futur.")

    @property
    def is_completed(self):
        # Vérifier si la date de la session est dépassée
        if self.date_limit < timezone.now().date():
            return True

        # Vérifier la complétion en fonction du type de session
        if self.session_is:  # Mishna
            total_massekhets = Massekhet.objects.count()
            reserved_mishnas = Michna.objects.filter(session=self).count()
            return reserved_mishnas == total_massekhets
        else:  # Gemara
            total_gemarots = Gemarot.objects.count()
            reserved_gemaras = Gemara.objects.filter(session=self).count()
            return reserved_gemaras == total_gemarots

    class Meta:
        verbose_name = _("Session")
        verbose_name_plural = _("Sessions")
        ordering = ['-created_at']




class Gemarot(models.Model):
    name = models.CharField(max_length=255)
    livre = models.CharField(max_length=255)
    link = models.URLField(blank=True)
    perek = models.IntegerField(default=1)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = _("Gemarot")
        verbose_name_plural = _("Gemarot")


class Gemara(models.Model):
    session = models.ForeignKey('Session', on_delete=models.CASCADE)
    chosen_by = models.ForeignKey('Person', on_delete=models.SET_NULL, blank=True, null=True)
    chosen_by_guest = models.ForeignKey('Guest', on_delete=models.SET_NULL, blank=True, null=True)
    choose_gemarot = models.ForeignKey('Gemarot', on_delete=models.CASCADE)
    available = models.BooleanField(default=True)
    choose_perek = models.IntegerField( null=True, blank=True)  # Nouveau champ

    def __str__(self):
        return f"{self.choose_gemarot} - Session: {self.session.name}"

    class Meta:
        verbose_name = _("Gemara")
        verbose_name_plural = _("Gemara")
        
        
class Michna(models.Model):
    session = models.ForeignKey('Session', on_delete=models.CASCADE)
    chosen_by = models.ForeignKey('Person', on_delete=models.SET_NULL, blank=True, null=True)
    chosen_by_guest = models.ForeignKey('Guest', on_delete=models.SET_NULL, blank=True, null=True)
    choose_michna = models.ForeignKey('Massekhet', on_delete=models.CASCADE)
    available = models.BooleanField(default=True)
    choose_perek = models.IntegerField(null=True, blank=True)  # Nouveau champ

    def __str__(self):
        return f"{self.choose_michna} - Session: {self.session.name}"

    class Meta:
        verbose_name = _("Michna")
        verbose_name_plural = _("Michna")



class Seder(models.Model):
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Seder"
        verbose_name_plural = "Sederim"


class Massekhet(models.Model):
    name = models.CharField(max_length=255)
    seder = models.ForeignKey(Seder, on_delete=models.CASCADE, related_name='massekhtot')
    link = models.URLField(blank=True, null=True)  # Lien optionnel, par défaut null
    perek = models.IntegerField(default=1)

    def __str__(self):
        return f"{self.name} ({self.seder.name})"

    class Meta:
        verbose_name = "Massekhet"
        verbose_name_plural = "Massekhtot"