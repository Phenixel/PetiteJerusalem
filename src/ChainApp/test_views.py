import pytest
from django.urls import reverse
from django.utils import timezone
from django.contrib.auth.models import User
from ChainApp.models import Session, TypeTextStudy, Person

@pytest.mark.django_db
def test_home_view(client):
    url = reverse('home')
    response = client.get(url)
    assert response.status_code == 200
    assert 'ongoing_sessions' in response.context
    assert 'completed_sessions' in response.context
    assert 'total_sessions' in response.context
    assert 'total_ongoing_sessions' in response.context
    assert 'total_completed_sessions' in response.context
    assert 'total_users' in response.context
    assert 'total_participants' in response.context
    assert 'text_study_types' in response.context

@pytest.mark.django_db
def test_login_view_get(client):
    url = reverse('login')
    response = client.get(url)
    assert response.status_code == 200

@pytest.mark.django_db
def test_login_view_post(client):
    user = User.objects.create_user(username='testuser', password='testpassword')
    Person.objects.create(user=user, name='testuser', email='testuser@example.com')
    url = reverse('login')
    response = client.post(url, {'username': 'testuser', 'password': 'testpassword'})
    assert response.status_code == 302  # Redirection after successful login
    assert response.url == reverse('home')

@pytest.mark.django_db
def test_create_session_view_get(client, django_user_model):
    user = django_user_model.objects.create_user(username='testuser', password='testpassword')
    Person.objects.create(user=user, name='testuser', email='testuser@example.com')
    client.login(username='testuser', password='testpassword')
    url = reverse('create_session')
    response = client.get(url)
    assert response.status_code == 200

@pytest.mark.django_db
def test_create_session_view_post(client, django_user_model):
    user = django_user_model.objects.create_user(username='testuser', password='testpassword')
    Person.objects.create(user=user, name='testuser', email='testuser@example.com')
    client.login(username='testuser', password='testpassword')
    type_text_study = TypeTextStudy.objects.create(name='Test Type')
    url = reverse('create_session')
    response = client.post(url, {
        'name': 'Test Session',
        'description': 'Test Description',
        'date_limit': (timezone.now() + timezone.timedelta(days=1)).strftime('%Y-%m-%d'),
        'session_type': type_text_study.id
    })
    assert response.status_code == 302  # Redirection after successful creation
    assert response.url == reverse('home')
    assert Session.objects.filter(name='Test Session').exists()

@pytest.mark.django_db
def test_session_detail_view(client, django_user_model):
    user = django_user_model.objects.create_user(username='testuser', password='testpassword')
    Person.objects.create(user=user, name='testuser', email='testuser@example.com')
    type_text_study = TypeTextStudy.objects.create(name='Test Type')
    session = Session.objects.create(
        name='Test Session',
        description='Test Description',
        date_limit=timezone.now() + timezone.timedelta(days=1),
        person=user.person,
        type=type_text_study
    )
    url = reverse('session_detail', kwargs={'slug': session.slug})
    response = client.get(url)
    assert response.status_code == 200
    assert 'session' in response.context
    assert response.context['session'] == session