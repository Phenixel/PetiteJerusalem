"""Télécharge les scans dans le cache (jamais dans le dépôt).

    python3 scripts/layout/fetch.py vilna v01
    python3 scripts/layout/fetch.py ezrat-hasofer

Les sources, leurs adresses et leurs licences sont dans sources.json. Un
fichier déjà là n'est pas repris ; un téléchargement interrompu reprend où il
s'était arrêté. Un seul fichier à la fois, une seule connexion, et le
programme se nomme auprès du serveur : on ne charge pas archive.org.
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


def download(item: str, name: str, target: str) -> None:
    os.makedirs(os.path.dirname(target), exist_ok=True)
    url = f"https://archive.org/download/{item}/{urllib.parse.quote(name)}"
    print(f"{url}\n  vers {target}")
    subprocess.run(
        ["curl", "-L", "--fail", "--retry", "3", "-C", "-", "-A", AGENT, "-o", target, url],
        check=True,
    )


def main() -> None:
    with open(os.path.join(HERE, "sources.json"), encoding="utf8") as f:
        sources = json.load(f)
    if len(sys.argv) < 2 or sys.argv[1] not in sources or sys.argv[1] == "note":
        names = ", ".join(k for k in sources if k != "note")
        raise SystemExit(f"Usage : python3 scripts/layout/fetch.py <source> [volume]\nSources : {names}")
    key = sys.argv[1]
    source = sources[key]
    print(f"{source['title']}\nLicence : {source['license']}\n{source['rights']}")
    if key == "vilna":
        if len(sys.argv) < 3 or sys.argv[2] not in source["volumes"]:
            raise SystemExit(f"Volumes : {', '.join(source['volumes'])}")
        volume = sys.argv[2]
        download(source["item"], source["volumes"][volume]["file"],
                 os.path.join(CACHE, "sources", f"vilna-{volume}", f"{volume}.pdf"))
    elif key == "ezrat-hasofer":
        download(source["item"], source["file"], os.path.join(CACHE, "sources", "ezrat-1769", "ezrat.pdf"))
    else:
        download(source["item"], source["file"], os.path.join(CACHE, "sources", key, f"{key}.pdf"))


if __name__ == "__main__":
    main()
