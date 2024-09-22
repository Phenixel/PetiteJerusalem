from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.utils.text import slugify
import itertools


class Person(models.Model):
    """
    Model representing a person
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    email = models.EmailField()

    def __str__(self):
        return self.user.username

    class Meta:
        verbose_name = _("Person")
        verbose_name_plural = _("People")


class Guest(models.Model):
    """
    Model representing a guest
    """
    name = models.CharField(max_length=255)
    email = models.EmailField()

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = _("Guest")
        verbose_name_plural = _("Guests")


class TextStudy(models.Model):
    """
    Model representing a text study
    """
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=255)  # ex., Mishna, Gemara, Tehilim, etc.
    livre = models.CharField(max_length=255, default="")  # ex., Berakhot, Shabbat, etc.
    link = models.URLField(blank=True)
    total_sections = models.IntegerField(default=1)

    def __str__(self):
        return f"{self.name} ({self.type})"

    class Meta:
        verbose_name = _("Text Study")
        verbose_name_plural = _("Text Studies")


class Session(models.Model):
    """
    Model representing a session of text study
    """
    name = models.CharField(max_length=255)
    description = models.TextField()
    date_limit = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    person = models.ForeignKey('Person', on_delete=models.SET_NULL, blank=True, null=True)
    slug = models.SlugField(unique=True, max_length=255, blank=True, null=True)

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
        """
        Check if the date limit is in the future
        """
        if self.date_limit <= timezone.now().date():
            raise ValidationError("La date limite doit être dans le futur.")

    @property
    def is_completed(self):
        """
        Check if the session is completed
        :return: True if the session is completed, False otherwise
        """
        if self.date_limit < timezone.now().date():
            return True

        total_texts = TextStudy.objects.count()
        reserved_texts = TextStudyReservation.objects.filter(session=self, section__isnull=True).count()

        for text in TextStudy.objects.all():
            total_sections = text.total_sections
            reserved_sections = TextStudyReservation.objects.filter(session=self, text_study=text,
                                                                    section__isnull=False).count()

            if reserved_sections < total_sections and not TextStudyReservation.objects.filter(session=self,
                                                                                              text_study=text,
                                                                                              section__isnull=True).exists():
                return False

        return reserved_texts + reserved_sections == total_texts + total_sections

    class Meta:
        verbose_name = _("Session")
        verbose_name_plural = _("Sessions")
        ordering = ['-created_at']


class TextStudyReservation(models.Model):
    """
    Model representing a reservation of a text study
    """
    session = models.ForeignKey('Session', on_delete=models.CASCADE)
    chosen_by = models.ForeignKey('Person', on_delete=models.SET_NULL, blank=True, null=True)
    chosen_by_guest = models.ForeignKey('Guest', on_delete=models.SET_NULL, blank=True, null=True)
    text_study = models.ForeignKey('TextStudy', on_delete=models.CASCADE)
    available = models.BooleanField(default=True)
    section = models.IntegerField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.text_study} - Session: {self.session.name}"

    class Meta:
        verbose_name = _("Text Study Reservation")
        verbose_name_plural = _("Text Study Reservations")
