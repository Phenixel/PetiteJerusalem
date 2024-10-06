from .models import TextStudy, TypeTextStudy


def create_text_study_types():
    types = ["Talmud Bavli", "Mishna", "Tehilim", "Parasha Devarim"]
    for type_name in types:
        TypeTextStudy.objects.get_or_create(name=type_name)


def add_talmud_bavli():
    talmud_bavli = {
        "זרעים (Zeraim)": {
            "ברכות (Berakhot)": 9,
        },
        "מועד (Moed)": {
            "שבת (Shabbat)": 24,
            "עירובין (Eruvin)": 10,
            "פסחים (Pesachim)": 10,
            "שקלים (Shekalim)": 8,
            "יומא (Yoma)": 8,
            "סוכה (Sukkah)": 5,
            "ביצה (Beitzah)": 5,
            "ראש השנה (Rosh Hashanah)": 4,
            "תענית (Taanit)": 4,
            "מגילה (Megillah)": 4,
            "מועד קטן (Moed Katan)": 3,
            "חגיגה (Chagigah)": 3,
        },
        "נשים (Nashim)": {
            "יבמות (Yevamot)": 16,
            "כתובות (Ketubot)": 13,
            "נדרים (Nedarim)": 11,
            "נזיר (Nazir)": 9,
            "סוטה (Sotah)": 9,
            "גיטין (Gittin)": 9,
            "קידושין (Kiddushin)": 4,
        },
        "נזיקין (Nezikin)": {
            "בבא קמא (Bava Kamma)": 10,
            "בבא מציעא (Bava Metzia)": 10,
            "בבא בתרא (Bava Batra)": 10,
            "סנהדרין (Sanhedrin)": 11,
            "מכות (Makkot)": 3,
            "שבועות (Shevuot)": 8,
            "עבודה זרה (Avodah Zarah)": 5,
            "הוריות (Horayot)": 3,
        },
        "קדשים (Kodashim)": {
            "זבחים (Zevachim)": 14,
            "מנחות (Menachot)": 13,
            "חולין (Chullin)": 12,
            "בכורות (Bekhorot)": 9,
            "ערכין (Arakhin)": 9,
            "תמורה (Temurah)": 7,
            "כריתות (Keritot)": 6,
            "מעילה (Meilah)": 6,
            "תמיד (Tamid)": 7,
            "מדות (Middot)": 3,
            "קינים (Kinnim)": 3,
        },
        "טהרות (Toharot)": {
            "נידה (Niddah)": 10,
        },
    }

    type_talmud_bavli, created = TypeTextStudy.objects.get_or_create(name="Talmud Bavli")

    for masechet_group, masechtot in talmud_bavli.items():
        for name, total_sections in masechtot.items():
            TextStudy.objects.create(
                name=f"{name}",
                type=type_talmud_bavli,
                livre=masechet_group,
                link=f"https://www.sefaria.org/{name}",
                total_sections=total_sections,
            )


def add_mishna():
    mishna = {
        "זרעים (Zeraim)": {
            "ברכות (Berakhot)": 9,
            "פאה (Peah)": 8,
            "דמאי (Demai)": 7,
            "כלאים (Kilayim)": 9,
            "שביעית (Sheviit)": 10,
            "תרומות (Terumot)": 11,
            "מעשרות (Maasrot)": 5,
            "מעשר שני (Maaser Sheni)": 5,
            "חלה (Challah)": 4,
            "ערלה (Orlah)": 3,
            "ביכורים (Bikkurim)": 3,
        },
        "מועד (Moed)": {
            "שבת (Shabbat)": 24,
            "עירובין (Eruvin)": 10,
            "פסחים (Pesachim)": 10,
            "שקלים (Shekalim)": 8,
            "יומא (Yoma)": 8,
            "סוכה (Sukkah)": 5,
            "ביצה (Beitzah)": 5,
            "ראש השנה (Rosh Hashanah)": 4,
            "תענית (Taanit)": 4,
            "מגילה (Megillah)": 4,
            "מועד קטן (Moed Katan)": 3,
            "חגיגה (Chagigah)": 3,
        },
        "נשים (Nashim)": {
            "יבמות (Yevamot)": 16,
            "כתובות (Ketubot)": 13,
            "נדרים (Nedarim)": 11,
            "נזיר (Nazir)": 9,
            "סוטה (Sotah)": 9,
            "גיטין (Gittin)": 9,
            "קידושין (Kiddushin)": 4,
        },
        "נזיקין (Nezikin)": {
            "בבא קמא (Bava Kamma)": 10,
            "בבא מציעא (Bava Metzia)": 10,
            "בבא בתרא (Bava Batra)": 10,
            "סנהדרין (Sanhedrin)": 11,
            "מכות (Makkot)": 3,
            "שבועות (Shevuot)": 8,
            "עבודה זרה (Avodah Zarah)": 5,
            "אבות (Avot)": 5,
            "הוריות (Horayot)": 3,
        },
        "קדשים (Kodashim)": {
            "זבחים (Zevachim)": 14,
            "מנחות (Menachot)": 13,
            "חולין (Chullin)": 12,
            "בכורות (Bekhorot)": 9,
            "ערכין (Arakhin)": 9,
            "תמורה (Temurah)": 7,
            "כריתות (Keritot)": 6,
            "מעילה (Meilah)": 6,
            "תמיד (Tamid)": 7,
            "מדות (Middot)": 3,
            "קינים (Kinnim)": 3,
        },
        "טהרות (Toharot)": {
            "כלים (Keilim)": 30,
            "אהלות (Oholot)": 18,
            "נגעים (Negaim)": 14,
            "פרה (Parah)": 12,
            "טהרות (Toharot)": 10,
            "מקואות (Mikvaot)": 10,
            "נידה (Niddah)": 10,
            "מכשירין (Makhshirin)": 6,
            "זבים (Zavim)": 5,
            "טבול יום (Tevul Yom)": 4,
            "ידים (Yadayim)": 4,
            "עוקצין (Oktzin)": 3,
        },
    }

    type_mishna, created = TypeTextStudy.objects.get_or_create(name="Mishna")

    for mishna_group, masechtot in mishna.items():
        for name, total_sections in masechtot.items():
            TextStudy.objects.create(
                name=f"{name}",
                type=type_mishna,
                livre=mishna_group,
                link=f"https://www.sefaria.org/{name}",
                total_sections=total_sections,
            )


def add_tehilim():
    tehilim_per_book = {
        "ספר 1 (Sefer 1)": 41,
        "ספר 2 (Sefer 2)": 31,
        "ספר 3 (Sefer 3)": 17,
        "ספר 4 (Sefer 4)": 17,
        "ספר 5 (Sefer 5)": 44,
    }

    type_tehilim, created = TypeTextStudy.objects.get_or_create(name="Tehilim")

    current_tehilim = 1
    for day, total_sections in tehilim_per_book.items():
        for section in range(1, total_sections + 1):
            TextStudy.objects.create(
                name=f"Tehilim {current_tehilim}",
                type=type_tehilim,
                livre=day,
                link=f"https://www.sefaria.org/Psalms.{current_tehilim}",
                total_sections=1,
            )
            current_tehilim += 1


def add_parachiot_devarim():
    devarim = {
        "דברים (Devarim)": 1,
        "ואתחנן (Vaetchanan)": 1,
        "עקב (Eikev)": 1,
        "ראה (Re'eh)": 1,
        "שופטים (Shoftim)": 1,
        "כי תצא (Ki Teitzei)": 1,
        "כי תבוא (Ki Tavo)": 1,
        "ניצבים (Nitzavim)": 1,
        "וילך (Vayelech)": 1,
        "האזינו (Ha'Azinu)": 1,
        "וזאת הברכה (V'Zot HaBracha)": 1,
    }

    type_parasha, created = TypeTextStudy.objects.get_or_create(name="Parasha Devarim")

    for parasha, total_sections in devarim.items():
        TextStudy.objects.create(
            name=f"פרשת {parasha}",
            type=type_parasha,
            livre="דברים (Devarim)",
            link=f"https://www.sefaria.org/Deuteronomy.{parasha}",
            total_sections=total_sections,
        )


def initialize_text_studies():
    create_text_study_types()
    print("Types created")
    add_talmud_bavli()
    print("Talmud Bavli added")
    add_mishna()
    print("Mishna added")
    add_tehilim()
    print("Tehilim added")
    add_parachiot_devarim()
    print("Parashiot added")
    print("All text studies added")
