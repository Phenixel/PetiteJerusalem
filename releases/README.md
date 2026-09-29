# Notes de version publiées

Une note ajoutée ici sous le nom `vX.Y.Z.md` (trois sections, voir
`docs/notes-de-version.md`) et fusionnée dans main **met la version en
production** : `.github/workflows/release.yml` crée la release GitHub
`vX.Y.Z` avec ce texte, puis lance les déploiements du site, d'Android et
d'iOS, et l'information de version dans l'app.

Corriger une note déjà publiée ici ne republie rien : modifier alors le
texte de la release sur GitHub (l'information de version suit).
