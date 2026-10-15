"""Les images de comparaison : le scan à gauche, notre rendu à droite.

    python3 scripts/layout/compare.py talmud berakhot 2a 10b RENDU... --out DOSSIER
    python3 scripts/layout/compare.py torah 279 RENDU --out DOSSIER

RENDU : les dossiers de captures de capture.mjs (les amoudim dans l'ordre du
traité, à partir du premier demandé). Les deux images sont ramenées à la même
hauteur. Rien ne va dans le dépôt.
"""

from __future__ import annotations

import argparse
import glob
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from imaging import render_page  # noqa: E402
from talmud import amud_index, amud_label, locate  # noqa: E402
from torah import scan_pdf  # noqa: E402

HEIGHT = 2200
GAP = 40


def fit(image: np.ndarray, height: int) -> np.ndarray:
    scale = height / image.shape[0]
    return cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)


def side_by_side(left: np.ndarray, right: np.ndarray, title: str) -> np.ndarray:
    """Deux images côte à côte sur fond blanc, sous un titre."""
    left, right = fit(left, HEIGHT), fit(right, HEIGHT)
    width = left.shape[1] + GAP + right.shape[1]
    sheet = np.full((HEIGHT + 70, width, 3), 255, np.uint8)
    sheet[70:, : left.shape[1]] = left
    sheet[70:, left.shape[1] + GAP:] = right
    cv2.putText(sheet, title, (16, 46), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (40, 40, 40), 2)
    return sheet


def crop_text(gray: np.ndarray) -> np.ndarray:
    """Rogne les marges vides d'une page de scan."""
    dark = gray < 110
    rows = np.flatnonzero(dark.sum(axis=1) > 0.01 * gray.shape[1])
    cols = np.flatnonzero(dark.sum(axis=0) > 0.01 * gray.shape[0])
    if len(rows) == 0 or len(cols) == 0:
        return gray
    pad = 30
    return gray[max(0, rows[0] - pad): rows[-1] + pad, max(0, cols[0] - pad): cols[-1] + pad]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="kind", required=True)
    talmud = sub.add_parser("talmud")
    talmud.add_argument("tractate")
    talmud.add_argument("first")
    talmud.add_argument("last")
    talmud.add_argument("renders", nargs="+")
    talmud.add_argument("--out", required=True)
    torah = sub.add_parser("torah")
    torah.add_argument("parasha")
    torah.add_argument("render")
    torah.add_argument("--out", required=True)
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)

    if args.kind == "talmud":
        pdf, first_page, dpi = locate(args.tractate)
        ours = [f for folder in args.renders for f in sorted(glob.glob(os.path.join(folder, "daf-*.png")))]
        first, last = amud_index(args.first), amud_index(args.last)
        for amud in range(first, last + 1):
            if amud - first >= len(ours):
                break
            png = render_page(pdf, first_page + amud, dpi, os.path.join(os.path.dirname(pdf), "pages"))
            scan = cv2.cvtColor(crop_text(cv2.imread(png, cv2.IMREAD_GRAYSCALE)), cv2.COLOR_GRAY2BGR)
            label = amud_label(amud)
            sheet = side_by_side(scan, cv2.imread(ours[amud - first]),
                                 f"{args.tractate} {label} : Vilna (Romm) a gauche, notre rendu a droite")
            cv2.imwrite(os.path.join(args.out, f"{args.tractate}-{label}.jpg"), sheet,
                        [cv2.IMWRITE_JPEG_QUALITY, 82])
        return

    pdf, source = scan_pdf()
    declared = source["parashiot"][args.parasha]
    ours = cv2.imread(os.path.join(args.render, "torah.png"))
    pages = [p for p, _, _ in declared["pages"]]
    # Une colonne du rouleau : deux pages du tikoun l'une sous l'autre. Notre
    # rendu coule librement : on le coupe en tranches de même proportion.
    columns = [pages[i: i + 2] for i in range(0, len(pages), 2)]
    slice_height = ours.shape[0] // len(columns)
    for k, pair in enumerate(columns):
        scans = []
        for page in pair:
            png = render_page(pdf, page, source["dpi"], os.path.join(os.path.dirname(pdf), "pages"))
            scans.append(crop_text(cv2.imread(png, cv2.IMREAD_GRAYSCALE)))
        width = max(s.shape[1] for s in scans)
        scans = [cv2.copyMakeBorder(s, 0, 0, 0, width - s.shape[1], cv2.BORDER_CONSTANT, value=255) for s in scans]
        scan = cv2.cvtColor(np.vstack(scans), cv2.COLOR_GRAY2BGR)
        part = ours[k * slice_height: (k + 1) * slice_height]
        sheet = side_by_side(scan, part,
                             f"{declared['name']}, pages {pair[0]} a {pair[-1]} du tikoun : scan a gauche, notre rendu a droite")
        cv2.imwrite(os.path.join(args.out, f"torah-{args.parasha}-{k + 1}.jpg"), sheet,
                    [cv2.IMWRITE_JPEG_QUALITY, 82])


if __name__ == "__main__":
    main()
