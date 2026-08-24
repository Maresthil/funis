# 🎾 Fun'is — La saison de tennis des légendes

Fun'is est un jeu de simulation de saison de tennis : la saison ATP 2026 complète (4 Grands Chelems, 9 Masters 1000 et le Masters final de Turin), disputée par **128 personnalités légendaires** — rois et reines, dieux, politiques, artistes, aventuriers, sportifs et héros de fiction, dont 30 % de Français.

## ✨ Fonctionnalités

- **Calendrier ATP 2026 réel** : de l'Open d'Australie (janvier) au Masters de Turin (novembre).
- **Mode carrière multisaison** 📅 : enchaîne jusqu'à **5 saisons (2026 → 2030)**. Entre deux saisons, ton champion gagne **3 points de compétence** à répartir (plafond 10 par compétence), le plateau retire de nouvelles compétences (les niveaux ATP et les compétences CSV fixes ne bougent pas), et les tournois restent sur les **mêmes semaines qu'en 2026** (dates décalées selon le calendrier, jour de la semaine conservé). Les **statistiques, titres et records sont cumulés sur toute la carrière** (cartes joueur + page Stats), un panneau « Palmarès de ta carrière » résume chaque saison (n°1, champion du Masters, prize money net, bilan des paris, solde bancaire), et une suspension pour dopage en fin de saison se purge sur la suivante. Chaque saison tu repars avec **ton solde bancaire final** — dette comprise ! — et 3 doses de dopage. Ton **expérience et ton classement français** (🎖) traversent aussi les saisons — l'ascension 40 → −15 se joue sur toute la carrière. Et à chaque intersaison, place au **mercato** 🔁 : ton club **conserve 3 joueurs** de la saison passée et **signe 1 transfert** parmi les autres légendes.
- **Classement ATP glissant sur 12 mois** 🌍 : en carrière, chaque joueur **défend les points** gagnés un an plus tôt, tournoi par tournoi — le champion de Melbourne remet ses 2 000 points en jeu à l'Open d'Australie suivant. C'est ce classement glissant qui décide des **entrées en tournoi** (qualifications Masters 1000) et des **têtes de série** ; la **race de l'année** garde la qualification au Masters de Turin, comme sur le vrai circuit. Trois onglets de classements (Classement ATP, Race, Prize money), chaque carte de tournoi affiche le **tenant du titre et les points qu'il défend** (🛡), et le **prize money est cumulé depuis le début de la carrière**. La page Stats ajoute les **records de carrière** : passages en tête du classement, titres en Grand Chelem, gains de carrière.
- **Points et prize money officiels du circuit ATP** (montants convertis en €).
- **Grands Chelems** : 128 joueurs, matchs en 3 sets gagnants, super tie-break à 10 points au 5e set.
- **Masters 1000** : les **56 premiers de la race** qualifiés d'office + **8 repêchés** tirés au sort parmi les suivants, avec une pondération par le classement (le 60ᵉ a plus de chances que le 100ᵉ) — les repêchés portent un badge **Q** dans le tableau. Matchs en 2 sets gagnants.
- **Masters final** : les 8 meilleurs, 2 groupes (Borg / Connors), round robin présenté par journées (J1, J2, J3) puis demi-finales et finale — au Masters, **tous** les matchs se jouent à la main.
- **Tirages réalistes** : positions tirées au sort à l'Open d'Australie, puis têtes de série placées selon le schéma officiel ATP en fonction du classement de la race.
- **Simulation point par point** : chaque match réel est simulé point par point (1res et 2es balles, aces, doubles fautes, points gagnants, fautes directes) et se suit en direct dans une fenêtre dédiée (breaks, tie-breaks, sets), avec 4 vitesses (x1, x2, Turbo, Instantané).
- **Récap statistique de fin de match** 📊 : à la fin de chaque match, un tableau comparatif complet — points gagnés, % de 1res balles, aces, doubles fautes, points gagnants, fautes directes, balles de break converties et sauvées (réelles), séries max de points et de jeux consécutifs, balles de set et de match sauvées — avec la **durée du match**. Ces données alimentent les cartes joueur (rangée « Au microscope » : aces, 1res balles, gagnants/fautes, séries, balles sauvées, temps de jeu) — la carte affiche aussi, sous le palmarès, la **forme du moment** : les 10 derniers matchs en V/D avec la date et l'heure de chaque rencontre, chacun cliquable vers sa fiche complète (qui s'ouvre par-dessus la carte), la page Stats (leaders en % de 1res balles, canonniers, frappeurs) et les cumuls de carrière.
- **Programmation réaliste** 📅 : chaque match a un **jour et une heure de début** cohérents avec le déroulé du tournoi (les tours répartis sur les dates réelles, sessions de 11h à 20h30, demi-finales à 14h et 18h, finale le dernier jour à 15h) — affichés dans la fenêtre de match et au survol des tableaux.
- **Système de compétences** : chaque joueur possède 10 compétences notées de 1 à 10 (total 70 points pour tous) — Terre battue, Gazon, Dur, Indoor, Force, Endurance, Adresse, Tactique, Service et Mental. L'algorithme de résolution en tient compte selon le contexte : la surface du tournoi pèse lourd, le Service aide à tenir ses jeux, l'Endurance fait la différence quand le match s'éternise (4e-5e sets), et le Mental s'exprime dans les tie-breaks et les sets décisifs.
- **Cartes joueur (style EA)** : classement race et prize money, palmarès, bilan victoires-défaites, les 10 compétences en barres et les **statistiques détaillées de la saison** (sets et jeux gagnés-perdus, balles de break réussies et défendues, tie-breaks). Accessibles depuis l'onglet Joueurs (avec recherche) ou d'un clic sur n'importe quel joueur dans les classements, récaps et matchs terminés.
- **Tableaux super graphiques** : vue d'ensemble par sections, zoom sur chaque partie du tableau, phase finale dédiée.
- **Récap de tournoi** : podium, points ATP et prize money attribués.
- **Classements** points et prize money avec l'évolution de chaque joueur par rapport à la semaine précédente, lignes de qualification (top 64 / top 8) et titres remportés.
- **Historique** : tous les tournois terminés restent consultables (tableau complet + récap).
- **Page Stats** : les leaders du circuit en % de victoires, de sets, de jeux, de balles de break converties et sauvées, de tie-breaks ; les rois de chaque surface ; l'anatomie des matchs (2/3 sets en Masters 1000, 3/4/5 sets en Grand Chelem, décompte des scores de sets 6-0 → 7-6) ; les **matchs les plus longs et les plus courts classés par jeux ET par durée** (un clic sur un record ouvre la fiche complète du match) ; les **canonniers** (aces), **frappeurs** (points gagnants) et **bâcheurs** (fautes directes) avec leur **moyenne par match joué** ; et les as du clutch : **matchs gagnés après une balle de match sauvée** 🧯 et **sets gagnés après une balle de set sauvée** 🛟.
- **3 plateaux au choix (127 joueurs)** : le plateau Fun'is officiel (127 légendes, compétences retirées au sort à chaque saison), le **Top 127 du vrai classement ATP** (compétences entières et fixes d'une saison à l'autre, total de 99 points pour le n°1 à 75 pour le n°127, avec les spécialités de chaque nation — Argentins sur terre battue, Britanniques sur gazon, Français en indoor… — le tout intégré dans les cotes), ou un plateau personnalisé importé en CSV.
- **Ton champion, le 128ᵉ joueur** 🎾 : en début de saison tu crées ton propre joueur — prénom, nom, club, nationalité, classement (de 40 à -15) — et tu répartis toi-même ses points entre les 10 compétences. Son total est **la moyenne du plateau** — 70 points en mode légendes, ~87 en mode ATP, la moyenne réelle en CSV — ni plus ni moins : ton avantage, c'est le **profil sur mesure** (et les +3 points par saison en mode carrière). Il est automatiquement le **capitaine de ton club** — et comme c'est TOI qui paries, **impossible de miser sur tes propres matchs**.
- **L'écran de début de tournoi, façon site de paris pro** 🎰 : d'abord la **présentation** — ville, dates, dotation, vainqueur de l'an dernier (et les points qu'il remet en jeu), les **8 repêchés des qualifications** (ou les 8 qualifiés du Masters) ; puis la **💉 préparation spéciale** ; enfin le guichet **FUN'BET** : **TOUS les joueurs cotés vainqueur du tournoi** (sauf toi), triés par cote avec recherche, et les **totaux plus/moins** du tournoi — nombre d'aces, nombre de doubles fautes, % de jeux de service gagnés. Marché fermé au premier match, cotes simulées point par point sur le tableau réellement tiré.
- **Paris en continu — avant chaque tour et chaque match** 🚀 : **avant chaque tour**, le panneau « 🎰 Parier sur le tour » cote le **vainqueur de tous les matchs** (sauf les tiens 🚫) — coche tes vainqueurs et valide en **paris simples** ou en **COMBINÉ** aux cotes multipliées. **Avant chaque match**, la fenêtre de match propose **8 marchés classiques** : 1/2 vainqueur, **vainqueur du 1er set**, score exact en sets, plus/moins de jeux, handicap de jeux, tie-break oui/non, et **plus/moins d'aces et de doubles fautes PAR JOUEUR**. Les cotes sont simulées sur la forme réelle des joueurs (mais le bookmaker ignore le dopage 💉), et chaque pari réglé affiche **le fait réel qui justifie le paiement ou non**.
- **Solde bancaire en direct** 💶 : le bouton en haut à droite affiche ton **solde en temps réel** — chaque mise sort immédiatement, chaque gain rentre **dès la fin du match** (un combiné est perdu dès qu'une sélection tombe, payé dès que la dernière passe). Le verdict de tes paris s'affiche directement dans la fenêtre de match, et l'écran de transition entre deux tours t'invite à parier sur le tour suivant.
- **Ton club** 🎾 : ton champion est le **capitaine du club** que tu as nommé à sa création, et tu **recrutes 4 joueurs** parmi les légendes pour compléter l'équipe. Tu suis les joueurs du club toute la saison : leurs matchs se jouent à la main — « 🎾 Jouer mon club » s'arrête sur chacun — et eux seuls peuvent être dopés. Recruter son club **lance la saison** — les paris, eux, se placent ensuite en continu.
- **La banque, dynamique toute l'année** 🏦 (💶 dans la barre) : tu démarres la carrière avec **50 000 €**, et ta banque bouge à **chaque fin de tournoi** — le **prize money de ton champion** est crédité **net** (−40 % de taxes puis −20 % du restant pour le staff) pendant que ta part des **500 000 € de frais de saison** (répartis équitablement sur les 14 tournois) est débitée — **rien n'est débité si ton champion n'est pas engagé** (non qualifié en Masters 1000, suspendu…). Le récap de chaque tournoi affiche **ton relevé** (brut → net → frais → mouvement). L'écran banque garde ses **trois sections** — 💼 **La carrière** (solde live, le point après N tournois et le **relevé tournoi par tournoi**), 🎰 **Les paris** (misé, encaissé, bilan, taux de réussite, historique) et 💉 **Le dopage** (doses à **40 000 €**, injections, contrôles, suspensions).
- **Fin de saison** 🧾 : tout étant déjà réglé au fil de l'eau, il ne reste que l'**impôt de 30 %** si ton bilan de paris est positif (une perte n'est pas taxée). Le solde final — **négatif compris, la dette te suit !** — est reporté sur la saison suivante. Flamber ou capitaliser, c'est toute ta carrière qui se joue.
- **Forme des joueurs** 🏋️ : chaque joueur est **entraîné** (🏋️, il n'a pas disputé le tournoi précédent), **frais** (🟢), **fatigué** (😓) ou **cramé** (🥵) selon les matchs accumulés — la fatigue monte avec les jeux disputés (les gros moteurs d'Endurance encaissent mieux) et redescend entre les tournois. La forme évolue **pendant** le tournoi, pèse réellement sur les matchs, est intégrée dans les cotes du bookmaker, et s'affiche sur chaque match du tableau et dans la fenêtre de match.
- **Dopage** 💉 : avant chaque tournoi, tu peux booster **ton champion — et lui seul** (3 doses par saison, **40 000 € la dose, débitée en direct** — pas de solde, pas de dopage). Le joueur dopé reçoit un vrai coup de pouce — avantageux mais pas décisif — et ne ressent aucune fatigue… mais il a **5 % de risque d'être contrôlé positif** à l'issue du tournoi : 3 mois de suspension (il manque les tournois suivants, remplacé par des exemptions dans les tableaux). Le bookmaker, lui, n'en sait rien — c'est ton avantage.
- **Classement français & expérience** 🎖 : ton champion démarre sa carrière **classé 40** et grimpe l'échelle des 22 classements français (40 → 30/5 → … → 15 → … → 0 → −2/6 → −4/6 → **−15**) grâce aux **points d'expérience**. Chaque victoire rapporte de l'XP, tes titres et podiums aussi (un Grand Chelem vaut plus qu'un Masters 1000), une **PERF** 🔥 (battre un mieux classé) rapporte **proportionnellement à l'écart de classement** — tomber le n°3 quand tu es n°90 vaut bien plus que battre le n°30 — et un **CONTRE** ❄️ (perdre contre un moins bien classé) coûte de la même façon selon l'écart. Les résultats de tes **partenaires de club** à l'entraînement comptent aussi (leurs titres te tirent vers le haut, leurs sorties d'entrée te plombent), et **49 goals de carrière** jalonnent la route : première victoire, 10/50/100/200 victoires, séries de 10 et 20, 5/10/20 victoires par surface, gagner après une balle de match sauvée, renverser 2 sets de retard, marathon de plus de 5 h, 25 aces dans un match, 100 aces sur un tournoi, plus de 90 % de premières balles, battre le n°1 mondial, 6-0 6-0, premier titre, 5 titres dans la saison, Grand Chelem, les 4 Grands Chelems, Masters, top 10, n°1 mondial, un joueur de ton club qui gagne un tournoi / un Grand Chelem / le Masters, 1/5/20 millions d'euros de gains en carrière, un pari gagné à cote 10, un combiné à cote 5, 100 000 € de paris encaissés sur une saison… Le barème est calibré pour qu'une **belle carrière atteigne le mythique −15 au bout des 5 saisons**. La **pastille 🎖 à droite de la banque** affiche ton classement en direct et ouvre la page **Ma carrière** : classement en majesté, barre de progression vers le palier suivant, échelle complète, sources d'XP, grille des goals et **journal détaillé** de tous tes exploits — le rendez-vous après chaque tournoi. À droite du bandeau, ta **carte façon EA Sports FC** 🃏 (note, drapeau, classement, club, titres et les 6 attributs de jeu) évolue du bronze à l'« icône » au fil de ta progression — un clic ouvre ta fiche complète.
- **Immersion dans le tournoi** : deux façons de jouer — « **🎾 Jouer mon club** » fait avancer le tournoi en s'arrêtant sur **chaque match des joueurs de ton club**, joué à la main ; « **🎾 Jouer le tournoi** » enchaîne **tous les matchs**, un par un. Ton joueur est toujours affiché **en haut** du tableau de score (sauf duel entre joueurs du club), le score final s'affiche sur un bandeau **vert (victoire) ou rouge (défaite)**, et un **écran de transition** ponctue chaque fin de tour (joueurs du club encore en lice, qualifiés, choix du mode pour la suite). L'écran de match affiche le classement à la race des deux joueurs, leurs fiches sont consultables d'un clic sur leur nom — y compris depuis l'écran de paris en début de saison (icône 🪪) — et la vitesse choisie (x1, x2, Turbo, Instantané) est mémorisée d'un match à l'autre. Les drapeaux sont affichés en vraies images (via flagcdn.com, avec repli emoji hors ligne).
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
js/ui.js        — interface : tableaux, match en direct, récaps, historique, banque, club
test/           — tests automatiques (Node + Playwright), non nécessaires au jeu
```

En fin de saison : bouton doré « ▶ Saison suivante » (jusqu'à 5 saisons). Pour tout recommencer : « 🔄 Nouvelle carrière » en haut du calendrier.

Bon match ! 🏆
