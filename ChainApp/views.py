from collections import defaultdict
from django.contrib.auth.models import User
from django.http import HttpResponseRedirect, JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.utils.dateformat import DateFormat
from django.views import View
from django.views.generic import DetailView
from django.views.generic.edit import FormMixin
from .forms import ReservationForm
from .models import Session, Person, Guest, TextStudy, TextStudyReservation, TypeTextStudy
from django.utils import timezone
from django.contrib.auth import authenticate, login, logout
import dateparser

class HomeView(View):
    def get(self, request):
        today = timezone.now().date()

        # Récupérer le type de session demandé (all par défaut)
        session_type = request.GET.get('type', 'all')

        # Récupérer le type d'affichage demandé (grid ou list)
        display_type = request.GET.get('display', 'grid')

        # Récupérer tous les types de sessions disponibles
        text_study_types = TypeTextStudy.objects.all()

        # Filtrer les sessions en fonction du type demandé
        if session_type == 'all':
            all_sessions = Session.objects.all()
        else:
            all_sessions = Session.objects.filter(type__name=session_type)

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
            'text_study_types': text_study_types,
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


class SessionDetailView(DetailView, FormMixin):
    model = Session
    template_name = 'ChainApp/session_detail.html'
    context_object_name = 'session'
    slug_field = 'slug'
    slug_url_kwarg = 'slug'
    form_class = ReservationForm

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        session = self.get_object()
        is_expired = session.date_limit < timezone.now().date()

        text_studies = TextStudy.objects.filter(type=session.type)
        livre_dict = defaultdict(list)

        for text_study in text_studies:
            text_study_reservation = TextStudyReservation.objects.filter(session=session, text_study=text_study,
                                                                         section__isnull=True).first()
            reserved_by_user = text_study_reservation and text_study_reservation.chosen_by == self.request.user.person if self.request.user.is_authenticated else None

            perek_sections = self.get_perek_sections(session, text_study)

            text_study_item = {
                'text_study': text_study,
                'reserved': text_study_reservation is not None,
                'sections_by_perek': perek_sections,
                'reserved_by_user': reserved_by_user,
            }

            livre_dict[text_study.livre].append(text_study_item)

        context.update({
            'livre_dict': dict(livre_dict),
            'is_expired': is_expired,
        })
        return context

    def get_perek_sections(self, session, text_study):
        perek_sections = []
        for section in range(1, text_study.total_sections + 1):
            section_reservation = TextStudyReservation.objects.filter(session=session, text_study=text_study,
                                                                      section=section).first()
            reserved_by_user_section = section_reservation and section_reservation.chosen_by == self.request.user.person if self.request.user.is_authenticated else None

            perek_sections.append({
                'section': section,
                'reserved': section_reservation is not None,
                'chosen_by_username': (
                    section_reservation.chosen_by.user.username if section_reservation and section_reservation.chosen_by else
                    section_reservation.chosen_by_guest.name if section_reservation and section_reservation.chosen_by_guest else None),
                'reserved_by_user': reserved_by_user_section,
            })
        return perek_sections

    def post(self, request, *args, **kwargs):
        session = self.get_object()
        if session.date_limit < timezone.now().date():
            return HttpResponseRedirect(self.request.path_info)

        sections = request.POST.getlist('sections')
        guest = None

        if request.user.is_authenticated:
            existing_reservations = TextStudyReservation.objects.filter(
                session=session,
                chosen_by=request.user.person,
                chosen_by_guest=None
            )
        else:
            guest_name = request.POST.get('guest_name')
            guest_email = request.POST.get('guest_email')
            guest, _ = Guest.objects.get_or_create(name=guest_name, email=guest_email)
            existing_reservations = []

        sections_to_reserve = set(sections)

        for reservation in existing_reservations:
            section_id = f"{reservation.text_study.pk}-{reservation.section}"
            if section_id not in sections_to_reserve:
                reservation.delete()

        for section in sections:
            text_study_id, section_number = section.split('-')
            text_study = TextStudy.objects.get(pk=text_study_id)
            if not TextStudyReservation.objects.filter(
                    session=session,
                    text_study=text_study,
                    section=section_number,
                    chosen_by=request.user.person if request.user.is_authenticated else None,
                    chosen_by_guest=guest if not request.user.is_authenticated else None
            ).exists():
                TextStudyReservation.objects.create(
                    session=session,
                    text_study=text_study,
                    section=section_number,
                    chosen_by=request.user.person if request.user.is_authenticated else None,
                    chosen_by_guest=guest if not request.user.is_authenticated else None
                )

        return HttpResponseRedirect(self.request.path_info)


class DeleteSessionView(View):
    def post(self, request, session_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Unauthorized'}, status=401)

        session = get_object_or_404(Session, id=session_id, person=request.user.person)
        session.delete()
        return JsonResponse({'success': True})

class UpdateSessionView(View):
    def post(self, request, session_id):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Unauthorized'}, status=401)

        session = get_object_or_404(Session, id=session_id, person=request.user.person)
        name = request.POST.get('name')
        description = request.POST.get('description')
        date_limit_str = request.POST.get('date_limit')
        date_limit = dateparser.parse(date_limit_str, date_formats=['%Y-%m-%d']).date()

        if timezone.now().date() > date_limit:
            return JsonResponse({'error': 'La date limite doit être une date future.'}, status=400)

        session.name = name
        session.description = description
        session.date_limit = date_limit
        session.save()
        return JsonResponse({'success': True})


class ProfileView(View):
    def get(self, request):
        if not request.user.is_authenticated:
            return redirect('login')
        else:
            user = request.user
            user_sessions = Session.objects.filter(person=user.person)

            # Format the date_limit for each session
            for session in user_sessions:
                session.formatted_date_limit = DateFormat(session.date_limit).format('Y-m-d')

            reserved_sessions = Session.objects.filter(
                textstudyreservation__chosen_by=user.person
            ).distinct()

            context = {
                'user_sessions': user_sessions,
                'reserved_sessions': reserved_sessions,
            }
            return render(request, 'ChainApp/profile.html', context)
