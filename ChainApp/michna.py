from .models import Seder, Massekhet

# Liste des Sederim et des Massekhtot de la Mishna
mishna_sederim = {
    "Zeraim": ["Berakhot", "Peah", "Demai", "Kilayim", "Sheviit", "Terumot", "Maasrot", "Maaser Sheni", "Challah", "Orlah", "Bikkurim"],
    "Moed": ["Shabbat", "Eruvin", "Pesachim", "Shekalim", "Yoma", "Sukkah", "Beitzah", "Rosh Hashanah", "Taanit", "Megillah", "Moed Katan", "Chagigah"],
    "Nashim": ["Yevamot", "Ketubot", "Nedarim", "Nazir", "Sotah", "Gittin", "Kiddushin"],
    "Nezikin": ["Bava Kamma", "Bava Metzia", "Bava Batra", "Sanhedrin", "Makkot", "Shevuot", "Eduyot", "Avodah Zarah", "Avot", "Horayot"],
    "Kodshim": ["Zevachim", "Menachot", "Chullin", "Bechorot", "Arachin", "Temurah", "Keritot", "Meilah", "Kinnim", "Tamid", "Middot"],
    "Tahorot": ["Kelim", "Oholot", "Nega'im", "Parah", "Tohorot", "Mikvaot", "Niddah", "Machshirin", "Zavim", "Tevul Yom", "Yadayim", "Uktzin"],
}

def create_mishna_database():
    # Création des objets Seder et Massekhet
    for seder_name, massekhtot in mishna_sederim.items():
        seder, created = Seder.objects.get_or_create(name=seder_name)

        for massekhet_name in massekhtot:
            massekhet = Massekhet.objects.create(name=massekhet_name, seder=seder)
            massekhet.save()
            print(f"Created Massekhet: {massekhet_name} under Seder: {seder_name}")
