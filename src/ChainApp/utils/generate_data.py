from ChainApp.models import TextStudy, TypeTextStudy
import re


def extract_text_in_parentheses(text):
    """Extrait le texte entre parenthèses pour construire le lien."""
    match = re.search(r"\((.*?)\)", text)
    return match.group(1) if match else None


def create_or_get_type(name):
    """Crée ou récupère un type de TextStudy."""
    return TypeTextStudy.objects.get_or_create(name=name)[0]


def create_text_study_type(type_name):
    """Crée un type de TextStudy s'il n'existe pas déjà."""
    return TypeTextStudy.objects.get_or_create(name=type_name)[0]


def get_devarim_link(parasha_name):
    """Génère le lien correct pour chaque parasha de Devarim."""
    devarim_links = {
        "Devarim": "1.1",
        "Vaetchanan": "3.23",
        "Eikev": "7.12",
        "Re'eh": "11.26",
        "Shoftim": "16.18",
        "Ki Teitzei": "21.10",
        "Ki Tavo": "26.1",
        "Nitzavim": "29.9",
        "Vayelech": "31.1",
        "Ha'Azinu": "32.1",
        "V'Zot HaBracha": "33.1"
    }
    english_name = extract_text_in_parentheses(parasha_name)
    return f"https://www.sefaria.org/Deuteronomy.{devarim_links[english_name]}?lang=he&aliyot=0"


def get_tanakh_link(book_name):
    """Renvoie un lien Sefaria selon le livre du Tanakh."""
    tanakh_mapping = {
        "Berechit": "Genesis", "Shemot": "Exodus", "Vayikra": "Leviticus",
        "Bamidbar": "Numbers", "Devarim": "Deuteronomy", "Yehoshua": "Joshua",
        "Shoftim": "Judges", "Shmuel": "Samuel", "Melakhim": "Kings",
        "Yeshayahu": "Isaiah", "Yirmiyahu": "Jeremiah", "Yechezkel": "Ezekiel",
        "Tehillim": "Psalms", "Mishlei": "Proverbs", "Iyov": "Job",
        "Shir Hashirim": "Song_of_Songs", "Rut": "Ruth", "Eicha": "Lamentations",
        "Kohelet": "Ecclesiastes", "Esther": "Esther", "Daniel": "Daniel",
        "Ezra": "Ezra", "Nechemia": "Nehemiah", "Divrei Hayamim": "Chronicles"
    }
    book_key = extract_text_in_parentheses(book_name) or book_name
    return f"https://www.sefaria.org/{tanakh_mapping.get(book_key, book_key)}"


def add_text_studies(data, type_name, link_template, livre_template=None):
    """
    Ajoute des TextStudy à partir de données structurées.

    Args:
        data (dict): Les données structurées contenant les livres et leurs sections.
        type_name (str): Le nom du type de texte (ex : "Talmud Bavli", "Mishna").
        link_template (str): Le modèle d'URL (ex : "https://www.sefaria.org/{name}").
        livre_template (str, optional): Modèle pour les livres (par défaut, les clés de `data`).
    """
    type_text_study = create_text_study_type(type_name)

    for livre, sections in data.items():
        livre_name = livre_template.format(livre=livre) if livre_template else livre
        if isinstance(sections, dict):
            for section_name, total_sections in sections.items():
                link_name = extract_text_in_parentheses(section_name)
                if link_name:
                    if type_name == "Mishna" and "Avot" not in section_name:
                        link_name = f"Mishnah_{link_name}"
                    link = link_template.format(name=link_name)
                    TextStudy.objects.create(
                        name=section_name,
                        type=type_text_study,
                        livre=livre_name,
                        link=link,
                        total_sections=total_sections,
                    )
        else:
            link = get_devarim_link(livre) if type_name == "Parasha Devarim" else link_template.format(name=extract_text_in_parentheses(livre))
            TextStudy.objects.create(
                name=livre,
                type=type_text_study,
                livre=livre_name,
                link=link,
                total_sections=sections,
            )


def add_tehilim():
    tehilim_data = {
        "ספר 1 (Sefer 1)": 41,
        "ספר 2 (Sefer 2)": 31,
        "ספר 3 (Sefer 3)": 17,
        "ספר 4 (Sefer 4)": 17,
        "ספר 5 (Sefer 5)": 44,
    }
    type_tehilim = create_text_study_type("Tehilim")
    current_tehilim = 1

    for livre, total_sections in tehilim_data.items():
        for section in range(1, total_sections + 1):
            TextStudy.objects.create(
                name=f"Tehilim {current_tehilim}",
                type=type_tehilim,
                livre=livre,
                link=f"https://www.sefaria.org/Psalms.{current_tehilim}",
                total_sections=1,
            )
            current_tehilim += 1


def add_tanakh_texts():
    """Ajoute les livres du Tanakh à la base de données."""
    tanakh_data = {
        "Berechit": {
            "Berechit": 1,
            "Noah": 1,
            "Lech Lecha": 1,
            "Vayera": 1,
            "Chayei Sarah": 1,
            "Toldot": 1,
            "Vayetze": 1,
            "Vayishlach": 1,
            "Vayeshev": 1,
            "Miketz": 1,
            "Vayigash": 1,
            "Vayechi": 1,
        },
        "Chemot": {
            "Shemot": 1,
            "Va'era": 1,
            "Bo": 1,
            "Beshalach": 1,
            "Yitro": 1,
            "Mishpatim": 1,
            "Terumah": 1,
            "Tetzaveh": 1,
            "Ki Tisa": 1,
            "Vayakhel": 1,
            "Pekudei": 1,
        },
        "Vayikra": {
            "Vayikra": 1,
            "Tzav": 1,
            "Shemini": 1,
            "Tazria": 1,
            "Metzora": 1,
            "Acharei Mot": 1,
            "Kedoshim": 1,
            "Emor": 1,
            "Behar": 1,
            "Bechukotai": 1,
        },
        "Bamidbar": {
            "Bamidbar": 1,
            "Nasso": 1,
            "Beha'alotcha": 1,
            "Shelach": 1,
            "Korach": 1,
            "Chukat": 1,
            "Balak": 1,
            "Pinchas": 1,
            "Matot": 1,
            "Masei": 1,
        },
        "Devarim": {
            "Devarim": 1,
            "Va'etchanan": 1,
            "Ekev": 1,
            "Re'eh": 1,
            "Shoftim": 1,
            "Ki Tetze": 1,
            "Ki Tavo": 1,
            "Nitzavim": 1,
            "Vayelech": 1,
            "Haazinu": 1,
            "V'Zot HaBerachah": 1,
        },
        "Nevi'im (Prophets)": {
            "Yehoshua": 1,
            "Shoftim": 1,
            "Shmuel Aleph": 1,
            "Shmuel Bet": 1,
            "Melachim Aleph": 1,
            "Melachim Bet": 1,
            "Yeshayahu": 1,
            "Yirmiyahu": 1,
            "Yechezkel": 1,
            "Trei Asar": 1,
        },
        "Ketuvim (Writings)": {
            "Tehillim": 1,
            "Mishlei": 1,
            "Iyov": 1,
            "Shir Hashirim": 1,
            "Ruth": 1,
            "Eicha": 1,
            "Kohelet": 1,
            "Esther": 1,
            "Daniel": 1,
            "Ezra-Nehemiah": 1,
            "Divrei Hayamim Aleph": 1,
            "Divrei Hayamim Bet": 1,
        }
    }

    tanakh_type = create_or_get_type("Tanakh")
    for book, sections in tanakh_data.items():
        for section, total_sections in sections.items():
            TextStudy.objects.create(
                name=section,
                type=tanakh_type,
                livre=book,
                link=get_tanakh_link(section),
                total_sections=total_sections,
            )


def initialize_text_studies():
    # Créer les types de textes
    create_text_study_type("Talmud Bavli")
    create_text_study_type("Mishna")
    create_text_study_type("Tehilim")
    create_text_study_type("Parasha Devarim")

    # Ajouter le Talmud Bavli
    talmud_bavli_data = {
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
    add_text_studies(talmud_bavli_data, "Talmud Bavli", "https://www.sefaria.org/{name}")

    # Ajouter la Mishna
    mishna_data = {
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
    add_text_studies(mishna_data, "Mishna", "https://www.sefaria.org/{name}")

    # Ajouter le tanah
    # add_tanakh_texts()

    # Ajouter les Tehilim
    add_tehilim()

    # Ajouter les Parashiot de Devarim
    devarim_data = {
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
    add_text_studies(
        devarim_data,
        "Parasha Devarim",
        "https://www.sefaria.org/Deuteronomy.{name}",
        livre_template="דברים (Devarim)"
    )

    print("All text studies initialized.")
