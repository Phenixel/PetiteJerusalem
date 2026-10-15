"""Du PDF d'un scan à une image d'encre, redressée.

Tout ce qui suit travaille sur un masque d'encre : un tableau de 0 et de 1 à
la taille de la page, 1 là où le livre est imprimé. Les pages rendues sont
gardées dans le cache (jamais dans le dépôt).
"""

from __future__ import annotations

import os
import subprocess

import cv2
import numpy as np


def render_page(pdf: str, page: int, dpi: int, cache_dir: str) -> str:
    """Rend une page du PDF en niveaux de gris (pdftoppm) et renvoie le PNG."""
    os.makedirs(cache_dir, exist_ok=True)
    stem = os.path.join(cache_dir, f"p{page:04d}-{dpi}")
    png = stem + ".png"
    if not os.path.exists(png):
        subprocess.run(
            ["pdftoppm", "-f", str(page), "-l", str(page), "-r", str(dpi), "-gray", "-png",
             "-singlefile", pdf, stem],
            check=True,
        )
    return png


def ink_mask(gray: np.ndarray) -> np.ndarray:
    """L'encre d'une page : ce qui est nettement plus sombre que le papier autour.

    Le papier d'un scan n'a pas une teinte égale (ombre de la reliure, bords
    brunis) : on compare chaque point au fond estimé près de lui, pas à un
    seuil unique.
    """
    small = cv2.resize(gray, None, fx=0.25, fy=0.25, interpolation=cv2.INTER_AREA)
    # Le fond : ce qui reste quand on efface les lettres (fermeture), lissé.
    paper = cv2.morphologyEx(small, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    paper = cv2.GaussianBlur(paper, (0, 0), 8)
    paper = cv2.resize(paper, (gray.shape[1], gray.shape[0]), interpolation=cv2.INTER_LINEAR)
    ratio = gray.astype(np.float32) / np.maximum(paper.astype(np.float32), 1.0)
    return (ratio < 0.62).astype(np.uint8)


def estimate_skew(ink: np.ndarray) -> float:
    """L'angle (en degrés) qui remet les lignes à l'horizontale.

    On cherche la rotation qui rend le profil des lignes le plus contrasté :
    des lignes droites donnent des rangées très noires et des rangées vides.
    """
    scale = 0.2
    small = cv2.resize(ink * 255, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    h, w = small.shape
    # Le cœur de la page : les bords portent des ombres et des marges.
    core = small[int(h * 0.08): int(h * 0.92), int(w * 0.08): int(w * 0.92)].astype(np.float32)
    ch, cw = core.shape

    def contrast(angle: float) -> float:
        m = cv2.getRotationMatrix2D((cw / 2, ch / 2), angle, 1.0)
        rows = cv2.warpAffine(core, m, (cw, ch), flags=cv2.INTER_LINEAR).sum(axis=1)
        return float(np.square(np.diff(rows)).sum())

    best = max(np.arange(-2.0, 2.01, 0.2), key=contrast)
    best = max(np.arange(best - 0.2, best + 0.201, 0.04), key=contrast)
    return float(best)


def rotate(ink: np.ndarray, angle: float) -> np.ndarray:
    """Tourne le masque d'encre autour de son centre."""
    if abs(angle) < 0.02:
        return ink
    h, w = ink.shape
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(ink, m, (w, h), flags=cv2.INTER_NEAREST)


def load_page(png: str) -> tuple[np.ndarray, np.ndarray, float]:
    """Une page prête à l'analyse : l'image grise et l'encre redressées, l'angle."""
    gray = cv2.imread(png, cv2.IMREAD_GRAYSCALE)
    if gray is None:
        raise FileNotFoundError(png)
    ink = ink_mask(gray)
    angle = estimate_skew(ink)
    if abs(angle) >= 0.02:
        h, w = gray.shape
        m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
        gray = cv2.warpAffine(gray, m, (w, h), flags=cv2.INTER_LINEAR, borderValue=255)
        ink = rotate(ink, angle)
    return gray, ink, angle
