"""Les planches de contrôle : chaque ligne du scan à côté de ce que le calage
en dit, pour qu'un œil vérifie le premier et le dernier mot.

Une planche montre, pour chaque ligne, le début de la ligne imprimée (son
bord droit) et sa fin (son bord gauche), puis les deux premiers et les deux
derniers mots que le calage lui donne. Les traits sous l'image sont les mots
que l'analyse a vus. Les planches vont hors du dépôt.
"""

from __future__ import annotations

import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Une police qui porte l'hébreu, parmi celles qu'on trouve sur un poste.
FONT_FILES = (
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/ArialHB.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf",
)
EDGE = 430
ROW = 86
TEXT = 600
PER_SHEET = 22


def caption_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_FILES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def visual(text: str) -> str:
    """Un texte hébreu dans l'ordre où Pillow le dessine (de gauche à droite)."""
    return text[::-1]


def edge_crops(gray: np.ndarray, line, pad: int = 8) -> tuple[np.ndarray, np.ndarray]:
    """Le début (bord droit) et la fin (bord gauche) d'une ligne."""
    h, w = gray.shape
    y0, y1 = max(0, line.y0 - pad), min(h, line.y1 + pad)
    x0, x1 = max(0, line.x0 - 2 * pad), min(w, line.x1 + 2 * pad)
    strip = cv2.cvtColor(gray[y0:y1, x0:x1], cv2.COLOR_GRAY2BGR)
    base = strip.shape[0] - 3
    for word in line.words:
        colour = (0, 140, 255) if word.stray else (200, 60, 0)
        cv2.line(strip, (word.x0 - x0, base), (word.x1 - x0, base), colour, 3)
    width = strip.shape[1]
    if width <= 2 * EDGE:
        return strip, strip[:, :0]
    return strip[:, width - EDGE:], strip[:, :EDGE]


def review_rows(rows: list[tuple], path: str, title: str) -> list[str]:
    """Écrit une ou plusieurs planches. Chaque rangée : (image de la page,
    ligne, étiquette, début, fin, douteuse)."""
    font = caption_font(26)
    small = caption_font(18)
    written = []
    for sheet, at in enumerate(range(0, len(rows), PER_SHEET)):
        part = rows[at: at + PER_SHEET]
        width = 2 * EDGE + 30 + TEXT
        image = Image.new("RGB", (width, 40 + ROW * len(part)), "white")
        draw = ImageDraw.Draw(image)
        draw.text((10, 8), f"{title}  (planche {sheet + 1})", font=small, fill=(0, 0, 0))
        for k, (gray, line, number, start, end, doubt) in enumerate(part):
            y = 40 + ROW * k
            begin, finish = edge_crops(gray, line)
            for crop, x_right in ((begin, 2 * EDGE + 20), (finish, EDGE)):
                if crop.shape[1] == 0:
                    continue
                scale = min(1.0, (ROW - 8) / crop.shape[0])
                if scale < 1.0:
                    crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
                tile = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
                image.paste(tile, (x_right - tile.width, y))
            colour = (200, 0, 0) if doubt else (0, 0, 0)
            x = 2 * EDGE + 30
            draw.text((x, y + 2), f"{number}", font=small, fill=colour)
            draw.text((x + 170, y), visual(start) + "  ◀ " if start else "(rien)", font=font, fill=colour)
            draw.text((x + 170, y + 38), "▶  " + visual(end) if end else "", font=font, fill=(90, 90, 90))
            draw.line((0, y + ROW - 2, width, y + ROW - 2), fill=(220, 220, 220))
        out = path if len(rows) <= PER_SHEET else path.replace(".png", f"-{sheet + 1}.png")
        image.save(out)
        written.append(out)
    return written


def review_sheet(gray: np.ndarray, result, path: str, title: str) -> list[str]:
    """Les planches d'une zone d'une page (ZoneResult de talmud.py)."""
    rows = [
        (gray, line, i + 1, result.heads[i], result.tails[i], i in result.doubts)
        for i, line in enumerate(result.lines)
    ]
    return review_rows(rows, path, f"{title} : coût {result.cost:.2f}")


COLOURS = {"main": (0, 0, 230), "rashi": (0, 150, 0), "tosafot": (230, 90, 0)}


def overview(gray: np.ndarray, zones: dict[str, list], path: str, scale: float = 0.42) -> None:
    """La page entière, ses trois zones encadrées ligne par ligne : rouge pour
    la guemara, vert pour Rachi, bleu pour Tossafot."""
    image = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    for name, lines in zones.items():
        colour = COLOURS[name]
        for k, line in enumerate(lines):
            cv2.rectangle(image, (line.x0 - 3, line.y0 - 2), (line.x1 + 3, line.y1 + 2), colour, 2)
            for word in line.words:
                y = int(line.yc + line.xh * 0.75)
                cv2.line(image, (word.x0, y), (word.x1, y), (0, 140, 255) if word.stray else colour, 4)
            cv2.putText(image, str(k + 1), (line.x1 + 6, int(line.yc + 8)), cv2.FONT_HERSHEY_SIMPLEX,
                        0.8, colour, 2)
    cv2.imwrite(path, cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA))
