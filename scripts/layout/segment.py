"""Des lettres aux lignes : ce que l'image dit de la page, sans la lire.

Une page imprimée se décompose de bas en haut :

  - les composantes d'encre (une lettre, un point, parfois deux lettres qui
    se touchent) ;
  - les gouttières : les bandes blanches verticales qui séparent deux
    colonnes, reconnues à ce qu'elles tiennent sur plusieurs lignes, ce qu'un
    blanc entre deux mots ne fait pas ;
  - les segments : les lettres d'une même ligne dans une même colonne ;
  - les mots d'un segment : ce que séparent ses blancs.

Rien ici ne sait ce qu'est une guemara ou un Sefer Torah : les modules
talmud.py et torah.py rangent les segments dans leurs zones.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import cv2
import numpy as np


@dataclass
class Word:
    """Un mot de la page : son étendue horizontale, en pixels."""

    x0: int
    x1: int
    stray: bool = False
    """Hors de la colonne de sa ligne : sans doute un renvoi de marge."""

    @property
    def width(self) -> int:
        return self.x1 - self.x0


@dataclass
class Segment:
    """Les lettres d'une ligne dans une colonne."""

    x0: int
    x1: int
    y0: int
    y1: int
    yc: float
    """Le milieu de la ligne (la bande des lettres sans hampe ni jambage)."""
    xh: float
    """La hauteur d'une lettre ordinaire : dit la taille du caractère."""
    boxes: np.ndarray = field(repr=False, default_factory=lambda: np.zeros((0, 4), int))
    """Les composantes du segment : x0, y0, x1, y1."""

    @property
    def width(self) -> int:
        return self.x1 - self.x0


@dataclass
class Page:
    ink: np.ndarray
    boxes: np.ndarray
    """Toutes les composantes gardées : x0, y0, x1, y1."""
    segments: list[Segment]
    gutters: np.ndarray


# Une poussière : moins de pixels que le plus petit signe imprimé.
MIN_AREA = 8


def letter_boxes(ink: np.ndarray, max_height: int, max_width: int) -> np.ndarray:
    """Les composantes d'encre qui peuvent être des lettres : x0, y0, x1, y1.

    On écarte la poussière, et ce qui est trop grand pour une lettre (filets,
    cadres, ombres du bord du scan).
    """
    _, _, stats, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    s = stats[1:]
    keep = (
        (s[:, cv2.CC_STAT_AREA] >= MIN_AREA)
        & (s[:, cv2.CC_STAT_HEIGHT] <= max_height)
        & (s[:, cv2.CC_STAT_WIDTH] <= max_width)
    )
    s = s[keep]
    x0 = s[:, cv2.CC_STAT_LEFT]
    y0 = s[:, cv2.CC_STAT_TOP]
    return np.stack([x0, y0, x0 + s[:, cv2.CC_STAT_WIDTH], y0 + s[:, cv2.CC_STAT_HEIGHT]], axis=1)


def paint(shape: tuple[int, int], boxes: np.ndarray) -> np.ndarray:
    """Un masque où chaque boîte est pleine."""
    out = np.zeros(shape, np.uint8)
    for x0, y0, x1, y1 in boxes:
        out[y0:y1, x0:x1] = 1
    return out


def gutter_mask(ink: np.ndarray, cores: np.ndarray, rules: list[tuple[int, int]],
                near: int) -> np.ndarray:
    """Les gouttières : les bandes blanches qui séparent deux colonnes.

    Un blanc entre deux mots a la largeur d'une gouttière étroite ; ce qui
    fait la gouttière, c'est qu'elle traverse plusieurs lignes de suite au
    même endroit. Chaque règle `(largeur, lignes)` retient les bandes blanches
    verticales d'au moins cette largeur qui passent entre des lettres (une
    lettre à moins de `near` pixels à gauche comme à droite) sur au moins ce
    nombre de lignes. Deux règles suffisent à une page : une gouttière étroite
    doit être longue (les blancs de quatre lignes s'alignent souvent par
    hasard, pas ceux de sept), une gouttière courte doit être large.

    Les lignes se comptent sur le cœur des lettres (line_cores) : le vide
    laissé sous une colonne ou une marge ne compte pour rien.
    """
    paper = (1 - ink).astype(np.uint8)
    row = np.ones((1, near), np.uint8)
    left = cv2.dilate(cores, row, anchor=(near - 1, 0))
    right = cv2.dilate(cores, row, anchor=(0, 0))
    between = cv2.morphologyEx(left & right, cv2.MORPH_CLOSE, np.ones((9, 1), np.uint8))
    # Le début de chaque ligne traversée, en descendant.
    entering = between.copy()
    entering[1:, :] &= 1 - between[:-1, :]
    entering = entering.T.ravel()

    out = np.zeros(ink.shape, np.uint8)
    for width, lines in rules:
        strip = cv2.erode(paper, np.ones((1, width), np.uint8))
        # Les traits verticaux de blanc, colonne par colonne.
        cols = np.ascontiguousarray(strip.T)
        starts = cols.copy()
        starts[:, 1:] &= 1 - cols[:, :-1]
        run = np.cumsum(starts.ravel(), dtype=np.int32)
        run[cols.ravel() == 0] = 0
        crossed = np.bincount(run, weights=entering)
        keep = crossed >= lines
        keep[0] = False
        out |= keep[run].reshape(cols.shape).T.astype(np.uint8)
    return out


def line_cores(shape: tuple[int, int], boxes: np.ndarray) -> np.ndarray:
    """Le cœur de chaque lettre : une bande mince autour de son milieu.

    Les hampes d'une ligne et les jambages de celle du dessus partagent des
    rangées de pixels ; leurs cœurs, non. Fermer les cœurs à l'horizontale
    relie donc les lettres d'une ligne sans jamais lier deux lignes.
    """
    out = np.zeros(shape, np.uint8)
    for x0, y0, x1, y1 in boxes:
        half = max(2, int(round((y1 - y0) * 0.18)))
        yc = (y0 + y1) // 2
        out[max(0, yc - half): yc + half + 1, x0:x1] = 1
    return out


def x_height(heights: np.ndarray) -> float:
    """La hauteur d'une lettre ordinaire, parmi celles d'une ligne.

    Les points et les yod tirent vers le bas, les lamed et les lettres finales
    vers le haut : on prend la médiane de ce qui reste entre les deux.
    """
    if len(heights) == 0:
        return 0.0
    top = np.percentile(heights, 90)
    body = heights[(heights >= 0.55 * top) & (heights <= 1.02 * top)]
    return float(np.median(body if len(body) else heights))


def make_segment(members: np.ndarray) -> Segment:
    """Un segment à partir de ses lettres."""
    heights = members[:, 3] - members[:, 1]
    xh = x_height(heights)
    # Le milieu de la ligne : celui des lettres ordinaires, pas des points.
    body = members[heights >= 0.55 * xh] if xh else members
    if len(body) == 0:
        body = members
    return Segment(
        x0=int(members[:, 0].min()),
        x1=int(members[:, 2].max()),
        y0=int(members[:, 1].min()),
        y1=int(members[:, 3].max()),
        yc=float(np.median((body[:, 1] + body[:, 3]) / 2)),
        xh=xh,
        boxes=members,
    )


def find_segments(
    ink: np.ndarray,
    *,
    max_letter: int,
    gutters: list[tuple[int, int]],
    reach: int,
    bridge: int,
    speck: int,
) -> Page:
    """Les segments d'une page.

    max_letter : la plus grande lettre attendue (hauteur, en pixels).
    gutters    : les règles `(largeur, lignes)` d'une gouttière (voir
                 gutter_mask).
    reach      : le plus grand blanc qu'on franchit à l'intérieur d'une ligne.
    bridge     : la plus grande interruption d'une gouttière qu'on referme. Un
                 renvoi imprimé dans la gouttière la coupe sur une ligne, et
                 relierait sans cela les deux colonnes qu'elle sépare.
    speck      : la hauteur sous laquelle un signe ne bouche pas une
                 gouttière (un appel de note, un point : il s'en imprime
                 jusque dans le blanc qui sépare Rachi de Tossafot).
    """
    boxes = letter_boxes(ink, max_height=max_letter, max_width=max_letter * 4)
    cores = line_cores(ink.shape, boxes)
    tall = boxes[(boxes[:, 3] - boxes[:, 1]) >= speck]
    letters = paint(ink.shape, tall) & ink
    gutter = gutter_mask(letters, line_cores(ink.shape, tall), gutters, near=2 * reach)
    gutter = cv2.morphologyEx(gutter, cv2.MORPH_CLOSE, np.ones((bridge, 1), np.uint8))
    joined = cv2.morphologyEx(cores, cv2.MORPH_CLOSE, np.ones((1, reach), np.uint8))
    joined &= 1 - gutter
    count, labels = cv2.connectedComponents(joined, connectivity=8)

    # Chaque lettre va au segment qui porte son cœur.
    xc = np.clip((boxes[:, 0] + boxes[:, 2]) // 2, 0, ink.shape[1] - 1)
    yc = np.clip((boxes[:, 1] + boxes[:, 3]) // 2, 0, ink.shape[0] - 1)
    owner = labels[yc, xc]
    order = np.argsort(owner, kind="stable")
    owner_sorted = owner[order]
    starts = np.searchsorted(owner_sorted, np.arange(1, count))
    ends = np.searchsorted(owner_sorted, np.arange(1, count), side="right")

    segments: list[Segment] = []
    for start, end in zip(starts, ends):
        if end <= start:
            continue
        segments.append(make_segment(boxes[order[start:end]]))
    return Page(ink=ink, boxes=boxes, segments=segments, gutters=gutter)


def without_notes(boxes: np.ndarray, xh: float) -> np.ndarray:
    """Retire d'une ligne les renvois en petit caractère accolés à ses mots.

    Un renvoi de marge (« ויקרא כב ») vient parfois se coller au dernier mot
    d'une ligne serrée. Ses lettres sont petites, comme le yod ou les
    guillemets d'une abréviation ; mais celles-là ne vont jamais plus de trois
    de suite. Quatre petites lettres qui se suivent ne sont pas du texte.
    """
    order = np.argsort(boxes[:, 0])
    ordered = boxes[order]
    small = (ordered[:, 3] - ordered[:, 1]) < 0.6 * xh
    keep = np.ones(len(ordered), bool)
    start = 0
    for i in range(len(ordered) + 1):
        if i == len(ordered) or not small[i]:
            if i - start >= 4:
                keep[start:i] = False
            start = i + 1
    return ordered[keep]


def words_of(boxes: np.ndarray, gap: float, xh: float, small: float = 0.45,
             notes: bool = False) -> list[Word]:
    """Les mots d'une ligne, de droite à gauche : ce que séparent ses blancs.

    Les signes isolés (le point posé entre deux blancs, les deux-points) ne
    sont pas des mots : on les laisse de côté, comme tout ce dont les lettres
    restent sous `small` fois la hauteur d'une lettre de la ligne (un appel de
    note). `notes` retire aussi les renvois accolés aux mots (without_notes).
    """
    if notes and len(boxes):
        boxes = without_notes(boxes, xh)
    if len(boxes) == 0:
        return []
    order = np.argsort(boxes[:, 0])
    runs: list[tuple[int, int, list[int]]] = []  # x0, x1, hauteurs des lettres
    for x0, y0, x1, y1 in boxes[order]:
        if runs and x0 - runs[-1][1] < gap:
            first, last, heights = runs[-1]
            runs[-1] = (first, max(last, int(x1)), heights + [int(y1 - y0)])
        else:
            runs.append((int(x0), int(x1), [int(y1 - y0)]))
    words = [
        Word(x0, x1) for x0, x1, heights in runs
        if np.percentile(heights, 75) >= small * xh
    ]
    return words[::-1]
