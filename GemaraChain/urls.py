from django.contrib import admin
from django.urls import path
from ChainApp.views import *

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', HomeView.as_view(), name='home'),
    path('create-session/', CreateSessionView.as_view(), name='create_session'),
    path('session/<slug:slug>/', SessionDetailView.as_view(), name='session_detail'),
    path('login/', LoginView.as_view(), name='login'),
    path('signup/', SignupView.as_view(), name='signup'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('mark_completed/<str:model_name>/<int:pk>/', MarkCompletedView.as_view(), name='mark_completed'),
]
