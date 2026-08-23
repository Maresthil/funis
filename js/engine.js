/* ============================================================
   Fun'is — Moteur de simulation
   Talents cachés + forme du tournoi + affinités de surface,
   simulation jeu par jeu, tirages, têtes de série, classements.
   ============================================================ */

"use strict";

const STORAGE_KEY = "funis_save_v18";
const TBET_SIMS = 100;      // simulations du tableau réel (point par point) pour coter les paris de tournoi
const TBET_MIN = 100;       // mise minimale d'un pari de tournoi

/* ---------- Qualifications Masters 1000 ---------- */
const M1000_DIRECT = 56;    // qualifiés d'office à la race ; 8 places tirées au sort pondéré

/* ---------- Forme & dopage ---------- */
const FATIGUE_TIRED = 7;    // seuil « fatigué »
const FATIGUE_BURNT = 14;   // seuil « cramé » (il faut vraiment enchaîner pour cramer)
const FATIGUE_RECOVERY = 8; // récupération entre deux tournois joués
const MOD_TRAINED = 2;      // bonus « entraîné » (n'a pas joué le tournoi précédent)
const MOD_TIRED = -3;       // malus « fatigué »
const MOD_BURNT = -7;       // malus « cramé »
const DOPE_BONUS = 3;       // bonus « dopé » (et insensible à la fatigue)
const SEASON_SYRINGES = 3;  // seringues disponibles sur la saison
const DOPING_CONTROL_P = 0.05; // probabilité de contrôle positif à l'issue du tournoi
const SUSPENSION_MONTHS = 3;

const FORM_META = {
  dope:     { icon: "💉", label: "Dopé" },
  entraine: { icon: "🏋️", label: "Entraîné" },
  frais:    { icon: "🟢", label: "Frais" },
  fatigue:  { icon: "😓", label: "Fatigué" },
  crame:    { icon: "🥵", label: "Cramé" },
};
const START_BANKROLL = 50000; // capital de départ de la CARRIÈRE (saison 1 uniquement)
const TAX_RATE = 0.30;      // impôt sur le solde POSITIF des paris de la saison (différé)
const PRIZE_TAX_RATE = 0.40;// taxes sur le prize money du champion (prélevées à chaque tournoi)
const STAFF_RATE = 0.20;    // part du staff sur le prize money net de taxes
const TRAVEL_COST = 500000; // frais de saison (déplacements & hébergement), répartis par tournoi — débités SEULEMENT si ton champion joue
const MATCH_MK_SIMS = 200;  // simulations (point par point) pour coter les marchés d'un match
const DOPE_COST = 40000;    // prix d'une dose de dopage (débitée en direct)
const BET_PLAYERS = 5;      // ton champion + les 4 joueurs de TON CLUB (suivis toute la saison)
const ROSTER_SIZE = 127;    // 127 joueurs de plateau + ton champion = 128
/* Total de compétences du champion = la MOYENNE du plateau (équité) :
   70 en mode légendes, ~87 en mode ATP (99 → 75), la moyenne réelle en CSV.
   Son avantage : un profil sur mesure, et +3 points par saison en carrière. */
function championSkillTotal() {
  const others = state.players.filter(p => !p.custom);
  const sum = others.reduce((s, p) => s + SKILL_KEYS.reduce((a, k) => a + p.sk[k], 0), 0);
  return Math.round(sum / others.length);
}

/* ---------- Carrière multisaison ---------- */
const START_YEAR = 2026;
const MAX_SEASONS = 5;              // 2026 → 2030
const CHAMPION_SEASON_BONUS = 3;    // points de compétence gagnés par ton champion entre deux saisons

/* ---------- Compétences ---------- */
/* 10 compétences de 1 à 10, total exactement 70 par joueur. */
const SKILLS = [
  { key: "terre",     label: "Terre battue", short: "TER", group: "surface" },
  { key: "gazon",     label: "Gazon",        short: "GAZ", group: "surface" },
  { key: "dur",       label: "Dur",          short: "DUR", group: "surface" },
  { key: "indoor",    label: "Indoor",       short: "IND", group: "surface" },
  { key: "force",     label: "Force",        short: "FOR", group: "jeu" },
  { key: "endurance", label: "Endurance",    short: "END", group: "jeu" },
  { key: "adresse",   label: "Adresse",      short: "ADR", group: "jeu" },
  { key: "tactique",  label: "Tactique",     short: "TAC", group: "jeu" },
  { key: "service",   label: "Service",      short: "SER", group: "jeu" },
  { key: "mental",    label: "Mental",       short: "MEN", group: "jeu" },
];
const SKILL_KEYS = SKILLS.map(s => s.key);
const SKILL_TOTAL = 70;
const SURFACE_TO_SKILL = { clay: "terre", grass: "gazon", hard: "dur", indoor: "indoor" };

/* Légers biais thématiques : certaines catégories reçoivent plus volontiers
   des points dans certaines compétences (pur flavour, le total reste 70). */
const CAT_BIAS = {
  "Sportifs":          ["force", "endurance"],
  "Dieux & Mythes":    ["force", "mental"],
  "Héros & Légendes":  ["mental", "endurance"],
  "Empereurs & Rois":  ["tactique", "mental"],
  "Politiques":        ["tactique", "mental"],
  "Scientifiques":     ["tactique", "adresse"],
  "Écrivains":         ["tactique", "adresse"],
  "Artistes":          ["adresse", "service"],
  "Musique":           ["adresse", "service"],
  "Cinéma":            ["adresse", "mental"],
  "Aventuriers":       ["endurance", "force"],
  "Fictifs":           [],
};

/* ---------- Utilitaires ---------- */
function rnd() { return Math.random(); }
function gauss(mean, sd) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function fmtEuro(n) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
function fmtPts(n) { return new Intl.NumberFormat("fr-FR").format(n); }

/* ---------- Dates du calendrier (multisaison) ----------
   Les tournois restent sur les mêmes semaines qu'en 2026 : on décale
   simplement de 364 jours (52 semaines) par saison — le jour de la
   semaine est conservé. Arithmétique civile pure (sans objet Date). */
function daysFromCivil(y, m, d) {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function civilFromDays(z) {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: y + (m <= 2 ? 1 : 0), m, d };
}
const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const WEEKDAYS_FR = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
/* Nombre de jours couverts par un tournoi (dates réelles d1 → d2) */
function tourneySpan(t) {
  const a = t.d1.split("-").map(Number), b = t.d2.split("-").map(Number);
  return daysFromCivil(b[0], b[1], b[2]) - daysFromCivil(a[0], a[1], a[2]) + 1;
}
/* v21 : jour + heure de début d'un match (m.when = [décalage de jour, minutes]) */
function matchWhenLabel(rec, m) {
  if (!m || !m.when) return "";
  const t = CALENDAR[rec.index];
  const p = t.d1.split("-").map(Number);
  const serial = daysFromCivil(p[0], p[1], p[2])
    + 364 * (((state && state.year) || START_YEAR) - START_YEAR) + m.when[0];
  const c = civilFromDays(serial);
  const wd = WEEKDAYS_FR[((serial % 7) + 7 + 4) % 7]; // jour 0 (1970-01-01) = jeudi
  const h = Math.floor(m.when[1] / 60), mn = m.when[1] % 60;
  return wd + " " + (c.d === 1 ? "1er" : c.d) + " " + MONTHS_FR[c.m - 1] + " · " + h + "h" + (mn < 10 ? "0" + mn : mn);
}
function tourneyDates(t) {
  const year = (state && state.year) || START_YEAR;
  const shift = 364 * (year - START_YEAR);
  const conv = iso => {
    const p = iso.split("-").map(Number);
    return civilFromDays(daysFromCivil(p[0], p[1], p[2]) + shift);
  };
  const a = conv(t.d1), b = conv(t.d2);
  const fmt = x => (x.d === 1 ? "1er" : x.d) + " " + MONTHS_FR[x.m - 1];
  return fmt(a) + " – " + fmt(b) + " " + b.y;
}

/* ---------- Génération des compétences ----------
   Départ à 7 partout (total 70), puis transferts aléatoires de points
   entre compétences (bornés 1-10) : profils centrés mais typés. */
function generateSkills(cat) {
  const sk = {};
  SKILL_KEYS.forEach(k => { sk[k] = 7; });
  const bias = CAT_BIAS[cat] || [];
  const nMoves = 14 + Math.floor(Math.random() * 22); // 14 à 35 transferts
  for (let i = 0; i < nMoves; i++) {
    // Receveur : 40 % de chances de piocher dans les compétences fétiches de la catégorie
    let to;
    if (bias.length && Math.random() < 0.4) to = bias[Math.floor(Math.random() * bias.length)];
    else to = SKILL_KEYS[Math.floor(Math.random() * SKILL_KEYS.length)];
    const from = SKILL_KEYS[Math.floor(Math.random() * SKILL_KEYS.length)];
    if (from === to) continue;
    if (sk[from] > 1 && sk[to] < 10) { sk[from]--; sk[to]++; }
  }
  return sk;
}

/* Compétences fournies (CSV) : utilisées telles quelles, simplement bornées 1-10
   (case vide → 7). Le total de 70 ne s'applique qu'aux compétences générées. */
function normalizeSkills(raw) {
  const sk = {};
  SKILL_KEYS.forEach(k => { sk[k] = clamp(Math.round(Number(raw[k]) || 7), 1, 10); });
  return sk;
}

/* Mode "Top ATP" : niveau global fixe réparti uniformément sur les 10 compétences
   (ex. n°1 mondial à 99 → 9,9 partout). */
function uniformSkills(overall) {
  const v = Math.round(overall * 10) / 100; // 99 -> 9.9
  const sk = {};
  SKILL_KEYS.forEach(k => { sk[k] = v; });
  return sk;
}

/* ---------- Création des joueurs ---------- */
function buildPlayers(rawList) {
  return rawList.map((p, i) => ({
    id: i,
    name: p.name,
    flag: p.flag || "🏳️",
    cat: p.cat || "Divers",
    fr: !!p.fr,
    overall: p.overall,
    sk: p.sk ? normalizeSkills(p.sk)
      : (p.overall ? uniformSkills(p.overall) : generateSkills(p.cat || "Divers")),
  }));
}

/* ---------- État global ---------- */
let state = null;

function newSeason(rawPlayers) {
  const roster = rawPlayers || DEFAULT_PLAYERS;
  state = {
    version: 4,
    roster,                 // liste brute : sert à régénérer le plateau à chaque saison
    season: 1,              // 1 à MAX_SEASONS (2026 → 2030)
    year: START_YEAR,
    lastSeasonRank: null,   // pid -> rang final de la saison précédente (tie-break des classements)
    defending: null,        // tourneyId -> {pid: pts} : points à défendre (classement glissant 12 mois)
    careerMoney: {},        // pid -> prize money cumulé des saisons PASSÉES (la saison en cours s'ajoute)
    career: { seasons: [], stats: {}, match: null, no1Counts: {} }, // cumul des saisons passées
    players: buildPlayers(roster),
    favorites: [],          // les 5 joueurs SUIVIS (dont ton champion)
    bankroll: START_BANKROLL, // capital de départ de la saison (50 000 € en saison 1, puis report)
    cash: START_BANKROLL,   // solde bancaire LIVE : mises débitées et gains crédités en direct
    betStats: { staked: 0, returned: 0 }, // cumul saison : misé / encaissé (fiscalité différée)
    betsPlaced: false,      // vrai dès que les favoris sont choisis (la saison démarre)
    tbets: [],              // paris [{id, tourneyId, kind, legs, odds, stake, status, payout, result}]
    tbetSeq: 1,
    fatigue: {},            // pid -> points de fatigue accumulés
    trained: {},            // pid -> true si n'a pas joué le tournoi précédent (bonus « entraîné »)
    syringes: SEASON_SYRINGES, // seringues de dopage restantes
    suspended: {},          // pid -> mois (décimal) de fin de suspension
    xp: freshXp(),          // v27 : expérience de carrière (classement 40 → -15)
    currentIndex: 0,          // index du prochain tournoi dans CALENDAR
    tournaments: {},          // id -> record
    points: {},               // playerId -> points cumulés
    money: {},                // playerId -> € cumulés
    snapshots: [],            // après chaque tournoi : {tourneyId, name, ranksPts:[ids...], ranksMoney:[ids...]}
    titles: {},               // playerId -> [tourneyId]
  };
  state.players.forEach(p => { state.points[p.id] = 0; state.money[p.id] = 0; });
  saveState();
  return state;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { console.warn("Sauvegarde impossible :", e); }
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    state = JSON.parse(raw);
    return state;
  } catch (e) { return null; }
}
function resetSeason() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  state = null;
}

function getPlayer(id) { return state.players[id]; }

/* ---------- Classements ----------
   En multisaison, la saison démarre avec les classements de la fin de la
   précédente : le rang final sert de tie-break tant que les points sont ex aequo. */
function lastSeasonRankOf(id) {
  return state.lastSeasonRank && state.lastSeasonRank[id] !== undefined
    ? state.lastSeasonRank[id] : 999;
}
function sortedByPoints() {
  return state.players.slice().sort((a, b) =>
    (state.points[b.id] - state.points[a.id]) ||
    (state.money[b.id] - state.money[a.id]) ||
    (lastSeasonRankOf(a.id) - lastSeasonRankOf(b.id)) ||
    (a.id - b.id));
}
function sortedByMoney() {
  return state.players.slice().sort((a, b) =>
    (state.money[b.id] - state.money[a.id]) ||
    (state.points[b.id] - state.points[a.id]) ||
    (lastSeasonRankOf(a.id) - lastSeasonRankOf(b.id)) ||
    (a.id - b.id));
}
/* ---------- Classement ATP glissant sur 12 mois (mode carrière) ----------
   À tout moment : points des tournois déjà joués cette saison + points
   « défendus » de la saison précédente pour les tournois pas encore rejoués.
   En saison 1 (rien à défendre), le glissant coïncide avec la race.
   Il sert aux entrées en tournoi et aux têtes de série ; la race de l'année
   garde la qualification au Masters de Turin. */
function rollingMap() {
  const map = {};
  state.players.forEach(p => { map[p.id] = 0; });
  CALENDAR.forEach(t => {
    const rec = state.tournaments[t.id];
    if (rec && rec.status === "done") {
      Object.entries(rec.recap.results).forEach(([pid, r]) => {
        if (map[pid] !== undefined) map[pid] += r.pts;
      });
    } else if (state.defending && state.defending[t.id]) {
      Object.entries(state.defending[t.id]).forEach(([pid, pts]) => {
        if (map[pid] !== undefined) map[pid] += pts;
      });
    }
  });
  return map;
}
function rollingPoints(pid) { return rollingMap()[pid] || 0; }
function sortedByRolling() {
  const rm = rollingMap();
  return state.players.slice().sort((a, b) =>
    (rm[b.id] - rm[a.id]) ||
    (state.points[b.id] - state.points[a.id]) ||
    (state.money[b.id] - state.money[a.id]) ||
    (lastSeasonRankOf(a.id) - lastSeasonRankOf(b.id)) ||
    (a.id - b.id));
}
function sortedByRollingWithTieShuffle() {
  const rm = rollingMap();
  const groups = new Map();
  state.players.forEach(p => {
    const pts = rm[p.id] || 0;
    if (!groups.has(pts)) groups.set(pts, []);
    groups.get(pts).push(p.id);
  });
  const sortedPts = Array.from(groups.keys()).sort((a, b) => b - a);
  const out = [];
  sortedPts.forEach(pts => {
    const grp = shuffle(groups.get(pts));
    grp.sort((x, y) => lastSeasonRankOf(x) - lastSeasonRankOf(y));
    grp.forEach(id => out.push(id));
  });
  return out;
}
/* Tenant du titre : le joueur qui défend le plus de points sur ce tournoi */
function defendingChampion(t) {
  const d = state.defending && state.defending[t.id];
  if (!d) return null;
  let best = null, pts = 0;
  Object.entries(d).forEach(([pid, v]) => { if (v > pts) { pts = v; best = parseInt(pid, 10); } });
  return best === null ? null : { pid: best, pts };
}

/* ---------- Prize money de carrière (cumul toutes saisons) ---------- */
function careerMoneyOf(pid) {
  return ((state.careerMoney && state.careerMoney[pid]) || 0) + (state.money[pid] || 0);
}
function sortedByCareerMoney() {
  return state.players.slice().sort((a, b) =>
    (careerMoneyOf(b.id) - careerMoneyOf(a.id)) ||
    (state.points[b.id] - state.points[a.id]) ||
    (lastSeasonRankOf(a.id) - lastSeasonRankOf(b.id)) ||
    (a.id - b.id));
}

/* Position (1-indexée) dans le dernier snapshot, pour l'évolution */
function snapshotList(snap, kind) {
  if (kind === "money") return snap.ranksMoney;
  if (kind === "rolling") return snap.ranksRolling;
  if (kind === "careerMoney") return snap.ranksMoneyCareer;
  return snap.ranksPts;
}
function previousRank(playerId, kind) {
  if (state.snapshots.length < 2) {
    if (state.snapshots.length === 1) return null; // pas de semaine précédente
    return null;
  }
  const prev = state.snapshots[state.snapshots.length - 2];
  const list = snapshotList(prev, kind);
  if (!list) return null;
  const idx = list.indexOf(playerId);
  return idx === -1 ? null : idx + 1;
}
function currentRank(playerId, kind) {
  const list = kind === "money" ? sortedByMoney()
    : kind === "rolling" ? sortedByRolling()
    : kind === "careerMoney" ? sortedByCareerMoney()
    : sortedByPoints();
  return list.findIndex(p => p.id === playerId) + 1;
}

/* ---------- Sélection des participants ----------
   Les suspendus (dopage) sont exclus. En Masters 1000, les 56 premiers de la
   race sont qualifiés d'office et 8 places se jouent au tirage au sort pondéré
   par le classement (le 60e a plus de chances que le 100e). */
function weightedSample(list, n) {
  const items = list.map((id, i) => ({ id, w: list.length - i })); // linéaire : mieux classé = plus lourd
  const out = [];
  while (out.length < n && items.length) {
    const totalW = items.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * totalW;
    let idx = 0;
    for (; idx < items.length; idx++) { r -= items[idx].w; if (r <= 0) break; }
    if (idx >= items.length) idx = items.length - 1;
    out.push(items[idx].id);
    items.splice(idx, 1);
  }
  return out;
}
function selectEntrants(tourney) {
  const eligible = id => !isSuspended(id, tourney);
  if (tourney.cat === "GC")
    return { entrants: state.players.map(p => p.id).filter(eligible), qualifiers: [] };
  // Masters de Turin : la RACE de l'année décide des 8 qualifiés
  if (tourney.cat === "FINALS")
    return { entrants: sortedByPointsWithTieShuffle().filter(eligible).slice(0, 8), qualifiers: [] };
  // Masters 1000 : les entrées se font au classement ATP glissant sur 12 mois
  const ranked = sortedByRollingWithTieShuffle().filter(eligible);
  const direct = ranked.slice(0, M1000_DIRECT);
  const qualifiers = weightedSample(ranked.slice(M1000_DIRECT), 64 - M1000_DIRECT);
  return { entrants: direct.concat(qualifiers), qualifiers };
}
/* Tri par points, ex aequo mélangés aléatoirement (règle demandée pour la sélection) */
function sortedByPointsWithTieShuffle() {
  const groups = new Map();
  state.players.forEach(p => {
    const pts = state.points[p.id];
    if (!groups.has(pts)) groups.set(pts, []);
    groups.get(pts).push(p.id);
  });
  const sortedPts = Array.from(groups.keys()).sort((a, b) => b - a);
  const out = [];
  sortedPts.forEach(pts => {
    // Ex aequo : départagés par le classement final de la saison précédente,
    // puis au tirage au sort (règle historique) pour les rangs identiques
    const grp = shuffle(groups.get(pts));
    grp.sort((x, y) => lastSeasonRankOf(x) - lastSeasonRankOf(y));
    grp.forEach(id => out.push(id));
  });
  return out;
}

/* ---------- Placement des têtes de série (schéma officiel ATP) ---------- */
/* Lignes 1-indexées converties en positions 0-indexées */
const SEED_SLOTS_128 = [
  [1], [128], [33, 96], [32, 64, 65, 97],
  [16, 17, 48, 49, 80, 81, 112, 113],
  [8, 9, 24, 25, 40, 41, 56, 57, 72, 73, 88, 89, 104, 105, 120, 121],
];
const SEED_SLOTS_64 = [
  [1], [64], [17, 48], [16, 32, 33, 49],
  [8, 9, 24, 25, 40, 41, 56, 57],
];

function makeDraw(tourney, entrantIds) {
  const size = tourney.drawSize;
  const slots = new Array(size).fill(null);
  const seedsMap = {}; // playerId -> seed number

  if (tourney.randomDraw) {
    // Open d'Australie : positions totalement tirées au sort (exempts inclus si suspendus)
    const order = shuffle(entrantIds.concat(new Array(size - entrantIds.length).fill(null)));
    order.forEach((id, i) => { slots[i] = id; });
    return { slots, seedsMap };
  }

  // Têtes de série selon le classement ATP glissant sur 12 mois (ex aequo mélangés ;
  // en saison 1 le glissant coïncide avec la race)
  const ranked = sortedByRollingWithTieShuffle().filter(id => entrantIds.includes(id));
  const nSeeds = tourney.seeds;
  const seeded = ranked.slice(0, nSeeds);
  seeded.forEach((id, i) => { seedsMap[id] = i + 1; });

  const placed = placeSeedsAndRest(size, seeded, entrantIds.filter(id => !(id in seedsMap)));
  return { slots: placed, seedsMap };
}

/* Placement pur : têtes de série sur les lignes officielles, le reste au tirage */
function placeSeedsAndRest(size, seeded, others) {
  const slots = new Array(size).fill(null);
  const groups = size === 128 ? SEED_SLOTS_128 : SEED_SLOTS_64;
  let seedIdx = 0;
  groups.forEach(lines => {
    shuffle(lines.map(l => l - 1)).forEach(pos => {
      if (seedIdx < seeded.length) slots[pos] = seeded[seedIdx++];
    });
  });
  const rest = shuffle(others);
  let r = 0;
  for (let i = 0; i < size; i++) {
    if (slots[i] === null) {
      const v = rest[r++];
      slots[i] = v === undefined ? null : v; // null = exempt (joueur suspendu manquant)
    }
  }
  return slots;
}

/* ---------- Rounds ---------- */
function roundNames(drawSize) {
  if (drawSize === 128) return ["R128", "R64", "R32", "R16", "QF", "SF", "F"];
  if (drawSize === 64) return ["R64", "R32", "R16", "QF", "SF", "F"];
  return [];
}
const ROUND_SHORT = { R128: "1er tour", R64: "2e tour", R32: "3e tour", R16: "8es", QF: "Quarts", SF: "Demies", F: "Finale" };
function roundShortLabel(code, drawSize) {
  if (drawSize === 64) {
    const m = { R64: "1er tour", R32: "2e tour", R16: "8es", QF: "Quarts", SF: "Demies", F: "Finale" };
    return m[code] || code;
  }
  return ROUND_SHORT[code] || code;
}

/* ---------- Planning des matchs (v21) ----------
   Les tours sont répartis sur les jours réels du tournoi (d1 → d2) :
   la finale le dernier jour à 15h, les demi-finales la veille (14h et 18h),
   les tours précédents partagent équitablement les jours restants, avec des
   créneaux de 11h00 à 20h30. */
function scheduleBracket(record, t) {
  const span = tourneySpan(t);
  const n = record.rounds.length;
  record.rounds.forEach((round, r) => {
    if (r === n - 1) { round[0].when = [span - 1, 900]; return; }              // finale 15h00
    if (r === n - 2) { round.forEach((m, i) => { m.when = [span - 2, 840 + i * 240]; }); return; } // demies 14h/18h
    const usable = Math.max(1, span - 2);
    const from = Math.floor(r * usable / (n - 2));
    const to = Math.max(from, Math.floor((r + 1) * usable / (n - 2)) - 1);
    const days = []; for (let d = from; d <= to; d++) days.push(d);
    const perDay = Math.ceil(round.length / days.length);
    round.forEach((m, i) => {
      const dayIdx = Math.min(days.length - 1, Math.floor(i / perDay));
      const pos = i - dayIdx * perDay;
      const denom = Math.max(1, perDay - 1);
      const minutes = 660 + Math.round((pos / denom) * 19) * 30; // 11h00 → 20h30
      m.when = [days[dayIdx], Math.min(1230, minutes)];
    });
  });
}

/* ---------- Démarrage d'un tournoi ---------- */
function startTournament(index) {
  const t = CALENDAR[index];
  beginTournamentForms(index); // récupération / statut « entraîné »
  if (t.cat === "FINALS") return startFinals(index);
  const sel = selectEntrants(t);
  const entrants = sel.entrants;
  const { slots, seedsMap } = makeDraw(t, entrants);
  const names = roundNames(t.drawSize);
  const rounds = [];
  // Premier tour
  const first = [];
  for (let i = 0; i < slots.length; i += 2) {
    first.push({ p1: slots[i], p2: slots[i + 1], winner: null, score: null });
  }
  rounds.push(first);
  for (let r = 1; r < names.length; r++) {
    const n = slots.length / Math.pow(2, r + 1);
    rounds.push(Array.from({ length: n }, () => ({ p1: null, p2: null, winner: null, score: null })));
  }

  const record = {
    id: t.id, index, status: "active", type: "bracket",
    entrants, seedsMap, qualifiers: sel.qualifiers, roundsNames: names, rounds,
    currentRound: 0, recap: null,
  };
  // Exempts (byes) : les cases vides laissées par des suspendus donnent des walkovers
  settleByes(record);
  scheduleBracket(record, t); // v21 : jour + heure de début de chaque match
  record.markets = null; // cotés au premier affichage (ensureTournamentMarkets)
  state.tournaments[t.id] = record;
  saveState();
  return record;
}

/* ---------- Exempts (byes) ----------
   Une case vide au 1er tour vient d'un joueur suspendu : l'adversaire passe
   par walkover. Deux cases vides face à face -> le match ne produit personne
   (byeOut) et le vide se propage au tour suivant. Appelé au tirage puis après
   chaque match (pour résoudre les walkovers dont l'adversaire vient d'arriver). */
function propagateWinner(rec, roundIdx, matchIdx, winner) {
  if (roundIdx + 1 >= rec.rounds.length) return;
  const next = rec.rounds[roundIdx + 1][Math.floor(matchIdx / 2)];
  if (matchIdx % 2 === 0) next.p1 = winner; else next.p2 = winner;
}
function settleByes(rec) {
  for (let r = 0; r < rec.rounds.length; r++) {
    const prev = r > 0 ? rec.rounds[r - 1] : null;
    rec.rounds[r].forEach((m, i) => {
      if (m.winner !== null || m.byeOut) return;
      const e1 = r === 0 ? m.p1 === null : (m.p1 === null && prev[2 * i].byeOut === true);
      const e2 = r === 0 ? m.p2 === null : (m.p2 === null && prev[2 * i + 1].byeOut === true);
      if (!e1 && !e2) return;
      m.walkover = true;
      if (e1 && e2) { m.byeOut = true; return; }
      const w = e1 ? m.p2 : m.p1;
      if (w !== null) { m.winner = w; propagateWinner(rec, r, i, w); }
      // sinon : l'adversaire n'est pas encore connu, le walkover sera réglé plus tard
    });
  }
}

/* ---------- Simulation d'un match (jeu par jeu, basée sur les compétences) ----------
   Le résultat de chaque jeu dépend du contexte :
   - Surface du tournoi (compétence dominante) + force, adresse, tactique
   - Service : facilite la tenue de ses jeux de service
   - Endurance : pèse de plus en plus au fil des jeux (matchs longs, 5e set…)
   - Mental : bonus dans les tie-breaks et le set décisif */
const W_SURFACE = 3.0, W_FORCE = 1.0, W_ADRESSE = 1.0, W_TACTIQUE = 1.2;
const LOGIT_SCALE = 0.032;        // conversion écart de compétences -> probabilité
const SERVE_BASE = 0.10, SERVE_PER_PT = 0.075; // avantage au service selon la compétence Service
const FATIGUE_START = 15, FATIGUE_RATE = 0.0045; // l'endurance compte après ~15 jeux
const MENTAL_DECIDER = 0.055, MENTAL_TIEBREAK = 0.06;

function baseSkillDiff(skA, skB, surfKey) {
  return W_SURFACE * (skA[surfKey] - skB[surfKey])
    + W_FORCE * (skA.force - skB.force)
    + W_ADRESSE * (skA.adresse - skB.adresse)
    + W_TACTIQUE * (skA.tactique - skB.tactique);
}

/* Modèle de probabilités d'un match : partagé entre la simulation classique
   (jeu par jeu) et le mode Hot Points (point par point, interactif). */
function matchProbModel(skA, skB, surfKey, modA, modB) {
  const diffAB = baseSkillDiff(skA, skB, surfKey) + ((modA || 0) - (modB || 0));
  const endDiff = skA.endurance - skB.endurance;
  const menDiff = skA.mental - skB.mental;
  // Fatigue : bonus/malus croissant selon l'écart d'endurance et la longueur du match
  const fatigueTerm = totalGames => Math.max(0, totalGames - FATIGUE_START) * FATIGUE_RATE * endDiff;
  return {
    game(serverA, isDecider, totalGames) {
      const serveSkill = serverA ? skA.service : skB.service;
      let logit = SERVE_BASE + SERVE_PER_PT * serveSkill; // avantage du serveur
      let d = LOGIT_SCALE * diffAB + fatigueTerm(totalGames);
      if (isDecider) d += MENTAL_DECIDER * menDiff;
      logit += serverA ? d : -d;
      return 1 / (1 + Math.exp(-logit));
    },
    tbPoint(serverA, isDecider, totalGames) {
      const serveSkill = serverA ? skA.service : skB.service;
      let logit = 0.06 + 0.035 * serveSkill;
      let d = LOGIT_SCALE * 0.7 * diffAB + fatigueTerm(totalGames) + MENTAL_TIEBREAK * menDiff;
      if (isDecider) d += MENTAL_DECIDER * 0.5 * menDiff;
      logit += serverA ? d : -d;
      return 1 / (1 + Math.exp(-logit));
    },
  };
}

/* Noyau de simulation : utilisé par les matchs "réels" (avec timeline pour
   l'animation) et par les saisons silencieuses du calcul des cotes. */
function simulateMatchCore(skA, skB, surfKey, bestOf, withTimeline, modA, modB) {
  const setsToWin = Math.ceil(bestOf / 2);
  const model = matchProbModel(skA, skB, surfKey, modA, modB);

  const timeline = withTimeline ? [] : null;
  const sets = [];
  const tiebreaks = {};
  // Statistiques de balles de break (conv = breaks réussis, saved = BB défendues au service)
  const bp = { convA: 0, convB: 0, savedA: 0, savedB: 0 };
  const sv = { held: 0, total: 0 }; // services tenus / jeux de service (hors tie-breaks)
  let setsA = 0, setsB = 0;
  let totalGames = 0;
  let serverIsA = rnd() < 0.5;
  if (timeline) timeline.push({ t: "start", server: serverIsA ? "A" : "B" });

  function gameWinProbForServer(serverA, isDecider) { return model.game(serverA, isDecider, totalGames); }
  function tbPointProbForServer(serverA, isDecider) { return model.tbPoint(serverA, isDecider, totalGames); }

  while (setsA < setsToWin && setsB < setsToWin) {
    const setIdx = sets.length;
    const isDecider = setsA === setsToWin - 1 && setsB === setsToWin - 1;
    let gA = 0, gB = 0;
    while (true) {
      // Jeu
      const pServ = gameWinProbForServer(serverIsA, isDecider);
      const serverWins = rnd() < pServ;
      const gameToA = serverIsA ? serverWins : !serverWins;
      if (gameToA) gA++; else gB++;
      totalGames++;
      sv.total++;
      if (serverWins) sv.held++;
      // Balles de break (statistiques, sans effet sur le résultat du jeu)
      if (!serverWins) {
        if (gameToA) bp.convA++; else bp.convB++;               // break réussi par le relanceur
        if (rnd() < 0.35) { if (serverIsA) bp.savedA++; else bp.savedB++; } // le serveur en avait sauvé avant de céder
      } else if (rnd() < 0.22) {
        const n = 1 + (rnd() < 0.3 ? 1 : 0);                     // jeu tenu après 1-2 BB défendues
        if (serverIsA) bp.savedA += n; else bp.savedB += n;
      }
      if (timeline) timeline.push({
        t: "game", set: setIdx, gA, gB,
        winner: gameToA ? "A" : "B",
        server: serverIsA ? "A" : "B",
        broke: (gameToA && !serverIsA) || (!gameToA && serverIsA),
      });
      serverIsA = !serverIsA;
      if ((gA >= 6 || gB >= 6) && Math.abs(gA - gB) >= 2) break;
      if (gA === 6 && gB === 6) {
        // Tie-break (7 points ; super tie-break à 10 au set décisif d'un GC)
        const target = (isDecider && bestOf === 5) ? 10 : 7;
        let pa = 0, pb = 0;
        let tbServerA = serverIsA;
        let servedInPair = 0; // premier point : 1 service, puis par 2
        let first = true;
        while (!((pa >= target || pb >= target) && Math.abs(pa - pb) >= 2)) {
          const pServPt = tbPointProbForServer(tbServerA, isDecider);
          const ptServerWins = rnd() < pServPt;
          const ptToA = tbServerA ? ptServerWins : !ptServerWins;
          if (ptToA) pa++; else pb++;
          if (first) { tbServerA = !tbServerA; first = false; servedInPair = 0; }
          else { servedInPair++; if (servedInPair === 2) { tbServerA = !tbServerA; servedInPair = 0; } }
        }
        const tbToA = pa > pb;
        if (tbToA) gA++; else gB++;
        totalGames++;
        tiebreaks[setIdx] = [pa, pb];
        if (timeline) timeline.push({ t: "tiebreak", set: setIdx, gA, gB, pa, pb, winner: tbToA ? "A" : "B", target });
        serverIsA = !serverIsA;
        break;
      }
    }
    sets.push([gA, gB]);
    if (gA > gB) setsA++; else setsB++;
    if (timeline) timeline.push({ t: "set", set: setIdx, score: [gA, gB], setsA, setsB, winner: gA > gB ? "A" : "B" });
  }
  if (timeline) timeline.push({ t: "end", winner: setsA > setsB ? "A" : "B" });
  return { winA: setsA > setsB, sets, tiebreaks, timeline, bp, sv };
}

/* v21 : les matchs RÉELS sont simulés POINT PAR POINT (mêmes probabilités que le
   noyau jeu par jeu, mais avec 1res balles, aces, doubles fautes, gagnants, fautes
   directes, séries, balles sauvées et durée). Les saisons silencieuses du bookmaker
   restent en jeu par jeu (simulateMatchCore) : cotes identiques, calcul rapide. */
function simulateMatch(idA, idB, tourneyRec) {
  const c = createPointMatch(idA, idB, tourneyRec);
  const r = c.advance(); // non interactif : va jusqu'au bout du match
  const res = r.res;
  res.timeline = c.takeEvents().concat([{ t: "end", winner: res.winner === idA ? "A" : "B" }]);
  return res;
}

/* Score formaté "6-4 7-6(5) 6-2" du point de vue du vainqueur d'abord */
function formatScore(match, winnerFirst) {
  if (!match.score) return "";
  const win1 = match.winner === match.p1;
  return match.score.map((s, i) => {
    let [a, b] = s;
    if (winnerFirst && !win1) [a, b] = [b, a];
    let str = a + "-" + b;
    if (match.tiebreaks && match.tiebreaks[i]) {
      const [pa, pb] = match.tiebreaks[i];
      str += "(" + Math.min(pa, pb) + ")";
    }
    return str;
  }).join(" ");
}

/* Probabilité de gagner un JEU selon la probabilité de gagner un POINT (chaîne de Markov) */
function gameProbFromPoint(p) {
  const q = 1 - p;
  const deuceP = (p * p) / (p * p + q * q);
  return Math.pow(p, 4) * (1 + 4 * q + 10 * q * q) + 20 * Math.pow(p, 3) * Math.pow(q, 3) * deuceP;
}
/* Inversion (dichotomie) : quelle proba de point donne cette proba de jeu ?
   Mémoïsée (pas de 0,0005 sur pGame) : les milliers de simulations des
   marchés — et les matchs réels — évitent de refaire la dichotomie. */
const _ppfgMemo = new Map();
function pointProbFromGame(pGame) {
  const key = Math.round(pGame * 2000);
  const hit = _ppfgMemo.get(key);
  if (hit !== undefined) return hit;
  let lo = 0.02, hi = 0.98;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (gameProbFromPoint(mid) < pGame) lo = mid; else hi = mid;
  }
  const res = (lo + hi) / 2;
  if (_ppfgMemo.size < 8000) _ppfgMemo.set(key, res);
  return res;
}

/* Moteur POINT PAR POINT (v21) : tous les matchs réels passent par lui.
   Chaque point traverse le sous-modèle de service : 1re/2e balle, ace, double
   faute, puis attribution point gagnant / faute directe — en préservant EXACTEMENT
   la probabilité de point du serveur (décomposition à espérance constante).
   Statistiques traquées par joueur : aces, DF, 1res balles, gagnants, fautes
   directes, séries max de points et de jeux, balles de set/match sauvées, durée. */
function createPointMatch(idA, idB, rec) {
  const t = CALENDAR[rec.index];
  const surfKey = SURFACE_TO_SKILL[t.surface];
  const bestOf = t.bestOf;
  const setsToWin = Math.ceil(bestOf / 2);
  const skA = getPlayer(idA).sk, skB = getPlayer(idB).sk;
  const model = matchProbModel(skA, skB, surfKey, formMod(idA, rec), formMod(idB, rec));

  const S = {
    sets: [], tiebreaks: {},
    setsA: 0, setsB: 0, gA: 0, gB: 0,
    ptS: 0, ptR: 0,           // points du jeu courant (serveur / relanceur)
    totalGames: 0, totalPoints: 0,
    serverIsA: rnd() < 0.5,
    pPoint: null,             // proba de point du serveur pour le jeu courant
    inTB: false, tbA: 0, tbB: 0, tbServerA: false, tbFirst: true, tbPair: 0, tbTarget: 7,
    done: false,
  };
  const bp = { convA: 0, convB: 0, savedA: 0, savedB: 0 };
  const sv = { held: 0, total: 0 };
  // Statistiques détaillées, indexées [A, B]
  const stats = {
    aces: [0, 0], df: [0, 0], fs: [[0, 0], [0, 0]], // 1res balles [in, total]
    win: [0, 0], ue: [0, 0], ptsWon: [0, 0],
    streakPts: [0, 0], streakGames: [0, 0],
    spSaved: [0, 0], mpSaved: [0, 0],
    spComeback: [0, 0], mpComeback: [0, 0], // sets gagnés après BS sauvée / match gagné après BM sauvée
  };
  const curPtsStreak = [0, 0], curGamesStreak = [0, 0];
  const curSpSaved = [0, 0]; // balles de set sauvées dans le set EN COURS
  let events = [{ t: "start", server: S.serverIsA ? "A" : "B" }];

  const isDecider = () => S.setsA === setsToWin - 1 && S.setsB === setsToWin - 1;
  const skOfSide = side => (side === 0 ? skA : skB);

  /* Balle de break / de set / de match AVANT le point (côté 0 = A, 1 = B) */
  function ballContext() {
    if (S.inTB) {
      const tgt = S.tbTarget;
      const aBall = S.tbA >= tgt - 1 && S.tbA >= S.tbB + 1;
      const bBall = S.tbB >= tgt - 1 && S.tbB >= S.tbA + 1;
      const side = aBall ? 0 : bBall ? 1 : null;
      if (side === null) return { sp: null, mp: null };
      const setsX = side === 0 ? S.setsA : S.setsB;
      return { sp: setsX < setsToWin - 1 ? side : null, mp: setsX === setsToWin - 1 ? side : null };
    }
    const a = S.ptS, b = S.ptR;
    const serverSide = S.serverIsA ? 0 : 1, retSide = 1 - serverSide;
    const serverGP = a >= 3 && a >= b + 1;
    const returnerGP = b >= 3 && b >= a + 1;
    const out = { sp: null, mp: null };
    const gpSide = returnerGP ? retSide : serverGP ? serverSide : null;
    if (gpSide !== null) {
      const gX = gpSide === 0 ? S.gA : S.gB, gY = gpSide === 0 ? S.gB : S.gA;
      if (gX + 1 >= 6 && gX + 1 - gY >= 2) {
        const setsX = gpSide === 0 ? S.setsA : S.setsB;
        if (setsX === setsToWin - 1) out.mp = gpSide; else out.sp = gpSide;
      }
    }
    return out;
  }

  /* Un point de service complet : 1re/2e balle, ace, double faute, attribution.
     E[victoire serveur] = pWin exactement (décomposition compensée). */
  function playServePoint(pWin, serverSide) {
    const sSk = skOfSide(serverSide).service;
    const f = clamp(0.62 + 0.012 * (sSk - 5.5), 0.45, 0.80); // % de 1res balles
    let p1 = clamp(pWin + 0.10, 0.03, 0.97);
    let p2 = (pWin - f * p1) / (1 - f);
    if (p2 < 0.03) { p2 = 0.03; p1 = clamp((pWin - (1 - f) * p2) / f, 0.02, 0.98); }
    const ball = ballContext(); // AVANT résolution : balles de set/match à sauver
    stats.fs[serverSide][1]++;
    const firstIn = rnd() < f;
    let win, ace = false, df = false;
    if (firstIn) {
      stats.fs[serverSide][0]++;
      win = rnd() < p1;
      if (win && rnd() < clamp(0.10 + 0.03 * (sSk - 5.5), 0.02, 0.40)) ace = true;
    } else {
      const dfP = clamp(0.10 - 0.008 * (sSk - 5.5), 0.03, 0.18); // double faute (2e balle)
      if (rnd() < dfP) { win = false; df = true; }
      else win = rnd() < Math.min(1, p2 / (1 - dfP));
    }
    const winnerSide = win ? serverSide : 1 - serverSide;
    if (ball.sp !== null && ball.sp !== winnerSide) { stats.spSaved[winnerSide]++; curSpSaved[winnerSide]++; }
    if (ball.mp !== null && ball.mp !== winnerSide) stats.mpSaved[winnerSide]++;
    if (ace) { stats.aces[serverSide]++; stats.win[serverSide]++; }
    else if (df) { stats.df[serverSide]++; }
    else {
      const wSk = skOfSide(winnerSide);
      const pEnd = clamp(0.42 + 0.02 * (wSk.force - 5.5) + 0.015 * (wSk.adresse - 5.5), 0.25, 0.70);
      if (rnd() < pEnd) stats.win[winnerSide]++;   // point gagnant
      else stats.ue[1 - winnerSide]++;             // faute directe du perdant du point
    }
    stats.ptsWon[winnerSide]++;
    curPtsStreak[winnerSide]++;
    curPtsStreak[1 - winnerSide] = 0;
    stats.streakPts[winnerSide] = Math.max(stats.streakPts[winnerSide], curPtsStreak[winnerSide]);
    S.totalPoints++;
    return win;
  }

  function beginGame() {
    const pGame = model.game(S.serverIsA, isDecider(), S.totalGames);
    S.pPoint = pointProbFromGame(pGame);
  }
  function markGameStreak(winnerSide) {
    curGamesStreak[winnerSide]++;
    curGamesStreak[1 - winnerSide] = 0;
    stats.streakGames[winnerSide] = Math.max(stats.streakGames[winnerSide], curGamesStreak[winnerSide]);
  }
  function endSet() {
    const setIdx = S.sets.length;
    S.sets.push([S.gA, S.gB]);
    // Set gagné après avoir sauvé une balle de set dans CE set : un comeback
    const setWinner = S.gA > S.gB ? 0 : 1;
    if (curSpSaved[setWinner] > 0) stats.spComeback[setWinner]++;
    curSpSaved[0] = 0; curSpSaved[1] = 0;
    if (S.gA > S.gB) S.setsA++; else S.setsB++;
    events.push({ t: "set", set: setIdx, score: [S.gA, S.gB], setsA: S.setsA, setsB: S.setsB, winner: S.gA > S.gB ? "A" : "B" });
    S.gA = 0; S.gB = 0;
    if (S.setsA === setsToWin || S.setsB === setsToWin) S.done = true;
  }
  function endGame(serverWon) {
    const gameToA = S.serverIsA ? serverWon : !serverWon;
    if (gameToA) S.gA++; else S.gB++;
    S.totalGames++;
    sv.total++; if (serverWon) sv.held++;
    if (!serverWon) { if (gameToA) bp.convA++; else bp.convB++; } // break réel
    markGameStreak(gameToA ? 0 : 1);
    events.push({
      t: "game", set: S.sets.length, gA: S.gA, gB: S.gB,
      winner: gameToA ? "A" : "B", server: S.serverIsA ? "A" : "B", broke: !serverWon,
    });
    S.serverIsA = !S.serverIsA;
    S.pPoint = null; S.ptS = 0; S.ptR = 0;
    if ((S.gA >= 6 || S.gB >= 6) && Math.abs(S.gA - S.gB) >= 2) { endSet(); return; }
    if (S.gA === 6 && S.gB === 6) {
      S.inTB = true; S.tbA = 0; S.tbB = 0;
      S.tbTarget = (isDecider() && bestOf === 5) ? 10 : 7;
      S.tbServerA = S.serverIsA; S.tbFirst = true; S.tbPair = 0;
    }
  }
  function resolveGamePoint(serverWins) {
    const isBP = S.ptR >= 3 && S.ptR >= S.ptS + 1;
    if (serverWins) {
      if (isBP) { if (S.serverIsA) bp.savedA++; else bp.savedB++; } // BB sauvée (réelle)
      S.ptS++;
    } else S.ptR++;
    if ((S.ptS >= 4 || S.ptR >= 4) && Math.abs(S.ptS - S.ptR) >= 2) endGame(S.ptS > S.ptR);
  }
  function resolveTBPoint(serverWins) {
    const ptToA = S.tbServerA ? serverWins : !serverWins;
    if (ptToA) S.tbA++; else S.tbB++;
    if (S.tbFirst) { S.tbServerA = !S.tbServerA; S.tbFirst = false; S.tbPair = 0; }
    else { S.tbPair++; if (S.tbPair === 2) { S.tbServerA = !S.tbServerA; S.tbPair = 0; } }
    if ((S.tbA >= S.tbTarget || S.tbB >= S.tbTarget) && Math.abs(S.tbA - S.tbB) >= 2) {
      const tbToA = S.tbA > S.tbB;
      if (tbToA) S.gA++; else S.gB++;
      S.totalGames++;
      markGameStreak(tbToA ? 0 : 1);
      S.tiebreaks[S.sets.length] = [S.tbA, S.tbB];
      events.push({ t: "tiebreak", set: S.sets.length, gA: S.gA, gB: S.gB, pa: S.tbA, pb: S.tbB, winner: tbToA ? "A" : "B", target: S.tbTarget });
      S.serverIsA = !S.serverIsA;
      S.inTB = false;
      endSet();
    }
  }
  function buildRes() {
    // Match gagné après avoir sauvé au moins une balle de match : un miracle
    const wSide = S.setsA > S.setsB ? 0 : 1;
    if (stats.mpSaved[wSide] > 0) stats.mpComeback[wSide] = 1;
    return {
      winner: S.setsA > S.setsB ? idA : idB,
      sets: S.sets, tiebreaks: S.tiebreaks,
      bp: [[bp.convA, bp.savedA], [bp.convB, bp.savedB]],
      sv: [sv.held, sv.total],
      stats: {
        aces: stats.aces, df: stats.df, fs: stats.fs,
        win: stats.win, ue: stats.ue, ptsWon: stats.ptsWon,
        streakPts: stats.streakPts, streakGames: stats.streakGames,
        spSaved: stats.spSaved, mpSaved: stats.mpSaved,
        spComeback: stats.spComeback, mpComeback: stats.mpComeback,
        mins: Math.round(S.totalPoints * 0.55 + S.sets.length * 4),
      },
    };
  }

  function advance() {
    while (!S.done) {
      if (S.inTB) {
        const pServ = model.tbPoint(S.tbServerA, isDecider(), S.totalGames);
        resolveTBPoint(playServePoint(pServ, S.tbServerA ? 0 : 1));
        continue;
      }
      if (S.pPoint === null) beginGame();
      resolveGamePoint(playServePoint(S.pPoint, S.serverIsA ? 0 : 1));
    }
    return { type: "end", res: buildRes() };
  }
  function takeEvents() { const out = events; events = []; return out; }

  return { advance, takeEvents };
}

/* ---------- Jouer un match du tableau ---------- */
function playBracketMatch(rec, roundIdx, matchIdx) {
  const match = rec.rounds[roundIdx][matchIdx];
  if (match.winner !== null || match.p1 === null || match.p2 === null) return null;
  // Forme des deux joueurs au moment du match (affichée ensuite dans le tableau)
  match.form1 = formStatus(match.p1, rec);
  match.form2 = formStatus(match.p2, rec);
  const res = simulateMatch(match.p1, match.p2, rec);
  applyBracketResult(rec, roundIdx, matchIdx, res);
  return res;
}
/* Applique un résultat de match au tableau */
function applyBracketResult(rec, roundIdx, matchIdx, res) {
  const match = rec.rounds[roundIdx][matchIdx];
  match.winner = res.winner;
  match.score = res.sets;
  match.tiebreaks = res.tiebreaks;
  match.bp = res.bp;
  match.sv = res.sv;
  match.stats = res.stats || null; // v21 : stats détaillées du match
  // La fatigue s'accumule pour les deux joueurs (le dopé la subira plus tard)
  const g = res.sets.reduce((s, x) => s + x[0] + x[1], 0);
  addFatigue(match.p1, g);
  addFatigue(match.p2, g);
  // Propagation au tour suivant (+ résolution des walkovers en attente)
  propagateWinner(rec, roundIdx, matchIdx, res.winner);
  settleByes(rec);
  // Avancement de tour (les walkovers comptent comme réglés)
  if (rec.rounds[rec.currentRound].every(m => m.winner !== null || m.walkover)) {
    if (rec.currentRound + 1 < rec.rounds.length) rec.currentRound++;
  }
  // Paris de match / de tour : règlement instantané (le solde vit en direct)
  resolveOpenMatchBets(rec);
  // v27 : l'expérience de ton champion évolue à chaque match joué
  xpAfterChampionMatch(rec, match);
  // Tournoi terminé ?
  const final = rec.rounds[rec.rounds.length - 1][0];
  if (final.winner !== null && rec.status === "active") finalizeTournament(rec);
  saveState();
  return res;
}

/* ---------- Attribution points + prize money ---------- */
function finalizeTournament(rec) {
  const t = CALENDAR[rec.index];
  const ptsTable = POINTS[t.cat];
  const przTable = PRIZE[PRIZE_BY_TOURNEY[t.id]];
  const results = {}; // playerId -> {round, pts, money}

  rec.roundsNames.forEach((rName, rIdx) => {
    rec.rounds[rIdx].forEach(m => {
      const loser = m.winner === m.p1 ? m.p2 : m.p1;
      if (loser !== null && m.winner !== null) {
        results[loser] = { round: rName, pts: ptsTable[rName] || 0, money: przTable[rName] || 0 };
      }
    });
  });
  const champion = rec.rounds[rec.rounds.length - 1][0].winner;
  results[champion] = { round: "W", pts: ptsTable.W, money: przTable.W };

  Object.entries(results).forEach(([pid, r]) => {
    state.points[pid] = (state.points[pid] || 0) + r.pts;
    state.money[pid] = (state.money[pid] || 0) + r.money;
  });
  if (!state.titles[champion]) state.titles[champion] = [];
  state.titles[champion].push(t.id);

  rec.status = "done";
  rec.recap = { champion, results };
  runDopingControl(rec, t);
  rec.recap.tbets = resolveTournamentBets(rec);
  settleTournamentFinance(rec); // 💶 prize net crédité, frais débités : la banque bouge
  xpAfterTournament(rec);       // 🎖 goals, bonus de résultat, partenaires du club
  state.currentIndex = rec.index + 1;
  takeSnapshot(t);
  saveState();
}

function takeSnapshot(t) {
  state.snapshots.push({
    tourneyId: t.id,
    name: t.name,
    ranksPts: sortedByPoints().map(p => p.id),
    ranksMoney: sortedByMoney().map(p => p.id),
    ranksRolling: sortedByRolling().map(p => p.id),
    ranksMoneyCareer: sortedByCareerMoney().map(p => p.id),
  });
}

/* ---------- ATP Finals (Masters) ---------- */
function startFinals(index) {
  const t = CALENDAR[index];
  const eight = selectEntrants(t).entrants;
  // Groupes : 1 et 2 séparés, 3-4 tirés au sort, 5-6, 7-8
  const gA = [eight[0]], gB = [eight[1]];
  const p34 = shuffle([eight[2], eight[3]]);
  gA.push(p34[0]); gB.push(p34[1]);
  const p56 = shuffle([eight[4], eight[5]]);
  gA.push(p56[0]); gB.push(p56[1]);
  const p78 = shuffle([eight[6], eight[7]]);
  gA.push(p78[0]); gB.push(p78[1]);

  const seedsMap = {};
  eight.forEach((id, i) => { seedsMap[id] = i + 1; });

  /* Round robin sur 3 journées : J1 (1-2, 3-4), J2 (1-3, 2-4), J3 (1-4, 2-3) */
  function rrMatches(group) {
    const [a, b, c, d] = group;
    return [
      { p1: a, p2: b, winner: null, score: null, day: 1 },
      { p1: c, p2: d, winner: null, score: null, day: 1 },
      { p1: a, p2: c, winner: null, score: null, day: 2 },
      { p1: b, p2: d, winner: null, score: null, day: 2 },
      { p1: a, p2: d, winner: null, score: null, day: 3 },
      { p1: b, p2: c, winner: null, score: null, day: 3 },
    ];
  }

  const record = {
    id: t.id, index, status: "active", type: "finals",
    entrants: eight, seedsMap,
    groups: { A: gA, B: gB },
    rr: { A: rrMatches(gA), B: rrMatches(gB) },
    sf: [{ p1: null, p2: null, winner: null, score: null }, { p1: null, p2: null, winner: null, score: null }],
    final: { p1: null, p2: null, winner: null, score: null },
    phase: "rr", // rr -> sf -> final -> done
    recap: null,
    wins: {}, // playerId -> nb victoires RR (pour points/prize)
    sfWinners: [],
  };
  eight.forEach(id => { record.wins[id] = 0; });
  // v21 : planning du Masters — J1/J2/J3 répartis, demies l'avant-dernier jour, finale le dernier
  const spanF = tourneySpan(t);
  ["A", "B"].forEach((g, gi) => record.rr[g].forEach((m, i) => {
    const day = Math.round((m.day - 1) * Math.max(0, spanF - 3) / 2);
    const slot = (i % 2) * 2 + gi; // 4 matchs par journée : 11h, 14h, 17h, 20h
    m.when = [day, 660 + slot * 180];
  }));
  record.sf.forEach((m, i) => { m.when = [spanF - 2, 840 + i * 240]; });
  record.final.when = [spanF - 1, 900];
  record.markets = null; // cotés au premier affichage (ensureTournamentMarkets)
  state.tournaments[t.id] = record;
  saveState();
  return record;
}

function groupStandings(rec, g) {
  const group = rec.groups[g];
  const stats = {};
  group.forEach(id => { stats[id] = { id, w: 0, l: 0, setsW: 0, setsL: 0, gamesW: 0, gamesL: 0 }; });
  rec.rr[g].forEach(m => {
    if (m.winner === null) return;
    const loser = m.winner === m.p1 ? m.p2 : m.p1;
    stats[m.winner].w++; stats[loser].l++;
    m.score.forEach(s => {
      const p1Won = s[0] > s[1];
      const sw = p1Won ? m.p1 : m.p2, sl = p1Won ? m.p2 : m.p1;
      stats[sw].setsW++; stats[sl].setsL++;
      stats[m.p1].gamesW += s[0]; stats[m.p1].gamesL += s[1];
      stats[m.p2].gamesW += s[1]; stats[m.p2].gamesL += s[0];
    });
  });
  return group.map(id => stats[id]).sort((a, b) =>
    (b.w - a.w) ||
    ((b.setsW - b.setsL) - (a.setsW - a.setsL)) ||
    ((b.gamesW - b.gamesL) - (a.gamesW - a.gamesL)) ||
    (Math.random() - 0.5));
}

function playFinalsMatch(rec, phase, key, matchIdx) {
  let match;
  if (phase === "rr") match = rec.rr[key][matchIdx];
  else if (phase === "sf") match = rec.sf[matchIdx];
  else match = rec.final;
  if (!match || match.winner !== null || match.p1 === null || match.p2 === null) return null;

  match.form1 = formStatus(match.p1, rec);
  match.form2 = formStatus(match.p2, rec);
  const res = simulateMatch(match.p1, match.p2, rec);
  applyFinalsResult(rec, phase, key, matchIdx, res);
  return res;
}
/* Applique un résultat de match du Masters */
function applyFinalsResult(rec, phase, key, matchIdx, res) {
  let match;
  if (phase === "rr") match = rec.rr[key][matchIdx];
  else if (phase === "sf") match = rec.sf[matchIdx];
  else match = rec.final;
  match.winner = res.winner;
  match.score = res.sets;
  match.tiebreaks = res.tiebreaks;
  match.bp = res.bp;
  match.sv = res.sv;
  match.stats = res.stats || null; // v21 : stats détaillées du match
  const gF = res.sets.reduce((s, x) => s + x[0] + x[1], 0);
  addFatigue(match.p1, gF);
  addFatigue(match.p2, gF);

  if (phase === "rr") {
    rec.wins[res.winner]++;
    const allDone = rec.rr.A.every(m => m.winner !== null) && rec.rr.B.every(m => m.winner !== null);
    if (allDone) {
      const stA = groupStandings(rec, "A"), stB = groupStandings(rec, "B");
      rec.sf[0].p1 = stA[0].id; rec.sf[0].p2 = stB[1].id;
      rec.sf[1].p1 = stB[0].id; rec.sf[1].p2 = stA[1].id;
      rec.phase = "sf";
    }
  } else if (phase === "sf") {
    if (rec.sf.every(m => m.winner !== null)) {
      rec.final.p1 = rec.sf[0].winner;
      rec.final.p2 = rec.sf[1].winner;
      rec.sfWinners = [rec.sf[0].winner, rec.sf[1].winner];
      rec.phase = "final";
    }
  } else {
    rec.phase = "done";
    finalizeFinals(rec);
  }
  // Paris de match / de tour : règlement instantané (le solde vit en direct)
  resolveOpenMatchBets(rec);
  // v27 : l'expérience de ton champion évolue à chaque match joué
  xpAfterChampionMatch(rec, match);
  saveState();
  return res;
}

function finalizeFinals(rec) {
  const t = CALENDAR[rec.index];
  const pts = POINTS.FINALS;
  const prz = PRIZE.finals;
  const results = {};
  rec.entrants.forEach(id => {
    let p = pts.RR_WIN * rec.wins[id];
    let m = prz.PARTICIPATION + prz.RR_WIN * rec.wins[id];
    results[id] = { round: "RR", rrWins: rec.wins[id], pts: p, money: m };
  });
  rec.sfWinners.forEach(id => {
    results[id].pts += pts.SF_WIN;
    results[id].money += prz.SF_WIN;
    results[id].round = "F";
  });
  // Perdants de demi-finale
  rec.sf.forEach(m => {
    const loser = m.winner === m.p1 ? m.p2 : m.p1;
    if (results[loser]) results[loser].round = "SF";
  });
  const champ = rec.final.winner;
  results[champ].pts += pts.F_WIN;
  results[champ].money += prz.F_WIN;
  results[champ].round = "W";

  Object.entries(results).forEach(([pid, r]) => {
    state.points[pid] = (state.points[pid] || 0) + r.pts;
    state.money[pid] = (state.money[pid] || 0) + r.money;
  });
  if (!state.titles[champ]) state.titles[champ] = [];
  state.titles[champ].push(t.id);

  rec.status = "done";
  rec.recap = { champion: champ, results };
  runDopingControl(rec, t);
  rec.recap.tbets = resolveTournamentBets(rec);
  settleTournamentFinance(rec); // 💶 prize net crédité, frais débités : la banque bouge
  xpAfterTournament(rec);       // 🎖 goals, bonus de résultat, partenaires du club
  state.currentIndex = rec.index + 1;
  takeSnapshot(t);
  saveState();
}

/* ---------- Statistiques joueur (cartes) ----------
   playerStatsSeason = saison en cours ; playerStats = cumul carrière
   (saisons archivées + saison en cours). */
function playerStatsSeason(pid) {
  const st = {
    wins: 0, losses: 0, results: [],
    setsW: 0, setsL: 0, gamesW: 0, gamesL: 0,
    tbW: 0, tbL: 0,
    bpConv: 0, bpSaved: 0,   // BB converties (en retour) / sauvées (au service)
    bpOppSaved: 0, bpOppConv: 0, // BB de l'adversaire : sauvées contre moi / breaks subis
    tournamentsPlayed: 0, finals: 0,
    surf: { terre: [0, 0], gazon: [0, 0], dur: [0, 0], indoor: [0, 0] }, // [V, D] par surface
    // v21 : stats détaillées (issues de la simulation point par point)
    aces: 0, df: 0, fsIn: 0, fsTot: 0, winners: 0, ue: 0,
    spSaved: 0, mpSaved: 0, minutes: 0,
    spComeback: 0, mpComeback: 0, // sets gagnés après BS sauvée / matchs gagnés après BM sauvée
    bestStreakPts: 0, bestStreakGames: 0,
  };
  function addMatch(m, surfKey) {
    if (!m || m.winner === null || m.walkover || (m.p1 !== pid && m.p2 !== pid)) return;
    const isP1 = m.p1 === pid;
    const won = m.winner === pid;
    if (won) st.wins++; else st.losses++;
    st.surf[surfKey][won ? 0 : 1]++;
    (m.score || []).forEach((s, i) => {
      const g = isP1 ? s[0] : s[1], go = isP1 ? s[1] : s[0];
      st.gamesW += g; st.gamesL += go;
      if (g > go) st.setsW++; else st.setsL++;
      if (m.tiebreaks && m.tiebreaks[i]) { if (g > go) st.tbW++; else st.tbL++; }
    });
    if (m.bp) {
      const mine = isP1 ? m.bp[0] : m.bp[1];
      const theirs = isP1 ? m.bp[1] : m.bp[0];
      st.bpConv += mine[0]; st.bpSaved += mine[1];
      st.bpOppConv += theirs[0]; st.bpOppSaved += theirs[1];
    }
    if (m.stats) {
      const k = isP1 ? 0 : 1;
      st.aces += m.stats.aces[k]; st.df += m.stats.df[k];
      st.fsIn += m.stats.fs[k][0]; st.fsTot += m.stats.fs[k][1];
      st.winners += m.stats.win[k]; st.ue += m.stats.ue[k];
      st.spSaved += m.stats.spSaved[k]; st.mpSaved += m.stats.mpSaved[k];
      if (m.stats.spComeback) st.spComeback += m.stats.spComeback[k];
      if (m.stats.mpComeback) st.mpComeback += m.stats.mpComeback[k];
      st.minutes += m.stats.mins;
      st.bestStreakPts = Math.max(st.bestStreakPts, m.stats.streakPts[k]);
      st.bestStreakGames = Math.max(st.bestStreakGames, m.stats.streakGames[k]);
    }
  }
  CALENDAR.forEach(t => {
    const rec = state.tournaments[t.id];
    if (!rec || rec.status !== "done") return;
    const surfKey = SURFACE_TO_SKILL[t.surface];
    if (rec.type === "bracket") rec.rounds.forEach(round => round.forEach(m => addMatch(m, surfKey)));
    else rec.rr.A.concat(rec.rr.B, rec.sf, [rec.final]).forEach(m => addMatch(m, surfKey));
    const r = rec.recap.results[pid];
    if (r) {
      st.results.push({ tourneyId: t.id, round: r.round, rrWins: r.rrWins });
      st.tournamentsPlayed++;
      if (r.round === "F" || r.round === "W") st.finals++;
    }
  });
  // BB obtenues (en retour) = converties + celles que l'adversaire a sauvées ;
  // BB concédées (au service) = sauvées + breaks subis
  st.bpEarned = st.bpConv + st.bpOppSaved;
  st.bpFaced = st.bpSaved + st.bpOppConv;
  return st;
}

const CAREER_STAT_KEYS = ["wins", "losses", "setsW", "setsL", "gamesW", "gamesL", "tbW", "tbL",
  "bpConv", "bpSaved", "bpOppSaved", "bpOppConv", "tournamentsPlayed", "finals",
  "aces", "df", "fsIn", "fsTot", "winners", "ue", "spSaved", "mpSaved", "minutes",
  "spComeback", "mpComeback"];
const CAREER_MAX_KEYS = ["bestStreakPts", "bestStreakGames"]; // records : on garde le MAX

function playerStats(pid) {
  const st = playerStatsSeason(pid);
  const c = state.career && state.career.stats && state.career.stats[pid];
  if (c) {
    CAREER_STAT_KEYS.forEach(k => { st[k] += c[k] || 0; });
    CAREER_MAX_KEYS.forEach(k => { st[k] = Math.max(st[k], c[k] || 0); });
    Object.keys(st.surf).forEach(k => {
      if (c.surf && c.surf[k]) { st.surf[k][0] += c.surf[k][0]; st.surf[k][1] += c.surf[k][1]; }
    });
    st.bpEarned = st.bpConv + st.bpOppSaved;
    st.bpFaced = st.bpSaved + st.bpOppConv;
  }
  return st;
}

/* ---------- Statistiques globales de la saison (page Stats) ---------- */
function seasonMatchStatsSeason() {
  const setScores = { "6-0": 0, "6-1": 0, "6-2": 0, "6-3": 0, "6-4": 0, "7-5": 0, "7-6": 0 };
  const lenBo3 = { 2: 0, 3: 0 };          // Masters 1000 + Masters
  const lenBo5 = { 3: 0, 4: 0, 5: 0 };    // Grands Chelems
  const matchListBo3 = [], matchListBo5 = []; // pour les records (matchs les plus longs/courts)
  let totalMatches = 0, totalSets = 0;
  CALENDAR.forEach(t => {
    const rec = state.tournaments[t.id];
    if (!rec || rec.status !== "done") return;
    const matches = rec.type === "bracket"
      ? rec.rounds.flat()
      : rec.rr.A.concat(rec.rr.B, rec.sf, [rec.final]);
    matches.forEach(m => {
      if (!m || m.winner === null || !m.score) return;
      totalMatches++;
      const games = m.score.reduce((s, x) => s + x[0] + x[1], 0);
      (t.bestOf === 5 ? matchListBo5 : matchListBo3).push({ tid: t.id, m, games, mins: m.stats ? m.stats.mins : 0, year: state.year });
      if (t.bestOf === 5) lenBo5[m.score.length] = (lenBo5[m.score.length] || 0) + 1;
      else lenBo3[m.score.length] = (lenBo3[m.score.length] || 0) + 1;
      m.score.forEach(s => {
        const key = Math.max(s[0], s[1]) + "-" + Math.min(s[0], s[1]);
        if (key in setScores) setScores[key]++;
        totalSets++;
      });
    });
  });
  return { setScores, lenBo3, lenBo5, totalMatches, totalSets, matchListBo3, matchListBo5 };
}

/* Cumul carrière : saisons archivées + saison en cours */
function seasonMatchStats() {
  const ms = seasonMatchStatsSeason();
  const cm = state.career && state.career.match;
  if (cm) {
    Object.keys(ms.setScores).forEach(k => { ms.setScores[k] += cm.setScores[k] || 0; });
    Object.keys(cm.lenBo3 || {}).forEach(k => { ms.lenBo3[k] = (ms.lenBo3[k] || 0) + cm.lenBo3[k]; });
    Object.keys(cm.lenBo5 || {}).forEach(k => { ms.lenBo5[k] = (ms.lenBo5[k] || 0) + cm.lenBo5[k]; });
    ms.totalMatches += cm.totalMatches || 0;
    ms.totalSets += cm.totalSets || 0;
    ms.matchListBo3 = ms.matchListBo3.concat(cm.listBo3 || []);
    ms.matchListBo5 = ms.matchListBo5.concat(cm.listBo5 || []);
  }
  return ms;
}

/* ---------- Ton champion (128e joueur, créé par le joueur) ---------- */
function addCustomPlayer(info) {
  // info : {name, flag, classement, sk}
  const p = {
    id: state.players.length,
    name: info.name,
    flag: info.flag || "🏳️",
    cat: "Mon champion",
    fr: info.flag === "🇫🇷",
    classement: (state.xp && CLASSEMENTS_LADDER[xpLevelIdx(state.xp.total)]) || CLASSEMENTS_LADDER[0], // v27 : gagné à l'XP, départ 40
    club: (info.club || "").trim(),
    custom: true,
    sk: normalizeSkills(info.sk),
  };
  state.players.push(p);
  state.points[p.id] = 0;
  state.money[p.id] = 0;
  saveState();
  return p;
}
function customPlayer() {
  return state && state.players ? state.players.find(p => p.custom) : null;
}

/* ============================================================
   CARRIÈRE MULTISAISON (5 saisons max, 2026 → 2030)
   - le champion gagne CHAMPION_SEASON_BONUS points entre deux saisons
   - la saison démarre avec les classements finaux de la précédente
   - les statistiques (cartes + page Stats) sont cumulées
   ============================================================ */
function archiveSeason() {
  if (!state.career) state.career = { seasons: [], stats: {}, match: null, no1Counts: {} };
  if (!state.career.no1Counts) state.career.no1Counts = {};
  // Passages en tête du classement (après chaque tournoi de la saison)
  state.snapshots.forEach(s => {
    const list = s.ranksRolling || s.ranksPts;
    if (list && list.length) state.career.no1Counts[list[0]] = (state.career.no1Counts[list[0]] || 0) + 1;
  });
  // Cumul des stats joueur
  state.players.forEach(p => {
    const x = playerStatsSeason(p.id);
    const c = state.career.stats[p.id] || {
      surf: { terre: [0, 0], gazon: [0, 0], dur: [0, 0], indoor: [0, 0] },
    };
    CAREER_STAT_KEYS.forEach(k => { c[k] = (c[k] || 0) + x[k]; });
    CAREER_MAX_KEYS.forEach(k => { c[k] = Math.max(c[k] || 0, x[k]); });
    Object.keys(c.surf).forEach(k => { c.surf[k][0] += x.surf[k][0]; c.surf[k][1] += x.surf[k][1]; });
    state.career.stats[p.id] = c;
  });
  // Cumul des stats de matchs (on ne garde que les records de chaque saison)
  const ms = seasonMatchStatsSeason();
  const cm = state.career.match || {
    setScores: { "6-0": 0, "6-1": 0, "6-2": 0, "6-3": 0, "6-4": 0, "7-5": 0, "7-6": 0 },
    lenBo3: {}, lenBo5: {}, totalMatches: 0, totalSets: 0, listBo3: [], listBo5: [],
  };
  Object.keys(ms.setScores).forEach(k => { cm.setScores[k] += ms.setScores[k]; });
  Object.keys(ms.lenBo3).forEach(k => { cm.lenBo3[k] = (cm.lenBo3[k] || 0) + ms.lenBo3[k]; });
  Object.keys(ms.lenBo5).forEach(k => { cm.lenBo5[k] = (cm.lenBo5[k] || 0) + ms.lenBo5[k]; });
  cm.totalMatches += ms.totalMatches;
  cm.totalSets += ms.totalSets;
  const keepM = m => ({ p1: m.p1, p2: m.p2, winner: m.winner, score: m.score, tiebreaks: m.tiebreaks });
  const extremes = list => {
    // Records en JEUX et en DURÉE : on garde les extrêmes des deux classements (dédupliqués)
    const byGames = list.slice().sort((a, b) => b.games - a.games);
    const byMins = list.filter(e => (e.mins || 0) > 0).sort((a, b) => b.mins - a.mins);
    const keep = new Set();
    byGames.slice(0, 3).concat(byGames.slice(-3), byMins.slice(0, 3), byMins.slice(-3)).forEach(e => keep.add(e));
    return Array.from(keep);
  };
  extremes(ms.matchListBo5).forEach(e => cm.listBo5.push({ tid: e.tid, games: e.games, mins: e.mins || 0, year: e.year, m: keepM(e.m) }));
  extremes(ms.matchListBo3).forEach(e => cm.listBo3.push({ tid: e.tid, games: e.games, mins: e.mins || 0, year: e.year, m: keepM(e.m) }));
  state.career.match = cm;
  // Résumé de la saison (bilan : paris taxés à 30 % si positifs, prize money −33 % −10 %, −100 k€ de frais)
  const settle = seasonSettlement();
  const top = sortedByPoints();
  const cp = customPlayer();
  const cpTitles = cp ? Object.values(state.tournaments).filter(r => r.recap && r.recap.champion === cp.id).length : 0;
  const finalsRec = state.tournaments["finals"];
  state.career.seasons.push({
    year: state.year,
    no1: top[0].name, no1Flag: top[0].flag, no1Pts: state.points[top[0].id],
    mastersChamp: finalsRec && finalsRec.recap ? getPlayer(finalsRec.recap.champion).name : "—",
    mastersFlag: finalsRec && finalsRec.recap ? getPlayer(finalsRec.recap.champion).flag : "",
    start: settle.start, betNet: settle.betNet, betTax: settle.betTax,
    prize: settle.prize, prizeNet: settle.prizeNet, travel: settle.travel, bank: settle.final,
    cpTitles,
    cpRank: cp ? currentRank(cp.id, "points") : null,
  });
}

function startNextSeason() {
  if (state.currentIndex < CALENDAR.length) throw new Error("La saison n'est pas terminée.");
  if (state.season >= MAX_SEASONS) throw new Error("Carrière terminée : " + MAX_SEASONS + " saisons maximum.");
  const settle = seasonSettlement(); // bilan de fin de saison : le solde final est reporté (dette possible !)
  archiveSeason();
  const lastRank = {};
  sortedByPoints().forEach((p, i) => { lastRank[p.id] = i + 1; });
  const keep = {
    roster: state.roster, season: state.season + 1, year: state.year + 1,
    career: state.career, titles: state.titles, matchSpeed: state.matchSpeed,
    cp: customPlayer() ? JSON.parse(JSON.stringify(customPlayer())) : null,
    suspended: {},
    careerMoney: {},
    defending: {},
    bankroll: settle.final,
    xp: state.xp || freshXp(), // v27 : l'expérience est un acquis de carrière
    prevClub: (state.favorites || []).filter(pid => !customPlayer() || pid !== customPlayer().id), // v28 : le mercato
  };
  // Prize money de carrière : la saison écoulée rejoint le cumul
  state.players.forEach(p => { keep.careerMoney[p.id] = careerMoneyOf(p.id); });
  // Points à défendre (classement glissant) : les résultats de chaque tournoi
  CALENDAR.forEach(t => {
    const rec = state.tournaments[t.id];
    if (!rec || !rec.recap) return;
    const dmap = {};
    Object.entries(rec.recap.results).forEach(([pid, r]) => { if (r.pts) dmap[pid] = r.pts; });
    keep.defending[t.id] = dmap;
  });
  // Une suspension qui dépasse la fin de saison se purge sur la suivante
  Object.entries(state.suspended || {}).forEach(([pid, u]) => {
    if (u > 12) keep.suspended[pid] = u - 12;
  });
  newSeason(keep.roster); // le plateau retire de nouvelles compétences (les fixes restent fixes)
  state.season = keep.season;
  state.year = keep.year;
  state.career = keep.career;
  state.titles = keep.titles;         // le palmarès est un acquis de carrière
  state.lastSeasonRank = lastRank;    // classements de départ = fin de saison précédente
  state.careerMoney = keep.careerMoney;
  state.defending = keep.defending;   // classement ATP glissant : entrées & têtes de série
  state.suspended = keep.suspended;
  state.xp = keep.xp;                 // v27 : classement / goals / journal conservés
  state.prevClub = keep.prevClub;     // v28 : mercato — 3 recrues à conserver, 1 transfert
  state.bankroll = keep.bankroll;     // solde reporté (peut être négatif : la dette suit)
  state.cash = keep.bankroll;         // le solde bancaire live repart de là
  if (keep.matchSpeed !== undefined) state.matchSpeed = keep.matchSpeed;
  if (keep.cp) addCustomPlayer(keep.cp); // même champion, mêmes compétences (le bonus +3 se répartit ensuite)
  state.pendingUpgrade = !!keep.cp;      // l'écran « +3 points » doit être passé avant les paris
  saveState();
  return state;
}

/* Passages en tête du classement après chaque tournoi (carrière + saison en cours) */
function no1CountsAll() {
  const counts = {};
  Object.entries((state.career && state.career.no1Counts) || {}).forEach(([pid, v]) => {
    counts[pid] = (counts[pid] || 0) + v;
  });
  state.snapshots.forEach(s => {
    const list = s.ranksRolling || s.ranksPts;
    if (list && list.length) counts[list[0]] = (counts[list[0]] || 0) + 1;
  });
  return counts;
}

/* Le champion gagne CHAMPION_SEASON_BONUS points entre deux saisons (répartis par le joueur) */
function improveChampion(newSk) {
  const cp = customPlayer();
  if (!cp) throw new Error("Pas de champion.");
  const oldTotal = SKILL_KEYS.reduce((s, k) => s + cp.sk[k], 0);
  let newTotal = 0;
  SKILL_KEYS.forEach(k => {
    const v = newSk[k];
    if (!Number.isInteger(v) || v < cp.sk[k] || v > 10)
      throw new Error("Répartition invalide : " + k + " doit rester entre " + cp.sk[k] + " et 10.");
    newTotal += v;
  });
  if (newTotal !== oldTotal + CHAMPION_SEASON_BONUS)
    throw new Error("Répartis exactement " + CHAMPION_SEASON_BONUS + " points de progression.");
  cp.sk = Object.assign({}, newSk);
  state.pendingUpgrade = false;
  saveState();
  return cp;
}

/* TON CLUB : ton champion + 4 joueurs recrutés (state.favorites). Tu SUIS leurs
   matchs (joués à la main), eux seuls peuvent être dopés. Recruter le club lance la saison. */
function setFavorites(pids) {
  if (!Array.isArray(pids) || pids.length !== BET_PLAYERS) throw new Error("Il faut ton champion + " + (BET_PLAYERS - 1) + " joueurs de club.");
  if (new Set(pids).size !== pids.length) throw new Error("Favoris en double.");
  pids.forEach(pid => { if (!getPlayer(pid)) throw new Error("Joueur inconnu."); });
  const cp = customPlayer();
  if (cp && !pids.includes(cp.id)) throw new Error("Ton champion est forcément le capitaine de son club.");
  /* v28 — LE MERCATO : à partir de la saison 2, le club conserve exactement
     3 recrues de la saison passée et signe 1 transfert. */
  if (cp && Array.isArray(state.prevClub) && state.prevClub.length) {
    const recruits = pids.filter(pid => pid !== cp.id);
    const kept = recruits.filter(pid => state.prevClub.includes(pid)).length;
    const KEEP = BET_PLAYERS - 2; // 3 conservés
    if (kept !== KEEP)
      throw new Error("Mercato : conserve exactement " + KEEP + " joueurs de la saison passée et signe 1 transfert (" + kept + " conservé" + (kept > 1 ? "s" : "") + ").");
  }
  state.favorites = pids.slice();
  state.betsPlaced = true; // plus de paris de saison : la saison démarre ici
  saveState();
}

/* ---------- Finance : la banque vit toute l'année ----------
   Les 500 000 € de frais de saison sont répartis équitablement sur les
   14 tournois (le dernier absorbe l'arrondi) — la quote-part n'est débitée
   QUE si ton champion est engagé. À CHAQUE fin de tournoi : le prize money
   du champion est crédité net (−40 % de taxes puis −20 % de staff) et la
   part des frais du tournoi est débitée. */
function travelFeeFor(index) {
  const n = CALENDAR.length;
  const base = Math.round(TRAVEL_COST / n);
  return index === n - 1 ? TRAVEL_COST - base * (n - 1) : base;
}
function settleTournamentFinance(rec) {
  const cp = customPlayer();
  const played = !!(cp && rec.entrants.includes(cp.id));
  const r = played ? rec.recap.results[cp.id] : null;
  const prize = r ? Math.round(r.money) : 0;
  const prizeTax = Math.round(prize * PRIZE_TAX_RATE);
  const staff = Math.round((prize - prizeTax) * STAFF_RATE);
  const prizeNet = prize - prizeTax - staff;
  // Pas engagé (non qualifié, suspendu…) : aucune quote-part de frais débitée
  const travel = played ? travelFeeFor(rec.index) : 0;
  state.cash = (state.cash || 0) + prizeNet - travel;
  rec.recap.finance = { prize, prizeTax, staff, prizeNet, travel, delta: prizeNet - travel, absent: !played };
  return rec.recap.finance;
}

/* ---------- Bilan de saison ----------
   La banque étant dynamique (prize net crédité et frais débités tournoi
   par tournoi), il ne reste en fin de saison que l'impôt de 30 % sur un
   solde de paris positif. Le solde final (négatif possible !) est reporté. */
function seasonSettlement() {
  const start = Math.round(state.bankroll || 0);
  const cash = Math.round(state.cash || 0);
  const bs = state.betStats || { staked: 0, returned: 0 };
  const betStaked = Math.round(bs.staked || 0);
  const betReturned = Math.round(bs.returned || 0);
  const betNet = betReturned - betStaked;
  const betTax = betNet > 0 ? Math.round(betNet * TAX_RATE) : 0;
  let prize = 0, prizeTax = 0, staff = 0, prizeNet = 0, travelPaid = 0, travelLeft = 0;
  CALENDAR.forEach((t, i) => {
    const rec = state.tournaments[t.id];
    const f = rec && rec.recap && rec.recap.finance;
    if (f) {
      prize += f.prize; prizeTax += f.prizeTax; staff += f.staff;
      prizeNet += f.prizeNet; travelPaid += f.travel;
    } else if (i >= state.currentIndex) {
      travelLeft += travelFeeFor(i); // projection : quote-parts des tournois à venir (s'il les joue)
    }
  });
  const travel = travelPaid + travelLeft;
  const final = cash - betTax - travelLeft; // projection ; en fin de saison, travelLeft = 0
  return { start, cash, betStaked, betReturned, betNet, betTax,
           prize, prizeTax, staff, prizeNet, travel, travelPaid, travelLeft, final };
}

/* ============================================================
   EXPÉRIENCE & CLASSEMENT FRANÇAIS (v27)
   Ton champion démarre classé 40 et grimpe l'échelle FFT jusqu'à
   −15 en engrangeant de l'XP : victoires, PERFS contre mieux
   classés (les CONTRES coûtent !), goals accomplis, résultats de
   tournois… et la forme de tes partenaires d'entraînement du club.
   ============================================================ */
const CLASSEMENTS_LADDER = ["40", "30/5", "30/4", "30/3", "30/2", "30/1", "30",
  "15/5", "15/4", "15/3", "15/2", "15/1", "15",
  "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6", "-15"];
/* Seuils cumulés : passer l'échelon k coûte 50 + 15k XP (total ≈ 4 515 pour −15) */
const XP_STEPS = (() => {
  const out = [0];
  let c = 0;
  for (let k = 1; k < CLASSEMENTS_LADDER.length; k++) { c += 50 + 15 * k; out.push(c); }
  return out;
})();
const XP_WIN = 6; // XP de base par victoire (les perfs s'y ajoutent)

/* Les GOALS : hauts faits qui rapportent de l'XP (une seule fois chacun) */
const XP_GOALS = [
  { code: "premiere_win", icon: "🎉", xp: 40,  label: "Première victoire sur le circuit" },
  { code: "wins10",       icon: "🔟", xp: 60,  label: "10 victoires en carrière" },
  { code: "wins50",       icon: "⚔️", xp: 150, label: "50 victoires en carrière" },
  { code: "wins100",      icon: "🏛️", xp: 300, label: "100 victoires en carrière" },
  { code: "streak10",     icon: "🔥", xp: 150, label: "10 victoires d'affilée" },
  { code: "surf5_terre",   icon: "🟤", xp: 30,  label: "5 victoires sur terre battue" },
  { code: "surf10_terre",  icon: "🟤", xp: 60,  label: "10 victoires sur terre battue" },
  { code: "surf20_terre",  icon: "🟤", xp: 120, label: "20 victoires sur terre battue" },
  { code: "surf5_gazon",   icon: "🌱", xp: 30,  label: "5 victoires sur gazon" },
  { code: "surf10_gazon",  icon: "🌱", xp: 60,  label: "10 victoires sur gazon" },
  { code: "surf20_gazon",  icon: "🌱", xp: 120, label: "20 victoires sur gazon" },
  { code: "surf5_dur",     icon: "🟦", xp: 30,  label: "5 victoires sur dur" },
  { code: "surf10_dur",    icon: "🟦", xp: 60,  label: "10 victoires sur dur" },
  { code: "surf20_dur",    icon: "🟦", xp: 120, label: "20 victoires sur dur" },
  { code: "surf5_indoor",  icon: "🏟️", xp: 30,  label: "5 victoires en indoor" },
  { code: "surf10_indoor", icon: "🏟️", xp: 60,  label: "10 victoires en indoor" },
  { code: "surf20_indoor", icon: "🏟️", xp: 120, label: "20 victoires en indoor" },
  { code: "mp_comeback",  icon: "🧯", xp: 120, label: "Gagner un match après avoir sauvé une balle de match" },
  { code: "save3mp",      icon: "😱", xp: 150, label: "Sauver 3 balles de match dans un match gagné" },
  { code: "two_sets_down", icon: "🧗", xp: 150, label: "Renverser un match après 2 sets de retard" },
  { code: "marathon5h",   icon: "⏱️", xp: 100, label: "Jouer un match de plus de 5 heures" },
  { code: "aces25",       icon: "🎯", xp: 120, label: "Servir 25 aces dans un match" },
  { code: "aces100",      icon: "💣", xp: 150, label: "Servir 100 aces sur un seul tournoi" },
  { code: "fs90",         icon: "🚀", xp: 100, label: "Plus de 90 % de premières balles sur un match" },
  { code: "beat_no1",     icon: "👑", xp: 200, label: "Battre le n°1 mondial" },
  { code: "bagel",        icon: "🥯", xp: 50,  label: "Infliger un 6-0" },
  { code: "double_bagel", icon: "🍩", xp: 150, label: "Gagner 6-0 6-0" },
  { code: "no_break",     icon: "🧱", xp: 80,  label: "Gagner un match sans jamais perdre son service" },
  { code: "tb3",          icon: "🎲", xp: 100, label: "Gagner 3 tie-breaks dans le même match" },
  { code: "giant3",       icon: "🗡️", xp: 120, label: "Battre 3 têtes de série dans le même tournoi" },
  { code: "first_title",  icon: "🏆", xp: 150, label: "Décrocher son premier titre" },
  { code: "gc_title",     icon: "👑", xp: 300, label: "Gagner un Grand Chelem" },
  { code: "masters_title", icon: "💎", xp: 250, label: "Gagner le Masters" },
  { code: "two_surfaces", icon: "🌍", xp: 150, label: "Des titres sur 2 surfaces différentes" },
  { code: "top10",        icon: "🔝", xp: 200, label: "Entrer dans le top 10 mondial" },
  { code: "world_no1",    icon: "🥇", xp: 400, label: "Devenir n°1 mondial" },
  { code: "streak20",     icon: "🌋", xp: 250, label: "20 victoires d'affilée" },
  { code: "wins200",      icon: "🗿", xp: 400, label: "200 victoires en carrière" },
  { code: "titles5",      icon: "🖐️", xp: 250, label: "5 titres dans la même saison" },
  { code: "all_gc",       icon: "🌏", xp: 400, label: "Gagner les 4 Grands Chelems en carrière" },
  { code: "club_title",   icon: "🎽", xp: 80,  label: "Un joueur de ton club gagne un tournoi" },
  { code: "club_gc",      icon: "🏰", xp: 150, label: "Un joueur de ton club gagne un Grand Chelem" },
  { code: "club_masters", icon: "💠", xp: 120, label: "Un joueur de ton club gagne le Masters" },
  { code: "money1m",      icon: "💰", xp: 80,  label: "1 million d'euros de gains en carrière" },
  { code: "money5m",      icon: "🤑", xp: 150, label: "5 millions d'euros de gains en carrière" },
  { code: "money20m",     icon: "🏦", xp: 300, label: "20 millions d'euros de gains en carrière" },
  { code: "bet_odds10",   icon: "🍀", xp: 80,  label: "Gagner un pari à une cote d'au moins 10" },
  { code: "bet_combo5",   icon: "🎰", xp: 100, label: "Gagner un combiné à une cote d'au moins 5" },
  { code: "bet_100k",     icon: "💸", xp: 120, label: "Encaisser 100 000 € de paris sur une saison" },
];

function freshXp() {
  return { total: 0, wins: 0, winStreak: 0,
    surfWins: { terre: 0, gazon: 0, dur: 0, indoor: 0 },
    goals: {}, log: [] };
}
function xpLevelIdx(total) {
  let i = 0;
  while (i + 1 < XP_STEPS.length && total >= XP_STEPS[i + 1]) i++;
  return i;
}
/* Classement actuel + progression vers le suivant */
function championClassement() {
  const xp = state.xp || freshXp();
  const i = xpLevelIdx(xp.total);
  return {
    idx: i, label: CLASSEMENTS_LADDER[i],
    next: i + 1 < CLASSEMENTS_LADDER.length ? CLASSEMENTS_LADDER[i + 1] : null,
    cur: XP_STEPS[i],
    nextAt: i + 1 < XP_STEPS.length ? XP_STEPS[i + 1] : null,
    total: xp.total,
  };
}
function xpAdd(amount, t, label, tid) {
  if (!state.xp) state.xp = freshXp();
  const before = xpLevelIdx(state.xp.total);
  state.xp.total = Math.max(0, state.xp.total + amount);
  state.xp.log.push({ t, xp: amount, label, tid: tid || null, year: state.year });
  const after = xpLevelIdx(state.xp.total);
  if (after !== before) {
    state.xp.log.push({ t: after > before ? "up" : "down", xp: 0,
      label: (after > before ? "📈 NOUVEAU CLASSEMENT : " : "📉 Reclassement : ") + CLASSEMENTS_LADDER[after],
      tid: tid || null, year: state.year });
  }
  const cp = customPlayer();
  if (cp) cp.classement = CLASSEMENTS_LADDER[after];
}
function xpGoal(code, tid) {
  if (!state.xp) state.xp = freshXp();
  if (state.xp.goals[code]) return false;
  const g = XP_GOALS.find(x => x.code === code);
  if (!g) return false;
  state.xp.goals[code] = { year: state.year, tid: tid || null };
  xpAdd(g.xp, "goal", g.icon + " GOAL : " + g.label, tid);
  return true;
}
function rollingRankOf(pid) {
  return sortedByRolling().findIndex(p => p.id === pid) + 1;
}

/* Après CHAQUE match de ton champion : victoire, perf/contre, goals de match */
function xpAfterChampionMatch(rec, m) {
  const cp = customPlayer();
  if (!cp || (m.p1 !== cp.id && m.p2 !== cp.id) || m.walkover || m.winner === null || !m.score) return;
  if (!state.xp) state.xp = freshXp();
  const t = CALENDAR[rec.index];
  const isP1 = m.p1 === cp.id, k = isP1 ? 0 : 1;
  const won = m.winner === cp.id;
  const opp = isP1 ? m.p2 : m.p1;
  const myRank = rollingRankOf(cp.id), oppRank = rollingRankOf(opp);
  const oppName = getPlayer(opp).name;
  if (won) {
    state.xp.wins++;
    state.xp.winStreak++;
    const sk = SURFACE_TO_SKILL[t.surface];
    state.xp.surfWins[sk]++;
    xpAdd(XP_WIN, "win", "Victoire contre " + oppName, rec.id);
    if (oppRank < myRank) {
      // v29 : la PERF est fonction de l'écart de classement (6 XP + 1 par 3 places, plafond 70)
      const gap = myRank - oppRank;
      const bonus = Math.min(70, 8 + Math.round(gap / 3));
      xpAdd(bonus, "perf", "🔥 PERF ! " + oppName + " (n°" + oppRank + ") tombe alors que tu es n°" + myRank + " — écart de " + gap + " places", rec.id);
    }
    xpGoal("premiere_win", rec.id);
    if (state.xp.wins >= 10) xpGoal("wins10", rec.id);
    if (state.xp.wins >= 50) xpGoal("wins50", rec.id);
    if (state.xp.wins >= 100) xpGoal("wins100", rec.id);
    if (state.xp.wins >= 200) xpGoal("wins200", rec.id);
    if (state.xp.winStreak >= 10) xpGoal("streak10", rec.id);
    if (state.xp.winStreak >= 20) xpGoal("streak20", rec.id);
    if (state.xp.surfWins[sk] >= 5) xpGoal("surf5_" + sk, rec.id);
    if (state.xp.surfWins[sk] >= 10) xpGoal("surf10_" + sk, rec.id);
    if (state.xp.surfWins[sk] >= 20) xpGoal("surf20_" + sk, rec.id);
    if (oppRank === 1) xpGoal("beat_no1", rec.id);
    const st = m.stats;
    if (st) {
      if (st.mpComeback && st.mpComeback[k]) xpGoal("mp_comeback", rec.id);
      if (st.mpSaved[k] >= 3) xpGoal("save3mp", rec.id);
      if (st.aces[k] >= 25) xpGoal("aces25", rec.id);
      if (st.mins > 300) xpGoal("marathon5h", rec.id);
      if (st.fs[k][1] >= 40 && st.fs[k][0] / st.fs[k][1] > 0.9) xpGoal("fs90", rec.id);
    }
    // Renverser 2 sets de retard (Grand Chelem)
    if (m.score.length === 5 && m.score.slice(0, 2).every(s => (isP1 ? s[0] < s[1] : s[1] < s[0])))
      xpGoal("two_sets_down", rec.id);
    // 6-0 infligé / double bagel
    const bagels = m.score.filter(s => (isP1 ? s[0] === 6 && s[1] === 0 : s[1] === 6 && s[0] === 0)).length;
    if (bagels >= 1) xpGoal("bagel", rec.id);
    if (bagels >= 2 && m.score.length === 2) xpGoal("double_bagel", rec.id);
    // Sans perdre son service (aucun break subi)
    if (m.bp) {
      const theirs = isP1 ? m.bp[1] : m.bp[0];
      if (theirs[0] === 0) xpGoal("no_break", rec.id);
    }
    // 3 tie-breaks gagnés dans le même match
    if (m.tiebreaks) {
      let tbWon = 0;
      Object.keys(m.tiebreaks).forEach(si => {
        const s = m.score[si];
        if (s && (isP1 ? s[0] > s[1] : s[1] > s[0])) tbWon++;
      });
      if (tbWon >= 3) xpGoal("tb3", rec.id);
    }
  } else {
    state.xp.winStreak = 0;
    if (oppRank > myRank) {
      // v29 : le CONTRE est fonction de l'écart de classement (4 XP + 1 par 5 places, plafond 35)
      const gap = oppRank - myRank;
      const malus = Math.min(35, 4 + Math.round(gap / 5));
      xpAdd(-malus, "contre", "❄️ CONTRE : battu par " + oppName + " (n°" + oppRank + ") alors que tu es n°" + myRank + " — écart de " + gap + " places", rec.id);
    }
  }
}

/* À CHAQUE fin de tournoi : bonus de résultat, goals de tournoi, partenaires du club */
function xpAfterTournament(rec) {
  const cp = customPlayer();
  if (!cp) return;
  if (!state.xp) state.xp = freshXp();
  const t = CALENDAR[rec.index];
  const r = rec.recap.results[cp.id];
  if (r) {
    const bonus = r.round === "W" ? (t.cat === "GC" ? 180 : t.cat === "FINALS" ? 150 : 110)
      : r.round === "F" ? (t.cat === "GC" ? 70 : t.cat === "FINALS" ? 60 : 50)
      : r.round === "SF" ? (t.cat === "GC" ? 35 : t.cat === "FINALS" ? 30 : 25) : 0;
    if (bonus) xpAdd(bonus, "res", "🏁 " + t.name + " : " +
      (r.round === "W" ? "TITRE !" : r.round === "F" ? "finale" : "demi-finale"), rec.id);
    if (r.round === "W") {
      xpGoal("first_title", rec.id);
      if (t.cat === "GC") xpGoal("gc_title", rec.id);
      if (t.cat === "FINALS") xpGoal("masters_title", rec.id);
      const surfTitles = new Set((state.titles[cp.id] || [])
        .map(tid => (CALENDAR.find(c => c.id === tid) || {}).surface));
      if (surfTitles.size >= 2) xpGoal("two_surfaces", rec.id);
      // v29 : 5 titres dans la même saison
      const seasonTitles = CALENDAR.filter(c => {
        const r2 = state.tournaments[c.id];
        return r2 && r2.recap && r2.recap.champion === cp.id;
      }).length;
      if (seasonTitles >= 5) xpGoal("titles5", rec.id);
      // v29 : les 4 Grands Chelems en carrière
      const gcIds = CALENDAR.filter(c => c.cat === "GC").map(c => c.id);
      const won = new Set(state.titles[cp.id] || []);
      if (gcIds.every(id => won.has(id))) xpGoal("all_gc", rec.id);
    }
    // Goals à l'échelle du tournoi : 100 aces, 3 têtes de série battues
    let acesT = 0, seedKills = 0;
    allMatchesReal(rec).forEach(m => {
      if (!m || m.walkover || m.winner === null || (m.p1 !== cp.id && m.p2 !== cp.id)) return;
      const k = m.p1 === cp.id ? 0 : 1;
      if (m.stats) acesT += m.stats.aces[k];
      const opp = m.p1 === cp.id ? m.p2 : m.p1;
      if (m.winner === cp.id && rec.seedsMap && rec.seedsMap[opp]) seedKills++;
    });
    if (acesT >= 100) xpGoal("aces100", rec.id);
    if (seedKills >= 3) xpGoal("giant3", rec.id);
  }
  // Tes partenaires d'entraînement : leurs résultats font bouger TON niveau
  (state.favorites || []).filter(pid => pid !== cp.id).forEach(pid => {
    const rr = rec.recap.results[pid];
    if (!rr) return;
    const p = getPlayer(pid);
    if (rr.round === "W") {
      xpAdd(t.cat === "GC" ? 20 : 15, "club", "🎾 " + p.name + " gagne " + t.city + " — l'entraînement avec lui paie !", rec.id);
      xpGoal("club_title", rec.id);
      if (t.cat === "GC") xpGoal("club_gc", rec.id);
      if (t.cat === "FINALS") xpGoal("club_masters", rec.id);
    }
    else if (rr.round === "F") xpAdd(10, "club", "🎾 " + p.name + " en finale à " + t.city + " — le club rayonne", rec.id);
    else if (rr.round === "SF") xpAdd(6, "club", "🎾 " + p.name + " en demie à " + t.city, rec.id);
    else {
      const firstOut = rec.type === "bracket" ? rr.round === rec.roundsNames[0] : (rr.round === "RR" && (rr.rrWins || 0) === 0);
      if (firstOut) xpAdd(-3, "club", "💤 " + p.name + " sorti d'entrée à " + t.city + " — entraînement morose", rec.id);
    }
  });
  // Jalons mondiaux
  const myRank = rollingRankOf(cp.id);
  if (myRank <= 10) xpGoal("top10", rec.id);
  if (myRank === 1) xpGoal("world_no1", rec.id);
  // v29 : gains de carrière
  const cm = careerMoneyOf(cp.id);
  if (cm >= 1e6) xpGoal("money1m", rec.id);
  if (cm >= 5e6) xpGoal("money5m", rec.id);
  if (cm >= 20e6) xpGoal("money20m", rec.id);
  // v29 : exploits de parieur
  (state.tbets || []).forEach(b => {
    if (b.status !== "won") return;
    if (b.odds >= 10) xpGoal("bet_odds10", rec.id);
    if (b.legs && b.legs.length >= 2 && b.odds >= 5) xpGoal("bet_combo5", rec.id);
  });
  if (state.betStats && state.betStats.returned >= 100000) xpGoal("bet_100k", rec.id);
}

/* ============================================================
   FORME (entraîné / frais / fatigué / cramé) & DOPAGE
   ============================================================ */
function fatigueOf(pid) { return (state.fatigue && state.fatigue[pid]) || 0; }
function isSuspended(pid, t) {
  const until = state.suspended && state.suspended[pid];
  return until !== undefined && until !== null && t.month < until;
}
function formStatus(pid, rec) {
  if (rec && rec.doped === pid) return "dope";
  if (state.trained && state.trained[pid]) return "entraine";
  const f = fatigueOf(pid);
  if (f >= FATIGUE_BURNT) return "crame";
  if (f >= FATIGUE_TIRED) return "fatigue";
  return "frais";
}
function formMod(pid, rec) {
  const st = formStatus(pid, rec);
  if (st === "dope") return DOPE_BONUS;      // et insensible à la fatigue
  if (st === "entraine") return MOD_TRAINED;
  if (st === "crame") return MOD_BURNT;
  if (st === "fatigue") return MOD_TIRED;
  return 0;
}
/* La fatigue gagnée dépend de la longueur du match et de l'Endurance
   (formule adoucie en v15 : on crame beaucoup moins vite) */
function fatigueGainFor(games, endurance) {
  return Math.max(0, games * 0.06 * (14 - endurance) / 8);
}
function fatigueGain(pid, games) {
  return fatigueGainFor(games, getPlayer(pid).sk.endurance);
}
function addFatigue(pid, games) {
  state.fatigue[pid] = fatigueOf(pid) + fatigueGain(pid, games);
}
/* Entre deux tournois : récupération, ou « entraîné » si le précédent n'a pas été joué */
function beginTournamentForms(index) {
  if (!state.fatigue) state.fatigue = {};
  if (!state.trained) state.trained = {};
  if (index === 0) {
    state.players.forEach(p => { state.fatigue[p.id] = 0; state.trained[p.id] = false; });
    return;
  }
  const prev = state.tournaments[CALENDAR[index - 1].id];
  const played = new Set(prev ? prev.entrants : []);
  state.players.forEach(p => {
    if (played.has(p.id)) {
      state.fatigue[p.id] = Math.max(0, fatigueOf(p.id) - FATIGUE_RECOVERY);
      state.trained[p.id] = false;
    } else {
      state.fatigue[p.id] = 0;
      state.trained[p.id] = true;
    }
  });
}

/* Dopage : booste TON CHAMPION (et lui seul) pour le tournoi à venir.
   La dose coûte DOPE_COST € — débitée en direct, pas de solde = pas de dopage. */
function applyDoping(tourneyId, pid) {
  const rec = state.tournaments[tourneyId];
  if (!rec || rec.status !== "active") throw new Error("Tournoi introuvable.");
  if (marketsClosed(rec)) throw new Error("Trop tard : le tournoi a commencé.");
  if ((state.syringes || 0) <= 0) throw new Error("Plus de seringues cette saison.");
  if ((state.cash || 0) < DOPE_COST) throw new Error("La dose coûte " + fmtEuro(DOPE_COST) + " — il te manque du cash.");
  const cpD = customPlayer();
  if (!cpD || pid !== cpD.id) throw new Error("Seul ton champion peut être dopé.");
  if (!rec.entrants.includes(pid)) throw new Error("Ce joueur n'est pas au tableau.");
  if (rec.doped !== undefined && rec.doped !== null) throw new Error("Un seul joueur dopé par tournoi.");
  rec.doped = pid;
  state.syringes--;
  state.cash -= DOPE_COST;
  saveState();
  return rec;
}

/* ============================================================
   PARIS DE MATCH & DE TOUR (v22)
   Avant chaque tour : paris « vainqueur » sur tous les matchs du
   tour (sauf ceux de ton champion), combinables. Avant chaque
   match : marchés classiques (1/2, score exact, plus/moins de
   jeux, handicap jeux, tie-break). Cotes simulées, règlement
   INSTANTANÉ dès la fin du match : le solde bancaire vit en direct.
   ============================================================ */

/* Référence d'un match : {k:"b",r,i} tableau | {k:"rr",g,i} poule | {k:"sf",i} | {k:"f"} */
function matchByRef(rec, ref) {
  if (!ref) return null;
  if (ref.k === "b") return (rec.rounds[ref.r] && rec.rounds[ref.r][ref.i]) || null;
  if (ref.k === "rr") return (rec.rr && rec.rr[ref.g] && rec.rr[ref.g][ref.i]) || null;
  if (ref.k === "sf") return (rec.sf && rec.sf[ref.i]) || null;
  if (ref.k === "f") return rec.final || null;
  return null;
}
function refKey(ref) {
  if (ref.k === "b") return "b:" + ref.r + ":" + ref.i;
  if (ref.k === "rr") return "rr:" + ref.g + ":" + ref.i;
  if (ref.k === "sf") return "sf:" + ref.i;
  return "f";
}

/* Les matchs du tour (ou de la phase) en cours */
function listRoundMatches(rec) {
  const out = [];
  if (rec.type === "bracket") {
    const r = rec.currentRound;
    rec.rounds[r].forEach((m, i) => out.push({ ref: { k: "b", r, i }, m }));
  } else if (rec.phase === "rr") {
    ["A", "B"].forEach(g => rec.rr[g].forEach((m, i) => out.push({ ref: { k: "rr", g, i }, m })));
  } else if (rec.phase === "sf") {
    rec.sf.forEach((m, i) => out.push({ ref: { k: "sf", i }, m }));
  } else if (rec.phase === "final") {
    out.push({ ref: { k: "f" }, m: rec.final });
  }
  return out;
}

/* Le bookmaker connaît la forme (fatigue, entraînement)… mais pas le dopage ! */
function bookmakerMod(pid) {
  if (state.trained && state.trained[pid]) return MOD_TRAINED;
  const f = fatigueOf(pid);
  if (f >= FATIGUE_BURNT) return MOD_BURNT;
  if (f >= FATIGUE_TIRED) return MOD_TIRED;
  return 0;
}

/* Match point par point ALLÉGÉ pour coter les marchés : mêmes lois que le
   vrai moteur (1res balles, aces, doubles fautes, tie-breaks) sans le suivi
   des stats annexes — et optimisé (décomposition du service par JEU, pas
   par point). Sert aux cotes de match ET de tournoi. */
function leanPointMatch(skA, skB, surfKey, bestOf, modA, modB) {
  const setsToWin = Math.ceil(bestOf / 2);
  const model = matchProbModel(skA, skB, surfKey, modA, modB);
  const sets = [];
  const aces = [0, 0], df = [0, 0];
  let held = 0, svTotal = 0, totalGames = 0;
  let setsA = 0, setsB = 0;
  let serverIsA = rnd() < 0.5;
  let hadTB = false;
  // Constantes de service par côté (ne dépendent que de la compétence Service)
  const fS = [clamp(0.62 + 0.012 * (skA.service - 5.5), 0.45, 0.80),
              clamp(0.62 + 0.012 * (skB.service - 5.5), 0.45, 0.80)];
  const aceS = [clamp(0.10 + 0.03 * (skA.service - 5.5), 0.02, 0.40),
                clamp(0.10 + 0.03 * (skB.service - 5.5), 0.02, 0.40)];
  const dfS = [clamp(0.10 - 0.008 * (skA.service - 5.5), 0.03, 0.18),
               clamp(0.10 - 0.008 * (skB.service - 5.5), 0.03, 0.18)];
  let d1 = 0, d2 = 0; // décomposition courante : p1 (1re balle) et p2 / (1 − dfP)
  function decompose(pWin, side) {
    const f = fS[side];
    let p1 = pWin + 0.10;
    if (p1 > 0.97) p1 = 0.97; else if (p1 < 0.03) p1 = 0.03;
    let p2 = (pWin - f * p1) / (1 - f);
    if (p2 < 0.03) { p2 = 0.03; p1 = clamp((pWin - (1 - f) * p2) / f, 0.02, 0.98); }
    d1 = p1;
    d2 = Math.min(1, p2 / (1 - dfS[side]));
  }
  function servePoint(side) {
    if (rnd() < fS[side]) {
      if (rnd() < d1) {
        if (rnd() < aceS[side]) aces[side]++;
        return true;
      }
      return false;
    }
    if (rnd() < dfS[side]) { df[side]++; return false; }
    return rnd() < d2;
  }
  while (setsA < setsToWin && setsB < setsToWin) {
    const isDecider = setsA === setsToWin - 1 && setsB === setsToWin - 1;
    let gA = 0, gB = 0;
    while (true) {
      const side = serverIsA ? 0 : 1;
      decompose(pointProbFromGame(model.game(serverIsA, isDecider, totalGames)), side);
      let ptS = 0, ptR = 0;
      while (!((ptS >= 4 || ptR >= 4) && Math.abs(ptS - ptR) >= 2)) {
        if (servePoint(side)) ptS++; else ptR++;
      }
      const serverWon = ptS > ptR;
      if (serverIsA ? serverWon : !serverWon) gA++; else gB++;
      totalGames++;
      svTotal++; if (serverWon) held++;
      serverIsA = !serverIsA;
      if ((gA >= 6 || gB >= 6) && Math.abs(gA - gB) >= 2) break;
      if (gA === 6 && gB === 6) {
        hadTB = true;
        const target = (isDecider && bestOf === 5) ? 10 : 7;
        let ta = 0, tbb = 0, tbServerA = serverIsA, first = true, pair = 0;
        while (!((ta >= target || tbb >= target) && Math.abs(ta - tbb) >= 2)) {
          const sSide = tbServerA ? 0 : 1;
          decompose(model.tbPoint(tbServerA, isDecider, totalGames), sSide);
          const sw = servePoint(sSide);
          if (tbServerA ? sw : !sw) ta++; else tbb++;
          if (first) { tbServerA = !tbServerA; first = false; pair = 0; }
          else { pair++; if (pair === 2) { tbServerA = !tbServerA; pair = 0; } }
        }
        if (ta > tbb) gA++; else gB++;
        totalGames++;
        serverIsA = !serverIsA;
        break;
      }
    }
    sets.push([gA, gB]);
    if (gA > gB) setsA++; else setsB++;
  }
  return { winA: setsA > setsB, sets, aces, df, held, svTotal, games: totalGames, tb: hadTB };
}

/* Marchés classiques d'un match, cotés par MATCH_MK_SIMS simulations
   point par point (aces et doubles fautes suivent les lois du vrai moteur) */
function buildMatchMarkets(rec, m) {
  const t = CALENDAR[rec.index];
  const surfKey = SURFACE_TO_SKILL[t.surface];
  const N = MATCH_MK_SIMS;
  const pA = getPlayer(m.p1), pB = getPlayer(m.p2);
  const mA = bookmakerMod(m.p1), mB = bookmakerMod(m.p2);
  const setsToWin = Math.ceil(t.bestOf / 2);
  let winA = 0, s1A = 0, tbYes = 0;
  const scoreCount = {};   // "pid:setsGagnés-setsPerdus" du vainqueur
  const gamesList = [];    // total de jeux du match
  const margins = [];      // écart de jeux en faveur de p1
  const acesL = [[], []], dfL = [[], []]; // aces / doubles fautes par joueur
  for (let s = 0; s < N; s++) {
    const core = leanPointMatch(pA.sk, pB.sk, surfKey, t.bestOf, mA, mB);
    if (core.winA) winA++;
    if (core.sets[0][0] > core.sets[0][1]) s1A++;
    let g1 = 0, g2 = 0, s1 = 0;
    core.sets.forEach(x => { g1 += x[0]; g2 += x[1]; if (x[0] > x[1]) s1++; });
    const s2 = core.sets.length - s1;
    const key = core.winA ? m.p1 + ":" + s1 + "-" + s2 : m.p2 + ":" + s2 + "-" + s1;
    scoreCount[key] = (scoreCount[key] || 0) + 1;
    gamesList.push(g1 + g2);
    margins.push(g1 - g2);
    if (core.tb) tbYes++;
    acesL[0].push(core.aces[0]); acesL[1].push(core.aces[1]);
    dfL[0].push(core.df[0]); dfL[1].push(core.df[1]);
  }
  /* 1/2 — vainqueur du match */
  const winner = [
    { pid: m.p1, odds: oddsFromCount(winA, N) },
    { pid: m.p2, odds: oddsFromCount(N - winA, N) },
  ];
  /* Score exact (en sets) */
  const score = [];
  [m.p1, m.p2].forEach(pid => {
    for (let l = 0; l < setsToWin; l++)
      score.push({ pid, sw: setsToWin, sl: l, odds: oddsFromCount(scoreCount[pid + ":" + setsToWin + "-" + l] || 0, N) });
  });
  /* Plus/moins de jeux (ligne = médiane + 0,5) */
  const sg = gamesList.slice().sort((a, b) => a - b);
  const ouLine = sg[Math.floor(N / 2)] + 0.5;
  const overN = gamesList.filter(g => g > ouLine).length;
  const ou = { line: ouLine, over: oddsFromCount(overN, N), under: oddsFromCount(N - overN, N) };
  /* Handicap jeux : favori −L,5 / outsider +L,5 (ligne = écart médian) */
  const favIsA = winA * 2 >= N;
  const fm = margins.map(x => (favIsA ? x : -x)).sort((a, b) => a - b);
  const hLine = Math.max(1.5, Math.floor(fm[Math.floor(N / 2)]) + 0.5);
  const covers = fm.filter(x => x > hLine).length;
  const hcp = {
    favPid: favIsA ? m.p1 : m.p2, dogPid: favIsA ? m.p2 : m.p1, line: hLine,
    fav: oddsFromCount(covers, N), dog: oddsFromCount(N - covers, N),
  };
  /* Au moins un tie-break ? */
  const tb = { yes: oddsFromCount(tbYes, N), no: oddsFromCount(N - tbYes, N) };
  /* Vainqueur du 1er set */
  const set1 = [
    { pid: m.p1, odds: oddsFromCount(s1A, N) },
    { pid: m.p2, odds: oddsFromCount(N - s1A, N) },
  ];
  /* Plus/moins par joueur : aces et doubles fautes (ligne = médiane + 0,5) */
  const ouOf = list => {
    const s = list.slice().sort((a, b) => a - b);
    const line = s[Math.floor(list.length / 2)] + 0.5;
    const over = list.filter(x => x > line).length;
    return { line, over: oddsFromCount(over, list.length), under: oddsFromCount(list.length - over, list.length) };
  };
  const pAces = [m.p1, m.p2].map((pid, i) => Object.assign({ pid }, ouOf(acesL[i])));
  const pDf = [m.p1, m.p2].map((pid, i) => Object.assign({ pid }, ouOf(dfL[i])));
  return { winner, set1, score, ou, hcp, tb, pAces, pDf };
}

/* Cache des marchés du tour en cours (recalculés à chaque nouveau tour).
   Les matchs de ton champion n'ont PAS de cote : on ne parie pas sur soi-même. */
function roundKeyOf(rec) {
  return rec.type === "bracket" ? "b" + rec.currentRound : rec.phase;
}
function ensureRoundMarkets(rec) {
  const key = roundKeyOf(rec);
  if (rec.roundMk && rec.roundMk.key === key && !rec.roundMk.partial) return rec.roundMk;
  if (!rec.roundMk || rec.roundMk.key !== key) rec.roundMk = { key, byKey: {} };
  const cp = customPlayer();
  listRoundMatches(rec).forEach(({ ref, m }) => {
    const k = refKey(ref);
    if (rec.roundMk.byKey[k]) return;
    if (m.winner !== null || m.walkover || m.p1 === null || m.p2 === null) return;
    if (cp && (m.p1 === cp.id || m.p2 === cp.id)) return;
    rec.roundMk.byKey[k] = { ref, mk: buildMatchMarkets(rec, m) };
  });
  rec.roundMk.partial = false;
  saveState();
  return rec.roundMk;
}

/* Cote UN SEUL match à la demande (fenêtre de match) — instantané */
function ensureMatchMarket(rec, ref) {
  const key = roundKeyOf(rec);
  if (!rec.roundMk || rec.roundMk.key !== key) rec.roundMk = { key, byKey: {}, partial: true };
  const k = refKey(ref);
  if (rec.roundMk.byKey[k]) return rec.roundMk.byKey[k];
  const m = matchByRef(rec, ref);
  if (!m || m.winner !== null || m.walkover || m.p1 === null || m.p2 === null) return null;
  const cp = customPlayer();
  if (cp && (m.p1 === cp.id || m.p2 === cp.id)) return null;
  rec.roundMk.byKey[k] = { ref, mk: buildMatchMarkets(rec, m) };
  saveState();
  return rec.roundMk.byKey[k];
}

/* Paris de TOUR : uniquement des vainqueurs, sur autant de matchs que voulu.
   combo=true : UN pari combiné (cotes multipliées, une seule mise) ;
   combo=false : un pari simple par sélection (la mise s'applique à chacune). */
function placeRoundBets(tourneyId, picks, stake, combo) {
  const rec = state.tournaments[tourneyId];
  if (!rec || rec.status !== "active") throw new Error("Tournoi introuvable.");
  if (!Array.isArray(picks) || picks.length === 0) throw new Error("Aucune sélection.");
  if (combo && picks.length < 2) throw new Error("Un combiné demande au moins 2 sélections.");
  stake = Math.round(Number(stake) || 0);
  if (stake < TBET_MIN) throw new Error("Mise minimale : " + fmtEuro(TBET_MIN) + ".");
  const mkRound = ensureRoundMarkets(rec);
  const cp = customPlayer();
  const seen = new Set();
  const legs = picks.map(p => {
    const key = refKey(p.ref);
    if (seen.has(key)) throw new Error("Une seule sélection par match.");
    seen.add(key);
    const m = matchByRef(rec, p.ref);
    if (!m || m.p1 === null || m.p2 === null) throw new Error("Match introuvable.");
    if (m.winner !== null || m.walkover) throw new Error("Ce match est déjà joué.");
    if (cp && (m.p1 === cp.id || m.p2 === cp.id)) throw new Error("Impossible de parier sur ton propre match.");
    const entry = mkRound.byKey[key];
    if (!entry) throw new Error("Pas de cote pour ce match.");
    const o = entry.mk.winner.find(w => w.pid === p.pid);
    if (!o) throw new Error("Sélection inconnue.");
    const other = m.p1 === p.pid ? m.p2 : m.p1;
    return { ref: p.ref, market: "winner", pid: p.pid, odds: o.odds,
             label: getPlayer(p.pid).name + " bat " + getPlayer(other).name };
  });
  const total = combo ? stake : stake * legs.length;
  if (total > (state.cash || 0)) throw new Error("Cash insuffisant : il faut " + fmtEuro(total) + ".");
  const roundLbl = rec.type === "bracket"
    ? roundShortLabel(rec.roundsNames[rec.currentRound], CALENDAR[rec.index].drawSize)
    : ({ rr: "Poules", sf: "Demies", final: "Finale" })[rec.phase];
  const out = [];
  if (combo) {
    const odds = Math.round(legs.reduce((o, l) => o * l.odds, 1) * 100) / 100;
    state.cash -= stake;
    state.betStats.staked += stake;
    const bet = { id: state.tbetSeq++, tourneyId, kind: "round", combo: true, legs,
      odds, stake, label: "Combiné × " + legs.length + " — " + roundLbl,
      year: state.year, status: "open", payout: 0 };
    state.tbets.push(bet);
    out.push(bet);
  } else {
    legs.forEach(leg => {
      state.cash -= stake;
      state.betStats.staked += stake;
      const bet = { id: state.tbetSeq++, tourneyId, kind: "round", combo: false, legs: [leg],
        odds: leg.odds, stake, label: leg.label, year: state.year, status: "open", payout: 0 };
      state.tbets.push(bet);
      out.push(bet);
    });
  }
  saveState();
  return out;
}

/* Paris de MATCH : marchés classiques sur un match précis (avant qu'il se joue) */
function placeMatchBet(tourneyId, ref, market, pick, stake) {
  const rec = state.tournaments[tourneyId];
  if (!rec || rec.status !== "active") throw new Error("Tournoi introuvable.");
  stake = Math.round(Number(stake) || 0);
  if (stake < TBET_MIN) throw new Error("Mise minimale : " + fmtEuro(TBET_MIN) + ".");
  if (stake > (state.cash || 0)) throw new Error("Cash insuffisant.");
  const m = matchByRef(rec, ref);
  if (!m || m.p1 === null || m.p2 === null) throw new Error("Match introuvable.");
  if (m.winner !== null || m.walkover) throw new Error("Ce match est déjà joué.");
  const cp = customPlayer();
  if (cp && (m.p1 === cp.id || m.p2 === cp.id)) throw new Error("Impossible de parier sur ton propre match.");
  const entry = ensureMatchMarket(rec, ref);
  if (!entry) throw new Error("Pas de cote pour ce match.");
  const mk = entry.mk;
  const marketKey = rec.id + "|" + refKey(ref) + "|" + market +
    ((market === "pace" || market === "pdf") ? ":" + String(pick).split(":")[0] : "");
  if ((state.tbets || []).some(b => b.marketKey === marketKey))
    throw new Error("Tu as déjà misé sur ce marché.");
  const frNum = x => String(x).replace(".", ",");
  let leg;
  if (market === "winner") {
    const o = mk.winner.find(w => w.pid === pick);
    if (!o) throw new Error("Sélection inconnue.");
    leg = { ref, market, pid: pick, odds: o.odds, label: "Vainqueur : " + getPlayer(pick).name };
  } else if (market === "score") {
    const o = mk.score.find(x => x.pid + ":" + x.sw + "-" + x.sl === String(pick));
    if (!o) throw new Error("Sélection inconnue.");
    leg = { ref, market, pid: o.pid, sw: o.sw, sl: o.sl, odds: o.odds,
            label: "Score exact : " + getPlayer(o.pid).name + " " + o.sw + "-" + o.sl };
  } else if (market === "ou") {
    if (pick !== "over" && pick !== "under") throw new Error("Sélection inconnue.");
    leg = { ref, market, pick, line: mk.ou.line, odds: mk.ou[pick],
            label: (pick === "over" ? "Plus" : "Moins") + " de " + frNum(mk.ou.line) + " jeux" };
  } else if (market === "hcp") {
    if (pick !== "fav" && pick !== "dog") throw new Error("Sélection inconnue.");
    leg = { ref, market, pick, favPid: mk.hcp.favPid, line: mk.hcp.line, odds: mk.hcp[pick],
            label: pick === "fav"
              ? getPlayer(mk.hcp.favPid).name + " −" + frNum(mk.hcp.line) + " jeux"
              : getPlayer(mk.hcp.dogPid).name + " +" + frNum(mk.hcp.line) + " jeux" };
  } else if (market === "tb") {
    if (pick !== "yes" && pick !== "no") throw new Error("Sélection inconnue.");
    leg = { ref, market, pick, odds: mk.tb[pick],
            label: pick === "yes" ? "Au moins un tie-break" : "Aucun tie-break" };
  } else if (market === "set1") {
    const o = mk.set1.find(w => w.pid === pick);
    if (!o) throw new Error("Sélection inconnue.");
    leg = { ref, market, pid: pick, odds: o.odds, label: "Vainqueur du 1er set : " + getPlayer(pick).name };
  } else if (market === "pace" || market === "pdf") {
    // pick = "pid:over" ou "pid:under"
    const parts = String(pick).split(":");
    const pid = parseInt(parts[0], 10), side = parts[1];
    const arr = market === "pace" ? mk.pAces : mk.pDf;
    const o = arr.find(x => x.pid === pid);
    if (!o || (side !== "over" && side !== "under")) throw new Error("Sélection inconnue.");
    leg = { ref, market, pid, pick: side, line: o.line, odds: o[side],
            label: (market === "pace" ? "Aces" : "Doubles fautes") + " de " + getPlayer(pid).name +
              " : " + (side === "over" ? "plus" : "moins") + " de " + frNum(o.line) };
  } else throw new Error("Marché inconnu.");
  state.cash -= stake;
  state.betStats.staked += stake;
  const bet = { id: state.tbetSeq++, tourneyId, kind: "match", marketKey,
    match: getPlayer(m.p1).name + " – " + getPlayer(m.p2).name,
    legs: [leg], odds: leg.odds, stake, label: leg.label,
    year: state.year, status: "open", payout: 0 };
  state.tbets.push(bet);
  saveState();
  return bet;
}

/* Sort d'une sélection : open / won / lost / void (walkover = remboursé) */
function legOutcome(rec, leg) {
  const m = matchByRef(rec, leg.ref);
  if (!m) return "void";
  if (m.walkover) return "void";
  if (m.winner === null || !m.score) return "open";
  const s1 = m.score.filter(x => x[0] > x[1]).length;
  const s2 = m.score.length - s1;
  const g1 = m.score.reduce((s, x) => s + x[0], 0);
  const g2 = m.score.reduce((s, x) => s + x[1], 0);
  if (leg.market === "winner") return m.winner === leg.pid ? "won" : "lost";
  if (leg.market === "score") {
    const sw = leg.pid === m.p1 ? s1 : s2, sl = leg.pid === m.p1 ? s2 : s1;
    return (m.winner === leg.pid && sw === leg.sw && sl === leg.sl) ? "won" : "lost";
  }
  if (leg.market === "ou") {
    const g = g1 + g2;
    return (leg.pick === "over" ? g > leg.line : g < leg.line) ? "won" : "lost";
  }
  if (leg.market === "hcp") {
    const margin = leg.favPid === m.p1 ? g1 - g2 : g2 - g1;
    return (leg.pick === "fav" ? margin > leg.line : margin < leg.line) ? "won" : "lost";
  }
  if (leg.market === "tb") {
    const has = m.score.some(x => x[0] + x[1] >= 13);
    return ((leg.pick === "yes") === has) ? "won" : "lost";
  }
  if (leg.market === "set1") {
    return ((m.score[0][0] > m.score[0][1] ? m.p1 : m.p2) === leg.pid) ? "won" : "lost";
  }
  if (leg.market === "pace" || leg.market === "pdf") {
    if (!m.stats) return "void";
    const idx = leg.pid === m.p1 ? 0 : 1;
    const v = (leg.market === "pace" ? m.stats.aces : m.stats.df)[idx];
    return (leg.pick === "over" ? v > leg.line : v < leg.line) ? "won" : "lost";
  }
  return "void";
}

/* Le fait réel qui justifie le paiement (ou non) d'une sélection */
function legResultText(rec, leg) {
  const m = matchByRef(rec, leg.ref);
  if (!m) return "";
  if (m.walkover) return "walkover — mise remboursée";
  if (m.winner === null || !m.score) return "";
  const w = getPlayer(m.winner), l = getPlayer(m.winner === m.p1 ? m.p2 : m.p1);
  let txt = w.name + " bat " + l.name + " " + formatScore(m, true);
  if (leg.market === "ou") {
    const g = m.score.reduce((s, x) => s + x[0] + x[1], 0);
    txt += " (" + g + " jeux)";
  } else if (leg.market === "hcp") {
    const g1 = m.score.reduce((s, x) => s + x[0], 0);
    const g2 = m.score.reduce((s, x) => s + x[1], 0);
    const margin = leg.favPid === m.p1 ? g1 - g2 : g2 - g1;
    txt += " (écart " + (margin > 0 ? "+" : "") + margin + ")";
  } else if (leg.market === "set1") {
    const s1 = m.score[0];
    txt += " (1er set " + (s1[0] > s1[1] ? getPlayer(m.p1).name : getPlayer(m.p2).name) + " " + Math.max(s1[0], s1[1]) + "-" + Math.min(s1[0], s1[1]) + ")";
  } else if ((leg.market === "pace" || leg.market === "pdf") && m.stats) {
    const idx = leg.pid === m.p1 ? 0 : 1;
    const v = (leg.market === "pace" ? m.stats.aces : m.stats.df)[idx];
    txt += " (" + v + " " + (leg.market === "pace" ? "ace" + (v > 1 ? "s" : "") : "double" + (v > 1 ? "s" : "") + " faute" + (v > 1 ? "s" : "")) + " de " + getPlayer(leg.pid).name + ")";
  }
  return txt;
}

/* Règlement INSTANTANÉ des paris de match et de tour : appelé après chaque
   match joué. Perdu dès qu'une sélection tombe ; payé dès que tout est décidé. */
function resolveOpenMatchBets(rec) {
  const open = (state.tbets || []).filter(b =>
    b.tourneyId === rec.id && b.status === "open" && (b.kind === "round" || b.kind === "match"));
  const settled = [];
  open.forEach(b => {
    const outs = b.legs.map(leg => legOutcome(rec, leg));
    if (outs.some(o => o === "lost")) {
      b.status = "lost";
      b.result = b.legs.map(leg => legResultText(rec, leg)).filter(Boolean).join(" · ");
      settled.push(b);
      return;
    }
    if (outs.some(o => o === "open")) return;
    // tout est gagné (ou remboursé) : les jambes void comptent pour une cote de 1
    const eff = b.legs.reduce((o, leg, i) => o * (outs[i] === "void" ? 1 : leg.odds), 1);
    b.status = "won";
    b.payout = Math.round(b.stake * eff);
    state.cash = (state.cash || 0) + b.payout;
    state.betStats.returned += b.payout;
    b.result = b.legs.map(leg => legResultText(rec, leg)).filter(Boolean).join(" · ");
    settled.push(b);
  });
  if (settled.length) saveState();
  return settled;
}

/* ============================================================
   PARIS DE TOURNOI — marchés cotés en simulant le tableau réel
   (une fois le tirage effectué), résolus à la fin du tournoi.
   Cotes équitables : cote = 1 / probabilité observée (lissée).
   ============================================================ */
function oddsFromCount(count, n) {
  const p = (count + 0.5) / (n + 1); // lissage : jamais 0
  return Math.min(99, Math.max(1.01, Math.round(100 / p) / 100));
}

/* Simule le tableau tel que tiré, POINT PAR POINT (aces et doubles fautes
   suivent les lois du vrai moteur), et cote les marchés du tournoi :
   vainqueur (TOUS les joueurs sauf toi) + totaux d'aces, de doubles fautes
   et % de jeux de service gagnés. */
function buildMarkets(rec) {
  const t = CALENDAR[rec.index];
  const surfKey = SURFACE_TO_SKILL[t.surface];
  const cp = customPlayer();
  const cpId = cp && rec.entrants.includes(cp.id) ? cp.id : null;
  const N = TBET_SIMS;
  const sk = id => state.players[id].sk;
  const winCount = {};
  rec.entrants.forEach(id => { winCount[id] = 0; });
  const isFinals = rec.type === "finals";
  const nRounds = isFinals ? 0 : rec.roundsNames.length;
  const acesList = [], dfList = [], holdPctList = [];
  // Le bookmaker connaît la forme actuelle des joueurs (mais pas le dopage !)
  const trainedNow = {};
  rec.entrants.forEach(id => { trainedNow[id] = !!(state.trained && state.trained[id]); });

  for (let s = 0; s < N; s++) {
    let champion = null;
    let acesTot = 0, dfTot = 0, held = 0, svTotal = 0;
    const simFat = {};
    rec.entrants.forEach(id => { simFat[id] = fatigueOf(id); });
    const modOf = id => {
      if (trainedNow[id]) return MOD_TRAINED;
      const f = simFat[id] || 0;
      if (f >= FATIGUE_BURNT) return MOD_BURNT;
      if (f >= FATIGUE_TIRED) return MOD_TIRED;
      return 0;
    };
    function playLean(a, b) {
      const core = leanPointMatch(sk(a), sk(b), surfKey, t.bestOf, modOf(a), modOf(b));
      acesTot += core.aces[0] + core.aces[1];
      dfTot += core.df[0] + core.df[1];
      held += core.held; svTotal += core.svTotal;
      simFat[a] = (simFat[a] || 0) + fatigueGainFor(core.games, sk(a).endurance);
      simFat[b] = (simFat[b] || 0) + fatigueGainFor(core.games, sk(b).endurance);
      return core.winA ? a : b;
    }
    if (!isFinals) {
      let current = [];
      rec.rounds[0].forEach(m => { current.push(m.p1, m.p2); });
      for (let r = 0; r < nRounds; r++) {
        const next = [];
        for (let i = 0; i < current.length; i += 2) {
          const a = current[i], b = current[i + 1];
          if (a === null || b === null) { next.push(a !== null ? a : b); continue; }
          next.push(playLean(a, b));
        }
        current = next;
      }
      champion = current[0];
    } else {
      const wins = {};
      rec.entrants.forEach(id => { wins[id] = 0; });
      ["A", "B"].forEach(g => {
        const grp = rec.groups[g];
        for (let i = 0; i < grp.length; i++)
          for (let j = i + 1; j < grp.length; j++)
            wins[playLean(grp[i], grp[j])]++;
      });
      const top2 = g => rec.groups[g].slice()
        .sort((a, b) => (wins[b] - wins[a]) || (Math.random() - 0.5)).slice(0, 2);
      const [a1, a2] = top2("A"), [b1, b2] = top2("B");
      champion = playLean(playLean(a1, b2), playLean(b1, a2));
    }
    winCount[champion]++;
    acesList.push(acesTot);
    dfList.push(dfTot);
    if (svTotal > 0) holdPctList.push(100 * held / svTotal);
  }

  /* Vainqueur du tournoi : TOUS les joueurs sont cotés — sauf toi */
  const winner = rec.entrants.filter(id => id !== cpId)
    .map(pid => ({ pid, odds: oddsFromCount(winCount[pid], N) }))
    .sort((a, b) => (a.odds - b.odds) || (winCount[b.pid] - winCount[a.pid]));

  /* Totaux du tournoi : plus/moins, ligne = médiane + 0,5 */
  const ouOf = list => {
    const s = list.slice().sort((a, b) => a - b);
    const line = (s.length ? s[Math.floor(s.length / 2)] : 0) + 0.5;
    const over = list.filter(x => x > line).length;
    return { line, over: oddsFromCount(over, list.length || 1), under: oddsFromCount(list.length - over, list.length || 1) };
  };
  const ouAces = ouOf(acesList);
  const ouDf = ouOf(dfList);
  /* % de jeux de service gagnés (ligne au 0,5 près) */
  const hsSorted = holdPctList.slice().sort((a, b) => a - b);
  const hpLine = Math.round((hsSorted.length ? hsSorted[Math.floor(hsSorted.length / 2)] : 0) * 2) / 2;
  const hpOver = holdPctList.filter(p => p > hpLine).length;
  const ouHold = {
    line: hpLine,
    over: oddsFromCount(hpOver, holdPctList.length || 1),
    under: oddsFromCount((holdPctList.length - hpOver), holdPctList.length || 1),
  };
  return { winner, ouAces, ouDf, ouHold };
}

/* Construit les cotes du tournoi à la demande (premier affichage du guichet) */
function ensureTournamentMarkets(rec) {
  if (!rec.markets) { rec.markets = buildMarkets(rec); saveState(); }
  return rec.markets;
}

/* Le marché ferme dès que le premier match du tournoi est joué */
function marketsClosed(rec) {
  if (rec.status !== "active") return true;
  // Les exemptions (walkovers) ne comptent pas comme un match joué
  if (rec.type === "bracket") return rec.rounds[0].some(m => m.winner !== null && !m.walkover);
  return rec.rr.A.concat(rec.rr.B).some(m => m.winner !== null);
}

function placeTournamentBet(tourneyId, market, pick, stake) {
  const rec = state.tournaments[tourneyId];
  if (!rec) throw new Error("Pas de marché pour ce tournoi.");
  if (marketsClosed(rec)) throw new Error("Le marché est fermé : le tournoi a commencé.");
  ensureTournamentMarkets(rec);
  stake = Math.round(Number(stake) || 0);
  if (stake < TBET_MIN) throw new Error("Mise minimale : " + fmtEuro(TBET_MIN) + ".");
  if (stake > (state.cash || 0)) throw new Error("Cash insuffisant.");
  const marketKey = market;
  if ((state.tbets || []).some(b => b.tourneyId === tourneyId && b.marketKey === marketKey))
    throw new Error("Tu as déjà misé sur ce marché.");

  let odds, label, line;
  const frNum = x => String(x).replace(".", ",");
  if (market === "winner") {
    const cp0 = customPlayer();
    if (cp0 && pick === cp0.id) throw new Error("Impossible de parier sur toi-même.");
    const o = rec.markets.winner.find(x => x.pid === pick);
    if (!o) throw new Error("Sélection inconnue.");
    odds = o.odds; label = "Vainqueur : " + getPlayer(pick).name;
  } else if (market === "oua" || market === "oud") {
    const mkt = market === "oua" ? rec.markets.ouAces : rec.markets.ouDf;
    if (!mkt || (pick !== "over" && pick !== "under")) throw new Error("Sélection inconnue.");
    odds = mkt[pick]; line = mkt.line;
    label = (market === "oua" ? "Aces du tournoi : " : "Doubles fautes du tournoi : ") +
      (pick === "over" ? "plus" : "moins") + " de " + frNum(line);
  } else if (market === "ouh") {
    const mkt = rec.markets.ouHold;
    if (!mkt || (pick !== "over" && pick !== "under")) throw new Error("Sélection inconnue.");
    odds = mkt[pick]; line = mkt.line;
    label = "Services gagnés du tournoi : " + (pick === "over" ? "plus" : "moins") + " de " + frNum(line) + " %";
  } else throw new Error("Marché inconnu.");
  state.cash -= stake;
  state.betStats.staked += stake;
  const bet = {
    id: state.tbetSeq++, tourneyId, kind: "tournament", market, marketKey, pick, label, odds, stake, line,
    year: state.year, status: "open", payout: 0,
  };
  state.tbets.push(bet);
  saveState();
  return bet;
}

/* Tous les matchs joués d'un tournoi terminé */
function allMatchesReal(rec) {
  return rec.type === "bracket"
    ? rec.rounds.flat()
    : rec.rr.A.concat(rec.rr.B, rec.sf, [rec.final]);
}

/* % réel de jeux de service gagnés sur l'ensemble du tournoi */
function holdPctReal(rec) {
  let held = 0, total = 0;
  allMatchesReal(rec).forEach(m => {
    if (m && m.sv) { held += m.sv[0]; total += m.sv[1]; }
  });
  return total > 0 ? 100 * held / total : 0;
}

/* Contrôle antidopage : 5 % de risque à l'issue du tournoi → 3 mois de suspension */
function runDopingControl(rec, t) {
  if (rec.doped === undefined || rec.doped === null) return;
  rec.dopingControl = rnd() < DOPING_CONTROL_P;
  if (rec.dopingControl) {
    if (!state.suspended) state.suspended = {};
    state.suspended[rec.doped] = t.month + SUSPENSION_MONTHS;
  }
}

/* Totaux réels d'aces et de doubles fautes du tournoi (stats des matchs joués) */
function acesRealTotal(rec) {
  return allMatchesReal(rec).reduce((s, m) => s + (m && m.stats ? m.stats.aces[0] + m.stats.aces[1] : 0), 0);
}
function dfRealTotal(rec) {
  return allMatchesReal(rec).reduce((s, m) => s + (m && m.stats ? m.stats.df[0] + m.stats.df[1] : 0), 0);
}
function tbetResultInfo(rec, b) {
  const frLine = x => String(x).replace(".", ",");
  if (b.market === "winner")
    return "Vainqueur réel : " + getPlayer(rec.recap.champion).name;
  if (b.market === "oua")
    return acesRealTotal(rec) + " aces dans le tournoi (ligne à " + frLine(b.line) + ")";
  if (b.market === "oud")
    return dfRealTotal(rec) + " doubles fautes dans le tournoi (ligne à " + frLine(b.line) + ")";
  if (b.market === "ouh")
    return "Services gagnés sur le tournoi : " + holdPctReal(rec).toFixed(1).replace(".", ",") + " % (ligne à " + frLine(b.line) + " %)";
  return "";
}

/* Résolution des paris de tournoi (appelée à la fin du tournoi) */
function resolveTournamentBets(rec) {
  const open = (state.tbets || []).filter(b => b.tourneyId === rec.id && b.status === "open" && b.kind === "tournament");
  if (open.length === 0) return [];
  open.forEach(b => {
    let won = false;
    if (b.market === "winner") won = rec.recap.champion === b.pick;
    else if (b.market === "oua") {
      const v = acesRealTotal(rec);
      won = b.pick === "over" ? v > b.line : v < b.line;
    } else if (b.market === "oud") {
      const v = dfRealTotal(rec);
      won = b.pick === "over" ? v > b.line : v < b.line;
    } else if (b.market === "ouh") {
      const p = holdPctReal(rec);
      won = b.pick === "over" ? p > b.line : p < b.line;
    }
    b.status = won ? "won" : "lost";
    b.result = tbetResultInfo(rec, b); // le fait réel qui justifie le paiement (ou non)
    if (won) {
      b.payout = Math.round(b.stake * b.odds);
      state.cash = (state.cash || 0) + b.payout;
      state.betStats.returned += b.payout;
    }
  });
  return open;
}


/* Prize money total distribué par tournoi (constant) */
function tournamentPool(t) {
  const prz = PRIZE[PRIZE_BY_TOURNEY[t.id]];
  if (t.cat === "FINALS") return 8 * prz.PARTICIPATION + 12 * prz.RR_WIN + 2 * prz.SF_WIN + prz.F_WIN;
  const counts = t.drawSize === 128
    ? { R128: 64, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1, W: 1 }
    : { R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1, W: 1 };
  return Object.entries(counts).reduce((s, [r, c]) => s + c * (prz[r] || 0), 0);
}
/* ---------- Import CSV ---------- */
/* Format : Nom;Drapeau(emoji);Catégorie;FR(oui/non)[;Terre;Gazon;Dur;Indoor;Force;Endurance;Adresse;Tactique;Service;Mental]
   — séparateur , ou ;. Seul le nom est obligatoire. Les 10 compétences (1-10) sont
   optionnelles : si fournies, elles sont utilisées telles quelles (bornées 1-10) ;
   sinon elles sont tirées aléatoirement pour un total de 70. 128 lignes attendues. */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) throw new Error("Fichier vide.");
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ";" : ",";
  let rows = lines.map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, "")));
  // Entête éventuelle
  if (rows[0][0] && /^(nom|name|joueur|player)$/i.test(rows[0][0])) rows = rows.slice(1);
  if (rows.length !== ROSTER_SIZE) throw new Error("Le fichier doit contenir exactement " + ROSTER_SIZE + " joueurs (le 128e est ton champion) — trouvé : " + rows.length + ".");
  const seen = new Set();
  return rows.map(r => {
    const name = r[0];
    if (!name) throw new Error("Un nom de joueur est vide.");
    if (seen.has(name.toLowerCase())) throw new Error("Nom en double : " + name);
    seen.add(name.toLowerCase());
    const player = {
      name,
      flag: r[1] || "🏳️",
      cat: r[2] || "Divers",
      fr: /^(oui|yes|true|fr|1)$/i.test(r[3] || ""),
    };
    // Compétences optionnelles (colonnes 5 à 14)
    if (r.length >= 14 && r.slice(4, 14).some(c => c !== "")) {
      const sk = {};
      SKILL_KEYS.forEach((k, i) => { sk[k] = r[4 + i]; });
      player.sk = sk;
    }
    return player;
  });
}
