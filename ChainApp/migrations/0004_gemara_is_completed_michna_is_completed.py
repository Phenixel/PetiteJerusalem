# Generated by Django 5.0.3 on 2024-09-22 10:05

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ChainApp', '0003_gemara_choose_perek_michna_choose_perek'),
    ]

    operations = [
        migrations.AddField(
            model_name='gemara',
            name='is_completed',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='michna',
            name='is_completed',
            field=models.BooleanField(default=False),
        ),
    ]