"""Télécharge les sources dans le cache (jamais dans le dépôt).

    python3 scripts/layout/fetch.py vilna v01
    python3 scripts/layout/fetch.py ezrat-hasofer
    python3 scripts/layout/fetch.py tikkun-io
    python3 scripts/layout/fetch.py scrollscraper
    python3 scripts/layout/fetch.py sefaria-torah

Les sources, leurs adresses et leurs licences sont dans sources.json. Un
fichier déjà là n'est pas repris ; un téléchargement interrompu reprend où il
s'était arrêté. Un seul fichier à la fois, une seule connexion, et le
programme se nomme auprès du serveur : on ne charge ni archive.org ni GitHub.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get("PJ_LAYOUT_CACHE", os.path.expanduser("~/.cache/petite-jerusalem/layout"))
AGENT = "PetiteJerusalem-layout/0.1 (https://github.com/Phenixel/PetiteJerusalem)"


def fetch(url: str, target: str) -> None:
    os.makedirs(os.path.dirname(target), exist_ok=True)
    if os.path.exists(target) and os.path.getsize(target) > 0 and not target.endswith(".pdf"):
        print(f"déjà là : {target}")
        return
    print(f"{url}\n  vers {target}")
    subprocess.run(
        ["curl", "-L", "--fail", "--retry", "3", "-C", "-", "-A", AGENT, "-o", target, url],
        check=True,
    )


def download(item: str, name: str, target: str) -> None:
    fetch(f"https://archive.org/download/{item}/{urllib.parse.quote(name)}", target)


def untar(archive: str, into: str, *args: str) -> None:
    os.makedirs(into, exist_ok=True)
    subprocess.run(["tar", "-xzf", archive, "-C", into, *args], check=True)


def main() -> None:
    with open(os.path.join(HERE, "sources.json"), encoding="utf8") as f:
        sources = json.load(f)
    if len(sys.argv) < 2 or sys.argv[1] not in sources or sys.argv[1] == "note":
        names = ", ".join(k for k in sources if k != "note")
        raise SystemExit(f"Usage : python3 scripts/layout/fetch.py <source> [volume]\nSources : {names}")
    key = sys.argv[1]
    source = sources[key]
    if "license" not in source or key == "tradition":
        raise SystemExit(f"« {key} » ne se télécharge pas : voir sources.json.")
    print(f"{source['title']}\nLicence : {source['license']}\n{source.get('rights', '')}")
    if key == "vilna":
        if len(sys.argv) < 3 or sys.argv[2] not in source["volumes"]:
            raise SystemExit(f"Volumes : {', '.join(source['volumes'])}")
        volume = sys.argv[2]
        download(source["item"], source["volumes"][volume]["file"],
                 os.path.join(CACHE, "sources", f"vilna-{volume}", f"{volume}.pdf"))
    elif key == "ezrat-hasofer":
        download(source["item"], source["file"], os.path.join(CACHE, "sources", "ezrat-1769", "ezrat.pdf"))
    elif key == "tikkun-io":
        # Le dépôt à la révision notée, dont on ne garde que les colonnes.
        slug = source["repository"].removeprefix("https://github.com/")
        archive = os.path.join(CACHE, "tikkun-io", "repo.tar.gz")
        fetch(f"https://codeload.github.com/{slug}/tar.gz/{source['commit']}", archive)
        untar(archive, os.path.join(CACHE, "tikkun-io", "src"), "--strip-components=1")
    elif key == "scrollscraper":
        slug = source["repository"].removeprefix("https://github.com/")
        base = f"https://raw.githubusercontent.com/{slug}/{source['commit']}"
        for name in source["files"]:
            fetch(f"{base}/{name}", os.path.join(CACHE, "scrollscraper", name))
        untar(os.path.join(CACHE, "scrollscraper", "data", "webmedia.tgz"),
              os.path.join(CACHE, "scrollscraper", "webmedia"))
    elif key == "sefaria-torah":
        for book in source["books"]:
            fetch(f"{source['page']}/{book}/Hebrew/merged.json",
                  os.path.join(CACHE, "sources", "sefaria", f"{book}.json"))
    else:
        download(source["item"], source["file"], os.path.join(CACHE, "sources", key, f"{key}.pdf"))


if __name__ == "__main__":
    main()
