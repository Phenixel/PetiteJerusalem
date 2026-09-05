# L'évolution du site, version après version

`index.html` est un diaporama : la page d'accueil du site, capturée dans
chaque version publiée depuis la v1.0, en vue ordinateur et en vue mobile.
`petite-jerusalem-evolution.gif` en est la version courte, pour un partage
rapide.

Ouvrir la page : `open docs/evolution/index.html` (aucun serveur nécessaire).

## Ce que contient le dossier

| Fichier         | Rôle                                                      |
| --------------- | --------------------------------------------------------- |
| `versions.json` | la liste des versions retenues : tag, date, titre, résumé |
| `frames/`       | deux captures WebP par version (`-desktop`, `-mobile`)    |
| `index.html`    | le diaporama, généré à partir des deux précédents         |
| `*.gif`         | la même séquence en image animée                          |

Une version par palier de version mineure, la dernière correction de chaque
palier : c'est celle qui a vécu le plus longtemps en ligne.

## Refaire les captures

Les images ne sont pas des maquettes : chaque tag est rebuildé, servi, puis
photographié en visiteur à 1280×800 et 390×844.

```bash
node scripts/evolution-frames.mjs            # toutes les versions
node scripts/evolution-frames.mjs v3.9.0     # une seule
node scripts/evolution-page.mjs              # regénère index.html
```

Le script travaille dans un worktree git détaché sous
`node_modules/.cache/evolution`, garde
les `dist` produits en cache, et n'y revient pas tant qu'on ne passe pas
`--force`.

Sur une machine sans accès aux CDN, ajouter `--assets-locaux` : les polices
Google, Bootstrap et Font Awesome sont alors servies depuis `node_modules`,
sinon les captures perdraient les polices du site.

```bash
npm i --no-save bootstrap @fortawesome/fontawesome-free \
  @fontsource/{inter,lora,nunito,heebo,roboto,david-libre} \
  @fontsource/{frank-ruhl-libre,noto-serif-hebrew}
node scripts/evolution-frames.mjs --assets-locaux
```

## Le cas de la v1.0

La v1.0 (tag `old/1.0`) n'était pas le site actuel : c'était GemaraChain, une
application Django servie avec Bootstrap, sur Postgres. Le script de capture
ne sait pas la rejouer, elle a été photographiée à part :

```bash
git worktree add /tmp/pj-v1 old/1.0
python3 -m venv /tmp/pj-venv
/tmp/pj-venv/bin/pip install "Django==5.0.3" python-dotenv dateparser sentry-sdk
```

Un module de réglages local remplace Postgres par SQLite (`DEBUG = True`,
`ALLOWED_HOSTS = ["*"]`, moteur `django.db.backends.sqlite3`), les variables
`DJANGO_SECRET_KEY` et `POSTGRES_*` sont posées avant l'import des réglages
d'origine. Ensuite `manage.py migrate`, quelques sessions de démonstration
créées à la main, `manage.py runserver`, et la même capture que pour les
autres versions.

## Ajouter la version suivante

1. Ajouter une entrée dans `versions.json` (tag, date de la release, titre
   court, résumé en une phrase).
2. `node scripts/evolution-frames.mjs <tag>` pour les deux captures.
3. `node scripts/evolution-page.mjs` pour regénérer la page.
