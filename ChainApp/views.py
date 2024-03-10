from django.shortcuts import render, redirect
from django.views import View
from .models import Session


class HomeView(View):
    def get(self, request):
        sessions = Session.objects.all()
        return render(request, 'home.html', {'sessions': sessions})

