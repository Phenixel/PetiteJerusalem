#!/usr/bin/env python3
"""
Builds the Hebrew reading fonts served from public/fonts.

Two problems with the fonts as published, both fixed here:

1. The qamats qatan (U+05C7, the qamats read "o", as in כׇּל) looks like an
   ordinary qamats: every font draws it with a stem only 2 to 4 % of an em
   longer, invisible at reading size. We lengthen its stem by STEM_EM, the
   way printed siddurim mark it, and touch no other glyph.
2. Frank Ruhl Libre, David Libre and Heebo draw no teamim, so a cantillated
   word falls back to another font. Noto Serif Hebrew, the old fallback, sets
   the vowel and the te'am under the same letter against each other (רַ֣,
   מָֽ). Taamey Frank CLM (Culmus project) carries the Biblical Hebrew layout
   logic of SBL Hebrew and leaves room between them: it becomes the fallback.

The qamats qatan is also made a color glyph (COLR v0): a single layer, a
copy of its outline, painted with entry 0 of the palette. The page sets
that entry to the theme color with @font-palette-values (useTheme.ts); a
browser that cannot override it paints it in INK, the default theme ink.

Each source is downloaded, checked against its SHA-256, modified, renamed
and written as woff2. Run it again only to change a source or STEM_EM:

    pip install fonttools brotli
    python3 scripts/hebrew-fonts.py

Licenses: the Google fonts are OFL (no reserved name); Taamey Frank CLM is
GPL v2 with a font embedding exception and reserves its name, so the
modified version is called "Taamey Frank PJ" and keeps the exception
(see public/fonts/hebrew-reading-fonts.LICENSE.txt). The decision is
recorded in docs/design.md, "Hebrew reading fonts".
"""

import copy
import hashlib
import io
import os
import sys
import urllib.request

from fontTools import subset
from fontTools.colorLib.builder import buildCOLR, buildCPAL
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "fonts")

# How much longer the stem of the qamats qatan gets, in em.
STEM_EM = 0.1

# The color of the qamats qatan where the page does not set it: the ink of
# the default theme ("sunset", --color-primary in main.css).
INK = (0xD4, 0x6D, 0x01)

GSTATIC = "https://fonts.gstatic.com/s"
SEFARIA = "https://raw.githubusercontent.com/Sefaria/Sefaria-Project/master/static/fonts/Taamey-Frank"

# (output file, source URL, SHA-256, new family name, subset to Hebrew).
# Only the Medium of Taamey Frank: its Bold has empty glyphs for every
# te'am (U+0591 to U+05AF), a bold cantillated word would lose them. The
# browser thickens the Medium for bold text instead.
FONTS = [
    (
        "frank-ruhl-libre-hebrew-var.woff2",
        f"{GSTATIC}/frankruhllibre/v23/j8_w6_fAw7jrcalD7oKYNX0QfAnPW7Ll4ajn.woff2",
        "acdf9ed0a3fc287df8401d796892c1f72118f291e510e38328396f48e200b08c",
        "Frank Ruhl Libre PJ",
        False,
    ),
    (
        "david-libre-hebrew-400.woff2",
        f"{GSTATIC}/davidlibre/v17/snfus0W_99N64iuYSvp4W8l54J-jYQ.woff2",
        "9dedc029ea208eec5cc04c6a289dd1ca30bc4adf78a4dc9c146ccbae87512b2e",
        "David Libre PJ",
        False,
    ),
    (
        "david-libre-hebrew-500.woff2",
        f"{GSTATIC}/davidlibre/v17/snfzs0W_99N64iuYSvp4W8GIw4qeQDKhSg.woff2",
        "08f5b82d26b140c763a2b466f20817a3bd0c7842815df49eb8503ab2211b9e7c",
        "David Libre PJ",
        False,
    ),
    (
        "david-libre-hebrew-700.woff2",
        f"{GSTATIC}/davidlibre/v17/snfzs0W_99N64iuYSvp4W8HAxYqeQDKhSg.woff2",
        "1b4fc136888d6c5ee65740aade6660f68bbc75c65bac663938c9ec50f07fe5af",
        "David Libre PJ",
        False,
    ),
    (
        "heebo-hebrew-var.woff2",
        f"{GSTATIC}/heebo/v28/NGS6v5_NC0k9P9H0TbFzsQ.woff2",
        "f1f7cfaef59431c7b391df81fb05520273303840bbe917213a2ab9f41b839675",
        "Heebo PJ",
        False,
    ),
    (
        "taamey-frank-pj-medium.woff2",
        f"{SEFARIA}/TaameyFrankCLM-Medium.ttf",
        "f558d3564d385a6a512ce938705f47236e71457e8aa4ad9eaf6cebc3e17b991c",
        "Taamey Frank PJ",
        True,
    ),
]

# The Hebrew block, the presentation forms, the dotted circle and the
# joiners and dashes: the same range as the @font-face rules in main.css.
HEBREW = (
    list(range(0x0590, 0x0600))
    + list(range(0xFB1D, 0xFB50))
    + list(range(0x200C, 0x2011))
    + [0x20AA, 0x25CC]
)

NOTE = (
    "Modified by Petite Jerusalem: the stem of the qamats qatan (U+05C7) is "
    f"{STEM_EM} em longer, to tell it from the qamats, and it is a color "
    "glyph (COLR) painted with the first palette entry."
)


def fetch(url: str, sha: str) -> bytes:
    with urllib.request.urlopen(url) as res:
        data = res.read()
    got = hashlib.sha256(data).hexdigest()
    if got != sha:
        sys.exit(f"{url}: SHA-256 {got}, expected {sha}")
    return data


def lengthen_qatan(font: TTFont) -> None:
    """Moves the lower part of the qamats qatan down by STEM_EM.

    The glyph is a bar with a stem under it. The points in the lowest 40 %
    of its height (the end of the stem, with its drop or its serif) all
    move down by the same amount: the end keeps its shape and the stem
    grows. In a variable font the deltas of each point still apply.
    """
    name = font.getBestCmap()[0x05C7]
    glyf = font["glyf"]
    glyph = glyf[name]
    if glyph.isComposite():
        sys.exit(f"{name}: composite glyph, not handled")
    coords = glyph.coordinates
    ys = [y for _, y in coords]
    low, high = min(ys), max(ys)
    limit = low + 0.4 * (high - low)
    shift = round(STEM_EM * font["head"].unitsPerEm)
    for i, (x, y) in enumerate(coords):
        if y < limit:
            coords[i] = (x, y - shift)
    glyph.recalcBounds(glyf)


def color_qatan(font: TTFont) -> None:
    """Paints the qamats qatan with palette entry 0 (COLR v0).

    The layer is a copy of the glyph (with its variations in a variable
    font), not the glyph itself: a base glyph that is its own layer is not
    drawn the same way everywhere.
    """
    name = font.getBestCmap()[0x05C7]
    ink = f"{name}.ink"
    # Read every table that counts glyphs before the count changes.
    for tag in ("glyf", "hmtx", "gvar", "HVAR", "post"):
        if tag in font:
            font[tag]
    order = list(font.getGlyphOrder())
    glyf = font["glyf"]
    glyf[ink] = copy.deepcopy(glyf[name])
    font["hmtx"][ink] = font["hmtx"][name]
    if "gvar" in font:
        font["gvar"].variations[ink] = copy.deepcopy(font["gvar"].variations.get(name, []))
    if "HVAR" in font:
        hvar = font["HVAR"].table
        for mapping in (hvar.AdvWidthMap, hvar.LsbMap, hvar.RsbMap):
            if mapping is not None:
                mapping.mapping[ink] = mapping.mapping[name]
        if hvar.AdvWidthMap is None:
            sys.exit("HVAR without a glyph mapping, not handled")
    order.append(ink)
    font.setGlyphOrder(order)
    glyf.glyphOrder = order
    font["COLR"] = buildCOLR({name: [(ink, 0)]}, version=0)
    font["CPAL"] = buildCPAL([[tuple(c / 255 for c in INK) + (1.0,)]])


def rename(font: TTFont, family: str) -> None:
    names = font["name"]
    style = names.getDebugName(17) or names.getDebugName(2) or "Regular"
    for record in list(names.names):
        if record.nameID in (1, 16):
            record.string = family
        elif record.nameID == 4:
            record.string = f"{family} {style}"
        elif record.nameID == 6:
            record.string = f"{family}-{style}".replace(" ", "")
        elif record.nameID == 3:
            record.string = f"{family} {style}; Petite Jerusalem"
        elif record.nameID == 0:
            record.string = f"{record.toUnicode()}\n{NOTE}"


def subset_hebrew(font: TTFont) -> None:
    options = subset.Options()
    options.layout_features = ["*"]
    options.hinting = False
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=HEBREW)
    subsetter.subset(font)


def main() -> None:
    for out, url, sha, family, to_hebrew in FONTS:
        font = TTFont(io.BytesIO(fetch(url, sha)))
        if to_hebrew:
            subset_hebrew(font)
        lengthen_qatan(font)
        color_qatan(font)
        rename(font, family)
        font.flavor = "woff2"
        path = os.path.join(OUT, out)
        font.save(path)
        print(f"{out}: {os.path.getsize(path)} bytes")


if __name__ == "__main__":
    main()
