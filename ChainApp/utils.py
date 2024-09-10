from ChainApp.models import Gemarot

# Liste des livres du Talmud Bavli avec leurs Masechtot correspondants et les liens vers Sepharia
talmud_bavli = {
    "Berakhot": {"livre": "Berakhot", "link": "https://www.sefaria.org/Berakhot.1a?lang=bi"},
    "Shabbat": {"livre": "Moed", "link": "https://www.sefaria.org/Shabbat.2a?lang=bi"},
    "Eruvin": {"livre": "Moed", "link": "https://www.sefaria.org/Eruvin.2a?lang=bi"},
    "Pesachim": {"livre": "Moed", "link": "https://www.sefaria.org/Pesachim.2a?lang=bi"},
    "Shekalim": {"livre": "Moed", "link": "https://www.sefaria.org/Shekalim.2a?lang=bi"},
    "Yoma": {"livre": "Moed", "link": "https://www.sefaria.org/Yoma.2a?lang=bi"},
    "Sukkah": {"livre": "Moed", "link": "https://www.sefaria.org/Sukkah.2a?lang=bi"},
    "Beitzah": {"livre": "Moed", "link": "https://www.sefaria.org/Beitzah.2a?lang=bi"},
    "Rosh Hashanah": {"livre": "Moed", "link": "https://www.sefaria.org/Rosh_Hashanah.2a?lang=bi"},
    "Taanit": {"livre": "Moed", "link": "https://www.sefaria.org/Taanit.2a?lang=bi"},
    "Megillah": {"livre": "Moed", "link": "https://www.sefaria.org/Megillah.2a?lang=bi"},
    "Moed Katan": {"livre": "Moed", "link": "https://www.sefaria.org/Moed_Katan.2a?lang=bi"},
    "Chagigah": {"livre": "Moed", "link": "https://www.sefaria.org/Chagigah.2a?lang=bi"},
    "Yevamot": {"livre": "Nashim", "link": "https://www.sefaria.org/Yevamot.2a?lang=bi"},
    "Ketubot": {"livre": "Nashim", "link": "https://www.sefaria.org/Ketubot.2a?lang=bi"},
    "Nedarim": {"livre": "Nashim", "link": "https://www.sefaria.org/Nedarim.2a?lang=bi"},
    "Nazir": {"livre": "Nashim", "link": "https://www.sefaria.org/Nazir.2a?lang=bi"},
    "Sotah": {"livre": "Nashim", "link": "https://www.sefaria.org/Sotah.2a?lang=bi"},
    "Gittin": {"livre": "Nashim", "link": "https://www.sefaria.org/Gittin.2a?lang=bi"},
    "Kiddushin": {"livre": "Nashim", "link": "https://www.sefaria.org/Kiddushin.2a?lang=bi"},
    "Bava Kamma": {"livre": "Nezikin", "link": "https://www.sefaria.org/Bava_Kamma.2a?lang=bi"},
    "Bava Metzia": {"livre": "Nezikin", "link": "https://www.sefaria.org/Bava_Metzia.2a?lang=bi"},
    "Bava Batra": {"livre": "Nezikin", "link": "https://www.sefaria.org/Bava_Batra.2a?lang=bi"},
    "Sanhedrin": {"livre": "Nezikin", "link": "https://www.sefaria.org/Sanhedrin.2a?lang=bi"},
    "Makkot": {"livre": "Nezikin", "link": "https://www.sefaria.org/Makkot.2a?lang=bi"},
    "Shevuot": {"livre": "Nezikin", "link": "https://www.sefaria.org/Shevuot.2a?lang=bi"},
    "Eduyot": {"livre": "Nezikin", "link": "https://www.sefaria.org/Eduyot.2a?lang=bi"},
    "Avodah Zarah": {"livre": "Nezikin", "link": "https://www.sefaria.org/Avodah_Zarah.2a?lang=bi"},
    "Avot": {"livre": "Nezikin", "link": "https://www.sefaria.org/Avot.2a?lang=bi"},
    "Horayot": {"livre": "Nezikin", "link": "https://www.sefaria.org/Horayot.2a?lang=bi"},
    "Zevachim": {"livre": "Kodshim", "link": "https://www.sefaria.org/Zevachim.2a?lang=bi"},
    "Menachot": {"livre": "Kodshim", "link": "https://www.sefaria.org/Menachot.2a?lang=bi"},
    "Chullin": {"livre": "Kodshim", "link": "https://www.sefaria.org/Chullin.2a?lang=bi"},
    "Bechorot": {"livre": "Kodshim", "link": "https://www.sefaria.org/Bechorot.2a?lang=bi"},
    "Arachin": {"livre": "Kodshim", "link": "https://www.sefaria.org/Arachin.2a?lang=bi"},
    "Temurah": {"livre": "Kodshim", "link": "https://www.sefaria.org/Temurah.2a?lang=bi"},
    "Keritot": {"livre": "Kodshim", "link": "https://www.sefaria.org/Keritot.2a?lang=bi"},
    "Meilah": {"livre": "Kodshim", "link": "https://www.sefaria.org/Meilah.2a?lang=bi"},
    "Kinnim": {"livre": "Kodshim", "link": "https://www.sefaria.org/Kinnim.2a?lang=bi"},
    "Tamid": {"livre": "Kodshim", "link": "https://www.sefaria.org/Tamid.2a?lang=bi"},
    "Middot": {"livre": "Kodshim", "link": "https://www.sefaria.org/Middot.2a?lang=bi"},
    "Kelim": {"livre": "Tahorot", "link": "https://www.sefaria.org/Kelim.2a?lang=bi"},
    "Oholot": {"livre": "Tahorot", "link": "https://www.sefaria.org/Oholot.2a?lang=bi"},
    "Nega'im": {"livre": "Tahorot", "link": "https://www.sefaria.org/Nega%27im.2a?lang=bi"},
    "Parah": {"livre": "Tahorot", "link": "https://www.sefaria.org/Parah.2a?lang=bi"},
    "Tohorot": {"livre": "Tahorot", "link": "https://www.sefaria.org/Tohorot.2a?lang=bi"},
}


def create_database_from_list():
    # Création des objets Gemarot avec le nom du Masechet, le nom du livre et le lien vers Sepharia
    for masechet, info in talmud_bavli.items():
        gemara_link = info['link']
        gemara = Gemarot.objects.create(name=masechet, livre=info['livre'], link=gemara_link)
        gemara.save()
        print(f"Created Gemarot: {masechet} - Link: {gemara_link}")
