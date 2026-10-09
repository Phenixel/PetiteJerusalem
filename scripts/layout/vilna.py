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
    spans = [
        (int(m[2]), int(m[1]), int(m[3]), int(m[4])) + fonts[m[5]]
        for m in re.finditer(r'<text top="(-?\d+)" left="(-?\d+)" width="(\d+)" height="(\d+)" font="(\d+)">', xml)
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
        text = decode(html.unescape(m[5]))
        if not text.strip():
            continue
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        best = None
        for span in bands.get(int(cy) // 20, []):
            left, top, width, height, font_size, family = span
            if left - 1 <= cx <= left + width + 1 and top - 2 <= cy <= top + height + 2:
                gap = abs(top + height / 2 - cy)
                if best is None or gap < best[0]:
                    best = (gap, font_size, family, top, height)
        if best is None:
            continue
        # La hauteur vient du morceau : celle du mot, dans certaines polices,
        # déborde de sa ligne et la brouille avec ses voisines.
        words.append(Chunk(text, best[2], best[1], round(x0), best[3], round(x1 - x0), best[4]))
    return words


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


def rows_of(chunks: list[Chunk], tolerance: float) -> list[list[Chunk]]:
    """Les mots rangés par ligne de la page. Les mots du corps (la taille la
    plus fréquente) font les rangées ; un dibbour ou un renvoi, d'un autre
    corps, rejoint la rangée dont le milieu est le plus proche du sien."""
    if not chunks:
        return []
    body = Counter(c.size for c in chunks).most_common(1)[0][0]
    rows: list[list[Chunk]] = []
    for chunk in sorted((c for c in chunks if c.size == body), key=lambda c: c.middle):
        if rows and abs(rows[-1][0].middle - chunk.middle) <= tolerance:
            rows[-1].append(chunk)
        else:
            rows.append([chunk])
    spans = [(min(c.top for c in row), max(c.top + c.height for c in row)) for row in rows]
    for chunk in chunks:
        if chunk.size == body:
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


Key = tuple[str, int]
UNSURE = [0]
"""Les mots posés l'un sur l'autre dans les commentaires de la dernière page lue."""
FLOOR = 0.3
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
                   key=lambda letter: sum(1 for w in with_it if w.replace(ch, letter) in every_word))
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
    # Une seule police écrit la guemara : celle qui lui ressemble le plus. Un
    # commentaire des marges qui la cite beaucoup (Rabbénou 'Hananel) n'en est pas.
    mains = [key for key, role in roles.items() if role == "main"]
    if mains:
        chosen = max(mains, key=lambda key: strength[key])
        for key in mains:
            if key != chosen:
                del roles[key]
    main = [c for key, own in fonts.items() if roles.get(key) == "main" for c in own]
    body = [c for key, own in fonts.items() if roles.get(key) == "side" for c in own]
    if not main:
        return None
    main_size = Counter(c.size for c in main).most_common(1)[0][0]
    side_size = Counter(c.size for c in body).most_common(1)[0][0] if body else main_size
    side = body[:]
    lead_fonts: dict[Key, str] = {}
    if body:
        lo, hi = min(c.left for c in body), max(c.right for c in body)
        low, high = min(c.top for c in body) - 6, max(c.top + c.height for c in body) + 6
        everything = vocabulary["rashi"] | vocabulary["tosafot"]
        for key, own in fonts.items():
            if key in roles or not 0.55 * side_size <= key[1] <= 1.7 * side_size:
                continue
            inside = [c for c in own if lo - 2 <= c.left and c.right <= hi + 2 and low <= c.middle <= high
                      and not re.fullmatch(r"[(\[]?[א-ת][)\]]?", c.text.strip())]
            words = [norm(c.text) for c in inside if norm(c.text)]
            if len(inside) < 0.6 * len(own) or not words:
                continue
            if sum(1 for w in words if w in everything) < 0.6 * len(words):
                continue
            side += inside
            # Un dibbour est du corps de la ligne ou plus grand ; un renvoi, plus petit.
            if key[1] >= 0.9 * side_size:
                hits = {zone: sum(1 for w in words if w in openings[zone]) for zone in openings}
                lead_fonts[key] = max(hits, key=lambda zone: hits[zone]) if len(set(hits.values())) > 1 else ""
    LEADS = lead_fonts

    def lines(chunks: list[Chunk], tolerance: float, columns: bool) -> list[PrintedLine]:
        rows = [sorted(row, key=lambda c: -c.right) for row in rows_of(chunks, tolerance)]
        # Les blancs de chaque rangée, plus larges qu'une espace ordinaire.
        blanks = [
            [(b.right, a.left) for a, b in zip(row, row[1:]) if a.left - b.right > side_size * 0.4]
            for row in rows
        ]

        def gutter(i: int, lo: float, hi: float) -> bool:
            """Un blanc entre deux colonnes se retrouve, au même endroit, sur
            les rangées voisines ; un blanc de justification, non."""
            if hi - lo > side_size * 1.6:
                return True
            seen = 0
            for j in (i - 2, i - 1, i + 1, i + 2):
                if 0 <= j < len(rows) and any(min(hi, b) - max(lo, a) >= side_size * 0.3 for a, b in blanks[j]):
                    seen += 1
            return seen >= 2

        out = []
        for i, row in enumerate(rows):
            groups = [[row[0]]]
            for chunk in row[1:]:
                last = groups[-1][-1]
                if columns and last.left - chunk.right > side_size * 0.4 and gutter(i, chunk.right, last.left):
                    groups.append([chunk])
                else:
                    groups[-1].append(chunk)
            for group in groups:
                words, lead = words_of(group, LEADS)
                owner = next((LEADS[(c.family, c.size)] for c in sorted(group, key=lambda c: -c.right)
                              if LEADS.get((c.family, c.size))), "")
                if any(norm(w) for w in words):
                    out.append(PrintedLine(words, lead, owner, min(c.left for c in group), max(c.right for c in group),
                                           min(c.top for c in group), max(c.top + c.height for c in group)))
        # Dans certaines polices sans nom, des mots sortent du PDF à une
        # fausse place, sur leurs voisins : les boîtes des lignes ne sont
        # alors plus sûres, et la page le dit (voir page_at).
        if columns:
            UNSURE[0] = sum(
                1 for row in rows for a, b in zip(row, row[1:])
                if min(a.right, b.right) - max(a.left, b.left) > 0.5 * min(a.width, b.width) > 0
            )
        return out

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


def match(ours: list[Token], lines: list[PrintedLine], sizes: tuple[int, ...] = (8, 5, 4),
          ahead: list[Token] | None = None) -> tuple[dict[int, int], int, int]:
    """À chaque mot de notre texte (par son rang dans `ours`), la ligne qui le
    porte. Renvoie aussi le nombre de mots imprimés retrouvés, et leur total."""
    theirs: list[tuple[str, int]] = []
    for k, line in enumerate(lines):
        theirs += [(norm(w), k) for w in line.words if norm(w)]
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
    return line_of, len(taken_b), len(b)


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
    everything = ours + (ahead or [])
    fill(everything, line_of, len(lines))
    return Placed(lines, runs_of(everything, line_of, len(lines)), matched, printed, sure)


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
    return None


def page_at(tractate: Tractate, amud: int, pdf: str, taken: dict[str, set]) -> tuple[dict, dict] | None:
    if not os.path.exists(pdf):
        return None
    ours_main = tractate.tokens("main", amud)
    free = {zone: [t for t in side_tokens(tractate, zone, amud) if (t.unit, t.passage, t.word) not in taken[zone]]
            for zone in ("rashi", "tosafot")}
    ahead = {zone: tractate.tokens(zone, amud + 1) if amud + 1 < len(tractate) else [] for zone in free}
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
    for stream in (printed.right, printed.left, printed.wide):
        stream = sorted(stream, key=lambda l: l.top)
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
        # Un commentaire que nous avons et que la page n'imprime pas là (les
        # Tossafot de Horayot) : la page ligne pour ligne le ferait disparaître.
        ours = len(tractate.tokens(zone, amud))
        here = sum(n for runs in placed[zone].runs for a, _, _, n in runs if a == amud)
        if ours >= 40 and here < 0.3 * ours:
            WHY[amud] = f"{zone} : {here} mots sur {ours}"
            return None
    # La page : ce qu'on en écrit. Un commentaire que nous n'avons pas (le Ran,
    # Rabbénou Guerchom), composé comme Rachi, n'a aucun de nos mots : ses
    # lignes ne sont pas de la page.
    kept = {zone: [(l, runs) for l, runs in zip(placed[zone].lines, placed[zone].runs) if runs]
            for zone in ("main", "rashi", "tosafot")}
    every = [l for zone in kept for l, _ in kept[zone]]
    if not every:
        return None
    x0, y0 = min(l.left for l in every), int(min(l.top for l in every))
    x1, y1 = max(l.right for l in every), int(max(l.bottom for l in every))
    scale = UNITS / (x1 - x0)
    # La boîte d'une ligne : son bord gauche, le milieu de sa hauteur, sa largeur.
    box = lambda l: [round((l.left - x0) * scale), round(((l.top + l.bottom) / 2 - y0) * scale),  # noqa: E731
                     round((l.right - l.left) * scale)]

    def pitch(lines: list[PrintedLine]) -> int:
        """L'interligne d'une zone : l'écart le plus fréquent entre deux lignes."""
        tops = sorted({round(l.top) for l in lines})
        steps = Counter(b - a for a, b in zip(tops, tops[1:]) if 4 < b - a < 60)
        return round(steps.most_common(1)[0][0] * scale) if steps else 0

    page: dict = {
        "height": round((y1 - y0) * scale),
        "pitch": [pitch(printed.main), pitch(printed.right + printed.left + printed.wide)],
        "main": [box(l) + [[p, w, n] for _, p, w, n in runs] for l, runs in kept["main"]],
    }
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
            "sure": placed[zone].sure,
            "ours": len(ours),
        }
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
            worst = sorted(reports, key=lambda r: min(r[z]["matched"] / max(1, r[z]["printed"]) for z in ("main", "rashi", "tosafot")))
            for r in worst[:8]:
                print("   ", amud_name(r["amud"]), {z: f"{r[z]['matched']}/{r[z]['printed']}" for z in ("main", "rashi", "tosafot")})
        if args.write:
            write(slug, pages)


if __name__ == "__main__":
    main()
