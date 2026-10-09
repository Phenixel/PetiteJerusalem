"""La page de Vilna, ligne pour ligne, lue dans des pages composées.

    python3 scripts/layout/vilna.py beitzah --fetch          # télécharge les pages
    python3 scripts/layout/vilna.py beitzah --check          # dit ce que vaut le calage
    python3 scripts/layout/vilna.py beitzah --write          # écrit public/texts/talmud-layout
    python3 scripts/layout/vilna.py beitzah --amud 3a --dump # une page, ligne par ligne

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
    Le noun de la police de la guemara sort en caractère de contrôle (0x13).
    Le texte est dans l'ordre de l'œil (de gauche à droite) : on le retourne."""
    out = []
    for ch in raw:
        if "א" <= ch <= "ת":
            out.append(ch)
            continue
        if ch == "\x13":
            out.append("נ")
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
                    best = (gap, font_size, family)
        if best is None:
            continue
        words.append(Chunk(text, best[2], best[1], round(x0), round(y0), round(x1 - x0), round(y1 - y0)))
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


def words_of(chunks: list[Chunk], lead_fonts: tuple[str, ...]) -> tuple[list[str], list[bool]]:
    """Les mots d'une ligne, de droite à gauche. Deux mots qui se touchent
    n'en font qu'un (un point composé à part, une lettre d'une autre police)."""
    words: list[str] = []
    lead: list[bool] = []
    previous: Chunk | None = None
    for chunk in sorted(chunks, key=lambda c: -c.right):
        is_lead = chunk.family.startswith(lead_fonts)
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
    corps, rejoint la rangée qu'il chevauche le plus en hauteur."""
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
        overlap = [min(b, chunk.top + chunk.height) - max(a, chunk.top) for a, b in spans]
        k = max(range(len(spans)), key=lambda i: overlap[i]) if spans else -1
        if k >= 0 and overlap[k] > 0.3 * chunk.height:
            rows[k].append(chunk)
        else:
            rows.append([chunk])
    return rows


SIDE = "Rashi_rc"
RASHI_LEAD = "SF_NeomiRound"
TOSAFOT_LEAD = "Vilna_Lamed"
LEADS = (RASHI_LEAD, TOSAFOT_LEAD)


@dataclass
class Printed:
    main: list[PrintedLine]
    right: list[PrintedLine]
    left: list[PrintedLine]
    wide: list[PrintedLine]
    box: tuple[int, int, int, int]
    """La boîte de la page : gauche, haut, droite, bas."""
    sizes: dict[str, int]


def printed_page(pdf: str) -> Printed | None:
    """La guemara et les deux commentaires d'une page, ligne par ligne."""
    chunks = read_page(pdf)
    # Le corps des commentaires : la taille la plus fréquente de la police de Rachi.
    side_sizes = Counter(c.size for c in chunks if c.family.startswith(SIDE))
    main_sizes = Counter(c.size for c in chunks if c.family == "Vilna")
    if not main_sizes:
        return None
    main_size = main_sizes.most_common(1)[0][0]
    side_size = side_sizes.most_common(1)[0][0] if side_sizes else 0
    body = [c for c in chunks if c.family.startswith(SIDE) and c.size == side_size]
    main = [c for c in chunks if c.family == "Vilna" and c.size == main_size]
    # Le titre courant est dans la police de la guemara, en plus grand : il
    # n'en est pas. Un mot d'ouverture de chapitre, plus grand lui aussi, si.
    top = min((c.top for c in body), default=min(c.top for c in main))
    main += [c for c in chunks if c.family == "Vilna" and c.size > main_size and c.top > top]
    if body:
        lo, hi = min(c.left for c in body), max(c.right for c in body)
        low, high = min(c.top for c in body) - 6, max(c.top + c.height for c in body) + 6
    else:
        lo, hi = min(c.left for c in main), max(c.right for c in main)
        low, high = 0, 10 ** 6
    inside = lambda c: lo - 2 <= c.left and c.right <= hi + 2 and low <= c.middle <= high  # noqa: E731
    side = body[:]
    # Dans les colonnes : les renvois en petit corps et les dibbourim.
    side += [c for c in chunks if c.family.startswith(SIDE) and side_size > c.size >= side_size - 5 and inside(c)
             and not re.fullmatch(r"\(?[א-ת]\)?", c.text.strip())]
    side += [c for c in chunks if c.family.startswith(LEADS) and inside(c)
             and not re.fullmatch(r"\(?[א-ת]\)?", c.text.strip())]

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
                owner = "rashi" if any(c.family.startswith(RASHI_LEAD) for c in group) else \
                    "tosafot" if any(c.family.startswith(TOSAFOT_LEAD) for c in group) else ""
                if any(norm(w) for w in words):
                    out.append(PrintedLine(words, lead, owner, min(c.left for c in group), max(c.right for c in group),
                                           min(c.top for c in group), max(c.top + c.height for c in group)))
        return out

    main_lines = lines(main, main_size * 0.3, False)
    # Entre deux colonnes, une gouttière ; entre deux mots, une espace.
    side_lines = lines(side, side_size * 0.3, True)
    for line in main_lines:
        line.zone = "main"
    everything = main_lines + side_lines
    box = (min(l.left for l in everything), int(min(l.top for l in everything)),
           max(l.right for l in everything), int(max(l.bottom for l in everything)))
    centre = (box[0] + box[2]) / 2
    width = box[2] - box[0]
    right, left, wide = [], [], []
    for line in side_lines:
        if line.right - line.left > 0.62 * width or (line.left < centre - 0.12 * width and line.right > centre + 0.12 * width):
            wide.append(line)
        elif (line.left + line.right) / 2 > centre:
            right.append(line)
        else:
            left.append(line)
    return Printed(main_lines, right, left, wide, box, {"main": main_size, "side": side_size})


# ---- Caler la page sur notre texte ---------------------------------------------


def norm(word: str) -> str:
    return re.sub("[^א-ת]", "", word)


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
                and all(i not in line_of for i in range(before + 1, after)):
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


def page_layout(tractate: Tractate, amud: int, taken: dict[str, set]) -> tuple[dict, dict] | None:
    """Le fichier d'une page, et ce que vaut son calage."""
    pdf = pdf_path(tractate.slug, amud)
    if not os.path.exists(pdf):
        return None
    printed = printed_page(pdf)
    if printed is None:
        return None
    ours_main = tractate.tokens("main", amud)
    main = place(ours_main, printed.main)
    # À qui est une ligne de commentaire. La police de son dibbour hamat'hil
    # le dit quand elle en ouvre un (sur certaines pages Rachi tient les deux
    # côtés) ; sinon ses mots, comparés aux deux textes ; sinon la ligne
    # d'avant dans sa colonne.
    free = {zone: [t for t in side_tokens(tractate, zone, amud) if (t.unit, t.passage, t.word) not in taken[zone]]
            for zone in ("rashi", "tosafot")}
    ahead = {zone: tractate.tokens(zone, amud + 1) if amud + 1 < len(tractate) else [] for zone in free}
    known = {zone: grams([norm(t.text) for t in free[zone] + ahead[zone] if norm(t.text)]) for zone in free}
    columns: dict[str, list[PrintedLine]] = {"rashi": [], "tosafot": []}
    for stream in (printed.right, printed.left, printed.wide):
        stream = sorted(stream, key=lambda l: l.top)
        owners: list[str] = []
        for line in stream:
            mine = grams([norm(w) for w in line.words if norm(w)])
            hits = {zone: len(mine & known[zone]) for zone in known}
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
    x0, y0, x1, y1 = printed.box
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
        "main": [box(l) + [[p, w, n] for _, p, w, n in runs] for l, runs in zip(main.lines, main.runs)],
    }
    for zone in ("rashi", "tosafot"):
        page[zone] = [
            box(l) + [[p, w, n] if a == amud else [p, w, n, a] for a, p, w, n in runs]
            for l, runs in zip(placed[zone].lines, placed[zone].runs)
            # Une réclame (le premier mot de la suite, répété au bas d'une
            # colonne) n'est pas du texte : elle n'a pas de ligne.
            if runs or len(l.words) > 3
        ]
    # Ce que notre fichier porte et que la page n'a pas.
    report = {"amud": amud}
    for zone, ours in (("main", ours_main), ("rashi", tractate.tokens("rashi", amud)),
                       ("tosafot", tractate.tokens("tosafot", amud))):
        report[zone] = {
            "lines": len(placed[zone].lines),
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
    title = Tractate(slug)
    del title
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
    parser.add_argument("--amud", help="une seule page (« 3a »)")
    parser.add_argument("--dump", action="store_true", help="avec --amud : les lignes de la page")
    args = parser.parse_args()
    slugs = sorted(sources()["tractates"]) if args.tractate == "all" else [args.tractate]
    for slug in slugs:
        tractate = Tractate(slug)
        if args.fetch:
            fetch(slug, len(tractate))
        if args.dump and args.amud:
            printed = printed_page(pdf_path(slug, parse_amud(args.amud)))
            assert printed
            for name in ("main", "right", "left", "wide"):
                print(f"--- {name}")
                for line in getattr(printed, name):
                    print(f"{line.left:4d} {int(line.top):4d} {line.right - line.left:4d}  "
                          + " ".join(("*" if b else "") + w for w, b in zip(line.words, line.lead)))
            continue
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
