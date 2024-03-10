from django.shortcuts import render, redirect
from django.views import View
from .models import Session
from datetime import date


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
        date_limit = request.POST.get('date_limit')

        # Créer une nouvelle session
        new_session = Session(name=name, description=description, date_limit=date_limit)
        new_session.save()

        # Rediriger vers une page de confirmation ou une autre vue
        return redirect('home')  # Rediriger vers la page d'accueil après création


class SessionDetailView(View):
    def get(self, request, session_id):
        session = Session.objects.get(pk=session_id)
        return render(request, 'ChainApp/session_detail.html', {'session': session})