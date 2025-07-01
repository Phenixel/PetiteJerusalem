from django.apps import AppConfig
from django.db import connections


class ChainappConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ChainApp'

    def ready(self):
        connections['default'].cursor()
