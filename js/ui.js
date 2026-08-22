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
    showOnboarding(loaded.players.length >= ROSTER_SIZE + 1 ? "bets" : "player");
  } else {
    showOnboarding("roster");
  }

  $$("#mainnav .nav-btn").forEach(b => {
    b.addEventListener("click", () => navigate(b.dataset.nav));
  });
  $("#bank-chip").addEventListener("click", () => navigate("favorites"));
  $("#btn-reset").addEventListener("click", () => {
    if (confirm("Recommencer une nouvelle saison ? La saison en cours sera effacée.")) {
      resetSeason();
      location.reload();
    }
  });
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
  else if (view === "rankings") renderRankings(el, params.tab || "points");
  else if (view === "history") renderHistory(el);
  else if (view === "favorites") renderFavorites(el);
  else if (view === "players") renderPlayers(el);
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
      <p>La saison ATP 2026… disputée par 127 légendes de l'Histoire, des mythes et de la fiction —
      et par <strong>toi</strong>, le 128<sup>e</sup> joueur.
      Grands Chelems, Masters 1000 et Masters final : à qui la place de n°1 mondial ?</p>
    </div>
    <div class="onboard-card" id="onboard-content"></div>`;
  el.appendChild(box);

  if (step === "roster") renderRosterStep($("#onboard-content"));
  else if (step === "player") renderPlayerStep($("#onboard-content"));
  else renderBetsStep($("#onboard-content"));
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
  SKILL_KEYS.forEach(k => { sk[k] = 7; }); // 70 points, à redistribuer librement

  const countryOptions = Object.entries(COUNTRY_NAMES)
    .sort((a, b) => a[1].localeCompare(b[1], "fr"))
    .map(([flag, name]) => `<option value="${flag}" ${flag === "🇫🇷" ? "selected" : ""}>${name}</option>`)
    .join("");

  container.innerHTML = `
    <h2>2 · Crée ton champion — le 128<sup>e</sup> joueur</h2>
    <p style="color:#b9cdf1;font-size:13.5px;margin-bottom:14px">
      C'est toi qui entres sur le circuit ! Répartis tes 70 points de compétences comme tu veux
      (chacune de 1 à 10). Un pari de ${fmtEuro(CUSTOM_BET)} sera automatiquement placé sur toi. 🎾</p>
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
        <h3>⚙️ Tes 70 points de compétences</h3>
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
        <button class="cp-step" data-k="${s.key}" data-d="1" ${sk[s.key] >= 10 || total() >= 70 ? "disabled" : ""}>+</button>
        <span class="cp-skill-bar"><span style="width:${sk[s.key] * 10}%"></span></span>`;
      skillsDiv.appendChild(row);
    });
    skillsDiv.querySelectorAll(".cp-step").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.k, d = parseInt(b.dataset.d, 10);
      const t = total();
      if (d > 0 && (sk[k] >= 10 || t >= 70)) return;
      if (d < 0 && sk[k] <= 1) return;
      sk[k] += d;
      draw(); update();
    }));
    const rem = 70 - total();
    $("#cp-remaining").innerHTML = rem === 0
      ? `<span style="color:#7dedaa">✓ 70 / 70 points répartis</span>`
      : `<span style="color:#ffd977">${rem} point${rem > 1 ? "s" : ""} restant${rem > 1 ? "s" : ""} à placer</span>`;
  }
  function update() {
    const name = ($("#cp-prenom").value.trim() + " " + $("#cp-nom").value.trim()).trim();
    $("#cp-go").disabled = !(name.length >= 3 && total() === 70);
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
      Espérance globale : ${fmtEuro(BET_BUDGET)} — à toi de battre le bookmaker.</p>
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
    const ok = slip.size === BET_PLAYERS && total === BET_BUDGET &&
      Array.from(slip.values()).every(a => a >= 100) &&
      (!cp || slip.get(cp.id) === CUSTOM_BET);
    const el = $("#slip-total");
    el.className = "bet-total " + (ok ? "ok" : "ko");
    el.innerHTML = `<span>Total misé</span><span>${fmtEuro(total)} / ${fmtEuro(BET_BUDGET)}</span>`;
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
function renderSeason(el) {
  const head = document.createElement("div");
  head.innerHTML = `
    <div class="page-title">Calendrier de la saison 2026</div>
    <div class="page-sub">4 Grands Chelems · 9 Masters 1000 · Masters final — de Melbourne à Turin.</div>`;
  el.appendChild(head);

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
          <div class="t-place">${flagHTML(t.country)} ${t.city} · ${t.dates}</div>
        </div>
      </div>
      <div class="t-badges">${catBadge}${surfBadge}
        <span class="badge" style="background:#eef1f6;color:#5d6d88">${t.drawSize} joueurs</span></div>
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
        <span>${t.city} · ${t.dates}</span>
        <span class="badge badge-surface-${t.surface}">${t.surfaceLabel}</span>
        <span class="badge badge-m1000" style="background:rgba(255,255,255,.15);color:#fff">${catBadge}</span>
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

  if (rec.type === "finals") { renderFinalsBody(el, rec, readOnly); return; }
  renderBracketBody(el, rec, readOnly);
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
    row.innerHTML = `<span class="tbd">À déterminer…</span>`;
    return row;
  }
  const p = getPlayer(pid);
  const isWinner = m.winner !== null && m.winner === pid;
  const isLoser = m.winner !== null && m.winner !== pid;
  row.className = "b-row" + (isWinner ? " winner-row" : "") + (isLoser ? " loser-row" : "");
  const seed = rec.seedsMap[pid] ? `<span class="seed">${rec.seedsMap[pid]}</span>` : `<span class="seed"></span>`;
  const fav = state.favorites.includes(pid) ? `<span class="fav-star">⭐</span>` : "";
  let score = "";
  if (m.score) {
    score = m.score.map(s => (isP1 ? s[0] : s[1])).join(" ");
  }
  row.innerHTML = `${seed}<span class="p-flag">${flagHTML(p.flag)}</span>
    <span class="p-name">${p.name}${isWinner ? " ✓" : ""}</span>${fav}
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
  if (rec.phase === "rr") {
    for (const g of ["A", "B"])
      for (let i = 0; i < rec.rr[g].length; i++) {
        const m = rec.rr[g][i];
        if (m.winner === null && isBetMatch(m)) return { kind: "rr", group: g, matchIdx: i };
      }
  } else if (rec.phase === "sf") {
    for (let i = 0; i < rec.sf.length; i++) {
      const m = rec.sf[i];
      if (m.winner === null && m.p1 !== null && isBetMatch(m)) return { kind: "sf", matchIdx: i };
    }
  } else if (rec.phase === "final") {
    const m = rec.final;
    if (m.winner === null && m.p1 !== null && isBetMatch(m)) return { kind: "final" };
  }
  return null;
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

    const rrDiv = document.createElement("div");
    rrDiv.className = "rr-matches";
    rec.rr[g].forEach((m, i) => {
      const card = finalsMatchCard(rec, m, () => openMatchModal(rec, { kind: "rr", group: g, matchIdx: i }),
        !readOnly && rec.phase === "rr" && m.winner === null);
      rrDiv.appendChild(card);
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
    roundLabel = "Round Robin — Groupe " + (ctx.group === "A" ? "Björn Borg" : "Jimmy Connors");
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
            ${state.favorites.includes(m.p1) ? "💶" : ""}<span class="serve-dot hidden" id="serve-A"></span></span>
          <span class="sb-cat">n°${currentRank(m.p1, "points")} à la race · ${pA.cat}</span>
        </span>
        <span class="sb-sets" id="sets-A"></span>
      </div>
      <div class="sb-vs-divider"></div>
      <div class="sb-row" id="sb-B">
        <span class="sb-flag">${flagHTML(pB.flag)}</span>
        <span>
          <span class="sb-name">${rec.seedsMap[m.p2] ? `<span class="seed">[${rec.seedsMap[m.p2]}]</span>` : ""}<span class="name-link" id="link-B" title="Voir la carte de ${pB.name}">${pB.name}</span>
            ${state.favorites.includes(m.p2) ? "💶" : ""}<span class="serve-dot hidden" id="serve-B"></span></span>
          <span class="sb-cat">n°${currentRank(m.p2, "points")} à la race · ${pB.cat}</span>
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
          nextWrap.appendChild(mkBtn("💶 Match suivant de mes paris", "btn", () => {
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

  /* Nouveaux n°1 */
  const leaders = sortedByPoints();
  const moneyLeaders = sortedByMoney();
  right.insertAdjacentHTML("beforeend", `
    <h3 style="margin-top:18px">📊 Après le tournoi</h3>
    <p style="font-size:13.5px">
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
  }
  el.appendChild(actions);
}

/* ============================================================
   CLASSEMENTS
   ============================================================ */
function renderRankings(el, tab) {
  el.insertAdjacentHTML("beforeend", `
    <div class="page-title">Classements 2026</div>
    <div class="page-sub">Race ATP et prize money — l'évolution est calculée par rapport au tournoi précédent.
      <span class="cut-note">— — ligne dorée : qualification (top 64 Masters 1000 / top 8 Masters)</span></div>`);

  const tabs = document.createElement("div");
  tabs.className = "rank-tabs";
  tabs.appendChild(mkBtn("🎾 Points (Race)", "rank-tab" + (tab === "points" ? " active" : ""), () => navigate("rankings", { tab: "points" })));
  tabs.appendChild(mkBtn("💰 Prize money", "rank-tab" + (tab === "money" ? " active" : ""), () => navigate("rankings", { tab: "money" })));
  el.appendChild(tabs);

  const card = document.createElement("div");
  card.className = "card rank-card";
  const table = document.createElement("table");
  table.className = "data";
  const isMoney = tab === "money";
  table.innerHTML = `<thead><tr>
    <th class="col-rank">Rang</th><th>Joueur</th>
    <th class="num">${isMoney ? "Prize money" : "Points"}</th>
    <th class="num col-sec">${isMoney ? "Points" : "Prize money"}</th></tr></thead>`;
  const tbody = document.createElement("tbody");

  const list = isMoney ? sortedByMoney() : sortedByPoints();
  list.forEach((p, i) => {
    const rank = i + 1;
    const prev = previousRank(p.id, isMoney ? "money" : "points");
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
    if (!isMoney && (rank === 8 || rank === 64)) tr.classList.add("top-cut");
    tr.innerHTML = `<td class="col-rank"><span class="rk-pos">${rank}</span>${move}</td>
      <td><div class="player-cell"><span class="pc-flag">${flagHTML(p.flag)}</span>
        <span class="pc-body">${p.name}${state.favorites.includes(p.id) ? " ⭐" : ""}<span class="pc-cat">${p.cat}</span>
        ${titles ? `<span class="title-chips">${titles}</span>` : ""}</span></div></td>
      <td class="num"><strong>${isMoney ? fmtEuro(state.money[p.id]) : fmtPts(state.points[p.id])}</strong></td>
      <td class="num col-sec">${isMoney ? fmtPts(state.points[p.id]) + " pts" : fmtEuro(state.money[p.id])}</td>`;
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
      <div class="l">${seasonOver ? "Solde final" : "Valeur actuelle de tes paris"}</div>
    </div>
    <div>
      <div class="bh-delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "▲ +" : "▼ "}${fmtEuro(Math.round(delta))}</div>
      <div class="bh-sub">${seasonOver ? "par rapport à ta mise de " + fmtEuro(BET_BUDGET)
        : "par rapport au rythme attendu (" + fmtEuro(Math.round(expectedNow)) + " à ce stade)"}</div>
    </div>
    <div>
      <div class="bh-sub">Mise initiale : <strong style="color:#fff">${fmtEuro(BET_BUDGET)}</strong> sur 5 joueurs<br>
      ${seasonOver ? (delta >= 0 ? "🍾 Tu as battu le bookmaker !" : "😅 Le bookmaker gagne cette fois…")
        : (CALENDAR.length - state.currentIndex) + " tournoi(s) restant(s)"}</div>
    </div>`;
  el.appendChild(hero);

  /* Courbe d'évolution */
  const chartCard = document.createElement("div");
  chartCard.className = "card bank-chart-card";
  chartCard.innerHTML = `<h3>📈 Évolution du solde</h3>`;
  chartCard.appendChild(buildBankChart(bankHistory(), pace));
  chartCard.insertAdjacentHTML("beforeend", `
    <div class="chart-legend">
      <span><span class="dot" style="background:var(--blue)"></span>Valeur de tes paris</span>
      <span><span class="dot" style="background:#b9c5d8"></span>Rythme attendu (espérance ${fmtEuro(BET_BUDGET)})</span>
    </div>`);
  el.appendChild(chartCard);

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
    bc.className = "bet-card row-clickable";
    bc.title = "Voir la carte de " + p.name;
    bc.innerHTML = `
      <div class="bc-head">
        <span class="bc-flag">${flagHTML(p.flag)}</span>
        <span class="bc-id">
          <span class="bc-name">${p.name}${p.custom ? " 🎾" : ""}</span>
          <span class="bc-cat">${p.cat} · <span class="odds-badge">×${betOdds(bet.pid).toFixed(2)}</span></span>
        </span>
        <span class="bc-value">
          <span class="v">${fmtEuro(Math.round(value))}</span>
          <span class="rk-move ${diff >= 0 ? "up" : "down"}">${diff >= 0 ? "▲" : "▼"} ${fmtEuro(Math.abs(Math.round(diff)))}</span>
        </span>
      </div>
      <div class="bc-grid">
        <div class="bc-stat"><span class="l">Mise</span><span class="v">${fmtEuro(bet.amount)}</span></div>
        <div class="bc-stat"><span class="l">Prize attendu</span><span class="v">${fmtEuro(state.refs[bet.pid])}</span></div>
        <div class="bc-stat"><span class="l">Prize réel</span><span class="v">${fmtEuro(state.money[bet.pid] || 0)}</span></div>
        <div class="bc-stat bc-last"><span class="l">Dernier résultat</span><span class="v">${lastResultLabel(bet.pid)}</span></div>
      </div>`;
    bc.addEventListener("click", () => openPlayerCard(bet.pid));
    list.appendChild(bc);
  });
  tableCard.appendChild(list);
  el.appendChild(tableCard);
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

/* Graphique SVG : solde après chaque tournoi + ligne du rythme attendu */
function buildBankChart(series, pace) {
  const W = 680, H = 240, padL = 62, padR = 16, padT = 14, padB = 34;
  const n = Math.max(series.length, 2);
  const maxV = Math.max(BET_BUDGET * 1.15, ...series.map(d => d.value), ...pace.map(d => d.value)) * 1.08;
  const x = i => padL + (W - padL - padR) * (i / (n - 1));
  const y = v => padT + (H - padT - padB) * (1 - v / maxV);
  const pts = arr => arr.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  let gridLines = "";
  for (let g = 0; g <= 4; g++) {
    const v = maxV * g / 4;
    gridLines += `<line x1="${padL}" y1="${y(v)}" x2="${W - padR}" y2="${y(v)}" stroke="#e7edf6" stroke-width="1"/>
      <text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#8896ad">${Math.round(v / 1000)} k€</text>`;
  }
  const labels = series.map((d, i) =>
    `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#8896ad">${d.label.slice(0, 9)}</text>`
  ).join("");
  const area = series.length > 1
    ? `<polygon points="${x(0)},${y(0)} ${pts(series)} ${x(series.length - 1)},${y(0)}" fill="rgba(36,120,255,.09)"/>` : "";
  const dots = series.map((d, i) =>
    `<circle cx="${x(i)}" cy="${y(d.value)}" r="3.4" fill="#2478ff" stroke="#fff" stroke-width="1.4"><title>${d.label} : ${Math.round(d.value).toLocaleString("fr-FR")} €</title></circle>`
  ).join("");
  svg.innerHTML = `
    ${gridLines}
    <line x1="${padL}" y1="${y(BET_BUDGET)}" x2="${W - padR}" y2="${y(BET_BUDGET)}" stroke="#d4a72c" stroke-width="1" stroke-dasharray="2 4"/>
    <text x="${W - padR}" y="${y(BET_BUDGET) - 5}" text-anchor="end" font-size="9.5" fill="#b8860b">mise 10 k€</text>
    ${pace.length > 1 ? `<polyline points="${pts(pace)}" fill="none" stroke="#b9c5d8" stroke-width="2" stroke-dasharray="5 5"/>` : ""}
    ${area}
    ${series.length > 1 ? `<polyline points="${pts(series)}" fill="none" stroke="#2478ff" stroke-width="2.6" stroke-linejoin="round"/>` : ""}
    ${dots}
    ${labels}`;
  return svg;
}
