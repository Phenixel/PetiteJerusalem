from django.contrib import admin
from django.urls import path
from ChainApp import views as chain_views
from ChainApp.views import *

urlpatterns = [


    path('', MainHomeView.as_view(), name='home'),
    path('guemara/', chain_views.HomeView.as_view(), name='guemara_home'),

    path('admin/', admin.site.urls),
    path('login/', LoginView.as_view(), name='login'),
    path('signup/', SignupView.as_view(), name='signup'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', ProfileView.as_view(), name='profile'),

    path('create-session/', CreateSessionView.as_view(), name='create_session'),
    path('session/<slug:slug>/', SessionDetailView.as_view(), name='session_detail'),
    path('delete-session/<int:session_id>/', DeleteSessionView.as_view(), name='delete_session'),
    path('update-session/<int:session_id>/', UpdateSessionView.as_view(), name='update_session'),
    path('confirm-reading/<int:reservation_id>/', ConfirmReadingView.as_view(), name='confirm_reading'),
    path('unmark-reading/<int:reservation_id>/', UnmarkReadingView.as_view(), name='unmark_reading'),

]
