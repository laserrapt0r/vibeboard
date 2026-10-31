# vibeboard

[English](README.md) · [Deutsch](README.de.md) · [Español](README.es.md) · **Français**

Un tableau blanc collaboratif en ligne, auto-hébergé. Plusieurs personnes travaillent en même temps sur un canevas
infini : avec des notes adhésives, des formes, des connecteurs, des cartes mentales, des commentaires, des votes et plus
de 75 modèles pour des ateliers, des rétrospectives, le travail stratégique, le développement logiciel, la gestion de
projet et la gestion des services informatiques. Pour les équipes de développement, il y a des blocs de code, des
diagrammes à partir d'un texte (syntaxe Mermaid), des sessions d'estimation et un import de cartes depuis des exports
Jira ou Excel. Pour le travail en équipe, il y a des notifications pour les @mentions, un historique d'activité, des
droits d'animation, des équipes et des dossiers, des liens invités limités dans le temps et des visites guidées
enregistrées. S'y ajoutent des comptes utilisateurs avec confirmation par e-mail et connexion à deux facteurs
facultative, des droits par tableau et une interface d'administration. Les données sont stockées dans PostgreSQL.

- Fonctionne entièrement sur votre propre serveur : pas de CDN, pas de suivi, pas de dépendance obligatoire à des services externes.
- Les fichiers téléversés sont analysés avec ClamAV pour détecter les logiciels malveillants.
- Mises à jour automatiques avec sauvegarde : les nouvelles versions mettent elles-mêmes la base de données à jour au démarrage.
- Toutes les fonctionnalités sont documentées sous forme d'exigences : [docs/anforderungen](docs/anforderungen/README.md) (les documents d'exigences sont en allemand).
- Frontend en JavaScript et SVG purs, sans étape de compilation.
- Backend en Node.js avec seulement quatre dépendances (`pg`, `nodemailer`, `uqr`, `pdfjs-dist`).
- Interface en anglais, allemand, espagnol et français : la langue suit le navigateur, l'anglais est la langue par défaut.

![Collaboration en temps réel : pointeurs de souris avec noms, sélection d'une autre personne et chat du curseur](docs/screenshots/zusammenarbeit.png)

---

## Captures d'écran

| | |
|---|---|
| ![Aperçu des tableaux avec « Mes tâches »](docs/screenshots/uebersicht.png) | ![Planification de sprint avec panneau des tâches et session d'estimation](docs/screenshots/sprint-schaetzrunde.png) |
| **Aperçu :** tableaux personnels et partagés, « Mes tâches » sur tous les tableaux | **Planification de sprint :** cartes avec priorité et story points, panneau des tâches, session d'estimation avec cartes masquées |
| ![Diagramme d'architecture avec connecteur courbe et points d'inflexion](docs/screenshots/architektur-verbinder.png) | ![Boîte de dialogue « Diagramme à partir d'un texte » avec aperçu en direct](docs/screenshots/diagramm-aus-text.png) |
| **Connecteurs :** ancrage libre, courbes, points d'inflexion, extrémités de ligne | **Diagramme à partir d'un texte :** la syntaxe Mermaid devient des formes modifiables |
| ![Conception d'API avec tableau et bloc de code](docs/screenshots/api-design-code.png) | ![Modèle Post-mortem d'incident](docs/screenshots/incident-postmortem.png) |
| **Développement logiciel :** tableaux et blocs de code avec coloration syntaxique | **Gestion des services informatiques :** p. ex. post-mortem d'incident |
| ![Galerie de modèles, catégorie Gestion des services informatiques](docs/screenshots/vorlagen.png) | ![Administration avec métriques système](docs/screenshots/administration.png) |
| **Plus de 75 modèles** dans 12 catégories | **Administration :** aperçu avec CPU, mémoire, espace disque et plus encore |

Tous les contenus des captures d'écran sont des données d'exemple.

---

## Sommaire

- [Captures d'écran](#captures-décran)
- [Fonctionnalités](#fonctionnalités)
- [Modèles](#modèles)
- [Installation](#installation)
- [Configuration](#configuration)
- [Comptes et connexion](#comptes-et-connexion)
- [Droits sur les tableaux](#droits-sur-les-tableaux)
- [Administration](#administration)
- [Accessibilité](#accessibilité)
- [Langues](#langues)
- [Protection antivirus des téléversements](#protection-antivirus-des-téléversements)
- [Versions et mises à jour](#versions-et-mises-à-jour)
- [Journalisation](#journalisation)
- [Sécurité](#sécurité)
- [Stockage des données et confidentialité](#stockage-des-données-et-confidentialité)
- [Architecture](#architecture)
- [Licence](#licence)

---

## Fonctionnalités

### Canevas et navigation
- Canevas infini avec zoom de 1 % à 800 %
- Déplacement avec la barre d'espace, l'outil main, le bouton central de la souris ou le pavé tactile ; zoom par pincement sur les appareils tactiles
- Mini-carte, « Tout afficher », niveaux de zoom fixes
- Grille de points, magnétisme de la grille, repères intelligents lors du déplacement
- Thème clair et sombre ; l'affichage est mémorisé par tableau

### Contenus
| Élément | Possibilités |
|---------|---------------|
| **Notes adhésives** | 16 couleurs, taille de police automatique, en option avec le nom de l'auteur ou de l'autrice |
| **Texte** | Taille de police, couleur, gras, italique, alignement, arrière-plan |
| **Formes** | Plus de 60 formes en sept groupes : formes de base, organigramme (document, plusieurs documents, saisie manuelle, affichage, etc.), UML (classe avec compartiments, acteur, paquetage, composant, nœud, début/fin, fourche, signaux), BPMN (événements, passerelles), réseau et centre de données (routeur, switch, pare-feu, répartiteur de charge, point d'accès, internet, serveur, baie de serveurs, système de stockage, PC, smartphone), logiciel et informatique, plateforme de conteneurs (pod, deployment, service, ingress, node, ConfigMap, secret, volume) – toutes des dessins originaux, avec remplissage, bordure, type de trait et texte |
| **Connecteurs** | droits, coudés ou courbes ; s'ancrent à n'importe quel endroit du contour (ou automatiquement) ; tirer sur la ligne la courbe, les points d'inflexion peuvent être insérés, déplacés et supprimés ; étiquette déplaçable ; 9 extrémités de ligne (flèche, losange, cercle, patte de corbeau, etc.), type de trait |
| **Connexion rapide** | Cliquer sur les points d'un élément sélectionné, ou les faire glisser, pour créer des éléments reliés |
| **Dessin libre** | Stylo, surligneur, gomme |
| **Cadres** | Zones ou diapositives avec formats (16:9, 4:3, A4, carré, smartphone) ; le contenu suit lors du déplacement |
| **Cartes** | Tâches avec description, responsable, date d'échéance, statut, priorité, story points, numéro de ticket, étiquettes et couleur |
| **Blocs de code** | Code source avec coloration syntaxique pour 13 langages, numéros de ligne, thème clair ou sombre, bouton de copie |
| **Diagramme à partir d'un texte** | Saisir des organigrammes et des diagrammes de séquence en syntaxe Mermaid, avec aperçu en direct ; il en résulte des formes et des connecteurs normaux et modifiables |
| **Tableaux** | Sélectionner des cellules et des plages ; par cellule gras, italique, souligné, barré, alignement, taille de police, couleur du texte et de la cellule ; insérer et supprimer des lignes/colonnes à n'importe quel endroit ; faire glisser les largeurs de colonne et les hauteurs de ligne ; utilisation au clavier comme dans un tableur |
| **Cartes mentales** | Sélectionner un nœud, puis **Tab** pour un nœud enfant et **Entrée** pour un nœud frère |
| **Images** | par téléversement, glisser-déposer ou depuis le presse-papiers ; les grandes images sont réduites automatiquement |
| **Stickers** | Emojis comme éléments librement positionnables |
| **Liens** | Associer une URL à des éléments ; une icône de lien l'ouvre |
| **Commentaires** | Fils de discussion n'importe où, @mentions avec liste de suggestions et notification, statut « Terminé », attribution comme tâche (avec échéance), aperçu des commentaires avec le filtre « Attribué à moi » |

Coller du texte sur plusieurs lignes dans le tableau crée automatiquement une note adhésive par ligne.

### Édition
- Sélection multiple par cadre de sélection ou par clic avec Maj
- **Redimensionner :**
  - Les poignées latérales ne modifient que la largeur ou la hauteur, y compris pour les éléments plats comme les barres de Gantt.
  - Maj conserve les proportions, Alt redimensionne à partir du centre.
  - La taille s'affiche pendant le glissement.
- **Magnétisme :**
  - sur les bords, les centres et les lignes de tableau des autres éléments
  - sur une largeur/hauteur identique et sur des écarts identiques (avec repères de distance)
  - sur la grille (10–50 px au choix)
  - Maj déplace uniquement à l'horizontale ou à la verticale.
- **Valeurs exactes :** saisir X, Y, largeur et hauteur, y compris pour plusieurs éléments à la fois.
- **Sélection multiple :**
  - Aligner (à gauche, au centre, à droite, en haut, en bas), répartir uniformément, juxtaposer sans espace ou avec un
    écart fixe, disposer en grille.
  - Même largeur, hauteur ou taille ; copier et appliquer la taille ; aligner sur la grille.
- **Duplication intelligente :** Ctrl+D répète le dernier décalage utilisé.
- Regrouper les notes adhésives par couleur
- Grouper, verrouiller, calques (premier plan et arrière-plan), dupliquer (aussi par glissement avec Alt) ; un deuxième
  clic dans un groupe sélectionne un seul élément pour le modifier
- Copier et coller, y compris entre tableaux
- Annuler et rétablir, menu contextuel, recherche (Ctrl+F)
- De nombreux raccourcis clavier (aperçu avec `?`)

### Collaboration en temps réel
- Les modifications apparaissent immédiatement chez tous les participants
- **Curseurs en direct avec noms :**
  - La sélection des autres est marquée en couleur et porte leur nom ; la personne qui est en train d'écrire s'affiche
    avec « ✎ Nom écrit … ».
  - Les personnes en dehors de votre vue apparaissent sous forme de flèche au bord de l'écran ; un clic permet de les rejoindre.
  - Les personnes absentes (autre onglet) sont grisées ; les vues de tous figurent sous forme de cadres dans la mini-carte.
  - Les pointeurs de souris des autres peuvent être masqués dans les paramètres.
- **Chat du curseur :** Avec `/`, affichez un court message directement à côté de votre propre pointeur de souris, sans créer de commentaire
- Liste des participants avec « Suivre » (suivre la vue d'une personne), « Tout le monde me rejoint » et « Tout le monde me suit »
- **Mode privé :** Au début, tout le monde collecte en secret : les nouveaux contenus ne sont visibles que par leur
  auteur, jusqu'à ce qu'ils soient révélés ensemble. Le serveur ne communique auparavant les contenus à personne d'autre.
- Réactions volantes (emojis) et pointeur laser
- Reconnexion automatique ; les modifications non envoyées ne sont pas perdues
- **État de l'enregistrement** dans l'en-tête : « Enregistré » seulement lorsque toutes vos modifications sont arrivées
  dans la base de données ; sinon « Enregistrement en cours … », « Hors ligne – n en attente » ou « Enregistrement
  retardé ». Tant que des modifications restent bloquées hors ligne, le navigateur demande confirmation avant la
  fermeture de la page.
- **Indicateur de chargement :** À l'ouverture d'un tableau, un indicateur de chargement apparaît après un court
  instant et, après quelques secondes, avec une indication sur un éventuel proxy. La page d'accueil affiche des
  espaces réservés, les requêtes plus longues une barre de progression.
- **Fonctionne aussi dans les réseaux restrictifs :** Aucun WebSocket n'est nécessaire. La transmission en temps réel passe par
  Server-Sent Events (HTTP normal). Si ceux-ci sont aussi bloqués ou mis en mémoire tampon par un proxy, vibeboard passe
  au long polling au plus tard après quatre secondes et le mémorise dans le navigateur pendant sept jours : le tableau
  suivant s'ouvre alors sans attente. Avec `?transport=sse` ou `?transport=poll`, la méthode peut être imposée.

  *Pourquoi cela peut-il prendre du temps derrière un proxy direct ?* Server-Sent Events est une réponse HTTP qui ne se
  termine jamais. Certains proxys (et antivirus dans les proxys) retiennent les réponses jusqu'à ce qu'elles soient
  complètes ou qu'un tampon soit plein : rien n'arrive alors d'abord dans le tableau. C'est pourquoi vibeboard envoie
  au début 2 Ko de caractères de remplissage (suffisant pour de nombreux proxys) et détecte un flux bloqué à
  l'absence du message de démarrage.

### Travail en équipe
- **Notifications :** Cloche sur la page d'accueil et dans le tableau pour les @mentions, les réponses et les
  commentaires attribués : en direct et, si souhaité, par e-mail (au plus un par tableau toutes les dix minutes,
  désactivable dans le profil).
- **Historique d'activité :** qui a créé, modifié, supprimé ou commenté quoi et quand, de façon résumée, avec saut vers
  l'élément. À l'ouverture, un avis montre les modifications des autres depuis la dernière visite et les marque sur le canevas.
- **Rôle « Commenter »** entre consulter et modifier : pour les services métiers, les clients ou les revues.
- **Équipes et dossiers :** Partagez des tableaux avec toute une équipe (modifier, commenter ou consulter), dossiers
  personnels et dossiers dans l'équipe. Les nouveaux membres sont **invités** par adresse e-mail et doivent accepter
  l'invitation (page d'accueil ou cloche) ; les administrateurs de l'équipe voient les invitations en attente et peuvent
  les retirer.
- **Invitation sans compte :** Les tableaux et les équipes peuvent aussi être partagés avec des adresses qui ne sont pas
  encore inscrites. Après une demande de confirmation, un e-mail d'invitation est envoyé ; après l'inscription via le
  lien, le tableau est partagé ou la personne fait partie de l'équipe.
- **Liens invités :** Les personnes sans compte consultent ou commentent un seul tableau : limité dans le temps, blocable à
  tout moment, désactivé par défaut.
- **Enregistrer des visites guidées :** Vue, pointeur de souris et pointeur laser, avec le son si souhaité ; d'autres
  personnes lisent la visite guidée et peuvent naviguer elles-mêmes pendant ce temps.
- **Réactions :** Emojis directement sur les notes adhésives, les cartes et autres, avec nombre et noms, y compris pour les
  lecteurs (clic droit).
- **Étiquettes et filtres :** Étiqueter les notes adhésives, les cartes et les formes ; le filtre estompe tout le reste
  (par étiquette, couleur, personne, réactions, actions), uniquement dans votre propre vue.
- **Pièces jointes :** Déposez sur le tableau des fichiers PDF, Word, Excel, PowerPoint, OpenDocument, texte, CSV et JSON ;
  les PDF avec aperçu de la première page et visionneuse (pdf.js), le tout avec analyse antivirus et en téléchargement.
- **Connexion aux messageries (webhooks) :** Notifications vers votre propre messagerie (Microsoft Teams, Slack, Matrix ou JSON),
  canaux d'équipe pour les nouveaux tableaux d'équipe et résumés de rétros. Désactivé par défaut, avec protection contre
  les appels vers le réseau interne.

### Animation
- **Droits d'animation :** Verrouiller la modification pour les participants, réserver le minuteur, le vote, la session
  d'estimation et le mode privé aux animateurs, verrouiller des éléments individuels (p. ex. les arrière-plans de modèles)
  pour les participants. D'autres animateurs peuvent être ajoutés via le menu de l'avatar. Le serveur applique tous les
  verrous.
- **Minuteur** pour tous les participants, avec pause, prolongation et signal sonore
- **Votes** avec un nombre de voix réglable par personne ; les voix restent masquées jusqu'à la fin, puis une liste de résultats s'affiche
- **Session d'estimation** avec cartes masquées pour une carte : jeu de Fibonacci, de tailles de t-shirt ou d'heures ;
  les valeurs restent masquées jusqu'à la révélation. Ensuite apparaissent la moyenne, la médiane et l'étendue, et le
  résultat peut être repris comme story points.
- **Mode présentation** : les cadres deviennent des diapositives (plein écran, touches fléchées et espace, environnement masqué)
- **Zones masquées :** Les animateurs masquent un cadre ; les participants ne voient qu'un cache jusqu'à la révélation.
  Le serveur ne communique pas le contenu auparavant.

### Rétrospectives
- **Déroulement guidé** (bouton 🔁) : Check-in → Revue → Collecter → Révéler → Regrouper → Voter → Discuter →
  Actions → Clôture. À chaque étape, vibeboard configure les outils adaptés (collecte masquée et, si souhaité,
  anonyme, minuteur, vote sur des thèmes, discussion, sondages).
- **Groupes de thèmes :** Sélectionner des contributions → « Former un groupe de thèmes » ; le vote porte ensuite sur des thèmes.
- **Mode discussion :** Les thèmes dans l'ordre des voix, le thème en cours est mis en évidence pour tous, minuteur par
  thème et question « Continuer à discuter ? 👍 ✋ 👎 ».
- **Contributions anonymes :** Sans nom même après la révélation : aucun n'est enregistré.
- **Sondages rapides :** Baromètre d'humeur, Fist of Five, ROTI, bilan de santé de l'équipe, question libre : anonymes,
  avec évolution sur la série de rétros.
- **Actions avec suivi :** Contribution → « Consigner comme action » (personne, échéance) ; apparaît sous « Mes
  tâches ». « Créer la prochaine rétro » reprend la structure ; la rétrospective y montre les actions ouvertes de la
  dernière rétro, à cocher ou à reporter.
- **Résumé** en Markdown, PDF, par e-mail aux personnes concernées ou dans le canal de l'équipe.
- **Roue de la fortune et ordre de parole** : tout le monde voit le même résultat.

### Travail de projet
- **Panneau des tâches** par tableau :
  - Toutes les cartes sous forme de liste, groupées par statut, avec les sommes de story points.
  - Filtres « Ouverte », « Attribué à moi », « En retard » ; un clic mène à la carte.
- **Mes tâches** sur la page d'accueil : toutes les cartes qui me sont attribuées dans tous mes tableaux, triées par échéance.
- **Historique des versions :**
  - Enregistrer des états, versions automatiques toutes les 30 minutes pendant l'édition.
  - Restaurer des états antérieurs (l'état actuel est enregistré auparavant) ou les ouvrir comme copie.
- **Importer des cartes** depuis CSV, Excel, Jira ou Azure DevOps :
  - Les colonnes comme Summary, Assignee, Status, Due Date, Story Points, Priority, Labels sont reconnues.
  - En option, les cartes sont disposées en colonnes Kanban selon le statut.
- **Liens directs** vers des éléments individuels : `/board/<id>#el=<elementId>`

### Export et import
- PNG (tableau entier ou sélection) et SVG
- PDF avec un cadre par page (via la boîte de dialogue d'impression du navigateur)
- JSON comme sauvegarde ; import dans le tableau ou comme nouveau tableau
- Cartes depuis CSV/tableaux, diagrammes à partir d'un texte (voir ci-dessus)

### Aperçu
- Navigation à gauche : « + Nouveau tableau », Accueil, Mes tâches, tous les tableaux / personnels / partagés, dossiers
  personnels, équipes (avec les dossiers comme filtre) ; à droite n'apparaît que l'affichage choisi
- Accueil : barre de modèles repliable, avis sur les tâches arrivant à échéance, tableaux modifiés récemment
- Tableaux personnels et partagés avec vignettes
- Recherche, tri, partage, renommage, duplication, suppression, quitter un tableau
- **Corbeille :** Les tableaux supprimés restent restaurables pendant 30 jours (réglable), puis ils sont supprimés définitivement.
- Nouveau tableau directement à partir d'un modèle, y compris à partir de **modèles personnels** (enregistrer un tableau
  ou une sélection comme modèle personnel ou d'équipe)
- **Application installable (PWA) :** utilisable dans sa propre fenêtre depuis le navigateur via « Installer l'application » (menu du compte)
- « Mes tâches » sur tous les tableaux (cartes et commentaires attribués)
- Cloche avec notifications

---

## Modèles

| Catégorie | Modèles |
|-----------|----------|
| Brainstorming | Brainstorming, Carte mentale, Six perspectives, Crazy 8s, Pour et contre |
| Réunions et rétros | Start · Stop · Continue, Mad · Sad · Glad, 4L, voilier, étoile de mer, DAKI, rétro frise chronologique, montgolfière, Speedcar, Tour de sujets ouverts, Radar d'équipe, Daily Stand-up, Check-in / Icebreaker |
| Agile et projets | Kanban, Matrice d'Eisenhower, Matrice impact/effort, Project Canvas, Roadmap produit, Frise chronologique, Diagramme de Gantt, User Story Map, Planificateur hebdomadaire |
| Stratégie | Analyse SWOT, Carte des parties prenantes, Business Model Canvas¹, Lean Canvas¹, Planification OKR, Matrice de décision |
| Design et UX | Customer Journey Map, Empathy Map, User Persona, Moodboard, Wireframe |
| Développement logiciel | Planification de sprint, Kanban de développement avec limites WIP, Definition of Ready et Done, Architecture (contexte C4), Diagramme ER, Event Storming, Triage des bugs, Matrice de dette technique, Planification des releases, Conception d'API, Décision d'architecture (ADR) |
| UML | Diagramme de classes, Diagramme de cas d'utilisation, Diagramme d'activité, Diagramme d'états, Diagramme de composants, Diagramme de déploiement, Diagramme de séquence |
| Gestion de projet | Kick-off de projet, Matrice des risques, Journal RAID, État du projet, Plan des jalons, Matrice RACI, Planification inter-équipes, Lessons Learned |
| Gestion des services informatiques | Post-mortem d'incident, Cellule de crise Major Incident, Analyse de problème (est / n'est pas), Demande de changement et CAB, Service Blueprint, SIPOC, Analyse de la chaîne de valeur, Catalogue de services, Passation d'astreinte, Runbook, Revue de SLA / de service, Modèle de processus (BPMN) : incident |
| Infrastructure informatique | Plan réseau, Occupation des racks, Plateforme de conteneurs (cluster) |
| Diagrammes | Logigramme, Organigramme, Ishikawa (arête de poisson), Méthode des 5 pourquoi |

¹ Adaptation d'une œuvre sous CC BY-SA 3.0, voir [Licence](#licence).

---

## Installation

### Avec Docker (recommandé)

```bash
git clone https://github.com/laserrapt0r/vibeboard.git
cd vibeboard
cp .env.example .env            # définir POSTGRES_PASSWORD avec un mot de passe long et aléatoire
docker compose up -d --build    # démarre PostgreSQL, ClamAV et vibeboard
```

Ensuite, vibeboard est accessible à l'adresse http://localhost:3000. Le port est défini par `PORT` dans le `.env`.

Voici la suite :
1. Lors du premier accès, l'inscription s'ouvre. **Le premier compte devient automatiquement administrateur.**
2. Sous **Administration → Serveur de messagerie**, saisissez l'accès SMTP. Ce n'est qu'ensuite que d'autres personnes
   pourront s'inscrire, car chaque inscription nécessite une confirmation par e-mail.
3. Sous **Administration → Général**, saisissez l'adresse publique si vibeboard est accessible via un nom de domaine.
4. Recommandé : configurer la connexion à deux facteurs dans le profil, sous « Sécurité et appareils ».

Sinon, `ADMIN_EMAIL`, `ADMIN_PASSWORD` et, en option, `ADMIN_NAME` dans le `.env` créent l'administrateur au démarrage
(la connexion se fait avec l'adresse e-mail).

ClamAV a besoin d'environ 1,5 Go de mémoire. Au premier démarrage, il télécharge les signatures de virus pendant
quelques minutes ; d'ici là, les téléversements sont refusés avec un avis.

Commandes utiles :

```bash
docker compose logs -f app                                        # journal
docker compose down                                               # arrêter (les données sont conservées)
docker compose exec db pg_dump -U vibeboard vibeboard > backup.sql  # sauvegarder la base de données
docker compose --profile mailtest up -d                           # en plus, serveur de messagerie de test (Mailpit)
```

Avec le profil `mailtest`, vous saisissez dans l'administration le serveur SMTP `mailpit`, le port `1025` et le
chiffrement « aucun ». Tous les e-mails apparaissent alors à l'adresse http://localhost:8025.

### Sans Docker

Prérequis : Node.js ≥ 20, PostgreSQL ≥ 13, ClamAV (`clamd`) pour les téléversements et `pg_dump` pour les sauvegardes avant les mises à jour.

```bash
npm ci
DATABASE_URL=postgres://benutzer:kennwort@localhost:5432/vibeboard \
CLAMAV_HOST=127.0.0.1 BACKUP_DIR=/var/backups/vibeboard node server.js
```

Les tables sont créées et migrées automatiquement au démarrage.

---

### Sur Kubernetes

Les manifestes se trouvent dans [deploy/kubernetes](deploy/kubernetes/README.md). L'application doit tourner avec exactement une réplique.

## Configuration

Variables d'environnement (avec Docker, dans le `.env`) :

| Variable | Valeur par défaut | Signification |
|----------|----------|-----------|
| `PORT` | `3000` | Port HTTP |
| `HOST` | `0.0.0.0` | Adresse de liaison |
| `POSTGRES_PASSWORD` | – (obligatoire) | Mot de passe de la base de données dans la configuration Docker |
| `POSTGRES_DB`, `POSTGRES_USER` | `vibeboard` | Nom et utilisateur de la base de données dans la configuration Docker |
| `DATABASE_URL` | `postgres://vibeboard:vibeboard@localhost:5432/vibeboard` | Connexion à la base de données sans Docker (ou bien `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGPORT`) |
| `PUBLIC_URL` | – | Adresse publique pour les liens dans les e-mails, p. ex. `https://board.example.de` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | – | Crée cet administrateur lors de la configuration initiale – uniquement s'il n'existe pas encore d'administrateur actif ni de compte avec cette adresse (`ADMIN_USERNAME` reste accepté comme nom) |
| `TRUST_PROXY` | `0` | Reverse proxy en amont : `1` (un proxy), `2` … (plusieurs à la suite) ou une liste d'adresses/réseaux de proxy, p. ex. `127.0.0.1, 172.16.0.0/12`. Évalue alors `X-Forwarded-For` et `X-Forwarded-Proto` – voir « Adresses IP réelles » |
| `CLAMAV_HOST`, `CLAMAV_PORT` | `clamav`, `3310` (Docker) | Service clamd pour l'analyse antivirus ; vide = pas d'analyseur |
| `BACKUP_DIR` | `/backups` (Docker) | Répertoire des sauvegardes avant les mises à jour de la base de données ; vide = pas de sauvegarde |
| `BACKUP_KEEP` | `10` | Nombre de sauvegardes conservées |
| `BACKUP_BEFORE_UPGRADE` | `1` | `0` ignore la sauvegarde (déconseillé) |
| `ALLOW_DOWNGRADE` | `0` | `1` autorise le démarrage d'une version plus ancienne sur une base de données plus récente (déconseillé) |
| `LOG_LEVEL` | `info` | Niveau de journalisation : `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent` ; modifiable à l'exécution dans l'administration |
| `LOG_FORMAT` | `text` | `text` (lisible) ou `json` (une ligne JSON par entrée, p. ex. pour Loki, Elasticsearch, Graylog) |
| `DATA_DIR` | `./data` | Dossier contenant des tableaux JSON d'une version antérieure basée sur des fichiers, pour un import unique |

Tous les autres paramètres se règlent dans l'administration.

---

## Comptes et connexion

- **Connexion avec l'adresse e-mail.** Le nom n'est qu'un nom d'affichage : il peut contenir des espaces, n'a pas à être
  unique et peut être modifié à tout moment dans le profil. Les anciens comptes sans adresse e-mail peuvent se
  connecter provisoirement avec leur nom (uniquement s'il est unique) et sont invités sur la page d'accueil à ajouter
  une adresse.
- **Inscription** avec nom, adresse e-mail et mot de passe.
  - Le compte n'est actif qu'une fois le **lien de confirmation** de l'e-mail ouvert (valable 48 heures).
  - L'e-mail de confirmation peut être redemandé sur la page de connexion.
  - Les comptes jamais confirmés sont supprimés automatiquement au bout de 14 jours.
- **Les adresses e-mail jetables** sont bloquées : une liste d'environ 10 000 fournisseurs connus, sous-domaines
  compris. De plus, l'administrateur peut bloquer ses propres domaines ou n'autoriser que certains domaines, p. ex.
  le domaine de l'entreprise.
- **Mode d'inscription :**
  - *ouvert* : Après la confirmation par e-mail, le compte est actif.
  - *avec validation* : Après la confirmation, un administrateur active le compte. Les administrateurs sont informés par e-mail.
  - *fermé* : Seuls les administrateurs créent des comptes ou invitent par e-mail.
- **Règles de mot de passe** selon NIST SP 800-63B :
  - Longueur minimale de 12 caractères (réglable)
  - Sont refusés les 10 000 mots de passe les plus courants, les mots connus suivis de chiffres, les suites de touches,
    les répétitions et les mots de passe contenant le nom ou l'adresse e-mail.
  - En option, en plus, la comparaison avec « Have I Been Pwned » (k-anonymat).
  - Un indicateur de robustesse aide à choisir. Les caractères spéciaux obligatoires n'existent volontairement pas.
- **Connexion à deux facteurs (TOTP) :**
  - Configuration par code QR avec n'importe quelle application d'authentification courante
  - 10 codes de récupération pour les urgences
  - Obligatoire pour les administrateurs sur demande
- **Mot de passe oublié** par lien envoyé par e-mail (valable une heure).
- **Profil :**
  - Nom d'affichage et couleur
  - Adresse e-mail ; une nouvelle adresse n'est prise en compte qu'après confirmation, l'ancienne reçoit un avis
  - Changer le mot de passe ; les autres appareils sont alors déconnectés
- **Sécurité et appareils :** Aperçu de tous les appareils connectés avec leur dernière activité. Un seul appareil ou tous
  les autres peuvent être déconnectés.
- **Notifications** par e-mail en cas de modifications importantes pour la sécurité : mot de passe modifié, adresse
  e-mail modifiée, connexion à deux facteurs activée ou désactivée, tentative d'inscription avec une adresse déjà
  utilisée.

### Connexion externe

En plus des comptes locaux, vibeboard peut utiliser **Keycloak**, **LDAP/Active Directory** et **l'authentification unique Kerberos**. Tout est facultatif et se configure sous *Administration → Connexion* ; LDAP est prérempli pour Active Directory. Plusieurs méthodes peuvent être actives en même temps, et les administrateurs locaux conservent toujours un accès de secours. Mise en place : [docs/authentication.md](docs/authentication.md) (en anglais).

## Droits sur les tableaux

- Les tableaux appartiennent à la personne qui les a créés. Le propriétaire peut
  - inviter des personnes comme *éditeurs*, *commentateurs* ou *lecteurs*, en option avec un e-mail d'invitation. L'invitation se fait via l'**adresse e-mail
    exacte** ou depuis la liste des personnes avec lesquelles on est dans une équipe. Une recherche sur tous les comptes
    n'existe volontairement pas : personne ne peut ainsi interroger les utilisateurs de l'installation. S'il n'existe pas
    de compte pour l'adresse, vibeboard propose, après une demande de confirmation, un e-mail d'invitation (valable
    30 jours ; uniquement si l'inscription est ouverte et si un serveur de messagerie est configuré).
  - partager le lien avec tous les utilisateurs connectés pour *consulter*, *commenter* ou *modifier*,
  - affecter le tableau à une **équipe** : tous les membres reçoivent alors le rôle choisi,
  - créer des **liens invités** pour des personnes sans compte (uniquement si un administrateur a activé l'accès invité),
  - gérer les membres, renommer le tableau et le supprimer.
- Les **lecteurs** voient le tableau en direct et peuvent voter, estimer, envoyer des réactions, utiliser le chat du
  curseur et le pointeur laser. L'historique des versions n'est visible que par les éditeurs.
- Les **commentateurs** peuvent en plus commenter, attribuer et résoudre des commentaires, et enregistrer des visites guidées.
- Lorsqu'un rôle provient de plusieurs sources (adhésion, équipe, lien), le plus élevé s'applique. Les changements de
  droits prennent effet immédiatement.
- Les **invités** ne voient que le tableau de leur lien : pas de page d'accueil, pas d'autres tableaux, pas de
  fonctions de profil ou d'équipe. À l'expiration ou au blocage du lien, leurs accès sont supprimés ; leurs
  contributions sont conservées avec leur nom.
- Les **administrateurs** ont accès à tous les tableaux.

## Administration

Sous `/admin`, réservé aux administrateurs :

- **Aperçu :**
  - Utilisateurs, part avec connexion à deux facteurs, comptes non confirmés
  - connexions échouées des dernières 24 heures
  - Tableaux, connexions actives, taille de la base de données
  - Avis sur les validations en attente et les paramètres manquants
  - **Métriques système**, actualisées toutes les 5 secondes, avec historique des 10 dernières minutes :
    - Charge CPU de vibeboard et de l'hôte, charge système
    - Mémoire de vibeboard et du conteneur ou de l'hôte
    - Temps de réponse de la boucle d'événements
    - espace disque libre pour l'application et les sauvegardes
    - Connexions à la base de données et taux de réussite du cache
    - Connexions en temps réel, durée de fonctionnement, version de Node.js
    - Les tuiles avec goulets d'étranglement sont mises en évidence en rouge.
- **Gestion des utilisateurs :**
  - Recherche et filtres (en attente, non confirmés, désactivés, administrateurs, sans deux facteurs)
  - Créer des utilisateurs, de préférence par e-mail d'invitation, afin que la personne définisse elle-même son mot de passe
  - modifier, valider, désactiver, accorder des droits d'administrateur
  - Renvoyer l'e-mail de confirmation ou confirmer l'e-mail manuellement
  - Générer un lien de mot de passe, réinitialiser les deux facteurs, terminer toutes les sessions
  - supprimer, en transférant les tableaux ou en les supprimant aussi ; le dernier administrateur est protégé
- **Tableaux :** tous les tableaux avec propriétaire, membres et partage ; changer le propriétaire, supprimer
- **Général :** Nom de l'instance, adresse publique, mode d'inscription
- **Sécurité :** Longueur minimale du mot de passe, comparaison avec « Have I Been Pwned », adresses jetables, domaines
  bloqués ou autorisés, deux facteurs obligatoires pour les administrateurs
- **Collaboration :** E-mails pour les mentions, accès invité (désactivé par défaut) et sa durée de validité maximale, qui peut
  créer des équipes, autoriser les enregistrements et leur durée maximale, pièces jointes et taille maximale de fichier, conservation
  dans la corbeille, webhooks (désactivés par défaut) et si les cibles de webhooks internes sont autorisées
- **Serveur de messagerie :** Hôte SMTP, port, chiffrement (STARTTLS, SSL/TLS, aucun), connexion, expéditeur,
  vérification du certificat ; e-mail de test également avant l'enregistrement
- **Mentions légales :** Modifier et publier les mentions légales et la politique de confidentialité (voir ci-dessous)
- **Journal :** Journal de sécurité des 12 derniers mois avec recherche et filtre. Il contient
  - les connexions et les tentatives échouées,
  - les modifications de mot de passe, d'e-mail et de deux facteurs,
  - les actions d'administration avec adresse IP.

### Mentions légales et politique de confidentialité

- Sous **Administration → Mentions légales**, les deux textes sont gérés et publiés. L'éditeur prend en charge une mise en forme
  simple (titres, paragraphes, listes, gras, italique, liens) et affiche un aperçu en direct.
- **Modèles** à insérer :
  - des mentions légales conformes au § 5 DDG
  - une politique de confidentialité adaptée au traitement réel des données par vibeboard (compte, contenus des
    tableaux, cookie de session, journal de sécurité, e-mails, en option Pwned Passwords, droits des personnes concernées)

  Les espaces réservés figurent entre [crochets]. Les modèles ne remplacent pas un conseil juridique.
- Les pages `/impressum` et `/datenschutz` sont accessibles **sans connexion**.
- Elles sont liées sur la page de connexion et d'inscription, dans l'aperçu des tableaux, dans le menu des paramètres des
  tableaux et dans l'administration.
- Les textes vides ne sont pas publiés ; leurs liens disparaissent alors automatiquement.
- Les textes sont affichés sans HTML. Le balisage saisi apparaît comme texte brut, les liens ne sont autorisés qu'avec http(s),
  mailto et tel.

---

## Accessibilité

Hors de la zone de dessin, vibeboard vise WCAG 2.2 AA dans les thèmes clair et sombre : boîtes de dialogue et menus entièrement utilisables au clavier, focus visible, liens d'évitement, annonces pour lecteurs d'écran et mouvement réduit. Sur un tableau, la *Liste des éléments* propose le contenu sous forme de texte ; un élément choisi se déplace avec les touches fléchées. Le dessin libre et la disposition sur la zone de dessin restent visuels. Les contrôles automatiques avec axe-core sont réussis, mais un test avec de vrais lecteurs d'écran reste à faire.

## Langues

L'interface, les modèles, les messages d'erreur et les e-mails existent en anglais, allemand, espagnol et français.

- La langue suit les paramètres du navigateur (première langue prise en charge) ; sinon, l'anglais s'applique. Il n'y a
  pas de sélection propre dans l'application.
- Les e-mails sont envoyés dans la dernière langue utilisée par la personne destinataire ; les invitations à des
  adresses sans compte, dans la langue de la personne qui invite.
- Les modèles sont créés dans la langue de la personne qui les insère ; les contenus des tableaux ne sont pas traduits.
- Les modèles de mentions légales et de politique de confidentialité sont en allemand, car ils se rapportent au droit
  allemand. L'exploitant est responsable de ces textes et les saisit lui-même sous Administration → Mentions légales.
- Les dictionnaires se trouvent dans `public/i18n/` ; `npm run check:i18n` les vérifie. La langue source dans le code est l'allemand.
  Les documents d'exigences sous `docs/anforderungen/` sont en allemand.

## Protection antivirus des téléversements

- **Ce qui est vérifié :** Chaque fichier téléversé, avant d'être enregistré ou distribué à d'autres :
  - Images par téléversement, glisser-déposer ou presse-papiers
  - Images dans les tableaux importés
  - Vignettes
- **Comment la vérification s'effectue :**
  - Avec ClamAV via le protocole clamd. Dans la configuration Docker, ClamAV s'exécute comme service distinct et met à jour ses
    signatures de lui-même plusieurs fois par jour (`freshclam`).
  - De plus, le contenu du fichier doit correspondre au type d'image indiqué (PNG, JPEG, GIF, WebP, SVG).
- **En cas de détection :**
  - Le fichier n'est pas enregistré et est de nouveau retiré chez la personne qui l'a téléversé ; elle voit un message avec le
    nom de la détection.
  - L'événement figure dans le journal de sécurité.
- **Sans analyseur :**
  - Si aucun analyseur n'est configuré ou s'il est inaccessible, les téléversements sont refusés par défaut. Les deux
    se règlent dans l'administration sous « Sécurité ».
- **Journal :** Chaque résultat d'analyse figure dans le journal de l'application (`[uploads]`, avec résultat, type de
  fichier, taille, hash court, durée et ID utilisateur : jamais le contenu). Les détections, les types de fichier refusés
  et les fichiers acceptés sans analyse lors d'une panne de l'analyseur figurent en plus dans le journal de sécurité.
- **Dans l'administration :** L'état et la date des signatures figurent dans l'aperçu, avec les téléversements bloqués
  et ceux acceptés sans analyse des 30 derniers jours. Si les signatures ont plus de trois jours, un avertissement s'affiche.

## Versions et mises à jour

- **Numéros de version :** vibeboard suit le [versionnage sémantique](https://semver.org/lang/fr/). La version figure dans
  `package.json`, toutes les modifications dans le [CHANGELOG](CHANGELOG.md).
- **Mise à jour automatique au démarrage :** Lorsqu'une nouvelle version est démarrée, elle met elle-même la base de données à jour,
  même sur plusieurs versions :
  1. Un verrou de base de données empêche les mises à jour parallèles de plusieurs instances.
  2. Si des migrations sont en attente, une **sauvegarde** avec `pg_dump` est d'abord créée (Docker : volume `backups`,
     les 10 dernières sont conservées). Si elle échoue, la base de données reste inchangée et le démarrage est interrompu.
  3. Les migrations s'exécutent l'une après l'autre, chacune dans sa propre transaction ; une erreur est
     entièrement annulée.
  4. La version, la précédente et la sauvegarde sont consignées dans l'historique des versions (Administration → Aperçu).
- **Protection contre la rétrogradation :** Une version plus ancienne ne démarre pas sur une base de données déjà utilisée par une plus récente.
- **Les tableaux ouverts** reçoivent après une mise à jour l'avis « Recharger ».
- **Mise à jour dans la configuration Docker :** `git pull && docker compose up -d --build`.
- **Restaurer une sauvegarde :**
  `docker compose exec -T db pg_restore -U vibeboard -d vibeboard --clean < sicherung.dump`
  (auparavant `docker compose stop app`).

---

## Journalisation

- **Niveaux** selon le schéma habituel :

  | Niveau | Contenu |
  |---|---|
  | `fatal` | Erreurs qui mettent fin au fonctionnement (p. ex. échec du démarrage) |
  | `error` | Erreurs que quelqu'un devrait corriger (p. ex. envoi d'e-mails, enregistrement, erreurs serveur inattendues avec stacktrace) |
  | `warn` | Anomalies sans panne (p. ex. mise à jour sans sauvegarde, téléversements refusés, requêtes lentes de plus de 2 s) |
  | `info` | processus importants (démarrage, mises à jour, niveau de journalisation modifié) – **par défaut** |
  | `debug` | en plus chaque requête (méthode, chemin, statut, durée) et les requêtes refusées |
  | `trace` | tout |

- **Réglage :**
  - Via `LOG_LEVEL`, ou dans l'administration sous « Général → Journalisation ».
  - Le réglage dans l'administration s'applique immédiatement et est conservé après les redémarrages.
- **Format :**
  - `LOG_FORMAT=text` produit des lignes lisibles avec horodatage (UTC), niveau, composant et champs.
  - `LOG_FORMAT=json` écrit une ligne JSON par entrée, pour les systèmes de collecte de journaux.
  - Les erreurs et avertissements vont vers stderr, tout le reste vers stdout.
  - Consultation dans la configuration Docker : `docker compose logs -f app`.
- **ID de requête :**
  - Chaque requête reçoit un ID. Il figure dans l'en-tête `X-Request-Id` et dans toutes les entrées du journal de cette requête.
  - En cas d'erreurs serveur, le navigateur reçoit aussi l'ID, afin de pouvoir retrouver une erreur dans le journal.
  - Un proxy placé en amont peut fournir son propre ID.
- **Minimisation des données :**
  - Les mots de passe, jetons, cookies et clés sont masqués automatiquement.
  - Les adresses IP, adresses e-mail, paramètres de requête et contenus des tableaux ne sont pas journalisés.
  - Les événements importants pour la sécurité figurent séparément dans le journal de sécurité de l'administration.

## Sécurité

**Comptes**
- Mots de passe : scrypt avec N=2¹⁷, r=8, p=1 (recommandation OWASP) et sel ; comparaison en temps constant, y compris pour
  des noms d'utilisateur inconnus. Les anciens hashes sont renouvelés automatiquement à la connexion suivante.
- Au plus deux calculs de hash en même temps, afin que des tentatives de connexion massives ne surchargent pas le serveur.
- Limites de débit pour la connexion, l'inscription, les codes à deux facteurs, « Mot de passe oublié » et les e-mails de confirmation.
- Les codes TOTP ne peuvent pas être réutilisés ; les codes de récupération ne sont stockés que sous forme de hash.
- Protection contre l'espionnage des comptes :
  - « Mot de passe oublié » et « Renvoyer l'e-mail de confirmation » répondent toujours de la même façon.
  - Une inscription avec une adresse e-mail déjà utilisée ressemble, vue de l'extérieur, à une inscription normale.
    Le titulaire de l'adresse est informé par e-mail à la place.
- Les liens à usage unique (confirmation, réinitialisation, invitation) sont aléatoires (256 bits), limités dans le temps et utilisables une seule fois.
  Seul leur hash figure dans la base de données.

**Sessions**
- Le cookie de session est `HttpOnly`, `SameSite=Lax` et, sous HTTPS, `Secure` avec le préfixe `__Host-`. Seul un hash
  SHA-256 du jeton figure dans la base de données.
- Les sessions expirent après 30 jours ou après 14 jours sans activité.
- Le changement de mot de passe, la désactivation et la déconnexion terminent aussi les connexions en direct ouvertes.

**Web**
- Content-Security-Policy stricte : uniquement des scripts propres, pas de scripts en ligne, pas de sources externes, pas
  d'intégration dans des cadres.
- Autres en-têtes : HSTS (sous HTTPS), `X-Frame-Options: DENY`, `X-Content-Type-Options`,
  `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Referrer-Policy`, `Permissions-Policy`
  (microphone uniquement pour le site lui-même, pour les visites guidées avec le son ; pas de caméra, pas de localisation).
- Protection CSRF : Les appels d'API modifiants nécessitent l'en-tête `X-Vibeboard: 1`.
- Les droits sont vérifiés sur le serveur, pour l'API REST et le canal en temps réel, y compris les droits de
  commentaire, d'animation et d'équipe. Les accès invités sont refusés par toute interface qui ne les autorise pas expressément.
- Les éléments des tableaux sont vérifiés sur le serveur et lors de l'affichage (liste blanche de couleurs, nombres imposés,
  images uniquement intégrées). Aucun balisage ni script ne peut ainsi être injecté.
- Les liens dans les e-mails ne sont construits qu'à partir de l'adresse publique configurée ou d'adresses de cette machine. Un
  en-tête `Host` falsifié ne peut pas les rediriger.
- Délais d'expiration contre les connexions lentes (Slowloris), limites de taille pour les requêtes.

**Exploitation**
- Le conteneur Docker de l'application s'exécute en tant qu'utilisateur normal avec un système de fichiers en lecture seule, sans
  capacités Linux et avec `no-new-privileges`.
- Sans mot de passe de base de données défini, docker-compose ne démarre pas.
- Pour une exploitation sur internet, un reverse proxy avec HTTPS doit être placé en amont (p. ex. Caddy, nginx, Traefik). Définissez alors
  `TRUST_PROXY=1` et `PUBLIC_URL`.

### Adresses IP réelles dans le journal

Si le journal indique pour tous les accès la même adresse privée, comme `172.20.0.1`, vibeboard ne voit pas l'adresse
des utilisateurs, mais celle du réseau Docker (passerelle). Cela se produit lorsque

- un **reverse proxy sur l'hôte** (nginx, Caddy, Apache) redirige vers `localhost:3000` : Docker transmet alors la
  connexion via son processus auxiliaire `docker-proxy`, ou
- des utilisateurs accèdent en **IPv6** ou depuis le serveur lui-même : cela passe aussi par `docker-proxy`.

Solution :

1. **Avec reverse proxy (recommandé) :** Le proxy doit définir l'en-tête `X-Forwarded-For` (Caddy et Traefik le font
   d'eux-mêmes ; avec nginx, `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` et
   `proxy_set_header X-Forwarded-Proto $scheme;`). Dans le `.env`, définir ensuite `TRUST_PROXY=1`.
   Important : Le port de l'application ne doit alors être accessible **que pour le proxy**, sinon des appelants pourraient définir
   eux-mêmes l'en-tête et simuler une fausse adresse. Pour cela, définissez dans le `.env` `PORT=127.0.0.1:3000` :
   docker-compose ne publie alors le port que sur l'hôte lui-même.
2. **Sans reverse proxy :** Pour les accès IPv4 depuis l'extérieur, vibeboard voit l'adresse réelle si Docker n'utilise pas
   le `docker-proxy` : saisissez `{ "userland-proxy": false }` dans `/etc/docker/daemon.json` et redémarrez Docker.
   Pour IPv6, le réseau Docker doit prendre en charge IPv6, sinon il ne reste que le reverse proxy.

L'administration (aperçu) affiche un avis si votre propre requête arrive avec une adresse de passerelle Docker ou avec
`X-Forwarded-For` mais sans `TRUST_PROXY`.

## Stockage des données et confidentialité

Toutes les données se trouvent dans votre propre base de données PostgreSQL :

| Table | Contenu |
|---------|--------|
| `users` | Comptes avec rôle, statut, moment de confirmation, hash du mot de passe, clé à deux facteurs, codes de récupération hachés |
| `sessions` | Sessions de connexion (hash du jeton, appareil, adresse IP, dernière activité) |
| `tokens` | Liens à usage unique pour la confirmation, l'invitation et la réinitialisation du mot de passe (uniquement sous forme de hash) |
| `audit_log` | Journal de sécurité, conservé 12 mois |
| `settings` | Paramètres de l'instance, y compris l'accès SMTP |
| `boards`, `board_members`, `board_visits` | Tableaux, partages, tableaux ouverts récemment (pour « depuis votre dernière visite ») |
| `elements` | Un enregistrement par élément de tableau ; les images sont intégrées en taille réduite |
| `board_versions` | États enregistrés des tableaux |
| `notifications` | Notifications (mention, réponse, attribution), conservées 90 jours |
| `board_activity` | Historique d'activité, résumé, 90 jours ou au plus 2000 entrées par tableau |
| `guest_links` | Liens invités (uniquement sous forme de hash) avec rôle et expiration ; les accès invités sont des comptes avec le rôle `guest` |
| `teams`, `team_members`, `folders`, `folder_boards` | Équipes, adhésions, dossiers |
| `board_recordings` | Visites guidées enregistrées avec piste temporelle et piste audio facultative |
| `team_invitations`, `pending_invites` | Invitations en attente dans des équipes ou à des adresses sans compte (adresse, rôle, personne qui invite ; 30 jours au maximum) |
| `board_files` | Pièces jointes (contenu, nom, type, taille, aperçu PDF) ; supprimées après 7 jours sans référence |
| `board_polls` | Résultats des sondages rapides (uniquement le nombre par réponse, pas de voix individuelles) |
| `user_templates` | Modèles personnels et d'équipe |
| `webhooks` | Connexions aux messageries (adresse, format, événements, dernier statut) |

- Il n'y a de connexions sortantes que vers le serveur de messagerie configuré et, si elle est activée, vers l'API Pwned Passwords et
  vers les webhooks configurés par les utilisateurs.
- Dans le navigateur, vibeboard ne stocke que des paramètres d'affichage (zoom, thème sombre, options d'outils) dans le `localStorage` ;
  le service worker de l'application installable conserve l'interface et les scripts pour le mode hors ligne (pas de données de tableaux).
- Le dépôt ne contient aucune donnée d'utilisateurs : `data/`, `.env` et les fichiers de base de données sont exclus dans `.gitignore`.

---

## Mise à jour des dépendances

Dependabot surveille les paquets npm, GitHub Actions et l'image de base Docker. Les mises à jour de sécurité arrivent immédiatement ; les autres attendent sept jours, afin qu'une version compromise puisse être découverte avant. Les mises à jour patch et minor sont intégrées automatiquement si tous les contrôles réussissent ; les majeures nécessitent une relecture. Elles n'atteignent votre serveur qu'au prochain `git pull` suivi d'une reconstruction. Les autres images s'obtiennent avec `docker compose pull`.

## Exigences et contribution

- [docs/anforderungen](docs/anforderungen/README.md) décrit toutes les fonctionnalités sous forme d'exigences avec des ID permanents
  et des critères d'acceptation (les documents d'exigences sont en allemand).
- [CONTRIBUTING.md](CONTRIBUTING.md) définit ce qui accompagne chaque nouvelle fonctionnalité :
  - Compléter l'exigence
  - Augmenter la version
  - Compléter le CHANGELOG
  - Migration plus test de mise à jour

---

## Architecture

```
server.js              HTTP-Server, Seiten-Routing, Sicherheits-Header, CSRF-Schutz, Timeouts
lib/
  db.js                PostgreSQL-Pool, Schema-Migrationen
  auth.js              Kennwort-Hashes, Sessions, Einmal-Tokens, Zwei-Faktor-Tickets, Rate-Limits
  password.js          Kennwortrichtlinie (Länge, Listen, Muster, optional HIBP)
  email.js             E-Mail-Prüfung, Wegwerf-Domains, Sperr-/Erlaubnislisten
  totp.js              Zeitbasierte Einmalcodes (RFC 6238), Wiederherstellungscodes
  audit.js             Sicherheitsprotokoll
  version.js           Versionsverwaltung, automatisches Upgrade, Sicherung, Downgrade-Schutz
  virusscan.js         ClamAV-Anbindung (clamd), Dateityp-Prüfung
  uploads.js           Prüfrichtlinie für hochgeladene Dateien
  boards.js            Zugriffsrechte, Board-Cache, verzögertes Speichern, Echtzeit-Räume, Long-Polling,
                       privater Modus, Schätzrunden, Versionen, Moderation
  comments.js          Kommentar-Operationen (Autorschaft, Erwähnungen, Zuweisung)
  notify.js            Benachrichtigungen (Glocke, live, E-Mail)
  activity.js          Aktivitätsverlauf (zusammengefasst)
  guests.js            Gastlinks und Gastzugänge
  teams.js             Teams und Ordner
  recordings.js        Aufgezeichnete Rundgänge
  sanitize.js          Prüfung von Board-Elementen
  settings.js          Einstellungen der Instanz
  mail.js              E-Mail-Versand
  setup.js             Admin aus Umgebungsvariablen, Import alter Boards, Aufräumen
  routes/              REST-API: auth.js, boards.js, collab.js, admin.js, legal.js
  data/                Liste der Wegwerf-Domains und häufigen Kennwörter
scripts/test-upgrade.js  Upgrade-Test für Datenbank-Migrationen (npm run test:upgrade)
docs/anforderungen/      Anforderungsdokumente
public/
  auth.html            Anmelden, Registrieren, Bestätigen, Kennwort  → js/auth.js
  legal.html           Impressum, Datenschutzerklärung (öffentlich)  → js/legal.js, js/markdown.js
  index.html           Board-Übersicht                               → js/dashboard.js, js/notifications.js
  guest.html           Beitritt per Gastlink                         → js/guest.js
  board.html           Board-Editor                                  → js/main.js (core, ui, collab, render, sync, …)
                       teamwork.js (privater Modus, Schätzrunde), planning.js (Aufgaben, Versionen, CSV-Import),
                       moderation.js, activity.js, recording.js, notifications.js (Arbeiten im Team),
                       diagram-parse.js / diagram-text.js (Diagramm aus Text), highlight.js (Code-Blöcke),
                       templates.js / templates-tech.js / templates-diagrams.js / template-kit.js (Vorlagen)
  admin.html           Administration                                → js/admin.js
```

**Temps réel :**
- Chaque client reçoit les modifications via Server-Sent Events (`/api/boards/:id/events`) et envoie les siennes
  regroupées par POST.
- Si aucun message d'accueil n'arrive via le flux en 8 secondes, le client utilise le long polling
  (`/api/boards/:id/poll`). Pour les tests, cela peut être imposé avec `?transport=poll`.
- Le serveur garde les tableaux actifs en mémoire, distribue immédiatement les modifications et les écrit de façon groupée dans la
  base de données.
- Si deux personnes modifient le même élément en même temps, la dernière modification l'emporte. Les tableaux sont
  rapprochés cellule par cellule, les commentaires via des opérations propres (le serveur ajoute l'auteur et l'heure).

---

## Licence

vibeboard est placé sous la [licence MIT](LICENSE).

Exceptions et contenus de tiers, détails dans [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) :

- **Business Model Canvas** : adaptation du « Business Model Canvas » de Strategyzer AG (strategyzer.com), sous licence
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- **Lean Canvas** : adaptation du « Lean Canvas » d'Ash Maurya (leanstack.com), fondé sur le Business Model Canvas,
  sous licence [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- **Icônes** : en partie issues de ou d'après [Lucide](https://lucide.dev) (ISC) et [Feather](https://feathericons.com) (MIT).
- **Domaines jetables** : [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) (CC0).
- **Mots de passe courants** : [SecLists](https://github.com/danielmiessler/SecLists) (MIT).

Les noms de produits et de méthodes mentionnés (p. ex. Jira, Azure DevOps, Excel, Microsoft Teams, Slack, Mattermost, Rocket.Chat,
Matrix, Kubernetes, Mermaid, UML, BPMN) appartiennent à leurs titulaires respectifs et ne servent qu'à la description ; cela n'implique
aucun lien ni aucune approbation. vibeboard est un projet open source indépendant, sans lien avec Vibe, Inc. ni avec
ses produits. Il n'y a aucune garantie ; voir [LICENSE](LICENSE).
