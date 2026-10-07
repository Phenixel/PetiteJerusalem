"""Les colonnes et les lignes du Sefer Torah, d'après un tikoun soferim.

    python3 scripts/layout/torah.py 279 --write        (Bechala'h)

Un tikoun soferim imprime la Torah comme le sofer l'écrit : les mêmes mots
sur chaque ligne, les mêmes lignes dans chaque colonne. Pour chaque page du
scan : les lignes et leurs mots sont relevés sur l'image (segment.py), puis
calés sur le texte de la paracha (align.py). Il en sort, pour chaque colonne,
la place du premier mot de chaque ligne : `[verset, mot]`.

Le scan suit toute la Torah sans s'arrêter aux parachiot : la première page
d'une paracha commence par la fin de la précédente, la dernière finit par le
début de la suivante. On donne donc au calage quelques versets de chaque
côté, qu'il est libre de ne pas prendre, et l'on ne garde que les lignes de
la paracha.

Les grandes et les petites lettres ne se lisent pas sur l'image : elles
viennent du texte de Sefaria (Miqra selon la Massora), qui les balise.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from align import Font, Options, fit_font, glyph_counts  # noqa: E402
from daf import Line, build_lines  # noqa: E402
from imaging import load_page, render_page  # noqa: E402
from segment import find_segments  # noqa: E402
from talmud import CACHE, HERE, ZoneResult, align_zone, load_fonts, load_sources  # noqa: E402
from texts import ROOT, TEXTS, Parasha, Token, scroll_verse_words  # noqa: E402

SOURCE = "ezrat-hasofer"
EDITION = "ezrat-hasofer-1769"
ROWS = 21  # lignes par page : une colonne de 42 lignes tient sur deux pages
# Le blanc entre deux mots, et les plus petites lettres qui font un mot, en
# parts de la hauteur d'une lettre.
WORD_GAP = 0.2
SMALL = 0.5
# Un blanc de cette largeur dans une ligne est voulu : setouma, ou brique
# d'une chira.
BLANK = 2.2
# Les versets offerts de chaque côté de la paracha.
MARGIN = 500
GCS = "https://storage.googleapis.com/sefaria-export/json/Tanakh/Torah"


def scan_pdf() -> tuple[str, dict]:
    source = load_sources()[SOURCE]
    pdf = os.path.join(CACHE, "sources", "ezrat-1769", "ezrat.pdf")
    if not os.path.exists(pdf):
        raise SystemExit(f"Scan absent : {pdf}\nLancer d'abord : python3 scripts/layout/fetch.py ezrat-hasofer")
    return pdf, source


def page_lines(pdf: str, page: int, dpi: int) -> tuple[np.ndarray, list[Line], list[str]]:
    """Les lignes de texte d'une page du tikoun, de haut en bas."""
    png = render_page(pdf, page, dpi, os.path.join(os.path.dirname(pdf), "pages"))
    gray, ink, _ = load_page(png)
    k = dpi / 144
    # Une seule colonne par page : pas de gouttière à chercher (la règle
    # demande plus de lignes que la page n'en porte).
    found = find_segments(ink, max_letter=round(110 * k), gutters=[(round(30 * k), 60)],
                          reach=round(70 * k), bridge=1, speck=round(8 * k))
    sure = [s for s in found.segments if len(s.boxes) >= 6]
    notes: list[str] = []
    if not sure:
        return gray, [], ["page sans texte"]
    xh = float(np.median(np.repeat([s.xh for s in sure], [max(1, s.width // 40) for s in sure])))
    body = [s for s in found.segments if 0.75 * xh <= s.xh <= 1.35 * xh and len(s.boxes) >= 2]
    pitch = 2.0 * xh
    lines = build_lines(body, pitch, WORD_GAP, SMALL)
    # Le corps de la page : ce qui tient dans la colonne. Le titre courant
    # est au-dessus, à plus d'un interligne ; la réclame est dessous, courte.
    wide = [line for line in lines if line.x1 - line.x0 > 12 * xh]
    left = float(np.median([line.x0 for line in wide]))
    right = float(np.median([line.x1 for line in wide]))
    lines = [line for line in lines if line.x1 > left and line.x0 < right]
    # Une page porte son titre courant, vingt et une lignes, puis une rangée
    # de pied (la réclame, parfois la signature du cahier). Le titre se
    # reconnaît à ce qu'il est un peu détaché du texte : l'écart qui le suit
    # dépasse l'interligne d'un dixième.
    steps = np.diff([line.yc for line in lines])
    step = float(np.median(steps)) if len(steps) else pitch
    rows = len(lines)
    head = next((k for k in range(min(3, len(steps)))
                 if 1.06 * step < steps[k] < 1.3 * step and rows - k - 1 >= ROWS), None)
    if head is not None:
        lines = lines[head + 1: head + 1 + ROWS]
    else:
        notes.append("titre courant non reconnu")
        lines = lines[:ROWS]
    for line in lines:
        line.words = [w for w in line.words if w.x1 > left - xh and w.x0 < right + xh]
    if len(lines) != ROWS:
        notes.append(f"{len(lines)} lignes gardées, {ROWS} attendues")
    return gray, lines, notes


def blanks(line: Line) -> list[int]:
    """Les mots de la ligne que précède un blanc voulu (setouma, chira)."""
    out = []
    for i in range(1, len(line.words)):
        gap = line.words[i - 1].x0 - line.words[i].x1
        if gap >= BLANK * line.xh:
            out.append(i)
    return out


def neighbour_tokens(ident: int, tail: bool) -> list[Token]:
    """Les derniers (ou les premiers) mots de la paracha voisine."""
    path = os.path.join(TEXTS, "tanakh", f"{ident}.json")
    if not os.path.exists(path):
        return []
    tokens = Parasha(ident).tokens()
    return tokens[-MARGIN:] if tail else tokens[:MARGIN]


def special_letters(parasha: Parasha) -> dict[str, list[list[int]]]:
    """Les grandes et les petites lettres de la paracha : `[verset, mot,
    lettre]`, d'après le balisage du texte source de Sefaria."""
    cache = os.path.join(CACHE, "sources", "sefaria")
    os.makedirs(cache, exist_ok=True)
    path = os.path.join(cache, f"{parasha.book}.json")
    if not os.path.exists(path):
        url = f"{GCS}/{urllib.parse.quote(parasha.book)}/Hebrew/merged.json"
        with urllib.request.urlopen(url, timeout=60) as response, open(path, "wb") as f:
            f.write(response.read())
    with open(path, encoding="utf8") as f:
        book = json.load(f)["text"]
    m = re.match(r"(\d+):(\d+)-(\d+):(\d+)", parasha.range)
    if not m:
        return {"big": [], "small": []}
    c0, v0, c1, v1 = (int(g) for g in m.groups())
    raw: list[str] = []
    for c in range(c0, c1 + 1):
        verses = book[c - 1]
        first = v0 if c == c0 else 1
        last = v1 if c == c1 else len(verses)
        raw += verses[first - 1: last]
    out: dict[str, list[list[int]]] = {"big": [], "small": []}
    if len(raw) != len(parasha.verses):
        return out
    letters_only = lambda word: re.sub("[^א-ת]", "", word)  # noqa: E731
    for v, verse in enumerate(raw):
        # Les notes d'édition ne sont pas du texte.
        verse = re.sub(r"<sup[^>]*>.*?</sup>|<i class=\"footnote\">.*?</i>", "", verse)
        ours = [letters_only(w) for w in scroll_verse_words(parasha.verses[v])]
        for kind in ("big", "small"):
            marked = re.sub(rf"<{kind}>([^<]*)</{kind}>", lambda g: "\u0001" + g.group(1) + "\u0002", verse)
            marked = marked.replace("\u0001\u05c0\u0002", "\u05c0")  # le passek n'est pas une lettre
            if "\u0001" not in marked:
                continue
            # Le découpage du lecteur, les marques en plus ; on ne garde le
            # relevé que s'il retombe sur les mots de notre fichier.
            kept = re.sub(r"&[a-z]+;", " ", marked)
            kept = re.sub(r"\*\([^)]*\)|\{[א-ת]\}|\[[^\]]*\]|<[^>]*>", " ", kept)
            kept = kept.replace("\u05BE", " ")
            pieces = [w for w in kept.split() if re.search("[א-ת]", w)]
            if [letters_only(w) for w in pieces] != ours:
                continue
            for w, piece in enumerate(pieces):
                letter, inside = 0, False
                for ch in piece:
                    if ch == "\u0001":
                        inside = True
                    elif ch == "\u0002":
                        inside = False
                    elif "א" <= ch <= "ת":
                        if inside:
                            out[kind].append([v, w, letter])
                        letter += 1
    return out


def run(ident: int, fonts: dict[str, Font], review: str | None, sample: int = 0):
    """Les colonnes d'une paracha, et le bilan du calage."""
    pdf, source = scan_pdf()
    declared = source["parashiot"][str(ident)]
    pages = declared["pages"]
    parasha = Parasha(ident)
    font = fonts.get("ezrat", Font.rough())
    before = neighbour_tokens(ident - 1, tail=True)
    stream = before + parasha.tokens() + neighbour_tokens(ident + 1, tail=False)
    free = len(before) + declared.get("missingStart", 0)
    # Dans un tikoun les mots sont bien séparés : deux mots du texte pour un
    # mot vu est rare, une lettre étirée ne l'est pas.
    options = Options(free_end=True, stretch=2.0, merge_cost=7.0, split_cost=3.0)
    columns: dict[int, dict] = {}
    report = {"pages": [], "samples": []}
    drawn: list[tuple] = []
    rng = np.random.default_rng(ident)
    scale = 0.0
    for page, column, first_row in pages:
        gray, lines, notes = page_lines(pdf, page, source["dpi"])
        xh = float(np.median([line.xh for line in lines])) if lines else 0.0
        result: ZoneResult = align_zone(lines, stream, font, scale or xh, options, free)
        if result.cost < 1.0:
            scale = result.scale
        # Si la page ne prend rien de ce qu'on offrait d'avant la paracha,
        # c'est qu'elle commence plus loin : on ne garde l'offre que pour elle.
        for li, line in enumerate(lines):
            span = result.ranges[li]
            if span is None:
                continue
            token = stream[span[0]]
            drawn.append((rng.random(), gray, line, f"p.{page} l.{first_row + li + 1}",
                          result.heads[li], result.tails[li], li in result.doubts,
                          token.unit == ident))
            # La ligne où la paracha commence la porte aussi, même si son
            # premier mot est encore de la paracha d'avant.
            inside = [t for t in stream[span[0]: span[1]] if t.unit == ident]
            if not inside:
                continue
            entry = columns.setdefault(column, {"column": column, "rows": {}})
            # La ligne commence à son premier mot calé : un mot du texte
            # resté sans mot vu en tête de page appartient à la page d'avant.
            starts = _word_starts(result, li, len(line.words))
            first = stream[min(starts.values())] if starts else inside[0]
            if first.unit != ident:
                first = inside[0]
            row = {"at": [first.passage, first.word]}
            gaps = blanks(line)
            if gaps:
                # Le blanc précède un mot vu ; on donne le mot du texte calé là.
                row["blanks"] = [
                    [stream[j].passage, stream[j].word]
                    for j in (starts.get(i) for i in gaps) if j is not None and stream[j].unit == ident
                ]
            entry["rows"][first_row + li] = row
        report["pages"].append({
            "page": page, "column": column, "lines": len(lines), "cost": round(result.cost, 3),
            "doubts": [d + 1 for d in result.doubts], "notes": notes,
        })
        report["samples"].extend(result.samples)
        print(f"p.{page} colonne {column} : {len(lines)} lignes, coût {result.cost:.2f}, "
              f"douteuses {len(result.doubts)}  {' ; '.join(notes)}")
        if review:
            from review import review_sheet  # noqa: PLC0415

            os.makedirs(review, exist_ok=True)
            review_sheet(gray, result, os.path.join(review, f"torah-{ident}-p{page}.png"),
                         f"{parasha.title} p.{page}, colonne {column}")
        stream = stream[result.consumed:]
        free = 0
    if review and sample:
        from review import review_rows  # noqa: PLC0415

        mine = [row for row in drawn if row[-1]]
        picked = sorted(mine, key=lambda row: row[0])[:sample]
        review_rows([row[1:-1] for row in picked], os.path.join(review, f"sample-torah-{ident}.png"),
                    f"{parasha.title} : {len(picked)} lignes au hasard sur {len(mine)}")
    layout = {
        "title": parasha.title,
        "edition": EDITION,
        "columns": [
            {
                "column": c["column"],
                "from": min(c["rows"]),
                "lines": [c["rows"][r]["at"] for r in sorted(c["rows"])],
            }
            for c in (columns[k] for k in sorted(columns))
        ],
        "blanks": [b for c in columns.values() for r in c["rows"].values() for b in r.get("blanks", [])],
        **special_letters(parasha),
    }
    layout["blanks"].sort()
    for c in columns.values():
        if sorted(c["rows"]) != list(range(min(c["rows"]), max(c["rows"]) + 1)):
            print(f"colonne {c['column']} : des lignes sans mot calé, le fichier serait décalé")
    return layout, report


def _word_starts(result: ZoneResult, line_index: int, count: int) -> dict[int, int]:
    """Pour chaque mot vu d'une ligne (par son rang), le premier mot du texte
    qu'il porte."""
    offset = sum(len(line.words) for line in result.lines[:line_index])
    out = {}
    for i in range(count):
        span = result.spans[offset + i] if offset + i < len(result.spans) else None
        if span:
            out[i] = span[0]
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("parasha", type=int, help="le numéro de la paracha (public/texts/tanakh)")
    parser.add_argument("--write", action="store_true", help="écrit public/texts/torah-layout")
    parser.add_argument("--review", help="dossier des planches de contrôle (hors dépôt)")
    parser.add_argument("--sample", type=int, default=0,
                        help="avec --review : une planche de N lignes tirées au hasard")
    parser.add_argument("--calibrate", action="store_true",
                        help="mesure le caractère du tikoun sur ces pages et l'écrit dans fonts.json")
    args = parser.parse_args()
    fonts = load_fonts()
    if args.calibrate:
        for _ in range(2):
            _, report = run(args.parasha, fonts, None)
            pairs = report["samples"]
            counts = glyph_counts([key for key, _ in pairs])
            widths = np.array([w for _, w in pairs], np.float32)
            prior = fonts.get("ezrat", Font.rough())
            # Les mots étirés ne mesurent pas le caractère : on les écarte.
            keep = np.abs(prior.widths(counts) - widths) < 0.45
            fonts["ezrat"] = fit_font(counts[keep], widths[keep], prior, strength=4.0)
        path = os.path.join(HERE, "fonts.json")
        with open(path, encoding="utf8") as f:
            data = json.load(f)
        data["ezrat"] = fonts["ezrat"].to_json()
        with open(path, "w", encoding="utf8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
    layout, _ = run(args.parasha, fonts, args.review, args.sample)
    if args.write:
        out = os.path.join(TEXTS, "torah-layout")
        os.makedirs(out, exist_ok=True)
        path = os.path.join(out, f"{args.parasha}.json")
        with open(path, "w", encoding="utf8") as f:
            json.dump(layout, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        print("écrit", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
