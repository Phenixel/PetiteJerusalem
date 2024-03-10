from django.shortcuts import render, redirect
from django.views import View
from .models import Session


class HomeView(View):
    def get(self, request):
        sessions = Session.objects.all()
        return render(request, 'home.html', {'sessions': sessions})


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
