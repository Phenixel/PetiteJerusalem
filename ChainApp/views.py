from django.contrib.auth.models import User
from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from .models import Session, Gemara, Gemarot, Person
from datetime import date
from django.utils import timezone
from datetime import datetime
from django.contrib.auth import authenticate, login, logout


class HomeView(View):
    def get(self, request):
        today = date.today()
        ongoing_sessions = Session.objects.filter(date_limit__gte=today)
        completed_sessions = Session.objects.filter(date_limit__lt=today)
        return render(request, 'home.html', {'ongoing_sessions': ongoing_sessions, 'completed_sessions': completed_sessions})


class LoginView(View):
    def get(self, request):
        return render(request, 'login.html')

    def post(self, request):
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return redirect('home')  # Rediriger vers la page d'accueil après connexion
        else:
            # Gérer l'erreur d'authentification ici
            return render(request, 'login.html', {'error': 'Identifiants invalides'})


class SignupView(View):
    def get(self, request):
        return render(request, 'signup.html')

    def post(self, request):
        username = request.POST.get('username')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')

        if password != confirm_password:
            return render(request, 'signup.html', {'error': 'Passwords do not match'})

        # Création de l'utilisateur Django
        user = User.objects.create_user(username=username, password=password)

        # Création de l'objet Person lié à l'utilisateur
        person = Person.objects.create(user=user, name=username)

        # Connexion de l'utilisateur après la création du compte
        login(request, user)

        return redirect('home')


class LogoutView(View):
    def get(self, request):
        logout(request)
        return redirect('home')


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
        session = get_object_or_404(Session, id=session_id)
        gemarot = Gemarot.objects.all()
        context = {
            'session': session,
            'gemarot': gemarot,
        }
        return render(request, 'ChainApp/session_detail.html', context)

    def post(self, request, session_id):
        session = get_object_or_404(Session, id=session_id)
        gemara_id = request.POST.get('gemara_id')
        gemara = get_object_or_404(Gemarot, id=gemara_id)

        chosen_by = None
        if request.user.is_authenticated:
            chosen_by = request.user.person

        # Marquer la gemara comme prise pour cette session
        new_gemara = Gemara(session=session, gemarot=gemara, chosen_by=chosen_by)
        new_gemara.save()

        return redirect('session_detail', session_id=session_id)


