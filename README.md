# Petite Jerusalem
    
  GemaraChain est une application web développée avec Django, permettant aux utilisateurs de créer et de rejoindre des chaînes d'études du Talmud. En utilisant des vues basées sur des classes et des modèles Django, les utilisateurs peuvent choisir parmi les Gemarot disponibles dans une session donnée, avec chaque Gemara devenant indisponible une fois choisie.
  
  ## Concept
  
  GemaraChain est une application web permettant aux utilisateurs de créer et de rejoindre des chaînes d'études du Talmud, où chaque chaîne se concentre sur l'étude d'une Gemara spécifique.
  
- Sur la page d'accueil, les utilisateurs voient une liste des sessions en cours. Ils peuvent soit créer une nouvelle session, soit rejoindre une session existante.
- Lorsqu'ils accèdent à une session, les utilisateurs voient la liste des Gemarot (livres du Talmud) disponibles pour cette session.
- Chaque utilisateur peut choisir une Gemara parmi celles disponibles. Une fois qu'une Gemara est choisie, elle devient indisponible pour les autres utilisateurs de la même session.
  
  ## Stack Utilisée
  
- **Langage de Programmation :** Python
- **Framework Web :** Django
- **Base de Données :** SQLite (pour la simplicité, mais peut être remplacée par d'autres comme PostgreSQL ou MySQL)
- **Modèles :**
    - `Gemara` : Représente une Gemara (livre du Talmud) avec un nom et un état de disponibilité. Lorsqu'un utilisateur choisit une Gemara, son état change pour devenir indisponible.
    - `Session` : Représente une session d'étude, où les utilisateurs peuvent se joindre pour étudier une Gemara spécifique.
- **Vues :** Nous avons utilisé des vues basées sur des classes pour organiser le code de l'application de manière orientée objet et réutilisable.
    - `HomeView` : Affiche la liste des sessions en cours sur la page d'accueil.
    - `CreateSessionView` : Permet aux utilisateurs de créer une nouvelle session.
    - `ChooseGemaraView` : Permet aux utilisateurs de choisir une Gemara pour une session.
    - `SessionDetailView` : Affiche les détails d'une session, y compris les Gemarot associés.
- **Templates HTML :** Nous avons créé des templates pour rendre l'interface utilisateur conviviale et informative.
    - `home.html` : Page d'accueil affichant les sessions en cours et permettant de créer ou de rejoindre une session.
    - `session_list.html` : Affiche la liste des sessions en cours.
    - `create_session.html` : Formulaire pour créer une nouvelle session.
    - `gemara_list.html` : Affiche la liste des Gemarot disponibles pour une session.
    - `gemara_detail.html` : Affiche les détails d'une Gemara spécifique.
  
## Installation

Pour installer et exécuter le projet localement, suivez les étapes ci-dessous :

1. **Cloner le dépôt :**
  ```bash
  git clone <URL_DU_DEPOT>
  cd <NOM_DU_DEPOT>
  ```

2. **Créer et activer un environnement virtuel :**
  ```bash
  python -m venv env
  source env/bin/activate  # Sur Windows, utilisez `env\Scripts\activate`
  ```

3. **Installer les dépendances :**
  ```bash
  pip install -r requirements.txt
  ```

4. **Appliquer les migrations de la base de données :**
  ```bash
  python manage.py migrate
  ```

5. **Initialiser les données d'étude :**
  ```bash
  python manage.py shell
  ```

  ```python
  from ChainApp.utils import initialize_text_studies
  initialize_text_studies()
  exit()
  ```

6. **Lancer le serveur de développement :**
  ```bash
  python manage.py runserver
  ```

7. **Accéder à l'application :**
  Ouvrez votre navigateur et allez à `http://127.0.0.1:8000/`.

  Vous devriez maintenant pouvoir utiliser l'application GemaraChain localement.