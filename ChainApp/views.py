from django.contrib.auth.models import User
from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from .models import Session, Gemara, Gemarot, Person, Guest, Massekhet, Michna, Seder
from datetime import date
from django.utils import timezone
from django.contrib.auth import authenticate, login, logout
import dateparser
from django.db.models import Count, Q
from django.contrib import messages



class HomeView(View):
    def get(self, request):
        today = date.today()
        ongoing_sessions = Session.objects.filter(date_limit__gte=today)
        completed_sessions = Session.objects.filter(date_limit__lt=today)
        return render(request, 'home.html',
                      {'ongoing_sessions': ongoing_sessions, 'completed_sessions': completed_sessions})


class LoginView(View):
    def get(self, request):
        return render(request, 'login.html')

    def post(self, request):
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return redirect('home')
        else:
            # Gérer l'erreur d'authentification ici
            return render(request, 'login.html', {'error': 'Identifiants invalides'})


class SignupView(View):
    def get(self, request):
        return render(request, 'signup.html')

    def post(self, request):
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')

        # Vérification du mot de passe fort
        if len(password) < 8:
            return render(request, 'signup.html', {'error': 'Password must be at least 8 characters long'})

        if not any(char.isdigit() for char in password):
            return render(request, 'signup.html', {'error': 'Password must contain at least one digit'})

        # Autres vérifications de la force du mot de passe si nécessaire

        if password != confirm_password:
            return render(request, 'signup.html', {'error': 'Passwords do not match'})

        # Création de l'utilisateur Django et Person
        user = User.objects.create_user(username=username, email=email, password=password)
        person = Person.objects.create(user=user, name=username, email=email)

        # Connexion de l'utilisateur après la création du compte
        login(request, user)

        return redirect('home')


class LogoutView(View):
    def get(self, request):
        logout(request)
        return redirect('home')


class CreateSessionView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect('login')
        return render(request, 'ChainApp/create_session.html')

    def post(self, request):
        name = request.POST.get('name')
        description = request.POST.get('description')
        date_limit_str = request.POST.get('date_limit')
        session_type = request.POST.get('session_type')  # Récupère la valeur du bouton radio

        date_limit = dateparser.parse(date_limit_str, date_formats=['%Y-%m-%d']).date()

        if timezone.now().date() > date_limit:
            error_message = "La date limite doit être une date future."
            return render(request, 'ChainApp/create_session.html', {'error_message': error_message})

        person = None
        if request.user.is_authenticated:
            person = request.user.person

        new_session = Session(
            name=name,
            description=description,
            date_limit=date_limit,
            person=person,
            session_is=True if session_type == "mishna" else False  # Définit le type de session
        )
        new_session.save()

        return redirect('home')

class SessionDetailView(View):
    def get(self, request, slug):
        session = get_object_or_404(Session, slug=slug)  # Récupérer la session par slug

        if session.session_is:
            sedarim = Seder.objects.prefetch_related('massekhtot').all()
            masekhtot_list = []

            for seder in sedarim:
                seder_data = {
                    'seder': seder,
                    'massekhtot': []
                }

                for masekhet in seder.massekhtot.all():
                    masekhet_reservation = Michna.objects.filter(session=session, choose_michna=masekhet).first()
                    reserved_by_user = masekhet_reservation and masekhet_reservation.chosen_by == request.user.person if request.user.is_authenticated else None

                    seder_data['massekhtot'].append({
                        'masekhet': masekhet,
                        'reserved': masekhet_reservation is not None,
                        'chosen_by_username': (
                            masekhet_reservation.chosen_by.user.username if masekhet_reservation and masekhet_reservation.chosen_by else
                            masekhet_reservation.chosen_by_guest.name if masekhet_reservation and masekhet_reservation.chosen_by_guest else None),
                        'reserved_by_user': reserved_by_user,
                    })

                masekhtot_list.append(seder_data)

            context = {
                'session': session,
                'seder_list': masekhtot_list,  # Utilisez 'seder_list' pour l'envoyer au template
            }
        else:
            # Si la session est une session de Gemara
            gemarot = Gemarot.objects.all()
            gemarot_list = []
            for gemara in gemarot:
                gemara_reservation = Gemara.objects.filter(session=session, choose_gemarot=gemara).first()
                if request.user.is_authenticated:
                    reserved_by_user = gemara_reservation and gemara_reservation.chosen_by == request.user.person
                else:
                    reserved_by_user = None

                gemarot_list.append({
                    'gemara': gemara,
                    'reserved': gemara_reservation is not None,
                    'chosen_by_username': (
                        gemara_reservation.chosen_by.user.username if gemara_reservation and gemara_reservation.chosen_by else
                        gemara_reservation.chosen_by_guest.name if gemara_reservation and gemara_reservation.chosen_by_guest else None),
                    'reserved_by_user': reserved_by_user,
                })

            context = {
                'session': session,
                'gemarot_list': gemarot_list,
            }

        return render(request, 'ChainApp/session_detail.html', context)

    def post(self, request, slug):
        session = get_object_or_404(Session, slug=slug)  # Récupérer la session par slug

        if session.session_is:
            masekhet_ids = request.POST.getlist('masekhtot')  # Récupère une liste d'IDs des Massekhtot sélectionnées

            if request.user.is_authenticated:
                person = request.user.person
                user_reservations = Michna.objects.filter(session=session, chosen_by=person)

                # Annuler les réservations décochées (seulement si l'utilisateur est connecté)
                for reservation in user_reservations:
                    if str(reservation.choose_michna.id) not in masekhet_ids:
                        reservation.delete()

                # Ajouter les nouvelles réservations cochées
                for masekhet_id in masekhet_ids:
                    masekhet = get_object_or_404(Massekhet, pk=masekhet_id)
                    if not Michna.objects.filter(session=session, choose_michna=masekhet, chosen_by=person).exists():
                        Michna.objects.create(
                            session=session,
                            choose_michna=masekhet,
                            chosen_by=person,
                            available=False
                        )
            else:
                guest_name = request.POST.get('guest_name')
                guest_email = request.POST.get('guest_email')
                guest, created = Guest.objects.get_or_create(email=guest_email, defaults={'name': guest_name})

                # Ajouter les nouvelles réservations cochées
                for masekhet_id in masekhet_ids:
                    masekhet = get_object_or_404(Massekhet, pk=masekhet_id)
                    if not Michna.objects.filter(session=session, choose_michna=masekhet, chosen_by_guest=guest).exists():
                        Michna.objects.create(
                            session=session,
                            choose_michna=masekhet,
                            chosen_by_guest=guest,
                            available=False
                        )
        else:
            gemara_ids = request.POST.getlist('gemarot')  # Récupère une liste d'IDs des Gemarot sélectionnées

            if request.user.is_authenticated:
                person = request.user.person
                user_reservations = Gemara.objects.filter(session=session, chosen_by=person)

                # Annuler les réservations décochées (seulement si l'utilisateur est connecté)
                for reservation in user_reservations:
                    if str(reservation.choose_gemarot.id) not in gemara_ids:
                        reservation.delete()

                # Ajouter les nouvelles réservations cochées
                for gemara_id in gemara_ids:
                    gemarot = get_object_or_404(Gemarot, pk=gemara_id)
                    if not Gemara.objects.filter(session=session, choose_gemarot=gemarot, chosen_by=person).exists():
                        Gemara.objects.create(
                            session=session,
                            choose_gemarot=gemarot,
                            chosen_by=person,
                            available=False
                        )
            else:
                guest_name = request.POST.get('guest_name')
                guest_email = request.POST.get('guest_email')
                guest, created = Guest.objects.get_or_create(email=guest_email, defaults={'name': guest_name})

                # Ajouter les nouvelles réservations cochées
                for gemara_id in gemara_ids:
                    gemarot = get_object_or_404(Gemarot, pk=gemara_id)
                    if not Gemara.objects.filter(session=session, choose_gemarot=gemarot, chosen_by_guest=guest).exists():
                        Gemara.objects.create(
                            session=session,
                            choose_gemarot=gemarot,
                            chosen_by_guest=guest,
                            available=False
                        )

        return redirect('session_detail', slug=slug)
