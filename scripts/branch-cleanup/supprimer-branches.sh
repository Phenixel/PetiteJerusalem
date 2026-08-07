#!/usr/bin/env bash
# Supprime les branches distantes non rattachées à une PR ouverte.
#
# Conservées : main, staging, et les head des 3 PR ouvertes
#   - claude/android-apple-widgets-ekrzm1  (PR #140)
#   - feat/tehilim-aleatoire               (PR #130)
#   - claude/pst-21-NcAFp                  (PR #68)
#
# La liste et les SHA sont dans branches-a-supprimer.tsv, ce qui permet de
# restaurer n'importe quelle branche après coup :
#   git push origin <sha>:refs/heads/<branch>
#
# Usage :
#   ./supprimer-branches.sh          # aperçu (dry-run)
#   ./supprimer-branches.sh --go     # suppression réelle

set -euo pipefail

cd "$(dirname "$0")"
LISTE="branches-a-supprimer.tsv"
[ -f "$LISTE" ] || { echo "Fichier $LISTE introuvable." >&2; exit 1; }

mapfile -t BRANCHES < <(tail -n +2 "$LISTE" | cut -f1)

if [ "${1:-}" != "--go" ]; then
  echo "DRY-RUN — ${#BRANCHES[@]} branches seraient supprimées :"
  printf '  %s\n' "${BRANCHES[@]}"
  echo
  echo "Relancer avec --go pour supprimer."
  exit 0
fi

# Suppression par lots de 40 pour éviter les lignes de commande trop longues.
for ((i = 0; i < ${#BRANCHES[@]}; i += 40)); do
  lot=("${BRANCHES[@]:i:40}")
  echo "Suppression de ${#lot[@]} branches..."
  git push origin --delete "${lot[@]}"
done

git fetch --prune origin
echo "Terminé."
