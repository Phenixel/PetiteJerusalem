from django.shortcuts import render, redirect
from django.views import View
from .models import Session
from datetime import date
from django.utils import timezone
from datetime import datetime


class HomeView(View):
    def get(self, request):
        today = date.today()
        ongoing_sessions = Session.objects.filter(date_limit__gte=today)
        completed_sessions = Session.objects.filter(date_limit__lt=today)
        return render(request, 'home.html', {'ongoing_sessions': ongoing_sessions, 'completed_sessions': completed_sessions})


class CreateSessionView(View):
    def get(self, request):
        return render(request, 'ChainApp/create_session.html')

    def post(self, request):
        name = request.POST.get('name')
        description = request.POST.get('description')
        date_limit_str = request.POST.get('date_limit')

        # Convertir la chaîne de caractères en objet datetime.date
        date_limit = datetime.strptime(date_limit_str, "%Y-%m-%d").date()

        # Vérifier si la date limite est déjà passée
        if timezone.now().date() > date_limit:
            error_message = "La date limite doit être une date future."
            return render(request, 'ChainApp/create_session.html', {'error_message': error_message})

        # Créer une nouvelle session
        new_session = Session(name=name, description=description, date_limit=date_limit)
        new_session.save()

        # Rediriger vers une page de confirmation ou une autre vue
        return redirect('home')


class SessionDetailView(View):
    def get(self, request, session_id):
        session = Session.objects.get(pk=session_id)
        return render(request, 'ChainApp/session_detail.html', {'session': session})