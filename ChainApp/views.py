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
from django.db.models import Count


class HomeView(View):
    def get(self, request):
        today = timezone.now().date()

        # Récupérer le type de session demandé (all, mishna, gemara)
        session_type = request.GET.get('type', 'all')

        # Récupérer le type d'affichage demandé (grid ou list)
        display_type = request.GET.get('display', 'grid')

        # Filtrer les sessions en fonction du type demandé
        if session_type == 'mishna':
            all_sessions = Session.objects.filter(session_is=True)
        elif session_type == 'gemara':
            all_sessions = Session.objects.filter(session_is=False)
        else:
            all_sessions = Session.objects.all()

        ongoing_sessions = []
        completed_sessions = []

        for session in all_sessions:
            if session.is_completed:
                completed_sessions.append(session)
            else:
                ongoing_sessions.append(session)

        # Calcul des KPI
        total_sessions = all_sessions.count()
        total_ongoing_sessions = len(ongoing_sessions)
        total_completed_sessions = len(completed_sessions)
        total_users = User.objects.count()

        # Calcul des participants
        total_participants = Person.objects.count() + Guest.objects.count()

        context = {
            'ongoing_sessions': ongoing_sessions,
            'completed_sessions': completed_sessions,
            'session_type': session_type,
            'display_type': display_type,
            'total_sessions': total_sessions,
            'total_ongoing_sessions': total_ongoing_sessions,
            'total_completed_sessions': total_completed_sessions,
            'total_users': total_users,
            'total_participants': total_participants,
        }

        return render(request, 'home.html', context)


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
        session = get_object_or_404(Session, slug=slug)
        is_expired = session.date_limit < timezone.now().date()

        if session.session_is:
            sedarim = Seder.objects.prefetch_related('massekhtot').all()
            masekhtot_list = []

            for seder in sedarim:
                seder_data = {
                    'seder': seder,
                    'massekhtot': []
                }

                for masekhet in seder.massekhtot.all():
                    masekhet_reservation = Michna.objects.filter(session=session, choose_michna=masekhet,
                                                                 choose_perek__isnull=True).first()
                    reserved_by_user = masekhet_reservation and masekhet_reservation.chosen_by == request.user.person if request.user.is_authenticated else None

                    perekim = []
                    all_perek_reserved = True
                    some_perek_reserved = False  # Variable pour indiquer si certains, mais pas tous les perekim sont réservés
                    all_perek_reserved_by_user = True  # Variable pour vérifier si l'utilisateur a réservé tous les Perekim

                    for perek in range(1, masekhet.perek + 1):
                        perek_reservation = Michna.objects.filter(session=session, choose_michna=masekhet,
                                                                  choose_perek=perek).first()
                        reserved_by_user_perek = perek_reservation and perek_reservation.chosen_by == request.user.person if request.user.is_authenticated else None

                        if perek_reservation:
                            some_perek_reserved = True
                        else:
                            all_perek_reserved = False

                        if not reserved_by_user_perek:
                            all_perek_reserved_by_user = False  # L'utilisateur n'a pas réservé tous les Perekim

                        perekim.append({
                            'perek': perek,
                            'reserved': perek_reservation is not None,
                            'chosen_by_username': (
                                perek_reservation.chosen_by.user.username if perek_reservation and perek_reservation.chosen_by else
                                perek_reservation.chosen_by_guest.name if perek_reservation and perek_reservation.chosen_by_guest else None),
                            'reserved_by_user': reserved_by_user_perek,
                        })

                    seder_data['massekhtot'].append({
                        'masekhet': masekhet,
                        'reserved': masekhet_reservation is not None,
                        'perekim': perekim,
                        'reserved_by_user': reserved_by_user,
                        'all_perek_reserved': all_perek_reserved,  # Tous les Perekim sont réservés
                        'some_perek_reserved': some_perek_reserved,  # Certains mais pas tous les Perekim sont réservés
                        'all_perek_reserved_by_user': all_perek_reserved_by_user,
                        # L'utilisateur a réservé tous les Perekim
                    })

                masekhtot_list.append(seder_data)

            context = {
                'session': session,
                'seder_list': masekhtot_list,
                'is_expired': is_expired,
            }
        else:
            gemarot = Gemarot.objects.all()
            gemarot_list = []
            for gemara in gemarot:
                gemara_reservation = Gemara.objects.filter(session=session, choose_gemarot=gemara,
                                                           choose_perek__isnull=True).first()
                reserved_by_user = gemara_reservation and gemara_reservation.chosen_by == request.user.person if request.user.is_authenticated else None

                perekim = []
                all_perek_reserved = True
                some_perek_reserved = False  # Variable pour indiquer si certains, mais pas tous les perekim sont réservés
                all_perek_reserved_by_user = True  # Variable pour vérifier si l'utilisateur a réservé tous les Perekim

                for perek in range(1, gemara.perek + 1):
                    perek_reservation = Gemara.objects.filter(session=session, choose_gemarot=gemara,
                                                              choose_perek=perek).first()
                    reserved_by_user_perek = perek_reservation and perek_reservation.chosen_by == request.user.person if request.user.is_authenticated else None

                    if perek_reservation:
                        some_perek_reserved = True
                    else:
                        all_perek_reserved = False

                    if not reserved_by_user_perek:
                        all_perek_reserved_by_user = False  # L'utilisateur n'a pas réservé tous les Perekim

                    perekim.append({
                        'perek': perek,
                        'reserved': perek_reservation is not None,
                        'chosen_by_username': (
                            perek_reservation.chosen_by.user.username if perek_reservation and perek_reservation.chosen_by else
                            perek_reservation.chosen_by_guest.name if perek_reservation and perek_reservation.chosen_by_guest else None),
                        'reserved_by_user': reserved_by_user_perek,
                    })

                gemarot_list.append({
                    'gemara': gemara,
                    'reserved': gemara_reservation is not None,
                    'perekim': perekim,
                    'reserved_by_user': reserved_by_user,
                    'all_perek_reserved': all_perek_reserved,  # Tous les Perekim sont réservés
                    'some_perek_reserved': some_perek_reserved,  # Certains mais pas tous les Perekim sont réservés
                    'all_perek_reserved_by_user': all_perek_reserved_by_user,
                    # L'utilisateur a réservé tous les Perekim
                })

            context = {
                'session': session,
                'gemarot_list': gemarot_list,
                'is_expired': is_expired,
            }

        return render(request, 'ChainApp/session_detail.html', context)

    def post(self, request, slug):
        session = get_object_or_404(Session, slug=slug)
        is_expired = session.date_limit < timezone.now().date()

        if is_expired:
            return redirect('session_detail', slug=slug)

        if session.session_is:
            masekhet_ids = request.POST.getlist('masekhtot')
            perek_ids = request.POST.getlist('perekim')

            if request.user.is_authenticated:
                person = request.user.person

                # Annuler les réservations décochées
                user_reservations = Michna.objects.filter(session=session, chosen_by=person)
                for reservation in user_reservations:
                    if str(reservation.choose_michna.id) not in masekhet_ids and reservation.choose_perek is None:
                        reservation.delete()

                user_perek_reservations = Michna.objects.filter(session=session, chosen_by=person,
                                                                choose_perek__isnull=False)
                for perek_reservation in user_perek_reservations:
                    perek_id = f"{perek_reservation.choose_michna.id}-{perek_reservation.choose_perek}"
                    if perek_id not in perek_ids:
                        perek_reservation.delete()

                # Réserver la Massekhet entière et les Perekim
                for masekhet_id in masekhet_ids:
                    masekhet = get_object_or_404(Massekhet, pk=masekhet_id)
                    if not Michna.objects.filter(session=session, choose_michna=masekhet, chosen_by=person,
                                                 choose_perek__isnull=True).exists():
                        Michna.objects.create(
                            session=session,
                            choose_michna=masekhet,
                            chosen_by=person,
                            available=False
                        )
                    for perek in range(1, masekhet.perek + 1):
                        if not Michna.objects.filter(session=session, choose_michna=masekhet,
                                                     choose_perek=perek).exists():
                            Michna.objects.create(
                                session=session,
                                choose_michna=masekhet,
                                choose_perek=perek,
                                chosen_by=person,
                                available=False
                            )

                # Réserver les Perekim spécifiques
                for perek_id in perek_ids:
                    masekhet_id, perek_number = perek_id.split('-')
                    masekhet = get_object_or_404(Massekhet, pk=masekhet_id)
                    if not Michna.objects.filter(session=session, choose_michna=masekhet, choose_perek=perek_number,
                                                 chosen_by=person).exists():
                        Michna.objects.create(
                            session=session,
                            choose_michna=masekhet,
                            choose_perek=perek_number,
                            chosen_by=person,
                            available=False
                        )

            else:
                guest_name = request.POST.get('guest_name')
                guest_email = request.POST.get('guest_email')
                guest, created = Guest.objects.get_or_create(email=guest_email, defaults={'name': guest_name})

                # Annuler les réservations décochées pour les invités
                user_reservations = Michna.objects.filter(session=session, chosen_by_guest=guest)
                for reservation in user_reservations:
                    if str(reservation.choose_michna.id) not in masekhet_ids and reservation.choose_perek is None:
                        reservation.delete()

                user_perek_reservations = Michna.objects.filter(session=session, chosen_by_guest=guest,
                                                                choose_perek__isnull=False)
                for perek_reservation in user_perek_reservations:
                    perek_id = f"{perek_reservation.choose_michna.id}-{perek_reservation.choose_perek}"
                    if perek_id not in perek_ids:
                        perek_reservation.delete()

                # Réserver la Massekhet entière et les Perekim pour les invités
                for masekhet_id in masekhet_ids:
                    masekhet = get_object_or_404(Massekhet, pk=masekhet_id)
                    if not Michna.objects.filter(session=session, choose_michna=masekhet, chosen_by_guest=guest,
                                                 choose_perek__isnull=True).exists():
                        Michna.objects.create(
                            session=session,
                            choose_michna=masekhet,
                            chosen_by_guest=guest,
                            available=False
                        )
                    for perek in range(1, masekhet.perek + 1):
                        if not Michna.objects.filter(session=session, choose_michna=masekhet,
                                                     choose_perek=perek).exists():
                            Michna.objects.create(
                                session=session,
                                choose_michna=masekhet,
                                choose_perek=perek,
                                chosen_by_guest=guest,
                                available=False
                            )

                # Réserver les Perekim spécifiques pour les invités
                for perek_id in perek_ids:
                    masekhet_id, perek_number = perek_id.split('-')
                    masekhet = get_object_or_404(Massekhet, pk=masekhet_id)
                    if not Michna.objects.filter(session=session, choose_michna=masekhet, choose_perek=perek_number,
                                                 chosen_by_guest=guest).exists():
                        Michna.objects.create(
                            session=session,
                            choose_michna=masekhet,
                            choose_perek=perek_number,
                            chosen_by_guest=guest,
                            available=False
                        )

        else:
            gemara_ids = request.POST.getlist('gemarot')
            perek_ids = request.POST.getlist('perekim')

            if request.user.is_authenticated:
                person = request.user.person

                # Annuler les réservations décochées
                user_reservations = Gemara.objects.filter(session=session, chosen_by=person)
                for reservation in user_reservations:
                    if str(reservation.choose_gemarot.id) not in gemara_ids and reservation.choose_perek is None:
                        reservation.delete()

                user_perek_reservations = Gemara.objects.filter(session=session, chosen_by=person,
                                                                choose_perek__isnull=False)
                for perek_reservation in user_perek_reservations:
                    perek_id = f"{perek_reservation.choose_gemarot.id}-{perek_reservation.choose_perek}"
                    if perek_id not in perek_ids:
                        perek_reservation.delete()

                # Réserver la Gemara entière et les Perekim
                for gemara_id in gemara_ids:
                    gemarot = get_object_or_404(Gemarot, pk=gemara_id)
                    if not Gemara.objects.filter(session=session, choose_gemarot=gemarot, chosen_by=person,
                                                 choose_perek__isnull=True).exists():
                        Gemara.objects.create(
                            session=session,
                            choose_gemarot=gemarot,
                            chosen_by=person,
                            available=False
                        )
                    for perek in range(1, gemarot.perek + 1):
                        if not Gemara.objects.filter(session=session, choose_gemarot=gemarot,
                                                     choose_perek=perek).exists():
                            Gemara.objects.create(
                                session=session,
                                choose_gemarot=gemarot,
                                choose_perek=perek,
                                chosen_by=person,
                                available=False
                            )

                # Réserver les Perekim spécifiques
                for perek_id in perek_ids:
                    gemara_id, perek_number = perek_id.split('-')
                    gemarot = get_object_or_404(Gemarot, pk=gemara_id)
                    if not Gemara.objects.filter(session=session, choose_gemarot=gemarot, choose_perek=perek_number,
                                                 chosen_by=person).exists():
                        Gemara.objects.create(
                            session=session,
                            choose_gemarot=gemarot,
                            choose_perek=perek_number,
                            chosen_by=person,
                            available=False
                        )

            else:
                guest_name = request.POST.get('guest_name')
                guest_email = request.POST.get('guest_email')
                guest, created = Guest.objects.get_or_create(email=guest_email, defaults={'name': guest_name})

                # Annuler les réservations décochées pour les invités
                user_reservations = Gemara.objects.filter(session=session, chosen_by_guest=guest)
                for reservation in user_reservations:
                    if str(reservation.choose_gemarot.id) not in gemara_ids and reservation.choose_perek is None:
                        reservation.delete()

                user_perek_reservations = Gemara.objects.filter(session=session, chosen_by_guest=guest,
                                                                choose_perek__isnull=False)
                for perek_reservation in user_perek_reservations:
                    perek_id = f"{perek_reservation.choose_gemarot.id}-{perek_reservation.choose_perek}"
                    if perek_id not in perek_ids:
                        perek_reservation.delete()

                # Réserver la Gemara entière et les Perekim pour les invités
                for gemara_id in gemara_ids:
                    gemarot = get_object_or_404(Gemarot, pk=gemara_id)
                    if not Gemara.objects.filter(session=session, choose_gemarot=gemarot, chosen_by_guest=guest,
                                                 choose_perek__isnull=True).exists():
                        Gemara.objects.create(
                            session=session,
                            choose_gemarot=gemarot,
                            chosen_by_guest=guest,
                            available=False
                        )
                    for perek in range(1, gemarot.perek + 1):
                        if not Gemara.objects.filter(session=session, choose_gemarot=gemarot,
                                                     choose_perek=perek).exists():
                            Gemara.objects.create(
                                session=session,
                                choose_gemarot=gemarot,
                                choose_perek=perek,
                                chosen_by_guest=guest,
                                available=False
                            )

                # Réserver les Perekim spécifiques pour les invités
                for perek_id in perek_ids:
                    gemara_id, perek_number = perek_id.split('-')
                    gemarot = get_object_or_404(Gemarot, pk=gemara_id)
                    if not Gemara.objects.filter(session=session, choose_gemarot=gemarot, choose_perek=perek_number,
                                                 chosen_by_guest=guest).exists():
                        Gemara.objects.create(
                            session=session,
                            choose_gemarot=gemarot,
                            choose_perek=perek_number,
                            chosen_by_guest=guest,
                            available=False
                        )

        return redirect('session_detail', slug=slug)


class ProfileView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect('login')
        else:
            user = request.user
            user_sessions = Session.objects.filter(person=user.person)

            # Filtrer les sessions réservées via les modèles Gemara et Michna
            reserved_sessions = Session.objects.filter(
                Q(gemara__chosen_by=user.person) | Q(michna__chosen_by=user.person)
            ).distinct()

            context = {
                'user_sessions': user_sessions,
                'reserved_sessions': reserved_sessions,
            }
            return render(request, 'ChainApp/profile.html', context)


class MarkCompletedView(View):
    def post(self, request, model_name, pk):
        if model_name == 'michna':
            item = get_object_or_404(Michna, pk=pk, chosen_by=request.user.person)
        elif model_name == 'gemara':
            item = get_object_or_404(Gemara, pk=pk, chosen_by=request.user.person)
        else:
            return redirect('profile')

        item.is_completed = True
        item.save()
        return redirect('profile')