from django.contrib import admin
from django.urls import path
from ChainApp.views import *

urlpatterns = [
    path('', HomeView.as_view(), name='home'),

    path('admin/', admin.site.urls),
    path('login/', LoginView.as_view(), name='login'),
    path('signup/', SignupView.as_view(), name='signup'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', ProfileView.as_view(), name='profile'),

    path('create-session/', CreateSessionView.as_view(), name='create_session'),
    path('session/<slug:slug>/', SessionDetailView.as_view(), name='session_detail'),
    path('delete-session/<int:session_id>/', DeleteSessionView.as_view(), name='delete_session'),
    path('update-session/<int:session_id>/', UpdateSessionView.as_view(), name='update_session'),
]
