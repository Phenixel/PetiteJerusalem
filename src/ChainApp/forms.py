from django import forms
from ChainApp.models import TextStudy


class ReservationForm(forms.Form):
    guest_name = forms.CharField(max_length=255, required=False)
    guest_email = forms.EmailField(required=False)
    text_studies = forms.MultipleChoiceField(choices=[], required=False)
    sections = forms.MultipleChoiceField(choices=[], required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['text_studies'].choices = [(text.pk, text.name) for text in TextStudy.objects.all()]
        self.fields['sections'].choices = [(f"{text.pk}-{section}", f"{text.name} - Section {section}") for text in TextStudy.objects.all() for section in range(1, text.total_sections + 1)]