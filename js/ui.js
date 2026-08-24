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

/* Le nom de TON CLUB (saisi à la création du champion) */
function clubName() {
  const cp = customPlayer();
  return (cp && cp.club) ? cp.club : "ton club";
}

/* ============================================================
   DÉMARRAGE
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const loaded = loadState();
  if (loaded && loaded.betsPlaced) {
    showMain();
  } else if (loaded && loaded.players) {
    if (loaded.pendingUpgrade) showOnboarding("upgrade");
    else if (loaded.players.length < ROSTER_SIZE + 1) showOnboarding("player");
    else showOnboarding("favorites");
  } else {
    showOnboarding("roster");
  }

  $$("#mainnav .nav-btn").forEach(b => {
    b.addEventListener("click", () => navigate(b.dataset.nav));
  });
  $("#bank-chip").addEventListener("click", () => navigate("favorites"));
  $("#xp-chip").addEventListener("click", () => navigate("career"));
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
  else if (view === "career") renderCareerXP(el);
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
      <p><strong>${MAX_SEASONS} saisons ATP</strong> — de ${START_YEAR} à ${START_YEAR + MAX_SEASONS - 1} — disputées par <strong>127 légendes</strong> de l'Histoire,
      des mythes et de la fiction… et par <strong>toi</strong>, le 128<sup>e</sup> joueur.</p>
      <div class="oh-points">
        <span>🎾 <strong>Crée ton champion</strong> sur mesure, recrute les <strong>4 joueurs de ton club</strong> et joue leurs matchs à la main</span>
        <span>🏆 <strong>14 tournois par saison</strong> : 4 Grands Chelems, 9 Masters 1000 et le Masters final — objectif n°1 mondial</span>
        <span>🎰 Parie comme un pro sur <strong>FUN'BET</strong> : vainqueurs, combinés aux cotes multipliées, scores exacts, aces, tie-breaks…</span>
        <span>🏦 Gère ta banque en direct : prize money taxé à <strong>40 %</strong>, <strong>20 %</strong> pour le staff, <strong>500 000 €</strong> de frais par saison</span>
        <span>💉 Dope <strong>ton champion</strong> pour un coup de pouce… à 40 000 € la dose et 5 % de risque de suspension</span>
        <span>🎖 Pars <strong>classé 40</strong> et grimpe vers le mythique <strong>−15</strong> à l’expérience : goals, perfs, exploits…</span>
      </div>
    </div>
    <div class="onboard-card" id="onboard-content"></div>`;
  el.appendChild(box);

  if (step === "roster") renderRosterStep($("#onboard-content"));
  else if (step === "player") renderPlayerStep($("#onboard-content"));
  else if (step === "upgrade") renderUpgradeStep($("#onboard-content"));
  else renderFavoritesStep($("#onboard-content"));
}

/* ---------- Étape 3 : recrute les 4 joueurs de TON CLUB ----------
   Ton champion en est le capitaine. Tu SUIS les joueurs du club : leurs matchs
   se jouent à la main et eux seuls peuvent être dopés. */
function renderFavoritesStep(container) {
  const cp = customPlayer();
  const picked = new Set((state.favorites || []).filter(pid => !cp || pid !== cp.id));
  const need = BET_PLAYERS - (cp ? 1 : 0);
  /* v28 — LE MERCATO (saison 2+) : conserve 3 joueurs de la saison passée, signe 1 transfert */
  const prevSet = new Set(cp && Array.isArray(state.prevClub) ? state.prevClub : []);
  const mercato = prevSet.size > 0;
  const KEEP = BET_PLAYERS - 2, SIGN = need - KEEP;

  container.innerHTML = mercato ? `
    <h2>Saison ${state.year} — le mercato de ${clubName()} 🔁</h2>
    <p style="color:#b9cdf1;font-size:13.5px;margin-bottom:14px">
      Ton club <strong>conserve ${KEEP} joueurs</strong> de la saison passée (🎽) et signe
      <strong>${SIGN} transfert</strong> parmi les autres légendes. Choisis qui reste… et qui débarque :
      leurs résultats à l'entraînement font bouger ton expérience 🎖.</p>
    ${cp ? `<div class="fav-locked">⭐ ${flagHTML(cp.flag)} <strong>${cp.name}</strong> — capitaine de ${clubName()} 🔒</div>` : ""}` : `
    <h2>3 · Recrute les 4 joueurs de ${clubName()} 🎾</h2>
    <p style="color:#b9cdf1;font-size:13.5px;margin-bottom:14px">
      Ton club aligne <strong>${BET_PLAYERS} joueurs</strong> sur le circuit : ${cp ? `<strong>${cp.name}</strong>, ton champion et capitaine,` : "ton champion"}
      plus <strong>${need} recrues</strong> à choisir parmi les légendes. Tu <strong>suis</strong> les joueurs du club toute la saison :
      leurs matchs se jouent à la main (« Simuler le tournoi » s'arrête sur chacun) et eux seuls peuvent être dopés 💉.
      Les paris 🎰 se placent ensuite en direct : avant chaque tournoi, chaque tour et chaque match.</p>
    ${cp ? `<div class="fav-locked">⭐ ${flagHTML(cp.flag)} <strong>${cp.name}</strong> — capitaine de ${clubName()} 🔒</div>` : ""}`;
  container.innerHTML += `
    <input class="fav-search" id="fav-search" placeholder="🔍 Rechercher un joueur…">
    <div class="fav-grid" id="fav-grid" style="max-height:420px"></div>
    <div class="fav-actions">
      <span class="cp-remaining" id="fav-remaining"></span>
      <button class="btn btn-gold" id="fav-go" disabled>🎾 Lancer la saison</button>
    </div>`;

  const grid = $("#fav-grid");
  function drawGrid(filter = "") {
    grid.innerHTML = "";
    const f = filter.toLowerCase();
    const pool = state.players
      .filter(p => !p.custom)
      .filter(p => p.name.toLowerCase().includes(f) || p.cat.toLowerCase().includes(f));
    (mercato ? pool.filter(p => prevSet.has(p.id)).concat(pool.filter(p => !prevSet.has(p.id))) : pool)
      .forEach(p => {
        const isPrev = prevSet.has(p.id);
        const b = document.createElement("button");
        b.className = "fav-item" + (picked.has(p.id) ? " selected" : "") + (mercato && isPrev ? " fav-prev" : "");
        b.innerHTML = `<span class="f-flag">${flagHTML(p.flag)}</span>
          <span style="flex:1"><strong>${p.name}</strong><span class="f-cat">${mercato && isPrev ? "🎽 au club en " + (state.year - 1) + " · " : ""}${p.cat}</span></span>
          ${picked.has(p.id) ? '<span class="fav-star">⭐</span>' : ""}
          <span class="mini-card-btn" title="Voir la carte de ${p.name}">🪪</span>`;
        b.addEventListener("click", () => {
          if (picked.has(p.id)) { picked.delete(p.id); refresh(); return; }
          if (picked.size >= need) return;
          if (mercato) {
            const kept = Array.from(picked).filter(id => prevSet.has(id)).length;
            if (isPrev && kept >= KEEP) return;          // déjà 3 conservés
            if (!isPrev && (picked.size - kept) >= SIGN) return; // déjà 1 transfert
          }
          picked.add(p.id);
          refresh();
        });
        b.querySelector(".mini-card-btn").addEventListener("click", e => {
          e.stopPropagation();
          openPlayerCard(p.id);
        });
        grid.appendChild(b);
      });
  }
  function refresh() {
    drawGrid($("#fav-search").value);
    const rem = need - picked.size;
    if (mercato) {
      const kept = Array.from(picked).filter(id => prevSet.has(id)).length;
      const signed = picked.size - kept;
      $("#fav-remaining").innerHTML = rem === 0
        ? `<span style="color:#7dedaa">✓ Mercato bouclé : ${KEEP} conservés + ${SIGN} transfert</span>`
        : `<span style="color:#ffd977">🎽 Conservés : ${kept}/${KEEP} · 🔁 Transfert : ${signed}/${SIGN}</span>`;
      $("#fav-go").disabled = rem !== 0;
      return;
    }
    $("#fav-remaining").innerHTML = rem === 0
      ? `<span style="color:#7dedaa">✓ ${clubName()} est au complet (${BET_PLAYERS} joueurs)</span>`
      : `<span style="color:#ffd977">Encore ${rem} joueur${rem > 1 ? "s" : ""} à recruter</span>`;
    $("#fav-go").disabled = rem !== 0;
  }
  $("#fav-search").addEventListener("input", e => drawGrid(e.target.value));
  $("#fav-go").addEventListener("click", () => {
    try {
      setFavorites((cp ? [cp.id] : []).concat(Array.from(picked)));
      showMain();
    } catch (e) { alert(e.message); }
  });
  refresh();
}

/* ---------- Multisaison : ton champion progresse (+3 points) ---------- */
function renderUpgradeStep(container) {
  const cp = customPlayer();
  if (!cp) { renderFavoritesStep(container); return; }
  const base = Object.assign({}, cp.sk);
  const sk = Object.assign({}, cp.sk);
  const baseTotal = SKILL_KEYS.reduce((s, k) => s + base[k], 0);

  container.innerHTML = `
    <h2>Saison ${state.year} — ${cp.name} progresse 💪</h2>
    <p style="color:#b9cdf1;font-size:13.5px;margin-bottom:14px">
      Une saison d'expérience en plus : répartis <strong>${CHAMPION_SEASON_BONUS} nouveaux points</strong>
      de compétence (chaque compétence reste plafonnée à 10).</p>
    <div class="bet-slip" style="max-width:520px">
      <h3>⚙️ ${baseTotal} points + ${CHAMPION_SEASON_BONUS} à placer</h3>
      <div class="cp-remaining" id="up-remaining"></div>
      <div id="up-skills"></div>
      <div class="fav-actions">
        <button class="btn btn-gold" id="up-go" disabled>✅ Valider &amp; recruter mon club</button>
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
      renderFavoritesStep(container);
    } catch (e) { alert(e.message); }
  });
  draw();
}

/* Le bouton en haut à droite = SOLDE BANCAIRE en direct (vert si au-dessus
   du capital de départ, rouge en dessous). Clic : écran banque. */
function updateBankChip() {
  const chip = $("#bank-chip");
  const xc = $("#xp-chip");
  if (!state || !state.betsPlaced) {
    chip.classList.add("hidden");
    if (xc) xc.classList.add("hidden");
    return;
  }
  chip.classList.remove("hidden");
  const cash = Math.round(state.cash || 0);
  chip.textContent = "💶 " + fmtEuro(cash);
  chip.classList.toggle("up", cash > (state.bankroll || 0));
  chip.classList.toggle("down", cash < (state.bankroll || 0));
  /* 🎖 La pastille CLASSEMENT (v27) : le rang actuel de ton champion,
     clic → la page Ma carrière (XP, goals, journal). */
  if (xc) {
    if (!customPlayer() || !state.xp) { xc.classList.add("hidden"); }
    else {
      xc.classList.remove("hidden");
      xc.textContent = "🎖 " + championClassement().label;
    }
  }
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

/* ---------- Étape 2 : création de ton champion (le 128e joueur) ----------
   v27 : le classement n'est plus choisi — tout le monde démarre classé 40
   et grimpe l'échelle (jusqu'à −15) à l'expérience. */
function renderPlayerStep(container) {
  // Ton champion a le MÊME total que la moyenne du plateau : son avantage,
  // c'est le profil sur mesure (et les +3 points par saison en carrière).
  const TARGET = championSkillTotal();
  const sk = {};
  const base = Math.max(1, Math.min(10, Math.floor(TARGET / 10)));
  SKILL_KEYS.forEach(k => { sk[k] = base; }); // le reliquat (0 à 9 points) est à placer

  const countryOptions = Object.entries(COUNTRY_NAMES)
    .sort((a, b) => a[1].localeCompare(b[1], "fr"))
    .map(([flag, name]) => `<option value="${flag}" ${flag === "🇫🇷" ? "selected" : ""}>${name}</option>`)
    .join("");

  container.innerHTML = `
    <h2>2 · Crée ton champion — le 128<sup>e</sup> joueur</h2>
    <p style="color:#b9cdf1;font-size:13.5px;margin-bottom:14px">
      Tu entres sur le circuit avec <strong>${TARGET} points</strong> de compétences — la moyenne
      du plateau, ni plus ni moins. Ton avantage : un profil <strong>sur mesure</strong>, chacune de 1 à 10
      (et +${CHAMPION_SEASON_BONUS} points par saison en mode carrière). À toi la gloire… et la banque 🏦</p>
    <div class="create-layout">
      <div>
        <label class="cp-label">Prénom</label>
        <input class="cp-input" id="cp-prenom" placeholder="Mon prénom" maxlength="20">
        <label class="cp-label">Nom</label>
        <input class="cp-input" id="cp-nom" placeholder="Mon nom" maxlength="24">
        <label class="cp-label">Club</label>
        <input class="cp-input" id="cp-club" placeholder="Mon club" maxlength="30">
        <label class="cp-label">Nationalité</label>
        <select class="cp-input" id="cp-pays">${countryOptions}</select>
        <div class="cp-start-note">🎖 Tu démarres <strong>classé 40</strong>, comme tout débutant.
        Victoires, goals et perfs te feront grimper l'échelle… jusqu'au mythique <strong>−15</strong>.</div>
      </div>
      <div class="bet-slip">
        <h3>⚙️ Tes ${TARGET} points de compétences</h3>
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
        <button class="cp-step" data-k="${s.key}" data-d="1" ${sk[s.key] >= 10 || total() >= TARGET ? "disabled" : ""}>+</button>
        <span class="cp-skill-bar"><span style="width:${sk[s.key] * 10}%"></span></span>`;
      skillsDiv.appendChild(row);
    });
    skillsDiv.querySelectorAll(".cp-step").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.k, d = parseInt(b.dataset.d, 10);
      const t = total();
      if (d > 0 && (sk[k] >= 10 || t >= TARGET)) return;
      if (d < 0 && sk[k] <= 1) return;
      sk[k] += d;
      draw(); update();
    }));
    const rem = TARGET - total();
    $("#cp-remaining").innerHTML = rem === 0
      ? `<span style="color:#7dedaa">✓ ${TARGET} / ${TARGET} points répartis — ajuste librement avec − et +</span>`
      : `<span style="color:#ffd977">${rem} point${rem > 1 ? "s" : ""} restant${rem > 1 ? "s" : ""} à placer</span>`;
  }
  function update() {
    const name = ($("#cp-prenom").value.trim() + " " + $("#cp-nom").value.trim()).trim();
    $("#cp-go").disabled = !(name.length >= 3 && total() === TARGET);
  }
  ["cp-prenom", "cp-nom"].forEach(id => $("#" + id).addEventListener("input", update));
  $("#cp-go").addEventListener("click", () => {
    const name = ($("#cp-prenom").value.trim() + " " + $("#cp-nom").value.trim()).trim();
    addCustomPlayer({
      name,
      flag: $("#cp-pays").value,
      club: $("#cp-club").value,
      sk,
    });
    renderFavoritesStep(container);
  });
  draw(); update();
}

/* ============================================================
   PARIS v22 — helpers partagés
   ============================================================ */
function ctxRef(ctx) {
  if (ctx.kind === "bracket") return { k: "b", r: ctx.roundIdx, i: ctx.matchIdx };
  if (ctx.kind === "rr") return { k: "rr", g: ctx.group, i: ctx.matchIdx };
  if (ctx.kind === "sf") return { k: "sf", i: ctx.matchIdx };
  return { k: "f" };
}
function betsOnRef(rec, ref) {
  const key = refKey(ref);
  return (state.tbets || []).filter(b => (b.kind === "round" || b.kind === "match") &&
    b.tourneyId === rec.id && b.legs.some(l => refKey(l.ref) === key));
}
/* Ligne d'un pari (utilisée partout : panneau, banque, récap, modal) */
function tbetLineHTML(b, noTourney) {
  const t = CALENDAR.find(c => c.id === b.tourneyId);
  const ico = b.status === "open" ? "⏳" : b.status === "won" ? "✅" : "❌";
  const legs = (b.legs && b.legs.length > 1)
    ? `<span class="tbet-legs">${b.legs.map(l => `• ${l.label} <em>×${l.odds.toFixed(2)}</em>`).join("<br>")}</span>` : "";
  const pay = b.status === "won" ? "+" + fmtEuro(b.payout)
    : b.status === "lost" ? "−" + fmtEuro(b.stake)
    : "→ " + fmtEuro(Math.round(b.stake * b.odds));
  return `<div class="tbet-line tbet-${b.status}">
    <span class="tbet-status">${ico}</span>
    <span class="tbet-body">
      <span class="tbet-label">${b.label}${b.match ? ` <span class="tbet-match">${b.match}</span>` : ""}</span>
      ${legs}
      <span class="tbet-meta">${noTourney || !t ? "" : flagHTML(t.country) + " " + t.city + (b.year ? " " + b.year : "") + " · "}mise ${fmtEuro(b.stake)} · cote ×${b.odds.toFixed(2)}</span>
      ${b.result ? `<span class="tbet-result">→ ${b.result}</span>` : ""}
    </span>
    <span class="tbet-payout">${pay}</span>
  </div>`;
}

/* ============================================================
   PARIS DE TOUR — vainqueurs de tous les matchs du tour (sauf
   les tiens), en simples ou en COMBINÉ (cotes multipliées 🚀)
   ============================================================ */
let rbState = { key: null, picks: {}, combo: true, stake: null, open: null };

function renderRoundBets(el, rec) {
  const t = CALENDAR[rec.index];
  const cp = customPlayer();
  const roundLbl = rec.type === "bracket"
    ? roundShortLabel(rec.roundsNames[rec.currentRound], t.drawSize)
    : ({ rr: "Poules", sf: "Demi-finales", final: "Finale" })[rec.phase];
  const slipKey = rec.id + "|" + roundKeyOf(rec);
  if (rbState.key !== slipKey) rbState = { key: slipKey, picks: {}, combo: true, stake: null, open: null };

  const rows = listRoundMatches(rec);
  const betableRows = rows.filter(({ m }) => m.winner === null && !m.walkover && m.p1 !== null && m.p2 !== null &&
    !(cp && (m.p1 === cp.id || m.p2 === cp.id)));
  const ownRows = cp ? rows.filter(({ m }) => m.winner === null && !m.walkover && m.p1 !== null && m.p2 !== null && (m.p1 === cp.id || m.p2 === cp.id)) : [];
  const myOpen = (state.tbets || []).filter(b => b.tourneyId === rec.id && b.status === "open" && (b.kind === "round" || b.kind === "match"));
  if (!betableRows.length && !ownRows.length && !myOpen.length) return;

  const built = rec.roundMk && rec.roundMk.key === roundKeyOf(rec) && !rec.roundMk.partial;
  const isOpen = rbState.open === null ? (built || (betableRows.length > 0 && betableRows.length <= 8)) : rbState.open;

  const card = document.createElement("div");
  card.className = "card round-bets";
  card.innerHTML = `
    <div class="rb-head">
      <h3>🎰 Parier sur le tour — ${roundLbl}</h3>
      <span class="mp-cash">💶 <strong>${fmtEuro(Math.round(state.cash || 0))}</strong></span>
      ${betableRows.length ? `<button class="btn btn-ghost btn-sm" id="rb-toggle">${isOpen ? "▴ Replier"
        : "▾ Coter les " + betableRows.length + " match" + (betableRows.length > 1 ? "s" : "") + " du tour"}</button>` : ""}
    </div>
    <div id="rb-body" class="${isOpen ? "" : "hidden"}"></div>
    <div id="rb-open"></div>`;
  el.appendChild(card);

  const body = card.querySelector("#rb-body");

  function buildBody() {
    const mkR = ensureRoundMarkets(rec);
    body.innerHTML = `
      <div class="mp-note" style="margin:6px 0 8px">Choisis un vainqueur par match — en <strong>combiné</strong>, les cotes se multiplient 🚀</div>
      <div class="rb-list" id="rb-list"></div>
      <div class="rb-slip" id="rb-slip"></div>`;
    const listEl = body.querySelector("#rb-list");
    const slipEl = body.querySelector("#rb-slip");

    function drawList() {
      listEl.innerHTML = "";
      ownRows.forEach(({ m }) => {
        const a = getPlayer(m.p1), b = getPlayer(m.p2);
        listEl.insertAdjacentHTML("beforeend", `<div class="rb-match rb-own">
          <span class="rb-ownlab">⭐ ${flagHTML(a.flag)} ${a.name} – ${flagHTML(b.flag)} ${b.name}</span>
          <span class="rb-noodds">🚫 Ton match — pari interdit</span></div>`);
      });
      betableRows.forEach(({ ref, m }) => {
        const key = refKey(ref);
        const entry = mkR.byKey[key];
        if (!entry) return;
        const mk = entry.mk;
        const row = document.createElement("div");
        row.className = "rb-match";
        [m.p1, m.p2].forEach((pid, side) => {
          const p = getPlayer(pid);
          const o = mk.winner[side].odds;
          const btn = document.createElement("button");
          btn.className = "rb-side" + (rbState.picks[key] === pid ? " rb-sel" : "");
          btn.innerHTML = `<span class="rb-pn">${flagHTML(p.flag)} ${p.name}${state.favorites.includes(pid) ? " ⭐" : ""}</span><span class="rb-odds">×${o.toFixed(2)}</span>`;
          btn.addEventListener("click", () => {
            if (rbState.picks[key] === pid) delete rbState.picks[key];
            else rbState.picks[key] = pid;
            drawList(); drawSlip();
          });
          row.appendChild(btn);
        });
        listEl.appendChild(row);
      });
    }

    function slipData() {
      return Object.entries(rbState.picks).map(([key, pid]) => {
        const e = mkR.byKey[key];
        if (!e) return null;
        const o = e.mk.winner.find(w => w.pid === pid);
        return o ? { ref: e.ref, pid, odds: o.odds } : null;
      }).filter(Boolean);
    }

    function drawSlip() {
      const picks = slipData();
      if (!picks.length) {
        slipEl.innerHTML = `<div class="bet-empty">Sélectionne des vainqueurs ci-dessus pour construire ton ticket 🎫</div>`;
        return;
      }
      const combo = rbState.combo && picks.length >= 2;
      const prodOdds = Math.round(picks.reduce((o, p) => o * p.odds, 1) * 100) / 100;
      const defStake = Math.max(TBET_MIN, Math.min(500, Math.floor((state.cash || 0) / 100) * 100));
      const stake = rbState.stake !== null ? rbState.stake : defStake;
      slipEl.innerHTML = `
        <div class="rb-slip-head">
          <span>🎫 ${picks.length} sélection${picks.length > 1 ? "s" : ""}</span>
          <span class="rb-mode">
            <button class="rb-mode-btn ${combo ? "" : "active"}" id="rb-simple">Simples</button>
            <button class="rb-mode-btn ${combo ? "active" : ""}" id="rb-combo" ${picks.length < 2 ? "disabled" : ""}>Combiné ×${prodOdds.toFixed(2)}</button>
          </span>
        </div>
        <div class="mk-form">
          <input type="number" id="rb-stake" min="${TBET_MIN}" step="100" value="${stake}">
          <span class="mk-gain" id="rb-gain"></span>
          <button class="btn btn-sm" id="rb-go">Parier 🎰</button>
        </div>`;
      const stakeEl = slipEl.querySelector("#rb-stake");
      const gainEl = slipEl.querySelector("#rb-gain");
      const goBtn = slipEl.querySelector("#rb-go");
      function refreshGain() {
        const v = Math.round(Number(stakeEl.value) || 0);
        rbState.stake = v;
        const total = combo ? v : v * picks.length;
        const gain = combo ? Math.round(v * prodOdds) : Math.round(picks.reduce((s, p) => s + v * p.odds, 0));
        const ok = v >= TBET_MIN && total <= (state.cash || 0);
        goBtn.disabled = !ok;
        gainEl.textContent = !ok && total > (state.cash || 0) ? "solde insuffisant (" + fmtEuro(total) + " demandés)"
          : combo ? `cote ×${prodOdds.toFixed(2)} → gain potentiel ${fmtEuro(gain)}`
          : `${picks.length} pari${picks.length > 1 ? "s" : ""} de ${fmtEuro(v)} (total ${fmtEuro(total)}) → jusqu'à ${fmtEuro(gain)}`;
      }
      stakeEl.addEventListener("input", refreshGain);
      slipEl.querySelector("#rb-simple").addEventListener("click", () => { rbState.combo = false; drawSlip(); });
      const cb = slipEl.querySelector("#rb-combo");
      if (!cb.disabled) cb.addEventListener("click", () => { rbState.combo = true; drawSlip(); });
      goBtn.addEventListener("click", () => {
        try {
          placeRoundBets(rec.id, picks.map(p => ({ ref: p.ref, pid: p.pid })), stakeEl.value, combo);
          rbState.picks = {};
          rbState.stake = null;
          navigate("tournament", { id: rec.id, section: viewParams.section });
        } catch (e) { alert(e.message); }
      });
      refreshGain();
    }
    drawList();
    drawSlip();
  }

  function buildWithLoading() {
    body.innerHTML = `<div class="sbk-loading"><span class="spin">🎾</span>
      Le bookmaker cote les ${betableRows.length} matchs du tour…</div>`;
    setTimeout(() => { buildBody(); }, 40);
  }

  const toggleBtn = card.querySelector("#rb-toggle");
  if (toggleBtn) toggleBtn.addEventListener("click", () => {
    const wasHidden = body.classList.contains("hidden");
    rbState.open = wasHidden;
    body.classList.toggle("hidden");
    toggleBtn.textContent = wasHidden ? "▴ Replier"
      : "▾ Coter les " + betableRows.length + " match" + (betableRows.length > 1 ? "s" : "") + " du tour";
    if (wasHidden && !body.childNodes.length) {
      if (rec.roundMk && rec.roundMk.key === roundKeyOf(rec) && !rec.roundMk.partial) buildBody();
      else buildWithLoading();
    }
  });

  if (isOpen) {
    if (built) buildBody();
    else buildWithLoading();
  }

  const openEl = card.querySelector("#rb-open");
  if (myOpen.length) {
    openEl.innerHTML = `<div class="mk-title" style="margin-top:10px">🎫 Tes paris en cours sur ce tournoi</div>` +
      myOpen.map(b => tbetLineHTML(b, true)).join("");
  }
}

/* ============================================================
   PARIS DE MATCH — les marchés classiques d'un match précis :
   vainqueur, 1er set, score exact, plus/moins de jeux, handicap,
   tie-break, et plus/moins d'aces et de doubles fautes PAR JOUEUR
   ============================================================ */
function renderMatchBetBox(container, rec, ref, onPlaced) {
  container.innerHTML = "";
  const m = matchByRef(rec, ref);
  if (!m || m.winner !== null || m.walkover || rec.status !== "active") return;
  const entry = ensureMatchMarket(rec, ref); // cote CE match à la demande (instantané)
  if (!entry) return; // match de ton champion : pas de cote
  const mk = entry.mk;
  const frNum = x => String(x).replace(".", ",");
  const myOpen = betsOnRef(rec, ref).filter(b => b.status === "open");

  const box = document.createElement("div");
  box.className = "mb-box";
  box.innerHTML = `
    <div class="mb-head">
      <button class="btn btn-ghost btn-sm" id="mb-toggle">🎰 Parier sur ce match ▾</button>
      <span class="mp-cash">💶 <strong>${fmtEuro(Math.round(state.cash || 0))}</strong></span>
      ${myOpen.length ? `<span class="mb-count">🎫 ${myOpen.length} pari${myOpen.length > 1 ? "s" : ""} en jeu (${fmtEuro(myOpen.reduce((s, b) => s + b.stake, 0))})</span>` : ""}
    </div>
    <div class="mb-markets hidden" id="mb-markets"></div>`;
  container.appendChild(box);
  const marketsEl = box.querySelector("#mb-markets");
  let built = false, selection = null, betBtn = null;

  box.querySelector("#mb-toggle").addEventListener("click", function () {
    const hidden = marketsEl.classList.toggle("hidden");
    this.innerHTML = hidden ? "🎰 Parier sur ce match ▾" : "🎰 Parier sur ce match ▴";
    if (!built) { build(); built = true; }
  });

  const takenKey = (market, pid) => rec.id + "|" + refKey(ref) + "|" + market + (pid !== undefined ? ":" + pid : "");
  const taken = (market, pid) => (state.tbets || []).some(b => b.marketKey === takenKey(market, pid));

  function chip(market, pick, label, odds, pidKey) {
    const b = document.createElement("button");
    const off = taken(market, pidKey);
    b.className = "mk-chip";
    b.disabled = off;
    b.innerHTML = off ? `${label} <span class="mk-odds">✔ misé</span>` : `${label} <span class="mk-odds">×${odds.toFixed(2)}</span>`;
    if (!off) b.addEventListener("click", () => {
      selection = { market, pick, odds, label };
      marketsEl.querySelectorAll(".mk-chip").forEach(c => c.classList.remove("mk-selected"));
      b.classList.add("mk-selected");
      updateForm();
    });
    return b;
  }
  function block(title, chips) {
    const div = document.createElement("div");
    div.className = "mk-block";
    div.innerHTML = `<div class="mk-title">${title}</div>`;
    const row = document.createElement("div");
    row.className = "mk-row";
    chips.forEach(c => row.appendChild(c));
    div.appendChild(row);
    marketsEl.appendChild(div);
  }
  function updateForm() {
    if (!selection) return;
    const sel = marketsEl.querySelector("#mb-sel"), stake = marketsEl.querySelector("#mb-stake"), gain = marketsEl.querySelector("#mb-gain");
    sel.innerHTML = `${selection.label} <span class="mk-odds">×${selection.odds.toFixed(2)}</span>`;
    stake.disabled = false;
    if (!stake.value) stake.value = Math.max(TBET_MIN, Math.min(500, Math.floor((state.cash || 0) / 100) * 100));
    const refreshGain = () => {
      const v = Math.round(Number(stake.value) || 0);
      const ok = v >= TBET_MIN && v <= (state.cash || 0);
      betBtn.disabled = !ok;
      gain.textContent = ok ? "→ gain potentiel " + fmtEuro(Math.round(v * selection.odds)) : "";
    };
    stake.oninput = refreshGain;
    refreshGain();
  }
  function build() {
    const nm = pid => getPlayer(pid).name;
    block("1️⃣ 2️⃣ Vainqueur du match", mk.winner.map(w =>
      chip("winner", w.pid, `${flagHTML(getPlayer(w.pid).flag)} ${nm(w.pid)}`, w.odds)));
    block("🧮 Score exact (en sets)", mk.score.map(s =>
      chip("score", s.pid + ":" + s.sw + "-" + s.sl, `${nm(s.pid)} ${s.sw}-${s.sl}`, s.odds)));
    block(`📏 Nombre de jeux du match — ligne à ${frNum(mk.ou.line)}`, [
      chip("ou", "over", `Plus de ${frNum(mk.ou.line)}`, mk.ou.over),
      chip("ou", "under", `Moins de ${frNum(mk.ou.line)}`, mk.ou.under)]);
    block("⚖️ Handicap jeux", [
      chip("hcp", "fav", `${nm(mk.hcp.favPid)} −${frNum(mk.hcp.line)}`, mk.hcp.fav),
      chip("hcp", "dog", `${nm(mk.hcp.dogPid)} +${frNum(mk.hcp.line)}`, mk.hcp.dog)]);
    block("🥇 Vainqueur du 1er set", mk.set1.map(w =>
      chip("set1", w.pid, `${flagHTML(getPlayer(w.pid).flag)} ${nm(w.pid)}`, w.odds)));
    block("🔥 Au moins un tie-break dans le match ?", [
      chip("tb", "yes", "Oui", mk.tb.yes),
      chip("tb", "no", "Non", mk.tb.no)]);
    block("🎯 Aces par joueur — plus/moins", mk.pAces.flatMap(x => [
      chip("pace", x.pid + ":over", `${nm(x.pid)} · + de ${frNum(x.line)}`, x.over, x.pid),
      chip("pace", x.pid + ":under", `${nm(x.pid)} · − de ${frNum(x.line)}`, x.under, x.pid)]));
    block("😬 Doubles fautes par joueur — plus/moins", mk.pDf.flatMap(x => [
      chip("pdf", x.pid + ":over", `${nm(x.pid)} · + de ${frNum(x.line)}`, x.over, x.pid),
      chip("pdf", x.pid + ":under", `${nm(x.pid)} · − de ${frNum(x.line)}`, x.under, x.pid)]));
    const form = document.createElement("div");
    form.className = "mk-form";
    form.innerHTML = `<span class="mk-sel" id="mb-sel">Choisis un pari ci-dessus…</span>
      <input type="number" id="mb-stake" min="${TBET_MIN}" step="100" placeholder="Mise €" disabled>
      <span class="mk-gain" id="mb-gain"></span>`;
    betBtn = mkBtn("Parier", "btn btn-sm", () => {
      try {
        placeMatchBet(rec.id, ref, selection.market, selection.pick, marketsEl.querySelector("#mb-stake").value);
        if (onPlaced) onPlaced();
      } catch (e) { alert(e.message); }
    });
    betBtn.disabled = true;
    form.appendChild(betBtn);
    marketsEl.appendChild(form);
  }
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
  const st = seasonSettlement();
  if (!confirm(`Lancer la saison ${state.year + 1} ?\n\n🧾 Bilan ${state.year} :\n` +
    `💶 Solde bancaire : ${fmtEuro(st.cash)} (prize money nets, taxes, staff et frais déjà réglés tournoi par tournoi)\n` +
    `🎾 Prize money encaissés : ${fmtEuro(st.prize)} bruts → ${fmtEuro(st.prizeNet)} nets\n` +
    `🎰 Paris : ${st.betNet >= 0 ? "+" : "−"}${fmtEuro(Math.abs(st.betNet))}${st.betTax > 0 ? " → impôt " + fmtEuro(st.betTax) + " (30 %)" : " (aucun impôt)"}\n\n` +
    `💼 Tu repars avec ${fmtEuro(st.final)}${st.final < 0 ? " — la dette te suit !" : ""}.\n\n` +
    `Le plateau retire de nouvelles compétences, la saison démarre avec les classements finaux de ${state.year}` +
    (cp ? `, et ${cp.name} gagne ${CHAMPION_SEASON_BONUS} points de compétence.` : "."))) return;
  try {
    startNextSeason();
    showOnboarding(state.pendingUpgrade ? "upgrade" : "favorites");
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
          ${s.cpRank ? `· ton champion n°${s.cpRank}${s.cpTitles ? ` (${s.cpTitles} titre${s.cpTitles > 1 ? "s" : ""})` : ""}` : ""}
          ${s.prizeNet !== undefined ? `<span class="cl-tax">💼 prize net ${fmtEuro(s.prizeNet)} · paris ${s.betNet >= 0 ? "+" : "−"}${fmtEuro(Math.abs(s.betNet))}</span>` : ""}</span>
        <span class="cl-bank ${s.bank >= (s.start || 0) ? "up" : "down"}">${fmtEuro(s.bank)}</span>
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
    // 🎾 Jouer mon club : la simulation avance et s'arrête sur chaque match du club
    actions.appendChild(mkBtn("🎾 Jouer mon club", "btn", () => {
      playAllMode = false;
      const nm = advanceToNextBetMatch(rec);
      if (rec.status === "done") { navigate("recap", { id: tid }); return; }
      navigate("tournament", { id: tid });
      if (nm) openMatchModal(rec, nm);
    }));
    // 🎾 Jouer le tournoi : TOUS les matchs, un par un, à la main
    actions.appendChild(mkBtn("🎾 Jouer le tournoi", "btn btn-ghost btn-all", () => {
      playAllMode = true;
      const nm = findNextBetMatch(rec, true);
      if (!nm) { navigate(rec.status === "done" ? "recap" : "tournament", { id: tid }); return; }
      navigate("tournament", { id: tid });
      openMatchModal(rec, nm);
    }));
    actions.appendChild(mkBtn("← Saison", "btn btn-ghost", () => navigate("season")));
  } else {
    actions.appendChild(mkBtn("← Retour", "btn btn-ghost", () => navigate("history")));
  }

  if (!readOnly && rec.status === "active") {
    if (!marketsClosed(rec)) {
      // Écran de début de tournoi : 1. présentation · 2. dopage · 3. les paris
      renderTourneyPresentation(el, rec);
      renderDopingCard(el, rec);
      renderMarketPanel(el, rec);
      renderRoundBets(el, rec);
    } else {
      renderRoundBets(el, rec);
      renderMarketPanel(el, rec);
    }
  }

  if (rec.type === "finals") { renderFinalsBody(el, rec, readOnly); return; }
  renderBracketBody(el, rec, readOnly);
}

/* ============================================================
   ÉCRAN DE DÉBUT DE TOURNOI (v23)
   1. Présentation : ville, tenant du titre, dotation, qualifiés
   2. 💉 Préparation spéciale — ton champion uniquement (40 000 € la dose)
   3. 🎰 FUN'BET — le guichet du tournoi, façon site de paris pro
   ============================================================ */
function renderTourneyPresentation(el, rec) {
  const t = CALENDAR[rec.index];
  const card = document.createElement("div");
  card.className = "card tp-card";
  const catLabel = t.cat === "GC" ? "Grand Chelem" : t.cat === "M1000" ? "Masters 1000" : "Masters";
  const dc = defendingChampion(t);
  const defendHtml = dc
    ? (() => { const p = getPlayer(dc.pid); return `🛡 Vainqueur l'an dernier : <strong>${flagHTML(p.flag)} ${p.name}</strong> — il remet <strong>${fmtPts(dc.pts)} pts</strong> en jeu`; })()
    : `🆕 Première édition de l'ère Fun'is — le palmarès s'écrit cette semaine`;
  let qualHtml;
  if (rec.qualifiers && rec.qualifiers.length) {
    qualHtml = `<div class="tp-qtitle">🎟 Les 8 repêchés des qualifications (tirage pondéré au-delà du top ${M1000_DIRECT})</div>
      <div class="mk-row">` + rec.qualifiers.map(pid => {
        const p = getPlayer(pid);
        return `<span class="qual-chip"><span class="q-badge">Q</span> ${flagHTML(p.flag)} ${p.name}
          <span class="qual-rank">n°${currentRank(pid, state.defending ? "rolling" : "points")}</span></span>`;
      }).join("") + `</div>`;
  } else if (rec.type === "finals") {
    qualHtml = `<div class="tp-qtitle">🎟 Les 8 qualifiés à la race</div>
      <div class="mk-row">` + rec.entrants.map(pid => {
        const p = getPlayer(pid);
        return `<span class="qual-chip"><span class="q-badge">${rec.seedsMap[pid]}</span> ${flagHTML(p.flag)} ${p.name}</span>`;
      }).join("") + `</div>`;
  } else {
    qualHtml = `<div class="tp-qtitle">🎾 Tableau complet — les ${t.drawSize} joueurs du circuit sont au rendez-vous</div>`;
  }
  card.innerHTML = `
    <div class="tp-head">
      <div class="tp-title">${flagHTML(t.country)} ${t.name}</div>
      <div class="tp-meta">${t.city} · ${tourneyDates(t)} · ${t.surfaceLabel} · ${catLabel} · ${t.drawSize} joueurs</div>
    </div>
    <div class="tp-facts">
      <span class="tp-fact">${defendHtml}</span>
      <span class="tp-fact">💰 Dotation : <strong>${fmtEuro(tournamentPool(t))}</strong></span>
      <span class="tp-fact">${(() => {
        const cp0 = customPlayer();
        return cp0 && rec.entrants.includes(cp0.id)
          ? `✈️ Ta part des frais de saison : <strong>−${fmtEuro(travelFeeFor(rec.index))}</strong>, débitée à la fin du tournoi`
          : `💤 <strong>${cp0 ? cp0.name : "Ton champion"} n'est pas engagé</strong> — aucune quote-part de frais sur ce tournoi`;
      })()}</span>
    </div>
    <div class="tp-qual">${qualHtml}</div>`;
  el.appendChild(card);
}

/* 💉 Encadré dopage (v27) : booster TON CHAMPION — et lui seul — pour ce tournoi */
function renderDopingCard(el, rec) {
  const t = CALENDAR[rec.index];
  const card = document.createElement("div");
  card.className = "card doping-card";
  if (rec.doped !== undefined && rec.doped !== null) {
    const p = getPlayer(rec.doped);
    card.innerHTML = `<div class="mk-title">💉 Préparation spéciale</div>
      <div class="dope-info">💉 <strong>${p.name}</strong> est boosté pour ce tournoi : insensible à la fatigue…
      mais <strong>5 % de risque de contrôle positif</strong> à l'arrivée (3 mois de suspension) !</div>`;
    el.appendChild(card);
    return;
  }
  const n = state.syringes || 0;
  if (n <= 0) {
    card.innerHTML = `<div class="mk-title">💉 Préparation spéciale</div>
      <div class="dope-info">Plus de doses cette saison.</div>`;
    el.appendChild(card);
    return;
  }
  if ((state.cash || 0) < DOPE_COST) {
    card.innerHTML = `<div class="mk-title">💉 Préparation spéciale — ${n} dose${n > 1 ? "s" : ""} · ${fmtEuro(DOPE_COST)} la dose</div>
      <div class="dope-info">Il te faut <strong>${fmtEuro(DOPE_COST)}</strong> sur ton compte pour payer une dose
      (tu as ${fmtEuro(Math.round(state.cash || 0))}). Gagne des paris pour regarnir ton solde.</div>`;
    el.appendChild(card);
    return;
  }
  const cpD = customPlayer();
  if (!cpD) return;
  if (!rec.entrants.includes(cpD.id)) {
    card.innerHTML = `<div class="mk-title">💉 Préparation spéciale — ${fmtEuro(DOPE_COST)} la dose</div>
      <div class="dope-info">Réservée à <strong>ton champion</strong>… qui ne dispute pas ce tournoi.</div>`;
    el.appendChild(card);
    return;
  }
  const cands = [cpD.id];
  card.innerHTML = `<div class="mk-title">💉 Préparation spéciale — ${n} dose${n > 1 ? "s" : ""} restante${n > 1 ? "s" : ""} · ${fmtEuro(DOPE_COST)} la dose</div>
    <div class="dope-info">Booste <strong>ton champion</strong> pour ce tournoi (débité en direct) : un vrai coup de pouce, zéro fatigue…
    mais <strong>5 % de risque de contrôle positif</strong> à l'issue du tournoi → 3 mois de suspension. Lui seul peut être dopé.</div>`;
  const row = document.createElement("div");
  row.className = "mk-row";
  cands.forEach(pid => {
    const p = getPlayer(pid);
    const b = document.createElement("button");
    b.className = "mk-chip mk-dope";
    b.innerHTML = `💉 ${flagHTML(p.flag)} ${p.name}`;
    b.addEventListener("click", () => {
      if (!confirm(`Doper ${p.name} pour ${t.name} — ${fmtEuro(DOPE_COST)} débités tout de suite ?\n\nAvantage pour tout le tournoi et aucune fatigue — mais 5 % de risque de contrôle positif à l'arrivée (3 mois de suspension). Il te restera ${n - 1} dose${n - 1 > 1 ? "s" : ""} et ${fmtEuro(Math.round((state.cash || 0) - DOPE_COST))}.`)) return;
      try {
        applyDoping(rec.id, pid);
        navigate("tournament", { id: rec.id, section: viewParams.section });
        updateBankChip();
      } catch (e) { alert(e.message); }
    });
    row.appendChild(b);
  });
  card.appendChild(row);
  el.appendChild(card);
}

/* 🎰 FUN'BET — le guichet du tournoi : vainqueur (TOUS les joueurs cotés,
   avec recherche) + totaux plus/moins (aces, doubles fautes, % services) */
function renderMarketPanel(el, rec) {
  const t = CALENDAR[rec.index];
  const closed = marketsClosed(rec);
  const myBets = (state.tbets || []).filter(b => b.tourneyId === rec.id && b.kind === "tournament");
  const dopedNote = rec.doped !== undefined && rec.doped !== null
    ? `<span class="tbet-chip dope-chip">💉 ${getPlayer(rec.doped).name} boosté</span>` : "";

  // Marché fermé : simple rappel de tes paris en cours sur ce tournoi
  if (closed) {
    if (myBets.length === 0 && !dopedNote) return;
    const strip = document.createElement("div");
    strip.className = "card market-strip";
    strip.innerHTML = `<strong>🏆 Tes paris de tournoi :</strong> ` + myBets.map(b =>
      `<span class="tbet-chip">${b.label} · ${fmtEuro(b.stake)} ×${b.odds.toFixed(2)}
        ${b.status === "won" ? "✅" : b.status === "lost" ? "❌" : "⏳"}</span>`).join(" ") + dopedNote;
    el.appendChild(strip);
    return;
  }

  const panel = document.createElement("div");
  panel.className = "card market-panel sbk";
  const headHtml = `
    <div class="sbk-head">
      <span class="sbk-brand">🎰 FUN'BET</span>
      <span class="sbk-htitle">Les paris du tournoi</span>
      <span class="sbk-cash">💶 ${fmtEuro(Math.round(state.cash || 0))}</span>
    </div>`;

  // Cotes calculées au premier affichage (message d'attente, pas de gel)
  if (!rec.markets) {
    panel.innerHTML = headHtml + `
      <div class="sbk-loading"><span class="spin">🎾</span>
        Le bookmaker simule ${TBET_SIMS} fois le tableau réel, point par point,
        pour coter les ${rec.entrants.length} joueurs…</div>`;
    el.appendChild(panel);
    setTimeout(() => {
      ensureTournamentMarkets(rec);
      if (currentView === "tournament" && viewParams.id === rec.id)
        navigate("tournament", { ...viewParams });
    }, 60);
    return;
  }

  const mk = rec.markets;
  panel.innerHTML = headHtml + `
    <div class="sbk-note">Marché ouvert jusqu'au premier match · cotes simulées sur le tableau réellement tiré</div>`;

  if ((state.cash || 0) < TBET_MIN && myBets.length === 0) {
    panel.insertAdjacentHTML("beforeend", `<div class="mp-empty">
      Solde insuffisant pour miser (minimum ${fmtEuro(TBET_MIN)}) — gagne des paris de match
      ou de tour pour regarnir ton compte. 💶</div>`);
    el.appendChild(panel);
    return;
  }

  let selection = null;
  const frNum = x => String(x).replace(".", ",");

  /* ---- 🏆 Vainqueur : tous les joueurs, avec recherche ---- */
  const winnerBox = document.createElement("div");
  winnerBox.className = "sbk-market";
  winnerBox.innerHTML = `
    <div class="sbk-mtitle">🏆 Vainqueur du tournoi <span class="sbk-mcount">${mk.winner.length} joueurs cotés</span></div>
    <input class="fav-search sbk-search" id="sbk-search" placeholder="🔍 Chercher un joueur…">
    <div class="sbk-wgrid" id="sbk-wgrid"></div>`;
  panel.appendChild(winnerBox);
  const takenW = myBets.find(b => b.marketKey === "winner");
  function drawWinners(filter = "") {
    const grid = winnerBox.querySelector("#sbk-wgrid");
    grid.innerHTML = "";
    const f = filter.toLowerCase();
    mk.winner
      .filter(w => getPlayer(w.pid).name.toLowerCase().includes(f))
      .forEach(w => {
        const p = getPlayer(w.pid);
        const picked = takenW && takenW.pick === w.pid;
        const b = document.createElement("button");
        b.className = "sbk-sel" + (picked ? " mk-placed" : "");
        b.disabled = !!takenW;
        b.innerHTML = `<span class="sbk-pn">${flagHTML(p.flag)} ${p.name}${state.favorites.includes(w.pid) ? " ⭐" : ""}</span>
          <span class="sbk-rank">n°${currentRank(w.pid, state.defending ? "rolling" : "points")}</span>
          <span class="sbk-odds">${picked ? "✔ misé" : "×" + w.odds.toFixed(2)}</span>`;
        if (!takenW) b.addEventListener("click", () => {
          selection = { market: "winner", pick: w.pid, odds: w.odds, label: "Vainqueur : " + p.name };
          panel.querySelectorAll(".sbk-sel, .mk-chip:not(.mk-dope)").forEach(c => c.classList.remove("mk-selected"));
          b.classList.add("mk-selected");
          updateForm();
        });
        grid.appendChild(b);
      });
  }
  winnerBox.querySelector("#sbk-search").addEventListener("input", e => drawWinners(e.target.value));
  drawWinners();

  /* ---- 📊 Totaux du tournoi : plus/moins ---- */
  function ouChip(market, pick, label, odds) {
    const off = myBets.some(b => b.marketKey === market);
    const b = document.createElement("button");
    b.className = "mk-chip";
    b.disabled = off;
    const placed = off && myBets.some(bb => bb.marketKey === market && bb.pick === pick);
    if (placed) b.classList.add("mk-placed");
    b.innerHTML = placed ? `${label} <span class="mk-odds">✔ misé</span>` : `${label} <span class="mk-odds">×${odds.toFixed(2)}</span>`;
    if (!off) b.addEventListener("click", () => {
      const mktLabel = market === "oua" ? "Aces du tournoi" : market === "oud" ? "Doubles fautes du tournoi" : "Services gagnés du tournoi";
      selection = { market, pick, odds, label: mktLabel + " : " + label.toLowerCase() };
      panel.querySelectorAll(".sbk-sel, .mk-chip:not(.mk-dope)").forEach(c => c.classList.remove("mk-selected"));
      b.classList.add("mk-selected");
      updateForm();
    });
    return b;
  }
  const totBox = document.createElement("div");
  totBox.className = "sbk-market";
  totBox.innerHTML = `<div class="sbk-mtitle">📊 Les totaux du tournoi <span class="sbk-mcount">plus / moins</span></div>`;
  const totRow = (icon, label, market, mkt, unit) => {
    const row = document.createElement("div");
    row.className = "sbk-total";
    row.innerHTML = `<span class="sbk-tlabel">${icon} ${label} <span class="sbk-line">ligne à ${frNum(mkt.line)}${unit}</span></span>
      <span class="sbk-tchips"></span>`;
    const chips = row.querySelector(".sbk-tchips");
    chips.appendChild(ouChip(market, "over", `Plus de ${frNum(mkt.line)}${unit}`, mkt.over));
    chips.appendChild(ouChip(market, "under", `Moins de ${frNum(mkt.line)}${unit}`, mkt.under));
    totBox.appendChild(row);
  };
  totRow("🎯", "Aces du tournoi", "oua", mk.ouAces, "");
  totRow("😬", "Doubles fautes du tournoi", "oud", mk.ouDf, "");
  totRow("📈", "% de jeux de service gagnés", "ouh", mk.ouHold, " %");
  panel.appendChild(totBox);

  /* ---- Formulaire de mise ---- */
  const form = document.createElement("div");
  form.className = "mk-form sbk-form";
  form.innerHTML = `
    <span class="mk-sel" id="mk-sel">Choisis un pari ci-dessus…</span>
    <input type="number" id="mk-stake" min="${TBET_MIN}" step="100" placeholder="Mise €" disabled>
    <span class="mk-gain" id="mk-gain"></span>`;
  const betBtn = mkBtn("Parier 🎰", "btn btn-sm", () => {
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

  /* ---- 🎫 Tes paris placés ---- */
  if (myBets.length) {
    const box = document.createElement("div");
    box.className = "mk-block mk-mybets";
    box.innerHTML = `<div class="mk-title">🎫 Tes paris placés sur ce tournoi</div>` +
      myBets.map(b => tbetLineHTML(b, true)).join("");
    panel.appendChild(box);
  }
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

  // v25 : navigation PAR TOUR — revenir sur n'importe quel tour, passé ou à venir
  const rndNav = document.createElement("div");
  rndNav.className = "bracket-nav round-nav";
  rndNav.insertAdjacentHTML("beforeend", `<span class="rn-label">Par tour :</span>`);
  rec.roundsNames.forEach((rn2, r) => {
    const b = document.createElement("button");
    const val = "r" + r;
    const isCurrent = rec.status === "active" && r === rec.currentRound;
    b.className = "sec-btn rnd-btn" + (mode === val ? " active" : "") + (isCurrent ? " rnd-current" : "");
    b.textContent = roundShortLabel(rn2, t.drawSize) + (isCurrent ? " ●" : "");
    b.addEventListener("click", () => { viewParams.section = val; navigate("tournament", { ...viewParams }); });
    rndNav.appendChild(b);
  });
  el.appendChild(rndNav);

  const info = document.createElement("div");
  info.className = "page-sub";
  const rn = rec.roundsNames[Math.min(rec.currentRound, rec.roundsNames.length - 1)];
  info.innerHTML = rec.status === "done"
    ? `Tournoi terminé — vainqueur : <strong>${flagHTML(getPlayer(rec.recap.champion).flag)} ${getPlayer(rec.recap.champion).name}</strong>`
    : `Tour en cours : <strong>${roundShortLabel(rn, t.drawSize)}</strong> — clique sur un match en surbrillance pour le jouer 🎾
       <span style="color:#b8860b">· « Jouer mon club » avance et s'arrête sur chaque match des joueurs de ${clubName()} ⭐</span>`;
  el.appendChild(info);

  if (mode === "overview") renderOverview(el, rec, nSections);
  else if (mode === "final") renderBracketColumns(el, rec, sectionRounds, rec.roundsNames.length, null, readOnly);
  else if (typeof mode === "string" && mode.charAt(0) === "r") renderRoundGrid(el, rec, parseInt(mode.slice(1), 10), readOnly);
  else renderBracketColumns(el, rec, 0, sectionRounds, mode, readOnly);
}

/* v25 : tous les matchs d'UN tour, en grille (navigation par tour) */
function renderRoundGrid(el, rec, r, readOnly) {
  if (!rec.rounds[r]) { navigate("tournament", { id: rec.id }); return; }
  const grid = document.createElement("div");
  grid.className = "round-grid";
  rec.rounds[r].forEach((m, i) => grid.appendChild(matchCard(rec, r, i, readOnly)));
  el.appendChild(grid);
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

/* ============================================================
   RÉCAP D'UN MATCH TERMINÉ — cliquer sur son cartouche dans le
   tableau rouvre sa fiche : score final, stats détaillées, paris
   ============================================================ */
/* v28 : retrouve la position d'un match dans son tournoi (pour ouvrir sa fiche récap) */
function findMatchCtx(rec, m) {
  if (!rec || !m) return null;
  if (rec.type === "bracket") {
    for (let ri = 0; ri < rec.rounds.length; ri++) {
      const mi = rec.rounds[ri].indexOf(m);
      if (mi !== -1) return { kind: "bracket", roundIdx: ri, matchIdx: mi };
    }
    return null;
  }
  for (const g of ["A", "B"]) {
    const mi = rec.rr[g].indexOf(m);
    if (mi !== -1) return { kind: "rr", group: g, matchIdx: mi };
  }
  const si = rec.sf.indexOf(m);
  if (si !== -1) return { kind: "sf", matchIdx: si };
  if (rec.final === m) return { kind: "final" };
  return null;
}

/* v28 : les n derniers matchs joués d'un joueur cette saison (ordre chronologique) */
function lastMatchesOf(pid, n) {
  const out = [];
  CALENDAR.forEach((t, ti) => {
    const rec = state.tournaments[t.id];
    if (!rec) return;
    const matches = rec.type === "bracket"
      ? rec.rounds.flat()
      : rec.rr.A.concat(rec.rr.B, rec.sf, [rec.final]);
    matches.forEach(m => {
      if (!m || m.winner === null || m.walkover || !m.score) return;
      if (m.p1 !== pid && m.p2 !== pid) return;
      // m.when est RELATIF au tournoi : on trie d'abord par tournoi du calendrier
      out.push({ tid: t.id, rec, m, when: ti * 1e6 + (m.when ? m.when[0] * 1440 + m.when[1] : 0) });
    });
  });
  out.sort((a, b) => a.when - b.when);
  return out.slice(-n);
}

function openMatchSummary(rec, ctx) {
  const t = CALENDAR[rec.index];
  let m, roundLabel;
  if (ctx.kind === "bracket") {
    m = rec.rounds[ctx.roundIdx][ctx.matchIdx];
    roundLabel = roundShortLabel(rec.roundsNames[ctx.roundIdx], t.drawSize);
  } else if (ctx.kind === "rr") {
    m = rec.rr[ctx.group][ctx.matchIdx];
    roundLabel = "Journée " + (m.day || 1) + " — Groupe " + (ctx.group === "A" ? "Björn Borg" : "Jimmy Connors");
  } else if (ctx.kind === "sf") {
    m = rec.sf[ctx.matchIdx];
    roundLabel = "Demi-finale";
  } else {
    m = rec.final;
    roundLabel = "FINALE";
  }
  if (!m || m.winner === null || m.walkover || !m.score) return;

  // Le joueur du club s'affiche en haut, comme pendant le match
  const fav1 = state.favorites.includes(m.p1), fav2 = state.favorites.includes(m.p2);
  const flip = fav2 && !fav1;
  const idTop = flip ? m.p2 : m.p1, idBot = flip ? m.p1 : m.p2;
  const pA = getPlayer(idTop), pB = getPlayer(idBot);
  const fTop = flip ? m.form2 : m.form1, fBot = flip ? m.form1 : m.form2;
  const fmIco = f => f && FORM_META[f] ? `<span class="form-ico" title="${FORM_META[f].label}">${FORM_META[f].icon}</span>` : "";
  const setsOf = id => m.score.map((s, i) => {
    const v = id === m.p1 ? s[0] : s[1];
    const won = (s[0] > s[1]) === (id === m.p1);
    const tb = m.tiebreaks && m.tiebreaks[i]
      ? `<span class="tb-mini">${id === m.p1 ? m.tiebreaks[i][0] : m.tiebreaks[i][1]}</span>` : "";
    return `<span class="sb-set${won ? " won" : ""}">${v}${tb}</span>`;
  }).join("");
  const w = getPlayer(m.winner);
  const favTop = state.favorites.includes(idTop), favBot = state.favorites.includes(idBot);
  let bannerCls = "", ico = "🏆", tail = "";
  if (favTop !== favBot) {
    const myWon = state.favorites.includes(m.winner);
    bannerCls = myWon ? " win-banner" : " loss-banner";
    ico = myWon ? "🎉" : "😞";
    tail = myWon ? " — VICTOIRE !" : " — défaite…";
  }
  const row = (id, p, f) => `
    <div class="sb-row">
      <span class="sb-flag">${flagHTML(p.flag)}</span>
      <span>
        <span class="sb-name">${rec.seedsMap[id] ? `<span class="seed">[${rec.seedsMap[id]}]</span>` : ""}<span class="name-link" data-pid="${id}" title="Voir la carte de ${p.name}">${p.name}</span>
          ${fmIco(f)}${state.favorites.includes(id) ? "⭐" : ""}</span>
        <span class="sb-cat">${p.cat}${f && FORM_META[f] ? " · " + FORM_META[f].label : ""}</span>
      </span>
      <span class="sb-sets">${setsOf(id)}</span>
    </div>`;

  const overlay = $("#modal-overlay");
  const modal = $("#modal-match");
  overlay.classList.remove("hidden");
  // v29 : si une carte joueur est ouverte, la fiche du match passe PAR-DESSUS
  overlay.classList.toggle("over-card", !$("#card-overlay").classList.contains("hidden"));
  modal.innerHTML = `
    <div class="m-head">
      <div>
        <div class="m-round">${roundLabel} — RÉCAP DU MATCH</div>
        <div class="m-tourney">${flagHTML(t.country)} ${t.name} · ${t.surfaceLabel}${m.when ? ` · 📅 ${matchWhenLabel(rec, m)}` : ""}</div>
      </div>
      <button class="m-close" id="ms-close">✕</button>
    </div>
    <div class="scoreboard">
      ${row(idTop, pA, fTop)}
      <div class="sb-vs-divider"></div>
      ${row(idBot, pB, fBot)}
    </div>
    <div id="m-banner"><div class="m-winner-banner${bannerCls}">${ico} <strong>${flagHTML(w.flag)} ${w.name}</strong> remporte le match ${formatScore(m, true)}${tail}</div></div>
    <div id="m-stats">${matchStatsHTML(rec, m, flip)}</div>
    <div id="ms-bets"></div>
    <div class="m-controls"><button class="btn btn-sm" id="ms-ok">✓ Fermer</button></div>`;

  // Tes paris sur ce match
  const myBets = betsOnRef(rec, ctxRef(ctx));
  if (myBets.length) {
    $("#ms-bets").innerHTML = `<div class="mb-results">` + myBets.map(b => tbetLineHTML(b, true)).join("") + `</div>`;
  }
  const close = () => { overlay.classList.add("hidden"); overlay.classList.remove("over-card"); modal.innerHTML = ""; };
  $("#ms-close").addEventListener("click", close);
  $("#ms-ok").addEventListener("click", close);
  overlay.onclick = e => { if (e.target === overlay) close(); };
  modal.querySelectorAll(".name-link").forEach(el2 =>
    el2.addEventListener("click", () => openPlayerCard(parseInt(el2.dataset.pid, 10))));
}

function matchCard(rec, roundIdx, matchIdx, readOnly) {
  const m = rec.rounds[roundIdx][matchIdx];
  const div = document.createElement("div");
  const playable = !readOnly && rec.status === "active" && m.winner === null && m.p1 !== null && m.p2 !== null && roundIdx === rec.currentRound;
  div.className = "b-match" + (playable ? " playable" : "") + (m.winner !== null ? " done-m" : "");
  if (m.when) div.title = "📅 " + matchWhenLabel(rec, m);
  div.appendChild(matchRow(rec, m, m.p1, true));
  div.appendChild(matchRow(rec, m, m.p2, false));
  if (playable) {
    div.insertAdjacentHTML("beforeend", `<div class="play-hint">▶</div>`);
    div.addEventListener("click", () => openMatchModal(rec, { kind: "bracket", roundIdx, matchIdx }));
  } else if (m.winner !== null && !m.walkover && m.score) {
    // v25 : un match terminé rouvre sa fiche récapitulative
    div.classList.add("summary-able");
    div.title = "📊 Récap du match" + (m.when ? " · 📅 " + matchWhenLabel(rec, m) : "");
    div.addEventListener("click", () => openMatchSummary(rec, { kind: "bracket", roundIdx, matchIdx }));
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

/* Prochain match à jouer : ceux de mes favoris par défaut, TOUS les matchs si `any` */
function findNextBetMatch(rec, any) {
  if (rec.status !== "active") return null;
  if (rec.type === "bracket") {
    const r = rec.currentRound;
    for (let i = 0; i < rec.rounds[r].length; i++) {
      const m = rec.rounds[r][i];
      if (m.winner === null && m.p1 !== null && m.p2 !== null && (any || isBetMatch(m)))
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
          !readOnly && rec.phase === "rr" && m.winner === null && finalsDayPlayable(rec, day),
          { kind: "rr", group: g, matchIdx: i });
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
      !readOnly && rec.phase === "sf" && m.winner === null && m.p1 !== null,
      { kind: "sf", matchIdx: i }));
  });
  sfCol.appendChild(sfWrap);
  const fCol = document.createElement("div");
  fCol.className = "b-round";
  fCol.innerHTML = `<div class="b-round-title">Finale</div>`;
  const fWrap = document.createElement("div");
  fWrap.className = "b-matches";
  fWrap.appendChild(finalsMatchCard(rec, rec.final, () => openMatchModal(rec, { kind: "final" }),
    !readOnly && rec.phase === "final" && rec.final.winner === null && rec.final.p1 !== null,
    { kind: "final" }));
  fCol.appendChild(fWrap);
  ko.append(sfCol, fCol);
  el.appendChild(ko);
}

function finalsMatchCard(rec, m, onPlay, playable, summaryCtx) {
  const div = document.createElement("div");
  div.className = "b-match" + (playable ? " playable" : "") + (m.winner !== null ? " done-m" : "");
  if (m.when) div.title = "📅 " + matchWhenLabel(rec, m);
  div.appendChild(matchRow(rec, m, m.p1, true));
  div.appendChild(matchRow(rec, m, m.p2, false));
  if (playable) {
    div.insertAdjacentHTML("beforeend", `<div class="play-hint">▶</div>`);
    div.addEventListener("click", onPlay);
  } else if (summaryCtx && m.winner !== null && !m.walkover && m.score) {
    div.classList.add("summary-able");
    div.title = "📊 Récap du match" + (m.when ? " · 📅 " + matchWhenLabel(rec, m) : "");
    div.addEventListener("click", () => openMatchSummary(rec, summaryCtx));
  }
  return div;
}

/* ============================================================
   FENÊTRE DE MATCH — simulation jeu par jeu animée
   ============================================================ */
let matchAnim = null;
let playAllMode = false; // true : « Jouer le tournoi » (tous les matchs à la main)

/* ---------- Récap statistique de fin de match (v21) ---------- */
function matchStatsHTML(rec, m, flip) {
  const st = m.stats;
  if (!st) return "";
  const i = flip ? 1 : 0, j = 1 - i;
  const bp = m.bp || [[0, 0], [0, 0]];
  const conv = [bp[0][0], bp[1][0]], saved = [bp[0][1], bp[1][1]];
  const chances = [conv[0] + saved[1], conv[1] + saved[0]];
  const faced = [saved[0] + conv[1], saved[1] + conv[0]];
  const h = Math.floor(st.mins / 60), mn = st.mins % 60;
  const pctD = (x, y) => (y > 0 ? Math.round(100 * x / y) + " %" : "—");
  const rows = [];
  const row = (label, dA, dB, nA, nB, hiGood) => rows.push(`
    <div class="ms-row">
      <span class="ms-v ${nA !== nB && ((nA > nB) === hiGood) ? "ms-best" : ""}">${dA}</span>
      <span class="ms-l">${label}</span>
      <span class="ms-v ${nA !== nB && ((nB > nA) === hiGood) ? "ms-best" : ""}">${dB}</span>
    </div>`);
  row("Points gagnés", st.ptsWon[i], st.ptsWon[j], st.ptsWon[i], st.ptsWon[j], true);
  const fsr = k => (st.fs[k][1] > 0 ? st.fs[k][0] / st.fs[k][1] : 0);
  row("% de 1res balles", pctD(st.fs[i][0], st.fs[i][1]), pctD(st.fs[j][0], st.fs[j][1]), fsr(i), fsr(j), true);
  row("Aces", st.aces[i], st.aces[j], st.aces[i], st.aces[j], true);
  row("Doubles fautes", st.df[i], st.df[j], st.df[i], st.df[j], false);
  row("Points gagnants", st.win[i], st.win[j], st.win[i], st.win[j], true);
  row("Fautes directes", st.ue[i], st.ue[j], st.ue[i], st.ue[j], false);
  const cvr = k => (chances[k] > 0 ? conv[k] / chances[k] : 0);
  row("Balles de break converties", `${conv[i]}/${chances[i]} (${pctD(conv[i], chances[i])})`, `${conv[j]}/${chances[j]} (${pctD(conv[j], chances[j])})`, cvr(i), cvr(j), true);
  const svr = k => (faced[k] > 0 ? saved[k] / faced[k] : 0);
  row("Balles de break sauvées", `${saved[i]}/${faced[i]} (${pctD(saved[i], faced[i])})`, `${saved[j]}/${faced[j]} (${pctD(saved[j], faced[j])})`, svr(i), svr(j), true);
  row("Points consécutifs (max)", st.streakPts[i], st.streakPts[j], st.streakPts[i], st.streakPts[j], true);
  row("Jeux consécutifs (max)", st.streakGames[i], st.streakGames[j], st.streakGames[i], st.streakGames[j], true);
  row("Balles de set sauvées", st.spSaved[i], st.spSaved[j], st.spSaved[i], st.spSaved[j], true);
  row("Balles de match sauvées", st.mpSaved[i], st.mpSaved[j], st.mpSaved[i], st.mpSaved[j], true);
  return `<div class="match-stats">
    <div class="ms-head"><span>📊 Statistiques du match</span>
      <span class="ms-meta">⏱ ${h}h${mn < 10 ? "0" + mn : mn}${m.when ? " · 📅 " + matchWhenLabel(rec, m) : ""}</span></div>
    ${rows.join("")}
  </div>`;
}

/* ---------- Écran de transition entre deux tours ---------- */
function showRoundTransition(rec, ctx) {
  const t = CALENDAR[rec.index];
  const overlay = $("#modal-overlay");
  const modal = $("#modal-match");
  overlay.classList.remove("hidden");

  let doneLabel, nextLabel;
  if (rec.type === "bracket") {
    doneLabel = roundShortLabel(rec.roundsNames[ctx.roundIdx], t.drawSize);
    nextLabel = roundShortLabel(rec.roundsNames[rec.currentRound], t.drawSize);
  } else {
    doneLabel = ctx.kind === "rr" ? "Poules" : "Demi-finales";
    nextLabel = rec.phase === "sf" ? "Demi-finales" : "Finale";
  }
  // Qui est encore en lice pour le tour suivant ?
  let nextIds = [];
  if (rec.type === "bracket") {
    rec.rounds[rec.currentRound].forEach(mm => {
      if (mm.p1 !== null) nextIds.push(mm.p1);
      if (mm.p2 !== null) nextIds.push(mm.p2);
    });
  } else if (rec.phase === "sf") {
    rec.sf.forEach(mm => { if (mm.p1 !== null) nextIds.push(mm.p1); if (mm.p2 !== null) nextIds.push(mm.p2); });
  } else {
    if (rec.final.p1 !== null) nextIds.push(rec.final.p1);
    if (rec.final.p2 !== null) nextIds.push(rec.final.p2);
  }
  const favLines = state.favorites.map(pid => {
    if (!rec.entrants.includes(pid)) return "";
    const p = getPlayer(pid);
    const alive = nextIds.includes(pid);
    return `<div class="rt-fav ${alive ? "rt-alive" : "rt-out"}">${alive ? "✅" : "❌"} ${flagHTML(p.flag)} ${p.name}${alive ? "" : " — éliminé"}</div>`;
  }).join("");

  modal.innerHTML = `
    <div class="m-head">
      <div>
        <div class="m-round">TRANSITION</div>
        <div class="m-tourney">${flagHTML(t.country)} ${t.name} · ${t.surfaceLabel}</div>
      </div>
      <button class="m-close" id="rt-close">✕</button>
    </div>
    <div class="round-transition">
      <div class="rt-done">🏁 ${doneLabel} — terminé !</div>
      <div class="rt-next">Place ${nextLabel === "Finale" ? "à la" : /tour$/.test(nextLabel) ? "au" : "aux"} <strong>${nextLabel}</strong>
        <span class="rt-count">· ${nextIds.length} joueur${nextIds.length > 1 ? "s" : ""} en lice</span></div>
      ${favLines ? `<div class="rt-favs"><div class="rt-favs-title">🎾 ${clubName()}</div>${favLines}</div>` : ""}
      <div class="rt-actions">
        <button class="btn" id="rt-favs-go">🎾 Jouer mon club</button>
        <button class="btn btn-ghost" id="rt-all-go">🎾 Jouer le tournoi</button>
        <button class="btn btn-ghost" id="rt-board">🎰 Parier sur ce tour</button>
      </div>
    </div>`;

  function closeRT(view, params) {
    overlay.classList.add("hidden");
    modal.innerHTML = "";
    navigate(view || "tournament", params || { id: rec.id });
  }
  $("#rt-close").addEventListener("click", () => closeRT());
  $("#rt-board").addEventListener("click", () => closeRT());
  $("#rt-favs-go").addEventListener("click", () => {
    playAllMode = false;
    const nm = advanceToNextBetMatch(rec);
    if (rec.status === "done") { closeRT("recap"); return; }
    if (nm) openMatchModal(rec, nm); else closeRT();
  });
  $("#rt-all-go").addEventListener("click", () => {
    playAllMode = true;
    const nm = findNextBetMatch(rec, true);
    if (nm) openMatchModal(rec, nm); else closeRT(rec.status === "done" ? "recap" : "tournament");
  });
}

function openMatchModal(rec, ctx) {
  const t = CALENDAR[rec.index];
  // Le match n'est PAS joué tout de suite : on peut d'abord parier dessus 🎰
  let m, roundLabel, playFn;
  if (ctx.kind === "bracket") {
    m = rec.rounds[ctx.roundIdx][ctx.matchIdx];
    playFn = () => playBracketMatch(rec, ctx.roundIdx, ctx.matchIdx);
    roundLabel = roundShortLabel(rec.roundsNames[ctx.roundIdx], t.drawSize);
  } else if (ctx.kind === "rr") {
    m = rec.rr[ctx.group][ctx.matchIdx];
    playFn = () => playFinalsMatch(rec, "rr", ctx.group, ctx.matchIdx);
    roundLabel = "Journée " + (m.day || 1) + " — Groupe " + (ctx.group === "A" ? "Björn Borg" : "Jimmy Connors");
  } else if (ctx.kind === "sf") {
    m = rec.sf[ctx.matchIdx];
    playFn = () => playFinalsMatch(rec, "sf", null, ctx.matchIdx);
    roundLabel = "Demi-finale";
  } else {
    m = rec.final;
    playFn = () => playFinalsMatch(rec, "final", null, 0);
    roundLabel = "FINALE";
  }
  if (!m || m.winner !== null || m.p1 === null || m.p2 === null) return;

  // Mon favori s'affiche toujours EN HAUT (sauf duel entre deux favoris : ordre du tableau).
  // Le moteur garde p1/p2 : seul l'AFFICHAGE est retourné (flipEvent traduit les événements).
  const fav1 = state.favorites.includes(m.p1), fav2 = state.favorites.includes(m.p2);
  const flip = fav2 && !fav1;
  const idTop = flip ? m.p2 : m.p1, idBot = flip ? m.p1 : m.p2;
  function flipEvent(ev) {
    if (!flip) return ev;
    const e = Object.assign({}, ev);
    const sw = s => (s === "A" ? "B" : s === "B" ? "A" : s);
    if (e.server !== undefined) e.server = sw(e.server);
    if (e.winner !== undefined) e.winner = sw(e.winner);
    if (e.gA !== undefined) { const g = e.gA; e.gA = e.gB; e.gB = g; }
    if (e.pa !== undefined) { const p = e.pa; e.pa = e.pb; e.pb = p; }
    if (e.score) e.score = [e.score[1], e.score[0]];
    if (e.setsA !== undefined) { const s2 = e.setsA; e.setsA = e.setsB; e.setsB = s2; }
    return e;
  }

  const pA = getPlayer(idTop), pB = getPlayer(idBot);
  const cp0 = customPlayer();
  const isChampMatch = !!(cp0 && (m.p1 === cp0.id || m.p2 === cp0.id)); // on ne parie pas sur soi-même
  // Forme au moment du match (identique à ce que le moteur enregistrera)
  const f1 = formStatus(idTop, rec), f2 = formStatus(idBot, rec);
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
        <div class="m-tourney">${flagHTML(t.country)} ${t.name} · ${t.surfaceLabel}${m.when ? ` · 📅 ${matchWhenLabel(rec, m)}` : ""}</div>
      </div>
      <button class="m-close" id="m-close">✕</button>
    </div>
    <div class="scoreboard">
      <div class="sb-row" id="sb-A">
        <span class="sb-flag">${flagHTML(pA.flag)}</span>
        <span>
          <span class="sb-name">${rec.seedsMap[idTop] ? `<span class="seed">[${rec.seedsMap[idTop]}]</span>` : ""}<span class="name-link" id="link-A" title="Voir la carte de ${pA.name}">${pA.name}</span>
            ${fmIco(f1)}${state.favorites.includes(idTop) ? "⭐" : ""}<span class="serve-dot hidden" id="serve-A"></span></span>
          <span class="sb-cat">n°${currentRank(idTop, "points")} à la race · ${pA.cat}${f1 && FORM_META[f1] ? " · " + FORM_META[f1].label : ""}</span>
        </span>
        <span class="sb-sets" id="sets-A"></span>
      </div>
      <div class="sb-vs-divider"></div>
      <div class="sb-row" id="sb-B">
        <span class="sb-flag">${flagHTML(pB.flag)}</span>
        <span>
          <span class="sb-name">${rec.seedsMap[idBot] ? `<span class="seed">[${rec.seedsMap[idBot]}]</span>` : ""}<span class="name-link" id="link-B" title="Voir la carte de ${pB.name}">${pB.name}</span>
            ${fmIco(f2)}${state.favorites.includes(idBot) ? "⭐" : ""}<span class="serve-dot hidden" id="serve-B"></span></span>
          <span class="sb-cat">n°${currentRank(idBot, "points")} à la race · ${pB.cat}${f2 && FORM_META[f2] ? " · " + FORM_META[f2].label : ""}</span>
        </span>
        <span class="sb-sets" id="sets-B"></span>
      </div>
    </div>
    <div id="m-bet"></div>
    <div id="m-banner"></div>
    <div id="m-stats"></div>
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

  /* 🎰 Paris sur CE match : boîte de marchés avant le coup d'envoi */
  const betRef = ctxRef(ctx);
  function matchBetsList() { return betsOnRef(rec, betRef); }
  function refreshBetBox() {
    renderMatchBetBox($("#m-bet"), rec, betRef, () => { refreshBetBox(); updateBankChip(); });
  }
  function showMatchBetsCompact() {
    const open = matchBetsList().filter(b => b.status === "open");
    $("#m-bet").innerHTML = open.length
      ? `<div class="mb-inplay">🎫 En jeu sur ce match : ${open.map(b =>
          `<span class="tbet-chip">${b.combo ? "Combiné ×" + b.legs.length : b.label} · ${fmtEuro(b.stake)} ×${b.odds.toFixed(2)}</span>`).join(" ")}</div>` : "";
  }
  function showMatchBetResults() {
    const mine = matchBetsList();
    if (!mine.length) { $("#m-bet").innerHTML = ""; return; }
    $("#m-bet").innerHTML = `<div class="mb-results">` + mine.map(b => tbetLineHTML(b, true)).join("") + `</div>`;
  }
  if (!isChampMatch) refreshBetBox();

  /* État de replay — la vitesse choisie est mémorisée pour les matchs suivants */
  const savedSpeed = typeof state.matchSpeed === "number" ? state.matchSpeed : 650;
  const replay = {
    events: [], idx: 0, timer: null, speed: savedSpeed,
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
      // Bandeau VERT si mon favori gagne, ROUGE s'il perd (neutre si duel de favoris ou sans favori)
      const favTop = state.favorites.includes(idTop), favBot = state.favorites.includes(idBot);
      let bannerCls = "", bannerIco = "🏆", bannerTail = "";
      if (favTop !== favBot) {
        const myWon = (ev.winner === "A") === favTop;
        bannerCls = myWon ? " win-banner" : " loss-banner";
        bannerIco = myWon ? "🎉" : "😞";
        bannerTail = myWon ? " — VICTOIRE !" : " — défaite…";
      }
      $("#m-banner").innerHTML = `<div class="m-winner-banner${bannerCls}">${bannerIco} <strong>${flagHTML(wName.flag)} ${wName.name}</strong> remporte le match ${scoreStr}${bannerTail}</div>`;
      comment(`🏆 Victoire de <strong>${wName.name}</strong>`, "set-line");
      $("#m-stats").innerHTML = matchStatsHTML(rec, m, flip); // v21 : récap statistique
      showMatchBetResults(); // 🎰 le verdict de tes paris sur ce match
      updateBankChip();      // le solde bouge en direct
      hideServers();
      if (isFinalMatch) launchConfetti();
      const playBtn = $("#m-play");
      playBtn.disabled = false;
      playBtn.textContent = "✓ Fermer";
      playBtn.onclick = closeModal;
      // Enchaînement : match suivant / transition de tour / récap
      const nextWrap = $("#m-next");
      nextWrap.innerHTML = "";
      if (rec.status === "done") {
        nextWrap.appendChild(mkBtn("🏆 Voir le récap du tournoi", "btn btn-gold", () => {
          stopTimer(); overlay.classList.add("hidden"); navigate("recap", { id: rec.id });
        }));
      } else {
        // Le tour vient-il de se terminer ? -> écran de transition
        const roundDone = rec.type === "bracket"
          ? rec.currentRound !== ctx.roundIdx
          : (ctx.kind === "rr" ? rec.phase !== "rr" : ctx.kind === "sf" ? rec.phase !== "sf" : false);
        if (roundDone) {
          nextWrap.appendChild(mkBtn("🏁 Fin du tour — continuer", "btn btn-gold", () => {
            stopTimer(); showRoundTransition(rec, ctx);
          }));
          return redraw();
        }
        const nm = findNextBetMatch(rec, playAllMode);
        if (nm) {
          const label = playAllMode || rec.type === "finals" ? "🎾 Match suivant" : "⭐ Prochain match de mon club";
          nextWrap.appendChild(mkBtn(label, "btn", () => {
            stopTimer(); openMatchModal(rec, nm);
          }));
        } else {
          // Plus de match de mes favoris dans ce tour : on termine le tour (simulation)
          // puis l'écran de transition présente le tour suivant
          nextWrap.appendChild(mkBtn("🏁 Fin du tour — continuer", "btn btn-gold", () => {
            stopTimer();
            if (rec.type === "bracket") simulateCurrentRound(rec, true);
            else simulateFinalsPhase(rec, true);
            if (rec.status === "done") { overlay.classList.add("hidden"); navigate("recap", { id: rec.id }); return; }
            showRoundTransition(rec, ctx);
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
    const res = playFn(); // le moteur joue le match maintenant (mode classique)
    if (!res) { closeModal(); return; }
    replay.events = res.timeline.map(flipEvent); // mon favori reste en haut à l'écran
    this.textContent = "⏸ En cours…";
    this.disabled = true;
    showMatchBetsCompact(); // les marchés ferment : tes tickets restent visibles
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
  $("#link-A").addEventListener("click", () => openPlayerCard(idTop));
  $("#link-B").addEventListener("click", () => openPlayerCard(idBot));

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

  /* Bloc paris : tous tes paris sur ce tournoi (matchs, tours, tournoi) */
  const right = document.createElement("div");
  right.className = "card recap-block";
  right.innerHTML = `<h3>🎰 Tes paris sur ce tournoi</h3>`;
  const allBets = (state.tbets || []).filter(b => b.tourneyId === rec.id);
  if (!allBets.length) {
    right.insertAdjacentHTML("beforeend", `<div class="bet-empty" style="color:var(--text-dim)">
      Aucun pari placé sur ce tournoi — le guichet rouvre au prochain. 🎰</div>`);
  } else {
    allBets.forEach(b => right.insertAdjacentHTML("beforeend", tbetLineHTML(b, true)));
    const net = allBets.reduce((s, b) => s + (b.payout || 0) - b.stake, 0);
    right.insertAdjacentHTML("beforeend", `<p style="font-size:13px;margin-top:6px">
      Bilan du tournoi : <strong style="color:${net >= 0 ? "var(--green)" : "var(--red)"}">${net >= 0 ? "+" : "−"}${fmtEuro(Math.abs(Math.round(net)))}</strong>
      · 💶 Solde : <strong>${fmtEuro(Math.round(state.cash || 0))}</strong></p>`);
  }

  /* 💶 Ton relevé du tournoi : prize net crédité, frais débités */
  const cpR = customPlayer();
  const fin = rec.recap.finance;
  if (fin && fin.absent) {
    right.insertAdjacentHTML("beforeend", `
      <h3 style="margin-top:14px">💶 Ton relevé du tournoi</h3>
      <div class="bet-empty" style="color:var(--text-dim)">💤 ${cpR ? cpR.name : "Ton champion"} n'était pas engagé —
        aucun prize money, et <strong>aucune quote-part de frais débitée</strong>.</div>`);
  } else if (fin) {
    right.insertAdjacentHTML("beforeend", `
      <h3 style="margin-top:14px">💶 Ton relevé du tournoi</h3>
      <div class="fiscal-rows">
        <div class="f-row"><span>🎾 Prize money${cpR ? " de " + cpR.name : ""} (brut)</span><span>${fmtEuro(fin.prize)}</span></div>
        <div class="f-row f-tax"><span>Taxes (${Math.round(PRIZE_TAX_RATE * 100)} %)</span><span>−${fmtEuro(fin.prizeTax)}</span></div>
        <div class="f-row f-tax"><span>Le staff (${Math.round(STAFF_RATE * 100)} % du restant)</span><span>−${fmtEuro(fin.staff)}</span></div>
        <div class="f-row f-gain"><span>= Crédité sur ta banque</span><span>+${fmtEuro(fin.prizeNet)}</span></div>
        <div class="f-row f-tax"><span>✈️ Ta part des frais de saison</span><span>−${fmtEuro(fin.travel)}</span></div>
        <div class="f-row f-net"><span>Mouvement du tournoi</span><span class="${fin.delta < 0 ? "neg" : ""}">${fin.delta >= 0 ? "+" : "−"}${fmtEuro(Math.abs(fin.delta))}</span></div>
      </div>`);
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
  if (customPlayer() && state.xp)
    actions.appendChild(mkBtn(`🎖 Ma carrière — classé ${championClassement().label}`, "btn btn-xp", () => navigate("career")));
  actions.appendChild(mkBtn("📈 Classements", "btn btn-ghost", () => navigate("rankings")));
  if (state.currentIndex < CALENDAR.length) {
    const next = CALENDAR[state.currentIndex];
    actions.appendChild(mkBtn(`▶ Tournoi suivant : ${next.name}`, "btn btn-gold", () => {
      if (!state.tournaments[next.id]) startTournament(state.currentIndex);
      navigate("tournament", { id: next.id });
    }));
  } else {
    actions.appendChild(mkBtn("🏦 La banque — bilan de la saison", "btn btn-gold", () => navigate("favorites")));
    actions.appendChild(mkBtn("🏆 Classements finaux", "btn btn-ghost", () => navigate("rankings")));
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
  boardsGrid.appendChild(leaderboard("% de 1res balles", "🚀",
    st => st.fsIn, st => st.fsTot, r => fmtPts(r.num) + " / " + fmtPts(r.den)));
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

  /* Marathons & expéditions : les 3 matchs les plus longs / les plus courts,
     classés EN JEUX et EN DURÉE (v26) */
  function hm(mins) {
    const h = Math.floor(mins / 60), mn = mins % 60;
    return h + "h" + (mn < 10 ? "0" + mn : mn);
  }
  function extremesBoard(title, emoji, list, byMins) {
    const card = document.createElement("div");
    card.className = "card stat-board";
    card.innerHTML = `<h3>${emoji} ${title} <span class="surf-note">${byMins ? "par durée ⏱" : "par jeux 🔢"}</span></h3>`;
    const usable = byMins ? list.filter(x => (x.mins || 0) > 0) : list;
    if (usable.length === 0) {
      card.insertAdjacentHTML("beforeend", `<div class="bet-empty" style="color:var(--text-dim)">Pas encore de match joué.</div>`);
      return card;
    }
    const sorted = usable.slice().sort((a, b) => byMins ? (b.mins - a.mins) : (b.games - a.games));
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
        const rec2 = state.tournaments[r.tid];
        const mctx = rec2 ? findMatchCtx(rec2, r.m) : null;
        const line = document.createElement("div");
        line.className = "extreme-line row-clickable";
        line.title = mctx ? "Voir la fiche du match" : "Voir la carte de " + w.name;
        line.innerHTML = `
          <span class="ex-games">${byMins ? hm(r.mins) + "<small>durée</small>" : r.games + "<small>jeux</small>"}</span>
          <span class="ex-body">
            <span class="ex-players">${flagHTML(w.flag)} <strong>${w.name}</strong> bat ${flagHTML(l.flag)} ${l.name}</span>
            <span class="ex-detail">${formatScore(r.m, true)} · ${byMins ? r.games + " jeux" : (r.mins ? hm(r.mins) : "—")} · ${flagHTML(t.country)} ${t.city}${(state.career && state.career.seasons.length && r.year) ? " " + r.year : ""}</span>
          </span>`;
        line.addEventListener("click", () => {
          if (mctx) openMatchSummary(rec2, mctx);   // v28 : le détail du match
          else openPlayerCard(r.m.winner);          // record archivé (saison passée) : la carte du vainqueur
        });
        card.appendChild(line);
      });
    });
    return card;
  }
  el.insertAdjacentHTML("beforeend", `<div class="page-title" style="font-size:24px;margin-top:18px">Marathons &amp; expéditions</div>`);
  const exGrid = document.createElement("div");
  exGrid.className = "stats-grid";
  exGrid.appendChild(extremesBoard("Grands Chelems", "🏆", ms.matchListBo5, false));
  exGrid.appendChild(extremesBoard("Masters 1000 & Masters", "⚡", ms.matchListBo3, false));
  exGrid.appendChild(extremesBoard("Grands Chelems", "🏆", ms.matchListBo5, true));
  exGrid.appendChild(extremesBoard("Masters 1000 & Masters", "⚡", ms.matchListBo3, true));
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
  // v21/v26 : issues de la simulation point par point — avec la MOYENNE PAR MATCH
  const avgTxt = (v, n) => n > 0 ? (Math.round(10 * v / n) / 10).toString().replace(".", ",") + "/match" : "—";
  const perMatch = x => x.st.wins + x.st.losses;
  const volumeRows = (getVal, getExtra) => all
    .map(x => {
      const n = perMatch(x);
      return { pid: x.p.id, value: getVal(x.st), n, detail: avgTxt(getVal(x.st), n) + (getExtra ? " · " + getExtra(x.st) : "") };
    })
    .filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);
  recGrid.appendChild(recordBoard("Canonniers (aces)", "🎯",
    volumeRows(st => st.aces, st => st.df + " DF"), v => fmtPts(v)));
  recGrid.appendChild(recordBoard("Frappeurs (points gagnants)", "💥",
    volumeRows(st => st.winners), v => fmtPts(v)));
  recGrid.appendChild(recordBoard("Bâcheurs (fautes directes)", "🪣",
    volumeRows(st => st.ue), v => fmtPts(v)));
  // v26 : les rois du sauvetage — matchs et sets renversés après une balle de match / de set
  const mpRows = all
    .map(x => ({ pid: x.p.id, value: x.st.mpComeback || 0,
      detail: x.st.mpSaved + " balle" + (x.st.mpSaved > 1 ? "s" : "") + " de match sauvée" + (x.st.mpSaved > 1 ? "s" : "") }))
    .filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);
  recGrid.appendChild(recordBoard("Sauvés du gouffre (matchs gagnés après une balle de match)", "🧯",
    mpRows, v => v + " match" + (v > 1 ? "s" : "")));
  const spRows = all
    .map(x => ({ pid: x.p.id, value: x.st.spComeback || 0,
      detail: x.st.spSaved + " balle" + (x.st.spSaved > 1 ? "s" : "") + " de set sauvée" + (x.st.spSaved > 1 ? "s" : "") }))
    .filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);
  recGrid.appendChild(recordBoard("Rois du sauvetage (sets gagnés après une balle de set)", "🛟",
    spRows, v => v + " set" + (v > 1 ? "s" : "")));
  el.appendChild(recGrid);

  el.insertAdjacentHTML("beforeend", `<div class="page-sub" style="margin-top:6px;font-size:12px">
    ${fmtPts(ms.totalMatches)} matchs et ${fmtPts(ms.totalSets)} sets joués${multiSeason ? " depuis " + START_YEAR : " cette saison"}.</div>`);
}

/* ============================================================
   JOUEURS — annuaire + cartes de personnage (style EA)
   ============================================================ */
function renderPlayers(el) {
  const club = (state.favorites || []).length > 0;
  el.insertAdjacentHTML("beforeend", `
    <div class="page-title">Les 128 joueurs</div>
    <div class="page-sub">Clique sur un joueur pour ouvrir sa carte : classement, prize money, palmarès et compétences.</div>
    ${club ? `<div class="club-sec">🎾 Mon club — ${clubName()}</div>
    <div class="players-grid club-grid" id="club-grid"></div>` : ""}
    <div class="club-sec">🌍 Tout le circuit</div>
    <input class="players-search" id="players-search" placeholder="🔍 Rechercher un joueur ou une catégorie…">
    <div class="players-grid" id="players-grid"></div>`);

  function miniTile(p) {
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
    return mini;
  }

  // 🎾 Mon club : le capitaine d'abord, puis les recrues par classement
  if (club) {
    const cg = $("#club-grid");
    const cp = customPlayer();
    const ids = state.favorites.slice().sort((a, b) => {
      if (cp && a === cp.id) return -1;
      if (cp && b === cp.id) return 1;
      return currentRank(a, "points") - currentRank(b, "points");
    });
    ids.forEach(pid => cg.appendChild(miniTile(getPlayer(pid))));
  }

  const grid = $("#players-grid");
  function draw(filter = "") {
    grid.innerHTML = "";
    const f = filter.toLowerCase();
    sortedByPoints()
      .filter(p => p.name.toLowerCase().includes(f) || p.cat.toLowerCase().includes(f))
      .forEach(p => grid.appendChild(miniTile(p)));
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
  const formLast = lastMatchesOf(pid, 10); // v28 : la forme du moment
  const rkP = currentRank(pid, "points");
  const rkM = currentRank(pid, "money");
  const best = bestSurface(p);
  const titles = (state.titles[pid] || []);

  const overlay = $("#card-overlay");
  const modal = $("#card-modal");
  overlay.classList.remove("hidden");
  // v29 : ouvrir une carte repasse au-dessus d'une éventuelle fiche de match empilée
  $("#modal-overlay").classList.remove("over-card");

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
          <div class="pcard-cat">${p.cat}${p.club ? ` · ${p.club}` : ""}${!p.custom && state.favorites.includes(pid) ? ` · 🎾 ${clubName()}` : ""}${p.classement ? ` · <span class="classement-badge">Classé ${p.classement}</span>` : ""}${p.fr && !p.custom ? " · " + flagHTML("🇫🇷") : ""}</div>
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
        <div class="pcard-coltitle" style="margin-top:10px">Au microscope 🔬</div>
        <div class="pcard-stats pcard-stats-tiles2">
          <div class="pcs"><div class="v">${fmtPts(stats.aces)}</div><div class="pct">${stats.df} DF</div><div class="l">Aces · doubles fautes</div></div>
          <div class="pcs"><div class="v">${pct(stats.fsIn, stats.fsTot)}</div><div class="pct">${fmtPts(stats.fsIn)} / ${fmtPts(stats.fsTot)}</div><div class="l">1res balles</div></div>
          <div class="pcs"><div class="v">${fmtPts(stats.winners)} / ${fmtPts(stats.ue)}</div><div class="pct">${stats.winners + stats.ue > 0 ? pct(stats.winners, stats.winners + stats.ue) : "—"}</div><div class="l">Gagnants / fautes directes</div></div>
          <div class="pcs"><div class="v">${stats.bestStreakPts} pts</div><div class="pct">${stats.bestStreakGames} jeux</div><div class="l">Séries max</div></div>
          <div class="pcs"><div class="v">${stats.spSaved} / ${stats.mpSaved}</div><div class="pct">set / match</div><div class="l">Balles sauvées</div></div>
          <div class="pcs"><div class="v">${Math.floor(stats.minutes / 60)}h${(stats.minutes % 60) < 10 ? "0" + stats.minutes % 60 : stats.minutes % 60}</div><div class="pct">${stats.wins + stats.losses > 0 ? Math.round(stats.minutes / (stats.wins + stats.losses)) + " min/match" : "—"}</div><div class="l">Temps de jeu</div></div>
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
      <div class="pcard-form">
        <div class="pcard-coltitle">Forme du moment <span class="pf-note">les 10 derniers matchs</span></div>
        ${formLast.length ? `
          <div class="pf-chips">${formLast.map(e => `<span class="pf-chip ${e.m.winner === pid ? "w" : "l"}">${e.m.winner === pid ? "V" : "D"}</span>`).join("")}<span class="pf-arrow">→ le plus récent</span></div>
          <div class="pf-list">${formLast.slice().reverse().map((e, i) => {
            const tt = CALENDAR.find(c => c.id === e.tid);
            const won = e.m.winner === pid;
            const opp = getPlayer(e.m.p1 === pid ? e.m.p2 : e.m.p1);
            return `<div class="pf-line" data-fm="${i}" title="Voir la fiche du match">
              <span class="pf-res ${won ? "w" : "l"}">${won ? "V" : "D"}</span>
              <span class="pf-body">${won ? "bat" : "battu par"} ${flagHTML(opp.flag)} <strong>${opp.name}</strong>
                <span class="pf-detail">${formatScore(e.m, true)} · ${flagHTML(tt.country)} ${tt.city}${e.m.when ? ` · 📅 ${matchWhenLabel(e.rec, e.m)}` : ""}</span></span>
            </div>`;
          }).join("")}</div>`
        : `<span style="color:#9aa7ba;font-size:12px">Aucun match joué cette saison</span>`}
      </div>
    </div>`;

  const close = () => { overlay.classList.add("hidden"); };
  $("#pc-close").addEventListener("click", close);
  overlay.onclick = e => { if (e.target === overlay) close(); };
  // v29 : cliquer un match de la forme ouvre sa fiche récap PAR-DESSUS la carte —
  // la fermer ramène sur la carte du joueur
  const revLast = formLast.slice().reverse();
  modal.querySelectorAll(".pf-line").forEach(el2 => el2.addEventListener("click", () => {
    const e = revLast[parseInt(el2.dataset.fm, 10)];
    const mctx = findMatchCtx(e.rec, e.m);
    if (!mctx) return;
    openMatchSummary(e.rec, mctx);
  }));
}

/* Pourcentage façon "12.5%" (1 décimale si nécessaire, "—" si aucune donnée) */
function pct(num, den) {
  if (!den || den <= 0) return "—";
  const v = 100 * num / den;
  const s = Math.round(v * 10) / 10;
  return (Number.isInteger(s) ? s : s.toFixed(1)) + "%";
}

/* ============================================================
   🏦 LA BANQUE — trois sections : la carrière, les paris, le dopage
   (début de la gestion du mode carrière évolué)
   ============================================================ */
function renderFavorites(el) {
  const seasonOver = state.currentIndex >= CALENDAR.length;
  const cp = customPlayer();
  const st = seasonSettlement();
  const cash = Math.round(state.cash || 0);
  const bs = state.betStats || { staked: 0, returned: 0 };
  const delta = cash - (state.bankroll || 0);
  const year = state.year || START_YEAR;
  const all = state.tbets || [];
  const open = all.filter(b => b.status === "open");
  const settled = all.filter(b => b.status !== "open");
  const wonN = settled.filter(b => b.status === "won").length;
  const net = Math.round(bs.returned - bs.staked);
  const syr = state.syringes || 0;
  const used = SEASON_SYRINGES - syr;

  el.insertAdjacentHTML("beforeend", `
    <div class="page-title">🏦 La banque</div>
    <div class="page-sub">Ta banque vit toute l'année : chaque mise sort, chaque gain rentre,
      et à CHAQUE fin de tournoi le prize money de ton champion est crédité net
      (−${Math.round(PRIZE_TAX_RATE * 100)} % de taxes puis −${Math.round(STAFF_RATE * 100)} % pour le staff) pendant que ta part des frais de saison
      (${fmtEuro(TRAVEL_COST)} répartis sur les ${CALENDAR.length} tournois — rien si ton champion ne joue pas) est débitée.
      Seul l'impôt de ${Math.round(TAX_RATE * 100)} % sur des paris gagnants attend la fin de saison.</div>`);

  /* ===================== 1. LA CARRIÈRE ===================== */
  el.insertAdjacentHTML("beforeend", `<div class="bank-sec">💼 La carrière</div>`);
  const hero = document.createElement("div");
  hero.className = "wallet";
  hero.innerHTML = `
    <div class="wallet-head">
      <div class="wallet-total">
        <div class="wt-label">💶 Solde bancaire — saison ${year}</div>
        <div class="wt-value${cash < 0 ? " neg" : ""}">${fmtEuro(cash)}</div>
        <div class="wt-delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "▲ +" : "▼ −"}${fmtEuro(Math.abs(delta))}
          <span class="wt-deltasub">depuis le début de saison</span></div>
      </div>
      <div class="wallet-start">
        <span class="ws-l">Capital de départ</span>
        <span class="ws-v">${fmtEuro(state.bankroll)}</span>
        <span class="ws-l">${cp ? "🎾 " + cp.name + " · " : ""}💉 ${syr} dose${syr > 1 ? "s" : ""} · 🎫 ${open.length} pari${open.length > 1 ? "s" : ""} en cours</span>
      </div>
    </div>`;
  el.appendChild(hero);

  const nDone = Math.min(state.currentIndex, CALENDAR.length);
  const fiscal = document.createElement("div");
  fiscal.className = "card fiscal-card";
  fiscal.innerHTML = `
    <h3>${seasonOver ? "🧾 Bilan de la saison " + year : "🔭 Le point après " + nDone + " tournoi" + (nDone > 1 ? "s" : "") + " / " + CALENDAR.length}</h3>
    <div class="fiscal-rows">
      <div class="f-row"><span>🎾 Prize money de ${cp ? cp.name : "ton champion"} (bruts, déjà gagnés)</span><span>${fmtEuro(st.prize)}</span></div>
      <div class="f-row f-tax"><span>Taxes déjà prélevées (${Math.round(PRIZE_TAX_RATE * 100)} %)</span><span>−${fmtEuro(st.prizeTax)}</span></div>
      <div class="f-row f-tax"><span>Staff déjà payé (${Math.round(STAFF_RATE * 100)} % du restant)</span><span>−${fmtEuro(st.staff)}</span></div>
      <div class="f-row f-gain"><span>= Prize money nets, déjà crédités</span><span>+${fmtEuro(st.prizeNet)}</span></div>
      <div class="f-row f-tax"><span>✈️ Frais déjà débités (tournois joués par ton champion)</span><span>−${fmtEuro(st.travelPaid)}</span></div>
      ${st.travelLeft > 0 ? `<div class="f-row f-tax"><span>✈️ Frais à venir (s'il joue les tournois restants)</span><span>−${fmtEuro(st.travelLeft)}</span></div>` : ""}
      <div class="f-row f-tax"><span>🎰 Impôt sur les paris (${Math.round(TAX_RATE * 100)} % du gain net, fin de saison)</span>
        <span>${st.betTax > 0 ? "−" + fmtEuro(st.betTax) : "aucun — pas de gain, pas d'impôt 😮‍💨"}</span></div>
      <div class="f-row"><span>💶 Solde bancaire${seasonOver ? "" : " actuel"}</span><span>${fmtEuro(st.cash)}</span></div>
      <div class="f-row f-net"><span>${seasonOver
        ? ((state.season || 1) < MAX_SEASONS ? "💼 Report sur la saison " + (year + 1) : "💼 Capital final de ta carrière")
        : "💼 Report projeté si la saison s'arrêtait là"}</span>
        <span class="${st.final < 0 ? "neg" : ""}">${fmtEuro(st.final)}</span></div>
    </div>
    <p class="f-note">${seasonOver
      ? (st.final >= st.start ? "🍾 Saison rentable — la carrière décolle." : "😅 Saison dans le rouge" + (st.final < 0 ? " — la dette te suit sur la saison suivante !" : " — il en restera quand même un peu."))
      : "La banque bouge à chaque tournoi : prize money net crédité, part des frais débitée — tout est déjà réglé au fil de l'eau."}</p>`;
  if (seasonOver && (state.season || 1) < MAX_SEASONS)
    fiscal.appendChild(mkBtn(`▶ Saison ${year + 1} avec ${fmtEuro(st.final)}`, "btn btn-gold", goNextSeason));
  // 🧾 Le relevé bancaire, tournoi par tournoi
  const ledger = CALENDAR.map(t => ({ t, rec: state.tournaments[t.id] }))
    .filter(x => x.rec && x.rec.recap && x.rec.recap.finance);
  if (ledger.length) {
    fiscal.insertAdjacentHTML("beforeend", `<h3 style="margin-top:14px">🧾 Le relevé, tournoi par tournoi</h3>` +
      ledger.map(({ t, rec }) => {
        const f = rec.recap.finance;
        if (f.absent) return `<div class="tbet-line tbet-open">
          <span class="tbet-status">💤</span>
          <span class="tbet-body"><span class="tbet-label">${flagHTML(t.country)} ${t.city}</span>
            <span class="tbet-meta">ton champion n'était pas engagé — aucun frais</span></span>
          <span class="tbet-payout">±0</span></div>`;
        return `<div class="tbet-line ${f.delta >= 0 ? "tbet-won" : "tbet-lost"}">
          <span class="tbet-status">${f.delta >= 0 ? "📈" : "📉"}</span>
          <span class="tbet-body"><span class="tbet-label">${flagHTML(t.country)} ${t.city}</span>
            <span class="tbet-meta">prize net +${fmtEuro(f.prizeNet)}${f.prize ? " (brut " + fmtEuro(f.prize) + ")" : ""} · frais −${fmtEuro(f.travel)}</span></span>
          <span class="tbet-payout">${f.delta >= 0 ? "+" : "−"}${fmtEuro(Math.abs(f.delta))}</span></div>`;
      }).join(""));
  }
  el.appendChild(fiscal);

  /* ===================== 2. LES PARIS ===================== */
  el.insertAdjacentHTML("beforeend", `<div class="bank-sec">🎰 Les paris</div>`);
  const bets = document.createElement("div");
  bets.className = "card bank-card";
  bets.innerHTML = `
    <div class="bk-tiles">
      <div class="bk-tile"><div class="l">🎫 Misé cette saison</div><div class="v">${fmtEuro(Math.round(bs.staked))}</div>
        <div class="s">${all.length} pari${all.length > 1 ? "s" : ""} placé${all.length > 1 ? "s" : ""}</div></div>
      <div class="bk-tile"><div class="l">💰 Encaissé</div><div class="v">${fmtEuro(Math.round(bs.returned))}</div>
        <div class="s">${wonN} gagné${wonN > 1 ? "s" : ""} / ${settled.length} réglé${settled.length > 1 ? "s" : ""} (${pct(wonN, settled.length)})</div></div>
      <div class="bk-tile ${net >= 0 ? "bk-up" : "bk-down"}"><div class="l">⚖️ Bilan des paris</div>
        <div class="v">${net >= 0 ? "+" : "−"}${fmtEuro(Math.abs(net))}</div>
        <div class="s">${net > 0 ? "impôt de " + Math.round(TAX_RATE * 100) + " % en fin de saison : " + fmtEuro(st.betTax) : "un bilan positif est imposé à " + Math.round(TAX_RATE * 100) + " % en fin de saison"}</div></div>
    </div>`;
  if (open.length)
    bets.insertAdjacentHTML("beforeend", `<h3 style="margin-top:12px">⏳ En cours (${open.length})</h3>` +
      open.map(b => tbetLineHTML(b)).join(""));
  if (settled.length)
    bets.insertAdjacentHTML("beforeend", `<h3 style="margin-top:12px">🧾 Historique (les ${Math.min(settled.length, 40)} derniers)</h3>` +
      settled.slice(-40).reverse().map(b => tbetLineHTML(b)).join(""));
  if (!all.length)
    bets.insertAdjacentHTML("beforeend", `<div class="bet-empty" style="color:var(--text-dim)">
      Aucun pari placé — avant chaque tournoi, chaque tour et chaque match, le guichet t'attend. 🎰</div>`);
  el.appendChild(bets);

  /* ===================== 3. LE DOPAGE ===================== */
  el.insertAdjacentHTML("beforeend", `<div class="bank-sec">💉 Le dopage</div>`);
  const dop = document.createElement("div");
  dop.className = "card bank-card";
  dop.innerHTML = `
    <div class="bk-tiles">
      <div class="bk-tile"><div class="l">💉 Doses restantes</div><div class="v">${syr} / ${SEASON_SYRINGES}</div>
        <div class="s">${fmtEuro(DOPE_COST)} la dose, payée en direct</div></div>
      <div class="bk-tile"><div class="l">💸 Dépensé en dopage</div><div class="v">${fmtEuro(used * DOPE_COST)}</div>
        <div class="s">${used} dose${used > 1 ? "s" : ""} utilisée${used > 1 ? "s" : ""} cette saison</div></div>
      <div class="bk-tile"><div class="l">🚨 Risque</div><div class="v">${Math.round(DOPING_CONTROL_P * 100)} %</div>
        <div class="s">de contrôle positif à l'issue du tournoi → ${SUSPENSION_MONTHS} mois de suspension</div></div>
    </div>`;
  const injections = CALENDAR.map(t => ({ t, rec: state.tournaments[t.id] }))
    .filter(x => x.rec && x.rec.doped !== undefined && x.rec.doped !== null);
  if (injections.length) {
    dop.insertAdjacentHTML("beforeend", `<h3 style="margin-top:12px">🧪 Historique des injections</h3>` +
      injections.map(({ t, rec }) => {
        const p = getPlayer(rec.doped);
        const done = rec.status === "done";
        const res = !done ? `<span class="tbet-meta">tournoi en cours…</span>`
          : rec.dopingControl
            ? `<span class="tbet-result" style="color:var(--red)">🚨 contrôle POSITIF → suspendu ${SUSPENSION_MONTHS} mois</span>`
            : `<span class="tbet-result" style="color:var(--green)">contrôle négatif — ni vu ni connu 😮‍💨</span>`;
        return `<div class="tbet-line ${done && rec.dopingControl ? "tbet-lost" : "tbet-won"}">
          <span class="tbet-status">💉</span>
          <span class="tbet-body"><span class="tbet-label">${flagHTML(t.country)} ${t.city} — ${flagHTML(p.flag)} ${p.name} boosté</span>${res}</span>
          <span class="tbet-payout">−${fmtEuro(DOPE_COST)}</span></div>`;
      }).join(""));
  } else {
    dop.insertAdjacentHTML("beforeend", `<div class="bet-empty" style="color:var(--text-dim)">
      Aucune injection cette saison — pour l'instant, tout le monde est clean. 😇</div>`);
  }
  const suspNow = Object.entries(state.suspended || {}).filter(([pid, u]) =>
    state.currentIndex < CALENDAR.length && CALENDAR[state.currentIndex].month < u);
  if (suspNow.length) {
    dop.insertAdjacentHTML("beforeend", `<h3 style="margin-top:12px">⛔ Suspendus en ce moment</h3>` +
      suspNow.map(([pid]) => {
        const p = getPlayer(parseInt(pid, 10));
        return `<div class="tbet-line tbet-lost"><span class="tbet-status">⛔</span>
          <span class="tbet-body"><span class="tbet-label">${flagHTML(p.flag)} ${p.name}</span>
          <span class="tbet-meta">suspendu pour dopage</span></span><span class="tbet-payout"></span></div>`;
      }).join(""));
  }
  el.appendChild(dop);
}

/* ============================================================
   🎖 MA CARRIÈRE (v27) — la page de l'expérience & du classement
   Accessible via la pastille 🎖 à droite de la banque.
   Hero (classement + progression), échelle des 22 classements,
   sources d'XP, les goals de carrière et le journal complet.
   ============================================================ */
function xpTournamentCity(tid) {
  const rec = tid && state.tournaments && state.tournaments[tid];
  return rec ? CALENDAR[rec.index].city : "";
}

/* v30 : victoires de carrière — l'XP les compte pour ton champion */
function xpWinsOf(pid) {
  const cp = customPlayer();
  if (cp && pid === cp.id && state.xp) return state.xp.wins || 0;
  const s = playerStats(pid);
  return s.wins;
}

/* 🃏 v30 — LA CARTE façon EA Sports FC : note, drapeau, classement, club et
   les 6 attributs de jeu. Cliquable → la fiche complète du joueur.
   Le fond s'illumine avec le niveau atteint (bronze → argent → or → « icône »). */
function eaCardHTML(p, cc) {
  const note = p.overall ? Math.round(p.overall) : Math.round(p.sk[bestSurface(p).key] * 10);
  const tier = cc.idx >= 18 ? "icon" : cc.idx >= 12 ? "gold" : cc.idx >= 6 ? "silver" : "bronze";
  const jeu = SKILLS.slice(4); // force, endurance, adresse, tactique, service, mental
  const titles = (state.titles[p.id] || []).length;
  return `
    <button class="ea-card ea-${tier}" title="Voir la fiche de ${p.name}">
      <span class="ea-shine"></span>
      <span class="ea-top">
        <span class="ea-note">
          <span class="ea-note-v">${note}</span>
          <span class="ea-note-p">${cc.label}</span>
        </span>
        <span class="ea-portrait">${flagHTML(p.flag)}</span>
      </span>
      <span class="ea-name">${p.name}</span>
      <span class="ea-meta">
        <span>${clubName()}</span>
        <span>🏆 ${titles} titre${titles > 1 ? "s" : ""} · ${xpWinsOf(p.id)} v.</span>
      </span>
      <span class="ea-stats">
        ${jeu.map(s => `<span class="ea-stat"><b>${Math.round(p.sk[s.key] * 10)}</b><i>${s.short}</i></span>`).join("")}
      </span>
      <span class="ea-cta">🪪 Voir ma fiche</span>
    </button>`;
}

function renderCareerXP(el) {
  const cp = customPlayer();
  if (!cp || !state.xp) { navigate("season"); return; }
  const xp = state.xp;
  const cc = championClassement();
  const doneGoals = Object.keys(xp.goals || {}).length;

  /* ----- HERO : le classement actuel, énorme, + la barre vers le suivant ----- */
  const span = cc.nextAt !== null ? cc.nextAt - cc.cur : 1;
  const into = cc.nextAt !== null ? Math.max(0, xp.total - cc.cur) : 1;
  const pct = cc.nextAt !== null ? Math.max(2, Math.min(100, Math.round(into / span * 100))) : 100;
  const hero = document.createElement("div");
  hero.className = "xp-hero";
  hero.innerHTML = `
    <div class="xp-hero-main">
      <div class="xp-hat">${flagHTML(cp.flag)} ${cp.name} · ${clubName()}</div>
      <div class="xp-big-label">classé</div>
      <div class="xp-big">${cc.label}</div>
      <div class="xp-sub">${cc.next
        ? `Prochain palier : <strong>${cc.next}</strong> — encore <strong>${cc.nextAt - xp.total} XP</strong> à conquérir`
        : "🏔️ −15 — tu as atteint le sommet absolu du tennis français !"}</div>
      <div class="xp-bar"><span style="width:${pct}%"></span></div>
      ${cc.next ? `<div class="xp-bar-lbl">${into} / ${span} XP vers ${cc.next}</div>` : ""}
      <div class="xp-kpis">
        <div class="xp-kpi"><b>${xp.total}</b><span>XP total</span></div>
        <div class="xp-kpi"><b>${xp.wins || 0}</b><span>victoire${(xp.wins || 0) > 1 ? "s" : ""}</span></div>
        <div class="xp-kpi"><b>${xp.winStreak || 0}</b><span>série en cours</span></div>
        <div class="xp-kpi"><b>${doneGoals}/${XP_GOALS.length}</b><span>goals</span></div>
      </div>
    </div>
    <div class="xp-hero-card">${eaCardHTML(cp, cc)}</div>`;
  el.appendChild(hero);
  // v30 : la carte façon EA Sports ouvre la fiche complète du champion
  const eaBtn = hero.querySelector(".ea-card");
  if (eaBtn) eaBtn.addEventListener("click", () => openPlayerCard(cp.id));

  /* ----- L'échelle des 22 classements ----- */
  const lad = document.createElement("div");
  lad.className = "card xp-card";
  lad.innerHTML = `<h3>🪜 L'échelle — du classement 40 au mythique −15</h3>`;
  const lrow = document.createElement("div");
  lrow.className = "xp-ladder";
  CLASSEMENTS_LADDER.forEach((c, i) => {
    const d = document.createElement("div");
    d.className = "xp-rung" + (i < cc.idx ? " done" : i === cc.idx ? " cur" : "");
    d.innerHTML = `<b>${c}</b><span>${i === 0 ? "départ" : XP_STEPS[i] + " XP"}</span>`;
    lrow.appendChild(d);
  });
  lad.appendChild(lrow);
  el.appendChild(lad);

  /* ----- D'où vient ton expérience ----- */
  const sums = { goal: 0, win: 0, perf: 0, contre: 0, res: 0, club: 0 };
  (xp.log || []).forEach(e => { if (sums[e.t] !== undefined) sums[e.t] += e.xp; });
  const src = document.createElement("div");
  src.className = "card xp-card";
  src.innerHTML = `<h3>⚡ D'où vient ton expérience</h3>`;
  const srow = document.createElement("div");
  srow.className = "xp-srcs";
  [["🏅", "Goals accomplis", sums.goal],
   ["🎾", "Victoires (+" + XP_WIN + " chacune)", sums.win],
   ["🔥", "Perfs — battre mieux classé que toi", sums.perf],
   ["❄️", "Contres — perdre contre moins bien classé", sums.contre],
   ["🏁", "Résultats en tournoi", sums.res],
   ["🤝", "Ton club à l'entraînement", sums.club],
  ].forEach(([ico, lbl, v]) => {
    const d = document.createElement("div");
    d.className = "xp-src" + (v > 0 ? " pos" : v < 0 ? " neg" : "");
    d.innerHTML = `<span class="xs-ico">${ico}</span><span class="xs-lbl">${lbl}</span>
      <b class="xs-val">${v > 0 ? "+" + v : v} XP</b>`;
    srow.appendChild(d);
  });
  src.appendChild(srow);
  el.appendChild(src);

  /* ----- Les goals de carrière ----- */
  const gc = document.createElement("div");
  gc.className = "card xp-card";
  gc.innerHTML = `<h3>🏅 Les ${XP_GOALS.length} goals de carrière — ${doneGoals} accompli${doneGoals > 1 ? "s" : ""}</h3>`;
  const ggrid = document.createElement("div");
  ggrid.className = "xp-goals";
  const sorted = XP_GOALS.slice().sort((a, b) => {
    const da = xp.goals[a.code] ? 0 : 1, db = xp.goals[b.code] ? 0 : 1;
    return da - db || a.xp - b.xp;
  });
  sorted.forEach(g => {
    const got = xp.goals[g.code];
    const city = got ? xpTournamentCity(got.tid) : "";
    const d = document.createElement("div");
    d.className = "xp-goal" + (got ? " got" : "");
    d.innerHTML = `<span class="xg-ico">${g.icon}</span>
      <div class="xg-txt"><div class="xg-lbl">${g.label}</div>
        <div class="xg-sub">${got ? `✅ ${got.year}${city ? " · " + city : ""}` : "à accomplir"}</div></div>
      <span class="xg-xp">+${g.xp}</span>`;
    ggrid.appendChild(d);
  });
  gc.appendChild(ggrid);
  el.appendChild(gc);

  /* ----- Le journal ----- */
  const j = document.createElement("div");
  j.className = "card xp-card";
  j.innerHTML = `<h3>📜 Le journal de ta carrière</h3>`;
  const log = (xp.log || []).slice(-80).reverse();
  if (!log.length) {
    j.insertAdjacentHTML("beforeend",
      `<p class="xp-empty">Ton histoire s'écrit dès le premier match : chaque victoire vaut +${XP_WIN} XP,
      chaque exploit son goal… Rendez-vous ici après chaque tournoi 🎾</p>`);
  } else {
    const jl = document.createElement("div");
    jl.className = "xp-journal";
    log.forEach(e => {
      const lvl = e.t === "up" || e.t === "down";
      const d = document.createElement("div");
      d.className = "xp-line" + (lvl ? " lvl " + e.t : "");
      d.innerHTML = `<span class="xl-xp ${e.xp > 0 ? "pos" : e.xp < 0 ? "neg" : "star"}">${
        e.xp > 0 ? "+" + e.xp : e.xp < 0 ? String(e.xp) : "★"}</span>
        <span class="xl-lbl">${e.label}</span>
        <span class="xl-yr">${e.year || ""}</span>`;
      jl.appendChild(d);
    });
    j.appendChild(jl);
    if ((xp.log || []).length > 80)
      j.insertAdjacentHTML("beforeend", `<p class="xp-empty">… et ${xp.log.length - 80} événements plus anciens.</p>`);
  }
  el.appendChild(j);
}
