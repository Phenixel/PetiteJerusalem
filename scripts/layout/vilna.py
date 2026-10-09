"""La page de Vilna, ligne pour ligne, lue dans des pages composées.

    python3 scripts/layout/vilna.py beitzah --fetch          # télécharge les pages
    python3 scripts/layout/vilna.py beitzah --check          # dit ce que vaut le calage
    python3 scripts/layout/vilna.py beitzah --write          # écrit public/texts/talmud-layout

Le pilote (talmud.py) lisait un scan : il devinait les mots à leur largeur.
Ici la source est une page recomposée ligne pour ligne d'après Vilna, en
PDF, où le texte est du texte : chaque morceau de ligne a ses lettres, sa
police et sa place sur la page. On en tire, sans rien deviner :

  - les lignes de la guemara, de Rachi et de Tossafot (la police dit la zone,
    la place dit la ligne) ;
  - la boîte de chaque ligne sur la page, pour l'écrire au même endroit ;
  - le dibbour hamat'hil, composé dans une police à part.

Le texte du PDF ne va pas dans le dépôt. Il sert à retrouver, pour chaque
ligne, les mots de NOTRE texte qu'elle porte : les deux textes se suivent
(c'est le même Talmud), aux abréviations près. Un fichier de lignes ne porte
donc toujours aucun mot, seulement des places et des boîtes.
"""

from __future__ import annotations

import argparse
import html
import json
import math
import os
import re
import subprocess
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from texts import TEXTS, Token, Tractate

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get("PJ_LAYOUT_CACHE", os.path.expanduser("~/.cache/petite-jerusalem/layout"))
PAGES = os.path.join(CACHE, "sources", "shas-org")
AGENT = "PetiteJerusalem-layout/0.1 (https://github.com/Phenixel/PetiteJerusalem)"
EDITION = "vilna"
CHUNK = 20
# La largeur de la page (guemara et commentaires, sans les marges) dans les
# fichiers : les boîtes des lignes se comptent en dix-millièmes de celle-ci.
UNITS = 10000


def sources() -> dict:
    with open(os.path.join(HERE, "sources.json"), encoding="utf8") as f:
        return json.load(f)["shas-org"]


def page_id(slug: str, amud: int) -> int:
    """Le numéro du PDF d'un amoud (0 = 2a) chez shas.org."""
    return sources()["tractates"][slug] + amud


def pdf_path(slug: str, amud: int) -> str:
    return os.path.join(PAGES, f"{page_id(slug, amud)}.pdf")


def fetch(slug: str, count: int) -> None:
    """Télécharge les pages d'un traité, une par seconde : on ne charge pas le site."""
    os.makedirs(PAGES, exist_ok=True)
    base = sources()["pages"]
    for amud in range(count):
        target = pdf_path(slug, amud)
        if os.path.exists(target) and os.path.getsize(target) > 0:
            continue
        url = base.format(page=page_id(slug, amud))
        done = subprocess.run(["curl", "-sL", "--fail", "-m", "60", "-A", AGENT, "-o", target, url])
        if done.returncode:
            if os.path.exists(target):
                os.remove(target)
            print(f"  pas de page pour l'amoud {amud} ({url})")
        time.sleep(1)


# ---- Lire une page -------------------------------------------------------------


@dataclass
class Chunk:
    """Un morceau de ligne du PDF : ses lettres (dans l'ordre de lecture), sa
    police, sa boîte."""

    text: str
    family: str
    size: int
    left: int
    top: int
    width: int
    height: int
    reach: tuple[int, int] = (0, 0)
    """Le haut et le bas de la boîte du mot lui-même, qui peut déborder de sa ligne."""

    @property
    def right(self) -> int:
        return self.left + self.width

    @property
    def middle(self) -> float:
        return self.top + self.height / 2


def decode(raw: str) -> str:
    """Les polices du PDF rangent l'hébreu aux places de Windows-1255, vues
    selon la police comme du MacRoman ou du Latin-1 : on revient aux lettres.
    Certaines lettres sortent en caractère de contrôle (le noun en 0x13 ou en
    0x0E selon la police) : on les garde à part, la page dira lesquelles.
    Le texte est dans l'ordre de l'œil (de gauche à droite) : on le retourne."""
    out = []
    for ch in raw:
        if "א" <= ch <= "ת":
            out.append(ch)
            continue
        if ord(ch) < 32:
            # Une lettre sortie en caractère de contrôle (le noun, le plus
            # souvent) : laquelle, la page le dira (voir printed_page).
            out.append(chr(0xE000 + ord(ch)))
            continue
        letter = None
        for encoding in ("mac_roman", "latin-1", "cp1252"):
            try:
                byte = ch.encode(encoding)
            except UnicodeEncodeError:
                continue
            if 0xE0 <= byte[0] <= 0xFA:
                letter = byte.decode("cp1255")
                break
        out.append(letter or ch)
    swap = {"(": ")", ")": "(", "[": "]", "]": "["}
    return "".join(swap.get(ch, ch) for ch in reversed(out))


def read_page(pdf: str) -> list[Chunk]:
    """Les mots de la page. Leurs lettres et leur boîte viennent de
    `pdftotext -bbox` (un mot par mot, le noun compris) ; leur police, de
    `pdftohtml -xml`, qui range le texte par morceaux d'une même police."""
    xml = subprocess.run(["pdftohtml", "-xml", "-i", "-q", "-hidden", "-stdout", pdf],
                         capture_output=True, text=True, check=True).stdout
    fonts = {
        m[0]: (int(m[1]), m[2].split("+")[-1])
        for m in re.findall(r'<fontspec id="(\d+)" size="(\d+)" family="([^"]+)"', xml)
    }
    page = re.search(r'<page[^>]*height="(\d+)" width="(\d+)"', xml)
    if page:
        SHEET[:] = [int(page[2]), int(page[1])]
    bare = lambda text: re.sub(r"[\x00-\x20]", "", text)  # noqa: E731
    spans = [
        (int(m[2]), int(m[1]), int(m[3]), int(m[4])) + fonts[m[5]] + (bare(html.unescape(re.sub(r"<[^>]+>", "", m[6]))),)
        for m in re.finditer(r'<text top="(-?\d+)" left="(-?\d+)" width="(\d+)" height="(\d+)" font="(\d+)">(.*?)</text>', xml, re.S)
    ]
    boxes = subprocess.run(["pdftotext", "-bbox", pdf, "-"], capture_output=True, check=True).stdout.decode("utf8", "replace")
    size = re.search(r'<page width="([\d.]+)" height="([\d.]+)"', boxes)
    if not page or not size:
        return []
    scale = int(page[2]) / float(size[1])
    # Les morceaux par bande de hauteur, pour retrouver vite celui d'un mot.
    bands: dict[int, list[tuple]] = defaultdict(list)
    for span in spans:
        for band in range(span[1] // 20, (span[1] + span[3]) // 20 + 1):
            bands[band].append(span)
    words = []
    for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', boxes, re.S):
        x0, y0, x1, y1 = (float(v) * scale for v in m.groups()[:4])
        raw = bare(html.unescape(m[5]))
        text = decode(html.unescape(m[5]))
        if not text.strip():
            continue
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        # Le morceau du mot : celui qui passe à sa place et qui porte ses
        # lettres. La boîte d'un mot peut tenir trois lignes de haut (voir
        # settle) : son milieu seul désignerait le morceau d'une autre ligne.
        best = None
        seen = set()
        for band in range(int(y0) // 20, int(y1) // 20 + 1):
            for span in bands.get(band, []):
                if span in seen:
                    continue
                seen.add(span)
                left, top, width, height, font_size, family, letters = span
                shared = min(x1, left + width) - max(x0, left)
                if shared >= min(1.0, x1 - x0) and top - 2 <= y1 and y0 <= top + height + 2:
                    # Un point ou une lettre d'une autre police se colle au mot.
                    mine = raw in letters or any(len(piece) > 1 and piece in letters for piece in re.split(r"[.,:;'\"()\[\]]", raw))
                    # Un mot court est dans bien des morceaux : le sien le porte
                    # à la place où il est (les lettres du morceau vont de gauche à droite).
                    off = 0.0
                    if raw in letters and letters:
                        off = min(abs(left + width * (m.start() + len(raw) / 2) / len(letters) - cx)
                                  for m in re.finditer(re.escape(raw), letters))
                    # Une boîte de mot trois fois haute comme le morceau n'est pas de sa police.
                    odd = round(abs(math.log(max(1.0, y1 - y0) / max(1, height))) / 0.4)
                    rank = (not mine, off > 0.12 * width + 8, odd, round(abs(top + height / 2 - cy) / 3), -shared)
                    if best is None or rank < best[0]:
                        best = (rank, font_size, family, top, height)
        if best is None:
            continue
        # La hauteur vient du morceau : celle du mot, dans certaines polices,
        # déborde de sa ligne et la brouille avec ses voisines.
        words.append(Chunk(text, best[2], best[1], round(x0), best[3], round(x1 - x0), best[4],
                           (int(y0), int(y1) + 1)))
    CHUNKS[:] = words
    return words


LINES: list = []
"""Les lignes gardées de la dernière page, et ce qu'en dit l'encre."""
CHUNKS: list = []
"""Les mots de la dernière page lue."""
SHEET = [0, 0]
"""La largeur et la hauteur de la dernière page lue, dans l'unité de ses boîtes."""


INK: list = ["", None]


def page_ink(pdf: str):
    """L'encre de la page, rendue à l'échelle de ses boîtes (la dernière est gardée)."""
    import io

    import numpy
    from PIL import Image
    if INK[0] != pdf:
        width, height = SHEET
        raw = subprocess.run(["pdftoppm", "-gray", "-scale-to-x", str(width), "-scale-to-y", str(height),
                              "-singlefile", "-png", pdf], capture_output=True, check=True).stdout
        INK[:] = [pdf, numpy.array(Image.open(io.BytesIO(raw)).convert("L")) < 150]
    return INK[1]


def initial_words(pdf: str, main_size: int, ours: list[Token], kept: list) -> list[list[int]]:
    """Le mot d'ouverture, en très grand au-dessus de la guemara.

    Au début d'un traité ou d'un chapitre, le livre écrit le premier mot en
    grandes lettres dans le blanc que les commentaires laissent en haut de la
    colonne, et la première ligne commence au mot d'après. On le reconnaît à
    son corps (bien plus grand que la guemara), à sa place (dans la colonne)
    et à ce qu'il est : le mot de notre texte qui ouvre une ligne. Il quitte
    cette ligne et reçoit sa boîte, mesurée sur l'encre : [gauche, haut,
    droite, bas, passage, mot, nombre], dans l'unité de la page."""
    if not kept:
        return []
    lo, hi = min(l.left for l, _ in kept), max(l.right for l, _ in kept)
    big = [c for c in CHUNKS if c.size >= 1.5 * main_size and norm(c.text)
           and lo - 4 <= c.left and c.right <= hi + 4]
    rows: list[list[Chunk]] = []
    for c in sorted(big, key=lambda c: c.middle):
        if rows and abs(rows[-1][0].middle - c.middle) < 0.5 * c.size:
            rows[-1].append(c)
        else:
            rows.append([c])
    index = {(t.passage, t.word): k for k, t in enumerate(ours)}
    words = [norm(t.text) for t in ours]
    out = []
    for row in rows:
        row.sort(key=lambda c: -c.right)
        # Un mot composé en deux morceaux qui se touchent n'en fait qu'un.
        mine = []
        for a, c in zip([None] + row, row):
            if a is not None and a.left - c.right < 2 and mine:
                mine[-1] += norm(c.text)
            else:
                mine.append(norm(c.text))
        # Le mot de notre texte qui ouvre une ligne et qui est celui-là.
        for k, (line, runs) in enumerate(kept):
            unit, passage, word, count = runs[0]
            at = index.get((passage, word))
            # Notre texte annonce la michna (« מתני׳ ») avant le mot ; le livre
            # ne l'écrit pas là : l'annonce quitte la page avec lui.
            skip = 1 if at is not None and words[at] == norm("מתני") and count > 1 else 0
            if at is None or words[at + skip: at + skip + len(mine)] != mine or count < skip + len(mine):
                continue
            word, count = word + skip, count - skip
            # Sa boîte : l'encre du mot, dans la largeur que le texte lui donne.
            left, right = min(c.left for c in row), max(c.right for c in row)
            top = int(min(min(c.top, c.reach[0]) for c in row))
            bottom = int(max(max(c.top + c.height, c.reach[1]) for c in row))
            ink = page_ink(pdf)[max(0, top): bottom, left + 1: right - 1].any(axis=1)
            spans, start = [], None
            for y, on in enumerate(list(ink) + [False]):
                if on and start is None:
                    start = y
                elif not on and start is not None:
                    spans.append((start, y))
                    start = None
            if not spans:
                break
            # La plus haute bande d'encre est le mot ; un filet de cadre est mince.
            a, b = max(spans, key=lambda span: span[1] - span[0])
            if b - a < 0.6 * main_size:
                break
            rest = (unit, passage, word + len(mine), count - len(mine))
            kept[k] = (line, ([rest] if rest[3] else []) + list(runs[1:]))
            out.append([left, top + a, right, top + b, passage, word, len(mine)])
            break
    return out


def big_words(main_size: int, ours: list[Token], kept: list) -> list[list[int]]:
    """Les mots de la guemara que le livre écrit plus grand dans leur ligne
    (le premier mot d'un chapitre commencé en milieu de page, « גמ' ») :
    [passage, mot, nombre]."""
    text = {(t.passage, t.word): norm(t.text) for t in ours}
    out = []
    for c in CHUNKS:
        if not 1.15 * main_size <= c.size < 1.5 * main_size or len(norm(c.text)) < 2:
            continue
        for line, runs in kept:
            if line.top - 2 <= c.middle <= line.bottom + 2 and line.left - 2 <= c.left and c.right <= line.right + 2:
                spot = next(((p, w + d) for _, p, w, n in runs for d in range(n)
                             if text.get((p, w + d)) == norm(c.text)), None)
                if spot and [spot[0], spot[1], 1] not in out:
                    out.append([spot[0], spot[1], 1])
                break
    return out


def closing_lines(main_size: int, ours: list[Token], kept: list) -> list[list[int]]:
    """« הדרן עלך … » : la ligne qui clôt un chapitre, en grand au milieu de
    la colonne. Notre guemara la porte ; le livre l'écrit à part. Ses mots
    quittent la ligne où le voisinage les avait mis et reçoivent leur boîte :
    [gauche, haut, droite, bas, passage, mot, nombre]."""
    if not kept:
        return []
    lo, hi = min(l.left for l, _ in kept), max(l.right for l, _ in kept)
    rows: list[list[Chunk]] = []
    for c in sorted((c for c in CHUNKS if c.size >= 1.1 * main_size and lo - 4 <= c.left and c.right <= hi + 4),
                    key=lambda c: (c.size, c.middle)):
        if rows and rows[-1][0].size == c.size and abs(rows[-1][0].middle - c.middle) < 0.3 * c.size:
            rows[-1].append(c)
        else:
            rows.append([c])
    said = [norm(t.text) for t in ours]
    out = []
    done: set = set()
    # La plus grande d'abord : un commentaire de la marge répète parfois la
    # formule en plus petit, et notre guemara ne la porte qu'une fois.
    for row in sorted(rows, key=lambda row: -row[0].size):
        row.sort(key=lambda c: -c.right)
        words = [norm(c.text) for c in row if norm(c.text)]
        if len(words) < 3 or words[0] != norm("הדרן"):
            continue
        at = next((k for k in range(len(said)) if said[k: k + len(words)] == words
                   and len({t.passage for t in ours[k: k + len(words)]}) == 1), None)
        if at is None or at in done:
            continue
        done.add(at)
        gone = {(t.passage, t.word) for t in ours[at: at + len(words)]}
        for k, (line, runs) in enumerate(kept):
            rest = []
            for unit, passage, word, count in runs:
                start = None
                for w in range(word, word + count + 1):
                    inside = w < word + count and (passage, w) not in gone
                    if inside and start is None:
                        start = w
                    elif not inside and start is not None:
                        rest.append((unit, passage, start, w - start))
                        start = None
            kept[k] = (line, rest)
        out.append([min(c.left for c in row), int(min(c.top for c in row)), max(c.right for c in row),
                    int(max(c.top + c.height for c in row)), ours[at].passage, ours[at].word, len(words)])
    return out


def ink_faults(pdf: str, lines: list) -> list[str]:
    """Le second témoin : l'encre de la page.

    Les boîtes des lignes viennent de la couche de texte du PDF, qui peut se
    tromper sans le dire (une police qui annonce de fausses largeurs). L'image
    de la même page ne se trompe pas : on la rend, et pour chaque ligne on
    regarde si l'encre s'arrête bien à ses deux bords. Une ligne en faute a de
    l'encre juste au-delà d'un bord (il lui manque un mot) ou du blanc juste
    en deçà (sa boîte est trop longue)."""
    import numpy
    if not SHEET[0] or not lines:
        return []
    ink = page_ink(pdf)
    out = []
    usual: dict[str, float] = {}
    for zone in {line.zone for line in lines}:
        talls = sorted(line.bottom - line.top for line in lines if line.zone == zone)
        usual[zone] = talls[len(talls) // 2]
    # Les appels de note, composés petit entre les mots, ne sont pas des mots.
    small = 0.8 * min(usual.values())
    # On les efface là où l'on cherche de l'encre en trop, sur toute la
    # hauteur de leur boîte (elle ne dit pas bien leur ligne) ; on les laisse
    # là où l'on cherche un blanc.
    whole = ink
    ink = ink.copy()
    # Et l'encre qui n'est d'aucun mot est un dessin (les carrés de Kilaïm
    # dans les Tossafot de Chabbat), pas un mot qui manque à la ligne.
    worded = numpy.zeros(ink.shape, dtype=bool)
    for c in CHUNKS:
        box = (slice(max(0, min(c.top, c.reach[0]) - 2), max(c.top + c.height, c.reach[1]) + 2),
               slice(max(0, c.left - 1), c.right + 2))
        if MARK.fullmatch(c.text.strip()) or (c.height < small and len(norm(c.text)) <= 1):
            ink[box] = False
        else:
            worded[box] = True
    ink &= worded
    for line in lines:
        tall = usual[line.zone]
        middle = (line.top + line.bottom) / 2
        top, bottom = int(middle - 0.2 * tall), int(middle + 0.3 * tall)
        band = ink[max(0, top): max(top + 1, bottom)].any(axis=0)
        full = whole[max(0, top): max(top + 1, bottom)].any(axis=0)
        left, right = int(line.left), int(line.right)
        near, far = max(2, round(0.45 * tall)), max(3, round(0.45 * tall))
        fault = ""
        if band[max(0, left - far): max(0, left - 2)].any():
            fault = "encre à gauche"
        elif band[right + 3: right + far + 1].any():
            fault = "encre à droite"
        elif not full[left: left + near + 2].any():
            fault = "blanc à gauche"
        elif not full[max(0, right - near - 1): right + 1].any():
            fault = "blanc à droite"
        out.append(fault)
    # Une ligne de guemara qui manque : entre deux lignes de la même colonne,
    # un interligne de trop, et de l'encre au milieu.
    main = sorted((k for k, line in enumerate(lines) if line.zone == "main"), key=lambda k: lines[k].top)
    tall = usual.get("main", 0)
    for a, b in zip(main, main[1:]):
        upper, lower = lines[a], lines[b]
        left, right = int(max(upper.left, lower.left)), int(min(upper.right, lower.right))
        gap = (lower.top + lower.bottom) / 2 - (upper.top + upper.bottom) / 2
        if right - left > 4 * tall and gap > 1.7 * tall:
            middle = (upper.bottom + lower.top) / 2
            band = whole[int(middle - 0.2 * tall): int(middle + 0.2 * tall) + 1, left:right]
            if band.any(axis=0).mean() > 0.3 and not out[b]:
                out[b] = "ligne manquante au-dessus"
    return out


@dataclass
class PrintedLine:
    """Une ligne de la page : ses mots, sa boîte, et lesquels sont en dibbour."""

    words: list[str]
    lead: list[bool]
    """Par mot : il est du dibbour hamat'hil (police à part)."""
    owner: str
    """Le commentaire dont la ligne ouvre un dibbour, s'il y en a un : la
    police du dibbour le dit (« rashi », « tosafot », ou rien)."""
    left: int
    right: int
    top: float
    bottom: float
    zone: str = ""
    font: tuple = ()


def words_of(chunks: list[Chunk], lead_fonts: dict) -> tuple[list[str], list[bool]]:
    """Les mots d'une ligne, de droite à gauche. Deux mots qui se touchent
    n'en font qu'un (un point composé à part, une lettre d'une autre police)."""
    words: list[str] = []
    lead: list[bool] = []
    previous: Chunk | None = None
    for chunk in sorted(chunks, key=lambda c: -c.right):
        is_lead = (chunk.family, chunk.size) in lead_fonts
        if previous is not None and previous.left - chunk.right < 1.5 and words:
            words[-1] += chunk.text
        else:
            words.append(chunk.text)
            lead.append(is_lead)
        previous = chunk
    return words, lead


def rows_of(chunks: list[Chunk], tolerance: float, bodies: set | None = None) -> list[list[Chunk]]:
    """Les mots rangés par ligne de la page. Les mots du corps (la taille la
    plus fréquente) font les rangées ; un dibbour ou un renvoi, d'un autre
    corps, rejoint la rangée dont le milieu est le plus proche du sien."""
    if not chunks:
        return []
    # Le corps : la taille la plus fréquente, ou celles qu'on nous donne
    # (Rachi et Tossafot n'ont pas toujours le même).
    if not bodies or not any(c.size in bodies for c in chunks):
        bodies = {Counter(c.size for c in chunks).most_common(1)[0][0]}
    rows: list[list[Chunk]] = []
    for chunk in sorted((c for c in chunks if c.size in bodies), key=lambda c: c.middle):
        if rows and abs(rows[-1][0].middle - chunk.middle) <= tolerance:
            rows[-1].append(chunk)
        else:
            rows.append([chunk])
    spans = [(min(c.top for c in row), max(c.top + c.height for c in row)) for row in rows]
    for chunk in chunks:
        if chunk.size in bodies:
            continue
        # La rangée dont le milieu est le plus proche du sien, si elle l'est assez.
        gaps = [abs((a + b) / 2 - chunk.middle) for a, b in spans]
        k = min(range(len(spans)), key=lambda i: gaps[i]) if spans else -1
        if k >= 0 and gaps[k] <= 0.55 * (spans[k][1] - spans[k][0]):
            rows[k].append(chunk)
        else:
            rows.append([chunk])
    return rows


@dataclass
class Printed:
    main: list[PrintedLine]
    right: list[PrintedLine]
    left: list[PrintedLine]
    wide: list[PrintedLine]
    sizes: dict[str, int]


def adopt(base: list[Chunk], others: list[Chunk], reach: float, limit: int, known: set | None = None) -> list[Chunk]:
    """Les mots d'une autre police qui sont dans nos lignes : un renvoi en
    petit corps, un mot entre crochets. Ils sont sur la rangée d'un de nos
    mots et le touchent presque. Une note de marge peut toucher la colonne
    d'aussi près : elle se reconnaît à ce qu'elle continue (plus de `limit`
    mots à la suite) ou à ce que ses mots ne sont pas des nôtres."""
    if not base:
        return []
    heights = sorted(c.height for c in base)
    height = heights[len(heights) // 2]
    rows: dict[int, list[Chunk]] = defaultdict(list)
    for c in base:
        rows[round(c.middle / height)].append(c)
    chain: dict[int, int] = {}
    chains: dict[int, list[Chunk]] = defaultdict(list)
    waiting = [c for c in others if c.height <= 1.6 * height and not MARK.fullmatch(c.text.strip())]
    changed = True
    while changed:
        changed = False
        for c in waiting[:]:
            band = round(c.middle / height)
            near = [b for k in (band - 1, band, band + 1) for b in rows.get(k, ())
                    if abs(b.middle - c.middle) <= 0.4 * height
                    and -1 <= max(b.left - c.right, c.left - b.right) < reach]
            if near:
                # La suite d'un mot déjà pris, ou une suite nouvelle.
                first = next((chain[id(b)] for b in near if id(b) in chain), id(c))
                chain[id(c)] = first
                chains[first].append(c)
                rows[band].append(c)
                waiting.remove(c)
                changed = True
    got: list[Chunk] = []
    for members in chains.values():
        words = [norm(c.text) for c in members if len(norm(c.text)) > 1]
        if len(members) > limit:
            continue
        if known is not None and sum(1 for w in words if w in known) < 0.5 * len(words):
            continue
        got += members
    return got


def missing_rows(main: list[Chunk], others: list[Chunk], size: int, known: set) -> list[Chunk]:
    """Les lignes de la guemara composées dans une police à part.

    Le PDF découpe une même écriture en plusieurs polices ; une ligne seule
    dans la sienne n'a pas assez de mots pour qu'on reconnaisse son rôle. Elle
    se reconnaît à sa place : au corps de la guemara, dans sa colonne, là où
    il manque une ligne entre deux autres (ou juste avant la première, juste
    après la dernière), et faite de nos mots."""
    if not main:
        return []
    rows: list[list[Chunk]] = []
    for chunk in sorted(main, key=lambda c: c.middle):
        if rows and abs(rows[-1][0].middle - chunk.middle) <= size * 0.3:
            rows[-1].append(chunk)
        else:
            rows.append([chunk])
    middles = [sum(c.middle for c in row) / len(row) for row in rows]
    steps = sorted(b - a for a, b in zip(middles, middles[1:]))
    if not steps:
        return []
    pitch = steps[len(steps) // 2]
    spans = [(min(c.left for c in row), max(c.right for c in row)) for row in rows]
    waiting: dict[int, list[Chunk]] = defaultdict(list)
    for c in others:
        if c.size == size:
            waiting[round(c.middle / (0.4 * pitch))].append(c)
    got: list[Chunk] = []
    for band, chunks in waiting.items():
        middle = sum(c.middle for c in chunks) / len(chunks)
        if min(abs(middle - m) for m in middles) < 0.6 * pitch:
            continue
        above = max((k for k, m in enumerate(middles) if m < middle), default=None)
        below = min((k for k, m in enumerate(middles) if m > middle), default=None)
        near = [k for k in (above, below) if k is not None and abs(middles[k] - middle) < 1.4 * pitch]
        if not near:
            continue
        lo, hi = min(spans[k][0] for k in near), max(spans[k][1] for k in near)
        inside = [c for c in chunks if lo - 3 <= c.left and c.right <= hi + 3]
        words = [norm(c.text) for c in inside if len(norm(c.text)) > 1]
        if len(words) >= 3 and sum(1 for w in words if w in known) >= 0.7 * len(words):
            got += inside
    return got


MARK = re.compile(r"[א-ת]{1,2}[)\]]|[(\[][א-ת][)\]]")
"""Un appel de note, composé au-dessus de la ligne : il peut mordre sur un mot."""


def settle(body: list[Chunk], extra: list[Chunk]) -> None:
    """Remet à leur ligne les mots dont la boîte est trop haute.

    Dans les pages aux polices sans nom, la boîte d'un mot de dibbour tient
    trois lignes de haut (la police annonce de fausses hampes) : son milieu ne
    dit plus sa ligne. Sa vraie ligne est celle où il a la place d'être, la
    seule que les mots du corps laissent libre à cet endroit. On en tire, par
    police, à quelle hauteur de la boîte passe la ligne, et l'on rend à chaque
    mot une boîte de la hauteur du corps, à cette hauteur."""
    if not body:
        return
    heights = sorted(c.height for c in body)
    height = heights[len(heights) // 2]
    # Une police de dibbour assez bavarde pour passer pour le corps en est une quand même.
    tall = [c for c in body + extra if c.height > 1.5 * height]
    body = [c for c in body if c.height <= 1.3 * height]
    if not tall or not body:
        return
    rows: list[list[Chunk]] = []
    for chunk in sorted(body, key=lambda c: c.middle):
        if rows and abs(rows[-1][0].middle - chunk.middle) <= height * 0.35:
            rows[-1].append(chunk)
        else:
            rows.append([chunk])
    middles = [sum(c.middle for c in row) / len(row) for row in rows]
    share: dict[Key, list[float]] = defaultdict(list)
    for chunk in tall:
        inside = [k for k, m in enumerate(middles) if chunk.top <= m <= chunk.top + chunk.height]
        free = [k for k in inside
                if not any(min(chunk.right, b.right) - max(chunk.left, b.left) > 1 for b in rows[k])]
        if len(free) == 1:
            share[(chunk.family, chunk.size)].append((middles[free[0]] - chunk.top) / chunk.height)
    median = lambda values: sorted(values)[len(values) // 2]  # noqa: E731
    everyone = [v for values in share.values() for v in values]
    if not everyone:
        return
    for chunk in sorted(tall, key=lambda c: c.top):
        own = share.get((chunk.family, chunk.size))
        middle = chunk.top + (median(own) if own and len(own) >= 2 else median(everyone)) * chunk.height
        # La rangée libre la plus proche de là, à moins d'une demi-ligne ;
        # sinon le mot fait sa rangée, où la police le dit.
        near = [k for k, m in enumerate(middles) if abs(m - middle) < 0.6 * height
                and not any(min(chunk.right, b.right) - max(chunk.left, b.left) > 1 for b in rows[k])]
        if near:
            k = min(near, key=lambda k: abs(middles[k] - middle))
            middle = middles[k]
            rows[k].append(chunk)
        else:
            rows.append([chunk])
            middles.append(middle)
        chunk.top = round(middle - height / 2)
        chunk.height = height


Key = tuple[str, int]
UNSURE = [0]
"""Les mots posés l'un sur l'autre dans les commentaires de la dernière page lue."""
FLOOR = 0.5
"""La part des pages qu'un traité doit avoir pour s'écrire (voir write)."""


def font_rows(chunks: list[Chunk]) -> list[list[str]]:
    """Les mots d'une police, rangée par rangée, de droite à gauche."""
    rows: list[list[Chunk]] = []
    for chunk in sorted(chunks, key=lambda c: c.middle):
        if rows and abs(rows[-1][0].middle - chunk.middle) <= chunk.size * 0.3:
            rows[-1].append(chunk)
        else:
            rows.append([chunk])
    return [[norm(c.text) for c in sorted(row, key=lambda c: -c.right) if norm(c.text)] for row in rows]


def printed_page(pdf: str, known: dict[str, set], vocabulary: dict[str, set],
                 openings: dict[str, set]) -> Printed | None:
    """La guemara et les deux commentaires d'une page, ligne par ligne.

    Le rôle d'une police se lit à ce qu'elle écrit, pas à son nom (la moitié
    des pages n'en donnent pas) : celle dont les suites de mots sont celles de
    notre guemara est la police de la guemara, celle qui écrit nos
    commentaires est leur corps. Les autres polices des mêmes rangées, si
    leurs mots sont des nôtres, sont les dibbourim (du corps des commentaires
    ou plus grands) et les renvois (plus petits). Le reste, ce sont les
    marges et les commentaires que nous n'avons pas.
    """
    UNSURE[0] = 0
    chunks = read_page(pdf)
    # Les lettres sorties en caractère de contrôle : pour chacune, la lettre
    # qui fait le plus de ses mots des mots de notre texte.
    every_word = vocabulary["main"] | vocabulary["rashi"] | vocabulary["tosafot"]
    unknown = {ch for c in chunks for ch in c.text if "\ue000" <= ch < "\ue020"}
    for ch in sorted(unknown):
        with_it = [re.sub("[^א-ת\ue000-\ue01f]", "", c.text) for c in chunks if ch in c.text]
        best = max("נאבגדהוזחטיכךלמםןסעפףצץקרשת",
                   key=lambda letter: sum(1 for w in with_it if norm(w.replace(ch, letter)) in every_word))
        for c in chunks:
            if ch in c.text:
                c.text = c.text.replace(ch, best)
    fonts: dict[Key, list[Chunk]] = defaultdict(list)
    for c in chunks:
        fonts[(c.family, c.size)].append(c)
    roles: dict[Key, str] = {}
    strength: dict[Key, float] = {}
    for key, own in fonts.items():
        rows = font_rows(own)
        mine = [g for row in rows for g in grams(row)]
        if len(mine) < 8:
            continue
        hits = {zone: sum(1 for g in mine if g in known[zone]) for zone in known}
        side_hits = max(hits["rashi"], hits["tosafot"])
        # La guemara : ses suites de mots sont les nôtres (un texte un peu
        # autre que l'imprimé en retrouve moins), plus que celles d'un commentaire.
        if hits["main"] >= 0.12 * len(mine) and hits["main"] >= side_hits:
            roles[key] = "main"
            strength[key] = hits["main"]
        elif side_hits >= 0.25 * len(mine):
            roles[key] = "side"
            strength[key] = side_hits
    # Une seule police écrit la guemara : celle qui lui ressemble le plus. Un
    # commentaire des marges qui la cite beaucoup (Rabbénou 'Hananel) n'en est pas.
    mains = [key for key, role in roles.items() if role == "main"]
    if mains:
        chosen = max(mains, key=lambda key: strength[key])
        for key in mains:
            # La même écriture, au même corps, en plusieurs polices du PDF, reste la guemara.
            if key != chosen and key[1] != chosen[1]:
                del roles[key]
    # Le corps des commentaires : une note de marge qui cite Rachi (Mossaf
    # Rachi), en bien plus petit, n'en est pas.
    sides = [key for key, role in roles.items() if role == "side"]
    if sides:
        chosen = max(sides, key=lambda key: strength[key])
        for key in sides:
            if key[1] < 0.75 * chosen[1]:
                del roles[key]
    main = [c for key, own in fonts.items() if roles.get(key) == "main" for c in own]
    body = [c for key, own in fonts.items() if roles.get(key) == "side" for c in own]
    if not main:
        return None
    main_size = Counter(c.size for c in main).most_common(1)[0][0]
    side_size = Counter(c.size for c in body).most_common(1)[0][0] if body else main_size
    side = body[:]
    lead_fonts: dict[Key, str] = {}
    main += missing_rows(main, [c for c in chunks if (c.family, c.size) not in roles], main_size, vocabulary["main"])
    # Les bouts de mots de la guemara composés dans une autre police du même
    # corps (un mot à apostrophe, un mot entre crochets) : à elle d'abord,
    # avant qu'on y voie un dibbour du commentaire voisin.
    main += adopt(main, [c for c in chunks if (c.family, c.size) not in roles and c.size >= 0.8 * main_size],
                  0.6 * main_size, 3, vocabulary["main"])
    mine = {id(c) for c in main}
    if body:
        lo, hi = min(c.left for c in body), max(c.right for c in body)
        low, high = min(c.top for c in body) - 6, max(c.top + c.height for c in body) + 6
        everything = vocabulary["rashi"] | vocabulary["tosafot"]
        for key, own in fonts.items():
            if key in roles or not 0.55 * side_size <= key[1] <= 1.7 * side_size:
                continue
            own = [c for c in own if id(c) not in mine]
            inside = [c for c in own if lo - 2 <= c.left and c.right <= hi + 2 and low <= c.middle <= high
                      and not re.fullmatch(r"[(\[]?[א-ת][)\]]?", c.text.strip())]
            words = [norm(c.text) for c in inside if norm(c.text)]
            if len(inside) < 0.6 * len(own) or not words:
                continue
            if sum(1 for w in words if w in everything) < 0.6 * len(words):
                continue
            # Un dibbour est du corps de la ligne ou plus grand. Un renvoi,
            # plus petit, se prend mot par mot là où il touche une ligne
            # (adopt) : sa police est aussi celle de notes de marge.
            if key[1] >= 0.9 * side_size:
                side += inside
                hits = {zone: sum(1 for w in words if w in openings[zone]) for zone in openings}
                lead_fonts[key] = max(hits, key=lambda zone: hits[zone]) if len(set(hits.values())) > 1 else ""
    LEADS = lead_fonts
    bodies = {key[1] for key, role in roles.items() if role == "side"}

    def lines(chunks: list[Chunk], tolerance: float, columns: bool, own: set | None = None) -> list[PrintedLine]:
        # Le corps qui donne la mesure des blancs : celui des commentaires, ou le sien.
        unit = min(own) if own else side_size
        rows = [sorted(row, key=lambda c: -c.right)
                for row in rows_of(chunks, tolerance, own or (bodies if columns else None))]
        # Les blancs de chaque rangée, plus larges qu'une espace ordinaire.
        blanks = [
            [(b.right, a.left) for a, b in zip(row, row[1:]) if a.left - b.right > unit * 0.4]
            for row in rows
        ]

        def gutter(i: int, lo: float, hi: float) -> bool:
            """Un blanc entre deux colonnes se retrouve, au même endroit, sur
            les rangées voisines ; un blanc de justification, non."""
            if hi - lo > unit * 1.6:
                return True
            seen = 0
            for j in (i - 2, i - 1, i + 1, i + 2):
                if 0 <= j < len(rows) and any(min(hi, b) - max(lo, a) >= unit * 0.3 for a, b in blanks[j]):
                    seen += 1
            return seen >= 2

        out = []
        found: list[list[Chunk]] = []
        for i, row in enumerate(rows):
            groups = [[row[0]]]
            for chunk in row[1:]:
                last = groups[-1][-1]
                if columns and last.left - chunk.right > unit * 0.4 and gutter(i, chunk.right, last.left):
                    groups.append([chunk])
                else:
                    groups[-1].append(chunk)
            found += groups
        # Une rangée où la gouttière n'a pas été vue (les deux colonnes ne
        # sont pas à la même hauteur, leurs rangées ne se répondent pas) : on
        # la coupe au blanc où, tout près, des lignes finissent d'un côté et
        # d'autres commencent de l'autre.
        if columns:
            edges = [(min(c.left for c in g), max(c.right for c in g), sum(c.middle for c in g) / len(g)) for g in found]
            again: list[list[Chunk]] = []
            for group in found:
                middle = sum(c.middle for c in group) / len(group)
                near = [e for e in edges if abs(e[2] - middle) < 12 * unit]
                parts = [[group[0]]]
                for chunk in group[1:]:
                    last = parts[-1][-1]
                    lo, hi = chunk.right, last.left
                    if hi - lo > unit * 0.4 \
                            and sum(1 for e in near if abs(e[1] - lo) <= 3) >= 3 \
                            and sum(1 for e in near if abs(e[0] - hi) <= 3) >= 3:
                        parts.append([chunk])
                    else:
                        parts[-1].append(chunk)
                again += parts
            found = again
        for group in found:
            if True:
                words, lead = words_of(group, LEADS)
                owner = next((LEADS[(c.family, c.size)] for c in sorted(group, key=lambda c: -c.right)
                              if LEADS.get((c.family, c.size))), "")
                if any(norm(w) for w in words):
                    out.append(PrintedLine(words, lead, owner, min(c.left for c in group), max(c.right for c in group),
                                           min(c.top for c in group), max(c.top + c.height for c in group)))
        # Dans certaines polices sans nom, des mots sortent du PDF à une
        # fausse place, sur leurs voisins : les boîtes des lignes ne sont
        # alors plus sûres, et la page le dit (voir page_at).
        if columns and os.environ.get("PJ_DEBUG"):
            for row in rows:
                for a, b in zip(row, row[1:]):
                    if min(a.right, b.right) - max(a.left, b.left) > 0.5 * min(a.width, b.width) > 0:
                        print("  sur", (a.family[-6:], a.size, a.left, a.top, a.width, a.height, a.text),
                              (b.family[-6:], b.size, b.left, b.top, b.width, b.height, b.text))
        if columns:
            UNSURE[0] = sum(
                1 for row in rows for a, b in zip(row, row[1:])
                if min(a.right, b.right) - max(a.left, b.left) > 0.5 * min(a.width, b.width) > 0
                and norm(a.text) and norm(b.text)
                # Une glose en petit corps tient deux lignes dans la hauteur d'une seule.
                and max(a.size, b.size) >= 0.8 * side_size
                and not MARK.fullmatch(a.text.strip()) and not MARK.fullmatch(b.text.strip())
            )
        return out

    # Les mots d'autres polices pris dans nos lignes.
    used = {id(c) for c in main} | {id(c) for c in side}
    spare = [c for c in chunks if id(c) not in used and (c.family, c.size) not in roles]
    side += adopt(side, [c for c in spare if id(c) not in used], 0.7 * side_size, 5,
                  vocabulary["rashi"] | vocabulary["tosafot"])
    settle(side, [])
    side = [c for c in side if not MARK.fullmatch(c.text.strip())]
    if os.environ.get("PJ_DEBUG"):
        print("  rôles", {key[0][-4:] + str(key[1]): role for key, role in roles.items()}, "dibbourim", lead_fonts)
    main_lines = lines(main, main_size * 0.3, False)
    # Entre deux colonnes, une gouttière ; entre deux mots, une espace.
    side_lines = lines(side, side_size * 0.3, True)
    for line in main_lines:
        line.zone = "main"
    everything = main_lines + side_lines
    lo, hi = min(l.left for l in everything), max(l.right for l in everything)
    centre = (lo + hi) / 2
    width = hi - lo
    right, left, wide = [], [], []
    for line in side_lines:
        if line.right - line.left > 0.62 * width or (line.left < centre - 0.12 * width and line.right > centre + 0.12 * width):
            wide.append(line)
        elif (line.left + line.right) / 2 > centre:
            right.append(line)
        else:
            left.append(line)
    return Printed(main_lines, right, left, wide, {"main": main_size, "side": side_size})


# ---- Caler la page sur notre texte ---------------------------------------------


def norm(word: str) -> str:
    """Ce qu'on compare d'un mot : ses lettres, sans le noun. Dans certaines
    polices du PDF le noun n'a pas de code et ne sort pas du tout : on
    l'ôte donc des deux côtés, et « נזיר » se reconnaît dans « זיר »."""
    return re.sub("[^א-ת]|[נן]", "", word)


@dataclass
class Placed:
    """Ce que le calage sait d'une zone sur une page."""

    lines: list[PrintedLine]
    runs: list[list[tuple[int, int, int, int]]] = field(default_factory=list)
    """Pour chaque ligne, les morceaux de notre texte : (amoud, passage, mot, nombre)."""
    matched: int = 0
    printed: int = 0
    sure: int = 0
    tight: int = 0
    """Les lignes qui portent nettement plus de lettres que le livre n'en imprime."""
    agree: float = 1.0
    """Sur les lignes qui portent nos mots : la part des mots qui sont les
    mêmes des deux côtés (retrouvés, sur le plus long des deux textes). Un
    commentaire imprimé dans une autre recension que la nôtre en a peu."""
    safe: set = field(default_factory=set)
    """Les lignes (par identité) dont les deux bords sont retrouvés mot pour mot."""
    short: list = field(default_factory=list)
    """Les abréviations du livre à écrire à la place de nos mots, sur les
    lignes qui sans cela seraient illisibles : (amoud, passage, mot, nombre, texte)."""


def match(ours: list[Token], lines: list[PrintedLine], sizes: tuple[int, ...] = (8, 5, 4),
          ahead: list[Token] | None = None) -> tuple[dict[int, int], int, int]:
    """À chaque mot de notre texte (par son rang dans `ours`), la ligne qui le
    porte. Renvoie aussi le nombre de mots imprimés retrouvés, et leur total."""
    theirs: list[tuple[str, int]] = []
    raw: list[str] = []
    GAPS.clear()
    for k, line in enumerate(lines):
        theirs += [(norm(w), k) for w in line.words if norm(w)]
        raw += [w for w in line.words if norm(w)]
    a = [norm(t.text) for t in ours]
    b = [w for w, _ in theirs]
    line_of: dict[int, int] = {}
    taken_b: set[int] = set()

    ours_at: dict[int, int] = {}

    def take(i: int, j: int, n: int) -> None:
        for d in range(n):
            line_of[i + d] = theirs[j + d][1]
            taken_b.add(j + d)
            ours_at[j + d] = i + d

    for block in SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        take(block.a, block.b, block.size)
    # Le début de la page suivante, que la page imprime parfois en bas : on
    # ne le prend que par longues suites, pour ne rien lui voler au hasard.
    if ahead:
        base = len(a)
        a = a + [norm(t.text) for t in ahead]
        passes = [(size, 0 if size >= 8 else base) for size in sizes]
    else:
        base = len(a)
        passes = [(size, base) for size in sizes]
    # Ce que la page imprime dans un autre ordre que notre fichier : les
    # suites de mots restées seules des deux côtés, de la plus longue à la
    # plus courte.
    for size, limit in passes:
        free_a = [i for i in range(limit if limit < base else len(a)) if i not in line_of and a[i]] if limit < base \
            else [i for i in range(base) if i not in line_of and a[i]]
        if limit == 0:
            free_a = [i for i in range(len(a)) if i not in line_of and a[i]]
        index: dict[tuple[str, ...], list[int]] = defaultdict(list)
        for i in free_a:
            if all(i + d < len(a) and i + d not in line_of for d in range(size)):
                index[tuple(a[i: i + size])].append(i)
        j = 0
        while j + size <= len(b):
            key = tuple(b[j: j + size])
            if all(j + d not in taken_b for d in range(size)) and key in index:
                spot = next((i for i in index[key] if all(i + d not in line_of for d in range(size))), None)
                if spot is not None:
                    n = size
                    while spot + n < len(a) and j + n < len(b) and spot + n not in line_of and j + n not in taken_b \
                            and a[spot + n] == b[j + n]:
                        n += 1
                    take(spot, j, n)
                    j += n
                    continue
            j += 1
    EXACT.clear()
    EXACT.update(line_of)
    # Entre deux mots retrouvés qui se suivent des deux côtés, ce qui diffère
    # est une abréviation (« ר' » pour « רבי », « א"ל » pour « אמר ליה ») ou
    # un mot que la page n'imprime pas là (« גמ' ») : nos mots prennent la
    # ligne du mot imprimé qui leur répond, ou celle du mot qui suit.
    j = 0
    while j <= len(b):
        if j < len(b) and j in taken_b:
            j += 1
            continue
        end = j
        while end < len(b) and end not in taken_b:
            end += 1
        before = ours_at.get(j - 1, -1 if j == 0 else None)
        after = ours_at.get(end, len(a) if end == len(b) else None)
        if before is not None and after is not None and 0 < after - before - 1 <= 8 and end - j <= 8 \
                and b and all(i not in line_of for i in range(before + 1, after)):
            gap = list(range(before + 1, after))
            for n, i in enumerate(gap):
                if end > j:
                    at = j + n * (end - j) // len(gap)
                elif end < len(b):
                    at = end
                else:
                    at = len(b) - 1
                line_of[i] = theirs[at][1]
            if end > j and len({theirs[x][1] for x in range(j, end)}) == 1:
                GAPS.append((gap, raw[j:end], theirs[j][1]))
            taken_b.update(range(j, end))
        j = end + 1
    # Une ligne est sûre quand son premier et son dernier mot imprimés sont
    # retrouvés tels quels dans notre texte : ses deux bords ne doivent rien
    # à une supposition.
    bounds: dict[int, list[int]] = defaultdict(list)
    for j, (_, k) in enumerate(theirs):
        bounds[k].append(j)
    SURE.clear()
    SURE.update(k for k, js in bounds.items() if js[0] in taken_b and js[-1] in taken_b)
    FOUND.clear()
    FOUND.update({k: (sum(1 for j in js if j in taken_b), len(js)) for k, js in bounds.items()})
    return line_of, len(taken_b), len(b)


GAPS: list = []
"""Au dernier calage : les mots de notre texte qui répondent à d'autres mots
imprimés (une abréviation du livre), ces mots imprimés, et leur ligne."""
EXACT: set[int] = set()
"""Les mots de notre texte retrouvés tels quels sur la page au dernier calage."""
FOUND: dict[int, tuple[int, int]] = {}
"""Par ligne du dernier calage : ses mots retrouvés, sur combien."""
SURE: set[int] = set()
"""Les lignes sûres du dernier calage (voir match)."""


def fill(ours: list[Token], line_of: dict[int, int], count: int, limit: int = 12) -> None:
    """Les mots de notre texte que la page n'a pas à l'identique (une
    abréviation résolue, une variante) prennent la ligne de leurs voisins. Une
    longue suite sans voisin retrouvé reste hors de la page."""
    i = 0
    n = len(ours)
    while i < n:
        if i in line_of:
            i += 1
            continue
        j = i
        while j < n and j not in line_of:
            j += 1
        before = line_of.get(i - 1) if i and same_comment(ours, i - 1, i) else None
        after = line_of.get(j) if j < n and same_comment(ours, j - 1, j) else None
        if before is None and after is None or (j - i > limit and (before is None or after is None)):
            i = j
            continue
        if before is None:
            before = after
        if after is None or after < before:
            after = before
        for k in range(i, j):
            # De la ligne d'avant à la ligne d'après, au fil des mots.
            line_of[k] = before + round((after - before) * (k - i + 1) / (j - i + 1)) if after != before else before
        i = j
    del count


def same_comment(ours: list[Token], i: int, j: int) -> bool:
    return ours[i].unit == ours[j].unit and ours[i].passage == ours[j].passage


def runs_of(ours: list[Token], line_of: dict[int, int], count: int) -> list[list[tuple[int, int, int, int]]]:
    """Par ligne, les suites de mots de notre texte qu'elle porte."""
    per_line: list[list[int]] = [[] for _ in range(count)]
    for i, k in line_of.items():
        per_line[k].append(i)
    out = []
    for indexes in per_line:
        runs: list[tuple[int, int, int, int]] = []
        for i in sorted(indexes):
            t = ours[i]
            if runs and runs[-1][0] == t.unit and runs[-1][1] == t.passage and runs[-1][2] + runs[-1][3] == t.word:
                runs[-1] = (t.unit, t.passage, runs[-1][2], runs[-1][3] + 1)
            else:
                runs.append((t.unit, t.passage, t.word, 1))
        out.append(runs)
    return out


def place(ours: list[Token], lines: list[PrintedLine], ahead: list[Token] | None = None) -> Placed:
    line_of, matched, printed = match(ours, lines, ahead=ahead)
    sure = len(SURE)
    SURE_NOW = set(SURE)
    everything = ours + (ahead or [])
    found = dict(FOUND)
    text_of = {(t.unit, t.passage, t.word): t.text for t in everything}
    solid = set(line_of)
    fill(everything, line_of, len(lines))
    # Une ligne ne porte pas bien plus de lettres que le livre n'en imprime :
    # au-delà, les mots qu'elle n'a reçus que par voisinage (une variante de
    # notre texte, que la page n'écrit pas) la rendraient illisible. Ils en
    # sortent ; mieux vaut un mot absent qu'une ligne écrasée.
    # Un renvoi entre parenthèses où notre texte nomme le traité que le livre
    # sous-entend (« (לקמן בבא מציעא דף עט.) » pour « (לקמן דף עט.) ») : les
    # mots ajoutés ne sont pas sur la page, le renvoi y reste comme imprimé.
    exact = set(EXACT)
    i = 0
    while i < len(everything):
        if everything[i].text.startswith("("):
            j = i
            while j < len(everything) and j - i < 8 and ")" not in everything[j].text \
                    and same_comment(everything, i, min(j + 1, len(everything) - 1)):
                j += 1
            if j < len(everything) and ")" in everything[j].text and j > i + 1:
                span = range(i, j + 1)
                found_here = [k for k in span if k in exact]
                # Une source ajoutée par l'édition (« (דברים כ״ו:י״ב) »), que
                # le livre n'a pas du tout, se reconnaît à sa ponctuation.
                added = not found_here and any("״" in everything[k].text or "׳" in everything[k].text for k in span) \
                    and any(":" in everything[k].text for k in span)
                if 2 * len(found_here) >= len(span) or added:
                    for k in span:
                        if k not in exact:
                            line_of.pop(k, None)
                i = j
        i += 1
    letters = [len(norm(t.text)) for t in everything]
    room = [sum(len(norm(w)) for w in line.words) for line in lines]
    used = [0] * len(lines)
    for i, k in line_of.items():
        used[k] += letters[i]
    # D'abord entre voisines : un mot posé par voisinage au bord d'une ligne
    # trop pleine passe à la ligne d'à côté, si elle a la place.
    for _ in range(3):
        moved = False
        for k in range(len(lines)):
            if used[k] <= 1.2 * room[k] + 2:
                continue
            mine = sorted(i for i, at in line_of.items() if at == k)
            for edge, step in ((-1, 1), (0, -1)):
                while mine and used[k] > 1.2 * room[k] + 2:
                    i = mine[edge]
                    j = line_of.get(i + step)
                    if i in solid or j is None or j == k or not (0 <= i + step < len(everything)) \
                            or not same_comment(everything, min(i, i + step), max(i, i + step)) \
                            or used[j] + letters[i] > 1.1 * room[j] + 2:
                        break
                    line_of[i] = j
                    used[k] -= letters[i]
                    used[j] += letters[i]
                    mine.pop(edge)
                    moved = True
        if not moved:
            break
    # Ce qui reste de trop sort de la page.
    load: dict[int, list[int]] = defaultdict(list)
    for i, k in line_of.items():
        load[k].append(i)
    for k, mine in load.items():
        if used[k] > 1.35 * room[k] + 3:
            for i in sorted((i for i in mine if i not in solid), reverse=True):
                del line_of[i]
                used[k] -= letters[i]
                if used[k] <= 1.2 * room[k] + 3:
                    break
    # Ce qui reste trop chargé l'est par nos mots eux-mêmes : notre texte
    # écrit en toutes lettres ce que le livre abrège (« המע"ה »). Sur ces
    # lignes-là, et sur elles seules, la page écrit l'abréviation du livre.
    short: list[tuple[int, int, int, int, str]] = []
    for gap, printed_words, k in sorted(GAPS, key=lambda g: len(g[1]) - len(g[0])):
        if used[k] <= 1.2 * room[k] + 2 or len(gap) <= len(printed_words):
            continue
        if not any(mark in w for w in printed_words for mark in "\"'״׳"):
            continue
        first, last = everything[gap[0]], everything[gap[-1]]
        if any(line_of.get(i) != k for i in gap) or not same_comment(everything, gap[0], gap[-1]) \
                or last.word - first.word != len(gap) - 1:
            continue
        text = " ".join(printed_words)
        saved = sum(letters[i] for i in gap) - len(norm(text))
        if saved <= 0:
            continue
        short.append((first.unit, first.passage, first.word, len(gap), text))
        used[k] -= saved
    runs = runs_of(everything, line_of, len(lines))
    # Une ligne dont aucun mot imprimé n'est des nôtres (un titre de colonne,
    # « רבינו חננאל ») n'a reçu de mots que par voisinage : ils sont à la
    # ligne d'à côté, la suivante de préférence.
    for k in range(len(lines)):
        if runs[k] and found.get(k, (0, 0))[0] == 0 and found.get(k, (0, 0))[1] >= 2:
            after = next((j for j in range(k + 1, min(len(lines), k + 4)) if found.get(j, (0, 0))[0]), None)
            before = next((j for j in range(k - 1, max(-1, k - 4), -1) if found.get(j, (0, 0))[0]), None)
            if after is not None:
                runs[after] = runs[k] + runs[after]
            elif before is not None:
                runs[before] = runs[before] + runs[k]
            else:
                continue
            runs[k] = []
    # Ce que valent les lignes qui portent nos mots : une ligne sans aucun
    # des nôtres est d'un commentaire que nous n'avons pas, elle ne s'écrit pas.
    matched = sum(found.get(k, (0, 0))[0] for k in range(len(lines)) if runs[k])
    printed = sum(found.get(k, (0, 0))[1] for k in range(len(lines)) if runs[k])
    longest = sum(max(found.get(k, (0, 0))[1], sum(n for _, _, _, n in runs[k]))
                  for k in range(len(lines)) if runs[k])
    tight = sum(1 for k in range(len(lines)) if runs[k] and used[k] > 1.3 * room[k] + 3)
    return Placed(lines, runs, matched, printed, sure, tight, matched / max(1, longest),
                  {id(lines[k]) for k in SURE_NOW}, short)


def side_tokens(tractate: Tractate, zone: str, amud: int) -> list[Token]:
    """Les commentaires de l'amoud et de celui d'avant : un commentaire
    commencé à la page d'avant finit sur celle-ci, et Sefaria le range là où
    il commence."""
    out: list[Token] = []
    for a in (amud - 1, amud):
        if 0 <= a < len(tractate):
            out += tractate.tokens(zone, a)
    return out


def grams(words: list[str]) -> set[tuple[str, ...]]:
    return {tuple(words[i: i + 3]) for i in range(len(words) - 2)}


def foreign(lines: list[PrintedLine], known: dict[str, set]) -> set[int]:
    """Les lignes d'un commentaire que nous n'avons pas, composé comme les
    nôtres (le Rachbam de Pessa'him, la Chita Mekoubétset de Zeva'him) : dans
    une même colonne (les lignes au même bord droit), une suite de lignes
    dont presque aucune suite de mots n'est dans nos textes. Renvoie leurs
    identités."""
    streams: dict[int, list[PrintedLine]] = defaultdict(list)
    for line in sorted(lines, key=lambda l: l.right):
        near = next((key for key in streams if abs(key - line.right) <= 3), line.right)
        streams[near].append(line)
    out: set[int] = set()
    for stream in streams.values():
        stream.sort(key=lambda l: l.top)
        mine = [grams([norm(w) for w in line.words if norm(w)]) for line in stream]
        hits = [sum(1 for g in own if g in known["rashi"] or g in known["tosafot"]) for own in mine]
        for k, line in enumerate(stream):
            lo, hi = max(0, k - 4), min(len(stream), k + 5)
            total = sum(len(own) for own in mine[lo:hi]) - len(mine[k])
            around = sum(hits[lo:hi]) - hits[k]
            # Une suite de quatre mots peut se retrouver par hasard dans un autre commentaire.
            if total >= 20 and around < 0.1 * total and hits[k] < 0.5 * max(1, len(mine[k])):
                out.add(id(line))
    return out


WHY: dict[int, str] = {}
"""Pourquoi une page n'a pas de lignes (voir page_layout)."""


SHIFT: dict[str, int] = {}
"""Le décalage des pages d'un traité. La source numérote ses pages à la
suite ; là où nos fichiers comptent un amoud qu'elle n'a pas (ou l'inverse),
la page d'un amoud est une ou deux plus loin. On le voit à ce que la page
n'écrit pas notre guemara, et l'on cherche à côté."""


def page_layout(tractate: Tractate, amud: int, taken: dict[str, set]) -> tuple[dict, dict] | None:
    """Le fichier d'une page, et ce que vaut son calage."""
    base = SHIFT.get(tractate.slug, 0)
    for shift in (base, base + 1, base - 1, base + 2, base - 2):
        if not 0 <= amud + shift:
            continue
        got = page_at(tractate, amud, pdf_path(tractate.slug, amud + shift), taken)
        if got is not None:
            SHIFT[tractate.slug] = shift
            return got
        if amud in WHY:
            return None
    WHY[amud] = "la page n'écrit pas notre guemara"
    return None


def page_at(tractate: Tractate, amud: int, pdf: str, taken: dict[str, set]) -> tuple[dict, dict] | None:
    if not os.path.exists(pdf):
        return None
    ours_main = tractate.tokens("main", amud)
    free = {zone: [t for t in side_tokens(tractate, zone, amud) if (t.unit, t.passage, t.word) not in taken[zone]]
            for zone in ("rashi", "tosafot")}
    # « הדרן עלך … » que nos commentaires répètent à la fin d'un chapitre : le
    # livre ne l'écrit que dans la guemara. Ces mots sont tenus pour posés.
    for zone in free:
        k = 0
        while k < len(free[zone]):
            if norm(free[zone][k].text) == norm("הדרן") and k + 1 < len(free[zone]) \
                    and norm(free[zone][k + 1].text) == norm("עלך"):
                end = k + 2
                while end < len(free[zone]) and end - k < 9 and same_comment(free[zone], k, end) \
                        and not free[zone][end - 1].text.endswith(":"):
                    end += 1
                taken[zone].update((t.unit, t.passage, t.word) for t in free[zone][k:end])
                del free[zone][k:end]
            else:
                k += 1
    ahead = {zone: tractate.tokens(zone, amud + 1) if amud + 1 < len(tractate) else [] for zone in free}
    # Ce que les pages d'avant n'ont pas imprimé : le livre met parfois un
    # commentaire quelques pages après l'endroit où notre fichier le range.
    # Comme le début de la page suivante, on ne le prend que par longues suites.
    for zone in free:
        for a in range(max(0, amud - 6), amud - 1):
            ahead[zone] = ahead[zone] + [t for t in tractate.tokens(zone, a)
                                         if (t.unit, t.passage, t.word) not in taken[zone]]
    texts = {zone: [norm(t.text) for t in free[zone] + ahead[zone] if norm(t.text)] for zone in free}
    texts["main"] = [norm(t.text) for t in ours_main if norm(t.text)]
    known = {zone: grams(words) for zone, words in texts.items()}
    vocabulary = {zone: set(words) for zone, words in texts.items()}
    # Les premiers mots de nos commentaires : ce qu'écrit une police de dibbour.
    openings: dict[str, set] = {"rashi": set(), "tosafot": set()}
    for zone in openings:
        previous = None
        for t in free[zone] + ahead[zone]:
            if (t.unit, t.passage) != previous or t.word < 4:
                openings[zone].add(norm(t.text))
            previous = (t.unit, t.passage)
    printed = printed_page(pdf, known, vocabulary, openings)
    if printed is None:
        return None
    if UNSURE[0] >= 4:
        WHY[amud] = f"places peu sûres : {UNSURE[0]} mots l'un sur l'autre"
        return None
    main = place(ours_main, printed.main)
    # À qui est une ligne de commentaire. La police de son dibbour hamat'hil
    # le dit quand elle en ouvre un (sur certaines pages Rachi tient les deux
    # côtés) ; sinon ses mots, comparés aux deux textes ; sinon la ligne
    # d'avant dans sa colonne.
    columns: dict[str, list[PrintedLine]] = {"rashi": [], "tosafot": []}
    others = foreign(printed.right + printed.left + printed.wide, known)
    for stream in (printed.right, printed.left, printed.wide):
        stream = sorted((l for l in stream if id(l) not in others), key=lambda l: l.top)
        owners: list[str] = []
        for line in stream:
            mine = grams([norm(w) for w in line.words if norm(w)])
            hits = {zone: len(mine & known[zone]) for zone in ("rashi", "tosafot")}
            best = max(hits, key=lambda zone: hits[zone])
            other = min(hits.values())
            if line.owner:
                owners.append(line.owner)
            elif hits[best] >= 2 and hits[best] > 2 * other or (hits[best] == 1 and other == 0 and len(mine) <= 2):
                owners.append(best)
            else:
                owners.append("")
        # Les lignes sans avis prennent celui de leur voisine.
        for k in range(len(stream)):
            if not owners[k] and k:
                owners[k] = owners[k - 1]
        for k in range(len(stream) - 2, -1, -1):
            if not owners[k]:
                owners[k] = owners[k + 1]
        for line, owner in zip(stream, owners):
            columns[owner or "rashi"].append(line)
    placed = {"main": main}
    for zone in ("rashi", "tosafot"):
        lines = sorted(columns[zone], key=lambda l: (l.top, -l.right))
        for line in lines:
            line.zone = zone
        placed[zone] = place(free[zone], lines, ahead[zone])
        for runs in placed[zone].runs:
            for a, p, w, n in runs:
                taken[zone].update((a, p, w + d) for d in range(n))
    # Une page ne s'écrit ligne pour ligne que si elle est bien calée : la
    # guemara presque toute aux bords sûrs, et de chaque commentaire la plus
    # grande part de ce qui est imprimé. Sinon elle se compose à notre façon, entière.
    if main.sure < 0.85 * max(1, len(main.lines)):
        WHY[amud] = f"guemara {main.sure}/{len(main.lines)}"
        return None
    on_page = sum(n for runs in main.runs for _, _, _, n in runs)
    if on_page < 0.95 * len(ours_main):
        WHY[amud] = f"guemara : {on_page} mots sur {len(ours_main)}"
        return None
    for zone in ("rashi", "tosafot"):
        if placed[zone].printed >= 40 and placed[zone].matched < 0.6 * placed[zone].printed:
            WHY[amud] = f"{zone} {placed[zone].matched}/{placed[zone].printed}"
            return None
    # La page : ce qu'on en écrit. Un commentaire que nous n'avons pas,
    # composé comme Rachi, n'a aucun de nos mots : ses lignes ne sont pas de la page.
    kept = {zone: [(l, runs) for l, runs in zip(placed[zone].lines, placed[zone].runs)]
            for zone in ("main", "rashi", "tosafot")}
    # Une ligne coupée en deux par un blanc pris pour une gouttière : ses deux
    # morceaux se suivent dans notre texte, sur la même rangée. On les recolle.
    order = {"main": {(t.unit, t.passage, t.word): k for k, t in enumerate(ours_main)}}
    said = {"main": [norm(t.text) for t in ours_main]}
    for zone in ("rashi", "tosafot"):
        every_token = side_tokens(tractate, zone, amud) + ahead[zone]
        order[zone] = {(t.unit, t.passage, t.word): k for k, t in enumerate(every_token)}
        said[zone] = [norm(t.text) for t in every_token]
    for zone, pairs in kept.items():
        reach = 1.5 * printed.sizes["main" if zone == "main" else "side"]
        # Les morceaux rangée par rangée, de droite à gauche.
        pairs.sort(key=lambda pair: pair[0].top + pair[0].bottom)
        row, first = 0, None
        ranked = []
        for pair in pairs:
            middle = (pair[0].top + pair[0].bottom) / 2
            if first is None or middle - first > 0.2 * reach:
                row, first = row + 1, middle
            ranked.append((row, -pair[0].right, pair))
        ranked.sort(key=lambda item: item[:2])

        def nearby(runs: list) -> set:
            """Les mots de notre texte autour de ceux d'une ligne."""
            spots = [order[zone].get((a, p, w + d)) for a, p, w, n in runs for d in (0, n - 1)]
            spots = [k for k in spots if k is not None]
            return set(said[zone][max(0, min(spots) - 8): max(spots) + 9]) if spots else set()

        joined: list[tuple[int, PrintedLine, list]] = []
        for rank, _, (line, runs) in ranked:
            if joined and joined[-1][0] == rank:
                _, last, before = joined[-1]
                gap = last.left - line.right
                together = False
                if before and runs:
                    a, p, w, n = before[-1]
                    end = order[zone].get((a, p, w + n - 1))
                    start = order[zone].get(tuple(runs[0][:3]))
                    together = -reach < gap < 3 * reach and end is not None and start is not None \
                        and 0 < start - end <= 8
                elif (before or runs) and -reach < gap < reach:
                    # Un morceau resté sans nos mots (ils sont allés à son
                    # voisin) : il est de la ligne si ses mots sont de ce passage.
                    empty = line if before else last
                    words = [norm(w) for w in empty.words if len(norm(w)) > 1]
                    around = nearby(before or runs)
                    together = bool(words) and sum(1 for w in words if w in around) >= 0.6 * len(words)
                if together:
                    merged = PrintedLine(last.words + line.words, last.lead + line.lead, last.owner or line.owner,
                                         min(line.left, last.left), max(last.right, line.right),
                                         min(last.top, line.top), max(last.bottom, line.bottom), zone)
                    if before and runs:
                        a, p, w, n = before[-1]
                        if (a, p, w + n) == tuple(runs[0][:3]):
                            runs = before[:-1] + [(a, p, w, n + runs[0][3])] + list(runs[1:])
                        else:
                            runs = before + list(runs)
                        if id(last) in placed[zone].safe and id(line) in placed[zone].safe:
                            placed[zone].safe.add(id(merged))
                    else:
                        runs = list(before or runs)
                    joined[-1] = (rank, merged, runs)
                    continue
            joined.append((rank, line, list(runs)))
        joined = [(line, runs) for _, line, runs in joined if runs]
        kept[zone] = sorted(joined, key=lambda pair: (pair[0].top, -pair[0].right))
    initials = initial_words(pdf, printed.sizes["main"], ours_main, kept["main"])
    closing = closing_lines(printed.sizes["main"], ours_main, kept["main"])
    kept["main"] = [(l, runs) for l, runs in kept["main"] if runs]
    every = [l for zone in ("main", "rashi", "tosafot") for l, _ in kept[zone]]
    if not every:
        return None
    x0, y0 = min(l.left for l in every), int(min(l.top for l in every))
    x1, y1 = max(l.right for l in every), int(max(l.bottom for l in every))
    # Le mot d'ouverture et la clôture sont de la page : elle va jusqu'à eux.
    for _, top, _, bottom, *_ in initials + closing:
        y0, y1 = min(y0, int(top)), max(y1, int(bottom) + 1)
    scale = UNITS / (x1 - x0)
    # La boîte d'une ligne : son bord gauche, le milieu de sa hauteur, sa largeur.
    box = lambda l: [round((l.left - x0) * scale), round(((l.top + l.bottom) / 2 - y0) * scale),  # noqa: E731
                     round((l.right - l.left) * scale)]

    def pitch(lines: list[PrintedLine]) -> int:
        """L'interligne d'une zone : l'écart le plus fréquent entre deux lignes."""
        # D'une ligne à celle qui la suit dans sa colonne : deux colonnes
        # voisines ne sont pas toujours à la même hauteur.
        order = sorted(lines, key=lambda l: l.top)
        steps: Counter = Counter()
        for k, a in enumerate(order):
            for b in order[k + 1: k + 12]:
                if b.top - a.top > 4 and min(a.right, b.right) - max(a.left, b.left) > 0:
                    if b.top - a.top < 60:
                        steps[round(b.top - a.top)] += 1
                    break
        return round(steps.most_common(1)[0][0] * scale) if steps else 0

    page: dict = {
        "height": round((y1 - y0) * scale),
        "pitch": [pitch(printed.main), pitch(printed.right + printed.left + printed.wide)],
        "main": [box(l) + [[p, w, n] for _, p, w, n in runs] for l, runs in kept["main"]],
    }
    bold = big_words(printed.sizes["main"], ours_main, kept["main"])
    if bold:
        page["big"] = bold
    if closing:
        page["closing"] = [[round((a - x0) * scale), round(((t + b) / 2 - y0) * scale), round((c - a) * scale),
                            round((b - t) * scale), p, w, n] for a, t, c, b, p, w, n in closing]
    # Les abréviations du livre, là où nos mots en toutes lettres ne tiennent
    # pas : par zone (0 la guemara, 1 Rachi, 2 Tossafot), la place de nos
    # mots et ce que le livre écrit.
    brief = [[z, p, w, n, text] if a == amud else [z, p, w, n, text, a]
             for z, zone in enumerate(("main", "rashi", "tosafot"))
             for a, p, w, n, text in placed[zone].short]
    if brief:
        page["short"] = brief
    if initials:
        # Le mot d'ouverture : sa boîte (bord gauche, milieu, largeur, hauteur) et sa place.
        page["initial"] = [
            [round((a - x0) * scale), round(((t + b) / 2 - y0) * scale), round((c - a) * scale),
             round((b - t) * scale), p, w, n]
            for a, t, c, b, p, w, n in initials
        ]
    for zone in ("rashi", "tosafot"):
        page[zone] = [
            box(l) + [[p, w, n] if a == amud else [p, w, n, a] for a, p, w, n in runs]
            for l, runs in kept[zone]
        ]
    # Ce que notre fichier porte et que la page n'a pas.
    report = {"amud": amud}
    for zone, ours in (("main", ours_main), ("rashi", tractate.tokens("rashi", amud)),
                       ("tosafot", tractate.tokens("tosafot", amud))):
        report[zone] = {
            "lines": len(kept[zone]),
            "empty": sum(1 for l, runs in zip(placed[zone].lines, placed[zone].runs) if not runs and len(l.words) > 3),
            "printed": placed[zone].printed,
            "matched": placed[zone].matched,
            "sure": sum(1 for l, _ in kept[zone] if id(l) in placed[zone].safe),
            "ours": len(ours),
            "tight": placed[zone].tight,
        }
    faults = ink_faults(pdf, every)
    LINES[:] = list(zip(every, faults))
    # Le second témoin : si l'encre dément trop de boîtes, la page n'est pas sûre.
    if sum(1 for f in faults if f) > max(4, 0.06 * len(every)):
        WHY[amud] = f"encre : {sum(1 for f in faults if f)} lignes sur {len(every)}"
        return None
    report["ink"] = {zone: [sum(1 for l, f in zip(every, faults) if f and l.zone == zone),
                            sum(1 for l in every if l.zone == zone)] for zone in ("main", "rashi", "tosafot")}
    if os.environ.get("PJ_DEBUG"):
        for l, f in zip(every, faults):
            if f:
                print("  encre", l.zone, f, l.left, l.right, int(l.top), int(l.bottom), " ".join(l.words)[:60])
    return page, report


def run(slug: str, only: int | None = None) -> tuple[list[dict | None], list[dict]]:
    tractate = Tractate(slug)
    taken: dict[str, set] = {"rashi": set(), "tosafot": set()}
    pages: list[dict | None] = []
    reports = []
    for amud in range(len(tractate)):
        if only is not None and abs(amud - only) > 0 and amud != only:
            pages.append(None)
            continue
        got = page_layout(tractate, amud, taken)
        pages.append(got[0] if got else None)
        if got:
            reports.append(got[1])
    # Un commentaire que nous avons et que ni sa page ni ses voisines
    # n'impriment (les Tossafot de Horayot) : la page ligne pour ligne le
    # ferait disparaître, elle se compose donc à notre façon. Un commentaire
    # que notre fichier range deux fois (sous deux passages) n'est imprimé
    # qu'une fois : sa seconde copie ne manque pas.
    if only is None:
        for zone in ("rashi", "tosafot"):
            tokens = [tractate.tokens(zone, amud) for amud in range(len(tractate))]
            placed = [" ".join(norm(t.text) for t in own if (t.unit, t.passage, t.word) in taken[zone]) for own in tokens]
            for amud, own in enumerate(tokens):
                if not pages[amud] or len(own) < 40:
                    continue
                near = " ".join(placed[max(0, amud - 1): amud + 2]).split()
                around = {tuple(near[k: k + 6]) for k in range(len(near) - 5)}
                missing = 0
                run: list[str] = []
                for t in own + [None]:
                    if t is not None and (t.unit, t.passage, t.word) not in taken[zone]:
                        run.append(norm(t.text))
                        continue
                    words = [w for w in run if w]
                    six = [tuple(words[k: k + 6]) for k in range(len(words) - 5)]
                    if words and not (len(six) >= 3 and sum(1 for g in six if g in around) >= 0.7 * len(six)):
                        missing += len(run)
                    run = []
                # Jusqu'à deux mots sur cinq : notre texte porte parfois une
                # addition entre crochets que le livre n'imprime pas, et la
                # page reste celle du livre. Au-delà, c'est le commentaire
                # lui-même qui n'est pas sur la page.
                if missing > 0.4 * len(own):
                    pages[amud] = None
                    WHY[amud] = f"{zone} : {missing} mots sur {len(own)} ne sont pas sur la page"
        reports = [r for r in reports if pages[r["amud"]]]
    return pages, reports


def placed_words(tractate: Tractate, pages: list[dict | None]) -> dict[str, tuple[int, int]]:
    """Par zone : combien de nos mots sont sur une ligne, sur combien."""
    out = {}
    for zone in ("main", "rashi", "tosafot"):
        seen: set = set()
        for amud, page in enumerate(pages):
            for line in (page or {}).get(zone, []):
                for run in line[3:]:
                    a = run[3] if len(run) > 3 else amud
                    seen.update((a, run[0], run[1] + d) for d in range(run[2]))
        total = sum(len(tractate.tokens(zone, a)) for a, page in enumerate(pages) if page)
        out[zone] = (len(seen), total)
    return out


def amud_name(amud: int) -> str:
    return f"{amud // 2 + 2}{'ab'[amud % 2]}"


def parse_amud(name: str) -> int:
    return (int(name[:-1]) - 2) * 2 + "ab".index(name[-1])


def write(slug: str, pages: list[dict | None]) -> None:
    out = os.path.join(TEXTS, "talmud-layout", slug)
    os.makedirs(out, exist_ok=True)
    for name in os.listdir(out):
        os.remove(os.path.join(out, name))
    # Un traité dont presque aucune page ne passe (les mots du PDF n'y sont pas
    # à leur place) ne s'écrit pas : quelques pages du livre perdues parmi les
    # nôtres ne font pas un traité.
    if sum(1 for p in pages if p) < FLOOR * len(pages):
        os.rmdir(out)
        return
    for n in range(0, len(pages), CHUNK):
        part = pages[n: n + CHUNK]
        if not any(part):
            continue
        with open(os.path.join(out, f"{n // CHUNK}.json"), "w", encoding="utf8") as f:
            json.dump({"edition": EDITION, "from": n, "pages": part}, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("tractate", help="le traité (public/texts/talmud), ou « all »")
    parser.add_argument("--fetch", action="store_true", help="télécharge les pages qui manquent au cache")
    parser.add_argument("--check", action="store_true", help="dit ce que vaut le calage")
    parser.add_argument("--write", action="store_true", help="écrit public/texts/talmud-layout")
    args = parser.parse_args()
    slugs = sorted(sources()["tractates"]) if args.tractate == "all" else [args.tractate]
    for slug in slugs:
        tractate = Tractate(slug)
        if args.fetch:
            fetch(slug, len(tractate))
        pages, reports = run(slug)
        words = placed_words(tractate, pages)
        got = sum(1 for p in pages if p)
        print(f"{slug} : {got} pages sur {len(pages)}")
        for zone in ("main", "rashi", "tosafot"):
            lines = sum(r[zone]["lines"] for r in reports)
            empty = sum(r[zone]["empty"] for r in reports)
            printed = sum(r[zone]["printed"] for r in reports)
            matched = sum(r[zone]["matched"] for r in reports)
            on, total = words[zone]
            sure = sum(r[zone]["sure"] for r in reports)
            print(f"  {zone:8s} lignes aux deux bords sûrs : {sure}/{lines} ({100 * sure / max(1, lines):.1f} %)")
            print(f"  {zone:8s} {lines:5d} lignes, {empty:3d} vides ; mots imprimés retrouvés {matched}/{printed} "
                  f"({100 * matched / max(1, printed):.1f} %) ; nos mots sur une ligne {on}/{total} "
                  f"({100 * on / max(1, total):.1f} %)")
        if args.check:
            ink = {zone: [sum(r["ink"][zone][k] for r in reports) for k in (0, 1)] for zone in ("main", "rashi", "tosafot")}
            print("  encre :", ", ".join(f"{zone} {a}/{b}" for zone, (a, b) in ink.items()))
            print("  lignes trop chargées :", ", ".join(
                f"{zone} {sum(r[zone]['tight'] for r in reports)}" for zone in ("main", "rashi", "tosafot")))
            for amud in sorted(WHY):
                print("   sans lignes", amud_name(amud), ":", WHY[amud])
            WHY.clear()
            worst = sorted(reports, key=lambda r: min(r[z]["matched"] / max(1, r[z]["printed"]) for z in ("main", "rashi", "tosafot")))
            for r in worst[:8]:
                print("   ", amud_name(r["amud"]), {z: f"{r[z]['matched']}/{r[z]['printed']}" for z in ("main", "rashi", "tosafot")})
        if args.write:
            write(slug, pages)


if __name__ == "__main__":
    main()
