from django.utils import timezone
from ChainApp.models import Annonces

def active_announcements(request):
    active_announcements = Annonces.objects.filter(start_date__lte=timezone.now(), end_date__gte=timezone.now())
    return {'active_announcements': active_announcements}
