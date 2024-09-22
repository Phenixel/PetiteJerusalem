from .models import TextStudy


def add_talmud_bavli():
    talmud_bavli = {
        "Zeraim": {
            "Berakhot": 64,
        },
        "Moed": {
            "Shabbat": 157,
            "Eruvin": 105,
            "Pesachim": 121,
            "Shekalim": 22,
            "Yoma": 88,
            "Sukkah": 56,
            "Beitzah": 40,
            "Rosh Hashanah": 35,
            "Taanit": 31,
            "Megillah": 32,
            "Moed Katan": 29,
            "Chagigah": 27,
        },
        "Nashim": {
            "Yevamot": 122,
            "Ketubot": 112,
            "Nedarim": 91,
            "Nazir": 66,
            "Sotah": 49,
            "Gittin": 90,
            "Kiddushin": 82,
        },
        "Nezikin": {
            "Bava Kamma": 119,
            "Bava Metzia": 119,
            "Bava Batra": 176,
            "Sanhedrin": 113,
            "Makkot": 24,
            "Shevuot": 49,
            "Avodah Zarah": 76,
            "Horayot": 14,
        },
        "Kodashim": {
            "Zevachim": 120,
            "Menachot": 110,
            "Chullin": 142,
            "Bekhorot": 61,
            "Arakhin": 34,
            "Temurah": 34,
            "Keritot": 28,
            "Meilah": 22,
            "Tamid": 10,
            "Middot": 4,
            "Kinnim": 3,
        },
        "Toharot": {
            "Niddah": 73,
        },
    }

    for masechet_group, masechtot in talmud_bavli.items():
        for name, total_sections in masechtot.items():
            TextStudy.objects.create(
                name=f"{name}",
                type="Talmud Bavli",
                livre=masechet_group,
                link=f"https://www.sefaria.org/{name}",
                total_sections=total_sections,
            )


def add_mishna():
    mishna = {
        "Zeraim": {
            "Berakhot": 9,
            "Peah": 8,
            "Demai": 7,
            "Kilayim": 9,
            "Sheviit": 10,
            "Terumot": 11,
            "Maasrot": 5,
            "Maaser Sheni": 5,
            "Challah": 4,
            "Orlah": 3,
            "Bikkurim": 3,
        },
        "Moed": {
            "Shabbat": 24,
            "Eruvin": 10,
            "Pesachim": 10,
            "Shekalim": 8,
            "Yoma": 8,
            "Sukkah": 5,
            "Beitzah": 5,
            "Rosh Hashanah": 4,
            "Taanit": 4,
            "Megillah": 4,
            "Moed Katan": 3,
            "Chagigah": 3,
        },
        "Nashim": {
            "Yevamot": 16,
            "Ketubot": 13,
            "Nedarim": 11,
            "Nazir": 9,
            "Sotah": 9,
            "Gittin": 9,
            "Kiddushin": 4,
        },
        "Nezikin": {
            "Bava Kamma": 10,
            "Bava Metzia": 10,
            "Bava Batra": 10,
            "Sanhedrin": 11,
            "Makkot": 3,
            "Shevuot": 8,
            "Avodah Zarah": 5,
            "Avot": 5,
            "Horayot": 3,
        },
        "Kodashim": {
            "Zevachim": 14,
            "Menachot": 13,
            "Chullin": 12,
            "Bekhorot": 9,
            "Arakhin": 9,
            "Temurah": 7,
            "Keritot": 6,
            "Meilah": 6,
            "Tamid": 7,
            "Middot": 3,
            "Kinnim": 3,
        },
        "Toharot": {
            "Niddah": 10,
        },
    }

    for mishna_group, masechtot in mishna.items():
        for name, total_sections in masechtot.items():
            TextStudy.objects.create(
                name=f"{name}",
                type="Mishna",
                livre=mishna_group,
                link=f"https://www.sefaria.org/{name}",
                total_sections=total_sections,
            )


def add_tehilim():
    tehilim_per_book = {
        "Sefer 1": 41,
        "Sefer 2": 31,
        "Sefer 3": 17,
        "Sefer 4": 17,
        "Sefer 5": 44,
    }

    current_tehilim = 1
    for day, total_sections in tehilim_per_book.items():
        for section in range(1, total_sections + 1):
            TextStudy.objects.create(
                name=f"Tehilim {current_tehilim}",
                type="Tehilim",
                livre=day,
                link=f"https://www.sefaria.org/Psalms.{current_tehilim}",
                total_sections=1,
            )
            current_tehilim += 1


def add_parachiot_devarim():
    devarim = {
        "Devarim": 105,
        "Vaetchanan": 122,
        "Eikev": 111,
        "Re'eh": 126,
        "Shoftim": 97,
        "Ki Teitzei": 110,
        "Ki Tavo": 122,
        "Nitzavim": 40,
        "Vayelech": 30,
        "Ha'Azinu": 52,
        "V'Zot HaBracha": 41,
    }

    for parasha, total_sections in devarim.items():
        TextStudy.objects.create(
            name=f"Parashat {parasha}",
            type="Parasha",
            livre="Devarim",
            link=f"https://www.sefaria.org/Deuteronomy.{parasha}",
            total_sections=total_sections,
        )


def initialize_text_studies():
    add_talmud_bavli()
    add_mishna()
    add_tehilim()
    add_parachiot_devarim()
