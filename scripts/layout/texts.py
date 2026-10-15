"""Les mots du texte qu'on a déjà, comptés comme le lecteur les compte.

Une coupure de ligne se note par la place d'un mot : `[passage, mot]`. Pour
que ces places se relisent sans ambiguïté, les mots sont ceux que la forme de
la page affiche :

  - guemara : `gemaraPageText` (src/services/pageForm.ts) appliqué au passage,
    puis coupé aux espaces ;
  - Rachi, Tossafot : les commentaires du passage bout à bout, chacun
    `parseRashiComment` (dibbour puis texte), coupés aux espaces ;
  - Torah : `scrollVerseWords` appliqué au verset.

Ce module refait ces trois découpes en Python ; le test
src/__tests__/textLayout.test.ts vérifie, avec les fonctions du lecteur
elles-mêmes, que chaque place écrite dans un fichier de coupures existe.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TEXTS = os.path.join(ROOT, "public", "texts")

# Les voyelles et les teamim (POINTING de pageForm.ts).
POINTING = re.compile("[֑-ֽֿ-ׇׂׅׄ]")


@dataclass
class Token:
    """Un mot du texte et sa place."""

    text: str
    unit: int
    """L'amoud (index dans le fichier du traité) ou la paracha."""
    passage: int
    word: int


def gemara_words(passage: str) -> list[str]:
    """Les mots d'un passage de guemara tels que la page les montre."""
    s = POINTING.sub("", passage)
    s = re.sub("[־׃]", " ", s)
    s = re.sub("[?!,;\u2026\u2013\u2014]", " ", s)
    s = re.sub("(^|\\s)״(\\S)", r"\1\2", s)
    s = re.sub("(\\S)״(?=[\\s.:]|$)", r"\1", s)
    s = re.sub(r"\s+([.:])", r"\1", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s.split(" ") if s else []


def clean_text(s: str) -> str:
    """cleanText de textService.ts."""
    s = re.sub(r"<[^>]*>", "", s)
    s = re.sub(r"\{[א-ת]\}", "", s)
    for entity, char in (("&thinsp;", " "), ("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"),
                         ("&gt;", ">"), ("&quot;", '"')):
        s = s.replace(entity, char)
    return re.sub(r"[ \t]{2,}", " ", s).strip()


def comment_words(raw: str) -> list[str]:
    """Les mots d'un commentaire : son dibbour hamat'hil, puis son texte."""
    m = re.match(r"^\s*<b>([^<]*)</b>\s*([\s\S]*)$", raw)
    lead = clean_text(m.group(1)) if m else ""
    text = clean_text(m.group(2) if m else raw)
    return (lead + " " + text).split()


def scroll_verse_words(raw: str) -> list[str]:
    """scrollVerseWords de pageForm.ts : un verset tel que le sofer l'écrit."""
    s = re.sub(r"&[a-z]+;", " ", raw)
    s = re.sub(r"\*\([^)]*\)", " ", s)
    s = re.sub(r"\{[א-ת]\}", " ", s)
    s = re.sub(r"\[[^\]]*\]", " ", s)
    s = re.sub(r"[()]", "", s)
    s = re.sub(r"<[^>]*>", "", s)
    s = s.replace("־", " ").replace("׃", "").replace("׆", "").replace("׀", "")
    s = POINTING.sub("", s)
    return [w for w in s.split() if re.search("[א-ת]", w)]


def tractate_slug(title: str) -> str:
    return title.lower().replace(" ", "-").replace("'", "")


class Tractate:
    """Un traité : sa guemara et ses commentaires, amoud par amoud."""

    CHUNK = 20

    def __init__(self, slug: str):
        self.slug = slug
        with open(os.path.join(TEXTS, "talmud", f"{slug}.json"), encoding="utf8") as f:
            self.he: list[list[str]] = json.load(f)["he"]
        self._chunks: dict[int, dict] = {}

    def __len__(self) -> int:
        return len(self.he)

    def _chunk(self, amud: int) -> dict:
        n = amud // self.CHUNK
        if n not in self._chunks:
            path = os.path.join(TEXTS, "talmud-meforshim", self.slug, f"{n}.json")
            if os.path.exists(path):
                with open(path, encoding="utf8") as f:
                    self._chunks[n] = json.load(f)
            else:
                self._chunks[n] = {"from": n * self.CHUNK, "rashi": [], "tosafot": []}
        return self._chunks[n]

    def tokens(self, zone: str, amud: int) -> list[Token]:
        """Les mots d'une zone (main, rashi, tosafot) sur un amoud."""
        if zone == "main":
            return [
                Token(word, amud, p, w)
                for p, passage in enumerate(self.he[amud])
                for w, word in enumerate(gemara_words(passage))
            ]
        return [token for block in self.blocks(zone, amud) for token in block]

    def blocks(self, zone: str, amud: int) -> list[list[Token]]:
        """Les commentaires d'une zone (rashi, tosafot) sur un amoud, un par
        un, dans l'ordre du fichier : passage par passage."""
        chunk = self._chunk(amud)
        amudim = chunk.get(zone, [])
        i = amud - chunk.get("from", 0)
        out: list[list[Token]] = []
        if not 0 <= i < len(amudim):
            return out
        for p, comments in enumerate(amudim[i] or []):
            w = 0
            for raw in comments or []:
                words = comment_words(str(raw))
                if words:
                    out.append([Token(word, amud, p, w + k) for k, word in enumerate(words)])
                w += len(words)
        return out


class Parasha:
    """Une paracha : ses versets à plat, comme le lecteur les numérote."""

    def __init__(self, ident: int):
        self.id = ident
        with open(os.path.join(TEXTS, "tanakh", f"{ident}.json"), encoding="utf8") as f:
            data = json.load(f)
        self.title: str = data["title"]
        self.book: str = data.get("fromBook", "")
        self.range: str = data.get("range", "")
        self.verses: list[str] = [verse for aliya in data["he"] for verse in aliya]

    def tokens(self) -> list[Token]:
        return [
            Token(word, self.id, v, w)
            for v, verse in enumerate(self.verses)
            for w, word in enumerate(scroll_verse_words(verse))
        ]
