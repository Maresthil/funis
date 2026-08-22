/* ============================================================
   Fun'is — Moteur de simulation
   Talents cachés + forme du tournoi + affinités de surface,
   simulation jeu par jeu, tirages, têtes de série, classements.
   ============================================================ */

"use strict";

const STORAGE_KEY = "funis_save_v4";
const BET_BUDGET = 10000;   // budget de paris en début de saison
const BET_PLAYERS = 5;      // nombre de joueurs à parier (dont ton champion)
const CUSTOM_BET = 2000;    // pari automatique et fixe sur ton champion
const ROSTER_SIZE = 127;    // 127 joueurs de plateau + ton champion = 128
const ODDS_SIMS = 120;      // saisons Monte-Carlo pour calibrer les cotes

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
  state = {
    version: 3,
    players: buildPlayers(rawPlayers || DEFAULT_PLAYERS),
    favorites: [],          // les 5 joueurs pariés (mise en avant dans l'UI)
    bets: [],               // [{pid, amount}] — total = BET_BUDGET
    betsPlaced: false,
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

/* ---------- Classements ---------- */
function sortedByPoints() {
  return state.players.slice().sort((a, b) =>
    (state.points[b.id] - state.points[a.id]) ||
    (state.money[b.id] - state.money[a.id]) ||
    (a.id - b.id));
}
function sortedByMoney() {
  return state.players.slice().sort((a, b) =>
    (state.money[b.id] - state.money[a.id]) ||
    (state.points[b.id] - state.points[a.id]) ||
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

/* ---------- Sélection des participants ---------- */
function selectEntrants(tourney) {
  if (tourney.cat === "GC") return state.players.map(p => p.id);
  const ranked = sortedByPointsWithTieShuffle();
  if (tourney.cat === "M1000") return ranked.slice(0, 64);
  if (tourney.cat === "FINALS") return ranked.slice(0, 8);
  return ranked;
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
  sortedPts.forEach(pts => { shuffle(groups.get(pts)).forEach(id => out.push(id)); });
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
    // Open d'Australie : positions totalement tirées au sort
    const order = shuffle(entrantIds);
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
  for (let i = 0; i < size; i++) if (slots[i] === null) slots[i] = rest[r++];
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
  if (t.cat === "FINALS") return startFinals(index);
  const entrants = selectEntrants(t);
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
    entrants, seedsMap, roundsNames: names, rounds,
    currentRound: 0, recap: null,
  };
  state.tournaments[t.id] = record;
  saveState();
  return record;
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
function simulateMatchCore(skA, skB, surfKey, bestOf, withTimeline) {
  const setsToWin = Math.ceil(bestOf / 2);
  const diffAB = baseSkillDiff(skA, skB, surfKey); // >0 : avantage A
  const endDiff = skA.endurance - skB.endurance;
  const menDiff = skA.mental - skB.mental;

  const timeline = withTimeline ? [] : null;
  const sets = [];
  const tiebreaks = {};
  // Statistiques de balles de break (conv = breaks réussis, saved = BB défendues au service)
  const bp = { convA: 0, convB: 0, savedA: 0, savedB: 0 };
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
  return { winA: setsA > setsB, sets, tiebreaks, timeline, bp };
}

function simulateMatch(idA, idB, tourneyRec) {
  const t = CALENDAR[tourneyRec.index];
  const core = simulateMatchCore(
    getPlayer(idA).sk, getPlayer(idB).sk,
    SURFACE_TO_SKILL[t.surface], t.bestOf, true);
  return {
    winner: core.winA ? idA : idB, sets: core.sets, tiebreaks: core.tiebreaks,
    timeline: core.timeline,
    bp: [[core.bp.convA, core.bp.savedA], [core.bp.convB, core.bp.savedB]], // [conv, sauvées] pour p1 puis p2
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
  const res = simulateMatch(match.p1, match.p2, rec);
  match.winner = res.winner;
  match.score = res.sets;
  match.tiebreaks = res.tiebreaks;
  match.bp = res.bp;
  // Propagation au tour suivant
  if (roundIdx + 1 < rec.rounds.length) {
    const next = rec.rounds[roundIdx + 1][Math.floor(matchIdx / 2)];
    if (matchIdx % 2 === 0) next.p1 = res.winner; else next.p2 = res.winner;
  }
  // Avancement de tour
  if (rec.rounds[rec.currentRound].every(m => m.winner !== null)) {
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
  const ranked = sortedByPointsWithTieShuffle();
  const eight = ranked.slice(0, 8);
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

  function rrMatches(group) {
    const ms = [];
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++)
        ms.push({ p1: group[i], p2: group[j], winner: null, score: null });
    return shuffle(ms);
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

  const res = simulateMatch(match.p1, match.p2, rec);
  match.winner = res.winner;
  match.score = res.sets;
  match.tiebreaks = res.tiebreaks;
  match.bp = res.bp;

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
  state.currentIndex = rec.index + 1;
  takeSnapshot(t);
  saveState();
}

/* ---------- Statistiques joueur (cartes) ---------- */
function playerStats(pid) {
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
    if (!m || m.winner === null || (m.p1 !== pid && m.p2 !== pid)) return;
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

  function rankedIds() {
    const dec = allIds.map(i => [pts[i], Math.random(), i]);
    dec.sort((x, y) => (y[0] - x[0]) || (x[1] - y[1]));
    return dec.map(d => d[2]);
  }
  function lean(a, b, surfKey, bestOf) {
    return simulateMatchCore(players[a].sk, players[b].sk, surfKey, bestOf, false).winA ? a : b;
  }

  CALENDAR.forEach(t => {
    const surfKey = SURFACE_TO_SKILL[t.surface];
    const przTable = PRIZE[PRIZE_BY_TOURNEY[t.id]];
    if (t.cat === "FINALS") {
      const eight = rankedIds().slice(0, 8);
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
      const entrants = t.cat === "GC" ? allIds.slice() : rankedIds().slice(0, 64);
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
  if (total !== BET_BUDGET) throw new Error("La répartition doit totaliser " + fmtEuro(BET_BUDGET) + ".");
  bets.forEach(b => { if (b.amount < 100) throw new Error("Mise minimale : 100 € par joueur."); });
  const cp = customPlayer();
  if (cp) {
    const cb = bets.find(b => b.pid === cp.id);
    if (!cb || cb.amount !== CUSTOM_BET) throw new Error("Ton champion porte un pari fixe de " + fmtEuro(CUSTOM_BET) + ".");
  }
  state.bets = bets;
  state.favorites = bets.map(b => b.pid);
  state.betsPlaced = true;
  saveState();
}

/* Valeur actuelle d'un pari / du portefeuille */
function betValue(bet, moneyMap) {
  const m = moneyMap ? (moneyMap[bet.pid] || 0) : (state.money[bet.pid] || 0);
  return bet.amount * m / state.refs[bet.pid];
}
function bankNow() { return state.bets.reduce((s, b) => s + betValue(b), 0); }

/* Historique du solde : valeur du portefeuille après chaque tournoi terminé. */
function bankHistory() {
  const cum = {};
  state.bets.forEach(b => { cum[b.pid] = 0; });
  const out = [{ label: "Départ", value: 0 }];
  CALENDAR.forEach(t => {
    const rec = state.tournaments[t.id];
    if (!rec || rec.status !== "done") return;
    state.bets.forEach(b => {
      const r = rec.recap.results[b.pid];
      if (r) cum[b.pid] += r.money;
    });
    out.push({
      label: t.city,
      value: state.bets.reduce((s, b) => s + betValue(b, cum), 0),
    });
  });
  return out;
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
