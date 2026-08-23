/* ============================================================
   Fun'is — Moteur de simulation
   Talents cachés + forme du tournoi + affinités de surface,
   simulation jeu par jeu, tirages, têtes de série, classements.
   ============================================================ */

"use strict";

const STORAGE_KEY = "funis_save_v8";
const CASHOUT_RATE = 0.8;   // le bookmaker rachète un pari de saison à 80 % de sa juste valeur
const TBET_SIMS = 250;      // simulations du tableau réel pour coter les paris de tournoi
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
const BET_BUDGET = 10000;   // budget de paris en début de saison
const BET_PLAYERS = 5;      // nombre de joueurs à parier (dont ton champion)
const CUSTOM_BET = 2000;    // pari automatique et fixe sur ton champion
const ROSTER_SIZE = 127;    // 127 joueurs de plateau + ton champion = 128
const CUSTOM_SKILL_TOTAL = 85; // ton champion a 85 points (contre 70 pour le plateau)
const ODDS_SIMS = 120;      // saisons Monte-Carlo pour calibrer les cotes

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
    career: { seasons: [], stats: {}, match: null }, // cumul des saisons passées
    players: buildPlayers(roster),
    favorites: [],          // les 5 joueurs pariés (mise en avant dans l'UI)
    bets: [],               // [{pid, amount, sold?}] — total = BET_BUDGET
    betsPlaced: false,
    cash: 0,                // portefeuille cash (mise non placée + cash-out + paris de tournoi gagnés)
    tbets: [],              // paris de tournoi [{id, tourneyId, market, pick, label, odds, stake, status, payout}]
    tbetSeq: 1,
    fatigue: {},            // pid -> points de fatigue accumulés
    trained: {},            // pid -> true si n'a pas joué le tournoi précédent (bonus « entraîné »)
    syringes: SEASON_SYRINGES, // seringues de dopage restantes
    suspended: {},          // pid -> mois (décimal) de fin de suspension
    refs: null,             // prize money attendu par joueur (cotes), calculé par Monte-Carlo
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
/* Position (1-indexée) dans le dernier snapshot, pour l'évolution */
function previousRank(playerId, kind) {
  if (state.snapshots.length < 2) {
    if (state.snapshots.length === 1) return null; // pas de semaine précédente
    return null;
  }
  const prev = state.snapshots[state.snapshots.length - 2];
  const list = kind === "money" ? prev.ranksMoney : prev.ranksPts;
  const idx = list.indexOf(playerId);
  return idx === -1 ? null : idx + 1;
}
function currentRank(playerId, kind) {
  const list = kind === "money" ? sortedByMoney() : sortedByPoints();
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
  const ranked = sortedByPointsWithTieShuffle().filter(eligible);
  if (tourney.cat === "FINALS") return { entrants: ranked.slice(0, 8), qualifiers: [] };
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

  // Têtes de série selon le classement de la race (ex aequo mélangés)
  const ranked = sortedByPointsWithTieShuffle().filter(id => entrantIds.includes(id));
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
  record.markets = buildMarkets(record); // cotes des paris de tournoi sur le tableau réel
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

/* Noyau de simulation : utilisé par les matchs "réels" (avec timeline pour
   l'animation) et par les saisons silencieuses du calcul des cotes. */
function simulateMatchCore(skA, skB, surfKey, bestOf, withTimeline, modA, modB) {
  const setsToWin = Math.ceil(bestOf / 2);
  // Écart de compétences + modificateurs de forme (entraîné/fatigué/cramé/dopé)
  const diffAB = baseSkillDiff(skA, skB, surfKey) + ((modA || 0) - (modB || 0));
  const endDiff = skA.endurance - skB.endurance;
  const menDiff = skA.mental - skB.mental;

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

  // Fatigue : bonus/malus croissant selon l'écart d'endurance et la longueur du match
  function fatigueTerm() {
    return Math.max(0, totalGames - FATIGUE_START) * FATIGUE_RATE * endDiff;
  }
  function gameWinProbForServer(serverA, isDecider) {
    const serveSkill = serverA ? skA.service : skB.service;
    let logit = SERVE_BASE + SERVE_PER_PT * serveSkill; // avantage du serveur
    let d = LOGIT_SCALE * diffAB + fatigueTerm();
    if (isDecider) d += MENTAL_DECIDER * menDiff;
    logit += serverA ? d : -d;
    return 1 / (1 + Math.exp(-logit));
  }
  function tbPointProbForServer(serverA, isDecider) {
    const serveSkill = serverA ? skA.service : skB.service;
    let logit = 0.06 + 0.035 * serveSkill;
    let d = LOGIT_SCALE * 0.7 * diffAB + fatigueTerm() + MENTAL_TIEBREAK * menDiff;
    if (isDecider) d += MENTAL_DECIDER * 0.5 * menDiff;
    logit += serverA ? d : -d;
    return 1 / (1 + Math.exp(-logit));
  }

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

function simulateMatch(idA, idB, tourneyRec) {
  const t = CALENDAR[tourneyRec.index];
  const core = simulateMatchCore(
    getPlayer(idA).sk, getPlayer(idB).sk,
    SURFACE_TO_SKILL[t.surface], t.bestOf, true,
    formMod(idA, tourneyRec), formMod(idB, tourneyRec));
  return {
    winner: core.winA ? idA : idB, sets: core.sets, tiebreaks: core.tiebreaks,
    timeline: core.timeline,
    bp: [[core.bp.convA, core.bp.savedA], [core.bp.convB, core.bp.savedB]], // [conv, sauvées] pour p1 puis p2
    sv: [core.sv.held, core.sv.total], // services tenus / jeux de service du match
  };
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

/* ---------- Jouer un match du tableau ---------- */
function playBracketMatch(rec, roundIdx, matchIdx) {
  const match = rec.rounds[roundIdx][matchIdx];
  if (match.winner !== null || match.p1 === null || match.p2 === null) return null;
  // Forme des deux joueurs au moment du match (affichée ensuite dans le tableau)
  match.form1 = formStatus(match.p1, rec);
  match.form2 = formStatus(match.p2, rec);
  const res = simulateMatch(match.p1, match.p2, rec);
  match.winner = res.winner;
  match.score = res.sets;
  match.tiebreaks = res.tiebreaks;
  match.bp = res.bp;
  match.sv = res.sv;
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
  record.markets = buildMarkets(record);
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
  match.winner = res.winner;
  match.score = res.sets;
  match.tiebreaks = res.tiebreaks;
  match.bp = res.bp;
  match.sv = res.sv;
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
  "bpConv", "bpSaved", "bpOppSaved", "bpOppConv", "tournamentsPlayed", "finals"];

function playerStats(pid) {
  const st = playerStatsSeason(pid);
  const c = state.career && state.career.stats && state.career.stats[pid];
  if (c) {
    CAREER_STAT_KEYS.forEach(k => { st[k] += c[k] || 0; });
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
      (t.bestOf === 5 ? matchListBo5 : matchListBo3).push({ tid: t.id, m, games, year: state.year });
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
    classement: info.classement,
    club: (info.club || "").trim(),
    custom: true,
    sk: normalizeSkills(info.sk),
  };
  state.players.push(p);
  state.points[p.id] = 0;
  state.money[p.id] = 0;
  state.refs = null; // les cotes seront calculées avec lui
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
  if (!state.career) state.career = { seasons: [], stats: {}, match: null };
  // Cumul des stats joueur
  state.players.forEach(p => {
    const x = playerStatsSeason(p.id);
    const c = state.career.stats[p.id] || {
      wins: 0, losses: 0, setsW: 0, setsL: 0, gamesW: 0, gamesL: 0, tbW: 0, tbL: 0,
      bpConv: 0, bpSaved: 0, bpOppSaved: 0, bpOppConv: 0, tournamentsPlayed: 0, finals: 0,
      surf: { terre: [0, 0], gazon: [0, 0], dur: [0, 0], indoor: [0, 0] },
    };
    CAREER_STAT_KEYS.forEach(k => { c[k] += x[k]; });
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
    const s = list.slice().sort((a, b) => b.games - a.games);
    return s.slice(0, 3).concat(s.slice(-3));
  };
  extremes(ms.matchListBo5).forEach(e => cm.listBo5.push({ tid: e.tid, games: e.games, year: e.year, m: keepM(e.m) }));
  extremes(ms.matchListBo3).forEach(e => cm.listBo3.push({ tid: e.tid, games: e.games, year: e.year, m: keepM(e.m) }));
  state.career.match = cm;
  // Résumé de la saison
  const top = sortedByPoints();
  const cp = customPlayer();
  const cpTitles = cp ? Object.values(state.tournaments).filter(r => r.recap && r.recap.champion === cp.id).length : 0;
  const finalsRec = state.tournaments["finals"];
  state.career.seasons.push({
    year: state.year,
    no1: top[0].name, no1Flag: top[0].flag, no1Pts: state.points[top[0].id],
    mastersChamp: finalsRec && finalsRec.recap ? getPlayer(finalsRec.recap.champion).name : "—",
    mastersFlag: finalsRec && finalsRec.recap ? getPlayer(finalsRec.recap.champion).flag : "",
    bank: Math.round(bankNow()),
    cpTitles,
    cpRank: cp ? currentRank(cp.id, "points") : null,
  });
}

function startNextSeason() {
  if (state.currentIndex < CALENDAR.length) throw new Error("La saison n'est pas terminée.");
  if (state.season >= MAX_SEASONS) throw new Error("Carrière terminée : " + MAX_SEASONS + " saisons maximum.");
  archiveSeason();
  const lastRank = {};
  sortedByPoints().forEach((p, i) => { lastRank[p.id] = i + 1; });
  const keep = {
    roster: state.roster, season: state.season + 1, year: state.year + 1,
    career: state.career, titles: state.titles, matchSpeed: state.matchSpeed,
    cp: customPlayer() ? JSON.parse(JSON.stringify(customPlayer())) : null,
    suspended: {},
  };
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
  state.suspended = keep.suspended;
  if (keep.matchSpeed !== undefined) state.matchSpeed = keep.matchSpeed;
  if (keep.cp) addCustomPlayer(keep.cp); // même champion, mêmes compétences (le bonus +3 se répartit ensuite)
  state.pendingUpgrade = !!keep.cp;      // l'écran « +3 points » doit être passé avant les paris
  saveState();
  return state;
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
  state.refs = null; // les cotes seront recalculées avec le champion amélioré
  saveState();
  return cp;
}

/* ============================================================
   PARIS & COTES
   Le joueur mise 10 000 € sur 5 joueurs. Gain final d'un pari :
   mise × (prize money réel / prize money attendu du joueur).
   Le prize money attendu (ref) est estimé par Monte-Carlo : on
   simule des saisons complètes en silence. L'espérance de gain
   est ainsi ~10 000 € quelle que soit la répartition : parier
   un cador rapporte peu par euro, un outsider rapporte gros.
   ============================================================ */

/* Saison complète silencieuse : renvoie le prize money de chaque joueur. */
function silentSeason(players) {
  const n = players.length;
  const pts = new Array(n).fill(0);
  const money = new Array(n).fill(0);
  const allIds = players.map((_, i) => i);
  // Miroir du système de forme (les refs restent calibrées avec les vraies règles)
  const fat = new Array(n).fill(0);
  const trained = new Array(n).fill(false);
  const playedPrev = new Array(n).fill(false);

  function rankedIds() {
    const dec = allIds.map(i => [pts[i], Math.random(), i]);
    dec.sort((x, y) => (y[0] - x[0]) || (x[1] - y[1]));
    return dec.map(d => d[2]);
  }
  const modOf = i => {
    if (trained[i]) return MOD_TRAINED;
    if (fat[i] >= FATIGUE_BURNT) return MOD_BURNT;
    if (fat[i] >= FATIGUE_TIRED) return MOD_TIRED;
    return 0;
  };
  function lean(a, b, surfKey, bestOf) {
    const core = simulateMatchCore(players[a].sk, players[b].sk, surfKey, bestOf, false, modOf(a), modOf(b));
    const games = core.sets.reduce((s, x) => s + x[0] + x[1], 0);
    fat[a] += fatigueGainFor(games, players[a].sk.endurance);
    fat[b] += fatigueGainFor(games, players[b].sk.endurance);
    return core.winA ? a : b;
  }

  CALENDAR.forEach((t, tIdx) => {
    // Formes en début de tournoi : repos partiel si joué, entraîné sinon
    allIds.forEach(i => {
      if (tIdx === 0) { fat[i] = 0; trained[i] = false; }
      else if (playedPrev[i]) { fat[i] = Math.max(0, fat[i] - FATIGUE_RECOVERY); trained[i] = false; }
      else { fat[i] = 0; trained[i] = true; }
      playedPrev[i] = false;
    });
    const surfKey = SURFACE_TO_SKILL[t.surface];
    const przTable = PRIZE[PRIZE_BY_TOURNEY[t.id]];
    if (t.cat === "FINALS") {
      const eight = rankedIds().slice(0, 8);
      eight.forEach(i => { playedPrev[i] = true; });
      const gA = [eight[0]], gB = [eight[1]];
      [[2, 3], [4, 5], [6, 7]].forEach(([i, j]) => {
        if (Math.random() < 0.5) { gA.push(eight[i]); gB.push(eight[j]); }
        else { gA.push(eight[j]); gB.push(eight[i]); }
      });
      const wins = {};
      eight.forEach(id => { wins[id] = 0; });
      [gA, gB].forEach(g => {
        for (let i = 0; i < g.length; i++)
          for (let j = i + 1; j < g.length; j++)
            wins[lean(g[i], g[j], surfKey, t.bestOf)]++;
      });
      const top2 = g => g.slice()
        .sort((a, b) => (wins[b] - wins[a]) || (Math.random() - 0.5)).slice(0, 2);
      const [a1, a2] = top2(gA), [b1, b2] = top2(gB);
      const w1 = lean(a1, b2, surfKey, t.bestOf);
      const w2 = lean(b1, a2, surfKey, t.bestOf);
      const champ = lean(w1, w2, surfKey, t.bestOf);
      eight.forEach(id => {
        pts[id] += POINTS.FINALS.RR_WIN * wins[id];
        money[id] += przTable.PARTICIPATION + przTable.RR_WIN * wins[id];
      });
      [w1, w2].forEach(id => { pts[id] += POINTS.FINALS.SF_WIN; money[id] += przTable.SF_WIN; });
      pts[champ] += POINTS.FINALS.F_WIN; money[champ] += przTable.F_WIN;
    } else {
      let entrants;
      if (t.cat === "GC") entrants = allIds.slice();
      else {
        // Masters 1000 : 56 qualifiés directs + 8 repêchés au tirage pondéré
        const ranked = rankedIds();
        const direct = ranked.slice(0, M1000_DIRECT);
        entrants = direct.concat(weightedSample(ranked.slice(M1000_DIRECT), 64 - M1000_DIRECT));
      }
      entrants.forEach(i => { playedPrev[i] = true; });
      let slots;
      if (t.randomDraw) slots = shuffle(entrants);
      else {
        const inDraw = new Set(entrants);
        const seeded = rankedIds().filter(id => inDraw.has(id)).slice(0, t.seeds);
        const seededSet = new Set(seeded);
        slots = placeSeedsAndRest(t.drawSize, seeded, entrants.filter(id => !seededSet.has(id)));
      }
      const ptsTable = POINTS[t.cat];
      let current = slots;
      roundNames(t.drawSize).forEach(rName => {
        const next = [];
        for (let i = 0; i < current.length; i += 2) {
          const a = current[i], b = current[i + 1];
          const w = lean(a, b, surfKey, t.bestOf);
          const l = w === a ? b : a;
          pts[l] += ptsTable[rName] || 0;
          money[l] += przTable[rName] || 0;
          next.push(w);
        }
        current = next;
      });
      pts[current[0]] += ptsTable.W;
      money[current[0]] += przTable.W;
    }
  });
  return money;
}

/* Prize money attendu par joueur (moyenne Monte-Carlo). */
function computeExpectedPrizes(players, nSims) {
  const n = players.length;
  const totals = new Array(n).fill(0);
  for (let s = 0; s < nSims; s++) {
    const m = silentSeason(players);
    for (let i = 0; i < n; i++) totals[i] += m[i];
  }
  const refs = {};
  for (let i = 0; i < n; i++) refs[i] = Math.max(50000, Math.round(totals[i] / nSims));
  return refs;
}

function ensureRefs() {
  if (state.refs) return state.refs;
  state.refs = computeExpectedPrizes(state.players, ODDS_SIMS);
  const vals = Object.values(state.refs);
  state.refAvg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  saveState();
  return state.refs;
}

/* Cote affichée : gain par euro misé si le joueur réalise le prize money
   moyen du plateau (les outsiders ont une grosse cote). */
function betOdds(pid) { return state.refAvg / state.refs[pid]; }

function placeBets(bets) {
  const total = bets.reduce((s, b) => s + b.amount, 0);
  if (bets.length !== BET_PLAYERS) throw new Error(BET_PLAYERS + " joueurs requis.");
  if (total > BET_BUDGET) throw new Error("La répartition dépasse le budget de " + fmtEuro(BET_BUDGET) + ".");
  bets.forEach(b => { if (b.amount < 100) throw new Error("Mise minimale : 100 € par joueur."); });
  const cp = customPlayer();
  if (cp) {
    const cb = bets.find(b => b.pid === cp.id);
    if (!cb || cb.amount !== CUSTOM_BET) throw new Error("Ton champion porte un pari fixe de " + fmtEuro(CUSTOM_BET) + ".");
  }
  state.bets = bets;
  state.favorites = bets.map(b => b.pid);
  state.betsPlaced = true;
  state.cash = BET_BUDGET - total; // le reste part en cash, pour les paris de tournoi
  saveState();
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

/* Dopage : booste un de tes 5 joueurs pour le tournoi à venir */
function applyDoping(tourneyId, pid) {
  const rec = state.tournaments[tourneyId];
  if (!rec || rec.status !== "active") throw new Error("Tournoi introuvable.");
  if (marketsClosed(rec)) throw new Error("Trop tard : le tournoi a commencé.");
  if ((state.syringes || 0) <= 0) throw new Error("Plus de seringues cette saison.");
  if (!state.favorites.includes(pid)) throw new Error("Tu ne peux doper qu'un de tes 5 joueurs.");
  if (!rec.entrants.includes(pid)) throw new Error("Ce joueur n'est pas au tableau.");
  if (rec.doped !== undefined && rec.doped !== null) throw new Error("Un seul joueur dopé par tournoi.");
  rec.doped = pid;
  state.syringes--;
  saveState();
  return rec;
}

/* Valeur actuelle d'un pari / du portefeuille */
function betValue(bet, moneyMap) {
  const m = moneyMap ? (moneyMap[bet.pid] || 0) : (state.money[bet.pid] || 0);
  return bet.amount * m / state.refs[bet.pid];
}
/* Solde total = cash + paris de saison actifs + mises des paris de tournoi en cours */
function bankNow() {
  const seasonVal = state.bets.reduce((s, b) => s + (b.sold ? 0 : betValue(b)), 0);
  const openStakes = (state.tbets || []).filter(b => b.status === "open").reduce((s, b) => s + b.stake, 0);
  return (state.cash || 0) + seasonVal + openStakes;
}

/* ============================================================
   CASH-OUT — le bookmaker rachète un pari de saison à 80 % de
   sa juste valeur : gains déjà acquis + espérance sur les
   tournois restants (part du pool non encore distribuée).
   ============================================================ */
function totalPoolAll() { return CALENDAR.reduce((s, t) => s + tournamentPool(t), 0); }
function remainingPoolShare() {
  let rem = 0;
  CALENDAR.forEach(t => {
    const r = state.tournaments[t.id];
    if (!r || r.status !== "done") rem += tournamentPool(t);
  });
  return rem / totalPoolAll();
}
function cashOutQuote(bet) {
  const acquired = betValue(bet);
  const expectedRemaining = bet.amount * remainingPoolShare();
  return {
    acquired,
    expectedRemaining,
    price: Math.round(CASHOUT_RATE * (acquired + expectedRemaining)),
  };
}
function cashOutBet(pid) {
  const bet = state.bets.find(b => b.pid === pid);
  if (!bet || bet.sold) throw new Error("Pari introuvable ou déjà vendu.");
  const cp = customPlayer();
  if (cp && pid === cp.id) throw new Error("On ne se vend pas soi-même ! Le pari sur ton champion est incessible.");
  const q = cashOutQuote(bet);
  bet.sold = { atIndex: state.currentIndex, price: q.price };
  state.cash = (state.cash || 0) + q.price;
  saveState();
  return q;
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

/* Simule le tableau tel que tiré, et compte les événements des marchés */
function buildMarkets(rec) {
  const t = CALENDAR[rec.index];
  const surfKey = SURFACE_TO_SKILL[t.surface];
  const cp = customPlayer();
  const cpId = cp && rec.entrants.includes(cp.id) ? cp.id : null;
  const N = TBET_SIMS;
  const sk = id => state.players[id].sk;

  // Cibles des défis
  const seedEntries = Object.entries(rec.seedsMap || {}).map(([pid, s]) => ({ pid: parseInt(pid, 10), s }));
  const seed1E = seedEntries.find(e => e.s === 1);
  // Tête d'affiche : la TS n°1, sinon (AO sans têtes de série) le favori du bookmaker
  const refLeader = state.refs
    ? rec.entrants.slice().sort((a, b) => (state.refs[b] || 0) - (state.refs[a] || 0))[0]
    : sortedByPoints().map(p => p.id).find(id => rec.entrants.includes(id));
  const star = seed1E ? seed1E.pid : refLeader;
  const top8seeds = seedEntries.filter(e => e.s <= 8).map(e => e.pid);
  const marathonThreshold = t.bestOf === 5 ? 55 : 36;

  const winCount = {};
  rec.entrants.forEach(id => { winCount[id] = 0; });
  const isFinals = rec.type === "finals";
  const nRounds = isFinals ? 0 : rec.roundsNames.length;
  const cpElim = new Array((isFinals ? 3 : nRounds) + 1).fill(0); // index d'élimination du champion
  const propCount = { finale_decider: 0, bagel: 0, star_out: 0, marathon: 0, seeds_out: 0 };
  const finaleGamesList = [], holdPctList = [];
  const SCORE_KEYS = ["6-0", "6-1", "6-2", "6-3", "6-4", "7-5", "7-6"];
  const topScoreWins = {};
  SCORE_KEYS.forEach(k => { topScoreWins[k] = 0; });

  const qfIdx = isFinals ? -1 : rec.roundsNames.indexOf("QF");
  const r16Idx = isFinals ? -1 : rec.roundsNames.indexOf("R16");
  // Le bookmaker connaît la forme actuelle des joueurs (mais pas le dopage !)
  const trainedNow = {};
  rec.entrants.forEach(id => { trainedNow[id] = !!(state.trained && state.trained[id]); });

  for (let s = 0; s < N; s++) {
    let events = { bagel: false, marathon: false, decider: false, starOut: false, seedsOut: 0 };
    let champion = null;
    let cpElimIdx = null;
    let finaleGames = 0, held = 0, svTotal = 0;
    const scoreCount = {};
    SCORE_KEYS.forEach(k => { scoreCount[k] = 0; });
    const simFat = {};
    rec.entrants.forEach(id => { simFat[id] = fatigueOf(id); });
    const modOf = id => {
      if (trainedNow[id]) return MOD_TRAINED;
      const f = simFat[id] || 0;
      if (f >= FATIGUE_BURNT) return MOD_BURNT;
      if (f >= FATIGUE_TIRED) return MOD_TIRED;
      return 0;
    };

    function playLean(a, b, isFinal) {
      const core = simulateMatchCore(sk(a), sk(b), surfKey, t.bestOf, false, modOf(a), modOf(b));
      const w = core.winA ? a : b;
      let games = 0;
      core.sets.forEach(x => {
        games += x[0] + x[1];
        const key = Math.max(x[0], x[1]) + "-" + Math.min(x[0], x[1]);
        if (key in scoreCount) scoreCount[key]++;
        if ((x[0] === 6 && x[1] === 0) || (x[0] === 0 && x[1] === 6)) events.bagel = true;
      });
      held += core.sv.held; svTotal += core.sv.total;
      simFat[a] = (simFat[a] || 0) + fatigueGainFor(games, sk(a).endurance);
      simFat[b] = (simFat[b] || 0) + fatigueGainFor(games, sk(b).endurance);
      if (games > marathonThreshold) events.marathon = true;
      if (isFinal && core.sets.length === t.bestOf) { events.decider = true; finaleGames = games; }
      else if (isFinal) finaleGames = games;
      return w;
    }

    if (!isFinals) {
      let current = [];
      rec.rounds[0].forEach(m => { current.push(m.p1, m.p2); });
      for (let r = 0; r < nRounds; r++) {
        const next = [];
        for (let i = 0; i < current.length; i += 2) {
          const a = current[i], b = current[i + 1];
          // Exempts (suspendus) : walkover
          if (a === null || b === null) {
            const w0 = a !== null ? a : b;
            if (w0 === cpId && r === nRounds - 1) cpElimIdx = nRounds;
            next.push(w0);
            continue;
          }
          const w = playLean(a, b, r === nRounds - 1);
          const l = w === a ? b : a;
          if (l === star && r < qfIdx) events.starOut = true;
          if (top8seeds.includes(l) && r < r16Idx) events.seedsOut++;
          if (l === cpId) cpElimIdx = r;
          next.push(w);
        }
        current = next;
      }
      champion = current[0];
      if (cpId !== null && cpElimIdx === null) cpElimIdx = nRounds; // champion du tournoi
    } else {
      // Masters : poules puis KO
      const wins = {};
      rec.entrants.forEach(id => { wins[id] = 0; });
      ["A", "B"].forEach(g => {
        const grp = rec.groups[g];
        for (let i = 0; i < grp.length; i++)
          for (let j = i + 1; j < grp.length; j++)
            wins[playLean(grp[i], grp[j], false)]++;
      });
      const top2 = g => rec.groups[g].slice()
        .sort((a, b) => (wins[b] - wins[a]) || (Math.random() - 0.5)).slice(0, 2);
      const [a1, a2] = top2("A"), [b1, b2] = top2("B");
      const w1 = playLean(a1, b2, false), w2 = playLean(b1, a2, false);
      champion = playLean(w1, w2, true);
      if (cpId !== null) {
        const inSF = [a1, a2, b1, b2].includes(cpId);
        const inF = [w1, w2].includes(cpId);
        cpElimIdx = champion === cpId ? 3 : inF ? 2 : inSF ? 1 : 0;
      }
    }
    winCount[champion]++;
    if (cpId !== null) cpElim[cpElimIdx]++;
    if (events.decider) propCount.finale_decider++;
    if (events.bagel) propCount.bagel++;
    if (events.starOut) propCount.star_out++;
    if (events.marathon) propCount.marathon++;
    if (events.seedsOut >= 3) propCount.seeds_out++;
    finaleGamesList.push(finaleGames);
    if (svTotal > 0) holdPctList.push(100 * held / svTotal);
    const mxScore = Math.max.apply(null, SCORE_KEYS.map(k => scoreCount[k]));
    if (mxScore > 0) SCORE_KEYS.forEach(k => { if (scoreCount[k] === mxScore) topScoreWins[k]++; });
  }

  /* Marché vainqueur : 6 favoris + ton champion + un outsider surprise */
  const ranked = rec.entrants.slice().sort((a, b) => winCount[b] - winCount[a]);
  const picks = ranked.slice(0, 6);
  if (cpId !== null && !picks.includes(cpId)) picks.push(cpId);
  const outsiders = ranked.slice(8, 32).filter(id => !picks.includes(id));
  if (outsiders.length) picks.push(outsiders[Math.floor(Math.random() * outsiders.length)]);
  const winner = picks.map(pid => ({ pid, odds: oddsFromCount(winCount[pid], N) }));

  /* Marché parcours du champion */
  let run = null;
  if (cpId !== null) {
    const reachedAtLeast = k => {
      let c = 0;
      for (let i = k; i < cpElim.length; i++) c += cpElim[i];
      return c;
    };
    if (!isFinals) {
      const lines = t.drawSize === 128
        ? [[1, "Passe le 1er tour"], [3, "Atteint les 8es de finale"], [4, "Atteint les quarts"], [6, "Atteint la finale"], [7, "Gagne le tournoi"]]
        : [[1, "Passe le 1er tour"], [2, "Atteint les 8es de finale"], [3, "Atteint les quarts"], [5, "Atteint la finale"], [6, "Gagne le tournoi"]];
      run = lines.map(([k, label]) => ({ k, label, odds: oddsFromCount(reachedAtLeast(k), N) }));
    } else {
      run = [[1, "Sort des poules"], [2, "Atteint la finale"], [3, "Gagne le Masters"]]
        .map(([k, label]) => ({ k, label, odds: oddsFromCount(reachedAtLeast(k), N) }));
    }
  }

  /* Défis fun : 3 tirés parmi les applicables */
  const starP = star !== undefined && star !== null ? getPlayer(star) : null;
  const propDefs = [
    { code: "finale_decider", label: t.bestOf === 5 ? "La finale ira au 5e set" : "La finale ira au 3e set", count: propCount.finale_decider },
    { code: "bagel", label: "Au moins un 6-0 sera infligé dans le tournoi", count: propCount.bagel },
    (!isFinals && star !== undefined && star !== null)
      ? { code: "star_out", label: `${starP.name} (tête d'affiche) tombera avant les quarts`, count: propCount.star_out } : null,
    { code: "marathon", label: `Un match dépassera ${marathonThreshold} jeux`, count: propCount.marathon },
    (!isFinals && top8seeds.length >= 8)
      ? { code: "seeds_out", label: "Au moins 3 des 8 premières têtes de série tomberont avant les 8es", count: propCount.seeds_out } : null,
  ].filter(Boolean);
  const props = shuffle(propDefs).slice(0, 3)
    .map(d => ({ code: d.code, label: d.label, odds: oddsFromCount(d.count, N) }));

  /* Over/Under : nombre de jeux de la finale (ligne = médiane + 0.5) */
  const median = list => {
    const s = list.slice().sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  const fgLine = Math.max(0, Math.floor(median(finaleGamesList))) + 0.5;
  const fgOver = finaleGamesList.filter(g => g > fgLine).length;
  const ouFinal = {
    line: fgLine,
    over: oddsFromCount(fgOver, finaleGamesList.length || 1),
    under: oddsFromCount((finaleGamesList.length - fgOver), finaleGamesList.length || 1),
  };

  /* Over/Under : % de jeux de service gagnés sur l'ensemble du tournoi (ligne au 0.5 près) */
  const hpLine = Math.round(median(holdPctList) * 2) / 2;
  const hpOver = holdPctList.filter(p => p > hpLine).length;
  const ouHold = {
    line: hpLine,
    over: oddsFromCount(hpOver, holdPctList.length || 1),
    under: oddsFromCount((holdPctList.length - hpOver), holdPctList.length || 1),
  };

  /* Score de set le plus fréquent du tournoi (égalité = gagnant aussi) */
  const topScore = SCORE_KEYS.map(k => ({ key: k, odds: oddsFromCount(topScoreWins[k], N) }));

  return { winner, run, props, star, top8seeds, marathonThreshold, ouFinal, ouHold, topScore };
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
  if (!rec || !rec.markets) throw new Error("Pas de marché pour ce tournoi.");
  if (marketsClosed(rec)) throw new Error("Le marché est fermé : le tournoi a commencé.");
  stake = Math.round(Number(stake) || 0);
  if (stake < TBET_MIN) throw new Error("Mise minimale : " + fmtEuro(TBET_MIN) + ".");
  if (stake > (state.cash || 0)) throw new Error("Cash insuffisant — revends un pari de saison (cash-out) pour obtenir du cash.");
  const marketKey = market === "prop" ? "prop:" + pick : market;
  if ((state.tbets || []).some(b => b.tourneyId === tourneyId && b.marketKey === marketKey))
    throw new Error("Tu as déjà misé sur ce marché.");

  let odds, label, line;
  const frNum = x => String(x).replace(".", ",");
  if (market === "winner") {
    const o = rec.markets.winner.find(x => x.pid === pick);
    if (!o) throw new Error("Sélection inconnue.");
    odds = o.odds; label = "Vainqueur : " + getPlayer(pick).name;
  } else if (market === "run") {
    const o = (rec.markets.run || []).find(x => x.k === pick);
    if (!o) throw new Error("Sélection inconnue.");
    odds = o.odds; label = customPlayer().name + " — " + o.label;
  } else if (market === "ouf") {
    const m = rec.markets.ouFinal;
    if (!m || (pick !== "over" && pick !== "under")) throw new Error("Sélection inconnue.");
    odds = m[pick]; line = m.line;
    label = "Jeux de la finale : " + (pick === "over" ? "plus" : "moins") + " de " + frNum(line);
  } else if (market === "ouh") {
    const m = rec.markets.ouHold;
    if (!m || (pick !== "over" && pick !== "under")) throw new Error("Sélection inconnue.");
    odds = m[pick]; line = m.line;
    label = "Services gagnés du tournoi : " + (pick === "over" ? "plus" : "moins") + " de " + frNum(line) + " %";
  } else if (market === "top") {
    const o = (rec.markets.topScore || []).find(x => x.key === pick);
    if (!o) throw new Error("Sélection inconnue.");
    odds = o.odds; label = "Score de set le plus fréquent : " + pick;
  } else {
    const o = rec.markets.props.find(x => x.code === pick);
    if (!o) throw new Error("Sélection inconnue.");
    odds = o.odds; label = o.label;
  }
  state.cash -= stake;
  const bet = {
    id: state.tbetSeq++, tourneyId, market, marketKey, pick, label, odds, stake, line,
    year: state.year, status: "open", payout: 0,
  };
  state.tbets.push(bet);
  saveState();
  return bet;
}

/* Évalue un défi sur le tournoi réellement joué */
function evalPropReal(rec, code) {
  const t = CALENDAR[rec.index];
  const matches = rec.type === "bracket"
    ? rec.rounds.flat()
    : rec.rr.A.concat(rec.rr.B, rec.sf, [rec.final]);
  const mk = rec.markets;
  if (code === "finale_decider") {
    const final = rec.type === "bracket" ? rec.rounds[rec.rounds.length - 1][0] : rec.final;
    return final.score.length === t.bestOf;
  }
  if (code === "bagel")
    return matches.some(m => m && m.score && m.score.some(s => (s[0] === 6 && s[1] === 0) || (s[0] === 0 && s[1] === 6)));
  if (code === "marathon")
    return matches.some(m => m && m.score && m.score.reduce((s, x) => s + x[0] + x[1], 0) > mk.marathonThreshold);
  if (code === "star_out") {
    const qfIdx = rec.roundsNames.indexOf("QF");
    for (let r = 0; r < qfIdx; r++)
      if (rec.rounds[r].some(m => m.winner !== null && m.winner !== mk.star && (m.p1 === mk.star || m.p2 === mk.star)))
        return true;
    return false;
  }
  if (code === "seeds_out") {
    const r16Idx = rec.roundsNames.indexOf("R16");
    let out = 0;
    mk.top8seeds.forEach(pid => {
      for (let r = 0; r < r16Idx; r++)
        if (rec.rounds[r].some(m => m.winner !== null && m.winner !== pid && (m.p1 === pid || m.p2 === pid))) { out++; break; }
    });
    return out >= 3;
  }
  return false;
}

/* Tous les matchs joués d'un tournoi terminé */
function allMatchesReal(rec) {
  return rec.type === "bracket"
    ? rec.rounds.flat()
    : rec.rr.A.concat(rec.rr.B, rec.sf, [rec.final]);
}

/* Nombre de jeux de la finale réellement jouée */
function finaleGamesReal(rec) {
  const final = rec.type === "bracket" ? rec.rounds[rec.rounds.length - 1][0] : rec.final;
  if (!final || !final.score) return 0;
  return final.score.reduce((s, x) => s + x[0] + x[1], 0);
}

/* % réel de jeux de service gagnés sur l'ensemble du tournoi */
function holdPctReal(rec) {
  let held = 0, total = 0;
  allMatchesReal(rec).forEach(m => {
    if (m && m.sv) { held += m.sv[0]; total += m.sv[1]; }
  });
  return total > 0 ? 100 * held / total : 0;
}

/* Score(s) de set le(s) plus fréquent(s) du tournoi (ex aequo tous gagnants) */
function topScoresReal(rec) {
  const keys = ["6-0", "6-1", "6-2", "6-3", "6-4", "7-5", "7-6"];
  const counts = {};
  keys.forEach(k => { counts[k] = 0; });
  allMatchesReal(rec).forEach(m => {
    if (m && m.score) m.score.forEach(x => {
      const key = Math.max(x[0], x[1]) + "-" + Math.min(x[0], x[1]);
      if (key in counts) counts[key]++;
    });
  });
  const mx = Math.max.apply(null, keys.map(k => counts[k]));
  return mx > 0 ? keys.filter(k => counts[k] === mx) : [];
}

/* Parcours réel du champion : index d'élimination comparable aux lignes du marché */
function realRunIdx(rec) {
  const cp = customPlayer();
  if (!cp) return null;
  if (rec.type === "bracket") {
    if (!rec.entrants.includes(cp.id)) return null;
    for (let r = 0; r < rec.rounds.length; r++)
      if (rec.rounds[r].some(m => m.winner !== null && m.winner !== cp.id && (m.p1 === cp.id || m.p2 === cp.id)))
        return r;
    return rec.rounds.length; // champion du tournoi
  }
  if (!rec.entrants.includes(cp.id)) return null;
  if (rec.recap && rec.recap.champion === cp.id) return 3;
  if (rec.final.p1 === cp.id || rec.final.p2 === cp.id) return 2;
  if (rec.sf.some(m => m.p1 === cp.id || m.p2 === cp.id)) return 1;
  return 0;
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

/* Ce qui s'est réellement passé — le « pourquoi » du gain ou de la perte */
function runLabelReal(rec, runIdx) {
  if (runIdx === null) return "non qualifié pour le tournoi";
  if (rec.type !== "bracket") {
    return ["sorti en poules", "éliminé en demi-finale", "battu en finale", "a gagné le Masters"][runIdx];
  }
  if (runIdx >= rec.rounds.length) return "a gagné le tournoi";
  const names = { R128: "éliminé au 1er tour", R64: rec.roundsNames[0] === "R128" ? "éliminé au 2e tour" : "éliminé au 1er tour",
    R32: "éliminé avant les 8es", R16: "éliminé en 8es de finale", QF: "éliminé en quarts", SF: "éliminé en demi-finale", F: "battu en finale" };
  return names[rec.roundsNames[runIdx]] || "éliminé (" + rec.roundsNames[runIdx] + ")";
}
function tbetResultInfo(rec, b) {
  const t = CALENDAR[rec.index];
  const mk = rec.markets || {};
  if (b.market === "winner")
    return "Vainqueur réel : " + getPlayer(rec.recap.champion).name;
  if (b.market === "run") {
    const cp = customPlayer();
    return (cp ? cp.name + " " : "") + runLabelReal(rec, realRunIdx(rec));
  }
  if (b.market === "ouf")
    return "Finale jouée en " + finaleGamesReal(rec) + " jeux (ligne à " + String(b.line).replace(".", ",") + ")";
  if (b.market === "ouh")
    return "Services gagnés sur le tournoi : " + holdPctReal(rec).toFixed(1).replace(".", ",") + " % (ligne à " + String(b.line).replace(".", ",") + " %)";
  if (b.market === "top") {
    const tops = topScoresReal(rec);
    return "Score le plus fréquent : " + (tops.length ? tops.join(" et ") : "—");
  }
  // Défis fun
  const matches = allMatchesReal(rec).filter(m => m && m.score);
  if (b.pick === "finale_decider") {
    const final = rec.type === "bracket" ? rec.rounds[rec.rounds.length - 1][0] : rec.final;
    return "Finale jouée en " + final.score.length + " sets";
  }
  if (b.pick === "bagel") {
    const n = matches.reduce((s, m) => s + m.score.filter(x => (x[0] === 6 && x[1] === 0) || (x[0] === 0 && x[1] === 6)).length, 0);
    return n > 0 ? n + " set" + (n > 1 ? "s" : "") + " 6-0 infligé" + (n > 1 ? "s" : "") : "Aucun 6-0 dans le tournoi";
  }
  if (b.pick === "marathon") {
    const longest = matches.reduce((mx, m) => Math.max(mx, m.score.reduce((s, x) => s + x[0] + x[1], 0)), 0);
    return "Match le plus long : " + longest + " jeux (seuil " + mk.marathonThreshold + ")";
  }
  if (b.pick === "star_out") {
    const star = mk.star;
    const qfIdx = rec.roundsNames.indexOf("QF");
    let outAt = null;
    for (let r = 0; r < rec.rounds.length; r++)
      if (rec.rounds[r].some(m => m.winner !== null && m.winner !== star && (m.p1 === star || m.p2 === star))) { outAt = r; break; }
    const name = getPlayer(star).name;
    if (outAt === null) return name + " a gagné le tournoi";
    return name + " " + runLabelReal(rec, outAt) + (outAt >= qfIdx ? " (a atteint les quarts)" : "");
  }
  if (b.pick === "seeds_out") {
    const r16Idx = rec.roundsNames.indexOf("R16");
    let out = 0;
    (mk.top8seeds || []).forEach(pid => {
      for (let r = 0; r < r16Idx; r++)
        if (rec.rounds[r].some(m => m.winner !== null && m.winner !== pid && (m.p1 === pid || m.p2 === pid))) { out++; break; }
    });
    return out + " tête" + (out > 1 ? "s" : "") + " de série top 8 tombée" + (out > 1 ? "s" : "") + " avant les 8es (il en fallait 3)";
  }
  return "";
}

/* Résolution des paris de tournoi (appelée à la fin du tournoi) */
function resolveTournamentBets(rec) {
  const open = (state.tbets || []).filter(b => b.tourneyId === rec.id && b.status === "open");
  if (open.length === 0) return [];
  const runIdx = realRunIdx(rec);
  open.forEach(b => {
    let won = false;
    if (b.market === "winner") won = rec.recap.champion === b.pick;
    else if (b.market === "run") won = runIdx !== null && runIdx >= b.pick;
    else if (b.market === "ouf") {
      const g = finaleGamesReal(rec);
      won = b.pick === "over" ? g > b.line : g < b.line;
    } else if (b.market === "ouh") {
      const p = holdPctReal(rec);
      won = b.pick === "over" ? p > b.line : p < b.line;
    } else if (b.market === "top") {
      won = topScoresReal(rec).includes(b.pick);
    } else won = evalPropReal(rec, b.pick);
    b.status = won ? "won" : "lost";
    b.result = tbetResultInfo(rec, b); // le fait réel qui justifie le paiement (ou non)
    if (won) {
      b.payout = Math.round(b.stake * b.odds);
      state.cash = (state.cash || 0) + b.payout;
    }
  });
  return open;
}


/* Prize money total distribué par tournoi (constant) + part attendue du solde
   à un stade donné de la saison (ligne guide du graphique). */
function tournamentPool(t) {
  const prz = PRIZE[PRIZE_BY_TOURNEY[t.id]];
  if (t.cat === "FINALS") return 8 * prz.PARTICIPATION + 12 * prz.RR_WIN + 2 * prz.SF_WIN + prz.F_WIN;
  const counts = t.drawSize === 128
    ? { R128: 64, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1, W: 1 }
    : { R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1, W: 1 };
  return Object.entries(counts).reduce((s, [r, c]) => s + c * (prz[r] || 0), 0);
}
function expectedBankPace() {
  // [{label, value}] : solde attendu (10 000 € × part du pool déjà distribuée)
  const totalPool = CALENDAR.reduce((s, t) => s + tournamentPool(t), 0);
  let cum = 0;
  const out = [{ label: "Départ", value: 0 }];
  CALENDAR.forEach(t => {
    const rec = state.tournaments[t.id];
    if (!rec || rec.status !== "done") return;
    cum += tournamentPool(t);
    out.push({ label: t.city, value: BET_BUDGET * cum / totalPool });
  });
  return out;
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
