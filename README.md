# 🎾 Fun'is — La saison de tennis des légendes

Fun'is est un jeu de simulation de saison de tennis : la saison ATP 2026 complète (4 Grands Chelems, 9 Masters 1000 et le Masters final de Turin), disputée par **128 personnalités légendaires** — rois et reines, dieux, politiques, artistes, aventuriers, sportifs et héros de fiction, dont 30 % de Français.

## ✨ Fonctionnalités

- **Calendrier ATP 2026 réel** : de l'Open d'Australie (janvier) au Masters de Turin (novembre).
- **Points et prize money officiels du circuit ATP** (montants convertis en €).
- **Grands Chelems** : 128 joueurs, matchs en 3 sets gagnants, super tie-break à 10 points au 5e set.
- **Masters 1000** : les 64 premiers de la race (tirage au sort entre ex aequo), 2 sets gagnants.
- **Masters final** : les 8 meilleurs, 2 groupes (Borg / Connors), round robin puis demi-finales et finale.
- **Tirages réalistes** : positions tirées au sort à l'Open d'Australie, puis têtes de série placées selon le schéma officiel ATP en fonction du classement de la race.
- **Simulation jeu par jeu** : chaque match se suit en direct dans une fenêtre dédiée (breaks, tie-breaks, sets), avec 4 vitesses (x1, x2, Turbo, Instantané).
- **Système de compétences** : chaque joueur possède 10 compétences notées de 1 à 10 (total 70 points pour tous) — Terre battue, Gazon, Dur, Indoor, Force, Endurance, Adresse, Tactique, Service et Mental. L'algorithme de résolution en tient compte selon le contexte : la surface du tournoi pèse lourd, le Service aide à tenir ses jeux, l'Endurance fait la différence quand le match s'éternise (4e-5e sets), et le Mental s'exprime dans les tie-breaks et les sets décisifs.
- **Cartes joueur (style EA)** : classement race et prize money, palmarès, bilan victoires-défaites, les 10 compétences en barres et les **statistiques détaillées de la saison** (sets et jeux gagnés-perdus, balles de break réussies et défendues, tie-breaks). Accessibles depuis l'onglet Joueurs (avec recherche) ou d'un clic sur n'importe quel joueur dans les classements, récaps et matchs terminés.
- **Tableaux super graphiques** : vue d'ensemble par sections, zoom sur chaque partie du tableau, phase finale dédiée.
- **Récap de tournoi** : podium, points ATP et prize money attribués.
- **Classements** points et prize money avec l'évolution de chaque joueur par rapport à la semaine précédente, lignes de qualification (top 64 / top 8) et titres remportés.
- **Historique** : tous les tournois terminés restent consultables (tableau complet + récap).
- **3 plateaux au choix (127 joueurs)** : le plateau Fun'is officiel (127 légendes, compétences retirées au sort à chaque saison), le **Top 127 du vrai classement ATP** (compétences entières et fixes d'une saison à l'autre, total de 99 points pour le n°1 à 75 pour le n°127, avec les spécialités de chaque nation — Argentins sur terre battue, Britanniques sur gazon, Français en indoor… — le tout intégré dans les cotes), ou un plateau personnalisé importé en CSV.
- **Ton champion, le 128ᵉ joueur** 🎾 : en début de saison tu crées ton propre joueur — prénom, nom, club, nationalité, classement (de 40 à -15) — et tu répartis toi-même ses 70 points entre les 10 compétences. Un pari de 2 000 € est automatiquement placé sur lui (il reste 8 000 € pour 4 autres joueurs), et le bookmaker calcule sa cote avec les compétences que tu lui as données.
- **Le pari de la saison** 💶 : au départ, 10 000 € à répartir librement sur 5 joueurs. Gain d'un pari = mise × prize money réel / prize money attendu du joueur. Les « prize money attendus » (les cotes) sont calibrés par le bookmaker en simulant 120 saisons complètes en arrière-plan : l'espérance de gain est de 10 000 € quelle que soit la répartition — parier un cador rapporte peu par euro, un outsider peut tout multiplier. L'onglet **Mes paris** suit l'évolution du solde (courbe tournoi par tournoi face au rythme attendu) avec le détail de chaque pari, et le solde est affiché en permanence dans la barre.
- **Immersion sur ses paris** : le bouton unique « Simuler le tournoi » fait avancer le tournoi en s'arrêtant sur **chaque match de tes 5 joueurs**, joué à la main dans la fenêtre de match ; en fin de match, un bouton enchaîne sur le match suivant de tes paris (ou le tour suivant, ou le récap). L'écran de match affiche le classement à la race des deux joueurs, leurs fiches sont consultables d'un clic sur leur nom — y compris depuis l'écran de paris en début de saison (icône 🪪) — et la vitesse choisie (x1, x2, Turbo, Instantané) est mémorisée d'un match à l'autre. Les drapeaux sont affichés en vraies images (via flagcdn.com, avec repli emoji hors ligne).
- **Import CSV** : jouez avec votre propre plateau de 127 joueurs (+ votre champion).
- **Sauvegarde automatique** dans le navigateur (localStorage) : fermez l'onglet, la saison vous attend.

## 🚀 Jouer

Le jeu est un site 100 % statique : aucun serveur, aucune dépendance.

### En local
Ouvrez simplement `index.html` dans un navigateur.

### Sur GitHub Pages
1. Poussez le contenu du dossier dans un dépôt GitHub (par ex. `Maresthil/funis`) :
   ```bash
   git init
   git add index.html css js README.md
   git commit -m "Fun'is — saison de tennis des légendes"
   git branch -M main
   git remote add origin https://github.com/Maresthil/funis.git
   git push -u origin main
   ```
2. Dans le dépôt : **Settings → Pages → Source : Deploy from a branch → main / (root)**.
3. Le jeu est en ligne sur `https://maresthil.github.io/funis/`.

## 📄 Format du fichier CSV (plateau personnalisé)

127 lignes de données (le 128ᵉ joueur, c'est ton champion), entête facultative, séparateur `;` ou `,` :

```csv
Nom;Drapeau;Categorie;FR;Terre;Gazon;Dur;Indoor;Force;Endurance;Adresse;Tactique;Service;Mental
Napoléon Bonaparte;🇫🇷;Empereurs & Rois;oui;5;8;7;6;5;7;7;9;6;10
Zeus;⚡;Dieux & Mythes;non
...
```

Seul le **nom** est obligatoire. Les 10 colonnes de compétences (notes de 1 à 10) sont
optionnelles : si elles sont remplies, elles sont utilisées telles quelles (bornées 1-10) ;
sinon, elles sont tirées aléatoirement pour un total de 70 points (avec une touche
thématique selon la catégorie). Un modèle complet est téléchargeable depuis l'écran
d'accueil du jeu.

## 🗂 Structure

```
index.html      — page unique de l'application
css/style.css   — charte graphique (codes couleurs inspirés de l'ATP Tour)
js/data.js      — calendrier 2026, barèmes de points, prize money, 128 joueurs
js/engine.js    — moteur : tirages, têtes de série, simulation jeu par jeu, classements
js/ui.js        — interface : tableaux, match en direct, récaps, historique, favoris
test/           — tests automatiques (Node + Playwright), non nécessaires au jeu
```

Pour recommencer une saison : bouton « Nouvelle saison » en bas de page.

Bon match ! 🏆
