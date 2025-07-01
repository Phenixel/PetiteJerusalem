import sys
from django.apps import AppConfig
from django.db import connections, OperationalError


class ChainappConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ChainApp'

    def ready(self):
        if 'runserver' in sys.argv or 'gunicorn' in sys.argv[0]:
            try:
                connections['default'].cursor()
            except OperationalError:
                raise RuntimeError("Database is not available!")
