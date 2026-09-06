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

## 5. Visibilité dans les assistants d'IA (ChatGPT, Claude, Gemini, Perplexity)

Un assistant ne « connaît » pas un site : il le retrouve dans un index de
recherche au moment de la question, puis va lire la page. Trois conditions,
et l'état du site pour chacune.

**1. Être dans l'index que l'assistant interroge.** Chacun a le sien :

| Assistant | Index consulté | Ce qui le nourrit |
| --- | --- | --- |
| ChatGPT (search), Copilot | Bing | Bing Webmaster Tools, IndexNow, `OAI-SearchBot` |
| Gemini, AI Overviews | Google | Search Console, `Googlebot` (`Google-Extended` pour l'entraînement) |
| Claude | Brave Search | pas de console : crawl de Brave à partir des liens entrants |
| Perplexity | le sien + Bing | `PerplexityBot`, `Perplexity-User` |
| Mistral (Le Chat) | Brave | `MistralAI-User` |
| Modèles ouverts (Llama, Mistral, DeepSeek…) | corpus d'entraînement | `CCBot` (Common Crawl) |

Test fait pendant l'audit avec un outil de recherche adossé à un index tiers
(Brave) : sur `site:petite-jerusalem.fr`, **une seule URL du site remonte,
`/lire/158`**, une ancienne adresse (aujourd'hui `noindex`, canonique vers
`/bibliotheque`). Ni l'accueil, ni `/horaires`, ni `/finir-le-chass`. Sur
« petite-jerusalem.fr » entre guillemets, uniquement le film de 2005. En
revanche, sur « finir le Chass à plusieurs partage talmud », cette même URL
`/lire/158` sort en troisième position, derrière Torah-Box et Techouvot :
la preuve que le texte porte, dès qu'une page est indexée.

Conclusion : le site est **quasiment absent des index** que les assistants
utilisent, non par un défaut technique du HTML (tout est servi en clair), mais
parce que ces index ne l'ont pas encore parcouru. C'est la Search Console et
Bing Webmaster (section 4) qui débloquent Google et Bing ; Brave suit les
liens entrants, d'où l'importance des liens (section 4, point 6).

**2. Être lisible sans JavaScript.** Acquis : les 2 025 pages sont servies en
HTML complet, FAQ comprises, et `robots.txt` autorise chaque robot d'IA
nommément (ajout dans cette PR de `Claude-User`, `Perplexity-User`,
`MistralAI-User`, `Meta-ExternalAgent`, `Meta-ExternalFetcher`, `Amazonbot`,
`Google-CloudVertexBot`, `cohere-ai`, `YouBot` et `CCBot`, en plus de
`GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `Claude-SearchBot`, `PerplexityBot`,
`Google-Extended`, `Applebot`, `DuckAssistBot`).

**3. Donner la réponse en texte.** Acquis pour les questions datées (« quand
tombe Pessah 2027 », « à quelle heure sort Chabbat à Lyon ») et les
questions d'usage (« comment finir le Chass à plusieurs »), grâce aux FAQ.
Cette PR ajoute **`llms-full.txt`** (125 Ko, généré à chaque build) : le
texte des 37 pages principales en français, chacune sous son URL, pour
l'assistant qui ne lit qu'un fichier ; `llms.txt` y renvoie.

**Comment vérifier soi-même** (protocole repris dans le prompt Cowork) :
poser à chaque assistant, avec la recherche web activée, les mêmes six
questions et noter si le site est cité et en quelle position :
« Comment organiser une chaîne de Tehilim pour un malade ? », « Un site pour
finir le Chass à plusieurs ? », « À quelle heure sort Chabbat à Marseille
cette semaine ? », « Quand tombe Roch Hachana 2027 ? », « Où lire Tehilim 121
en phonétique ? », « Quelle est la paracha de cette semaine ? ». À refaire
un mois après la soumission des sitemaps.

## 6. Les mots-clés : ce qui est visé, ce que cherchent les gens, et les horizons non exploités

### Le vocabulaire visé confronté au marché

Pour chaque famille de pages, la requête telle qu'elle est tapée, et qui la
gagne aujourd'hui (résultats relevés pendant l'audit) :

| Famille | Requête tapée | Qui gagne | Verdict pour Petite Jérusalem |
| --- | --- | --- | --- |
| Partage de Tehilim | « chaîne de Tehilim » | Torah-Box, Univers Torah, Amisrael, Tehilim Online, Joie 2 Vivre | Le site disait « partage de Tehilim », un mot que personne ne tape. **Corrigé dans cette PR** : titre, h1, chapeau et FAQ de `/partage-tehilim` disent « chaîne de Tehilim », et gardent « partage » en second. Concurrence forte : l'angle à tenir est « gratuit, sans compte, lien WhatsApp, suivi en temps réel de ce qui est lu ». |
| Finir le Chass | « finir le Chass à plusieurs », « partage du Chass », « siyoum haShass » | Torah-Box (articles), Limoud Torah | Concurrence faible, vocabulaire juste. C'est la page qui sort déjà. À compléter par « chaîne de Michnayot » (voir horizons). |
| Horaires | « horaires de Chabbat Lyon », « allumage des bougies Lyon » | Chabad, Hebcal, Torah-Box, Alloj, Amhazak, horaire-chabbat.fr | Requêtes de tête inaccessibles à court terme. La chance est la **longue traîne** : 83 villes françaises dont Sarcelles, Créteil, Saint-Mandé, Villeurbanne, Sarreguemines… où les gros sites n'ont pas de page dédiée en français. |
| Fêtes | « quand tombe Roch Hachana 2026 », « date Kippour 2026 » | calendriergratuit.fr, icalendrier.fr, joursferies.fr, Loubavitch, Chabad | Les gagnants ont **l'année dans le titre**. Nos titres disaient « Roch Hachana : dates, heure d'entrée et de sortie », sans année. **Corrigé dans cette PR** : « Roch Hachana 2026 : dates, heure d'entrée et de sortie », l'année étant celle de la prochaine occurrence, recalculée par le rafraîchissement hebdomadaire. |
| Paracha | « paracha de la semaine » | Chabad, Torah-Box, Wikipédia, Manitou | Requête de tête inaccessible ; la longue traîne « quand lit-on Ki Tétsé », « texte de la paracha en phonétique » est le bon angle, déjà en place. |
| Bibliothèque | « Tehilim 121 phonétique », « Birkat Hamazon phonétique » | Torah-Box, Tehilim Online, Dayan Haemet, Chabad, bar-mitzvah.fr | Vocabulaire juste (« en hébreu et phonétique »). Les pages existent ; elles manquaient de liens entrants (corrigé : pages de corpus). |
| Tehilim du jour | « Tehilim du jour », « Tehilim par jour du mois » | Chabad, Tehilim Online | La page `/bibliotheque/tehilim-du-jour` existe mais n'est **pas prérendue** (Vue seulement) : invisible pour les moteurs. À prérendre avec le tableau des 30 jours (voir horizons). |

### Horizons non exploités, par intérêt décroissant

Chaque ligne est une requête réelle, le contenu que le site pourrait y
mettre avec ce qu'il a déjà, et pourquoi c'est jouable.

1. **« Chaîne de Michnayot » / « Michnayot pour un défunt ».** Répartir les
   Michnayot à la mémoire d'un défunt (l'année de deuil, la hiloula) est un
   usage courant, peu servi en français, et le site sait déjà partager la
   Michna. Une page `/partage-michnayot` sur le modèle de `/partage-tehilim`
   (intention, comment faire, FAQ), et le mot « Michnayot » dans l'accueil.
2. **« Daf Hayomi du jour » / « daf yomi aujourd'hui ».** Les résultats sont
   des cours vidéo, pas le texte. Une page `/daf-hayomi` calculée
   (`@hebcal/learning` fournit `DafYomi`, comme `MishnaYomi`) qui donne le daf
   du jour, la semaine à venir et le lien vers le chapitre dans la
   bibliothèque, rafraîchie par le workflow hebdomadaire. Même mécanique pour
   « Michna yomit ». Orthographe française : « Daf Hayomi » avant « daf yomi ».
3. **Tehilim du jour, prérendus.** Le tableau des psaumes par jour du mois
   hébraïque (1 : 1 à 9, 2 : 10 à 17…) est stable et très cherché ; la page
   existe, il manque son HTML statique, avec le jour courant calculé au build.
4. **L'année juive comme page.** « Calendrier juif 5787 », « calendrier
   hébraïque 2026-2027 », « fêtes juives 2027 » : une page par année civile
   (`/calendrier/2027`) listant toutes les fêtes et jeûnes de l'année, ce que
   font les sites de calendrier génériques qui gagnent aujourd'hui.
5. **« Date hébraïque aujourd'hui » / convertisseur de dates.** Tout est déjà
   calculé sur l'appareil (hebcal) : une page `/date-hebraique` avec la date
   du jour et un convertisseur, plus une FAQ (« quelle est la date hébraïque
   de ma naissance »), viserait une requête quotidienne.
6. **Le Omer et la lune.** « Compteur du Omer », « quel jour du Omer
   aujourd'hui », « Birkat Halevana jusqu'à quand » : les bandeaux existent
   dans l'app ; une page `/omer` (le compte du jour et les 49 jours datés) et
   une section « Birkat Halevana » dans le calendrier les rendraient
   trouvables.
7. **Les prières une par une.** « Kaddish phonétique », « Chema Israël
   phonétique », « Modé ani phonétique », « Tefilat Haderekh phonétique »
   (cette dernière existe déjà dans les brahot) : de fortes requêtes de
   circonstance (deuil, voyage, enfants). Le sidour est découpé en offices ;
   découper en plus les prières les plus cherchées en pages propres.
8. **L'anglais sur les intentions.** « Tehillim for healing », « tehillim for
   shidduch », « tehillim for parnassa » : le marché anglophone est grand et
   les pages françaises existent déjà ; traduire les sept pages d'intention
   sous `/en/tehillim/…`.
9. **Villes manquantes.** La couverture française est bonne (83 villes),
   mais quelques communautés cherchées manquent : Saint-Denis, Le
   Kremlin-Bicêtre, Saint-Ouen, Pantin, Bagneux, Fontenay-sous-Bois, La
   Garenne-Colombes, Levallois, Enghien-les-Bains, Deauville, Cagnes-sur-Mer,
   Saint-Laurent-du-Var. Une ligne dans `cities.json` chacune.
10. **Sarcelles.** Le film et le quartier de Sarcelles s'appellent « la
    Petite Jérusalem » : une page « Horaires de Chabbat à Sarcelles » bien
    faite est la seule façon de capter un peu de la requête de marque sans
    la disputer au film.

### Ce qu'il ne faut pas viser

- « Petite Jérusalem » seul : le film (Wikipédia, AlloCiné, IMDb, Amazon)
  occupe tout ; un site sans autorité n'y entrera pas, et ce n'est pas la
  requête de quelqu'un qui cherche à étudier.
- Les requêtes de tête « horaires de Chabbat Paris », « paracha de la
  semaine » : Chabad et Hebcal ont vingt ans d'avance ; la longue traîne
  rapporte plus vite.

## 7. Au-delà du référencement

Ce qui amène des visiteurs sans passer par un moteur, par rendement
probable.

1. **WhatsApp.** C'est là que circulent les chaînes de Tehilim et les
   horaires. Les cartes Open Graph par session existent ; une carte par
   ville et par fête (section 3, point 3) fait de chaque partage une
   publicité. Proposer un « partager les horaires de cette semaine » sur la
   page ville, texte prêt à coller.
2. **Les stores.** La fiche App Store et Play Store est un canal de recherche
   à part entière (« horaires chabbat », « tehilim ») : titre, sous-titre et
   mots-clés ASO valent une page SEO. Le `sameAs` de cette PR relie site et
   fiches.
3. **Newsletters et sites de communautés.** Une page « intégrer les horaires
   de votre ville dans votre site ou votre newsletter » (un lien profond, ou
   un petit encart) donne aux synagogues une raison de lier le site chaque
   semaine.
4. **Podcast.** Le flux RSS des chiourim (section 3, point 4) ouvre Apple
   Podcasts, Spotify et YouTube Music.
5. **YouTube / Instagram.** Une image par semaine « Horaires de Chabbat,
   paracha, allumage à Paris, Marseille, Lyon » générée automatiquement
   (même mécanique que les cartes Open Graph) et publiée avec le lien.
6. **Google Ad Grants** (10 000 $ de publicité par mois offerts) exige un
   statut d'association reconnue ; le site est édité par Phenixel. Si une
   association loi 1901 portait le projet, ce serait le levier payant le plus
   rentable, et gratuit.
7. **Wikipédia / Wikidata** (section 4, point 7) : la source la plus lue par
   les assistants pour désambiguïser « Petite Jérusalem ».

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
     position 4 à 15 avec beaucoup d'impressions : ce sont celles à travailler ;
     compare-les à la liste des horizons de la section 6 de l'audit et dis-moi
     lesquels apparaissent déjà.

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

7. Assistants d'IA. Avec ChatGPT (recherche web activée), Claude (recherche web),
   Gemini et Perplexity, pose à chacun les six questions suivantes, telles
   quelles, et note pour chaque réponse si petite-jerusalem.fr est cité, à quelle
   position, et quels sites le sont à la place :
   - « Comment organiser une chaîne de Tehilim pour un malade ? »
   - « Un site pour finir le Chass à plusieurs ? »
   - « À quelle heure sort Chabbat à Marseille cette semaine ? »
   - « Quand tombe Roch Hachana 2027 ? »
   - « Où lire Tehilim 121 en phonétique ? »
   - « Quelle est la paracha de cette semaine ? »
   Vérifie aussi que https://petite-jerusalem.fr/llms.txt et
   https://petite-jerusalem.fr/llms-full.txt s'ouvrent. Mets le tableau des
   réponses dans le compte rendu : c'est la mesure de départ, à refaire dans un
   mois.

8. Wikidata. Vérifie s'il existe un élément Wikidata pour le site (recherche
   « Petite Jérusalem site web »). S'il n'existe pas, prépare-moi la liste des
   propriétés à renseigner (instance de : site web ; langue de l'œuvre : français,
   anglais, hébreu ; URL officielle ; identifiant App Store 6798778029 ;
   identifiant Play Store fr.petitejerusalem.app ; date de création) ; ne crée
   rien toi-même.

9. Termine par un compte rendu en français, avec les chiffres relevés
   (indexation, requêtes, Web Vitals), les actions faites, celles qui attendent
   une décision de ma part, et les trois prochaines choses à faire par ordre
   d'impact. Si le connecteur Notion est disponible, ajoute ce compte rendu en
   page dans le Notion du projet ; sinon, donne-le-moi ici.

Ne crée pas de compte, ne paie rien, ne modifie aucun enregistrement DNS et ne
publie rien en dehors des outils Google et Bing du site sans me le demander.
```
