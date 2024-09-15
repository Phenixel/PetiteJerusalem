from ChainApp.models import Gemarot, Seder, Massekhet

# Liste des livres du Talmud Bavli avec leurs Masechtot correspondants, les liens vers Sepharia et le nombre de chapitres (perek)
talmud_bavli = {
    "Berakhot": {"livre": "Berakhot", "link": "https://www.sefaria.org/Berakhot.1a?lang=bi", "perek": 9},
    "Shabbat": {"livre": "Moed", "link": "https://www.sefaria.org/Shabbat.2a?lang=bi", "perek": 24},
    "Eruvin": {"livre": "Moed", "link": "https://www.sefaria.org/Eruvin.2a?lang=bi", "perek": 10},
    "Pesachim": {"livre": "Moed", "link": "https://www.sefaria.org/Pesachim.2a?lang=bi", "perek": 10},
    "Shekalim": {"livre": "Moed", "link": "https://www.sefaria.org/Shekalim.2a?lang=bi", "perek": 8},
    "Yoma": {"livre": "Moed", "link": "https://www.sefaria.org/Yoma.2a?lang=bi", "perek": 8},
    "Sukkah": {"livre": "Moed", "link": "https://www.sefaria.org/Sukkah.2a?lang=bi", "perek": 5},
    "Beitzah": {"livre": "Moed", "link": "https://www.sefaria.org/Beitzah.2a?lang=bi", "perek": 5},
    "Rosh Hashanah": {"livre": "Moed", "link": "https://www.sefaria.org/Rosh_Hashanah.2a?lang=bi", "perek": 4},
    "Taanit": {"livre": "Moed", "link": "https://www.sefaria.org/Taanit.2a?lang=bi", "perek": 4},
    "Megillah": {"livre": "Moed", "link": "https://www.sefaria.org/Megillah.2a?lang=bi", "perek": 4},
    "Moed Katan": {"livre": "Moed", "link": "https://www.sefaria.org/Moed_Katan.2a?lang=bi", "perek": 3},
    "Chagigah": {"livre": "Moed", "link": "https://www.sefaria.org/Chagigah.2a?lang=bi", "perek": 3},
    "Yevamot": {"livre": "Nashim", "link": "https://www.sefaria.org/Yevamot.2a?lang=bi", "perek": 16},
    "Ketubot": {"livre": "Nashim", "link": "https://www.sefaria.org/Ketubot.2a?lang=bi", "perek": 13},
    "Nedarim": {"livre": "Nashim", "link": "https://www.sefaria.org/Nedarim.2a?lang=bi", "perek": 11},
    "Nazir": {"livre": "Nashim", "link": "https://www.sefaria.org/Nazir.2a?lang=bi", "perek": 9},
    "Sotah": {"livre": "Nashim", "link": "https://www.sefaria.org/Sotah.2a?lang=bi", "perek": 9},
    "Gittin": {"livre": "Nashim", "link": "https://www.sefaria.org/Gittin.2a?lang=bi", "perek": 9},
    "Kiddushin": {"livre": "Nashim", "link": "https://www.sefaria.org/Kiddushin.2a?lang=bi", "perek": 4},
    "Bava Kamma": {"livre": "Nezikin", "link": "https://www.sefaria.org/Bava_Kamma.2a?lang=bi", "perek": 10},
    "Bava Metzia": {"livre": "Nezikin", "link": "https://www.sefaria.org/Bava_Metzia.2a?lang=bi", "perek": 10},
    "Bava Batra": {"livre": "Nezikin", "link": "https://www.sefaria.org/Bava_Batra.2a?lang=bi", "perek": 10},
    "Sanhedrin": {"livre": "Nezikin", "link": "https://www.sefaria.org/Sanhedrin.2a?lang=bi", "perek": 11},
    "Makkot": {"livre": "Nezikin", "link": "https://www.sefaria.org/Makkot.2a?lang=bi", "perek": 3},
    "Shevuot": {"livre": "Nezikin", "link": "https://www.sefaria.org/Shevuot.2a?lang=bi", "perek": 8},
    "Eduyot": {"livre": "Nezikin", "link": "https://www.sefaria.org/Eduyot.2a?lang=bi", "perek": 8},
    "Avodah Zarah": {"livre": "Nezikin", "link": "https://www.sefaria.org/Avodah_Zarah.2a?lang=bi", "perek": 5},
    "Avot": {"livre": "Nezikin", "link": "https://www.sefaria.org/Avot.2a?lang=bi", "perek": 6},
    "Horayot": {"livre": "Nezikin", "link": "https://www.sefaria.org/Horayot.2a?lang=bi", "perek": 3},
    "Zevachim": {"livre": "Kodshim", "link": "https://www.sefaria.org/Zevachim.2a?lang=bi", "perek": 14},
    "Menachot": {"livre": "Kodshim", "link": "https://www.sefaria.org/Menachot.2a?lang=bi", "perek": 13},
    "Chullin": {"livre": "Kodshim", "link": "https://www.sefaria.org/Chullin.2a?lang=bi", "perek": 12},
    "Bechorot": {"livre": "Kodshim", "link": "https://www.sefaria.org/Bechorot.2a?lang=bi", "perek": 9},
    "Arachin": {"livre": "Kodshim", "link": "https://www.sefaria.org/Arachin.2a?lang=bi", "perek": 9},
    "Temurah": {"livre": "Kodshim", "link": "https://www.sefaria.org/Temurah.2a?lang=bi", "perek": 7},
    "Keritot": {"livre": "Kodshim", "link": "https://www.sefaria.org/Keritot.2a?lang=bi", "perek": 6},
    "Meilah": {"livre": "Kodshim", "link": "https://www.sefaria.org/Meilah.2a?lang=bi", "perek": 6},
    "Kinnim": {"livre": "Kodshim", "link": "https://www.sefaria.org/Kinnim.2a?lang=bi", "perek": 3},
    "Tamid": {"livre": "Kodshim", "link": "https://www.sefaria.org/Tamid.2a?lang=bi", "perek": 7},
    "Middot": {"livre": "Kodshim", "link": "https://www.sefaria.org/Middot.2a?lang=bi", "perek": 5},
    "Kelim": {"livre": "Tahorot", "link": "https://www.sefaria.org/Kelim.2a?lang=bi", "perek": 30},
    "Oholot": {"livre": "Tahorot", "link": "https://www.sefaria.org/Oholot.2a?lang=bi", "perek": 18},
    "Nega'im": {"livre": "Tahorot", "link": "https://www.sefaria.org/Nega%27im.2a?lang=bi", "perek": 14},
    "Parah": {"livre": "Tahorot", "link": "https://www.sefaria.org/Parah.2a?lang=bi", "perek": 12},
    "Tohorot": {"livre": "Tahorot", "link": "https://www.sefaria.org/Tohorot.2a?lang=bi", "perek": 10},
}

# Liste des Sederim et des Massekhtot de la Mishna avec le nombre de chapitres
mishna_sederim = {
    "Zeraim": [
        {"name": "Berakhot", "perek": 9},
        {"name": "Peah", "perek": 8},
        {"name": "Demai", "perek": 7},
        {"name": "Kilayim", "perek": 9},
        {"name": "Sheviit", "perek": 10},
        {"name": "Terumot", "perek": 11},
        {"name": "Maasrot", "perek": 5},
        {"name": "Maaser Sheni", "perek": 5},
        {"name": "Challah", "perek": 4},
        {"name": "Orlah", "perek": 3},
        {"name": "Bikkurim", "perek": 3},
    ],
    "Moed": [
        {"name": "Shabbat", "perek": 24},
        {"name": "Eruvin", "perek": 10},
        {"name": "Pesachim", "perek": 10},
        {"name": "Shekalim", "perek": 8},
        {"name": "Yoma", "perek": 8},
        {"name": "Sukkah", "perek": 5},
        {"name": "Beitzah", "perek": 5},
        {"name": "Rosh Hashanah", "perek": 4},
        {"name": "Taanit", "perek": 4},
        {"name": "Megillah", "perek": 4},
        {"name": "Moed Katan", "perek": 3},
        {"name": "Chagigah", "perek": 3},
    ],
    "Nashim": [
        {"name": "Yevamot", "perek": 16},
        {"name": "Ketubot", "perek": 13},
        {"name": "Nedarim", "perek": 11},
        {"name": "Nazir", "perek": 9},
        {"name": "Sotah", "perek": 9},
        {"name": "Gittin", "perek": 9},
        {"name": "Kiddushin", "perek": 4},
    ],
    "Nezikin": [
        {"name": "Bava Kamma", "perek": 10},
        {"name": "Bava Metzia", "perek": 10},
        {"name": "Bava Batra", "perek": 10},
        {"name": "Sanhedrin", "perek": 11},
        {"name": "Makkot", "perek": 3},
        {"name": "Shevuot", "perek": 8},
        {"name": "Eduyot", "perek": 8},
        {"name": "Avodah Zarah", "perek": 5},
        {"name": "Avot", "perek": 6},
        {"name": "Horayot", "perek": 3},
    ],
    "Kodshim": [
        {"name": "Zevachim", "perek": 14},
        {"name": "Menachot", "perek": 13},
        {"name": "Chullin", "perek": 12},
        {"name": "Bechorot", "perek": 9},
        {"name": "Arachin", "perek": 9},
        {"name": "Temurah", "perek": 7},
        {"name": "Keritot", "perek": 6},
        {"name": "Meilah", "perek": 6},
        {"name": "Kinnim", "perek": 3},
        {"name": "Tamid", "perek": 7},
        {"name": "Middot", "perek": 5},
    ],
    "Tahorot": [
        {"name": "Kelim", "perek": 30},
        {"name": "Oholot", "perek": 18},
        {"name": "Nega'im", "perek": 14},
        {"name": "Parah", "perek": 12},
        {"name": "Tohorot", "perek": 10},
        {"name": "Mikvaot", "perek": 10},
        {"name": "Niddah", "perek": 10},
        {"name": "Machshirin", "perek": 6},
        {"name": "Zavim", "perek": 5},
        {"name": "Tevul Yom", "perek": 4},
        {"name": "Yadayim", "perek": 4},
        {"name": "Uktzin", "perek": 3},
    ],
}


def create_database_from_list():
    # Création des objets Gemarot avec le nom du Masechet, le nom du livre, le lien vers Sepharia, et le nombre de chapitres
    for masechet, info in talmud_bavli.items():
        gemara_link = info['link']
        gemara_perek = info['perek']
        gemara = Gemarot.objects.create(name=masechet, livre=info['livre'], link=gemara_link, perek=gemara_perek)
        gemara.save()
        print(f"Created Gemarot: {masechet} - Link: {gemara_link} - Perek: {gemara_perek}")

    # Création des objets Seder et Massekhet avec le nombre de chapitres
    for seder_name, massekhtot in mishna_sederim.items():
        seder, created = Seder.objects.get_or_create(name=seder_name)

        for massekhet_info in massekhtot:
            massekhet_name = massekhet_info['name']
            massekhet_perek = massekhet_info['perek']
            massekhet = Massekhet.objects.create(name=massekhet_name, seder=seder, perek=massekhet_perek)
            massekhet.save()
            print(f"Created Massekhet: {massekhet_name} under Seder: {seder_name} - Perek: {massekhet_perek}")

