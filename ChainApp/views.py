from django.contrib.auth.models import User
from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from .models import Session, Person, Guest, TextStudy, TextStudyReservation, TypeTextStudy
from django.utils import timezone
from django.contrib.auth import authenticate, login, logout
import dateparser
from django.db.models import Q


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

        text_study_types = TypeTextStudy.objects.all()
        return render(request, 'ChainApp/create_session.html', {'text_study_types': text_study_types})

    def post(self, request):
        name = request.POST.get('name')
        description = request.POST.get('description')
        date_limit_str = request.POST.get('date_limit')
        session_type_id = request.POST.get('session_type')  # Récupère l'ID du type de session

        date_limit = dateparser.parse(date_limit_str, date_formats=['%Y-%m-%d']).date()

        if timezone.now().date() > date_limit:
            error_message = "La date limite doit être une date future."
            text_study_types = TypeTextStudy.objects.all()
            return render(request, 'ChainApp/create_session.html',
                          {'error_message': error_message, 'text_study_types': text_study_types})

        person = None
        if request.user.is_authenticated:
            person = request.user.person

        session_type = get_object_or_404(TypeTextStudy, id=session_type_id)

        new_session = Session(
            name=name,
            description=description,
            date_limit=date_limit,
            person=person,
            type=session_type
        )
        new_session.save()

        return redirect('home')


class SessionDetailView(View):
    def get(self, request, slug):
        session = get_object_or_404(Session, slug=slug)
        is_expired = session.date_limit < timezone.now().date()

        text_studies = TextStudy.objects.all()
        text_study_list = []

        for text_study in text_studies:
            text_study_reservation = TextStudyReservation.objects.filter(session=session, text_study=text_study,
                                                                         section__isnull=True).first()
            reserved_by_user = text_study_reservation and text_study_reservation.chosen_by == request.user.person if request.user.is_authenticated else None

            sections = []
            all_sections_reserved = True
            some_sections_reserved = False
            all_sections_reserved_by_user = True

            for section in range(1, text_study.total_sections + 1):
                section_reservation = TextStudyReservation.objects.filter(session=session, text_study=text_study,
                                                                          section=section).first()
                reserved_by_user_section = section_reservation and section_reservation.chosen_by == request.user.person if request.user.is_authenticated else None

                if section_reservation:
                    some_sections_reserved = True
                else:
                    all_sections_reserved = False

                if not reserved_by_user_section:
                    all_sections_reserved_by_user = False

                sections.append({
                    'section': section,
                    'reserved': section_reservation is not None,
                    'chosen_by_username': (
                        section_reservation.chosen_by.user.username if section_reservation and section_reservation.chosen_by else
                        section_reservation.chosen_by_guest.name if section_reservation and section_reservation.chosen_by_guest else None),
                    'reserved_by_user': reserved_by_user_section,
                })

            text_study_list.append({
                'text_study': text_study,
                'reserved': text_study_reservation is not None,
                'sections': sections,
                'reserved_by_user': reserved_by_user,
                'all_sections_reserved': all_sections_reserved,
                'some_sections_reserved': some_sections_reserved,
                'all_sections_reserved_by_user': all_sections_reserved_by_user,
            })

        context = {
            'session': session,
            'text_study_list': text_study_list,
            'is_expired': is_expired,
        }

        return render(request, 'ChainApp/session_detail.html', context)

    def post(self, request, slug):
        session = get_object_or_404(Session, slug=slug)
        is_expired = session.date_limit < timezone.now().date()

        if is_expired:
            return redirect('session_detail', slug=slug)

        text_study_ids = request.POST.getlist('text_studies')
        section_ids = request.POST.getlist('sections')

        if request.user.is_authenticated:
            person = request.user.person

            user_reservations = TextStudyReservation.objects.filter(session=session, chosen_by=person)
            for reservation in user_reservations:
                if str(reservation.text_study.id) not in text_study_ids and reservation.section is None:
                    reservation.delete()

            user_section_reservations = TextStudyReservation.objects.filter(session=session, chosen_by=person,
                                                                            section__isnull=False)
            for section_reservation in user_section_reservations:
                section_id = f"{section_reservation.text_study.id}-{section_reservation.section}"
                if section_id not in section_ids:
                    section_reservation.delete()

            for text_study_id in text_study_ids:
                text_study = get_object_or_404(TextStudy, pk=text_study_id)
                if not TextStudyReservation.objects.filter(session=session, text_study=text_study, chosen_by=person,
                                                           section__isnull=True).exists():
                    TextStudyReservation.objects.create(
                        session=session,
                        text_study=text_study,
                        chosen_by=person,
                        available=False
                    )
                for section in range(1, text_study.total_sections + 1):
                    if not TextStudyReservation.objects.filter(session=session, text_study=text_study,
                                                               section=section).exists():
                        TextStudyReservation.objects.create(
                            session=session,
                            text_study=text_study,
                            section=section,
                            chosen_by=person,
                            available=False
                        )

            for section_id in section_ids:
                text_study_id, section_number = section_id.split('-')
                text_study = get_object_or_404(TextStudy, pk=text_study_id)
                if not TextStudyReservation.objects.filter(session=session, text_study=text_study,
                                                           section=section_number, chosen_by=person).exists():
                    TextStudyReservation.objects.create(
                        session=session,
                        text_study=text_study,
                        section=section_number,
                        chosen_by=person,
                        available=False
                    )

        else:
            guest_name = request.POST.get('guest_name')
            guest_email = request.POST.get('guest_email')
            guest, created = Guest.objects.get_or_create(email=guest_email, defaults={'name': guest_name})

            user_reservations = TextStudyReservation.objects.filter(session=session, chosen_by_guest=guest)
            for reservation in user_reservations:
                if str(reservation.text_study.id) not in text_study_ids and reservation.section is None:
                    reservation.delete()

            user_section_reservations = TextStudyReservation.objects.filter(session=session, chosen_by_guest=guest,
                                                                            section__isnull=False)
            for section_reservation in user_section_reservations:
                section_id = f"{section_reservation.text_study.id}-{section_reservation.section}"
                if section_id not in section_ids:
                    section_reservation.delete()

            for text_study_id in text_study_ids:
                text_study = get_object_or_404(TextStudy, pk=text_study_id)
                if not TextStudyReservation.objects.filter(session=session, text_study=text_study,
                                                           chosen_by_guest=guest, section__isnull=True).exists():
                    TextStudyReservation.objects.create(
                        session=session,
                        text_study=text_study,
                        chosen_by_guest=guest,
                        available=False
                    )
                for section in range(1, text_study.total_sections + 1):
                    if not TextStudyReservation.objects.filter(session=session, text_study=text_study,
                                                               section=section).exists():
                        TextStudyReservation.objects.create(
                            session=session,
                            text_study=text_study,
                            section=section,
                            chosen_by_guest=guest,
                            available=False
                        )

            for section_id in section_ids:
                text_study_id, section_number = section_id.split('-')
                text_study = get_object_or_404(TextStudy, pk=text_study_id)
                if not TextStudyReservation.objects.filter(session=session, text_study=text_study,
                                                           section=section_number, chosen_by_guest=guest).exists():
                    TextStudyReservation.objects.create(
                        session=session,
                        text_study=text_study,
                        section=section_number,
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
