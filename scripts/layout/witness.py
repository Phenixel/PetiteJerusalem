"""Un second témoin du texte de la guemara : le texte de Vilna de Wikisource.

Le relevé lit le livre dans la couche de texte d'un PDF, qui trompe par
endroits : dans certaines polices le noun ne sort pas, un mot se coupe en
deux, deux mots se collent. Sefaria publie, à côté du texte que l'app lit
(William Davidson, ponctué, abréviations développées), le texte de Vilna de
Wikisource : les mots du livre, ses abréviations, ses leçons. Là où la
lecture du PDF est douteuse, ce texte dit ce que le livre écrit.

Source : Sefaria, version « Wikisource Talmud Bavli » (he.wikisource.org),
licence CC-BY-SA. Les fichiers restent dans le cache du relevé ; seuls les
mots que la page écrit autrement que notre texte entrent au dépôt, dans les
fichiers de lignes (champ `short`).
"""

from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request

CACHE = os.environ.get("PJ_LAYOUT_CACHE", os.path.expanduser("~/.cache/petite-jerusalem/layout"))
DIR = os.path.join(CACHE, "sources", "wikisource")
GCS = "https://storage.googleapis.com/sefaria-export/json/Talmud/Bavli"
VERSION = "Wikisource Talmud Bavli"

SEDER = {
    "Seder Zeraim": ["berakhot"],
    "Seder Moed": ["shabbat", "eruvin", "pesachim", "yoma", "sukkah", "beitzah", "rosh-hashanah", "taanit",
                   "megillah", "moed-katan", "chagigah"],
    "Seder Nashim": ["yevamot", "ketubot", "nedarim", "nazir", "sotah", "gittin", "kiddushin"],
    "Seder Nezikin": ["bava-kamma", "bava-metzia", "bava-batra", "sanhedrin", "makkot", "shevuot", "avodah-zarah",
                      "horayot"],
    "Seder Kodashim": ["zevachim", "menachot", "chullin", "bekhorot", "arakhin", "temurah", "keritot", "meilah",
                       "tamid"],
    "Seder Tahorot": ["niddah"],
}


def path_of(slug: str) -> str:
    return os.path.join(DIR, f"{slug}.json")


def fetch(slug: str) -> bool:
    """Télécharge le texte d'un traité dans le cache, une fois."""
    if os.path.exists(path_of(slug)):
        return True
    seder = next((s for s, slugs in SEDER.items() if slug in slugs), None)
    if seder is None:
        return False
    title = " ".join(part.capitalize() for part in slug.split("-"))
    url = f"{GCS}/{urllib.parse.quote(seder)}/{urllib.parse.quote(title)}/Hebrew/{urllib.parse.quote(VERSION)}.json"
    os.makedirs(DIR, exist_ok=True)
    try:
        import ssl
        try:
            import certifi
            context = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            context = ssl.create_default_context()
        with urllib.request.urlopen(url, timeout=60, context=context) as response:
            data = response.read()
    except Exception:
        import subprocess
        got = subprocess.run(["curl", "-sf", "-m", "90", url], capture_output=True)
        if got.returncode:
            return False
        data = got.stdout
    json.loads(data)
    with open(path_of(slug), "wb") as f:
        f.write(data)
    return True


_TEXTS: dict[str, list[list[str]]] = {}


def amudim(slug: str) -> list[list[str]]:
    """Les mots de chaque amoud de la source (ses index, pas les nôtres)."""
    if slug not in _TEXTS:
        words: list[list[str]] = []
        if os.path.exists(path_of(slug)):
            with open(path_of(slug), encoding="utf8") as f:
                for amud in json.load(f).get("text", []):
                    flat: list[str] = []

                    def walk(x) -> None:
                        if isinstance(x, str):
                            flat.extend(re.sub("<[^>]+>", " ", x).split())
                        elif isinstance(x, list):
                            for y in x:
                                walk(y)

                    walk(amud)
                    words.append(flat)
        _TEXTS[slug] = words
    return _TEXTS[slug]


def letters(word: str) -> str:
    return re.sub("[^א-ת]", "", word)


def words_for(slug: str, amud: int, ours: list[str]) -> list[str]:
    """Les mots de la source pour un de nos amoudim. Nos fichiers ne comptent
    pas les amoudim vides : on cherche, près de la place attendue, celui qui
    partage le plus de mots avec le nôtre, et l'on y joint ses deux voisins
    (une ligne du livre prend parfois les mots de la page d'à côté)."""
    source = amudim(slug)
    if not source or not ours:
        return []
    mine = {letters(w) for w in ours if len(letters(w)) >= 3}
    best, score = None, 0
    for k in range(max(0, amud - 2), min(len(source), amud + 7)):
        here = sum(1 for w in source[k] if letters(w) in mine)
        if here > score:
            best, score = k, here
    if best is None or score < 0.3 * max(1, len(source[best])):
        return []
    out: list[str] = []
    for k in (best - 1, best, best + 1):
        if 0 <= k < len(source):
            out += source[k] + ["|"]
    return out
