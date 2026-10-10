"""La page de Vilna : ranger les segments d'un amoud dans ses zones.

La page porte trois textes qu'on veut suivre (la guemara au centre, Rachi du
côté de la reliure, Tossafot du côté du bord) et beaucoup d'autres qu'on
laisse (le titre courant, Ein Michpat, Massoret haChas, Rav Nissim Gaon, les
renvois en marge). On les distingue par ce que l'image montre :

  - la taille du caractère : la guemara est en grandes lettres carrées, les
    deux commentaires en écriture de Rachi plus petite, les marges en plus
    petit encore ;
  - le voisinage : deux lignes d'une même colonne se suivent à un interligne,
    l'une sous l'autre.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from segment import Page, Segment, Word, make_segment, words_of


@dataclass
class Line:
    """Une ligne d'une zone, ses mots de droite à gauche."""

    x0: int
    x1: int
    y0: int
    y1: int
    yc: float
    xh: float
    words: list[Word] = field(default_factory=list)
    boxes: np.ndarray = field(repr=False, default_factory=lambda: np.zeros((0, 4), int))


@dataclass
class Zones:
    main: list[Line]
    columns: list[list[Line]]
    """Les colonnes de commentaire, chacune ses lignes de haut en bas."""
    sizes: dict[str, float]
    """La taille mesurée de chaque caractère (guemara, commentaire, marge)."""
    notes: list[str] = field(default_factory=list)
    """Ce que le découpage a trouvé d'inattendu, pour la relecture."""


def letter_shape(seg: Segment) -> tuple[float, float]:
    """Ce qui dit le caractère d'un segment : la hauteur d'une lettre et sa
    largeur moyenne. La hauteur seule sépare mal la guemara de Rachi (38 px
    contre 33 à 350 dpi) ; la lettre carrée est surtout plus large que
    l'écriture de Rachi."""
    heights = seg.boxes[:, 3] - seg.boxes[:, 1]
    widths = seg.boxes[:, 2] - seg.boxes[:, 0]
    body = heights >= 0.55 * seg.xh
    if not body.any() or seg.xh <= 0:
        return 0.0, 0.0
    return float(seg.xh), float(widths[body].mean())


# Ce que vaut un écart sur chaque mesure : la hauteur d'une lettre se mesure
# à 3 % près sur une dizaine de lettres, sa largeur moyenne à 9 % près (elle
# dépend des lettres qui se trouvent là).
HEIGHT_NOISE = 0.03
WIDTH_NOISE = 0.09


def shape_space(shapes: np.ndarray) -> np.ndarray:
    """Hauteur et largeur ramenées à une même échelle d'incertitude."""
    safe = np.maximum(shapes, 1.0)
    return np.stack([np.log(safe[:, 0]) / HEIGHT_NOISE, np.log(safe[:, 1]) / WIDTH_NOISE], axis=1)


def size_classes(shapes: np.ndarray, weights: np.ndarray) -> np.ndarray:
    """Les trois caractères de la page (marge, commentaire, guemara), du plus
    petit au plus grand : leur hauteur et leur largeur de lettre.

    Un k-moyennes à trois centres, pondéré par la longueur des segments : les
    lignes pleines décident, pas les mots isolés. On part des proportions de
    la page de Vilna (le commentaire fait 86 % de la guemara, la marge 58 %).
    """
    top = np.percentile(np.repeat(shapes[:, 0], np.maximum(1, (weights / 50).astype(int))), 97)
    centres = np.array([[0.58 * top, 0.40 * top], [0.86 * top, 0.48 * top], [0.99 * top, 0.66 * top]])
    points = shape_space(shapes)
    for _ in range(40):
        nearest = np.linalg.norm(points[:, None, :] - shape_space(centres)[None, :, :], axis=2).argmin(axis=1)
        moved = centres.copy()
        for k in range(3):
            if (nearest == k).any():
                moved[k] = np.average(shapes[nearest == k], axis=0, weights=weights[nearest == k])
        if np.allclose(moved, centres, atol=0.01):
            break
        centres = moved
    return centres


def overlap(a: Segment | Line, b: Segment | Line) -> int:
    """La largeur que deux segments ont en commun."""
    return max(0, min(a.x1, b.x1) - max(a.x0, b.x0))


def line_pitch(segments: list[Segment]) -> float:
    """L'interligne d'un caractère : l'écart le plus fréquent entre deux lignes
    qui se suivent dans une colonne."""
    steps: list[float] = []
    ordered = sorted(segments, key=lambda s: s.yc)
    for i, a in enumerate(ordered):
        for b in ordered[i + 1:]:
            step = b.yc - a.yc
            if step > 3.2 * a.xh:
                break
            if step > 0.8 * a.xh and overlap(a, b) > 0.5 * min(a.width, b.width):
                steps.append(step)
                break
    if not steps:
        return 0.0
    hist, edges = np.histogram(steps, bins=np.arange(min(steps), max(steps) + 3, 2))
    k = int(hist.argmax())
    near = [s for s in steps if edges[k] - 3 <= s <= edges[k + 1] + 3]
    return float(np.median(near))


def stacks(segments: list[Segment], pitch: float, narrow: float) -> list[list[int]]:
    """Les colonnes : les segments reliés de proche en proche, ligne sous ligne.

    Deux segments se suivent s'ils sont à un interligne l'un de l'autre et se
    recouvrent. Un segment étroit (un mot seul : la fin d'un commentaire, ou
    la réclame au pied d'une colonne) ne relie rien vers le bas : c'est par la
    réclame que la fin de Rachi toucherait les lignes de Tossafot qui passent
    dessous. Une ligne pleine peut en revanche rejoindre celle d'au-dessus par
    dessus une ligne courte, si elles ont la même largeur.
    """
    n = len(segments)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    order = sorted(range(n), key=lambda i: segments[i].yc)
    for a_pos, i in enumerate(order):
        a = segments[i]
        for j in order[a_pos + 1:]:
            b = segments[j]
            step = b.yc - a.yc
            if step > 2.5 * pitch:
                break
            common = overlap(a, b)
            if common <= 0:
                continue
            if step < 0.35 * pitch:
                continue
            close = step <= 1.5 * pitch
            if close and a.width >= narrow and common >= 0.5 * min(a.width, b.width):
                parent[find(i)] = find(j)
            elif close and a.width < narrow and b.width < narrow and common >= 0.5 * min(a.width, b.width):
                parent[find(i)] = find(j)
            elif not close and common >= 0.6 * max(a.width, b.width):
                parent[find(i)] = find(j)
    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    return sorted(groups.values(), key=lambda g: -sum(segments[i].width for i in g))


def split_columns(segments: list[Segment], pitch: float, xh: float) -> list[list[Segment]]:
    """Coupe une pile de segments en colonnes simples.

    Une pile peut porter une fourche : des lignes qui tiennent toute la
    largeur, puis deux colonnes de part et d'autre de la guemara (ou
    l'inverse, deux colonnes qui se rejoignent sous elle). Les deux branches
    ne portent pas forcément le même commentaire : on rend le tronc et chaque
    branche à part, et le texte dira lequel suit lequel.
    """
    rows: list[list[Segment]] = []
    for seg in sorted(segments, key=lambda s: s.yc):
        if rows and abs(seg.yc - np.mean([s.yc for s in rows[-1]])) < 0.4 * pitch:
            rows[-1].append(seg)
        else:
            rows.append([seg])
    # Les morceaux d'une rangée qu'un simple blanc sépare font une seule part.
    parted: list[list[list[Segment]]] = []
    for row in rows:
        parts: list[list[Segment]] = []
        for seg in sorted(row, key=lambda s: s.x0):
            if parts and seg.x0 - max(s.x1 for s in parts[-1]) < 3 * xh:
                parts[-1].append(seg)
            else:
                parts.append([seg])
        parted.append(parts)

    def span(part: list[Segment]) -> tuple[int, int]:
        return min(s.x0 for s in part), max(s.x1 for s in part)

    def touching(a: list[Segment], b: list[Segment]) -> bool:
        (a0, a1), (b0, b1) = span(a), span(b)
        return min(a1, b1) - max(a0, b0) >= 0.5 * min(a1 - a0, b1 - b0)

    chains: list[list[list[Segment]]] = []
    open_chains: list[int] = []  # les colonnes qu'une rangée peut encore prolonger
    for parts in parted:
        above = {c: [k for k, part in enumerate(parts) if touching(chains[c][-1], part)]
                 for c in open_chains}
        below = {k: [c for c in open_chains if k in above[c]] for k in range(len(parts))}
        still_open: list[int] = []
        for k, part in enumerate(parts):
            parents = below[k]
            # Une seule colonne au-dessus, qui ne se prolonge que par cette
            # part : la colonne continue. Sinon c'est une fourche ou une
            # jonction, et une colonne nouvelle commence.
            if len(parents) == 1 and above[parents[0]] == [k]:
                chains[parents[0]].append(part)
                still_open.append(parents[0])
            else:
                chains.append([part])
                still_open.append(len(chains) - 1)
        # Une colonne que cette rangée n'a pas touchée reste ouverte une
        # rangée de plus : une ligne courte ne la ferme pas.
        for c in open_chains:
            if not above[c] and c not in still_open and len(chains[c]) < 10_000:
                last = chains[c][-1]
                if parts and min(s.yc for s in parts[0]) - np.mean([s.yc for s in last]) < 1.6 * pitch:
                    still_open.append(c)
        open_chains = still_open
    return [[seg for part in chain for seg in part] for chain in chains]


def build_lines(segments: list[Segment], pitch: float, gap_ratio: float, small: float) -> list[Line]:
    """Les lignes d'une zone : ses segments réunis rangée par rangée."""
    rows: list[list[Segment]] = []
    for seg in sorted(segments, key=lambda s: s.yc):
        if rows and abs(seg.yc - np.mean([s.yc for s in rows[-1]])) < 0.4 * pitch:
            rows[-1].append(seg)
        else:
            rows.append([seg])
    lines: list[Line] = []
    for row in rows:
        boxes = np.concatenate([s.boxes for s in row])
        xh = max(row, key=lambda s: s.width).xh
        lines.append(
            Line(
                x0=min(s.x0 for s in row),
                x1=max(s.x1 for s in row),
                y0=min(s.y0 for s in row),
                y1=max(s.y1 for s in row),
                yc=float(np.mean([s.yc for s in row])),
                xh=xh,
                words=words_of(boxes, gap_ratio * xh, xh, small, notes=small >= 0.6),
                boxes=boxes,
            )
        )
    return lines


def attach_strays(lines: list[Line], strays: list[Segment], pitch: float, reach: float,
                  gap_ratio: float, small: float) -> list[Segment]:
    """Rend à leurs lignes les segments laissés de côté : un mot en grandes
    lettres (le dibbour hamat'hil de Tossafot, « גמ׳ »), un mot isolé par un
    blanc trop large. Ils sont sur la rangée d'une ligne, tout contre elle.
    Renvoie ceux qui n'ont trouvé aucune ligne."""
    left: list[Segment] = []
    for seg in sorted(strays, key=lambda s: s.x0):
        best: Line | None = None
        for line in lines:
            if abs(line.yc - seg.yc) > 0.4 * pitch:
                continue
            # Un renvoi de marge est en plus petit caractère : il reste dehors.
            if seg.xh < 0.82 * line.xh:
                continue
            gap = max(line.x0 - seg.x1, seg.x0 - line.x1)
            if gap <= reach and (best is None or abs(line.yc - seg.yc) < abs(best.yc - seg.yc)):
                best = line
        if best is None:
            left.append(seg)
            continue
        best.boxes = np.concatenate([best.boxes, seg.boxes])
        best.x0, best.x1 = min(best.x0, seg.x0), max(best.x1, seg.x1)
        best.y0, best.y1 = min(best.y0, seg.y0), max(best.y1, seg.y1)
        best.words = words_of(best.boxes, gap_ratio * best.xh, best.xh, small, notes=small >= 0.6)
    return left


def split_mixed(seg: Segment, side: float, main: float) -> list[Segment]:
    """Coupe un segment qui porte deux caractères bout à bout : une ligne de
    guemara qui déborde dans la colonne d'un commentaire, là où aucune
    gouttière ne les sépare.

    Chaque lettre ordinaire penche, par sa hauteur, vers la guemara ou vers le
    commentaire. On cherche le blanc qui sépare le mieux les lettres qui
    penchent d'un côté de celles qui penchent de l'autre, et l'on ne coupe que
    si les deux côtés sont nets. Les grandes lettres d'un dibbour hamat'hil et
    les petites d'un renvoi ne disent rien : on ne les compte pas.
    """
    boxes = seg.boxes[np.argsort(seg.boxes[:, 0])]
    heights = (boxes[:, 3] - boxes[:, 1]).astype(float)
    plain = (heights >= 0.82 * side) & (heights <= 1.12 * main)
    if plain.sum() < 12:
        return [seg]
    spread = 0.065 * (side + main) / 2
    lean = np.where(plain, ((heights - side) ** 2 - (heights - main) ** 2) / (2 * spread**2), 0.0)
    total, count = lean.sum(), plain.sum()
    left_sum, left_n = np.cumsum(lean), np.cumsum(plain)
    reach = np.maximum.accumulate(boxes[:, 2])
    cuts: list[tuple[float, float, int]] = []
    for cut in range(1, len(boxes)):
        gap = boxes[cut, 0] - reach[cut - 1]
        # Un renvoi imprimé dans la gouttière touche parfois les deux lignes :
        # la coupe peut passer entre deux lettres qui se frôlent.
        if gap < -2:
            continue
        a_n, b_n = left_n[cut - 1], count - left_n[cut - 1]
        if a_n < 6 or b_n < 6:
            continue
        a, b = left_sum[cut - 1], total - left_sum[cut - 1]
        if a * b >= 0 or min(abs(a), abs(b)) < 9 or min(abs(a) / a_n, abs(b) / b_n) < 1.0:
            continue
        cuts.append((abs(a - b), float(gap), cut))
    if not cuts:
        return [seg]
    # Entre deux coupes qui se valent, la plus large : c'est la gouttière.
    top = max(score for score, _, _ in cuts)
    cut = max((gap, at) for score, gap, at in cuts if score >= top - 1.0)[1]
    # Ce qui est petit de part et d'autre de la coupe est le renvoi : il
    # n'appartient à aucune des deux lignes.
    small = heights < 0.82 * side
    left_end, right_start = cut, cut
    while left_end > 1 and small[left_end - 1]:
        left_end -= 1
    while right_start < len(boxes) - 1 and small[right_start]:
        right_start += 1
    return (split_mixed(make_segment(boxes[:left_end]), side, main)
            + split_mixed(make_segment(boxes[right_start:]), side, main))


def flag_margins(lines: list[Line], pitch: float) -> None:
    """Marque les mots qui dépassent de la colonne de leur ligne.

    Un renvoi de marge (« תורה אור ») est parfois imprimé dans le caractère du
    commentaire, tout contre sa ligne. On le reconnaît à ce qu'il dépasse du
    bord que tiennent les lignes du dessous, alors que le texte de la ligne,
    lui, s'arrête à ce bord. Le calage reste juge : un mot marqué coûte
    seulement moins cher à laisser sans mot du texte.
    """
    for i, line in enumerate(lines):
        below = [l for l in lines[i + 1: i + 4] if l.yc - line.yc < 3.6 * pitch and len(l.words) >= 3]
        if len(below) < 2 or len(line.words) < 3:
            continue
        tol = 0.6 * line.xh
        left = float(np.median([l.x0 for l in below]))
        right = float(np.median([l.x1 for l in below]))
        if max(abs(l.x0 - left) for l in below) > 2 * tol or max(abs(l.x1 - right) for l in below) > 2 * tol:
            continue  # pas une colonne régulière dessous
        ends_at_left = any(abs(w.x0 - left) <= 1.2 * tol for w in line.words)
        ends_at_right = any(abs(w.x1 - right) <= 1.2 * tol for w in line.words)
        for word in line.words:
            if word.x1 < left - tol and ends_at_left:
                word.stray = True
            if word.x0 > right + tol and ends_at_right:
                word.stray = True
        # Jamais plus de trois mots : au-delà, c'est la ligne qui est large.
        if sum(w.stray for w in line.words) > 3:
            for word in line.words:
                word.stray = False


# Le blanc entre deux mots, en part de la hauteur d'une lettre : en dessous,
# ce sont deux lettres du même mot.
MAIN_GAP = 0.18
SIDE_GAP = 0.18
# Les plus petites lettres qui font encore un mot, en part de la hauteur d'une
# lettre de la ligne. La guemara n'a pas de mot en petit caractère : ce qui
# est petit y est un appel de note. Les commentaires, eux, impriment leurs
# renvois (« דף ג. ») en plus petit, et notre texte les porte.
MAIN_SMALL = 0.7
SIDE_SMALL = 0.45


def find_zones(page: Page, amud: str) -> Zones:
    """La guemara et les colonnes de commentaire d'un amoud (« a » ou « b »)."""
    height, width = page.ink.shape
    segments = page.segments

    def measure(found: list[Segment]) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        shapes = np.array([letter_shape(s) for s in found])
        widths = np.array([s.width for s in found], float)
        letters = np.array([len(s.boxes) for s in found])
        # Un segment dit son caractère s'il a assez de lettres pour qu'on le mesure.
        sure = (letters >= 10) & (shapes[:, 0] > 0)
        return shapes, widths, sure, size_classes(shapes[sure], widths[sure])

    # Les caractères de la page d'abord, pour couper les segments qui en
    # mêlent deux ; puis on les remesure sur les segments coupés.
    _, _, _, centres = measure(segments)
    segments = [piece for seg in segments for piece in split_mixed(seg, centres[1, 0], centres[2, 0])]
    shapes, widths, sure, centres = measure(segments)
    tiny_c, side_c, main_c = centres[:, 0]
    notes: list[str] = []
    nearest = np.linalg.norm(
        shape_space(shapes)[:, None, :] - shape_space(centres)[None, :, :], axis=2
    ).argmin(axis=1)

    def klass(i: int) -> str:
        if shapes[i, 0] >= 1.25 * main_c:
            return "display"
        return ("tiny", "side", "main")[nearest[i]]

    kinds = [klass(i) if sure[i] else "stray" for i in range(len(segments))]
    main_segs = [s for s, k in zip(segments, kinds) if k == "main"]
    side_segs = [s for s, k in zip(segments, kinds) if k == "side"]
    strays = [s for s, k in zip(segments, kinds) if k in ("stray", "display")]

    # La guemara : la plus grande colonne de grandes lettres, et ce qui la
    # prolonge au-dessus ou au-dessous dans la même largeur.
    main_pitch = line_pitch(main_segs) or 1.7 * main_c
    main_lines: list[Line] = []
    if main_segs:
        groups = stacks(main_segs, main_pitch, narrow=3 * main_c)
        core = [main_segs[i] for i in groups[0]]
        x0, x1 = min(s.x0 for s in core), max(s.x1 for s in core)
        kept = list(core)
        for group in groups[1:]:
            members = [main_segs[i] for i in group]
            g0, g1 = min(s.x0 for s in members), max(s.x1 for s in members)
            inside = min(x1, g1) - max(x0, g0)
            if inside >= 0.7 * (g1 - g0):
                kept.extend(members)
        main_lines = build_lines(kept, main_pitch, MAIN_GAP, MAIN_SMALL)
        strays = attach_strays(main_lines, strays, main_pitch, reach=1.6 * main_c,
                               gap_ratio=MAIN_GAP, small=MAIN_SMALL)

    # Les commentaires : les colonnes d'écriture de Rachi. Laquelle porte
    # Rachi, laquelle Tossafot, l'image seule ne le dit pas toujours (quand
    # Tossafot manque, Rachi prend les deux côtés) : c'est le texte qui
    # tranchera (talmud.py). On donne ici les colonnes, celle de la reliure
    # d'abord : à droite sur l'amoud a, à gauche sur l'amoud b.
    side_pitch = line_pitch(side_segs) or 1.75 * side_c
    columns: list[list[Line]] = []
    if side_segs:
        groups = stacks(side_segs, side_pitch, narrow=6 * side_c)
        total = sum(s.width for s in side_segs)
        used: set[int] = set()
        for group in groups:
            for members in split_columns([side_segs[i] for i in group], side_pitch, side_c):
                if sum(s.width for s in members) < 0.02 * total:
                    continue
                used.update(id(s) for s in members)
                columns.append(build_lines(members, side_pitch, SIDE_GAP, SIDE_SMALL))
        # Un mot isolé va à la colonne dont la ligne est la plus proche de lui.
        loose = strays + [s for s in side_segs if id(s) not in used and s.width < 6 * side_c]
        attach_strays([line for column in columns for line in column], loose, side_pitch,
                      reach=1.6 * side_c, gap_ratio=SIDE_GAP, small=SIDE_SMALL)
        for column in columns:
            flag_margins(column, side_pitch)

        def binding_first(column: list[Line]) -> tuple[float, float]:
            top = column[:3]
            centre = float(np.mean([(line.x0 + line.x1) / 2 for line in top]))
            toward_binding = -centre if amud == "a" else centre
            # D'abord la plus haute, à trois lignes près ; puis celle de la reliure.
            return (round(column[0].yc / (3 * side_pitch)), toward_binding)

        columns.sort(key=binding_first)
    flag_margins(main_lines, main_pitch)

    return Zones(
        main=main_lines,
        columns=columns,
        sizes={"tiny": float(tiny_c), "side": float(side_c), "main": float(main_c),
               "main_pitch": float(main_pitch), "side_pitch": float(side_pitch)},
        notes=notes,
    )
