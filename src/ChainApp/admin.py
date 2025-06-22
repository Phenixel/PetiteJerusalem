from django.contrib import admin
from .models import *


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'email')
    search_fields = ('name', 'email')
    ordering = ('name',)


@admin.register(Guest)
class GuestAdmin(admin.ModelAdmin):
    list_display = ('name', 'email')
    search_fields = ('name', 'email')
    ordering = ('name',)


@admin.register(TypeTextStudy)
class TypeTextStudyAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(TextStudy)
class TextStudyAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'livre', 'total_sections', 'link')
    list_editable = ('total_sections', 'link')
    search_fields = ('name', 'livre')
    list_filter = ('type',)
    ordering = ('name',)


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'date_limit', 'created_at', 'person', 'slug')
    search_fields = ('name', 'description')
    list_filter = ('type', 'date_limit')
    ordering = ('-created_at',)


@admin.register(TextStudyReservation)
class TextStudyReservationAdmin(admin.ModelAdmin):
    list_display = ('session', 'text_study', 'chosen_by', 'chosen_by_guest', 'available', 'section', 'is_completed')
    search_fields = ('session__name', 'text_study__name', 'chosen_by__name', 'chosen_by_guest__name')
    list_filter = ('available', 'is_completed')
    ordering = ('session', 'text_study')


@admin.register(Annonces)
class AnnoncesAdmin(admin.ModelAdmin):
    list_display = ('titre', 'start_date', 'end_date', 'lien')
    search_fields = ('titre', 'description')
    list_filter = ('start_date', 'end_date')
    ordering = ('-start_date',)
