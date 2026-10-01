# Audit d'usage PostHog (octobre 2026)

Ce que les utilisateurs arrivent à faire, ce qui leur coûte, où ils se
perdent et où ça casse, d'après trente jours de données PostHog (du 2
septembre au 1er octobre 2026). La dernière section dit ce qui manque au
suivi pour mieux voir la prochaine fois.

**Périmètre.** Événements `env = production`, comptes de l'équipe, testeurs
et compte de review Google retirés (`user_type` de la personne). Environ 640
personnes : 428 sur le site, 113 sur iOS, 108 sur Android. Les chiffres sont
des requêtes ponctuelles, pas des définitions enregistrées dans PostHog ; ils
sont petits, et se lisent comme des tendances.

## 1. Ce qu'ils arrivent à faire

- **Lire.** C'est l'usage qui porte l'app : 89 des 112 utilisateurs iOS et
  70 des 105 utilisateurs Android ouvrent au moins un texte. Une visite de
  rayon débouche sur un texte dans 66 à 90 % des cas (sidour et brahot au-delà
  de 82 %, tanakh et moadim les plus bas, autour de 70 %).
- **La nouvelle introduction tient ses promesses.** « Passer » terminait 45 %
  des introductions dans l'ancienne forme (62 sur 139), 18 % dans la nouvelle
  (9 sur 51) ; 86 % vont jusqu'au bout.
- **Les horaires** : vus par 67 utilisateurs iOS et 48 Android sur trente
  jours, c'est le deuxième usage.
- **Le hors ligne** : 95 utilisateurs de l'app ont téléchargé des textes,
  pour 7 échecs (voir 4).
- **Google sur Android** : 19 connexions pour 23 personnes qui essaient ;
  les autres ont annulé d'elles-mêmes.
- **Les mises à jour** : sur 86 personnes à qui le bandeau a proposé une
  nouvelle version, 58 l'ont installée dans le mois.
- **La fidélité de l'app** : la moitié des utilisateurs reviennent au moins
  deux jours sur trente, et 19 sont là dix jours ou plus. Sur le site, 374
  visiteurs sur 419 ne viennent qu'un jour.

## 2. Ce qui leur demande un effort

Par ordre d'impact.

### 2.1 Se connecter par email : le mauvais mode, et pas de mot de passe oublié

Onze personnes ont tenté une connexion par email (mode « Se connecter ») ;
quatre seulement y sont arrivées. Sur Android, aucune : 13 tentatives, 13
`auth/invalid-credential`. En suivant chacune :

- trois n'avaient pas de compte, sont passées à l'inscription et ont réussi ;
- deux sont passées à Google, où elles avaient leur compte, et s'y sont
  connectées ;
- deux ont abandonné, dont une après cinq essais.

À l'inverse, trois personnes ont voulu s'inscrire avec une adresse déjà
inscrite (`auth/email-already-in-use`) ; l'une a recommencé six fois sans
jamais basculer vers la connexion.

Firebase répond `invalid-credential` sans dire si l'adresse existe : l'écran
ne peut donc pas trancher, mais il peut proposer les trois sorties à la
première erreur (« Pas encore de compte ? Créer un compte », « Inscrit avec
Google ou Apple ? », « Mot de passe oublié ? »), et basculer de lui-même vers
la connexion sur `email-already-in-use`. **Il n'existe aujourd'hui aucun
parcours de mot de passe oublié** (`loginView.vue`, `authService.ts`) :
quelqu'un qui a vraiment oublié le sien n'a aucune issue.

### 2.2 La lecture du jour derrière un mur de connexion

La lecture du jour demande un compte : 24 sessions sont arrivées sur `/login`
avec `redirect=/bibliotheque/lecture-du-jour`, 13 se sont connectées, **11 sont
reparties sans même essayer**. C'est aussi là que mène « Composer ma lecture
du jour » à la fin de l'introduction : sur 25 personnes qui ont choisi ce
bouton, 9 ont fini par configurer une lecture du jour, une seule en a marqué
une comme lue. L'introduction promet une chose et ouvre un écran de connexion
sans dire pourquoi.

Pistes : dire sur l'écran de connexion ce qu'on y gagne quand on y arrive par
la lecture du jour, ou laisser composer la lecture sans compte (sur
l'appareil) et ne proposer le compte que pour la synchroniser.

Les arrivées sur `/login` sans redirection aboutissent mieux : 54 connexions
pour 84 sessions.

### 2.3 Les horaires d'un autre jour : jusqu'à 37 appuis sur « Jour suivant »

Le clic de rage le plus fréquent de tout le produit porte sur les flèches de
jour de `/horaires`, « Jour suivant » surtout (12 personnes). Ce n'est pas une flèche en panne :
on cherche une date lointaine (le prochain Chabbat, une fête) et on y va jour
par jour. Depuis l'arrivée du sélecteur de date (17 septembre), 12 sessions
ont appuyé au moins trois fois sur la flèche, dont 9 entre 8 et 37 fois ; deux
seulement ont ouvert le sélecteur. Sur trente jours : 27 sessions (18
personnes), 4 avec le sélecteur.

Le sélecteur est caché dans le titre de date, qui ne se lit pas comme un
bouton. Pistes : une icône calendrier à côté de la date, et des raccourcis
« Chabbat » et « Prochaine fête ».

### 2.4 Apple et Google sur iOS

- **Apple** : 24 personnes, 18 connexions. Six ont reçu l'erreur 1000
  (`AuthorizationError`), que l'écran présente comme une limite de l'appareil
  (« indisponible ») ; or deux ont réussi en réessayant aussitôt, une est
  passée à Google, trois ont abandonné. L'erreur 1000 n'est donc pas toujours
  définitive : le message devrait inviter à réessayer avant de renvoyer vers
  Google ou l'email.
- **Google sur iOS** : 12 personnes, 7 connexions, 4 échecs suivis d'un
  abandon (Safari indisponible pour deux d'entre elles).

### 2.5 Les pages du calendrier restent des impasses

C'est la première porte du site : 422 sessions y commencent sur trente jours
(224 sur `/calendrier`, 198 sur la page d'une fête, presque toutes
Yom Kippour), surtout depuis un moteur de recherche. **9 seulement ouvrent
une seconde page (2 %).** Ce qu'on y clique : « Mes dates » (11 sessions,
les dates personnelles), l'année suivante ou précédente, « Fermer ».

`calendar_cta_clicked` (posé le 22 septembre) n'a encore rien reçu, mais les
pages de fête n'ont été vues que trois fois par une version qui l'envoie (les
vingt autres vues depuis venaient d'un site encore en cache) : il est trop tôt
pour conclure, à revoir après la prochaine fête qui amène du trafic.

### 2.6 La recherche globale de la bibliothèque aboutit rarement

Recherche lancée depuis l'étagère (`scope = all`) : 16 sessions, 3 seulement
ouvrent un texte dans les trois minutes. La recherche dans un rayon fait
mieux (environ une fois sur deux). On ne sait pas ce qui était cherché (voir
3.2) ; les replays ne le disent pas non plus, les saisies y étant masquées.

### 2.7 Les petites frictions

- **L'onglet actif ne fait rien.** « Accueil » touché sur l'accueil : 129
  appuis, 38 personnes. Sur iOS comme sur Android, toucher l'onglet où l'on
  est remonte en haut de la page ; ici rien ne se passe.
- **La géolocalisation.** À l'ouverture d'un office, Android refuse la
  position pour 17 des 40 personnes qui la voient demander (24 refus sur 200
  demandes) ; iOS presque jamais (7 sur 207). Sur iOS, « Utiliser ma
  position » (sidour) et « Ma position » (horaires) sont touchés à répétition
  par 5 personnes : le bouton reste désactivé le temps de la recherche, sans
  autre signe qu'un spinner.
- **Les chiourim.** 157 personnes voient la liste, 61 ouvrent un cours, 39
  l'écoutent. Le filtre le plus choisi, Halakha (24 personnes), ne renvoie
  qu'un cours ; Paracha (16 personnes), quatre. C'est une demande de contenu
  plus qu'un problème d'interface.
- **Le défilement automatique** : un arrêt sur six par l'utilisateur survient
  moins de trois secondes après le départ, ce qui ressemble à un double appui
  involontaire (le geste qui le lance).
- **Créer une chaîne** : 14 personnes commencent, 8 vont au bout ; 5 échecs
  de validation (le champ manquant n'était pas encore nommé dans l'événement,
  c'est corrigé).
- **Le profil** : des appuis répétés sur l'email et l'identifiant, affichés
  comme des champs alors qu'ils ne se modifient pas.

## 3. Navigation : orientés, ou en recherche ?

Dans l'app, environ 80 % des sessions atteignent un contenu (texte, horaires,
cours, chaîne...). Environ 4 % errent : quatre pages ou plus sans rien
ouvrir. Trois motifs reviennent :

1. **Le tour des onglets** (accueil, bibliothèque, chiourim, profil, accueil) :
   surtout des nouveaux venus qui découvrent, sans signe de blocage.
2. **Les allers-retours entre rayons** (tanakh, moadim, talmud, tehilim...,
   avec retour à l'étagère entre chaque) : quelqu'un cherche un texte et ne
   sait pas dans quel rayon il range. C'est le cas que la recherche globale
   devrait couvrir, et c'est là qu'elle échoue le plus (2.6). En pleine
   période de fêtes, un raccourci « Textes de la fête » sur l'étagère, comme
   l'encart déjà posé en tête du sidour, est une piste.
3. **Le ping-pong avec la lecture du jour** (accueil, lecture du jour,
   accueil, lecture du jour) : la page ne retient pas, sans qu'on sache ce
   qu'elle affichait (vide, demande de connexion ?), faute d'événement (3.7).

Sur le site, la navigation se résume aux pages du calendrier (2.5) : on y
entre, on y lit, on s'en va.

## 4. Là où ça casse

L'Error tracking est calme : 109 exceptions en trente jours, chez 28
personnes.

| Erreur                                                      | Qui                              | État                                                     |
| ----------------------------------------------------------- | -------------------------------- | -------------------------------------------------------- |
| `"LocalNotifications.then()" is not implemented`            | 64 exceptions, v3.10.0 seulement | disparu des versions suivantes                           |
| `AuthorizationError` 1000 (Apple)                           | 9 exceptions, toutes versions    | voir 2.4 : le message, pas un correctif natif            |
| `Unable to open Safari` (Google, iOS)                       | 4 exceptions, v3.7               | anciennes versions                                       |
| Téléchargement refusé (permissions Android 10)             | 1 personne, v3.10.7              | corrigé le 1er octobre (d50b58e), pas encore publié      |
| `section_mark_read_failed` (« Réservation introuvable », conflit de version) | 3 personnes, site | à suivre : une section marquée lue qui ne l'est pas     |
| Chunk servi en `text/html` (déploiement)                    | 2 personnes, site                | rechargement déjà prévu (`chunk_load_error`)             |

Côté performance, deux signaux :

- **Décalages de mise en page (CLS)** : le 75e centile est mauvais (au-delà
  de 0,25 ; bon : moins de 0,1) sur toutes les pages de l'app Android, et
  proche de 1 sur la moitié d'entre elles. Sur le site ordinateur, 39
  mesures sur 60 sont mauvaises, dont 14 sur 19 pour `/calendrier`, la page
  d'entrée qui compte pour le référencement. Une part
  peut venir de l'accumulation du CLS au fil d'une session SPA ; à vérifier
  sur un replay avant d'y passer du temps.
- **iOS ne mesure rien** : la webview WKWebView n'expose ni LCP, ni CLS, ni
  INP. Il n'y a aucun `$web_vitals` iOS ; seul `perf_degraded_rendering`
  dit quelque chose de la fluidité sur iPhone.

Replays qui illustrent ces constats (conservés trente jours) :

- [11 appuis sur « Jour suivant »](https://eu.posthog.com/project/233968/replay/01a0e8bd-7fe3-7561-befd-23eb7b5b00c8)
  (Android, 28 septembre) ;
- [inscription refusée trois fois (adresse déjà prise), connexion refusée, puis Google](https://eu.posthog.com/project/233968/replay/01a0e8c5-84b0-74b0-8360-a6da3d8c858d)
  (Android, 28 septembre) ;
- recherche globale sans texte ouvert :
  [1er octobre](https://eu.posthog.com/project/233968/replay/01a0f884-4829-7822-b7a9-c6ee6d0ea915),
  [30 septembre](https://eu.posthog.com/project/233968/replay/01a0f0c2-273e-790a-8123-0502da1ac0f0).

## 5. Ce qui manque au suivi

Les règles du plan de suivi (`docs/tracking-plan.md`) valent pour chaque
ajout : rien n'est renommé ni supprimé, une propriété mal nommée reçoit sa
remplaçante à côté, et chaque événement ou propriété ajouté s'y documente
dans le même changement.

### 5.1 Le filtre des comptes de test ne filtre presque rien

Le filtre de PostHog (« Filter out internal and test users ») repose sur la
cohorte 193531, qui ne retient que les adresses `@phenixel.fr` : une personne.
Il laisse passer `contact.phenixel@gmail.com`, le testeur et le compte de
review, que `user_type` sait pourtant reconnaître : **26 % des événements
Android du mois** (10 242 sur 39 505) viennent de ces comptes. Tout insight
qui coche le filtre est faussé côté Android.

À faire dans les réglages du projet (pas de code) : définir la cohorte par
`user_type` ∈ {`internal`, `tester`, `google_review`}, et ajouter
`env = production` aux filtres de test. Reste le cas connu des appareils de
l'équipe avant connexion, que rien ne permet d'étiqueter.

### 5.2 La recherche ne dit ni quoi, ni combien, ni si elle a servi

`library_search_used` part à la première frappe avec la seule portée ;
`chiourim_search_used` avec la seule catégorie. On ne peut répondre à aucune
des questions de 2.6. À ajouter, débouncé (une fois la saisie posée) :

| Événement                     | Propriétés                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `library_search_performed`    | `scope`, `query` (normalisée, tronquée à 40 caractères), `query_length`, `results_count`         |
| `library_search_result_opened` | `scope`, `rank`, `corpus`, `text_id`                                                            |
| `chiourim_search_performed`   | `category`, `query`, `results_count`                                                             |

La requête elle-même est utile (ce qu'on cherche et qu'on n'a pas) et peu
risquée : ce sont des noms de livres. Un `results_count = 0` fréquent sur un
même terme est exactement la liste des textes à ajouter.

### 5.3 D'où vient la lecture

`text_opened.source` ne vaut que `library` ou `session` : une ouverture
depuis la recherche, une carte de l'accueil, « Reprendre ma lecture », la
lecture du jour, un lien profond, une notification ou l'office suivant se
confondent. À ajouter à côté : `entry` (`corpus_list`, `search`,
`home_card`, `resume`, `daily_reading`, `next_tefila`, `deep_link`, `push`,
`widget`, `session`).

### 5.4 Les horaires d'un autre jour

Aucun événement quand on change de jour : les constats de 2.3 viennent des
clics automatiques. À ajouter : `zmanim_day_changed` avec `via` (`arrow`,
`picker`, `today`) et `offset_days`. On saura alors quelles dates on vient
chercher, et si un raccourci « Chabbat » fait reculer les flèches.

### 5.5 Pourquoi la position échoue

`zmanim_location_requested` ne porte que `granted`, alors que le code
distingue déjà le refus (`denied`) de la panne (`unavailable`). À ajouter à
côté : `outcome` (`granted`, `denied`, `unavailable`) et `duration_ms`
(l'attente qui fait tapoter le bouton sur iOS).

### 5.6 Le parcours de connexion

- `login_viewed` avec `reason` : la fonction qui y a mené (lecture du jour,
  chaînes, profil, introduction, rien). Aujourd'hui on la devine dans l'URL.
- `email_auth_failed` : `reason = error` cache la confirmation de mot de
  passe différente ; lui donner sa valeur (`password_mismatch`).
- `attempt` (rang de l'essai dans la visite) sur `*_signin_clicked` et
  `*_signin_failed` : il dirait combien d'erreurs Apple 1000 cèdent au
  deuxième essai.
- `password_reset_requested` le jour où le parcours existe.

### 5.7 Ce que montre la lecture du jour

Pas d'événement d'arrivée sur `/bibliotheque/lecture-du-jour` : on ne sait
pas ce que voient ceux qui en repartent aussitôt (3, motif 3). À ajouter :
`daily_reading_viewed` avec `state` (`logged_out`, `empty`, `configured`),
`total_count` et `done_count`.

### 5.8 Le reste

- **Clics morts** : `capture_dead_clicks` est désactivé dans les réglages du
  projet. Activé, il aurait signalé de lui-même le titre de date des horaires
  qu'on ne prend pas pour un bouton, ou les champs du profil.
- **Défilement automatique** : `trigger` (`double_tap`, `menu`) sur
  `auto_scroll_started`, pour séparer les départs voulus des doubles appuis
  involontaires.
- **Mes dates** : c'est le bouton le plus cliqué des pages du calendrier
  (2.5), et la fenêtre n'envoie rien (`occasion_opened` ne part que du
  bandeau de l'accueil, et n'a rien reçu en trente jours). À ajouter :
  `occasions_opened` avec `source`, `occasion_added` avec `kind` ; on saura
  si ce point d'entrée fait des habitués.
- **Page introuvable** : la page 404 n'envoie rien ; `not_found_viewed` avec
  `path` et `$referrer` dirait quels liens sont morts.
- **Replays de l'app** : leur `start_url` reste `https://localhost/` (la
  réécriture en `app://` ne s'applique qu'aux événements), ce qui gêne le
  filtrage des replays par page.
- **Le plan de suivi** ne documente qu'une partie des événements envoyés
  (calendrier, introduction, profil, quelques autres) : la recherche, les
  chaînes, la connexion ou le hors ligne n'y figurent pas. Les compléter au
  fil des ajouts ci-dessus.
