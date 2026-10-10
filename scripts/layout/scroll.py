"""Les lignes du Sefer Torah, pour toute la Torah.

    python3 scripts/layout/scroll.py --check            # dit les écarts, n'écrit rien
    python3 scripts/layout/scroll.py --write            # écrit public/texts/torah-layout
    python3 scripts/layout/scroll.py --review DOSSIER   # les lignes corrigées, en images

Le rouleau relevé est celui de 245 colonnes de 42 lignes, où chaque colonne
commence par un vav (« vavé ha'amoudim »), sauf les six de « בי"ה שמ"ו ».
C'est la disposition des tikounim de lecture d'aujourd'hui.

Trois sources, de la plus commode à la plus sûre :

  1. tikkun.io (licence MIT) donne les 245 colonnes ligne par ligne, en texte.
     Son texte est celui de Sefaria, comme le nôtre : les deux se suivent mot
     pour mot, une ligne de tikkun.io se note donc par la place d'un mot de
     notre fichier, sans rien caler.
  2. Les images du tikoun d'ORT (« Navigating the Bible II », gardées par
     ScrollScraper) montrent les mêmes lignes. tikkun.io en a été tiré, avec
     quelques mots rangés une ligne trop haut ou trop bas : on recale chaque
     ligne sur son image (la largeur de ses mots), et l'image a raison.
  3. La tradition écrite fixe les lignes des deux chirot et de leurs abords
     (Rambam, Hilkhot Sefer Torah 8, 4 ; Rema, Yoré Déa 275, 6). Là où les deux
     sources s'en écartent, la tradition a raison.

Les sources restent dans le cache (fetch.py). Les images d'ORT ne servent qu'à
contrôler : aucune n'entre dans le dépôt, aucune n'est redistribuée.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
from collections import defaultdict
from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageDraw

from texts import TEXTS, Parasha, scroll_verse_words

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get("PJ_LAYOUT_CACHE", os.path.expanduser("~/.cache/petite-jerusalem/layout"))
TIKKUN = os.path.join(CACHE, "tikkun-io", "src", "src", "data", "pages", "torah")
ORT = os.path.join(CACHE, "scrollscraper")

EDITION = "tikkun-245"
COLUMNS = 245
ROWS = 42
PARASHIOT = range(264, 318)
LETTERS = "אבגדהוזחטיכךלמםנןסעפףצץקרשת"
NUN = "׆"
MAQAF = "־"

# ---- La tradition écrite ----------------------------------------------------

# Rema, Yoré Déa 275, 6 : les cinq lignes d'après Az yachir commencent par
# « ותקח, אחריה, סוס, ויצאו, ויבאו ». ORT et tikkun.io laissent ces trois
# derniers mots à la fin de la ligne d'avant.
# Rambam, Sefer Torah 8, 4 : dans Haazinou la ligne « בני בשן » commence par
# « בני » ; « ואילים » finit la ligne d'avant.
# (livre, chapitre, verset, mot) : ce mot commence une ligne.
LINE_HEADS = [
    (2, 15, 21, "סוס"),
    (2, 15, 22, "ויצאו"),
    (2, 15, 23, "ויבאו"),
    (5, 32, 14, "בני"),
]
# La dernière ligne d'Az yachir est en trois morceaux : « הים | ובני ישראל
# הלכו ביבשה בתוך | הים ». tikkun.io n'y laisse qu'un blanc.
PIECE_HEADS = [(2, 15, 19, -1)]

# Les premiers mots des trente lignes d'Az yachir, tels que le Rambam les
# écrit (et tels qu'on les voit sur le parchemin).
AZ_YASHIR = (
    "אז לאמר ורכבו לישועה אבי שמו שלשיו אבן יהוה קמיך אפיך נזלים אויב נפשי "
    "ברוחך אדירים כמכה פלא בחסדך קדשך אחז אדום כל ופחד יעבר קנית לשבתך ידיך בא הים"
).split()
# Haazinou : le premier mot de chacune des soixante-dix lignes, puis celui de
# chaque seconde moitié (Rambam, même halakha).
HAAZINOU = (
    "האזינו יערף כשעירם כי הצור אל שחת ה הלוא זכר שאל בהנחל יצב כי ימצאהו "
    "יסבבנהו כנשר יפרש יהוה ירכבהו וינקהו חמאת בני ודם שמנת וינבל בתועבת אלהים "
    "לא ותשכח מכעס אראה בנים כעסוני בגוי ותיקד ותלהט חצי וקטב עם ומחדרים יונק "
    "אשביתה פן ולא ואין יבינו ושנים ויהוה ואיבינו ומשדמת אשכלת וראש חתום לעת "
    "וחש ועל ואפס צור ישתו יהי ואין מחצתי כי אם אשיב אשכיר מדם הרנינו ונקם"
).split()
HAAZINOU_HALVES = (
    "ותשמע תזל וכרביבים הבו כי צדיק דור עם הוא בינו זקניך בהפרידו למספר יעקב "
    "ובתהו יצרנהו על ישאהו ואין ויאכל ושמן עם עם וישמן ויטש יקנאהו יזבחו חדשים "
    "צור וירא ויאמר כי הם ואני כי ותאכל אספה מזי ושן מחוץ גם אמרתי לולי פן כי "
    "לו איכה אם כי כי ענבמו חמת הלא לי כי כי כי ואמר אשר יקומו ראו אני ואין "
    "ואמרתי ותאחז ולמשנאי וחרבי מראש כי וכפר"
).split()
# Rema, au même endroit : les lignes d'avant chaque chira.
BEFORE_AZ_YASHIR = "הבאים ביבשה יהוה מת במצרים".split()
AFTER_AZ_YASHIR = "ותקח אחריה סוס ויצאו ויבאו".split()
BEFORE_HAAZINOU = "ואעידה אחרי הדרך באחרית להכעיסו קהל".split()
# Les colonnes des deux chirot : leurs lettres sont étirées sur l'image, la
# largeur des mots n'y dit rien. La tradition les fixe, on les relit à l'œil.
SONG_COLUMNS = {78, 242, 243}
# Les colonnes qui ne commencent pas par un vav : בראשית, יהודה, הבאים, שמר,
# שני, מה (et ואעידה, qui en est un).
NOT_VAV = {1: "בראשית", 59: "יהודה", 78: "הבאים", 102: "שמר", 132: "שני", 184: "מה"}


# ---- Notre texte et les lignes de tikkun.io ----------------------------------


@dataclass
class Word:
    text: str
    parasha: int
    verse: int
    word: int
    joined: bool = False
    """Lié au mot suivant par un maqaf (un seul paquet d'encre sur l'image)."""
    ref: tuple[int, int, int] = (0, 0, 0)
    """Livre, chapitre, verset."""


@dataclass
class Line:
    column: int
    row: int = 0
    pieces: list[list[int]] = field(default_factory=list)
    """Les morceaux de la ligne, séparés par des blancs : `[début, fin)` dans
    la suite des mots de la Torah. Aucun : une ligne blanche."""
    open: bool = False
    """La ligne ne va pas jusqu'au bout (petou'ha, fin d'un livre)."""
    halves: bool = False
    """Une ligne de Haazinou : deux moitiés de même largeur."""

    @property
    def start(self) -> int:
        return self.pieces[0][0]

    @property
    def end(self) -> int:
        return self.pieces[-1][1]


def our_words() -> list[Word]:
    """Les mots de la Torah, dans l'ordre, à leur place dans nos fichiers."""
    out = []
    for ident in PARASHIOT:
        for v, verse in enumerate(Parasha(ident).verses):
            for w, word in enumerate(scroll_verse_words(verse)):
                out.append(Word(re.sub("[^א-ת]", "", word), ident, v, w))
    return out


def fragment_words(fragment: str) -> list[tuple[str, bool]]:
    """Les mots d'un fragment de tikkun.io : les lettres du ktiv, et si le mot
    est lié au suivant par un maqaf. Le qri (`#[…]`), la marque de petou'ha
    (`#(פ)`) et les nounim inversés ne sont pas des mots."""
    s = fragment.replace("#(פ)", " ")
    s = s.replace(f"({NUN})#", " ").replace(f"#({NUN})", " ")
    s = re.sub(rf"#\[[^\]]*{MAQAF}\s*\]", MAQAF, s)
    s = re.sub(r"#\[[^\]]*\]", "", s)
    out = []
    for group in s.split():
        parts = [re.sub("[^א-ת]", "", p) for p in group.split(MAQAF)]
        parts = [p for p in parts if p]
        out += [(p, k < len(parts) - 1) for k, p in enumerate(parts)]
    return out


def tikkun_lines(words: list[Word]) -> list[Line]:
    """Les colonnes de tikkun.io, ramenées à quarante-deux lignes."""
    lines: list[Line] = []
    refs: list[tuple[int, int, int]] = []
    at = 0
    for column in range(1, COLUMNS + 1):
        with open(os.path.join(TIKKUN, f"{column}.json"), encoding="utf8") as f:
            page = json.load(f)
        rows: list[Line] = []
        for entry in page:
            refs += [(v["book"], v["chapter"], v["verse"]) for v in entry["verses"]]
            line = Line(column, open=bool(entry["isPetucha"]), halves=len(entry["text"]) == 2)
            for fragment in (f for part in entry["text"] for f in part):
                found = fragment_words(fragment)
                if not found:
                    continue
                for k, (text, joined) in enumerate(found):
                    if words[at + k].text != text:
                        raise SystemExit(
                            f"Colonne {column} : « {text} » là où notre texte a « {words[at + k].text} »."
                        )
                    words[at + k].joined = joined
                line.pieces.append([at, at + len(found)])
                at += len(found)
            rows.append(line)
        rows = with_blank_lines(rows)
        if len(rows) != ROWS:
            raise SystemExit(f"Colonne {column} : {len(rows)} lignes.")
        for row, line in enumerate(rows):
            line.row = row
        lines += rows
    if at != len(words):
        raise SystemExit(f"tikkun.io a {at} mots, nos fichiers {len(words)}.")
    # Le livre, le chapitre et le verset de chaque mot.
    verses = sorted({(w.parasha, w.verse) for w in words})
    if len(verses) != len(refs):
        raise SystemExit(f"{len(refs)} versets chez tikkun.io, {len(verses)} chez nous.")
    ref_of = dict(zip(verses, refs))
    for w in words:
        w.ref = ref_of[(w.parasha, w.verse)]
    # La Torah finit au milieu de sa dernière ligne.
    next(line for line in reversed(lines) if line.pieces).open = True
    return lines


def with_blank_lines(rows: list[Line]) -> list[Line]:
    """Les lignes blanches d'une colonne : quatre entre deux livres (tikkun.io
    en compte cinq), une avant et une après chaque chira (il n'en met pas
    autour d'Az yachir)."""
    out: list[Line] = []
    run = 0
    for line in rows:
        if not line.pieces:
            run += 1
            if run <= 4:
                out.append(line)
            continue
        run = 0
        out.append(line)
    if len(out) == ROWS - 2:
        # La colonne d'Az yachir : cinq lignes, un blanc, trente lignes de
        # chira, un blanc, cinq lignes.
        column = out[0].column
        out = out[:5] + [Line(column)] + out[5:35] + [Line(column)] + out[35:]
    return out


# ---- Les images d'ORT ---------------------------------------------------------


def ort_rows() -> dict[int, list[tuple[str, int]]]:
    """Les rangées d'ORT qui portent du texte, livre par livre, dans l'ordre :
    (image, rangée). Une image a trois rangées."""
    rows: dict[int, list[tuple[str, int]]] = defaultdict(list)
    with open(os.path.join(ORT, "final_outputs", "map.csv"), encoding="utf8") as f:
        for r in csv.reader(f):
            if any(colour != "NONE" for colour in r[4::5]):
                rows[int(r[0][1])].append((r[0], int(r[1])))
    return rows


_images: dict[str, np.ndarray] = {}


def ort_ink(name: str, row: int) -> np.ndarray:
    """L'encre d'une rangée : vrai là où l'image n'est pas blanche."""
    if name not in _images:
        with Image.open(os.path.join(ORT, "webmedia", name)) as im:
            _images[name] = np.asarray(im.convert("RGB")).min(axis=2) < 200
    ink = _images[name]
    height = ink.shape[0] // 3
    return ink[row * height: (row + 1) * height]


def blobs(columns: np.ndarray, gap: int = 3) -> list[tuple[int, int]]:
    """Les paquets d'encre d'une rangée, de droite à gauche : `(x0, x1)`
    comptés depuis le bord droit. Deux paquets que séparent `gap` colonnes
    vides ou moins n'en font qu'un : c'est l'écart entre deux lettres."""
    out = []
    start = last = None
    for x, on in enumerate(columns[::-1]):
        if not on:
            continue
        if start is None:
            start = x
        elif x - last > gap:
            out.append((start, last))
            start = x
        last = x
    if start is not None:
        out.append((start, last))
    return out


def row_blobs(rows: list[tuple[str, int]]) -> list[tuple[int, int]]:
    """Les paquets d'une ligne du rouleau. Là où une paracha finit dans la
    ligne, ORT la montre en deux rangées, une par paracha."""
    width = 0
    columns = None
    for name, row in rows:
        ink = ort_ink(name, row).any(axis=0)
        columns = ink if columns is None else columns | ink
        width = len(ink)
    assert columns is not None and width
    # Les points de fin de verset et le passek sont trop étroits pour un mot.
    return [b for b in blobs(columns) if b[1] - b[0] + 1 >= 5]


def pair_rows(lines: list[Line], words: list[Word]) -> dict[int, list[tuple[str, int]]]:
    """À chaque ligne écrite, sa ou ses rangées d'ORT."""
    by_book: dict[int, list[int]] = defaultdict(list)
    for i, line in enumerate(lines):
        if line.pieces:
            by_book[words[line.start].ref[0]].append(i)
    out: dict[int, list[tuple[str, int]]] = {}
    for book, rows in ort_rows().items():
        ours = by_book[book]
        extra = len(rows) - len(ours)
        k = 0
        for i in ours:
            taken = [rows[k]]
            # Une fin de paracha au milieu de la ligne : la rangée suivante
            # est la même, vue de la paracha d'après.
            parashiot = {words[w].parasha for a, b in lines[i].pieces for w in range(a, b)}
            if len(parashiot) > 1 and extra > 0 and k + 1 < len(rows) and rows[k + 1][1] == rows[k][1]:
                taken.append(rows[k + 1])
                extra -= 1
            out[i] = taken
            k += len(taken)
        if k != len(rows):
            raise SystemExit(f"Livre {book} : {len(rows)} rangées chez ORT, {k} retrouvées.")
    return out


def groups_of(words: list[Word], lo: int, hi: int) -> list[list[int]]:
    """Les mots de `[lo, hi)`, ceux que lie un maqaf réunis : ils ne font
    qu'un paquet sur l'image."""
    out: list[list[int]] = []
    current: list[int] = []
    for i in range(lo, hi):
        current.append(i)
        if not words[i].joined:
            out.append(current)
            current = []
    if current:
        out.append(current)
    return out


def features(group: list[int], words: list[Word]) -> np.ndarray:
    v = np.zeros(len(LETTERS) + 2)
    for i in group:
        for ch in words[i].text:
            v[LETTERS.index(ch)] += 1
    v[-2] = len(group) - 1
    v[-1] = 1
    return v


def row_cost(expected: list[float], seen: list[int], scale: float) -> float:
    """Ce qu'il en coûte de poser ces groupes de mots sur ces paquets d'encre :
    l'écart de largeur de chaque mot, deux mots collés ou un mot en deux
    comptant un peu plus, et l'écart d'échelle avec les rangées voisines."""
    if not expected or not seen:
        return 9.0
    s = sum(seen) / sum(expected)
    n, m = len(expected), len(seen)
    inf = 1e9
    d = [[inf] * (m + 1) for _ in range(n + 1)]
    d[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            cost = d[i][j]
            if cost >= inf:
                continue
            if i < n and j < m:
                e = s * expected[i]
                d[i + 1][j + 1] = min(d[i + 1][j + 1], cost + abs(seen[j] - e) / e)
            if i + 1 < n and j < m:
                e = s * (expected[i] + expected[i + 1]) + 4
                d[i + 2][j + 1] = min(d[i + 2][j + 1], cost + abs(seen[j] - e) / e + 0.25)
            if i < n and j + 1 < m:
                e = s * expected[i]
                d[i + 1][j + 2] = min(d[i + 1][j + 2], cost + abs(seen[j] + seen[j + 1] + 5 - e) / e + 0.35)
    return d[n][m] / n + 2.5 * abs(math.log(s / scale))


SHIFTS = [-4, -3, -2, -1, 0, 1, 2, 3, 4]


def ort_shifts(lines: list[Line], words: list[Word], moved: dict[int, int] | None = None) -> dict[int, int]:
    """De combien de mots la fin de chaque ligne se déplace pour coller à
    l'image d'ORT : le jeu de coupures le moins coûteux sur tout un livre.
    `moved` déplace d'abord des coupures, pour éprouver le contrôle."""
    pairs = pair_rows(lines, words)
    order_all = sorted(pairs)
    seen = {i: [x1 - x0 + 1 for x0, x1 in row_blobs(rows)] for i, rows in pairs.items()}
    spans = {i: [lines[i].start, lines[i].end] for i in order_all}
    # La largeur de chaque lettre dans le caractère d'ORT, mesurée sur les
    # lignes où l'image a autant de paquets que le texte a de groupes.
    x, y = [], []
    for i, (a, b) in spans.items():
        groups = groups_of(words, a, b)
        if len(groups) == len(seen[i]):
            x += [features(g, words) for g in groups]
            y += seen[i]
    coef, *_ = np.linalg.lstsq(np.array(x), np.array(y, dtype=float), rcond=None)

    def widths(lo: int, hi: int) -> list[float]:
        return [float(features(g, words) @ coef) for g in groups_of(words, lo, hi)]

    if moved:
        for i, by in moved.items():
            spans[i][1] += by
            spans[order_all[order_all.index(i) + 1]][0] += by
    out: dict[int, int] = {}
    books: dict[int, list[int]] = defaultdict(list)
    for i in order_all:
        books[words[lines[i].start].ref[0]].append(i)
    for order in books.values():
        n = len(order)
        own = [sum(seen[i]) / max(1.0, sum(widths(*spans[i]))) for i in order]
        scale = [float(np.median(own[max(0, k - 4): k + 5])) for k in range(n)]
        low, high = spans[order[0]][0], spans[order[-1]][1]
        best: dict[int, float] = {0: 0.0}
        back: list[dict[int, int]] = []
        for k, i in enumerate(order):
            a, b = spans[i]
            here: dict[int, float] = {}
            came: dict[int, int] = {}
            fixed = k == n - 1 or bool({lines[i].column, lines[order[k + 1]].column} & SONG_COLUMNS)
            for end in [0] if fixed else SHIFTS:
                for start, cost in best.items():
                    lo, hi = a + start, b + end
                    if hi - lo < 1 or lo < low or hi > high:
                        continue
                    total = cost + row_cost(widths(lo, hi), seen[i], scale[k]) + 0.02 * abs(end)
                    if total < here.get(end, 1e9):
                        here[end] = total
                        came[end] = start
            back.append(came)
            best = here
        shift = 0
        for k in range(n - 1, -1, -1):
            if shift:
                out[order[k]] = shift
            shift = back[k][shift]
    return out


def move_line_end(lines: list[Line], i: int, to: int) -> None:
    """Pose la fin de la ligne `i`, et le début de la ligne écrite d'après, au
    mot `to`."""
    j = next(k for k in range(i + 1, len(lines)) if lines[k].pieces)
    last, first = lines[i].pieces[-1], lines[j].pieces[0]
    if not last[0] < to < first[1]:
        raise SystemExit(f"Colonne {lines[i].column}, ligne {lines[i].row + 1} : coupure hors de portée.")
    last[1] = first[0] = to


def apply_ort(lines: list[Line], words: list[Word], shifts: dict[int, int]) -> list[dict]:
    """Recale sur l'image les lignes que tikkun.io coupe ailleurs."""
    report = []
    for i in sorted(shifts):
        before = lines[i].end
        to = before + shifts[i]
        move_line_end(lines, i, to)
        lo, hi = sorted((before, to))
        report.append({
            "column": lines[i].column,
            "line": lines[i].row + 1,
            "ref": "%d %d:%d" % words[lo].ref,
            "words": " ".join(w.text for w in words[lo:hi]),
            "to": "la ligne suivante" if to < before else "cette ligne",
        })
    return report


def apply_ort_shape(lines: list[Line], words: list[Word]) -> list[dict]:
    """Une ligne que tikkun.io dit finir avant le bord (petou'ha) et que
    l'image montre pleine : la parole s'arrête là, mais la ligne va jusqu'au
    bout, et c'est une ligne blanche qui sépare (avant une chira, à la fin
    d'un livre). ORT, lui, étale d'un bord à l'autre les lignes de deux ou
    trois mots : celles-là restent ouvertes."""
    report = []
    for i, rows in pair_rows(lines, words).items():
        line = lines[i]
        if not line.open or len(line.pieces) != 1:
            continue
        seen = row_blobs(rows)
        if not seen:
            continue
        width = ort_ink(*rows[0]).shape[1]
        left = width - 1 - seen[-1][1]
        widest = max((b[0] - a[1] - 1 for a, b in zip(seen, seen[1:])), default=0)
        if left <= 25 and widest < 60 and i != max(k for k, l in enumerate(lines) if l.pieces):
            line.open = False
            report.append({
                "column": line.column,
                "line": line.row + 1,
                "ref": "%d %d:%d" % words[line.start].ref,
                "words": " ".join(w.text for w in words[line.start: line.end]),
                "to": "une ligne pleine",
            })
    return report


# ---- La tradition -----------------------------------------------------------


def find_word(words: list[Word], book: int, chapter: int, verse: int, what: str | int) -> int:
    verse_words = [i for i, w in enumerate(words) if w.ref == (book, chapter, verse)]
    if isinstance(what, int):
        return verse_words[what]
    return next(i for i in verse_words if words[i].text == what)


def apply_tradition(lines: list[Line], words: list[Word]) -> list[dict]:
    report = []
    written = [i for i, line in enumerate(lines) if line.pieces]
    for book, chapter, verse, text in LINE_HEADS:
        at = find_word(words, book, chapter, verse, text)
        if any(lines[i].start == at for i in written):
            continue
        # La coupure la plus proche se pose à ce mot.
        i = min(written, key=lambda k: abs(lines[k].end - at))
        was = lines[i].end
        move_line_end(lines, i, at)
        lo, hi = sorted((was, at))
        report.append({
            "column": lines[i].column,
            "line": lines[i].row + 1,
            "ref": "%d %d:%d" % (book, chapter, verse),
            "words": " ".join(w.text for w in words[lo:hi]),
            "to": "la ligne suivante" if at < was else "cette ligne",
        })
    for book, chapter, verse, which in PIECE_HEADS:
        at = find_word(words, book, chapter, verse, which)
        line = next(lines[i] for i in written if lines[i].start <= at < lines[i].end)
        if any(piece[0] == at for piece in line.pieces):
            continue
        k = next(k for k, piece in enumerate(line.pieces) if piece[0] < at < piece[1])
        end = line.pieces[k][1]
        line.pieces[k][1] = at
        line.pieces.insert(k + 1, [at, end])
        report.append({
            "column": line.column,
            "line": line.row + 1,
            "ref": "%d %d:%d" % (book, chapter, verse),
            "words": words[at].text,
            "to": "un morceau à part",
        })
    return report


# ---- Ce qu'un rouleau doit tenir ----------------------------------------------


def check(lines: list[Line], words: list[Word]) -> None:
    """Arrête tout si le relevé n'est pas un rouleau de 245 colonnes."""
    if len(lines) != COLUMNS * ROWS:
        raise SystemExit(f"{len(lines)} lignes : il en faut {COLUMNS * ROWS}.")
    at = 0
    for line in lines:
        for a, b in line.pieces:
            if a != at or b <= a:
                raise SystemExit(f"Colonne {line.column}, ligne {line.row + 1} : le texte ne se suit pas.")
            at = b
    if at != len(words):
        raise SystemExit("Des mots ne sont sur aucune ligne.")
    heads = lambda rows: [words[line.start].text for line in rows]  # noqa: E731
    for column in range(1, COLUMNS + 1):
        first = lines[(column - 1) * ROWS]
        head = words[first.start].text
        if not (head.startswith("ו") or NOT_VAV.get(column) == head):
            raise SystemExit(f"La colonne {column} commence par « {head} ».")
    # Les deux chirot et leurs abords.
    start = next(i for i, line in enumerate(lines) if line.pieces and words[line.start].ref == (2, 15, 1))
    if heads(lines[start: start + 30]) != AZ_YASHIR:
        raise SystemExit("Az yachir n'a pas ses trente lignes.")
    shape = [len(line.pieces) for line in lines[start: start + 30]]
    if shape != [1] + [3, 2] * 14 + [3]:
        raise SystemExit(f"Az yachir n'a pas sa forme : {shape}.")
    if lines[start - 1].pieces or lines[start + 30].pieces:
        raise SystemExit("Il manque une ligne blanche autour d'Az yachir.")
    if heads(lines[start - 6: start - 1]) != BEFORE_AZ_YASHIR or heads(lines[start + 31: start + 36]) != AFTER_AZ_YASHIR:
        raise SystemExit("Les cinq lignes d'avant ou d'après Az yachir ne sont pas celles du Rema.")
    song = [line for line in lines if line.halves]
    if heads(song) != HAAZINOU or [words[line.pieces[1][0]].text for line in song] != HAAZINOU_HALVES:
        raise SystemExit("Haazinou n'a pas les soixante-dix lignes du Rambam.")
    start = lines.index(song[0])
    if lines[start - 1].pieces or heads(lines[start - 7: start - 1]) != BEFORE_HAAZINOU:
        raise SystemExit("Les six lignes d'avant Haazinou ne sont pas celles du Rema.")


# ---- Les fichiers --------------------------------------------------------------


def special_letters() -> dict[int, dict[str, list[list[int]]]]:
    """Les grandes et les petites lettres, d'après le balisage de Sefaria."""
    from torah import special_letters as of_parasha  # le relevé du pilote

    return {ident: of_parasha(Parasha(ident)) for ident in PARASHIOT}


def layout_of(ident: int, lines: list[Line], words: list[Word], special: dict) -> dict:
    """Le fichier d'une paracha : ses colonnes, et dans chacune ses lignes.

    Une ligne est la suite de ses morceaux, chacun noté par la place de son
    premier mot `[verset, mot]`. `null` tient la place d'un blanc au bord : ce
    qui précède ou ce qui suit n'est pas de cette paracha, ou la ligne
    s'arrête là (petou'ha). Une ligne sans morceau est une ligne blanche.
    """
    mine = [i for i, line in enumerate(lines)
            if any(words[w].parasha == ident for a, b in line.pieces for w in range(a, b))]
    columns: list[dict] = []
    for i in range(mine[0], mine[-1] + 1):
        line = lines[i]
        if not columns or columns[-1]["column"] != line.column:
            columns.append({"column": line.column, "from": line.row, "lines": []})
        pieces: list[list[int] | None] = []
        if line.pieces:
            if words[line.start].parasha != ident:
                pieces.append(None)
            for a, b in line.pieces:
                first = next((w for w in range(a, b) if words[w].parasha == ident), None)
                if first is not None:
                    pieces.append([words[first].verse, words[first].word])
            if line.open or words[line.end - 1].parasha != ident:
                pieces.append(None)
        columns[-1]["lines"].append(pieces)
        if line.halves:
            k = len(columns[-1]["lines"]) - 1
            columns[-1].setdefault("halves", [k, k])[1] = k
    return {"title": Parasha(ident).title, "edition": EDITION, "columns": columns,
            "big": special[ident]["big"], "small": special[ident]["small"]}


def write(lines: list[Line], words: list[Word]) -> None:
    out = os.path.join(TEXTS, "torah-layout")
    os.makedirs(out, exist_ok=True)
    special = special_letters()
    for ident in PARASHIOT:
        with open(os.path.join(out, f"{ident}.json"), "w", encoding="utf8") as f:
            json.dump(layout_of(ident, lines, words, special), f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")


# ---- La relecture ---------------------------------------------------------------


def review(lines: list[Line], words: list[Word], changed: list[int], folder: str) -> None:
    """Pour chaque ligne corrigée, sa rangée d'ORT et celles qui l'entourent,
    les paquets d'encre soulignés : à regarder à côté du compte rendu."""
    os.makedirs(folder, exist_ok=True)
    pairs = pair_rows(lines, words)
    written = sorted(pairs)
    done: set[int] = set()
    for i in changed:
        if i in done:
            continue
        k = written.index(i)
        around = written[max(0, k - 1): k + 4]
        done.update(around)
        bands = []
        for j in around:
            for name, row in pairs[j]:
                with Image.open(os.path.join(ORT, "webmedia", name)) as im:
                    rgb = im.convert("RGB")
                height = rgb.height // 3
                band = rgb.crop((0, row * height, rgb.width, (row + 1) * height))
                band = band.resize((band.width * 3, band.height * 3), Image.LANCZOS)
                draw = ImageDraw.Draw(band)
                for x0, x1 in row_blobs([(name, row)]):
                    draw.line([((rgb.width - 1 - x1) * 3, band.height - 2), ((rgb.width - x0) * 3, band.height - 2)],
                              fill=(220, 0, 0), width=2)
                bands.append(band)
        sheet = Image.new("RGB", (bands[0].width, sum(b.height + 6 for b in bands)), "white")
        y = 0
        for band in bands:
            sheet.paste(band, (0, y))
            y += band.height + 6
        sheet.save(os.path.join(folder, f"colonne-{lines[i].column:03d}-ligne-{lines[i].row + 1:02d}.png"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true", help="compare aux images d'ORT et à la tradition")
    parser.add_argument("--write", action="store_true", help="écrit public/texts/torah-layout")
    parser.add_argument("--review", help="dossier des planches de relecture (hors dépôt)")
    parser.add_argument("--report", help="écrit le compte rendu des corrections (JSON, hors dépôt)")
    parser.add_argument("--probe", type=int, default=0,
                        help="éprouve le contrôle : déplace une coupure sur N et compte celles qu'il retrouve")
    args = parser.parse_args()
    words = our_words()
    lines = tikkun_lines(words)
    print(f"{len(words)} mots, {sum(1 for l in lines if l.pieces)} lignes écrites, {COLUMNS} colonnes.")
    if args.probe:
        probe(lines, words, args.probe)
        return
    shifts = ort_shifts(lines, words)
    from_ort = apply_ort(lines, words, shifts)
    from_shape = apply_ort_shape(lines, words)
    from_tradition = apply_tradition(lines, words)
    for title, report in (("Recalé sur l'image d'ORT", from_ort), ("Pleines sur l'image d'ORT", from_shape),
                          ("Recalé sur la tradition", from_tradition)):
        print(f"\n{title} : {len(report)} lignes.")
        for r in report:
            print(f"  colonne {r['column']}, ligne {r['line']} ({r['ref']}) : « {r['words']} » passe à {r['to']}")
    check(lines, words)
    print("\nLe relevé tient : 245 colonnes de 42 lignes, les vavim, les deux chirot.")
    if args.report:
        with open(args.report, "w", encoding="utf8") as f:
            json.dump({"ort": from_ort, "shape": from_shape, "tradition": from_tradition},
                      f, ensure_ascii=False, indent=2)
    if args.review:
        review(lines, words, sorted(shifts), args.review)
    if args.write:
        write(lines, words)
        print("Écrit : public/texts/torah-layout")


def probe(lines: list[Line], words: list[Word], every: int) -> None:
    """Déplace une coupure sur `every` d'un mot, puis demande au contrôle de
    les retrouver : ce qu'il manque là, il le manquerait dans le vrai relevé."""
    base = ort_shifts(lines, words)
    written = [i for i, line in enumerate(lines) if line.pieces]
    moved = {}
    for k in range(5, len(written) - 5, every):
        i, j = written[k], written[k + 1]
        if {lines[i].column, lines[j].column} & SONG_COLUMNS:
            continue
        if {written[k - 1], i, j} & set(base) or min(lines[i].end - lines[i].start, lines[j].end - lines[j].start) < 4:
            continue
        if words[lines[i].start].ref[0] != words[lines[j].end - 1].ref[0]:
            continue
        moved[i] = 1 if k % 2 else -1
    found = ort_shifts(lines, words, moved)
    hit = sum(1 for i, by in moved.items() if found.get(i) == -by)
    false = sum(1 for i in found if i not in moved and i not in base)
    print(f"{len(moved)} coupures déplacées, {hit} retrouvées, {false} fausses alertes.")


if __name__ == "__main__":
    main()
