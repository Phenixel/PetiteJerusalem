"""Les coupures de ligne de la page de Vilna, amoud par amoud.

    python3 scripts/layout/talmud.py berakhot --from 2a --to 10b --write

Pour chaque amoud : la page du scan est rendue (pdftoppm), découpée en zones
(daf.py), et les mots de chaque zone sont calés sur le texte du dépôt
(align.py). Il en sort, ligne imprimée par ligne imprimée, les mots du texte
qu'elle porte.

La guemara d'un amoud tient sur sa page, d'un bout à l'autre, dans l'ordre du
fichier : une ligne se note par la place de son premier mot, `[passage, mot]`.

Un commentaire, lui, ne suit pas toujours le fichier. Sefaria range chaque
commentaire sous le passage de guemara qu'il explique ; la page imprimée les
donne dans son ordre à elle, qui n'est pas toujours celui des passages, finit
souvent un commentaire à la page suivante, et n'imprime pas tout ce que le
fichier porte (un doublon, un ajout entre crochets). Les commentaires se
suivent donc à la trace (follow), page après page, et une ligne se note par
les morceaux de texte qu'elle porte : `[passage, mot, nombre]`, avec l'amoud
en quatrième quand le texte est celui d'un autre amoud.

Rien n'est écrit dans le dépôt sans `--write` ; `--review DOSSIER` produit
les planches de contrôle (hors dépôt).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from align import GLYPHS, HEBREW, Font, Options, align, fit_font, glyph_counts, glyphs_of  # noqa: E402
from daf import Line, Zones, find_zones  # noqa: E402
from imaging import load_page, render_page  # noqa: E402
from segment import find_segments  # noqa: E402
from texts import ROOT, TEXTS, Token, Tractate  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get("PJ_LAYOUT_CACHE", os.path.expanduser("~/.cache/petite-jerusalem/layout"))
ZONES = ("main", "rashi", "tosafot")
CHUNK = 20
# L'édition dont viennent les coupures (voir sources.json).
EDITION = "vilna-romm-1880"


def amud_label(index: int) -> str:
    """0 → « 2a », 1 → « 2b », 2 → « 3a »."""
    return f"{2 + index // 2}{'ab'[index % 2]}"


def amud_index(label: str) -> int:
    return (int(label[:-1]) - 2) * 2 + "ab".index(label[-1])


def load_sources() -> dict:
    with open(os.path.join(HERE, "sources.json"), encoding="utf8") as f:
        return json.load(f)


def load_fonts() -> dict[str, Font]:
    path = os.path.join(HERE, "fonts.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf8") as f:
        return {name: Font.from_json(data) for name, data in json.load(f).items() if name != "note"}


def locate(slug: str) -> tuple[str, int, int]:
    """Le PDF d'un traité, la page de son premier amoud, la résolution."""
    vilna = load_sources()["vilna"]
    for name, volume in vilna["volumes"].items():
        if slug in volume["tractates"]:
            pdf = os.path.join(CACHE, "sources", f"vilna-{name}", f"{name}.pdf")
            if not os.path.exists(pdf):
                raise SystemExit(
                    f"Scan absent : {pdf}\nLancer d'abord : python3 scripts/layout/fetch.py vilna {name}"
                )
            return pdf, volume["tractates"][slug]["firstPage"], vilna["dpi"]
    raise SystemExit(f"Aucun scan déclaré pour {slug} dans scripts/layout/sources.json")


def analyse(pdf: str, page: int, dpi: int, amud: str) -> tuple[np.ndarray, Zones]:
    """Une page du scan, découpée en zones."""
    png = render_page(pdf, page, dpi, os.path.join(os.path.dirname(pdf), "pages"))
    gray, ink, _ = load_page(png)
    k = dpi / 350
    found = find_segments(
        ink,
        max_letter=round(95 * k),
        gutters=[(round(10 * k), 7), (round(14 * k), 4)],
        reach=round(80 * k),
        bridge=round(96 * k),
        speck=round(19 * k),
    )
    return gray, find_zones(found, amud)


@dataclass
class ZoneResult:
    """Ce que le calage d'une zone donne sur une page."""

    lines: list[Line]
    tokens: list[Token]
    """La suite de mots du texte donnée au calage."""
    ranges: list[tuple[int, int] | None]
    """Pour chaque ligne, les mots du texte qu'elle porte : [début, fin) dans
    `tokens`, ou None si aucun mot n'y a été calé. Les lignes se partagent
    toute la suite jusqu'à `consumed` : un mot que l'image n'a pas vu reste à
    la ligne où il tombe."""
    heads: list[str]
    """Les deux premiers mots de chaque ligne, pour la relecture."""
    tails: list[str]
    cost: float = 0.0
    """Le coût moyen par mot vu : la qualité du calage."""
    doubts: list[int] = field(default_factory=list)
    """Les lignes dont le calage est douteux."""
    samples: list[tuple[str, float]] = field(default_factory=list)
    """Des mots calés un pour un et leur largeur : de quoi mesurer le caractère."""
    spans: list[tuple[int, int] | None] = field(default_factory=list)
    """Pour chaque mot vu, les mots du texte qu'il porte."""
    consumed: int = 0
    skipped_text: int = 0
    skipped_seen: int = 0
    scale: float = 0.0


@dataclass
class Seen:
    """Les mots vus d'une zone, à plat, dans l'ordre de lecture."""

    width: np.ndarray
    spans: np.ndarray
    line: np.ndarray
    stray: np.ndarray

    def __len__(self) -> int:
        return len(self.width)

    def part(self, start: int, stop: int) -> "Seen":
        return Seen(self.width[start:stop], self.spans[start:stop], self.line[start:stop],
                    self.stray[start:stop])


def seen_words(lines: list[Line]) -> Seen:
    width, spans, line_of, stray = [], [], [], []
    for li, line in enumerate(lines):
        for wi, word in enumerate(line.words):
            width.append(word.width)
            line_of.append(li)
            stray.append(word.stray)
            row = [word.width, 0, 0]
            for k in (1, 2):
                if wi - k >= 0:
                    row[k] = line.words[wi - k].x1 - word.x0
            spans.append(row)
    return Seen(np.array(width, float), np.array(spans, float).reshape(-1, 3),
                np.array(line_of, int), np.array(stray, bool))


@dataclass
class Expected:
    """Ce qu'on prévoit de chaque mot du texte dans un caractère."""

    keys: list[str]
    units: np.ndarray
    first: np.ndarray
    lettered: np.ndarray


def expected_words(tokens: list[Token], font: Font) -> Expected:
    keys = [glyphs_of(t.text) for t in tokens]
    units = font.widths(glyph_counts(keys)) if keys else np.zeros(0)
    first = np.array([
        next((font.advance[GLYPHS.index(g)] for g in key if g in HEBREW), 0.0) for key in keys
    ])
    lettered = np.array([any(g in HEBREW for g in key) for key in keys], bool)
    return Expected(keys, units, first, lettered)


def match(seen: Seen, text: Expected, font: Font, scale: float, options: Options, free: int = 0,
          blocks: list[tuple[int, int]] | None = None):
    """Un calage, à une échelle donnée."""
    skip_text = np.where(text.lettered, options.skip_text, 0.0)
    skip_seen = np.where(seen.stray, 1.0, options.skip_seen)
    unit = scale * float(font.advance[: len(HEBREW)].mean())
    return align(seen.width, seen.spans, seen.line, text.units * scale, text.first * scale,
                 skip_text, skip_seen, unit, options, blocks, free)


def align_zone(lines: list[Line], tokens: list[Token], font: Font, scale: float,
               options: Options, free: int = 0,
               blocks: list[tuple[int, int]] | None = None) -> ZoneResult:
    """Cale les mots vus d'une zone sur une suite de mots du texte. La zone
    peut commencer à n'importe lequel des `free` premiers mots du texte ;
    `blocks` : les commentaires, que le calage peut laisser entiers."""
    seen = seen_words(lines)
    result = ZoneResult(lines=lines, tokens=tokens, ranges=[None] * len(lines),
                        heads=[""] * len(lines), tails=[""] * len(lines), scale=scale)
    if len(seen) == 0 or not tokens:
        return result
    text = expected_words(tokens, font)
    # L'échelle : celle qu'on nous donne, puis celle qui accorde le mieux les
    # mots calés un pour un.
    found = None
    for _ in range(3):
        found = match(seen, text, font, scale, options, free, blocks)
        ratios = [
            seen.width[i] / text.units[span[0]]
            for i, span in enumerate(found.spans)
            if span and span[1] - span[0] == 1 and text.units[span[0]] > 1.2
        ]
        if len(ratios) < 20:
            break
        better = float(np.median(ratios))
        if abs(better - scale) < 0.004 * scale:
            break
        scale = better
    assert found is not None
    carried: set[int] = set()
    firsts: list[tuple[int, int]] = []
    for li in range(len(lines)):
        mine = [found.spans[i] for i in np.flatnonzero(seen.line == li) if found.spans[i]]
        if mine:
            firsts.append((li, mine[0][0]))
            for a, b in mine:
                carried.update(range(a, b))
    # Les lignes se partagent la suite : chacune va de son premier mot calé
    # à celui de la suivante, la première depuis le début de ce qui compte.
    for k, (li, start) in enumerate(firsts):
        if k == 0 and not free:
            # Ce que la page d'avant a laissé sans mot vu revient à sa
            # première ligne. Ce qu'on offrait seulement (free) n'est pas là.
            start = 0
        stop = firsts[k + 1][1] if k + 1 < len(firsts) else found.end
        result.ranges[li] = (start, stop)
        result.heads[li] = " ".join(t.text for t in tokens[start: min(start + 2, stop)])
        result.tails[li] = " ".join(t.text for t in tokens[max(start, stop - 2): stop])
    result.spans = found.spans
    result.cost = found.cost / max(1, len(seen))
    result.consumed = found.end
    result.scale = scale
    result.skipped_seen = sum(1 for s in found.spans if s is None)
    result.skipped_text = sum(
        1 for j in range(free, found.end) if j not in carried and text.lettered[j]
    )
    for i, span in enumerate(found.spans):
        if span and span[1] - span[0] == 1:
            result.samples.append((text.keys[span[0]], float(seen.width[i] / scale)))
    # Douteuse : une ligne dont les mots s'accordent mal avec ceux du texte.
    unit = scale * float(font.advance[: len(HEBREW)].mean())
    for li in range(len(lines)):
        mine = np.flatnonzero(seen.line == li)
        spans_here = [found.spans[i] for i in mine]
        if not any(spans_here):
            result.doubts.append(li)
            continue
        bad = sum(1 for s in spans_here if s is None)
        error = 0.0
        for i, span in zip(mine, spans_here):
            if span and span[1] - span[0] == 1:
                error += abs(seen.width[i] - text.units[span[0]] * scale) / unit
        if bad >= 2 or error / max(1, len(mine)) > 0.9:
            result.doubts.append(li)
    return result


# Suivre les commentaires au long des pages.
PROBE = 150     # les mots d'une colonne qu'on essaie pour savoir quel fil elle porte
NO_FIT = 1.6    # au-delà de ce coût par mot, aucun fil ne s'accorde à une colonne
SURE_FIT = 0.5  # sous ce coût par mot, un commentaire est bien à cette place
REPAIRS = 4     # les passes où l'on replace les commentaires hors de leur ordre


class Thread:
    """Le fil d'un commentaire (Rachi ou Tossafot) au long des pages.

    `blocks` : les commentaires que l'imprimé n'a pas encore donnés, dans
    l'ordre où l'on pense qu'il les donne (celui du fichier, à défaut de
    mieux) ; le premier peut être la fin d'un commentaire que la page d'avant
    a laissé en cours. `done` : les mots que les colonnes déjà prises ont
    portés sur cette page.
    """

    def __init__(self, name: str, font: Font):
        self.name = name
        self.font = font
        self.blocks: list[list[Token]] = []
        self.free = 0
        self.done = 0
        self.columns: list[list[Line]] = []
        self.moved: set[int] = set()
        self.scale = 0.0

    def stream(self) -> tuple[list[Token], list[tuple[int, int]]]:
        """Les mots du fil à plat, et les bornes de ses commentaires."""
        tokens: list[Token] = []
        bounds: list[tuple[int, int]] = []
        for block in self.blocks:
            bounds.append((len(tokens), len(tokens) + len(block)))
            tokens += block
        return tokens, bounds

    def try_column(self, seen: Seen, limit: int | None = None):
        """Cale une colonne sur la suite du fil."""
        tokens, bounds = self.stream()
        tokens = tokens[self.done:]
        bounds = [(max(0, a - self.done), b - self.done) for a, b in bounds if b > self.done]
        part = seen.part(0, limit) if limit else seen
        if len(part) == 0 or not tokens:
            return None
        text = expected_words(tokens, self.font)
        return match(part, text, self.font, self.scale, Options(free_end=True),
                     self.free if not self.done else 0, bounds)

    def probe(self, seen: Seen) -> float:
        """Ce qu'il en coûte par mot de continuer ce fil dans cette colonne."""
        found = self.try_column(seen, PROBE)
        return float("inf") if found is None else found.cost / max(1, min(len(seen), PROBE))

    def take(self, column: list[Line]) -> None:
        found = self.try_column(seen_words(column))
        self.columns.append(column)
        if found is not None:
            self.done += found.end

    def lines(self) -> list[Line]:
        return [line for column in self.columns for line in column]

    def settle(self, notes: list[str]) -> ZoneResult:
        """Le calage de la page pour ce fil. Un commentaire que le calage a
        laissé de côté alors qu'une suite de mots de la page reste sans
        texte est sans doute imprimé là, hors de l'ordre du fichier : on l'y
        replace et l'on recale."""
        lines = self.lines()
        seen = seen_words(lines)
        result = None
        for _ in range(REPAIRS + 1):
            tokens, bounds = self.stream()
            result = align_zone(lines, tokens, self.font, self.scale, Options(free_end=True),
                                self.free, bounds)
            if not self.replace(result, bounds, seen, notes):
                break
        assert result is not None
        return result

    def replace(self, result: ZoneResult, bounds: list[tuple[int, int]], seen: Seen,
                notes: list[str]) -> bool:
        """Déplace un commentaire laissé de côté vers les mots de la page qui
        l'attendent. Renvoie False quand il n'y a plus rien à déplacer."""
        carried = np.zeros(len(result.tokens) + 1, bool)
        for span in result.spans:
            if span:
                carried[span[0]: span[1]] = True
        left_out = [
            k for k, (a, b) in enumerate(bounds)
            if b <= result.consumed and b - a >= 3 and not carried[a:b].any()
            and not (k == 0 and self.free)
        ]
        # On essaie le début de chaque commentaire laissé de côté partout sur
        # la page : s'il s'accorde nettement quelque part, c'est qu'il est
        # imprimé là. Un commentaire déjà déplacé ne l'est pas deux fois.
        best = None
        for k in left_out:
            if id(self.blocks[k]) in self.moved or len(self.blocks[k]) < 4:
                continue
            head = self.blocks[k][:30]
            text = expected_words(head, self.font)
            for a in range(len(seen) - 3):
                window = seen.part(a, min(len(seen), a + int(1.6 * len(head)) + 12))
                if len(window) < 0.6 * len(head):
                    break
                found = match(window, text, self.font, result.scale, Options(free_seen=True))
                cost = found.cost / len(head)
                if cost <= SURE_FIT and (best is None or cost < best[0]):
                    best = (cost, k, a)
        if best is None:
            return False
        _, k, a = best
        # Le commentaire vient juste avant celui qui porte le mot vu suivant.
        after = next((span[0] for span in result.spans[a:] if span), result.consumed)
        target = next((i for i, (lo, hi) in enumerate(bounds) if lo <= after < hi), len(bounds))
        block = self.blocks.pop(k)
        self.moved.add(id(block))
        self.blocks.insert(target - 1 if k < target else target, block)
        notes.append(f"{self.name} : « {' '.join(t.text for t in block[:2])} » imprimé hors de l'ordre du fichier")
        return True

    def turn_page(self, result: ZoneResult, amud: int) -> list[list[Token]]:
        """Passe à la page suivante : garde la fin du commentaire en cours et
        ceux que la page n'a pas atteints. Rend ceux qu'elle a laissés de
        côté : le fichier les porte, l'imprimé ne les donne pas là."""
        _, bounds = self.stream()
        carried = np.zeros(len(result.tokens) + 1, bool)
        for span in result.spans:
            if span:
                carried[span[0]: span[1]] = True
        keep: list[list[Token]] = []
        gone: list[list[Token]] = []
        for k, ((a, b), block) in enumerate(zip(bounds, self.blocks)):
            if a >= result.consumed:
                keep.append(block)
            elif b > result.consumed:
                keep.append(block[result.consumed - a:])
            elif not carried[a:b].any() and not (k == 0 and self.free):
                gone.append(block)
        self.blocks = keep
        self.free = 0
        self.done = 0
        self.columns = []
        return gone


def assign(columns: list[list[Line]], threads: list[Thread], notes: list[str]) -> None:
    """Donne chaque colonne de commentaire au fil dont le texte s'y accorde.

    D'ordinaire Rachi tient la colonne de la reliure et Tossafot l'autre ;
    mais l'un prend les deux quand l'autre manque, et l'un passe sous la
    colonne de l'autre quand elle s'arrête. On prend donc, tant qu'il reste
    des colonnes, la paire colonne et fil qui s'accorde le mieux, et l'on fait
    avancer ce fil dans cette colonne.
    """
    left = list(columns)
    while left:
        best = None
        for column in left:
            seen = seen_words(column)
            for thread in threads:
                cost = thread.probe(seen)
                if best is None or cost < best[0]:
                    best = (cost, column, thread)
        assert best is not None
        cost, column, thread = best
        if cost > NO_FIT:
            notes.append(f"{len(left)} colonne(s) de commentaire sans texte qui s'y accorde")
            break
        thread.take(column)
        left.remove(column)


def runs_of(tokens: list[Token], amud: int) -> list[list[int]]:
    """Une suite de mots en morceaux de texte : `[passage, mot, nombre]`, et
    l'amoud en quatrième quand ce n'est pas celui de la page."""
    runs: list[list[int]] = []
    last: Token | None = None
    for token in tokens:
        follows = (
            last is not None and token.unit == last.unit and token.passage == last.passage
            and token.word == last.word + 1
        )
        if follows:
            runs[-1][2] += 1
        else:
            run = [token.passage, token.word, 1]
            if token.unit != amud:
                run.append(token.unit)
            runs.append(run)
        last = token
    return runs


def run(slug: str, first: int, last: int, fonts: dict[str, Font], review: str | None,
        quiet: bool = False, review_lines: bool = False,
        sample: int = 0) -> tuple[dict[int, dict[str, list]], dict]:
    """Les coupures des amoudim first à last (inclus), et le bilan du calage."""
    tractate = Tractate(slug)
    pdf, first_page, dpi = locate(slug)
    main_font = fonts.get("vilna-main", Font.rough())
    side_font = fonts.get("vilna-side", Font.rough())
    layout: dict[int, dict[str, list]] = {}
    report = {"pages": [], "samples": {"vilna-main": [], "vilna-side": []}}
    # Les deux fils de commentaire. Quand on commence au milieu d'un traité,
    # la première page s'ouvre sur la fin d'un commentaire de la page
    # d'avant : on lui en offre le dernier, qu'elle est libre de ne pas prendre.
    threads = {name: Thread(name, side_font) for name in ("rashi", "tosafot")}
    for name, thread in threads.items():
        before = tractate.blocks(name, first - 1)[-1:] if first > 0 else []
        thread.blocks = before + tractate.blocks(name, first)
        thread.free = len(before[0]) if before else 0
    absent: dict[int, dict[str, list]] = {}
    # L'échantillon de relecture : des lignes tirées au hasard, toujours les
    # mêmes pour un même passage (le tirage est semé par son nom).
    drawn: dict[str, list[tuple]] = {zone: [] for zone in ZONES}
    rng = np.random.default_rng(first * 1000 + last)
    for amud in range(first, last + 1):
        label = amud_label(amud)
        gray, zones = analyse(pdf, first_page + amud, dpi, label[-1])
        entry: dict[str, list] = {}
        results: dict[str, ZoneResult] = {}
        result = align_zone(zones.main, tractate.tokens("main", amud), main_font,
                            zones.sizes["main"], Options(abbreviations=True))
        results["main"] = result
        entry["main"] = [
            [result.tokens[r[0]].passage, result.tokens[r[0]].word]
            for r in result.ranges if r is not None
        ]
        for name, thread in threads.items():
            # Les commentaires de l'amoud suivant sont offerts aussi : un
            # commentaire s'imprime parfois une page avant son passage.
            if amud + 1 < len(tractate):
                thread.blocks += tractate.blocks(name, amud + 1)
            thread.scale = thread.scale or zones.sizes["side"]
        assign(zones.columns, list(threads.values()), zones.notes)
        for name, thread in threads.items():
            result = thread.settle(zones.notes)
            if result.cost < 1.0 and len(result.spans) > 100:
                thread.scale = result.scale
            results[name] = result
            # Ceux de cet amoud ou d'avant que la page a laissés de côté ne
            # viendront plus ; ceux de l'amoud suivant attendent leur page.
            # Ni les uns ni les autres ne sont dans les lignes de celle-ci.
            gone = thread.turn_page(result, amud)
            left_out = {id(token) for block in gone for token in block}
            entry[name] = [
                runs for runs in (
                    runs_of([t for t in result.tokens[r[0]: r[1]] if id(t) not in left_out], amud)
                    for r in result.ranges if r is not None
                ) if runs
            ]
            late = [block for block in gone if block[0].unit > amud]
            thread.blocks = sorted(late + thread.blocks, key=lambda block: (
                block[0].unit, block[0].passage, block[0].word))
            gone = [block for block in gone if block[0].unit <= amud]
            if amud == last:
                # Fin du passage : ce qui attend encore des amoudim d'avant
                # le dernier n'a pas été trouvé.
                gone += [block for block in thread.blocks if block[0].unit < amud]
            for block in gone:
                absent.setdefault(block[0].unit, {}).setdefault(name, []).extend(
                    runs_of(block, block[0].unit))
            if gone:
                zones.notes.append(f"{name} : {len(gone)} commentaire(s) du fichier absent(s) de l'imprimé")
        for zone, r in results.items():
            report["samples"]["vilna-main" if zone == "main" else "vilna-side"].extend(r.samples)
            for li, line in enumerate(r.lines):
                drawn[zone].append((rng.random(), gray, line, f"{label} {li + 1}", r.heads[li],
                                    r.tails[li], li in r.doubts))
        layout[amud] = entry
        report["pages"].append({
            "amud": label,
            "notes": zones.notes,
            **{
                zone: {
                    "lines": len(r.lines), "cost": round(r.cost, 3), "doubts": [d + 1 for d in r.doubts],
                    "skippedText": r.skipped_text, "skippedSeen": r.skipped_seen,
                    "scale": round(r.scale, 2),
                }
                for zone, r in results.items()
            },
        })
        if not quiet:
            cells = "  ".join(
                f"{zone[:4]} {len(r.lines):3d} l. coût {r.cost:.2f} douteuses {len(r.doubts):2d}"
                for zone, r in results.items()
            )
            print(f"{label:>4}  {cells}  {' ; '.join(zones.notes)}")
        if review:
            from review import overview, review_sheet  # noqa: PLC0415

            overview(gray, {zone: r.lines for zone, r in results.items()},
                     os.path.join(review, f"{slug}-{label}-page.png"))
            if review_lines:
                continue
            for zone, r in results.items():
                review_sheet(gray, r, os.path.join(review, f"{slug}-{label}-{zone}.png"), f"{slug} {label} {zone}")
    if review and sample:
        from review import review_rows  # noqa: PLC0415

        for zone, rows in drawn.items():
            picked = sorted(rows, key=lambda row: row[0])[:sample]
            review_rows([row[1:] for row in picked], os.path.join(review, f"sample-{zone}.png"),
                        f"{slug} {amud_label(first)} à {amud_label(last)}, {zone} : {len(picked)} lignes au hasard sur {len(rows)}")
            report.setdefault("lines", {})[zone] = len(rows)
    for amud, zones_absent in absent.items():
        if amud in layout:
            layout[amud]["absent"] = zones_absent
    report["through"] = last
    return layout, report


def write_layout(slug: str, layout: dict[int, dict[str, list]], through: int) -> list[str]:
    """Écrit les tranches de vingt amoudim, en gardant ce que les fichiers
    portent déjà pour les amoudim qu'on n'a pas refaits."""
    with open(os.path.join(TEXTS, "talmud", f"{slug}.json"), encoding="utf8") as f:
        title = json.load(f)["title"]
    # public/texts/talmud-layout porte les lignes lues par vilna.py, dans un
    # autre format : ce relevé sur scan reste hors du dépôt.
    out_dir = os.path.join(CACHE, "vilna-scan", "layout", slug)
    os.makedirs(out_dir, exist_ok=True)
    written = []
    for chunk in sorted({a // CHUNK for a in layout}):
        path = os.path.join(out_dir, f"{chunk}.json")
        data = {"title": title, "from": chunk * CHUNK, "edition": EDITION, "through": -1,
                "main": [], "rashi": [], "tosafot": [], "absent": []}
        if os.path.exists(path):
            with open(path, encoding="utf8") as f:
                data.update(json.load(f))
        for a in sorted(a for a in layout if a // CHUNK == chunk):
            i = a - chunk * CHUNK
            for zone in (*ZONES, "absent"):
                while len(data[zone]) <= i:
                    data[zone].append({} if zone == "absent" else [])
                data[zone][i] = layout[a].get(zone, {} if zone == "absent" else [])
        data["through"] = max(data["through"], min(through, (chunk + 1) * CHUNK - 1))
        with open(path, "w", encoding="utf8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        written.append(os.path.relpath(path, ROOT))
    return written


def calibrate(samples: dict[str, list], fonts: dict[str, Font]) -> dict[str, Font]:
    """Mesure les deux caractères de Vilna sur les mots calés un pour un."""
    out = {}
    for name, pairs in samples.items():
        if len(pairs) < 200:
            continue
        counts = glyph_counts([key for key, _ in pairs])
        widths = np.array([w for _, w in pairs], np.float32)
        prior = fonts.get(name, Font.rough())
        # On écarte les mots dont la largeur dément le caractère connu : ce
        # sont des calages faux, pas des mesures.
        keep = np.abs(prior.widths(counts) - widths) < 0.45
        out[name] = fit_font(counts[keep], widths[keep], prior, strength=4.0)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("tractate", help="le traité, comme dans public/texts/talmud (berakhot)")
    parser.add_argument("--from", dest="first", default="2a")
    parser.add_argument("--to", dest="last", default=None)
    parser.add_argument("--write", action="store_true", help="écrit le relevé dans le cache (le dépôt porte les lignes de vilna.py)")
    parser.add_argument("--review", help="dossier des planches de contrôle (hors dépôt)")
    parser.add_argument("--pages-only", action="store_true",
                        help="avec --review : seulement la vue d'ensemble de chaque page")
    parser.add_argument("--sample", type=int, default=0,
                        help="avec --review : planches de N lignes tirées au hasard par zone")
    parser.add_argument("--report", help="fichier JSON du bilan du calage (hors dépôt)")
    parser.add_argument("--calibrate", action="store_true",
                        help="mesure les caractères sur ces pages et écrit fonts.json")
    args = parser.parse_args()

    tractate = Tractate(args.tractate)
    first = amud_index(args.first)
    last = amud_index(args.last) if args.last else len(tractate) - 1
    fonts = load_fonts()
    if args.calibrate:
        # Deux passes : la première cale avec le caractère connu (ou un
        # caractère quelconque), la seconde avec celui qu'on vient de mesurer.
        for _ in range(2):
            _, report = run(args.tractate, first, last, fonts, None, quiet=True)
            fonts.update(calibrate(report["samples"], fonts))
        data = {"note": "Largeur des signes des caractères de Vilna, en parts de la hauteur "
                        "d'une lettre. Mesurée par talmud.py --calibrate ; ne pas éditer à la main."}
        data.update({name: font.to_json() for name, font in sorted(fonts.items())})
        with open(os.path.join(HERE, "fonts.json"), "w", encoding="utf8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("Caractères mesurés : scripts/layout/fonts.json")
    if args.review:
        os.makedirs(args.review, exist_ok=True)
    layout, report = run(args.tractate, first, last, fonts, args.review,
                         review_lines=args.pages_only or bool(args.sample), sample=args.sample)
    if args.report:
        report.pop("samples")
        with open(args.report, "w", encoding="utf8") as f:
            json.dump(report, f, ensure_ascii=False, indent=1)
    if args.write:
        for path in write_layout(args.tractate, layout, last):
            print("écrit", path)


if __name__ == "__main__":
    main()
