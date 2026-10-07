"""Caler les mots vus sur la page sur les mots du texte qu'on a déjà.

L'image donne, ligne par ligne, des mots dont on ne connaît que la largeur.
Le texte donne les mêmes mots, dont on sait prévoir la largeur : celle de
leurs lettres dans le caractère du livre. Le calage est le chemin le moins
coûteux qui fait correspondre les deux suites, dans l'ordre :

  - un mot vu pour un mot du texte, quand leurs largeurs s'accordent ;
  - un mot vu pour plusieurs mots du texte : deux mots que la ligne serrée a
    collés, ou une abréviation de l'imprimé que notre texte écrit en entier
    (« א"ר » pour « אמר רבי ») ;
  - plusieurs mots vus pour un mot du texte : un mot que l'image a coupé ;
  - un mot vu sans mot du texte (une réclame, un renvoi de marge), ou
    l'inverse (un mot que cette édition n'imprime pas).

Aucune lettre n'est lue : c'est la suite des largeurs qui fait le calage, et
les lignes justifiées le tiennent, chacune ancrant ses mots.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import numpy as np

HEBREW = "אבגדהוזחטיךכלםמןנסעףפץצקרשת"
# Les signes qui prennent de la place dans un mot imprimé.
MARKS = {
    "'": "'", "׳": "'", "’": "'", "‘": "'",
    '"': '"', "״": '"', "”": '"', "“": '"',
    "(": "(", ")": "(", "[": "(", "]": "(",
    ".": ".", ":": ".", ",": ".", "*": "*",
}
GLYPHS = HEBREW + "'\"(.*"
INDEX = {g: i for i, g in enumerate(GLYPHS)}


def glyphs_of(word: str) -> str:
    """Ce qu'un mot du texte imprime : ses lettres et ses signes, sans les
    voyelles ni les teamim.

    Un renvoi biblique s'écrit chez nous chapitre et verset (« ל״ד:כ״ה »), dans
    l'imprimé le chapitre seul (« לד ») : on ne compte que ce qui précède les
    deux-points quand des lettres les suivent.
    """
    cut = re.search(":(?=.*[א-ת])", word)
    if cut:
        word = word[: cut.start()] + re.sub("[א-ת׳״'\"]", "", word[cut.end():])
    out = []
    for c in word:
        if c in INDEX and c in HEBREW:
            out.append(c)
        elif c in MARKS:
            out.append(MARKS[c])
    return "".join(out)


def glyph_counts(keys: list[str]) -> np.ndarray:
    """Le compte de chaque signe dans chaque mot : une rangée par mot."""
    counts = np.zeros((len(keys), len(GLYPHS)), np.float32)
    for row, key in enumerate(keys):
        for g in key:
            counts[row, INDEX[g]] += 1
    return counts


@dataclass
class Font:
    """La largeur de chaque signe d'un caractère, en parts de sa hauteur de
    lettre, et ce qu'un mot perd à n'avoir pas d'approche à son bord."""

    advance: np.ndarray
    edge: float

    @staticmethod
    def rough() -> "Font":
        """Un caractère hébreu quelconque, pour un premier calage : des
        lettres étroites, des lettres larges, les autres entre les deux."""
        advance = np.full(len(GLYPHS), 0.78, np.float32)
        for g in "וזינןג":
            advance[INDEX[g]] = 0.42
        for g in "אשמםטצסעפ":
            advance[INDEX[g]] = 0.92
        for g, value in (("'", 0.22), ('"', 0.36), ("(", 0.34), (".", 0.24), ("*", 0.4)):
            advance[INDEX[g]] = value
        return Font(advance=advance, edge=0.1)

    def widths(self, counts: np.ndarray) -> np.ndarray:
        """La largeur prévue de chaque mot, en parts de hauteur de lettre."""
        return np.maximum(counts @ self.advance - self.edge, 0.0)

    def to_json(self) -> dict:
        return {
            "advance": {g: round(float(a), 4) for g, a in zip(GLYPHS, self.advance)},
            "edge": round(float(self.edge), 4),
        }

    @staticmethod
    def from_json(data: dict) -> "Font":
        advance = np.array([data["advance"][g] for g in GLYPHS], np.float32)
        return Font(advance=advance, edge=float(data["edge"]))


@dataclass
class Options:
    merge: int = 6
    """Le plus grand nombre de mots du texte pour un mot vu."""
    split: int = 3
    """Le plus grand nombre de mots vus pour un mot du texte."""
    abbreviations: bool = False
    """L'imprimé abrège ce que le texte écrit en entier (la guemara)."""
    free_end: bool = False
    """Le texte peut continuer au-delà de la page (un commentaire qui finit à
    la page suivante)."""
    free_seen: bool = False
    """La page peut continuer au-delà du texte : on cale un commentaire sur
    le début de ce qui reste de la page, pour savoir s'il vient là."""
    block_skip: float = 6.0
    """Ce que coûte de laisser un commentaire entier sans mot vu : la page
    ne l'imprime pas là (un doublon du fichier, un ajout entre crochets, un
    commentaire imprimé ailleurs)."""
    stretch: float = 0.0
    """Ce que coûte au plus un mot vu plus large que prévu. Le sofer étire
    des lettres pour finir sa ligne au bord : dans un tikoun, un mot trop
    large n'est pas un mot faux. Zéro : pas d'indulgence."""
    cap: float = 12.0
    skip_seen: float = 5.0
    skip_text: float = 5.0
    merge_cost: float = 1.6
    split_cost: float = 2.2
    abbreviation_cost: float = 1.2


@dataclass
class Alignment:
    spans: list[tuple[int, int] | None]
    """Pour chaque mot vu, les mots du texte qu'il porte : [début, fin), ou
    None s'il n'en porte aucun."""
    cost: float
    end: int
    """Le premier mot du texte que la page ne porte pas."""
    seen_end: int
    """Le premier mot vu que le texte ne couvre pas (free_seen)."""
    scale: float


# Les opérations du chemin.
MATCH, SKIP_SEEN, SKIP_TEXT, SKIP_BLOCK = 0, 1, 2, 3
MERGE0, SPLIT0, ABBR0 = 10, 20, 30


def _cost(seen: float | np.ndarray, expected: np.ndarray, unit: float, cap: float,
          stretch: float = 0.0) -> np.ndarray:
    """Ce que coûte de prendre une largeur vue pour une largeur prévue."""
    sigma = 0.32 * unit + 0.08 * expected
    z = (seen - expected) / sigma
    cost = np.minimum(z * z, cap)
    if stretch:
        cost = np.where(z > 0, np.minimum(cost, stretch), cost)
    return cost


def align(
    seen: np.ndarray,
    spans: np.ndarray,
    line_of: np.ndarray,
    expected: np.ndarray,
    initials: np.ndarray,
    skip_text: np.ndarray,
    skip_seen: np.ndarray,
    unit: float,
    options: Options,
    blocks: list[tuple[int, int]] | None = None,
    free_start: int = 0,
) -> Alignment:
    """Le calage d'une suite de mots vus sur une suite de mots du texte.

    seen      : la largeur de chaque mot vu, en pixels.
    spans     : spans[i, k] : l'étendue des k + 1 mots vus qui finissent en i.
    line_of   : la ligne de chaque mot vu.
    expected  : la largeur prévue de chaque mot du texte, en pixels.
    initials  : la largeur prévue de l'initiale de chaque mot du texte.
    skip_text : ce que coûte de laisser chaque mot du texte sans mot vu.
    skip_seen : ce que coûte de laisser chaque mot vu sans mot du texte.
    unit      : la largeur moyenne d'une lettre, en pixels.
    blocks    : les commentaires du texte, [début, fin), qu'on peut laisser
                entiers pour le prix de `block_skip`.
    free_start: la page peut commencer à n'importe lequel de ces premiers
                mots du texte, sans qu'il en coûte (ce qui précède est sur la
                page d'avant).
    """
    n, m = len(seen), len(expected)
    inf = np.float32(1e9)
    cum = np.concatenate([[0.0], np.cumsum(expected)])
    cum_init = np.concatenate([[0.0], np.cumsum(initials)])
    cum_skip = np.concatenate([[0.0], np.cumsum(skip_text)])
    gap = 0.35 * unit
    quote = 0.3 * unit

    block_start = {end: start for start, end in blocks or []}

    def relax(a: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Des mots du texte sans mot vu : le minimum courant de gauche à
        droite, mot par mot, et commentaire entier par commentaire entier."""
        if not blocks:
            b = cum_skip + np.minimum.accumulate(a - cum_skip)
            return b, np.where(b < a - 1e-6, SKIP_TEXT, -1).astype(np.int8)
        b = a.astype(np.float64).copy()
        how = np.full(m + 1, -1, np.int8)
        at = 0
        for start, end in blocks:
            if start > at:  # entre deux commentaires : mot par mot
                part = slice(at, start + 1)
                b[part] = cum_skip[part] + np.minimum.accumulate(b[part] - cum_skip[part])
            part = slice(start, end + 1)
            b[part] = cum_skip[part] + np.minimum.accumulate(b[part] - cum_skip[part])
            if b[start] + options.block_skip < b[end]:
                b[end] = b[start] + options.block_skip
                how[end] = SKIP_BLOCK
            at = end
        if at < m:
            part = slice(at, m + 1)
            b[part] = cum_skip[part] + np.minimum.accumulate(b[part] - cum_skip[part])
        how[(b < a - 1e-6) & (how != SKIP_BLOCK)] = SKIP_TEXT
        return b, how

    first_row = np.full(m + 1, inf, np.float64)
    first_row[: min(free_start, m) + 1] = 0.0
    prev, how = relax(first_row)  # aucun mot vu : tout le texte sauté
    prev = prev.astype(np.float32)
    rows = [prev]
    ops = np.zeros((n + 1, m + 1), np.int8)
    ops[0] = how
    for i in range(1, n + 1):
        w = float(seen[i - 1])
        candidates = []
        codes = []
        # Un mot vu sans mot du texte.
        candidates.append(prev + float(skip_seen[i - 1]))
        codes.append(SKIP_SEEN)
        # Un mot vu pour k mots du texte.
        for k in range(1, options.merge + 1):
            if k > m:
                break
            width = cum[k:] - cum[:-k] + (k - 1) * gap
            c = np.full(m + 1, inf, np.float32)
            c[k:] = (prev[:-k] + _cost(w, width, unit, options.cap, options.stretch if k == 1 else 0.0)
                     + (k - 1) * options.merge_cost)
            candidates.append(c)
            codes.append(MATCH if k == 1 else MERGE0 + k)
            if options.abbreviations:
                # L'imprimé n'écrit que les initiales, et un signe d'abréviation.
                short = cum_init[k:] - cum_init[:-k] + quote
                c = np.full(m + 1, inf, np.float32)
                c[k:] = (
                    prev[:-k] + _cost(w, short, unit, options.cap) + options.abbreviation_cost
                    + (k - 1) * 0.4
                )
                candidates.append(c)
                codes.append(ABBR0 + k)
        # k mots vus de la même ligne pour un mot du texte.
        for k in range(2, options.split + 1):
            if i - k < 0 or line_of[i - 1] != line_of[i - k]:
                break
            c = np.full(m + 1, inf, np.float32)
            c[1:] = (
                rows[i - k][:-1] + _cost(float(spans[i - 1, k - 1]), expected, unit, options.cap)
                + (k - 1) * options.split_cost
            )
            candidates.append(c)
            codes.append(SPLIT0 + k)
        stack = np.stack(candidates)
        best = stack.argmin(axis=0)
        a = stack[best, np.arange(m + 1)]
        b, how = relax(a)
        row_ops = np.array(codes, np.int8)[best]
        row_ops[how >= 0] = how[how >= 0]
        ops[i] = row_ops
        prev = b.astype(np.float32)
        rows.append(prev)

    # Où finir : au bout des deux suites, ou plus tôt si l'une des deux est
    # libre de continuer. On compare alors les fins par leur coût par mot.
    final_col = np.array([row[m] for row in rows])
    end, seen_end = m, n
    if options.free_end and options.free_seen:
        j_best = int(np.argmin(prev[1:] / np.arange(1, m + 1))) + 1 if m else 0
        i_best = int(np.argmin(final_col[1:] / m)) + 1 if n and m else n
        if m and (not n or prev[j_best] / j_best <= final_col[i_best] / m):
            end = j_best
        else:
            seen_end = i_best
    elif options.free_end:
        end = int(prev.argmin())
    elif options.free_seen:
        seen_end = int(final_col.argmin())
    cost = float(rows[seen_end][end])
    out: list[tuple[int, int] | None] = [None] * n
    i, j = seen_end, end
    while i > 0 or j > 0:
        op = int(ops[i, j])
        if op == SKIP_BLOCK:
            j = block_start[j]
        elif i == 0:
            j -= 1
        elif op == SKIP_TEXT:
            j -= 1
        elif op == SKIP_SEEN:
            i -= 1
        elif op == MATCH:
            out[i - 1] = (j - 1, j)
            i, j = i - 1, j - 1
        elif op >= ABBR0:
            k = op - ABBR0
            out[i - 1] = (j - k, j)
            i, j = i - 1, j - k
        elif op >= SPLIT0:
            k = op - SPLIT0
            for back in range(k):
                out[i - 1 - back] = (j - 1, j)
            i, j = i - k, j - 1
        else:
            k = op - MERGE0
            out[i - 1] = (j - k, j)
            i, j = i - 1, j - k
    return Alignment(spans=out, cost=cost, end=end, seen_end=seen_end, scale=unit)


def fit_font(counts: np.ndarray, widths: np.ndarray, prior: Font, strength: float) -> Font:
    """Le caractère qui explique le mieux des mots dont on connaît la largeur
    (en parts de hauteur de lettre) : moindres carrés, retenus vers `prior`
    pour les signes qu'on a peu vus."""
    n = len(GLYPHS)
    design = np.concatenate([counts, -np.ones((len(counts), 1), np.float32)], axis=1)
    start = np.concatenate([prior.advance, [prior.edge]])
    ridge = strength * np.eye(n + 1, dtype=np.float32)
    lhs = design.T @ design + ridge
    rhs = design.T @ widths + ridge @ start
    solved = np.linalg.solve(lhs, rhs)
    return Font(advance=np.clip(solved[:n], 0.08, 1.6).astype(np.float32), edge=float(solved[n]))
