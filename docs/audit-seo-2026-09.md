# Audit SEO (septembre 2026)

Passe complète sur ce qui rend le site trouvable : le HTML servi aux robots
(build local des 2 020 pages prérendues, relu par script : titres,
descriptions, h1, canoniques, hreflang, liens internes, JSON-LD), les fichiers
pour robots (`robots.txt`, `sitemap.xml`, `llms.txt`), les fonctions qui
servent les pages dynamiques, la chaîne de déploiement, et ce qui ne se voit
pas dans le code (autorité du domaine, consoles des moteurs).

Le site en production n'était pas joignable depuis l'environnement de
l'audit : les vérifications en ligne (en-têtes, redirections `www`, état de la
Search Console) sont dans la section 4, à faire à la main.

Complète `SEO.md` (comment le référencement est fabriqué) et le chantier
« `lastmod` réel dans le sitemap » de `audit-review-2026-09.md`.

## 1. Ce qui est déjà bien

- **Tout est prérendu.** 2 020 pages HTML complètes, une par URL indexable,
  toutes avec titre, description, canonique, `lang`/`dir`, JSON-LD valide et
  un seul h1. Aucun lien interne cassé, aucun hreflang non réciproque.
- **Une URL par langue** (`/`, `/en`, `/he`, segments traduits), hreflang
  croisés dans le `<head>` et dans le sitemap, `x-default` sur le français.
- **Pages calculées à forte demande** : 243 villes × 3 langues d'horaires de
  Chabbat avec FAQ datée, 16 fêtes × 3 langues, la paracha de la semaine, les
  Tehilim par intention, les zmanim expliqués.
- **Données structurées** partout où elles ont un sens : `BreadcrumbList`
  (2 015 pages), `FAQPage` (796), `CreativeWork` (1 100), `Article`,
  `HowTo`, `WebApplication`, `WebSite`, `Organization`.
- **Aperçus sociaux des pages dynamiques** (sessions, chiourim, séries,
  auteurs) par la fonction `socialPreview`, carte Open Graph par session.
- `robots.txt` ouvert aux crawlers IA, `llms.txt`, IndexNow après chaque
  release, `noindex` sur les pages sans intérêt (`/login`, 404, `/lire`).

## 2. Ce qui manquait, et ce que la PR corrige

### Maillage interne : 1 200 pages sans chemin depuis la bibliothèque

La liste des livres d'un corpus (`/bibliotheque/talmud`, `/bibliotheque/michna`…)
n'existait que dans la vue Vue : un robot sans JavaScript recevait la coquille
vide (`app.html`), sans canonique. Les ~1 200 pages de lecture n'étaient
reliées entre elles que par le sitemap et leurs voisines (chapitre suivant),
et 31 pages n'avaient **aucun** lien entrant : les 14 brahot, les 6 pages du
sidour, les Sli'hot, les pages légales et « À propos » dans les trois langues.
Un moteur les trouvait par le sitemap, sans rien pour les classer.

Corrigé :

- **Une page statique par corpus** (`/bibliotheque/tehilim`, `/michna`,
  `/talmud`, `/tanakh`, `/sidour`, `/brahot`), avec chaque livre en lien,
  groupé par seder, sefer ou livre, un titre et une description propres, un
  fil d'Ariane et une `ItemList` en JSON-LD (`buildCorpusBody` dans
  `src/content/etudeTexts.ts`). Le chemin accueil → bibliothèque → corpus →
  livre → chapitre existe maintenant en HTML.
- `/bibliotheque` lie les six corpus (et les Sli'hot directement, la
  redirection `/bibliotheque/slihot` n'existant que côté client) ; chaque page
  de lecture renvoie vers la liste de son corpus.
- Le pied de page statique lie les pages légales dans chaque langue.
- `StudyPage.vue` pose, en français, le même titre et la même description
  que la page prérendue : Googlebot rend le JavaScript, et deux titres
  différents lui laissaient le choix.

Résultat : plus aucune page orpheline (audit relancé sur le build).

### Sitemap : `lastmod` mensonger et fichier unique

Chaque URL portait la date du build : 2 000 pages « modifiées » à chaque
déploiement, dont 1 200 pages de lecture dont le texte ne change jamais.
Google dit n'utiliser `lastmod` que s'il est constamment exact ; le mentir
partout revenait à ne rien dire, et l'aurait aggravé avec un déploiement
hebdomadaire.

Corrigé :

- **`lastmod` réel** : la date du dernier commit du fichier dont la page est
  faite (le fichier de texte pour une page de lecture, `seoPages.ts` pour une
  page de contenu), lue en un seul `git log` (`scripts/lib/lastmod.mjs`). Les
  pages calculées (horaires, calendrier, paracha, parachiot datées) gardent
  la date du build : elles changent réellement. Sans historique git (clone
  superficiel), repli sur la date du build, comme avant. `deploy.yml` fait
  donc son checkout avec tout l'historique.
- **Un index de sitemaps** à `/sitemap.xml` (adresse inchangée) vers un
  fichier par famille : `sitemap-pages.xml`, `sitemap-bibliotheque.xml`,
  `sitemap-horaires.xml`, `sitemap-calendrier.xml`. La Search Console rend
  compte de l'indexation sitemap par sitemap : on verra quelle famille
  décroche.
- **IndexNow lit les sitemaps** au lieu de la liste des pages déclarées : les
  1 200 pages de lecture, jusqu'ici jamais soumises à Bing, le sont.

### Fraîcheur : des pages datées sans déploiement régulier

Le déploiement ne partait que d'un tag. Or `/paracha` nomme « cette semaine »,
les pages d'horaires couvrent douze semaines à partir du build, la FAQ des
fêtes est datée : sans release pendant un mois, tout cela recule d'un mois.
`SEO.md` demandait un déploiement hebdomadaire ; rien ne le garantissait.

Corrigé : **`refresh-seo.yml`**, le dimanche et le mercredi à 03:00 UTC (et à
la demande), rebâtit le **dernier tag déployé** (pas `main` : le site reste à
la version publiée, seules les dates changent), déploie le hosting seul,
vérifie que le sitemap servi porte la date du jour, et prévient IndexNow. Un
groupe de concurrence l'empêche de se croiser avec une release.

### Doublons d'hôte

Le site répond aussi sur `petite-jerusalem-dev.web.app` et
`.firebaseapp.com` (c'est ce que `deploy.yml` interroge pour vérifier la mise
en ligne). Les canoniques pointent vers `.fr`, mais la coquille des routes
profondes n'en a pas. Corrigé : `index.html` renvoie ces deux hôtes vers le
domaine canonique (les canaux de prévisualisation des PR et l'app native ne
sont pas concernés). Firebase Hosting ne sait pas faire une redirection 301
selon l'hôte ; à défaut, c'est ce que voient les robots qui exécutent le
JavaScript, Googlebot compris.

### `robots.txt`

`/admin` et `/studio/` n'étaient protégés que par un `noindex` posé en
JavaScript ; `/app` (la coquille) était crawlable avec le titre de l'accueil.
Les trois sont maintenant `Disallow`. Ajout de `Claude-SearchBot`,
`Applebot` (Siri, Spotlight) et `DuckAssistBot`.

### Données structurées des pages dynamiques

Un chiour n'émettait aucun JSON-LD : il est maintenant un `AudioObject`
(auteur, durée ISO 8601, URL du fichier, gratuit), avec son fil d'Ariane ; les
sessions ont le leur.

### Carte Twitter

`seoService` posait `twitter:card: summary` quand la vue ne précisait rien,
alors que le HTML servi dit `summary_large_image` : la page rendue
contredisait la page servie. Harmonisé sur la carte large.

### Identité

`Organization` déclare ses `sameAs` (App Store, Play Store, GitHub, X) :
c'est ce qui relie le site à ses fiches sur les stores dans le graphe de
connaissances. `llms.txt` décrit les pages de corpus, le motif des URL de
lecture, les intentions de Tehilim, le sitemap et les apps.

## 3. Ce qui reste à faire dans le code (par ordre d'intérêt)

1. **Titres trop longs.** 1 588 titres dépassent 65 caractères, surtout les
   pages de lecture (« Michna Arakhin Chapitre 1 (א) en hébreu et phonétique |
   Petite Jérusalem », 72). Google coupe vers 60. Les mots-clés sont devant,
   c'est la marque qui saute ; acceptable, mais « Michna Arakhin 1 : hébreu et
   phonétique » gagnerait dix caractères. Fichier : `sectionTitle` dans
   `src/content/etudeTexts.ts`. De même 816 descriptions dépassent 165
   caractères (Talmud), coupées dans les résultats.
2. **Livres du Tanakh en une seule page.** `/bibliotheque/tanakh/tehillim`
   pèse 749 Ko (les 150 psaumes en un seul document, doublon des 150 pages
   `/bibliotheque/tehilim/N`), Yirmiyahu 577 Ko. Paginer les livres des
   Neviim et Ketouvim par chapitre (comme la Michna) donnerait des pages
   indexables et des URL « Yechayahou chapitre 53 » ; pour Tehillim, une
   canonique vers `/bibliotheque/tehilim` ou le retrait du doublon.
3. **Image Open Graph par page.** Toutes les pages partagent `og-image.jpg`.
   Une carte par ville (« Horaires de Chabbat à Lyon ») et par fête
   augmenterait le taux de clic sur WhatsApp, premier canal de partage de la
   communauté. La mécanique existe déjà (`functions/src/ogCard.ts`, resvg) :
   une route `/og/horaires/<ville>.png` sur le modèle de `/og/session/`.
4. **Flux RSS podcast des chiourim.** Un flux `/chiourim/feed.xml`
   (`AudioObject` existants, `mediaUrl`, durée) permettrait de soumettre les
   chiourim à Apple Podcasts, Spotify et YouTube Music : un canal de
   découverte entier, hors Google. À générer par la fonction (les chiourim
   vivent dans Firestore), ou par un export à chaque déploiement.
5. **`/chiourim` sans liste pour les robots.** La page statique n'a que
   trois paragraphes ; la liste des chiourim n'arrive qu'en JavaScript. Faire
   servir `/chiourim` par `socialPreview` avec la liste (déjà en cache dans
   la fonction) donnerait aux moteurs un chemin vers chaque chiour.
6. **Polices Google bloquantes** (`index.html`) : deux familles chargées
   depuis `fonts.googleapis.com` avant le premier rendu, ce que Lighthouse
   compte dans le LCP. Déjà au chantier de `audit-review-2026-09.md` pour
   l'app ; les embarquer en woff2 sous-ensemblés vaut aussi pour le site.
7. **Soft 404.** Une ville inconnue (`/horaires/nulle-part`) et une fête
   inconnue redirigent côté client vers le hub ; une URL inconnue rend la 404
   en `noindex` mais avec un statut 200 (réécriture attrape-tout de Firebase).
   Sans conséquence tant que Google rend le JavaScript ; rien à faire de
   simple côté hosting.
8. **Pages de contenu en anglais et en hébreu** : les Tehilim par intention
   et la bibliothèque restent en français seul. Les intentions
   (« tehillim for healing ») sont un vrai gisement en anglais.

## 4. Actions manuelles (hors dépôt)

Rien de ce qui précède ne remplace ceci ; pour un domaine jeune, c'est même
l'essentiel.

1. **Google Search Console** : vérifier que la propriété `petite-jerusalem.fr`
   (propriété de domaine, DNS TXT) existe ; **soumettre à nouveau
   `https://petite-jerusalem.fr/sitemap.xml`** (c'est maintenant un index ;
   les quatre sitemaps enfants apparaissent dessous) ; lire le rapport Pages
   (« Explorée, actuellement non indexée », « Détectée », « Page en double »)
   famille par famille ; demander l'indexation des pages de corpus
   (`/bibliotheque/talmud`, `/bibliotheque/tehilim`…) et de la page d'accueil.
2. **Bing Webmaster Tools** : site ajouté, sitemap soumis, clé IndexNow
   reconnue (rapport IndexNow). Bing alimente ChatGPT search et DuckDuckGo.
3. **Vérifier en ligne** (le sandbox de l'audit ne pouvait pas) :
   `https://www.petite-jerusalem.fr` doit rediriger en 301 vers l'apex ;
   `petite-jerusalem.web.app` doit rester en 404 ;
   `petite-jerusalem-dev.web.app` doit renvoyer vers `.fr` (script de cette
   PR) ; `curl -s https://petite-jerusalem.fr/sitemap.xml | head` doit montrer
   l'index ; `/bibliotheque/talmud` doit servir la liste des traités sans
   JavaScript ; `/robots.txt` doit porter les nouveaux `Disallow`.
4. **Lancer `Refresh SEO pages` à la main une fois** (Actions → workflow →
   Run workflow) pour vérifier qu'il passe, puis contrôler le dimanche suivant
   que le sitemap porte la date du jour.
5. **Google Business / Knowledge Graph** : rien à faire, ce n'est pas un
   commerce local.
6. **Liens entrants**, le seul vrai levier pour un domaine sans autorité face
   à un film homonyme : annuaires et sites communautaires (Consistoire, sites
   de communautés, Torah-Box, Chiourim.com, Hamodia, Actualité Juive, blogs
   de rabbanim), newsletters de synagogues, groupes WhatsApp et Facebook de
   communautés, fiches des stores (déjà liées par `sameAs`). Ancrer les liens
   sur l'usage (« finir le Chass à plusieurs », « horaires de Chabbat à
   Lyon »), pas sur le nom.
7. **Wikipédia / Wikidata** : une entrée Wikidata pour le site (instance de
   « site web », langues, URL officielle, identifiants des stores) aide les
   assistants à distinguer le site du film de 2005.
8. **Suivre les Core Web Vitals** dans la Search Console (rapport Expérience)
   et PageSpeed Insights sur `/`, `/horaires/paris`, `/bibliotheque/tehilim/23`.

### Prompt pour Claude Cowork

À coller dans une session Claude Cowork avec le navigateur (et, si
possible, les connecteurs Gmail et Notion) :

```
Tu m'aides à finir le référencement de https://petite-jerusalem.fr (site trilingue
fr/en/he d'étude de textes juifs : partage de lectures, horaires de Chabbat par
ville, calendrier des fêtes, bibliothèque de textes). Le dépôt GitHub est
Phenixel/PetiteJerusalem ; le fichier docs/audit-seo-2026-09.md contient l'audit
et la liste des actions ; SEO.md explique comment le site est fabriqué.

Fais les vérifications et actions suivantes, dans l'ordre, et rends-moi compte à
chaque étape (ce qui est fait, ce qui bloque, ce que tu as dû décider) :

1. Vérifications en ligne. Avec le navigateur ou curl, contrôle :
   - https://www.petite-jerusalem.fr/ redirige en 301 vers https://petite-jerusalem.fr/ ;
   - https://petite-jerusalem.web.app/ répond 404 ;
   - https://petite-jerusalem-dev.web.app/ renvoie (par JavaScript) vers petite-jerusalem.fr ;
   - https://petite-jerusalem.fr/sitemap.xml est un index de sitemaps avec quatre
     fichiers enfants, et chaque enfant s'ouvre ;
   - https://petite-jerusalem.fr/robots.txt contient Disallow: /admin, /studio/, /app ;
   - https://petite-jerusalem.fr/bibliotheque/talmud montre la liste des traités
     même avec JavaScript désactivé ;
   - https://petite-jerusalem.fr/horaires/lyon a un titre, une description, des
     hreflang fr/en/he et un JSON-LD FAQPage.
   Si l'une de ces vérifications échoue, note-le : cela veut dire que la PR
   « SEO : audit et améliorations » n'est pas encore déployée (un tag web-vX.Y.Z
   déclenche le déploiement) ; ne cherche pas à corriger toi-même.

2. Google Search Console (https://search.google.com/search-console). Sur la
   propriété de domaine petite-jerusalem.fr (crée-la en propriété de domaine avec
   vérification DNS TXT si elle n'existe pas, et dis-moi quel enregistrement
   ajouter chez le registrar) :
   - dans Sitemaps, soumets https://petite-jerusalem.fr/sitemap.xml et vérifie que
     les quatre sitemaps enfants apparaissent avec un statut « Opération réussie » ;
   - dans Pages, relève le nombre de pages indexées et non indexées, et pour
     chaque motif de non-indexation (« Explorée, actuellement non indexée »,
     « Détectée, actuellement non indexée », « Page en double », « Soft 404 »)
     le nombre d'URL et trois exemples ;
   - avec l'inspection d'URL, demande l'indexation de : /, /bibliotheque,
     /bibliotheque/talmud, /bibliotheque/tehilim, /bibliotheque/michna,
     /bibliotheque/tanakh, /horaires, /calendrier, /paracha, /tehilim,
     /finir-le-chass, /partage-tehilim, /en, /he (une par une, dans la limite
     du quota quotidien) ;
   - dans Expérience, relève les Core Web Vitals mobiles (bonnes / à améliorer /
     médiocres) ;
   - dans Performance, exporte les 50 premières requêtes des 3 derniers mois
     (clics, impressions, position) et dis-moi quelles requêtes sont en
     position 4 à 15 avec beaucoup d'impressions : ce sont celles à travailler.

3. Bing Webmaster Tools (https://www.bing.com/webmasters). Vérifie que le site
   est ajouté (importe-le depuis la Search Console si possible), que le sitemap
   https://petite-jerusalem.fr/sitemap.xml est soumis, et que le rapport IndexNow
   montre des soumissions récentes (la clé est 7928be0e14242cf92e167550affa3215,
   hébergée à la racine du site).

4. GitHub Actions. Sur https://github.com/Phenixel/PetiteJerusalem/actions, ouvre le
   workflow « Refresh SEO pages », lance-le à la main (Run workflow, branche
   main) et attends la fin. Il doit rebâtir le dernier tag déployé, déployer le
   hosting et vérifier que le sitemap porte la date du jour. S'il échoue, copie-moi
   les dernières lignes du log de l'étape en erreur.

5. PageSpeed Insights (https://pagespeed.web.dev). Mesure en mobile : /,
   /horaires/paris, /bibliotheque/tehilim/23, /calendrier/pessah. Note LCP, CLS,
   INP et la note Performance, et les trois premières recommandations de chaque
   page.

6. Liens entrants. Prépare (sans les envoyer) trois courriels courts, en
   français, que je relirai avant envoi, pour demander un lien vers le site :
   - à une communauté ou synagogue (proposer d'intégrer leurs horaires de Chabbat
     depuis https://petite-jerusalem.fr/horaires/<ville>, gratuit, sans publicité) ;
   - à un site communautaire ou un annuaire (Torah-Box, Chiourim.com, un annuaire
     d'applications juives) pour présenter le partage de lectures (« finir le
     Chass à plusieurs », « répartir les Tehilim pour une refoua chelema ») ;
   - à un rav ou un auteur de chiourim pour proposer d'héberger ses cours.
   Ancre chaque lien proposé sur l'usage, jamais sur le seul nom du site (il
   existe un film homonyme). Si le connecteur Gmail est disponible, crée-les en
   brouillons ; sinon, donne-moi les textes.

7. Wikidata. Vérifie s'il existe un élément Wikidata pour le site (recherche
   « Petite Jérusalem site web »). S'il n'existe pas, prépare-moi la liste des
   propriétés à renseigner (instance de : site web ; langue de l'œuvre : français,
   anglais, hébreu ; URL officielle ; identifiant App Store 6798778029 ;
   identifiant Play Store fr.petitejerusalem.app ; date de création) ; ne crée
   rien toi-même.

8. Termine par un compte rendu en français, avec les chiffres relevés
   (indexation, requêtes, Web Vitals), les actions faites, celles qui attendent
   une décision de ma part, et les trois prochaines choses à faire par ordre
   d'impact. Si le connecteur Notion est disponible, ajoute ce compte rendu en
   page dans le Notion du projet ; sinon, donne-le-moi ici.

Ne crée pas de compte, ne paie rien, ne modifie aucun enregistrement DNS et ne
publie rien en dehors des outils Google et Bing du site sans me le demander.
```
