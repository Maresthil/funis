/* ============================================================
   Fun'is — Interface
   Navigation, calendrier, tableaux zoomables, match en direct,
   récap, classements, historique, favoris, import CSV.
   ============================================================ */

"use strict";

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/* Drapeaux : les emojis de pays sont rendus en vraies images de drapeaux
   (plus graphique, et Windows n'affiche pas les emojis drapeaux).
   Les emblèmes non-pays (⚡ 🏹 🍄 …) restent des emojis. */
function flagHTML(e) {
  if (!e) return "";
  const cps = Array.from(e);
  if (cps.length === 2) {
    const a = cps[0].codePointAt(0), b = cps[1].codePointAt(0);
    if (a >= 0x1F1E6 && a <= 0x1F1FF && b >= 0x1F1E6 && b <= 0x1F1FF) {
      const code = String.fromCharCode(a - 0x1F1E6 + 97, b - 0x1F1E6 + 97);
      return `<img class="flag-img" src="https://flagcdn.com/${code}.svg" alt="${e}" loading="lazy" onerror="this.outerHTML=this.alt">`;
    }
  }
  return e;
}

let currentView = "season";
let viewParams = {};

/* ============================================================
   DÉMARRAGE
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const loaded = loadState();
  if (loaded && loaded.betsPlaced) {
    showMain();
  } else if (loaded && loaded.players) {
    if (loaded.pendingUpgrade) showOnboarding("upgrade");
    else showOnboarding(loaded.players.length >= ROSTER_SIZE + 1 ? "bets" : "player");
  } else {
    showOnboarding("roster");
  }

  $$("#mainnav .nav-btn").forEach(b => {
    b.addEventListener("click", () => navigate(b.dataset.nav));
  });
  $("#bank-chip").addEventListener("click", () => navigate("favorites"));
});

function showMain() {
  $("#screen-onboarding").classList.add("hidden");
  $("#screen-main").classList.remove("hidden");
  navigate("season");
}

function navigate(view, params = {}) {
  currentView = view;
  viewParams = params;
  // Onglet de menu mis en avant, y compris pour les vues tournoi/récap
  let navKey = view;
  if (view === "tournament" || view === "recap") navKey = params.readOnly ? "history" : "season";
  $$("#mainnav .nav-btn").forEach(b => b.classList.toggle("active", b.dataset.nav === navKey));
  updateBankChip();
  const el = $("#view");
  el.innerHTML = "";
  if (view === "season") renderSeason(el);
  else if (view === "tournament") renderTournament(el, params.id, !!params.readOnly);
  else if (view === "recap") renderRecap(el, params.id);
  else if (view === "rankings") renderRankings(el, params.tab || (state.defending ? "atp" : "points"));
  else if (view === "history") renderHistory(el);
  else if (view === "favorites") renderFavorites(el);
  else if (view === "players") renderPlayers(el);
  else if (view === "stats") renderStats(el);
  window.scrollTo({ top: 0 });
}

/* ============================================================
   ONBOARDING — choix du plateau puis des 3 favoris
   ============================================================ */
function showOnboarding(step) {
  $("#screen-main").classList.add("hidden");
  const el = $("#screen-onboarding");
  el.classList.remove("hidden");
  el.innerHTML = "";

  const box = document.createElement("div");
  box.className = "onboard-box";
  box.innerHTML = `
    <div class="onboard-hero">
      <div class="big-logo">FUN<span class="logo-apos">'</span>IS</div>
      <p>La saison ATP ${(typeof state !== "undefined" && state && state.year) || START_YEAR}… disputée par 127 légendes de l'Histoire, des mythes et de la fiction —
      et par <strong>toi</strong>, le 128<sup>e</sup> joueur.
      Grands Chelems, Masters 1000 et Masters final : à qui la place de n°1 mondial ?</p>
    </div>
    <div class="onboard-card" id="onboard-content"></div>`;
  el.appendChild(box);

  if (step === "roster") renderRosterStep($("#onboard-content"));
  else if (step === "player") renderPlayerStep($("#onboard-content"));
  else if (step === "upgrade") renderUpgradeStep($("#onboard-content"));
  else renderBetsStep($("#onboard-content"));
}

/* ---------- Multisaison : ton champion progresse (+3 points) ---------- */
function renderUpgradeStep(container) {
  const cp = customPlayer();
  if (!cp) { renderBetsStep(container); return; }
  const base = Object.assign({}, cp.sk);
  const sk = Object.assign({}, cp.sk);
  const baseTotal = SKILL_KEYS.reduce((s, k) => s + base[k], 0);

  container.innerHTML = `
    <h2>Saison ${state.year} — ${cp.name} progresse 💪</h2>
    <p style="color:#b9cdf1;font-size:13.5px;margin-bottom:14px">
      Une saison d'expérience en plus : répartis <strong>${CHAMPION_SEASON_BONUS} nouveaux points</strong>
      de compétence (chaque compétence reste plafonnée à 10). Le bookmaker recalculera ta cote.</p>
    <div class="bet-slip" style="max-width:520px">
      <h3>⚙️ ${baseTotal} points + ${CHAMPION_SEASON_BONUS} à placer</h3>
      <div class="cp-remaining" id="up-remaining"></div>
      <div id="up-skills"></div>
      <div class="fav-actions">
        <button class="btn btn-gold" id="up-go" disabled>✅ Valider &amp; passer aux paris</button>
      </div>
    </div>`;

  const skillsDiv = $("#up-skills");
  function placed() { return SKILL_KEYS.reduce((s, k) => s + sk[k] - base[k], 0); }
  function draw() {
    skillsDiv.innerHTML = "";
    SKILLS.forEach(s => {
      const gained = sk[s.key] - base[s.key];
      const row = document.createElement("div");
      row.className = "cp-skill-row";
      row.innerHTML = `
        <span class="cp-skill-label">${s.label}${gained ? ` <strong style="color:#7dedaa">+${gained}</strong>` : ""}</span>
        <button class="cp-step" data-k="${s.key}" data-d="-1" ${sk[s.key] <= base[s.key] ? "disabled" : ""}>−</button>
        <span class="cp-skill-val">${sk[s.key]}</span>
        <button class="cp-step" data-k="${s.key}" data-d="1" ${sk[s.key] >= 10 || placed() >= CHAMPION_SEASON_BONUS ? "disabled" : ""}>+</button>
        <span class="cp-skill-bar"><span style="width:${sk[s.key] * 10}%"></span></span>`;
      skillsDiv.appendChild(row);
    });
    skillsDiv.querySelectorAll(".cp-step").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.k, d = parseInt(b.dataset.d, 10);
      if (d > 0 && (sk[k] >= 10 || placed() >= CHAMPION_SEASON_BONUS)) return;
      if (d < 0 && sk[k] <= base[k]) return;
      sk[k] += d;
      draw();
    }));
    const rem = CHAMPION_SEASON_BONUS - placed();
    $("#up-remaining").innerHTML = rem === 0
      ? `<span style="color:#7dedaa">✓ ${CHAMPION_SEASON_BONUS} points de progression répartis</span>`
      : `<span style="color:#ffd977">${rem} point${rem > 1 ? "s" : ""} de progression à placer</span>`;
    $("#up-go").disabled = rem !== 0;
  }
  $("#up-go").addEventListener("click", () => {
    try {
      improveChampion(sk);
      renderBetsStep(container);
    } catch (e) { alert(e.message); }
  });
  draw();
}

function updateBankChip() {
  const chip = $("#bank-chip");
  if (!state || !state.betsPlaced) { chip.classList.add("hidden"); return; }
  chip.classList.remove("hidden");
  const bank = bankNow();
  const pace = expectedBankPace();
  const expected = pace[pace.length - 1].value;
  chip.textContent = "💶 " + fmtEuro(Math.round(bank));
  chip.classList.toggle("up", bank > expected + 1);
  chip.classList.toggle("down", bank < expected - 1);
}

function renderRosterStep(container) {
  container.innerHTML = `
    <h2>1 · Choisis ton plateau — 127 joueurs + ton champion</h2>
    <div class="onboard-choices choices-3">
      <button class="choice" id="choice-default">
        <span class="c-emoji">🏛️</span>
        <div class="c-title">Plateau Fun'is officiel</div>
        <div class="c-desc">127 personnalités ultra-célèbres : rois &amp; reines, dieux, politiques,
        artistes, aventuriers, sportifs et héros de fiction — 30 % de Français.
        Compétences retirées au sort à chaque saison.</div>
      </button>
      <button class="choice" id="choice-atp">
        <span class="c-emoji">🎾</span>
        <div class="c-title">Top 128 ATP réel</div>
        <div class="c-desc">Le top 127 du vrai classement ATP, de Sinner à Ofner.
        Niveaux fixes selon le rang (99 → 75) avec les spécialités de chaque nation
        (Argentins sur terre, Britanniques sur gazon…) — les cotes en tiennent compte.</div>
      </button>
      <button class="choice" id="choice-csv">
        <span class="c-emoji">📄</span>
        <div class="c-title">Importer un fichier CSV</div>
        <div class="c-desc">Ton propre plateau : 127 lignes « Nom;Drapeau;Catégorie;FR » (le 128e joueur, c'est toi !).
        Si les 10 colonnes de compétences (1-10) sont remplies elles sont utilisées telles
        quelles, sinon elles sont tirées au sort (total 70).</div>
      </button>
    </div>
    <div class="csv-help">
      💡 <a href="#" id="csv-template" style="color:#4aa8ff">Télécharger un modèle CSV</a>
      (séparateur « ; » ou « , », entête facultative)
    </div>
    <div class="csv-error hidden" id="csv-error"></div>
    <input type="file" id="csv-input" accept=".csv,.txt" class="hidden">`;

  $("#choice-default").addEventListener("click", () => {
    newSeason(DEFAULT_PLAYERS);
    renderPlayerStep(container);
  });
  $("#choice-atp").addEventListener("click", () => {
    newSeason(ATP_PLAYERS);
    renderPlayerStep(container);
  });
  $("#choice-csv").addEventListener("click", () => $("#csv-input").click());
  $("#csv-input").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const roster = parseCSV(reader.result);
        newSeason(roster);
        renderPlayerStep(container);
      } catch (err) {
        const errEl = $("#csv-error");
        errEl.textContent = "⚠️ " + err.message;
        errEl.classList.remove("hidden");
      }
    };
    reader.readAsText(file, "UTF-8");
  });
  $("#csv-template").addEventListener("click", e => {
    e.preventDefault();
    const rows = ["Nom;Drapeau;Categorie;FR;Terre;Gazon;Dur;Indoor;Force;Endurance;Adresse;Tactique;Service;Mental"];
    DEFAULT_PLAYERS.forEach(p => {
      const sk = generateSkills(p.cat);
      rows.push(`${p.name};${p.flag};${p.cat};${p.fr ? "oui" : "non"};` + SKILL_KEYS.map(k => sk[k]).join(";"));
    });
    const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "funis_joueurs_modele.csv";
    a.click();
  });
}

/* ---------- Étape 2 : création de ton champion (le 128e joueur) ---------- */
const CLASSEMENTS_FR = ["40", "30/5", "30/4", "30/3", "30/2", "30/1", "30",
  "15/5", "15/4", "15/3", "15/2", "15/1", "15",
  "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6", "-15"];

function renderPlayerStep(container) {
  const sk = {};
  SKILL_KEYS.forEach(k => { sk[k] = 8; }); // départ à 80, 5 points bonus à placer (total 85)

  const countryOptions = Object.entries(COUNTRY_NAMES)
    .sort((a, b) => a[1].localeCompare(b[1], "fr"))
    .map(([flag, name]) => `<option value="${flag}" ${flag === "🇫🇷" ? "selected" : ""}>${name}</option>`)
    .join("");

  container.innerHTML = `
    <h2>2 · Crée ton champion — le 128<sup>e</sup> joueur</h2>
    <p style="color:#b9cdf1;font-size:13.5px;margin-bottom:14px">
      C'est toi qui entres sur le circuit avec un avantage : <strong>${CUSTOM_SKILL_TOTAL} points</strong>
      de compétences (contre 70 pour le plateau), chacune de 1 à 10.
      Un pari de ${fmtEuro(CUSTOM_BET)} sera automatiquement placé sur toi — le bookmaker ajustera ta cote. 🎾</p>
    <div class="create-layout">
      <div>
        <label class="cp-label">Prénom</label>
        <input class="cp-input" id="cp-prenom" placeholder="Sébastien" maxlength="20">
        <label class="cp-label">Nom</label>
        <input class="cp-input" id="cp-nom" placeholder="Comte" maxlength="24">
        <label class="cp-label">Club</label>
        <input class="cp-input" id="cp-club" placeholder="TC Villeurbanne" maxlength="30">
        <label class="cp-label">Nationalité</label>
        <select class="cp-input" id="cp-pays">${countryOptions}</select>
        <label class="cp-label">Classement (de 40 à -15)</label>
        <select class="cp-input" id="cp-classement">
          ${CLASSEMENTS_FR.map(c => `<option ${c === "15/2" ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </div>
      <div class="bet-slip">
        <h3>⚙️ Tes ${CUSTOM_SKILL_TOTAL} points de compétences</h3>
        <div class="cp-remaining" id="cp-remaining"></div>
        <div id="cp-skills"></div>
      </div>
    </div>
    <div class="fav-actions">
      <button class="btn btn-gold" id="cp-go" disabled>✅ Valider mon champion</button>
    </div>`;

  const skillsDiv = $("#cp-skills");
  function total() { return SKILL_KEYS.reduce((s, k) => s + sk[k], 0); }
  function draw() {
    skillsDiv.innerHTML = "";
    SKILLS.forEach(s => {
      const row = document.createElement("div");
      row.className = "cp-skill-row";
      row.innerHTML = `
        <span class="cp-skill-label">${s.label}</span>
        <button class="cp-step" data-k="${s.key}" data-d="-1" ${sk[s.key] <= 1 ? "disabled" : ""}>−</button>
        <span class="cp-skill-val">${sk[s.key]}</span>
        <button class="cp-step" data-k="${s.key}" data-d="1" ${sk[s.key] >= 10 || total() >= CUSTOM_SKILL_TOTAL ? "disabled" : ""}>+</button>
        <span class="cp-skill-bar"><span style="width:${sk[s.key] * 10}%"></span></span>`;
      skillsDiv.appendChild(row);
    });
    skillsDiv.querySelectorAll(".cp-step").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.k, d = parseInt(b.dataset.d, 10);
      const t = total();
      if (d > 0 && (sk[k] >= 10 || t >= CUSTOM_SKILL_TOTAL)) return;
      if (d < 0 && sk[k] <= 1) return;
      sk[k] += d;
      draw(); update();
    }));
    const rem = CUSTOM_SKILL_TOTAL - total();
    $("#cp-remaining").innerHTML = rem === 0
      ? `<span style="color:#7dedaa">✓ ${CUSTOM_SKILL_TOTAL} / ${CUSTOM_SKILL_TOTAL} points répartis</span>`
      : `<span style="color:#ffd977">${rem} point${rem > 1 ? "s" : ""} restant${rem > 1 ? "s" : ""} à placer</span>`;
  }
  function update() {
    const name = ($("#cp-prenom").value.trim() + " " + $("#cp-nom").value.trim()).trim();
    $("#cp-go").disabled = !(name.length >= 3 && total() === CUSTOM_SKILL_TOTAL);
  }
  ["cp-prenom", "cp-nom"].forEach(id => $("#" + id).addEventListener("input", update));
  $("#cp-go").addEventListener("click", () => {
    const name = ($("#cp-prenom").value.trim() + " " + $("#cp-nom").value.trim()).trim();
    addCustomPlayer({
      name,
      flag: $("#cp-pays").value,
      club: $("#cp-club").value,
      classement: $("#cp-classement").value,
      sk,
    });
    renderBetsStep(container);
  });
  draw(); update();
}

function renderBetsStep(container) {
  container.innerHTML = `
    <h2>3 · Place tes paris — ${fmtEuro(BET_BUDGET)} sur 5 joueurs</h2>
    <div class="odds-loading"><span class="spin">🎾</span><br>
      Le bookmaker simule ${ODDS_SIMS} saisons complètes pour calculer les cotes…</div>`;
  setTimeout(() => {
    ensureRefs();
    drawBetsUI(container);
  }, 60);
}

function drawBetsUI(container) {
  // pid -> montant ; ton champion est toujours dans le ticket, à 2 000 € fixes
  const cp = customPlayer();
  const slip = new Map(state.bets.map(b => [b.pid, b.amount]));
  if (cp && !slip.has(cp.id)) slip.set(cp.id, CUSTOM_BET);

  container.innerHTML = `
    <h2>3 · Place tes paris — ${fmtEuro(BET_BUDGET)} sur 5 joueurs</h2>
    <p style="color:#b9cdf1;font-size:13.5px;margin-bottom:14px">
      Gain d'un pari = mise × <strong>prize money réel / prize money attendu</strong> du joueur.
      La cote indique le rapport si le joueur réalise une saison moyenne du plateau :
      parier un cador rapporte peu par euro, un outsider peut tout multiplier. 💶
      Espérance globale : ${fmtEuro(BET_BUDGET)} — à toi de battre le bookmaker.
      <strong>Pas obligé de tout miser</strong> : ce que tu ne mises pas reste en cash,
      pour les paris de tournoi. 🎰</p>
    <div class="bets-layout">
      <div>
        <input class="fav-search" id="bet-search" placeholder="🔍 Rechercher un joueur…">
        <div class="fav-grid" id="bet-grid" style="max-height:420px"></div>
      </div>
      <div class="bet-slip">
        <h3>🎫 Ton ticket</h3>
        <div id="slip-rows"></div>
        <div class="bet-total" id="slip-total"></div>
        <div class="fav-actions">
          <button class="btn btn-gold" id="bets-go" disabled>🎾 Valider &amp; lancer la saison</button>
          <button class="btn btn-ghost btn-sm" id="bets-even">⚖️ Répartir également</button>
          <button class="btn btn-ghost btn-sm" id="bets-random">🎲 Ticket au hasard</button>
        </div>
      </div>
    </div>`;

  const grid = $("#bet-grid");
  function drawGrid(filter = "") {
    grid.innerHTML = "";
    const f = filter.toLowerCase();
    state.players
      .filter(p => !p.custom) // ton champion est déjà dans le ticket
      .sort((a, b) => betOdds(b.id) - betOdds(a.id))
      .filter(p => p.name.toLowerCase().includes(f) || p.cat.toLowerCase().includes(f))
      .forEach(p => {
        const b = document.createElement("button");
        b.className = "fav-item" + (slip.has(p.id) ? " selected" : "");
        b.innerHTML = `<span class="f-flag">${flagHTML(p.flag)}</span>
          <span style="flex:1"><strong>${p.name}</strong><span class="f-cat">${p.cat}</span></span>
          <span class="odds-badge">×${betOdds(p.id).toFixed(2)}</span>
          <span class="mini-card-btn" title="Voir la carte de ${p.name}">🪪</span>`;
        b.addEventListener("click", () => {
          if (slip.has(p.id)) slip.delete(p.id);
          else if (slip.size < BET_PLAYERS) slip.set(p.id, 0);
          if (slip.size) spreadEvenly(); // répartition auto, modifiable ensuite
          refresh();
        });
        // Consulter la carte du joueur avant de miser (sans le sélectionner)
        b.querySelector(".mini-card-btn").addEventListener("click", e => {
          e.stopPropagation();
          openPlayerCard(p.id);
        });
        grid.appendChild(b);
      });
  }

  function spreadEvenly() {
    // Le champion garde ses 2 000 € fixes ; le reste est réparti sur les autres
    const others = Array.from(slip.keys()).filter(pid => !cp || pid !== cp.id);
    if (cp) slip.set(cp.id, CUSTOM_BET);
    const pool = BET_BUDGET - (cp ? CUSTOM_BET : 0);
    if (others.length === 0) return;
    const base = Math.floor(pool / others.length / 100) * 100;
    let rest = pool - base * others.length;
    others.forEach(pid => {
      let a = base;
      if (rest >= 100) { a += 100; rest -= 100; }
      slip.set(pid, a);
    });
  }

  function drawSlip() {
    const rows = $("#slip-rows");
    rows.innerHTML = "";
    if (slip.size <= (cp ? 1 : 0)) {
      rows.innerHTML = cp ? "" : `<div class="bet-empty">Sélectionne ${BET_PLAYERS} joueurs dans la liste — les cotes ×élevées sont les outsiders.</div>`;
    }
    slip.forEach((amount, pid) => {
      const p = getPlayer(pid);
      const isCustom = cp && pid === cp.id;
      const row = document.createElement("div");
      row.className = "bet-row";
      row.innerHTML = `
        <span class="f-flag">${flagHTML(p.flag)}</span>
        <span class="br-name">${p.name}${isCustom ? " 🎾" : ""}
          <span class="br-odds">${isCustom ? "ton champion · pari automatique · " : ""}cote ×${betOdds(pid).toFixed(2)} · attendu ${fmtEuro(state.refs[pid])}</span></span>
        <input type="number" min="100" step="100" value="${amount}" ${isCustom ? "disabled" : ""}>
        ${isCustom ? '<span title="Pari fixe">🔒</span>' : '<button class="br-del" title="Retirer">✕</button>'}`;
      if (!isCustom) {
        row.querySelector("input").addEventListener("input", e => {
          slip.set(pid, Math.max(0, Math.round(Number(e.target.value) || 0)));
          drawTotal();
        });
        row.querySelector(".br-del").addEventListener("click", () => { slip.delete(pid); refresh(); });
      }
      rows.appendChild(row);
    });
    if (cp && slip.size < BET_PLAYERS) {
      rows.insertAdjacentHTML("beforeend",
        `<div class="bet-empty">Choisis encore ${BET_PLAYERS - slip.size} joueur(s) pour répartir les ${fmtEuro(BET_BUDGET - CUSTOM_BET)} restants.</div>`);
    }
    drawTotal();
  }

  function drawTotal() {
    const total = Array.from(slip.values()).reduce((s, a) => s + a, 0);
    const ok = slip.size === BET_PLAYERS && total <= BET_BUDGET &&
      Array.from(slip.values()).every(a => a >= 100) &&
      (!cp || slip.get(cp.id) === CUSTOM_BET);
    const el = $("#slip-total");
    el.className = "bet-total " + (ok ? "ok" : "ko");
    const cash = BET_BUDGET - total;
    el.innerHTML = `<span>Total misé</span><span>${fmtEuro(total)} / ${fmtEuro(BET_BUDGET)}</span>` +
      (ok && cash > 0 ? `<span class="bt-cash">💵 ${fmtEuro(cash)} gardés en cash pour les paris de tournoi</span>` : "");
    $("#bets-go").disabled = !ok;
  }

  function refresh() { drawGrid($("#bet-search").value); drawSlip(); }

  $("#bet-search").addEventListener("input", e => drawGrid(e.target.value));
  $("#bets-even").addEventListener("click", () => { if (slip.size) { spreadEvenly(); drawSlip(); } });
  $("#bets-random").addEventListener("click", () => {
    slip.clear();
    if (cp) slip.set(cp.id, CUSTOM_BET);
    const pool = shuffle(state.players.filter(p => !p.custom).map(p => p.id));
    pool.slice(0, BET_PLAYERS - (cp ? 1 : 0)).forEach(pid => slip.set(pid, 0));
    spreadEvenly();
    refresh();
  });
  $("#bets-go").addEventListener("click", () => {
    try {
      placeBets(Array.from(slip.entries()).map(([pid, amount]) => ({ pid, amount })));
      showMain();
    } catch (err) { alert(err.message); }
  });
  refresh();
}

/* ============================================================
   VUE SAISON — calendrier
   ============================================================ */
function newSeasonConfirm() {
  if (confirm("Recommencer une nouvelle carrière de zéro ? La carrière en cours (saisons, palmarès, statistiques) sera effacée.")) {
    resetSeason();
    location.reload();
  }
}

/* Multisaison : enchaîner sur la saison suivante (5 max) */
function goNextSeason() {
  const cp = customPlayer();
  if (!confirm(`Lancer la saison ${state.year + 1} ?\n\nLe plateau retire de nouvelles compétences, la saison démarre avec les classements finaux de ${state.year}` +
    (cp ? `, et ${cp.name} gagne ${CHAMPION_SEASON_BONUS} points de compétence` : "") +
    `. Nouveau budget de paris : ${fmtEuro(BET_BUDGET)}.`)) return;
  try {
    startNextSeason();
    showOnboarding(state.pendingUpgrade ? "upgrade" : "bets");
  } catch (e) { alert(e.message); }
}

function renderSeason(el) {
  const seasonOver = state.currentIndex >= CALENDAR.length;
  const head = document.createElement("div");
  head.className = "season-head";
  head.innerHTML = `
    <div>
      <div class="page-title">Calendrier de la saison ${state.year || START_YEAR}
        <span class="season-badge">Saison ${state.season || 1} / ${MAX_SEASONS}</span></div>
      <div class="page-sub" style="margin-bottom:0">4 Grands Chelems · 9 Masters 1000 · Masters final — de Melbourne à Turin.</div>
    </div>`;
  if (seasonOver && (state.season || 1) < MAX_SEASONS) {
    head.appendChild(mkBtn(`▶ Saison ${(state.year || START_YEAR) + 1}`, "btn btn-gold btn-newseason", goNextSeason));
  } else if (seasonOver) {
    const fin = document.createElement("span");
    fin.className = "season-badge career-over";
    fin.textContent = "🏁 Carrière terminée — " + MAX_SEASONS + " saisons";
    head.appendChild(fin);
  }
  head.appendChild(mkBtn("🔄 Nouvelle carrière", "btn btn-ghost btn-newseason", newSeasonConfirm));
  el.appendChild(head);

  // Palmarès des saisons passées
  const past = (state.career && state.career.seasons) || [];
  if (past.length) {
    const pc = document.createElement("div");
    pc.className = "card career-card";
    pc.innerHTML = `<h3>📜 Palmarès de ta carrière</h3>` + past.map(s => `
      <div class="career-line">
        <span class="cl-year">${s.year}</span>
        <span class="cl-body">n°1 : <strong>${s.no1Flag ? flagHTML(s.no1Flag) + " " : ""}${s.no1}</strong>
          · Masters : ${s.mastersFlag ? flagHTML(s.mastersFlag) + " " : ""}${s.mastersChamp}
          ${s.cpRank ? `· ton champion n°${s.cpRank}${s.cpTitles ? ` (${s.cpTitles} titre${s.cpTitles > 1 ? "s" : ""})` : ""}` : ""}</span>
        <span class="cl-bank ${s.bank >= BET_BUDGET ? "up" : "down"}">${fmtEuro(s.bank)}</span>
      </div>`).join("");
    el.appendChild(pc);
  }

  const grid = document.createElement("div");
  grid.className = "season-grid";

  CALENDAR.forEach((t, i) => {
    const rec = state.tournaments[t.id];
    const done = rec && rec.status === "done";
    const isNext = i === state.currentIndex;
    const locked = i > state.currentIndex;

    const card = document.createElement("div");
    card.className = "card tourney-card" + (locked ? " locked" : "") + (isNext ? " active-t" : "");
    const catBadge = t.cat === "GC" ? `<span class="badge badge-gc">Grand Chelem</span>`
      : t.cat === "M1000" ? `<span class="badge badge-m1000">Masters 1000</span>`
      : `<span class="badge badge-finals">Masters</span>`;
    const surfBadge = `<span class="badge badge-surface-${t.surface}">${t.surfaceLabel}</span>`;
    let statusHtml = "";
    if (done) {
      const champ = getPlayer(rec.recap.champion);
      statusHtml = `<div class="t-champ">🏆 <strong>${flagHTML(champ.flag)} ${champ.name}</strong></div>`;
    } else if (isNext && rec && rec.status === "active") {
      statusHtml = `<div><span class="badge badge-active">En cours</span></div>`;
    } else if (isNext) {
      statusHtml = `<div><span class="badge badge-active">Prochain tournoi</span></div>`;
    } else if (locked) {
      statusHtml = `<div><span class="badge badge-locked">🔒 À venir</span></div>`;
    }
    card.innerHTML = `
      <div class="surface-strip ${t.surface}"></div>
      <div class="t-top">
        <div>
          <div class="t-name">${t.name}</div>
          <div class="t-place">${flagHTML(t.country)} ${t.city} · ${tourneyDates(t)}</div>
        </div>
      </div>
      <div class="t-badges">${catBadge}${surfBadge}
        <span class="badge" style="background:#eef1f6;color:#5d6d88">${t.drawSize} joueurs</span></div>
      ${(() => {
        // Points à défendre (mode carrière) : le tenant du titre, tant que le tournoi n'est pas rejoué
        if (done) return "";
        const dc = defendingChampion(t);
        if (!dc) return "";
        const dp = getPlayer(dc.pid);
        return `<div class="t-defend">🛡 ${flagHTML(dp.flag)} <strong>${dp.name}</strong> défend ${fmtPts(dc.pts)} pts</div>`;
      })()}
      ${statusHtml}
      <div class="t-foot"></div>`;

    const foot = card.querySelector(".t-foot");
    if (done) {
      const b1 = mkBtn("Voir le tableau", "btn btn-ghost btn-sm", () => navigate("tournament", { id: t.id, readOnly: true }));
      const b2 = mkBtn("Récap", "btn btn-sm btn-dark", () => navigate("recap", { id: t.id }));
      foot.append(b1, b2);
    } else if (isNext) {
      const label = rec && rec.status === "active" ? "▶ Reprendre le tournoi" : "▶ Jouer le tournoi";
      foot.appendChild(mkBtn(label, "btn btn-sm", () => {
        if (!state.tournaments[t.id]) startTournament(i);
        navigate("tournament", { id: t.id });
      }));
    }
    grid.appendChild(card);
  });
  el.appendChild(grid);
}

function mkBtn(label, cls, onclick) {
  const b = document.createElement("button");
  b.className = cls;
  b.innerHTML = label;
  b.addEventListener("click", onclick);
  return b;
}

/* ============================================================
   VUE TOURNOI
   ============================================================ */
function renderTournament(el, tid, readOnly) {
  const rec = state.tournaments[tid];
  if (!rec) { navigate("season"); return; }
  const t = CALENDAR[rec.index];

  const head = document.createElement("div");
  head.className = "tourney-header";
  const catBadge = t.cat === "GC" ? "Grand Chelem · 3 sets gagnants"
    : t.cat === "M1000" ? "Masters 1000 · 2 sets gagnants" : "Masters · 2 sets gagnants";
  head.innerHTML = `
    <div>
      <h1>${flagHTML(t.country)} ${t.name}</h1>
      <div class="th-meta">
        <span>${t.city} · ${tourneyDates(t)}</span>
        <span class="badge badge-surface-${t.surface}">${t.surfaceLabel}</span>
        <span class="badge badge-m1000" style="background:rgba(255,255,255,.15);color:#fff">${catBadge}</span>
        ${(() => {
          if (rec.status === "done") return "";
          const dc = defendingChampion(t);
          if (!dc) return "";
          const dp = getPlayer(dc.pid);
          return `<span class="badge badge-defend">🛡 ${dp.name} défend ${fmtPts(dc.pts)} pts</span>`;
        })()}
        ${rec.status === "done" ? '<span class="badge badge-done">Terminé</span>' : ""}
      </div>
    </div>
    <div class="th-actions"></div>`;
  el.appendChild(head);
  const actions = head.querySelector(".th-actions");

  if (rec.status === "done") {
    actions.appendChild(mkBtn("🏆 Récap du tournoi", "btn btn-gold", () => navigate("recap", { id: tid })));
    actions.appendChild(mkBtn("← Saison", "btn btn-ghost", () => navigate("season")));
  } else if (!readOnly) {
    // Un seul bouton : la simulation avance et s'arrête sur chaque match parié
    actions.appendChild(mkBtn("⏭ Simuler le tournoi", "btn", () => {
      const nm = advanceToNextBetMatch(rec);
      if (rec.status === "done") { navigate("recap", { id: tid }); return; }
      navigate("tournament", { id: tid });
      if (nm) openMatchModal(rec, nm);
    }));
    actions.appendChild(mkBtn("← Saison", "btn btn-ghost", () => navigate("season")));
  } else {
    actions.appendChild(mkBtn("← Retour", "btn btn-ghost", () => navigate("history")));
  }

  if (!readOnly && rec.status === "active") renderMarketPanel(el, rec);

  if (rec.type === "finals") { renderFinalsBody(el, rec, readOnly); return; }
  renderBracketBody(el, rec, readOnly);
}

/* ============================================================
   PARIS DE TOURNOI — panneau de marché (ouvert jusqu'au 1er match)
   ============================================================ */
function renderMarketPanel(el, rec) {
  const t = CALENDAR[rec.index];
  const mk = rec.markets;
  if (!mk) return;
  const closed = marketsClosed(rec);
  const myBets = (state.tbets || []).filter(b => b.tourneyId === rec.id);

  const dopedNote = rec.doped !== undefined && rec.doped !== null
    ? `<span class="tbet-chip dope-chip">💉 ${getPlayer(rec.doped).name} boosté</span>` : "";

  // Marché fermé : simple rappel de tes paris en cours sur ce tournoi
  if (closed) {
    if (myBets.length === 0 && !dopedNote) return;
    const strip = document.createElement("div");
    strip.className = "card market-strip";
    strip.innerHTML = `<strong>🎰 Tes paris sur ce tournoi :</strong> ` + myBets.map(b =>
      `<span class="tbet-chip">${b.label} · ${fmtEuro(b.stake)} ×${b.odds.toFixed(2)}
        ${b.status === "won" ? "✅" : b.status === "lost" ? "❌" : "⏳"}</span>`).join(" ") + dopedNote;
    el.appendChild(strip);
    return;
  }

  const panel = document.createElement("div");
  panel.className = "card market-panel";
  panel.innerHTML = `
    <div class="mp-head">
      <h3>🎰 Les paris du tournoi</h3>
      <span class="mp-cash">💵 Cash : <strong>${fmtEuro(Math.round(state.cash || 0))}</strong></span>
      <span class="mp-note">Marché ouvert jusqu'au premier match · cotes calculées sur le tableau réel</span>
    </div>`;

  /* Les repêchés des qualifications (Masters 1000) */
  if (rec.qualifiers && rec.qualifiers.length) {
    const qDiv = document.createElement("div");
    qDiv.className = "mk-block qual-block";
    qDiv.innerHTML = `<div class="mk-title">🎟 Repêchés des qualifications (tirage pondéré au-delà du top ${M1000_DIRECT})</div>
      <div class="mk-row">` + rec.qualifiers.map(pid => {
        const p = getPlayer(pid);
        return `<span class="qual-chip"><span class="q-badge">Q</span> ${flagHTML(p.flag)} ${p.name}
          <span class="qual-rank">n°${currentRank(pid, "points")}</span></span>`;
      }).join("") + `</div>`;
    panel.appendChild(qDiv);
  }

  /* 💉 Encadré dopage : booster un de tes 5 joueurs pour ce tournoi */
  function dopingBox() {
    const box = document.createElement("div");
    box.className = "mk-block doping-block";
    if (rec.doped !== undefined && rec.doped !== null) {
      const p = getPlayer(rec.doped);
      box.innerHTML = `<div class="mk-title">💉 Préparation spéciale</div>
        <div class="dope-info">💉 <strong>${p.name}</strong> est boosté pour ce tournoi : insensible à la fatigue…
        mais <strong>5 % de risque de contrôle positif</strong> à l'arrivée (3 mois de suspension) !</div>`;
      return box;
    }
    const n = state.syringes || 0;
    if (n <= 0) {
      box.innerHTML = `<div class="mk-title">💉 Préparation spéciale</div>
        <div class="dope-info">Plus de seringues cette saison.</div>`;
      return box;
    }
    const cands = (state.favorites || []).filter(pid => rec.entrants.includes(pid));
    if (!cands.length) return null;
    box.innerHTML = `<div class="mk-title">💉 Préparation spéciale — ${n} seringue${n > 1 ? "s" : ""} restante${n > 1 ? "s" : ""}</div>
      <div class="dope-info">Booste un de tes 5 joueurs pour ce tournoi : un vrai coup de pouce, zéro fatigue…
      mais <strong>5 % de risque de contrôle positif</strong> à l'issue du tournoi → 3 mois de suspension.</div>`;
    const row = document.createElement("div");
    row.className = "mk-row";
    cands.forEach(pid => {
      const p = getPlayer(pid);
      const b = document.createElement("button");
      b.className = "mk-chip mk-dope";
      b.innerHTML = `💉 ${flagHTML(p.flag)} ${p.name}`;
      b.addEventListener("click", () => {
        if (!confirm(`Doper ${p.name} pour ${t.name} ?\n\nAvantage pour tout le tournoi et aucune fatigue — mais 5 % de risque de contrôle positif à l'arrivée (3 mois de suspension). Il te restera ${n - 1} seringue${n - 1 > 1 ? "s" : ""}.`)) return;
        try {
          applyDoping(rec.id, pid);
          navigate("tournament", { id: rec.id, section: viewParams.section });
        } catch (e) { alert(e.message); }
      });
      row.appendChild(b);
    });
    box.appendChild(row);
    return box;
  }

  /* 🎫 Détail des paris déjà placés sur ce tournoi */
  function placedList() {
    if (!myBets.length) return null;
    const box = document.createElement("div");
    box.className = "mk-block mk-mybets";
    box.innerHTML = `<div class="mk-title">🎫 Tes paris placés sur ce tournoi</div>`;
    myBets.forEach(b => {
      box.insertAdjacentHTML("beforeend", `
        <div class="tbet-line tbet-open">
          <span class="tbet-status">⏳</span>
          <span class="tbet-body">
            <span class="tbet-label">${b.label}</span>
            <span class="tbet-meta">mise ${fmtEuro(b.stake)} · cote ×${b.odds.toFixed(2)}</span>
          </span>
          <span class="tbet-payout">→ ${fmtEuro(Math.round(b.stake * b.odds))}</span>
        </div>`);
    });
    return box;
  }

  if ((state.cash || 0) < TBET_MIN && myBets.length === 0) {
    panel.insertAdjacentHTML("beforeend", `<div class="mp-empty">
      Il te faut du cash pour parier : va dans <strong>Mes paris</strong> (💶 en haut à droite)
      et revends un de tes paris de saison (cash-out à 80 %) — ou garde une part
      des 10 000 € en cash au départ de la prochaine saison.</div>`);
    const dbEmpty = dopingBox();
    if (dbEmpty) panel.appendChild(dbEmpty);
    el.appendChild(panel);
    return;
  }

  let selection = null; // {market, pick, odds, label}

  function chip(market, pick, label, odds) {
    const key = market === "prop" ? "prop:" + pick : market;
    const taken = myBets.find(b => b.marketKey === key && b.status === "open");
    const b = document.createElement("button");
    const placed = !!taken && (market === "prop" || taken.pick === pick);
    b.className = "mk-chip" + (placed ? " mk-placed" : "");
    b.disabled = !!taken;
    b.innerHTML = placed
      ? `${label} <span class="mk-odds">✔ misé</span>`
      : `${label} <span class="mk-odds">×${odds.toFixed(2)}</span>`;
    if (!taken) b.addEventListener("click", () => {
      selection = { market, pick, odds, label };
      panel.querySelectorAll(".mk-chip").forEach(c => c.classList.remove("mk-selected"));
      b.classList.add("mk-selected");
      updateForm();
    });
    return b;
  }

  function block(title, chips) {
    if (!chips.length) return;
    const div = document.createElement("div");
    div.className = "mk-block";
    div.innerHTML = `<div class="mk-title">${title}</div>`;
    const row = document.createElement("div");
    row.className = "mk-row";
    chips.forEach(c => row.appendChild(c));
    div.appendChild(row);
    panel.appendChild(div);
  }

  block("🏆 Vainqueur du tournoi", mk.winner.map(w => {
    const p = getPlayer(w.pid);
    return chip("winner", w.pid, `${flagHTML(p.flag)} ${p.name}`, w.odds);
  }));
  if (mk.run) {
    const cp = customPlayer();
    block(`🎾 Le parcours de ${cp.name}`, mk.run.map(r => chip("run", r.k, r.label, r.odds)));
  }
  block("🎯 Les défis du bookmaker", mk.props.map(pr => chip("prop", pr.code, pr.label, pr.odds)));

  /* Marchés Over/Under et score fréquent */
  const frNum = x => String(x).replace(".", ",");
  if (mk.ouFinal) {
    block(`📏 Nombre de jeux de la finale — ligne à ${frNum(mk.ouFinal.line)}`, [
      chip("ouf", "over", `Plus de ${frNum(mk.ouFinal.line)} jeux`, mk.ouFinal.over),
      chip("ouf", "under", `Moins de ${frNum(mk.ouFinal.line)} jeux`, mk.ouFinal.under),
    ]);
  }
  if (mk.ouHold) {
    block(`📈 % de jeux de service gagnés sur le tournoi — ligne à ${frNum(mk.ouHold.line)} %`, [
      chip("ouh", "over", `Plus de ${frNum(mk.ouHold.line)} %`, mk.ouHold.over),
      chip("ouh", "under", `Moins de ${frNum(mk.ouHold.line)} %`, mk.ouHold.under),
    ]);
  }
  if (mk.topScore) {
    block("🔢 Le score de set le plus fréquent du tournoi (égalité = gagnant)",
      mk.topScore.map(s => chip("top", s.key, s.key, s.odds)));
  }

  /* Formulaire de mise */
  const form = document.createElement("div");
  form.className = "mk-form";
  form.innerHTML = `
    <span class="mk-sel" id="mk-sel">Choisis un pari ci-dessus…</span>
    <input type="number" id="mk-stake" min="${TBET_MIN}" step="100" placeholder="Mise €" disabled>
    <span class="mk-gain" id="mk-gain"></span>`;
  const betBtn = mkBtn("Parier", "btn btn-sm", () => {
    try {
      placeTournamentBet(rec.id, selection.market, selection.pick, $("#mk-stake").value);
      navigate("tournament", { id: rec.id, section: viewParams.section });
      updateBankChip();
    } catch (e) { alert(e.message); }
  });
  betBtn.disabled = true;
  form.appendChild(betBtn);
  panel.appendChild(form);

  function updateForm() {
    const sel = $("#mk-sel"), stake = $("#mk-stake"), gain = $("#mk-gain");
    if (!selection) return;
    sel.innerHTML = `${selection.label} <span class="mk-odds">×${selection.odds.toFixed(2)}</span>`;
    stake.disabled = false;
    if (!stake.value) stake.value = Math.min(Math.max(TBET_MIN, 100), Math.floor((state.cash || 0) / 100) * 100);
    refreshGain();
    function refreshGain() {
      const v = Math.round(Number(stake.value) || 0);
      const ok = v >= TBET_MIN && v <= (state.cash || 0);
      betBtn.disabled = !ok;
      gain.textContent = ok ? "→ gain potentiel " + fmtEuro(Math.round(v * selection.odds)) : "";
    }
    stake.oninput = refreshGain;
  }

  const pl = placedList();
  if (pl) panel.appendChild(pl);
  const db = dopingBox();
  if (db) panel.appendChild(db);

  el.appendChild(panel);
}

/* ---------- Corps du tableau avec zoom par section ---------- */
function renderBracketBody(el, rec, readOnly) {
  const t = CALENDAR[rec.index];
  const nSections = t.drawSize / 16;
  const sectionRounds = 4; // 16 joueurs -> 4 tours dans la section
  let mode = viewParams.section !== undefined ? viewParams.section : "overview";
  // Si le tournoi a dépassé les tours de section, aller direct en phase finale
  if (viewParams.section === undefined && rec.currentRound >= sectionRounds && rec.status !== "done") mode = "final";

  const nav = document.createElement("div");
  nav.className = "bracket-nav";
  const mkSec = (label, val) => {
    const b = document.createElement("button");
    b.className = "sec-btn" + (mode === val ? " active" : "");
    b.textContent = label;
    b.addEventListener("click", () => { viewParams.section = val; navigate("tournament", { ...viewParams }); });
    return b;
  };
  nav.appendChild(mkSec("🗺 Vue d'ensemble", "overview"));
  nav.appendChild(Object.assign(document.createElement("span"), { className: "sep" }));
  for (let s = 0; s < nSections; s++) nav.appendChild(mkSec("Section " + (s + 1), s));
  nav.appendChild(Object.assign(document.createElement("span"), { className: "sep" }));
  nav.appendChild(mkSec(t.cat === "GC" ? "🏆 Phase finale (QF → F)" : "🏆 Phase finale (SF → F)", "final"));
  el.appendChild(nav);

  const info = document.createElement("div");
  info.className = "page-sub";
  const rn = rec.roundsNames[Math.min(rec.currentRound, rec.roundsNames.length - 1)];
  info.innerHTML = rec.status === "done"
    ? `Tournoi terminé — vainqueur : <strong>${flagHTML(getPlayer(rec.recap.champion).flag)} ${getPlayer(rec.recap.champion).name}</strong>`
    : `Tour en cours : <strong>${roundShortLabel(rn, t.drawSize)}</strong> — clique sur un match en surbrillance pour le jouer 🎾
       <span style="color:#b8860b">· « Simuler le tournoi » avance et s'arrête sur chacun de tes matchs pariés 💶</span>`;
  el.appendChild(info);

  if (mode === "overview") renderOverview(el, rec, nSections);
  else if (mode === "final") renderBracketColumns(el, rec, sectionRounds, rec.roundsNames.length, null, readOnly);
  else renderBracketColumns(el, rec, 0, sectionRounds, mode, readOnly);
}

/* Vue d'ensemble : une carte par section de 16 joueurs */
function renderOverview(el, rec, nSections) {
  const grid = document.createElement("div");
  grid.className = "overview-grid";
  for (let s = 0; s < nSections; s++) {
    const sec = document.createElement("div");
    sec.className = "card overview-sec";
    // Joueurs de la section (via 1er tour)
    const firstRound = rec.rounds[0].slice(s * 8, s * 8 + 8);
    const ids = [];
    firstRound.forEach(m => { ids.push(m.p1, m.p2); });
    const alive = new Set(aliveInSection(rec, s));
    const seeded = ids.filter(id => rec.seedsMap[id]).sort((a, b) => rec.seedsMap[a] - rec.seedsMap[b]);
    const others = ids.filter(id => !rec.seedsMap[id]);
    const show = seeded.concat(others).slice(0, 6);
    sec.innerHTML = `<div class="os-title"><span>Section ${s + 1}</span><span>${alive.size} en lice</span></div>`;
    show.forEach(id => {
      const p = getPlayer(id);
      const div = document.createElement("div");
      div.className = "os-player" + (alive.has(id) ? "" : " out");
      div.innerHTML = `<span>${flagHTML(p.flag)}</span><span>${rec.seedsMap[id] ? "[" + rec.seedsMap[id] + "] " : ""}${p.name}</span>${state.favorites.includes(id) ? '<span class="fav-star">⭐</span>' : ""}`;
      sec.appendChild(div);
    });
    if (ids.length > show.length) {
      const more = document.createElement("div");
      more.className = "os-more";
      more.textContent = "+ " + (ids.length - show.length) + " autres joueurs — cliquer pour zoomer 🔍";
      sec.appendChild(more);
    }
    sec.addEventListener("click", () => { viewParams.section = s; navigate("tournament", { ...viewParams }); });
    grid.appendChild(sec);
  }
  el.appendChild(grid);
}

function aliveInSection(rec, s) {
  // Joueurs de la section encore en course
  const ids = [];
  rec.rounds[0].slice(s * 8, s * 8 + 8).forEach(m => ids.push(m.p1, m.p2));
  const eliminated = new Set();
  rec.rounds.forEach(round => round.forEach(m => {
    if (m.winner !== null) {
      const loser = m.winner === m.p1 ? m.p2 : m.p1;
      eliminated.add(loser);
    }
  }));
  return ids.filter(id => !eliminated.has(id));
}

/* Colonnes du bracket entre roundFrom (inclus) et roundTo (exclus).
   section = index de section (pour filtrer les matchs), ou null pour tout. */
function renderBracketColumns(el, rec, roundFrom, roundTo, section, readOnly) {
  const t = CALENDAR[rec.index];
  const scroll = document.createElement("div");
  scroll.className = "bracket-scroll";
  const bracket = document.createElement("div");
  bracket.className = "bracket";

  for (let r = roundFrom; r < roundTo; r++) {
    const col = document.createElement("div");
    col.className = "b-round";
    col.innerHTML = `<div class="b-round-title">${roundShortLabel(rec.roundsNames[r], t.drawSize)}</div>`;
    const wrap = document.createElement("div");
    wrap.className = "b-matches";

    const matchesInRound = rec.rounds[r];
    let idxs = matchesInRound.map((_, i) => i);
    if (section !== null && section !== undefined) {
      const perSection = matchesInRound.length / (t.drawSize / 16);
      idxs = idxs.filter(i => Math.floor(i / perSection) === section);
    }
    idxs.forEach(i => wrap.appendChild(matchCard(rec, r, i, readOnly)));
    col.appendChild(wrap);
    bracket.appendChild(col);
  }
  scroll.appendChild(bracket);
  el.appendChild(scroll);
}

function matchCard(rec, roundIdx, matchIdx, readOnly) {
  const m = rec.rounds[roundIdx][matchIdx];
  const div = document.createElement("div");
  const playable = !readOnly && rec.status === "active" && m.winner === null && m.p1 !== null && m.p2 !== null && roundIdx === rec.currentRound;
  div.className = "b-match" + (playable ? " playable" : "") + (m.winner !== null ? " done-m" : "");
  div.appendChild(matchRow(rec, m, m.p1, true));
  div.appendChild(matchRow(rec, m, m.p2, false));
  if (playable) {
    div.insertAdjacentHTML("beforeend", `<div class="play-hint">▶</div>`);
    div.addEventListener("click", () => openMatchModal(rec, { kind: "bracket", roundIdx, matchIdx }));
  }
  return div;
}

function matchRow(rec, m, pid, isP1) {
  const row = document.createElement("div");
  if (pid === null) {
    row.className = "b-row";
    row.innerHTML = m.walkover
      ? `<span class="tbd">Exempt (bye) — joueur suspendu 💊</span>`
      : `<span class="tbd">À déterminer…</span>`;
    return row;
  }
  const p = getPlayer(pid);
  const isWinner = m.winner !== null && m.winner === pid;
  const isLoser = m.winner !== null && m.winner !== pid;
  row.className = "b-row" + (isWinner ? " winner-row" : "") + (isLoser ? " loser-row" : "");
  const seed = rec.seedsMap[pid] ? `<span class="seed">${rec.seedsMap[pid]}</span>` : `<span class="seed"></span>`;
  const qBadge = (rec.qualifiers || []).includes(pid) ? `<span class="q-badge" title="Repêché des qualifications">Q</span>` : "";
  const fav = state.favorites.includes(pid) ? `<span class="fav-star">⭐</span>` : "";
  // Icône de forme : celle du match s'il est joué, la forme actuelle sinon
  const fState = m.winner !== null
    ? (isP1 ? m.form1 : m.form2)
    : (rec.status === "active" ? formStatus(pid, rec) : null);
  const fIcon = fState && FORM_META[fState]
    ? `<span class="form-ico" title="${FORM_META[fState].label}">${FORM_META[fState].icon}</span>` : "";
  let score = "";
  if (m.score) {
    score = m.score.map(s => (isP1 ? s[0] : s[1])).join(" ");
  } else if (m.walkover && m.winner === pid) {
    score = "bye";
  }
  row.innerHTML = `${seed}<span class="p-flag">${flagHTML(p.flag)}</span>
    <span class="p-name">${p.name}${qBadge}${isWinner ? " ✓" : ""}</span>${fIcon}${fav}
    <span class="p-score">${score}</span>`;
  if (m.winner !== null) {
    row.classList.add("row-clickable");
    row.title = "Voir la carte de " + p.name;
    row.addEventListener("click", e => { e.stopPropagation(); openPlayerCard(pid); });
  }
  return row;
}

/* ---------- Simulations rapides ----------
   « Simuler le tour » épargne les matchs impliquant les joueurs pariés :
   ceux-là se jouent à la main dans la fenêtre de match. */
function isBetMatch(m) {
  return state.favorites.includes(m.p1) || state.favorites.includes(m.p2);
}
function simulateCurrentRound(rec, force) {
  const r = rec.currentRound;
  rec.rounds[r].forEach((m, i) => {
    if (m.winner === null && m.p1 !== null && m.p2 !== null && (force || !isBetMatch(m)))
      playBracketMatch(rec, r, i);
  });
}
function simulateWholeTournament(rec) {
  let guard = 0;
  while (rec.status === "active" && guard++ < 20) simulateCurrentRound(rec, true);
}
function simulateFinalsPhase(rec, force) {
  if (rec.phase === "rr") {
    ["A", "B"].forEach(g => rec.rr[g].forEach((m, i) => {
      if (m.winner === null && (force || !isBetMatch(m))) playFinalsMatch(rec, "rr", g, i);
    }));
  } else if (rec.phase === "sf") {
    rec.sf.forEach((m, i) => {
      if (m.winner === null && m.p1 !== null && (force || !isBetMatch(m))) playFinalsMatch(rec, "sf", null, i);
    });
  } else if (rec.phase === "final") {
    if (rec.final.winner === null && rec.final.p1 !== null && (force || !isBetMatch(rec.final)))
      playFinalsMatch(rec, "final", null, 0);
  }
}
function simulateWholeFinals(rec) {
  let guard = 0;
  while (rec.status === "active" && guard++ < 40) simulateFinalsPhase(rec, true);
}

/* Prochain match à jouer impliquant un joueur parié (tour/phase en cours) */
function findNextBetMatch(rec) {
  if (rec.status !== "active") return null;
  if (rec.type === "bracket") {
    const r = rec.currentRound;
    for (let i = 0; i < rec.rounds[r].length; i++) {
      const m = rec.rounds[r][i];
      if (m.winner === null && m.p1 !== null && m.p2 !== null && isBetMatch(m))
        return { kind: "bracket", roundIdx: r, matchIdx: i };
    }
    return null;
  }
  // Au Masters, TOUS les matchs se jouent à la main, dans l'ordre des journées
  if (rec.phase === "rr") {
    for (let d = 1; d <= 3; d++) {
      if (!finalsDayPlayable(rec, d)) break;
      for (const g of ["A", "B"]) {
        const idx = rec.rr[g].findIndex(m => m.winner === null && (m.day || 1) === d);
        if (idx !== -1) return { kind: "rr", group: g, matchIdx: idx };
      }
    }
  } else if (rec.phase === "sf") {
    for (let i = 0; i < rec.sf.length; i++) {
      const m = rec.sf[i];
      if (m.winner === null && m.p1 !== null) return { kind: "sf", matchIdx: i };
    }
  } else if (rec.phase === "final") {
    const m = rec.final;
    if (m.winner === null && m.p1 !== null) return { kind: "final" };
  }
  return null;
}

/* Une journée du Masters n'est jouable que si les journées précédentes
   (dans les deux groupes) sont terminées */
function finalsDayPlayable(rec, day) {
  if (day <= 1) return true;
  return rec.rr.A.concat(rec.rr.B)
    .filter(m => (m.day || 1) < day)
    .every(m => m.winner !== null);
}

/* Avance la simulation (matchs non pariés) jusqu'au prochain match parié,
   ou jusqu'à la fin du tournoi. */
function advanceToNextBetMatch(rec) {
  let guard = 0;
  while (rec.status === "active" && guard++ < 60) {
    const nm = findNextBetMatch(rec);
    if (nm) return nm;
    if (rec.type === "bracket") {
      const before = rec.currentRound;
      simulateCurrentRound(rec);
      if (rec.status === "active" && rec.currentRound === before && !findNextBetMatch(rec))
        simulateCurrentRound(rec, true); // sécurité anti-blocage
    } else {
      const before = rec.phase;
      simulateFinalsPhase(rec);
      if (rec.status === "active" && rec.phase === before && !findNextBetMatch(rec))
        simulateFinalsPhase(rec, true);
    }
  }
  return null;
}

/* ============================================================
   ATP FINALS — groupes + phase KO
   ============================================================ */
function renderFinalsBody(el, rec, readOnly) {
  const groupsDiv = document.createElement("div");
  groupsDiv.className = "finals-groups";
  ["A", "B"].forEach(g => {
    const block = document.createElement("div");
    block.className = "card group-block";
    block.innerHTML = `<h3>Groupe ${g === "A" ? "Björn Borg" : "Jimmy Connors"}</h3>`;
    // Classement du groupe
    const st = groupStandings(rec, g);
    const table = document.createElement("table");
    table.className = "data";
    table.innerHTML = `<thead><tr><th>#</th><th>Joueur</th><th class="num">V - D</th><th class="num">Sets</th></tr></thead>`;
    const tbody = document.createElement("tbody");
    st.forEach((s, i) => {
      const p = getPlayer(s.id);
      const tr = document.createElement("tr");
      if (state.favorites.includes(s.id)) tr.className = "fav-row";
      tr.innerHTML = `<td class="rk-pos">${i + 1}</td>
        <td><div class="player-cell"><span class="pc-flag">${flagHTML(p.flag)}</span><span>${p.name} <span class="seed">[${rec.seedsMap[s.id]}]</span></span></div></td>
        <td class="num">${s.w} - ${s.l}</td>
        <td class="num">${s.setsW}-${s.setsL}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    block.appendChild(table);

    // Matchs de poule présentés par journée (J1, J2, J3)
    const rrDiv = document.createElement("div");
    rrDiv.className = "rr-matches";
    [1, 2, 3].forEach(day => {
      const dayHead = document.createElement("div");
      dayHead.className = "rr-day" + (finalsDayPlayable(rec, day) ? "" : " rr-day-locked");
      dayHead.innerHTML = `Journée ${day}${finalsDayPlayable(rec, day) ? "" : " 🔒"}`;
      rrDiv.appendChild(dayHead);
      rec.rr[g].forEach((m, i) => {
        if ((m.day || 1) !== day) return;
        const card = finalsMatchCard(rec, m, () => openMatchModal(rec, { kind: "rr", group: g, matchIdx: i }),
          !readOnly && rec.phase === "rr" && m.winner === null && finalsDayPlayable(rec, day));
        rrDiv.appendChild(card);
      });
    });
    block.appendChild(rrDiv);
    groupsDiv.appendChild(block);
  });
  el.appendChild(groupsDiv);

  // Phase KO
  const koTitle = document.createElement("div");
  koTitle.className = "page-title";
  koTitle.style.fontSize = "24px";
  koTitle.textContent = "Phase finale";
  el.appendChild(koTitle);

  const ko = document.createElement("div");
  ko.className = "finals-ko";
  const sfCol = document.createElement("div");
  sfCol.className = "b-round";
  sfCol.innerHTML = `<div class="b-round-title">Demi-finales</div>`;
  const sfWrap = document.createElement("div");
  sfWrap.className = "b-matches";
  rec.sf.forEach((m, i) => {
    sfWrap.appendChild(finalsMatchCard(rec, m, () => openMatchModal(rec, { kind: "sf", matchIdx: i }),
      !readOnly && rec.phase === "sf" && m.winner === null && m.p1 !== null));
  });
  sfCol.appendChild(sfWrap);
  const fCol = document.createElement("div");
  fCol.className = "b-round";
  fCol.innerHTML = `<div class="b-round-title">Finale</div>`;
  const fWrap = document.createElement("div");
  fWrap.className = "b-matches";
  fWrap.appendChild(finalsMatchCard(rec, rec.final, () => openMatchModal(rec, { kind: "final" }),
    !readOnly && rec.phase === "final" && rec.final.winner === null && rec.final.p1 !== null));
  fCol.appendChild(fWrap);
  ko.append(sfCol, fCol);
  el.appendChild(ko);
}

function finalsMatchCard(rec, m, onPlay, playable) {
  const div = document.createElement("div");
  div.className = "b-match" + (playable ? " playable" : "") + (m.winner !== null ? " done-m" : "");
  div.appendChild(matchRow(rec, m, m.p1, true));
  div.appendChild(matchRow(rec, m, m.p2, false));
  if (playable) {
    div.insertAdjacentHTML("beforeend", `<div class="play-hint">▶</div>`);
    div.addEventListener("click", onPlay);
  }
  return div;
}

/* ============================================================
   FENÊTRE DE MATCH — simulation jeu par jeu animée
   ============================================================ */
let matchAnim = null;

function openMatchModal(rec, ctx) {
  const t = CALENDAR[rec.index];
  // Jouer le match dans le moteur (résultat + timeline)
  let res, m, roundLabel;
  if (ctx.kind === "bracket") {
    m = rec.rounds[ctx.roundIdx][ctx.matchIdx];
    res = playBracketMatch(rec, ctx.roundIdx, ctx.matchIdx);
    roundLabel = roundShortLabel(rec.roundsNames[ctx.roundIdx], t.drawSize);
  } else if (ctx.kind === "rr") {
    m = rec.rr[ctx.group][ctx.matchIdx];
    res = playFinalsMatch(rec, "rr", ctx.group, ctx.matchIdx);
    roundLabel = "Journée " + (m.day || 1) + " — Groupe " + (ctx.group === "A" ? "Björn Borg" : "Jimmy Connors");
  } else if (ctx.kind === "sf") {
    m = rec.sf[ctx.matchIdx];
    res = playFinalsMatch(rec, "sf", null, ctx.matchIdx);
    roundLabel = "Demi-finale";
  } else {
    m = rec.final;
    res = playFinalsMatch(rec, "final", null, 0);
    roundLabel = "FINALE";
  }
  if (!res) return;

  const pA = getPlayer(m.p1), pB = getPlayer(m.p2);
  const fmIco = f => f && FORM_META[f] ? `<span class="form-ico" title="${FORM_META[f].label}">${FORM_META[f].icon}</span>` : "";
  const isFinalMatch = ctx.kind === "final" || (ctx.kind === "bracket" && rec.rounds && ctx.roundIdx === rec.rounds.length - 1);
  const bestOf = t.bestOf;
  const maxSets = bestOf;

  const overlay = $("#modal-overlay");
  const modal = $("#modal-match");
  overlay.classList.remove("hidden");
  modal.innerHTML = `
    <div class="m-head">
      <div>
        <div class="m-round">${roundLabel}</div>
        <div class="m-tourney">${flagHTML(t.country)} ${t.name} · ${t.surfaceLabel}</div>
      </div>
      <button class="m-close" id="m-close">✕</button>
    </div>
    <div class="scoreboard">
      <div class="sb-row" id="sb-A">
        <span class="sb-flag">${flagHTML(pA.flag)}</span>
        <span>
          <span class="sb-name">${rec.seedsMap[m.p1] ? `<span class="seed">[${rec.seedsMap[m.p1]}]</span>` : ""}<span class="name-link" id="link-A" title="Voir la carte de ${pA.name}">${pA.name}</span>
            ${fmIco(m.form1)}${state.favorites.includes(m.p1) ? "💶" : ""}<span class="serve-dot hidden" id="serve-A"></span></span>
          <span class="sb-cat">n°${currentRank(m.p1, "points")} à la race · ${pA.cat}${m.form1 && FORM_META[m.form1] ? " · " + FORM_META[m.form1].label : ""}</span>
        </span>
        <span class="sb-sets" id="sets-A"></span>
      </div>
      <div class="sb-vs-divider"></div>
      <div class="sb-row" id="sb-B">
        <span class="sb-flag">${flagHTML(pB.flag)}</span>
        <span>
          <span class="sb-name">${rec.seedsMap[m.p2] ? `<span class="seed">[${rec.seedsMap[m.p2]}]</span>` : ""}<span class="name-link" id="link-B" title="Voir la carte de ${pB.name}">${pB.name}</span>
            ${fmIco(m.form2)}${state.favorites.includes(m.p2) ? "💶" : ""}<span class="serve-dot hidden" id="serve-B"></span></span>
          <span class="sb-cat">n°${currentRank(m.p2, "points")} à la race · ${pB.cat}${m.form2 && FORM_META[m.form2] ? " · " + FORM_META[m.form2].label : ""}</span>
        </span>
        <span class="sb-sets" id="sets-B"></span>
      </div>
    </div>
    <div id="m-banner"></div>
    <div id="m-next"></div>
    <div class="m-controls">
      <button class="btn btn-sm" id="m-play">▶ Lancer le match</button>
      <div class="speed-group">
        <button class="speed-btn" data-speed="650">x1</button>
        <button class="speed-btn" data-speed="300">x2</button>
        <button class="speed-btn" data-speed="100">Turbo</button>
        <button class="speed-btn" data-speed="0">Instantané</button>
      </div>
    </div>
    <div class="m-commentary" id="m-com"></div>`;

  /* État de replay — la vitesse choisie est mémorisée pour les matchs suivants */
  const savedSpeed = typeof state.matchSpeed === "number" ? state.matchSpeed : 650;
  const replay = {
    events: res.timeline, idx: 0, timer: null, speed: savedSpeed,
    sets: [], curSet: [0, 0], curSetIdx: 0, finished: false, started: false,
  };
  matchAnim = replay;
  $$(".speed-btn").forEach(b => b.classList.toggle("active", parseInt(b.dataset.speed, 10) === savedSpeed));

  function setsCells(who) {
    // who: 'A' | 'B'
    const container = $(who === "A" ? "#sets-A" : "#sets-B");
    container.innerHTML = "";
    const totalShown = Math.min(maxSets, Math.max(replay.sets.length + (replay.finished ? 0 : 1), 1));
    for (let i = 0; i < totalShown; i++) {
      const cell = document.createElement("span");
      let val = "", cls = "sb-set";
      if (i < replay.sets.length) {
        const s = replay.sets[i];
        val = who === "A" ? s.score[0] : s.score[1];
        const won = (who === "A" && s.score[0] > s.score[1]) || (who === "B" && s.score[1] > s.score[0]);
        if (won) cls += " won";
        if (s.tb) cell.innerHTML = `<span class="tb-mini">${who === "A" ? s.tb[0] : s.tb[1]}</span>`;
      } else if (i === replay.sets.length && !replay.finished && replay.started) {
        val = who === "A" ? replay.curSet[0] : replay.curSet[1];
        cls += " current";
      } else {
        val = "·";
      }
      cell.className = cls;
      cell.insertAdjacentText("afterbegin", val);
      container.appendChild(cell);
    }
  }
  function redraw() { setsCells("A"); setsCells("B"); }

  function comment(html, cls = "") {
    const line = document.createElement("div");
    line.className = "com-line " + cls;
    line.innerHTML = html;
    const com = $("#m-com");
    com.prepend(line);
  }

  function applyEvent(ev) {
    if (ev.t === "start") {
      replay.started = true;
      comment(`🎾 Début du match — <strong>${ev.server === "A" ? pA.name : pB.name}</strong> sert en premier`);
      showServer(ev.server);
    } else if (ev.t === "game") {
      replay.curSet = [ev.gA, ev.gB];
      const gName = ev.winner === "A" ? pA.name : pB.name;
      const sc = `<span class="com-score">${ev.gA}-${ev.gB}</span>`;
      if (ev.broke) comment(`${sc} 💥 <strong>BREAK !</strong> ${gName} prend le service adverse`, "break-line");
      else comment(`${sc} Jeu ${gName}`);
      showServer(ev.server === "A" ? "B" : "A"); // le service alterne après le jeu
    } else if (ev.t === "tiebreak") {
      replay.curSet = [ev.gA, ev.gB];
      const gName = ev.winner === "A" ? pA.name : pB.name;
      comment(`<span class="com-score">${ev.gA}-${ev.gB}</span> 🔥 ${ev.target === 10 ? "Super tie-break" : "Tie-break"} remporté par <strong>${gName}</strong> ${ev.pa}-${ev.pb}`, "tb-line");
    } else if (ev.t === "set") {
      replay.sets.push({ score: ev.score, tb: null });
      const last = replay.events.slice(0, replay.idx).reverse().find(e => e.t === "tiebreak" && e.set === ev.set);
      if (last) replay.sets[replay.sets.length - 1].tb = [last.pa, last.pb];
      replay.curSet = [0, 0];
      const sName = ev.winner === "A" ? pA.name : pB.name;
      comment(`🏁 <strong>SET ${sName}</strong> ${ev.score[0]}-${ev.score[1]} — ${ev.setsA} set${ev.setsA > 1 ? "s" : ""} à ${ev.setsB}`, "set-line");
    } else if (ev.t === "end") {
      replay.finished = true;
      const wName = ev.winner === "A" ? pA : pB;
      const scoreStr = formatScore(m, true);
      $("#m-banner").innerHTML = `<div class="m-winner-banner">🏆 <strong>${flagHTML(wName.flag)} ${wName.name}</strong> remporte le match ${scoreStr}</div>`;
      comment(`🏆 Victoire de <strong>${wName.name}</strong>`, "set-line");
      hideServers();
      if (isFinalMatch) launchConfetti();
      const playBtn = $("#m-play");
      playBtn.disabled = false;
      playBtn.textContent = "✓ Fermer";
      playBtn.onclick = closeModal;
      // Enchaînement : match suivant de mes paris / tour suivant / récap
      const nextWrap = $("#m-next");
      nextWrap.innerHTML = "";
      if (rec.status === "done") {
        nextWrap.appendChild(mkBtn("🏆 Voir le récap du tournoi", "btn btn-gold", () => {
          stopTimer(); overlay.classList.add("hidden"); navigate("recap", { id: rec.id });
        }));
      } else {
        const nm = findNextBetMatch(rec);
        if (nm) {
          const label = rec.type === "finals" ? "🎾 Match suivant" : "💶 Match suivant de mes paris";
          nextWrap.appendChild(mkBtn(label, "btn", () => {
            stopTimer(); openMatchModal(rec, nm);
          }));
        } else {
          nextWrap.appendChild(mkBtn("⏩ Tour suivant", "btn", () => {
            stopTimer();
            const nm2 = advanceToNextBetMatch(rec);
            if (nm2) openMatchModal(rec, nm2);
            else { overlay.classList.add("hidden"); navigate(rec.status === "done" ? "recap" : "tournament", { id: rec.id }); }
          }));
        }
      }
    }
    redraw();
  }

  function showServer(who) {
    $("#serve-A").classList.toggle("hidden", who !== "A");
    $("#serve-B").classList.toggle("hidden", who !== "B");
    $("#sb-A").classList.toggle("serving", who === "A");
    $("#sb-B").classList.toggle("serving", who === "B");
  }
  function hideServers() {
    $("#serve-A").classList.add("hidden");
    $("#serve-B").classList.add("hidden");
    $("#sb-A").classList.remove("serving");
    $("#sb-B").classList.remove("serving");
  }

  function step() {
    if (replay.idx >= replay.events.length) { stopTimer(); return; }
    const ev = replay.events[replay.idx++];
    applyEvent(ev);
  }
  function stopTimer() { if (replay.timer) { clearInterval(replay.timer); replay.timer = null; } }
  function start() {
    stopTimer();
    if (replay.speed === 0) { while (replay.idx < replay.events.length) step(); return; }
    replay.timer = setInterval(step, replay.speed);
  }

  $("#m-play").addEventListener("click", function onPlay() {
    this.textContent = "⏸ En cours…";
    this.disabled = true;
    start();
  }, { once: true });

  $$(".speed-btn").forEach(b => b.addEventListener("click", () => {
    $$(".speed-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    replay.speed = parseInt(b.dataset.speed, 10);
    state.matchSpeed = replay.speed; // mémorisée pour les prochains matchs
    saveState();
    if (replay.started && !replay.finished) start();
  }));

  function closeModal() {
    stopTimer();
    overlay.classList.add("hidden");
    matchAnim = null;
    // Rafraîchir la vue derrière
    if (rec.status === "done") navigate("recap", { id: rec.id });
    else navigate("tournament", { id: rec.id, section: viewParams.section });
  }
  $("#m-close").addEventListener("click", closeModal);
  overlay.onclick = e => { if (e.target === overlay) closeModal(); };
  // Consulter la fiche des joueurs avant (ou pendant) le match
  $("#link-A").addEventListener("click", () => openPlayerCard(m.p1));
  $("#link-B").addEventListener("click", () => openPlayerCard(m.p2));

  redraw();
}

function launchConfetti() {
  const emojis = ["🎉", "✨", "🎊", "🏆", "🎾"];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    c.style.left = Math.random() * 100 + "vw";
    c.style.animationDuration = (2 + Math.random() * 2.5) + "s";
    c.style.animationDelay = Math.random() * .8 + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 6000);
  }
}

/* ============================================================
   RÉCAP DE TOURNOI
   ============================================================ */
function renderRecap(el, tid) {
  const rec = state.tournaments[tid];
  if (!rec || !rec.recap) { navigate("season"); return; }
  const t = CALENDAR[rec.index];
  const champ = getPlayer(rec.recap.champion);

  const hero = document.createElement("div");
  hero.className = "recap-hero";
  let finalist = null, finalScore = "";
  if (rec.type === "bracket") {
    const f = rec.rounds[rec.rounds.length - 1][0];
    finalist = getPlayer(f.winner === f.p1 ? f.p2 : f.p1);
    finalScore = formatScore(f, true);
  } else {
    finalist = getPlayer(rec.final.winner === rec.final.p1 ? rec.final.p2 : rec.final.p1);
    finalScore = formatScore(rec.final, true);
  }
  hero.innerHTML = `
    <div class="r-trophy">🏆</div>
    <div class="r-label">${flagHTML(t.country)} ${t.name} — Champion</div>
    <div class="r-champ">${flagHTML(champ.flag)} ${champ.name}</div>
    <div class="r-detail">bat ${flagHTML(finalist.flag)} ${finalist.name} en finale · ${finalScore}</div>`;
  el.appendChild(hero);

  const grid = document.createElement("div");
  grid.className = "recap-grid";

  /* Bloc gains des meilleurs */
  const top = document.createElement("div");
  top.className = "card recap-block";
  top.innerHTML = `<h3>💰 Points &amp; prize money attribués</h3>`;
  const table = document.createElement("table");
  table.className = "data";
  table.innerHTML = `<thead><tr><th>Joueur</th><th>Résultat</th><th class="num">Points ATP</th><th class="num">Prize money</th></tr></thead>`;
  const tbody = document.createElement("tbody");
  const entries = Object.entries(rec.recap.results)
    .map(([pid, r]) => ({ pid: parseInt(pid, 10), ...r }))
    .sort((a, b) => (b.pts - a.pts) || (b.money - a.money));
  entries.slice(0, 16).forEach(e => {
    const p = getPlayer(e.pid);
    const tr = document.createElement("tr");
    if (state.favorites.includes(e.pid)) tr.className = "fav-row";
    const label = e.round === "W" ? "🏆 Vainqueur"
      : e.round === "F" ? "Finaliste"
      : rec.type === "finals" ? (e.round === "SF" ? "Demi-finaliste" : `${e.rrWins} v. en poule`)
      : roundShortLabel(e.round, t.drawSize) + " (élim.)";
    tr.innerHTML = `<td><div class="player-cell"><span class="pc-flag">${flagHTML(p.flag)}</span><span>${p.name}</span></div></td>
      <td>${label}</td>
      <td class="num"><strong>+${fmtPts(e.pts)}</strong></td>
      <td class="num">${fmtEuro(e.money)}</td>`;
    tr.classList.add("row-clickable");
    tr.addEventListener("click", () => openPlayerCard(e.pid));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  top.appendChild(table);
  grid.appendChild(top);

  /* Bloc paris */
  const right = document.createElement("div");
  right.className = "card recap-block";
  right.innerHTML = `<h3>💶 Tes paris sur ce tournoi</h3>`;
  const favT = document.createElement("table");
  favT.className = "data";
  favT.innerHTML = `<thead><tr><th>Pari</th><th>Résultat</th><th class="num">Prize</th><th class="num">Pour ta cagnotte</th></tr></thead>`;
  const favB = document.createElement("tbody");
  let recapGain = 0;
  state.bets.forEach(bet => {
    const p = getPlayer(bet.pid);
    const r = rec.recap.results[bet.pid];
    const tr = document.createElement("tr");
    tr.className = "row-clickable";
    tr.addEventListener("click", () => openPlayerCard(bet.pid));
    if (bet.sold && bet.sold.atIndex <= rec.index) {
      tr.innerHTML = `<td><div class="player-cell"><span class="pc-flag">${flagHTML(p.flag)}</span><span>${p.name}</span></div></td>
        <td colspan="3" style="color:#b8860b">💰 Pari revendu au bookmaker</td>`;
      favB.appendChild(tr);
      return;
    }
    if (r) {
      const label = r.round === "W" ? "🏆 Vainqueur" : r.round === "F" ? "Finaliste"
        : rec.type === "finals" ? (r.round === "SF" ? "Demi-finaliste" : `${r.rrWins} v. en poule`)
        : roundShortLabel(r.round, t.drawSize);
      const gain = bet.amount * r.money / state.refs[bet.pid];
      recapGain += gain;
      tr.innerHTML = `<td><div class="player-cell"><span class="pc-flag">${flagHTML(p.flag)}</span><span>${p.name}</span></div></td>
        <td>${label}</td><td class="num">${fmtEuro(r.money)}</td>
        <td class="num"><strong style="color:var(--green)">+${fmtEuro(Math.round(gain))}</strong></td>`;
    } else {
      tr.innerHTML = `<td><div class="player-cell"><span class="pc-flag">${flagHTML(p.flag)}</span><span>${p.name}</span></div></td>
        <td colspan="3" style="color:#9aa7ba">Non qualifié pour ce tournoi</td>`;
    }
    favB.appendChild(tr);
  });
  favT.appendChild(favB);
  right.appendChild(favT);
  right.insertAdjacentHTML("beforeend", `<p style="font-size:13px;margin-top:8px">
    Cagnotte : <strong>+${fmtEuro(Math.round(recapGain))}</strong> sur ce tournoi ·
    solde total : <strong>${fmtEuro(Math.round(bankNow()))}</strong></p>`);

  /* Résultats des paris de tournoi */
  const tbets = (rec.recap.tbets || []);
  if (tbets.length) {
    const net = tbets.reduce((s, b) => s + (b.payout || 0) - b.stake, 0);
    right.insertAdjacentHTML("beforeend", `<h3 style="margin-top:14px">🎰 Tes paris du tournoi</h3>`);
    tbets.forEach(b => {
      right.insertAdjacentHTML("beforeend", `
        <div class="tbet-line tbet-${b.status}">
          <span class="tbet-status">${b.status === "won" ? "✅" : "❌"}</span>
          <span class="tbet-body">
            <span class="tbet-label">${b.label}</span>
            <span class="tbet-meta">mise ${fmtEuro(b.stake)} · cote ×${b.odds.toFixed(2)}</span>
            ${b.result ? `<span class="tbet-result">→ ${b.result}</span>` : ""}
          </span>
          <span class="tbet-payout">${b.status === "won" ? "+" + fmtEuro(b.payout) : "−" + fmtEuro(b.stake)}</span>
        </div>`);
    });
    right.insertAdjacentHTML("beforeend", `<p style="font-size:13px;margin-top:6px">
      Bilan des paris de tournoi : <strong style="color:${net >= 0 ? "var(--green)" : "var(--red)"}">${net >= 0 ? "+" : "−"}${fmtEuro(Math.abs(net))}</strong></p>`);
  }

  /* Contrôle antidopage */
  if (rec.doped !== undefined && rec.doped !== null) {
    const dp = getPlayer(rec.doped);
    right.insertAdjacentHTML("beforeend", rec.dopingControl
      ? `<div class="dope-result dope-positive">🚨 <strong>Contrôle antidopage positif !</strong>
          ${flagHTML(dp.flag)} ${dp.name} est contrôlé à l'issue du tournoi… et suspendu <strong>3 mois</strong>.</div>`
      : `<div class="dope-result dope-negative">💉 ${flagHTML(dp.flag)} ${dp.name} était boosté —
          contrôle antidopage <strong>négatif</strong>, personne n'a rien vu. 😮‍💨</div>`);
  }

  /* Nouveaux n°1 */
  const leaders = sortedByPoints();
  const moneyLeaders = sortedByMoney();
  const atpLeader = state.defending ? sortedByRolling()[0] : null;
  right.insertAdjacentHTML("beforeend", `
    <h3 style="margin-top:18px">📊 Après le tournoi</h3>
    <p style="font-size:13.5px">
      ${atpLeader ? `N°1 mondial (12 mois) : <strong>${flagHTML(atpLeader.flag)} ${atpLeader.name}</strong> (${fmtPts(rollingPoints(atpLeader.id))} pts)<br>` : ""}
      N°1 de la race : <strong>${flagHTML(leaders[0].flag)} ${leaders[0].name}</strong> (${fmtPts(state.points[leaders[0].id])} pts)<br>
      Leader prize money : <strong>${flagHTML(moneyLeaders[0].flag)} ${moneyLeaders[0].name}</strong> (${fmtEuro(state.money[moneyLeaders[0].id])})
    </p>`);
  grid.appendChild(right);
  el.appendChild(grid);

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:12px;flex-wrap:wrap";
  actions.appendChild(mkBtn("📋 Voir le tableau final", "btn btn-ghost", () => navigate("tournament", { id: tid, readOnly: true })));
  actions.appendChild(mkBtn("📈 Classements", "btn btn-ghost", () => navigate("rankings")));
  if (state.currentIndex < CALENDAR.length) {
    const next = CALENDAR[state.currentIndex];
    actions.appendChild(mkBtn(`▶ Tournoi suivant : ${next.name}`, "btn btn-gold", () => {
      if (!state.tournaments[next.id]) startTournament(state.currentIndex);
      navigate("tournament", { id: next.id });
    }));
  } else {
    actions.appendChild(mkBtn("🏆 Bilan final de la saison", "btn btn-gold", () => navigate("rankings")));
    if ((state.season || 1) < MAX_SEASONS)
      actions.appendChild(mkBtn(`▶ Saison ${(state.year || START_YEAR) + 1}`, "btn", goNextSeason));
  }
  el.appendChild(actions);
}

/* ============================================================
   CLASSEMENTS
   ============================================================ */
function renderRankings(el, tab) {
  const careerMode = !!state.defending; // saison 2+ : le glissant existe
  if (tab === "atp" && !careerMode) tab = "points";
  const cutNote = tab === "atp"
    ? "— — ligne dorée : top 56 = entrée directe en Masters 1000"
    : tab === "points"
      ? (careerMode ? "— — ligne dorée : top 8 = qualification au Masters de Turin"
        : "— — ligne dorée : qualification (top 56 Masters 1000 / top 8 Masters)")
      : "";
  el.insertAdjacentHTML("beforeend", `
    <div class="page-title">Classements ${state.year || START_YEAR}</div>
    <div class="page-sub">${careerMode
      ? "Classement ATP glissant sur 12 mois (entrées &amp; têtes de série), race de l'année (Masters de Turin) et prize money."
      : "Race ATP et prize money — l'évolution est calculée par rapport au tournoi précédent."}
      ${cutNote ? `<span class="cut-note">${cutNote}</span>` : ""}</div>`);

  const tabs = document.createElement("div");
  tabs.className = "rank-tabs";
  if (careerMode)
    tabs.appendChild(mkBtn("🌍 Classement ATP", "rank-tab" + (tab === "atp" ? " active" : ""), () => navigate("rankings", { tab: "atp" })));
  tabs.appendChild(mkBtn(`🎾 Race ${state.year || START_YEAR}`, "rank-tab" + (tab === "points" ? " active" : ""), () => navigate("rankings", { tab: "points" })));
  tabs.appendChild(mkBtn(careerMode ? "💰 Prize money carrière" : "💰 Prize money", "rank-tab" + (tab === "money" ? " active" : ""), () => navigate("rankings", { tab: "money" })));
  el.appendChild(tabs);

  const card = document.createElement("div");
  card.className = "card rank-card";
  const table = document.createElement("table");
  table.className = "data";
  const isMoney = tab === "money";
  const isAtp = tab === "atp";
  const rm = isAtp ? rollingMap() : null;
  const mainHead = isMoney ? (careerMode ? "Carrière" : "Prize money") : isAtp ? "Points (12 mois)" : "Points";
  const secHead = isMoney ? (careerMode ? "Saison " + state.year : "Points")
    : isAtp ? "Race " + state.year : "Prize money";
  table.innerHTML = `<thead><tr>
    <th class="col-rank">Rang</th><th>Joueur</th>
    <th class="num">${mainHead}</th>
    <th class="num col-sec">${secHead}</th></tr></thead>`;
  const tbody = document.createElement("tbody");

  const list = isMoney ? (careerMode ? sortedByCareerMoney() : sortedByMoney())
    : isAtp ? sortedByRolling() : sortedByPoints();
  const moveKind = isMoney ? (careerMode ? "careerMoney" : "money") : isAtp ? "rolling" : "points";
  list.forEach((p, i) => {
    const rank = i + 1;
    const prev = previousRank(p.id, moveKind);
    let move = `<span class="rk-move same">•</span>`;
    if (prev !== null) {
      const d = prev - rank;
      if (d > 0) move = `<span class="rk-move up">▲ ${d}</span>`;
      else if (d < 0) move = `<span class="rk-move down">▼ ${-d}</span>`;
      else move = `<span class="rk-move same">=</span>`;
    }
    const titles = (state.titles[p.id] || []).map(tid => {
      const tt = CALENDAR.find(c => c.id === tid);
      return `<span class="title-chip" title="${tt.name}">${tt.cat === "GC" ? "🏆" : tt.cat === "FINALS" ? "👑" : "🥇"} ${tt.city}</span>`;
    }).join("");
    const tr = document.createElement("tr");
    if (state.favorites.includes(p.id)) tr.classList.add("fav-row");
    if (isAtp && rank === M1000_DIRECT) tr.classList.add("top-cut");
    if (!isAtp && !isMoney && (rank === 8 || (!careerMode && rank === M1000_DIRECT))) tr.classList.add("top-cut");
    const mainVal = isMoney ? fmtEuro(Math.round(careerMode ? careerMoneyOf(p.id) : state.money[p.id]))
      : isAtp ? fmtPts(rm[p.id] || 0) : fmtPts(state.points[p.id]);
    const secVal = isMoney ? (careerMode ? fmtEuro(state.money[p.id]) : fmtPts(state.points[p.id]) + " pts")
      : isAtp ? fmtPts(state.points[p.id]) + " pts" : fmtEuro(state.money[p.id]);
    tr.innerHTML = `<td class="col-rank"><span class="rk-pos">${rank}</span>${move}</td>
      <td><div class="player-cell"><span class="pc-flag">${flagHTML(p.flag)}</span>
        <span class="pc-body">${p.name}${state.favorites.includes(p.id) ? " ⭐" : ""}<span class="pc-cat">${p.cat}</span>
        ${titles ? `<span class="title-chips">${titles}</span>` : ""}</span></div></td>
      <td class="num"><strong>${mainVal}</strong></td>
      <td class="num col-sec">${secVal}</td>`;
    tr.classList.add("row-clickable");
    tr.title = "Voir la carte de " + p.name;
    tr.addEventListener("click", () => openPlayerCard(p.id));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  card.appendChild(table);
  el.appendChild(card);
}

/* ============================================================
   HISTORIQUE
   ============================================================ */
function renderHistory(el) {
  el.insertAdjacentHTML("beforeend", `
    <div class="page-title">Historique des tournois</div>
    <div class="page-sub">Revivez chaque tournoi de la saison : tableaux complets et récaps.</div>`);

  const done = CALENDAR.filter(t => state.tournaments[t.id] && state.tournaments[t.id].status === "done");
  if (done.length === 0) {
    el.insertAdjacentHTML("beforeend", `<div class="card empty-note">Aucun tournoi terminé pour l'instant.<br>Lance l'Open d'Australie depuis l'onglet Saison ! 🎾</div>`);
    return;
  }
  const list = document.createElement("div");
  list.className = "history-list";
  done.forEach(t => {
    const rec = state.tournaments[t.id];
    const champ = getPlayer(rec.recap.champion);
    const item = document.createElement("div");
    item.className = "card history-item";
    const catBadge = t.cat === "GC" ? `<span class="badge badge-gc">GC</span>`
      : t.cat === "M1000" ? `<span class="badge badge-m1000">M1000</span>`
      : `<span class="badge badge-finals">Masters</span>`;
    item.innerHTML = `
      <div class="h-name">${flagHTML(t.country)} ${t.name}</div>
      ${catBadge}<span class="badge badge-surface-${t.surface}">${t.surfaceLabel}</span>
      <div class="h-champ">🏆 ${flagHTML(champ.flag)} ${champ.name}</div>
      <div class="h-actions"></div>`;
    const act = item.querySelector(".h-actions");
    act.appendChild(mkBtn("Tableau", "btn btn-ghost btn-sm", () => navigate("tournament", { id: t.id, readOnly: true })));
    act.appendChild(mkBtn("Récap", "btn btn-sm btn-dark", () => navigate("recap", { id: t.id })));
    list.appendChild(item);
  });
  el.appendChild(list);
}

/* ============================================================
   STATISTIQUES DE LA SAISON
   ============================================================ */
function renderStats(el) {
  const multiSeason = state.career && state.career.seasons && state.career.seasons.length > 0;
  el.insertAdjacentHTML("beforeend", `
    <div class="page-title">Statistiques${multiSeason ? " de la carrière" : " de la saison"}</div>
    <div class="page-sub">Les leaders du circuit dans chaque domaine, les rois de chaque surface,
      et l'anatomie des matchs${multiSeason ? " — cumulés sur toutes les saisons depuis " + START_YEAR : " de la saison"}.</div>`);

  const done = CALENDAR.some(t => state.tournaments[t.id] && state.tournaments[t.id].status === "done");
  if (!done) {
    el.insertAdjacentHTML("beforeend", `<div class="card empty-note">
      Les statistiques apparaîtront après le premier tournoi.<br>Lance l'Open d'Australie ! 🎾</div>`);
    return;
  }

  // Stats de tous les joueurs (une seule passe)
  const all = state.players.map(p => ({ p, st: playerStats(p.id) }));
  const MIN_MATCHES = 5;
  const qualified = all.filter(x => x.st.wins + x.st.losses >= MIN_MATCHES);
  const pool = qualified.length >= 10 ? qualified : all.filter(x => x.st.wins + x.st.losses > 0);

  function leaderboard(title, emoji, getNum, getDen, getDetail) {
    const rows = pool
      .map(x => {
        const num = getNum(x.st), den = getDen(x.st);
        return { x, num, den, ratio: den > 0 ? num / den : -1 };
      })
      .filter(r => r.den > 0)
      .sort((a, b) => (b.ratio - a.ratio) || (b.den - a.den))
      .slice(0, 10);
    const card = document.createElement("div");
    card.className = "card stat-board";
    card.innerHTML = `<h3>${emoji} ${title}</h3>`;
    rows.forEach((r, i) => {
      const line = document.createElement("div");
      line.className = "sb-line row-clickable" + (state.favorites.includes(r.x.p.id) ? " sb-fav" : "");
      line.innerHTML = `
        <span class="sb-rank">${i + 1}</span>
        <span class="sb-p">${flagHTML(r.x.p.flag)} ${r.x.p.name}</span>
        <span class="sb-detail">${getDetail(r)}</span>
        <span class="sb-pct">${pct(r.num, r.den)}</span>`;
      line.addEventListener("click", () => openPlayerCard(r.x.p.id));
      card.appendChild(line);
    });
    return card;
  }

  const boardsGrid = document.createElement("div");
  boardsGrid.className = "stats-grid";
  boardsGrid.appendChild(leaderboard("% de victoires", "🏆",
    st => st.wins, st => st.wins + st.losses, r => r.num + "-" + (r.den - r.num)));
  boardsGrid.appendChild(leaderboard("% de sets gagnés", "🎾",
    st => st.setsW, st => st.setsW + st.setsL, r => r.num + "-" + (r.den - r.num)));
  boardsGrid.appendChild(leaderboard("% de jeux gagnés", "🔢",
    st => st.gamesW, st => st.gamesW + st.gamesL, r => r.num + "-" + (r.den - r.num)));
  boardsGrid.appendChild(leaderboard("% de balles de break converties", "💥",
    st => st.bpConv, st => st.bpEarned, r => r.num + " / " + r.den));
  boardsGrid.appendChild(leaderboard("% de balles de break sauvées", "🛡️",
    st => st.bpSaved, st => st.bpFaced, r => r.num + " / " + r.den));
  boardsGrid.appendChild(leaderboard("% de tie-breaks gagnés", "🔥",
    st => st.tbW, st => st.tbW + st.tbL, r => r.num + "-" + (r.den - r.num)));
  el.appendChild(boardsGrid);
  el.insertAdjacentHTML("beforeend", `<div class="page-sub" style="margin-top:6px;font-size:12px">
    Minimum ${MIN_MATCHES} matchs joués pour figurer dans les classements (dès que 10 joueurs sont qualifiés).</div>`);

  /* Les rois de chaque surface */
  el.insertAdjacentHTML("beforeend", `<div class="page-title" style="font-size:24px;margin-top:18px">Les rois de chaque surface</div>`);
  const surfGrid = document.createElement("div");
  surfGrid.className = "stats-grid stats-grid-4";
  SKILLS.slice(0, 4).forEach(s => {
    const rows = all
      .map(x => { const [w, l] = x.st.surf[s.key]; return { x, w, l, tot: w + l }; })
      .filter(r => r.tot >= 3)
      .sort((a, b) => (b.w / b.tot - a.w / a.tot) || (b.w - a.w))
      .slice(0, 5);
    const card = document.createElement("div");
    card.className = "card stat-board surf-board";
    card.innerHTML = `<h3><span class="surf-note surf-${s.key}">${s.short}</span> ${s.label}</h3>`;
    if (rows.length === 0) card.insertAdjacentHTML("beforeend", `<div class="bet-empty" style="color:var(--text-dim)">Pas encore assez de matchs.</div>`);
    rows.forEach((r, i) => {
      const line = document.createElement("div");
      line.className = "sb-line row-clickable";
      line.innerHTML = `
        <span class="sb-rank">${i + 1}</span>
        <span class="sb-p">${flagHTML(r.x.p.flag)} ${r.x.p.name}</span>
        <span class="sb-detail">${r.w}-${r.l}</span>
        <span class="sb-pct">${pct(r.w, r.tot)}</span>`;
      line.addEventListener("click", () => openPlayerCard(r.x.p.id));
      card.appendChild(line);
    });
    surfGrid.appendChild(card);
  });
  el.appendChild(surfGrid);

  /* Anatomie des matchs */
  const ms = seasonMatchStats();
  el.insertAdjacentHTML("beforeend", `<div class="page-title" style="font-size:24px;margin-top:18px">Anatomie des matchs</div>`);
  const anatGrid = document.createElement("div");
  anatGrid.className = "stats-grid stats-grid-3";

  function distBoard(title, emoji, entries, total) {
    const card = document.createElement("div");
    card.className = "card stat-board";
    card.innerHTML = `<h3>${emoji} ${title}</h3>`;
    const max = Math.max(1, ...entries.map(e => e.count));
    entries.forEach(e => {
      card.insertAdjacentHTML("beforeend", `
        <div class="dist-line">
          <span class="dist-label">${e.label}</span>
          <span class="dist-bar"><span style="width:${(100 * e.count / max).toFixed(1)}%"></span></span>
          <span class="dist-val">${fmtPts(e.count)}</span>
          <span class="sb-pct">${pct(e.count, total)}</span>
        </div>`);
    });
    return card;
  }

  const bo3Total = (ms.lenBo3[2] || 0) + (ms.lenBo3[3] || 0);
  anatGrid.appendChild(distBoard("Masters 1000 & Masters (2 sets gagnants)", "⚡", [
    { label: "En 2 sets", count: ms.lenBo3[2] || 0 },
    { label: "En 3 sets", count: ms.lenBo3[3] || 0 },
  ], bo3Total));
  const bo5Total = (ms.lenBo5[3] || 0) + (ms.lenBo5[4] || 0) + (ms.lenBo5[5] || 0);
  anatGrid.appendChild(distBoard("Grands Chelems (3 sets gagnants)", "🏆", [
    { label: "En 3 sets", count: ms.lenBo5[3] || 0 },
    { label: "En 4 sets", count: ms.lenBo5[4] || 0 },
    { label: "En 5 sets", count: ms.lenBo5[5] || 0 },
  ], bo5Total));
  anatGrid.appendChild(distBoard("Scores de sets", "📋",
    Object.entries(ms.setScores).map(([k, v]) => ({ label: k.replace("-", " / "), count: v })),
    ms.totalSets));
  el.appendChild(anatGrid);

  /* Marathons & expéditions : les 3 matchs les plus longs / les plus courts (en jeux) */
  function extremesBoard(title, emoji, list) {
    const card = document.createElement("div");
    card.className = "card stat-board";
    card.innerHTML = `<h3>${emoji} ${title}</h3>`;
    if (list.length === 0) {
      card.insertAdjacentHTML("beforeend", `<div class="bet-empty" style="color:var(--text-dim)">Pas encore de match joué.</div>`);
      return card;
    }
    const sorted = list.slice().sort((a, b) => b.games - a.games);
    const sections = [
      { label: "🐢 Les plus longs", rows: sorted.slice(0, 3) },
      { label: "⚡ Les plus courts", rows: sorted.slice(-3).reverse() },
    ];
    sections.forEach(sec => {
      card.insertAdjacentHTML("beforeend", `<div class="extreme-title">${sec.label}</div>`);
      sec.rows.forEach(r => {
        const t = CALENDAR.find(c => c.id === r.tid);
        const w = getPlayer(r.m.winner);
        const l = getPlayer(r.m.winner === r.m.p1 ? r.m.p2 : r.m.p1);
        const line = document.createElement("div");
        line.className = "extreme-line row-clickable";
        line.title = "Voir la carte de " + w.name;
        line.innerHTML = `
          <span class="ex-games">${r.games}<small>jeux</small></span>
          <span class="ex-body">
            <span class="ex-players">${flagHTML(w.flag)} <strong>${w.name}</strong> bat ${flagHTML(l.flag)} ${l.name}</span>
            <span class="ex-detail">${formatScore(r.m, true)} · ${flagHTML(t.country)} ${t.city}${(state.career && state.career.seasons.length && r.year) ? " " + r.year : ""}</span>
          </span>`;
        line.addEventListener("click", () => openPlayerCard(r.m.winner));
        card.appendChild(line);
      });
    });
    return card;
  }
  el.insertAdjacentHTML("beforeend", `<div class="page-title" style="font-size:24px;margin-top:18px">Marathons &amp; expéditions</div>`);
  const exGrid = document.createElement("div");
  exGrid.className = "stats-grid";
  exGrid.appendChild(extremesBoard("Grands Chelems", "🏆", ms.matchListBo5));
  exGrid.appendChild(extremesBoard("Masters 1000 & Masters", "⚡", ms.matchListBo3));
  el.appendChild(exGrid);

  /* Records de carrière */
  function recordBoard(title, emoji, rows, fmtVal) {
    const card = document.createElement("div");
    card.className = "card stat-board";
    card.innerHTML = `<h3>${emoji} ${title}</h3>`;
    if (!rows.length) {
      card.insertAdjacentHTML("beforeend", `<div class="bet-empty" style="color:var(--text-dim)">Rien à signaler pour l'instant.</div>`);
      return card;
    }
    rows.forEach((r, i) => {
      const p = getPlayer(r.pid);
      const line = document.createElement("div");
      line.className = "sb-line row-clickable" + (state.favorites.includes(r.pid) ? " sb-fav" : "");
      line.innerHTML = `
        <span class="sb-rank">${i + 1}</span>
        <span class="sb-p">${flagHTML(p.flag)} ${p.name}</span>
        <span class="sb-detail">${r.detail || ""}</span>
        <span class="sb-pct">${fmtVal(r.value)}</span>`;
      line.addEventListener("click", () => openPlayerCard(r.pid));
      card.appendChild(line);
    });
    return card;
  }
  el.insertAdjacentHTML("beforeend", `<div class="page-title" style="font-size:24px;margin-top:18px">Records de carrière</div>`);
  const recGrid = document.createElement("div");
  recGrid.className = "stats-grid stats-grid-3";
  // Passages en tête du classement après chaque tournoi
  const no1 = no1CountsAll();
  recGrid.appendChild(recordBoard("N°1 mondial (après chaque tournoi)", "👑",
    Object.entries(no1).map(([pid, v]) => ({ pid: parseInt(pid, 10), value: v }))
      .sort((a, b) => b.value - a.value).slice(0, 10),
    v => "×" + v));
  // Titres en Grand Chelem (carrière)
  const gcRows = state.players
    .map(p => {
      const tids = (state.titles[p.id] || []);
      const gc = tids.filter(tid => (CALENDAR.find(c => c.id === tid) || {}).cat === "GC").length;
      return { pid: p.id, value: gc, detail: tids.length + " titre" + (tids.length > 1 ? "s" : "") + " en tout" };
    })
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value).slice(0, 10);
  recGrid.appendChild(recordBoard("Titres en Grand Chelem", "🏆", gcRows, v => v + " GC"));
  // Gains de carrière
  const moneyRows = sortedByCareerMoney().slice(0, 10)
    .map(p => ({ pid: p.id, value: careerMoneyOf(p.id) }));
  recGrid.appendChild(recordBoard("Gains de carrière", "💼", moneyRows, v => fmtEuro(Math.round(v))));
  el.appendChild(recGrid);

  el.insertAdjacentHTML("beforeend", `<div class="page-sub" style="margin-top:6px;font-size:12px">
    ${fmtPts(ms.totalMatches)} matchs et ${fmtPts(ms.totalSets)} sets joués${multiSeason ? " depuis " + START_YEAR : " cette saison"}.</div>`);
}

/* ============================================================
   JOUEURS — annuaire + cartes de personnage (style EA)
   ============================================================ */
function renderPlayers(el) {
  el.insertAdjacentHTML("beforeend", `
    <div class="page-title">Les 128 joueurs</div>
    <div class="page-sub">Clique sur un joueur pour ouvrir sa carte : classement, prize money, palmarès et compétences.</div>
    <input class="players-search" id="players-search" placeholder="🔍 Rechercher un joueur ou une catégorie…">
    <div class="players-grid" id="players-grid"></div>`);

  const grid = $("#players-grid");
  function draw(filter = "") {
    grid.innerHTML = "";
    const f = filter.toLowerCase();
    sortedByPoints()
      .filter(p => p.name.toLowerCase().includes(f) || p.cat.toLowerCase().includes(f))
      .forEach(p => {
        const rank = currentRank(p.id, "points");
        const mini = document.createElement("button");
        mini.className = "pmini" + (state.favorites.includes(p.id) ? " fav-mini" : "");
        mini.innerHTML = `
          <span class="pm-rank">${rank}</span>
          <span class="pm-flag">${flagHTML(p.flag)}</span>
          <span class="pm-body">
            <span class="pm-name">${p.name}${state.favorites.includes(p.id) ? " ⭐" : ""}</span>
            <span class="pm-cat">${p.cat}</span>
          </span>
          <span class="pm-surf">${bestSurfaceBadge(p)}</span>`;
        mini.addEventListener("click", () => openPlayerCard(p.id));
        grid.appendChild(mini);
      });
  }
  $("#players-search").addEventListener("input", e => draw(e.target.value));
  draw();
}

function bestSurface(p) {
  let best = SKILLS[0];
  SKILLS.slice(0, 4).forEach(s => { if (p.sk[s.key] > p.sk[best.key]) best = s; });
  return best;
}
function bestSurfaceBadge(p) {
  if (p.overall) return `<span class="surf-note surf-dur">ATP ${Math.round(p.overall)}</span>`;
  const b = bestSurface(p);
  return `<span class="surf-note surf-${b.key}">${b.short} ${Math.round(p.sk[b.key] * 10)}</span>`;
}

/* ---------- Carte joueur ---------- */
function openPlayerCard(pid) {
  const p = getPlayer(pid);
  const stats = playerStats(pid);
  const rkP = currentRank(pid, "points");
  const rkM = currentRank(pid, "money");
  const best = bestSurface(p);
  const titles = (state.titles[pid] || []);

  const overlay = $("#card-overlay");
  const modal = $("#card-modal");
  overlay.classList.remove("hidden");

  const skillBar = s => {
    const v = p.sk[s.key];
    const disp = Number.isInteger(v) ? v : v.toFixed(1);
    return `<div class="skill-line">
      <span class="sk-label">${s.label}</span>
      <span class="sk-bar"><span class="sk-fill sk-lv${v >= 9 ? "hi" : v >= 7 ? "mid" : "lo"}" style="width:${v * 10}%"></span></span>
      <span class="sk-val">${disp}</span>
    </div>`;
  };
  const palmares = titles.length
    ? titles.map(tid => {
        const tt = CALENDAR.find(c => c.id === tid);
        return `<span class="title-chip" title="${tt.name}">${tt.cat === "GC" ? "🏆" : tt.cat === "FINALS" ? "👑" : "🥇"} ${tt.city}</span>`;
      }).join("")
    : `<span style="color:#9aa7ba;font-size:12px">Aucun titre pour l'instant</span>`;

  modal.innerHTML = `
    <div class="pcard">
      <button class="m-close pcard-close" id="pc-close">✕</button>
      <div class="pcard-top">
        <div class="pcard-ovr">
          <div class="pcard-note">${p.overall ? Math.round(p.overall) : Math.round(p.sk[best.key] * 10)}</div>
          <div class="pcard-surf">${p.overall ? "ATP" : best.short}</div>
          <div class="pcard-rank">n°${rkP}</div>
        </div>
        <div class="pcard-flag">${flagHTML(p.flag)}</div>
        <div class="pcard-id">
          <div class="pcard-name">${p.name}${p.custom ? " 🎾" : ""}${state.favorites.includes(pid) ? " ⭐" : ""}</div>
          <div class="pcard-cat">${p.cat}${p.club ? ` · ${p.club}` : ""}${p.classement ? ` · <span class="classement-badge">Classé ${p.classement}</span>` : ""}${p.fr && !p.custom ? " · " + flagHTML("🇫🇷") : ""}</div>
        </div>
      </div>
      <div class="pcard-stats">
        <div class="pcs"><div class="v">${fmtPts(state.points[pid])}</div><div class="l">Points race</div></div>
        <div class="pcs"><div class="v">${fmtEuro(state.money[pid])}</div><div class="l">Prize money (n°${rkM})</div></div>
        <div class="pcs"><div class="v">${titles.length} / ${stats.tournamentsPlayed}</div><div class="pct">${pct(titles.length, stats.tournamentsPlayed)}</div><div class="l">Titres 🏆 / tournois</div></div>
        <div class="pcs"><div class="v">${stats.finals} / ${stats.tournamentsPlayed}</div><div class="pct">${pct(stats.finals, stats.tournamentsPlayed)}</div><div class="l">Finales / tournois</div></div>
      </div>
      ${state.defending ? `<div class="pcard-betline">
        🌍 Classement ATP (12 mois) : <strong>n°${currentRank(pid, "rolling")}</strong> (${fmtPts(rollingPoints(pid))} pts)
        · 💼 Prize money carrière : <strong>${fmtEuro(Math.round(careerMoneyOf(pid)))}</strong>
      </div>` : ""}
      ${state.refs ? `<div class="pcard-betline">
        📈 Prize attendu par le bookmaker : <strong>${fmtEuro(state.refs[pid])}</strong>
        · cote <span class="odds-badge">×${betOdds(pid).toFixed(2)}</span>
        ${betInfo(pid)}
      </div>` : ""}
      <div class="pcard-skills">
        <div class="pcard-col">
          <div class="pcard-coltitle">Surfaces</div>
          ${SKILLS.slice(0, 4).map(skillBar).join("")}
        </div>
        <div class="pcard-col">
          <div class="pcard-coltitle">Jeu</div>
          ${SKILLS.slice(4).map(skillBar).join("")}
        </div>
      </div>
      <div class="pcard-statszone">
        <div class="pcard-coltitle">Statistiques de la saison</div>
        <div class="pcard-stats pcard-stats-tiles">
          <div class="pcs pcs-hero"><div class="v">${stats.wins} - ${stats.losses}</div><div class="pct">${pct(stats.wins, stats.wins + stats.losses)}</div><div class="l">Vict. - Déf.</div></div>
          <div class="pcs"><div class="v">${stats.setsW} - ${stats.setsL}</div><div class="pct">${pct(stats.setsW, stats.setsW + stats.setsL)}</div><div class="l">Sets G - P</div></div>
          <div class="pcs"><div class="v">${stats.gamesW} - ${stats.gamesL}</div><div class="pct">${pct(stats.gamesW, stats.gamesW + stats.gamesL)}</div><div class="l">Jeux G - P</div></div>
          <div class="pcs"><div class="v">${stats.tbW} - ${stats.tbL}</div><div class="pct">${pct(stats.tbW, stats.tbW + stats.tbL)}</div><div class="l">Tie-breaks G - P</div></div>
          <div class="pcs"><div class="v">${stats.bpConv} / ${stats.bpEarned}</div><div class="pct">${pct(stats.bpConv, stats.bpEarned)}</div><div class="l">BB réussies / obtenues</div></div>
          <div class="pcs"><div class="v">${stats.bpSaved} / ${stats.bpFaced}</div><div class="pct">${pct(stats.bpSaved, stats.bpFaced)}</div><div class="l">BB sauvées / concédées</div></div>
        </div>
        <div class="pcard-coltitle" style="margin-top:10px">Bilan par surface</div>
        <div class="pcard-stats pcard-stats-tiles">
          ${SKILLS.slice(0, 4).map(s => {
            const [w, l] = stats.surf[s.key];
            return `<div class="pcs"><div class="v">${w} - ${l}</div><div class="pct">${pct(w, w + l)}</div><div class="l">${s.label}</div></div>`;
          }).join("")}
        </div>
      </div>
      <div class="pcard-palmares">
        <div class="pcard-coltitle">Palmarès</div>
        <div class="title-chips">${palmares}</div>
      </div>
    </div>`;

  const close = () => { overlay.classList.add("hidden"); };
  $("#pc-close").addEventListener("click", close);
  overlay.onclick = e => { if (e.target === overlay) close(); };
}

/* Pourcentage façon "12.5%" (1 décimale si nécessaire, "—" si aucune donnée) */
function pct(num, den) {
  if (!den || den <= 0) return "—";
  const v = 100 * num / den;
  const s = Math.round(v * 10) / 10;
  return (Number.isInteger(s) ? s : s.toFixed(1)) + "%";
}

function betInfo(pid) {
  const bet = state.bets && state.bets.find(b => b.pid === pid);
  if (!bet) return "";
  return `<br>💶 Ta mise : <strong>${fmtEuro(bet.amount)}</strong> — valeur actuelle :
    <strong>${fmtEuro(Math.round(betValue(bet)))}</strong>`;
}

/* ============================================================
   MES FAVORIS
   ============================================================ */
function renderFavorites(el) {
  const seasonOver = state.currentIndex >= CALENDAR.length;
  const bank = bankNow();
  const pace = expectedBankPace();
  const expectedNow = pace[pace.length - 1].value;
  const delta = seasonOver ? bank - BET_BUDGET : bank - expectedNow;

  el.insertAdjacentHTML("beforeend", `
    <div class="page-title">Mes paris</div>
    <div class="page-sub">Ta cagnotte se remplit au rythme des prize money de tes 5 joueurs :
      gain final = mise × prize money réel / prize money attendu. Objectif : dépasser les ${fmtEuro(BET_BUDGET)}.</div>`);

  /* Solde */
  const hero = document.createElement("div");
  hero.className = "bank-hero";
  hero.innerHTML = `
    <div class="bh-main">
      <div class="v">${fmtEuro(Math.round(bank))}</div>
      <div class="l">${seasonOver ? "Solde final" : "Valeur totale (paris + cash)"}</div>
    </div>
    <div>
      <div class="bh-delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "▲ +" : "▼ "}${fmtEuro(Math.round(delta))}</div>
      <div class="bh-sub">${seasonOver ? "par rapport à ta mise de " + fmtEuro(BET_BUDGET)
        : "par rapport au rythme attendu (" + fmtEuro(Math.round(expectedNow)) + " à ce stade)"}</div>
    </div>
    <div class="bh-main bh-cash">
      <div class="v">${fmtEuro(Math.round(state.cash || 0))}</div>
      <div class="l">💵 Cash disponible</div>
      <div class="l">💉 ${state.syringes || 0} seringue${(state.syringes || 0) > 1 ? "s" : ""} restante${(state.syringes || 0) > 1 ? "s" : ""}</div>
    </div>
    <div>
      <div class="bh-sub">Mise initiale : <strong style="color:#fff">${fmtEuro(BET_BUDGET)}</strong> sur 5 joueurs<br>
      ${seasonOver ? (delta >= 0 ? "🍾 Tu as battu le bookmaker !" : "😅 Le bookmaker gagne cette fois…")
        : "Le cash s'obtient en revendant un pari (cash-out à 80 %)<br>et sert aux paris de tournoi 🎰"}</div>
    </div>`;
  el.appendChild(hero);

  /* Détail des paris : une carte par pari (lisible aussi sur mobile) */
  const tableCard = document.createElement("div");
  tableCard.className = "card bets-table-card";
  tableCard.innerHTML = `<h3>🎫 Le détail de ton ticket</h3>`;
  const list = document.createElement("div");
  list.className = "bet-cards";
  state.bets.forEach(bet => {
    const p = getPlayer(bet.pid);
    const value = betValue(bet);
    const paceShare = pace[pace.length - 1].value / BET_BUDGET; // part du pool distribuée
    const expectedBet = bet.amount * paceShare;
    const diff = value - (seasonOver ? bet.amount : expectedBet);
    const bc = document.createElement("div");
    bc.className = "bet-card" + (bet.sold ? " bet-sold" : "");
    bc.innerHTML = `
      <div class="bc-head">
        <span class="bc-flag row-clickable bc-open">${flagHTML(p.flag)}</span>
        <span class="bc-id row-clickable bc-open" title="Voir la carte de ${p.name}">
          <span class="bc-name">${p.name}${p.custom ? " 🎾" : ""}</span>
          <span class="bc-cat">${p.cat} · <span class="odds-badge">×${betOdds(bet.pid).toFixed(2)}</span>${
            (state.suspended && state.suspended[bet.pid] !== undefined && state.currentIndex < CALENDAR.length &&
             CALENDAR[state.currentIndex].month < state.suspended[bet.pid])
              ? ' · <span class="susp-badge">🚨 Suspendu (dopage)</span>' : ""}</span>
        </span>
        ${bet.sold
          ? `<span class="bc-value"><span class="v" style="color:var(--text-dim)">${fmtEuro(bet.sold.price)}</span>
             <span class="sold-badge">💰 Vendu avant ${CALENDAR[Math.min(bet.sold.atIndex, CALENDAR.length - 1)].city}</span></span>`
          : `<span class="bc-value">
             <span class="v">${fmtEuro(Math.round(value))}</span>
             <span class="rk-move ${diff >= 0 ? "up" : "down"}">${diff >= 0 ? "▲" : "▼"} ${fmtEuro(Math.abs(Math.round(diff)))}</span>
           </span>`}
      </div>
      <div class="bc-grid">
        <div class="bc-stat"><span class="l">Mise</span><span class="v">${fmtEuro(bet.amount)}</span></div>
        <div class="bc-stat"><span class="l">Prize attendu</span><span class="v">${fmtEuro(state.refs[bet.pid])}</span></div>
        <div class="bc-stat"><span class="l">Prize réel</span><span class="v">${fmtEuro(state.money[bet.pid] || 0)}</span></div>
        <div class="bc-stat bc-last"><span class="l">Dernier résultat</span><span class="v">${lastResultLabel(bet.pid)}</span></div>
      </div>`;
    bc.querySelectorAll(".bc-open").forEach(e => e.addEventListener("click", () => openPlayerCard(bet.pid)));
    // Cash-out : revente au bookmaker à 80 % de la juste valeur
    if (!bet.sold && !seasonOver) {
      const foot = document.createElement("div");
      foot.className = "bc-foot";
      if (p.custom) {
        foot.innerHTML = `<span class="bc-lock">🔒 Le pari sur ton champion est incessible</span>`;
      } else {
        const q = cashOutQuote(bet);
        foot.appendChild(mkBtn(`💰 Cash-out ${fmtEuro(q.price)}`, "btn btn-ghost btn-sm", () => {
          if (confirm(`Revendre ce pari sur ${p.name} pour ${fmtEuro(q.price)} ?\n` +
            `(${fmtEuro(Math.round(q.acquired))} acquis + ${fmtEuro(Math.round(q.expectedRemaining))} attendus, commission 20 %)\n` +
            `Le pari ne rapportera plus rien ensuite.`)) {
            try { cashOutBet(bet.pid); navigate("favorites"); } catch (e) { alert(e.message); }
          }
        }));
        foot.insertAdjacentHTML("beforeend",
          `<span class="bc-lock">acquis ${fmtEuro(Math.round(q.acquired))} + attendu ${fmtEuro(Math.round(q.expectedRemaining))} − 20 %</span>`);
      }
      bc.appendChild(foot);
    }
    list.appendChild(bc);
  });
  tableCard.appendChild(list);
  el.appendChild(tableCard);

  /* Historique des paris de tournoi */
  const tb = state.tbets || [];
  if (tb.length) {
    const tCard = document.createElement("div");
    tCard.className = "card bets-table-card";
    const staked = tb.reduce((s, b) => s + b.stake, 0);
    const won = tb.reduce((s, b) => s + (b.payout || 0), 0);
    tCard.innerHTML = `<h3>🎰 Tes paris de tournoi
      <span class="tbet-summary">${fmtEuro(staked)} misés · ${fmtEuro(won)} encaissés</span></h3>`;
    tb.slice().reverse().forEach(b => {
      const t = CALENDAR.find(c => c.id === b.tourneyId);
      const line = document.createElement("div");
      line.className = "tbet-line tbet-" + b.status;
      line.innerHTML = `
        <span class="tbet-status">${b.status === "open" ? "⏳" : b.status === "won" ? "✅" : "❌"}</span>
        <span class="tbet-body">
          <span class="tbet-label">${b.label}</span>
          <span class="tbet-meta">${flagHTML(t.country)} ${t.city}${b.year ? " " + b.year : ""} · mise ${fmtEuro(b.stake)} · cote ×${b.odds.toFixed(2)}</span>
          ${b.result ? `<span class="tbet-result">→ ${b.result}</span>` : ""}
        </span>
        <span class="tbet-payout">${b.status === "won" ? "+" + fmtEuro(b.payout)
          : b.status === "lost" ? "−" + fmtEuro(b.stake)
          : "gain potentiel " + fmtEuro(Math.round(b.stake * b.odds))}</span>`;
      tCard.appendChild(line);
    });
    el.appendChild(tCard);
  }
}

function lastResultLabel(pid) {
  for (let i = CALENDAR.length - 1; i >= 0; i--) {
    const t = CALENDAR[i];
    const rec = state.tournaments[t.id];
    if (!rec || rec.status !== "done") continue;
    const r = rec.recap.results[pid];
    if (!r) return `${flagHTML(t.country)} ${t.city} : non qualifié`;
    const label = r.round === "W" ? "🏆 Vainqueur" : r.round === "F" ? "Finale"
      : rec.type === "finals" ? (r.round === "SF" ? "Demi-finale" : `${r.rrWins} v. en poule`)
      : roundShortLabel(r.round, t.drawSize);
    return `${flagHTML(t.country)} ${t.city} : ${label}`;
  }
  return "—";
}

