/* ============================================================
   Fun'is — Données : calendrier ATP 2026, points, prize money,
   et la liste initiale des 128 personnalités.
   ============================================================ */

"use strict";

/* ---------- Calendrier ATP 2026 (Grands Chelems + Masters 1000 + Finals) ---------- */
/* cat: "GC" (128 joueurs, 3 sets gagnants), "M1000" (64 joueurs, 2 sets gagnants),
   "FINALS" (8 joueurs, 2 sets gagnants) */
const CALENDAR = [
  { id: "ao",     name: "Open d'Australie",       city: "Melbourne",    country: "🇦🇺", surface: "hard",   surfaceLabel: "Dur",           cat: "GC",     dates: "19 janv. – 1 févr. 2026",  bestOf: 5, drawSize: 128, seeds: 32, randomDraw: true },
  { id: "iw",     name: "Masters d'Indian Wells", city: "Indian Wells", country: "🇺🇸", surface: "hard",   surfaceLabel: "Dur",           cat: "M1000",  dates: "11 – 22 mars 2026",        bestOf: 3, drawSize: 64,  seeds: 16 },
  { id: "miami",  name: "Masters de Miami",       city: "Miami",        country: "🇺🇸", surface: "hard",   surfaceLabel: "Dur",           cat: "M1000",  dates: "25 mars – 5 avr. 2026",    bestOf: 3, drawSize: 64,  seeds: 16 },
  { id: "mc",     name: "Masters de Monte-Carlo", city: "Monte-Carlo",  country: "🇲🇨", surface: "clay",   surfaceLabel: "Terre battue",  cat: "M1000",  dates: "12 – 19 avr. 2026",        bestOf: 3, drawSize: 64,  seeds: 16 },
  { id: "madrid", name: "Masters de Madrid",      city: "Madrid",       country: "🇪🇸", surface: "clay",   surfaceLabel: "Terre battue",  cat: "M1000",  dates: "22 avr. – 3 mai 2026",     bestOf: 3, drawSize: 64,  seeds: 16 },
  { id: "rome",   name: "Masters de Rome",        city: "Rome",         country: "🇮🇹", surface: "clay",   surfaceLabel: "Terre battue",  cat: "M1000",  dates: "6 – 17 mai 2026",          bestOf: 3, drawSize: 64,  seeds: 16 },
  { id: "rg",     name: "Roland-Garros",          city: "Paris",        country: "🇫🇷", surface: "clay",   surfaceLabel: "Terre battue",  cat: "GC",     dates: "24 mai – 7 juin 2026",     bestOf: 5, drawSize: 128, seeds: 32 },
  { id: "wim",    name: "Wimbledon",              city: "Londres",      country: "🇬🇧", surface: "grass",  surfaceLabel: "Gazon",         cat: "GC",     dates: "29 juin – 12 juil. 2026",  bestOf: 5, drawSize: 128, seeds: 32 },
  { id: "canada", name: "Masters du Canada",      city: "Toronto",      country: "🇨🇦", surface: "hard",   surfaceLabel: "Dur",           cat: "M1000",  dates: "27 juil. – 7 août 2026",   bestOf: 3, drawSize: 64,  seeds: 16 },
  { id: "cincy",  name: "Masters de Cincinnati",  city: "Cincinnati",   country: "🇺🇸", surface: "hard",   surfaceLabel: "Dur",           cat: "M1000",  dates: "10 – 22 août 2026",        bestOf: 3, drawSize: 64,  seeds: 16 },
  { id: "uso",    name: "US Open",                city: "New York",     country: "🇺🇸", surface: "hard",   surfaceLabel: "Dur",           cat: "GC",     dates: "31 août – 13 sept. 2026",  bestOf: 5, drawSize: 128, seeds: 32 },
  { id: "shang",  name: "Masters de Shanghai",    city: "Shanghai",     country: "🇨🇳", surface: "hard",   surfaceLabel: "Dur",           cat: "M1000",  dates: "7 – 18 oct. 2026",         bestOf: 3, drawSize: 64,  seeds: 16 },
  { id: "paris",  name: "Masters de Paris",       city: "Paris",        country: "🇫🇷", surface: "indoor", surfaceLabel: "Dur (indoor)",  cat: "M1000",  dates: "26 oct. – 1 nov. 2026",    bestOf: 3, drawSize: 64,  seeds: 16 },
  { id: "finals", name: "Masters — ATP Finals",   city: "Turin",        country: "🇮🇹", surface: "indoor", surfaceLabel: "Dur (indoor)",  cat: "FINALS", dates: "15 – 22 nov. 2026",        bestOf: 3, drawSize: 8,   seeds: 8 },
];

/* ---------- Barème de points ATP officiel ----------
   Indexé par le tour ATTEINT (perdant au tour X reçoit les points du tour X ;
   le vainqueur reçoit les points "W"). */
const POINTS = {
  GC:    { R128: 10, R64: 50, R32: 100, R16: 200, QF: 400, SF: 800, F: 1300, W: 2000 },
  M1000: { R64: 10, R32: 50, R16: 100, QF: 200, SF: 400, F: 650, W: 1000 },
  FINALS: { RR_WIN: 200, SF_WIN: 400, F_WIN: 500 }, // max 1500 (invaincu)
};

/* ---------- Prize money (valeurs du circuit ATP converties en €) ----------
   Indexé par le tour ATTEINT (le perdant au tour X touche le montant du tour X). */
const PRIZE = {
  ao:     { R128: 82000,  R64: 123000, R32: 178000, QF16: 0, R16: 255000, QF: 410000, SF: 690000, F: 1210000, W: 2200000 },
  rg:     { R128: 78000,  R64: 117000, R32: 168000, R16: 265000, QF: 440000, SF: 690000, F: 1275000, W: 2550000 },
  wim:    { R128: 77000,  R64: 116000, R32: 180000, R16: 280000, QF: 470000, SF: 930000, F: 1820000, W: 3510000 },
  uso:    { R128: 100000, R64: 128000, R32: 190000, R16: 300000, QF: 575000, SF: 1150000, F: 2300000, W: 4600000 },
  // Masters 1000 "premium" (Indian Wells, Miami, Madrid, Rome, Canada, Cincinnati, Shanghai)
  m1000_big:   { R64: 35000, R32: 60000, R16: 103000, QF: 185000, SF: 330000, F: 600000, W: 1100000 },
  // Masters 1000 (Monte-Carlo, Paris)
  m1000_std:   { R64: 30000, R32: 52000, R16: 90000,  QF: 160000, SF: 285000, F: 520000, W: 950000 },
  // ATP Finals (participation + montants par victoire)
  finals: { PARTICIPATION: 300000, RR_WIN: 360000, SF_WIN: 1080000, F_WIN: 2160000 },
};

const PRIZE_BY_TOURNEY = {
  ao: "ao", rg: "rg", wim: "wim", uso: "uso",
  iw: "m1000_big", miami: "m1000_big", madrid: "m1000_big", rome: "m1000_big",
  canada: "m1000_big", cincy: "m1000_big", shang: "m1000_big",
  mc: "m1000_std", paris: "m1000_std",
  finals: "finals",
};

/* Libellés des tours */
const ROUND_LABELS = {
  R128: "1er tour", R64: "2e tour / 1er tour", R32: "3e tour", R16: "8es de finale",
  QF: "Quarts de finale", SF: "Demi-finales", F: "Finale", W: "Vainqueur",
};

/* ---------- Les 128 personnalités ----------
   fr: true → personnalité française (30 %). cat = catégorie fun. */
const DEFAULT_PLAYERS = [
  /* ===== Françaises (38) ===== */
  { name: "Napoléon Bonaparte",        flag: "🇫🇷", cat: "Empereurs & Rois", fr: true },
  { name: "Louis XIV",                 flag: "🇫🇷", cat: "Empereurs & Rois", fr: true },
  { name: "Jeanne d'Arc",              flag: "🇫🇷", cat: "Héros & Légendes", fr: true },
  { name: "Charlemagne",               flag: "🇫🇷", cat: "Empereurs & Rois", fr: true },
  { name: "Vercingétorix",             flag: "🇫🇷", cat: "Héros & Légendes", fr: true },
  { name: "François Ier",              flag: "🇫🇷", cat: "Empereurs & Rois", fr: true },
  { name: "Henri IV",                  flag: "🇫🇷", cat: "Empereurs & Rois", fr: true },
  { name: "Clara Morgane",             flag: "🇫🇷", cat: "Cinéma", fr: true },
  { name: "Cardinal de Richelieu",     flag: "🇫🇷", cat: "Politiques", fr: true },
  { name: "Robespierre",               flag: "🇫🇷", cat: "Politiques", fr: true },
  { name: "La Fayette",                flag: "🇫🇷", cat: "Héros & Légendes", fr: true },
  { name: "Charles de Gaulle",         flag: "🇫🇷", cat: "Politiques", fr: true },
  { name: "Jean Moulin",               flag: "🇫🇷", cat: "Héros & Légendes", fr: true },
  { name: "Simone Veil",               flag: "🇫🇷", cat: "Politiques", fr: true },
  { name: "Victor Hugo",               flag: "🇫🇷", cat: "Écrivains", fr: true },
  { name: "Molière",                   flag: "🇫🇷", cat: "Écrivains", fr: true },
  { name: "Voltaire",                  flag: "🇫🇷", cat: "Écrivains", fr: true },
  { name: "Jules Verne",               flag: "🇫🇷", cat: "Écrivains", fr: true },
  { name: "Alexandre Dumas",           flag: "🇫🇷", cat: "Écrivains", fr: true },
  { name: "Adolf Hitler",              flag: "🇩🇪", cat: "Politiques", fr: false },
  { name: "Vladimir Poutine",          flag: "🇷🇺", cat: "Politiques", fr: false },
  { name: "Édith Piaf",                flag: "🇫🇷", cat: "Musique", fr: true },
  { name: "Serge Gainsbourg",          flag: "🇫🇷", cat: "Musique", fr: true },
  { name: "Johnny Hallyday",           flag: "🇫🇷", cat: "Musique", fr: true },
  { name: "Brigitte Bardot",           flag: "🇫🇷", cat: "Cinéma", fr: true },
  { name: "Louis de Funès",            flag: "🇫🇷", cat: "Cinéma", fr: true },
  { name: "Coluche",                   flag: "🇫🇷", cat: "Cinéma", fr: true },
  { name: "Jean-Paul Belmondo",        flag: "🇫🇷", cat: "Cinéma", fr: true },
  { name: "Marie Curie",               flag: "🇫🇷", cat: "Scientifiques", fr: true },
  { name: "Donald Trump",              flag: "🇺🇸", cat: "Politiques", fr: false },
  { name: "Heidi",                     flag: "🇨🇭", cat: "Fictifs", fr: false },
  { name: "Sauron",                    flag: "👁️", cat: "Fictifs", fr: false },
  { name: "Céline Dion",               flag: "🇨🇦", cat: "Musique", fr: false },
  { name: "Zinédine Zidane",           flag: "🇫🇷", cat: "Sportifs", fr: true },
  { name: "Astérix",                   flag: "🇫🇷", cat: "Fictifs", fr: true },
  { name: "Obélix",                    flag: "🇫🇷", cat: "Fictifs", fr: true },
  { name: "D'Artagnan",                flag: "🇫🇷", cat: "Fictifs", fr: true },
  { name: "Arsène Lupin",              flag: "🇫🇷", cat: "Fictifs", fr: true },

  /* ===== Internationales (90) ===== */
  /* Antiquité, rois & reines (11) */
  { name: "Cléopâtre",                 flag: "🇪🇬", cat: "Empereurs & Rois", fr: false },
  { name: "Jules César",               flag: "🇮🇹", cat: "Empereurs & Rois", fr: false },
  { name: "Alexandre le Grand",        flag: "🇬🇷", cat: "Empereurs & Rois", fr: false },
  { name: "Ramsès II",                 flag: "🇪🇬", cat: "Empereurs & Rois", fr: false },
  { name: "Toutânkhamon",              flag: "🇪🇬", cat: "Empereurs & Rois", fr: false },
  { name: "Gengis Khan",               flag: "🇲🇳", cat: "Empereurs & Rois", fr: false },
  { name: "Attila",                    flag: "🇭🇺", cat: "Empereurs & Rois", fr: false },
  { name: "Henri VIII",                flag: "🇬🇧", cat: "Empereurs & Rois", fr: false },
  { name: "Élisabeth II",              flag: "🇬🇧", cat: "Empereurs & Rois", fr: false },
  { name: "Ivan le Terrible",          flag: "🇷🇺", cat: "Empereurs & Rois", fr: false },
  { name: "Spartacus",                 flag: "🇮🇹", cat: "Héros & Légendes", fr: false },
  /* Politiques (8) */
  { name: "Winston Churchill",         flag: "🇬🇧", cat: "Politiques", fr: false },
  { name: "Abraham Lincoln",           flag: "🇺🇸", cat: "Politiques", fr: false },
  { name: "Gandhi",                    flag: "🇮🇳", cat: "Politiques", fr: false },
  { name: "Nelson Mandela",            flag: "🇿🇦", cat: "Politiques", fr: false },
  { name: "Martin Luther King",        flag: "🇺🇸", cat: "Politiques", fr: false },
  { name: "Staline",                   flag: "🇷🇺", cat: "Politiques", fr: false },
  { name: "Mao Zedong",                flag: "🇨🇳", cat: "Politiques", fr: false },
  { name: "Che Guevara",               flag: "🇦🇷", cat: "Politiques", fr: false },
  /* Dieux & mythologie (12) */
  { name: "Zeus",                      flag: "⚡", cat: "Dieux & Mythes", fr: false },
  { name: "Poséidon",                  flag: "🔱", cat: "Dieux & Mythes", fr: false },
  { name: "Athéna",                    flag: "🦉", cat: "Dieux & Mythes", fr: false },
  { name: "Aphrodite",                 flag: "🌹", cat: "Dieux & Mythes", fr: false },
  { name: "Apollon",                   flag: "☀️", cat: "Dieux & Mythes", fr: false },
  { name: "Hercule",                   flag: "💪", cat: "Dieux & Mythes", fr: false },
  { name: "Achille",                   flag: "🛡️", cat: "Dieux & Mythes", fr: false },
  { name: "Thor",                      flag: "🔨", cat: "Dieux & Mythes", fr: false },
  { name: "Odin",                      flag: "🐦‍⬛", cat: "Dieux & Mythes", fr: false },
  { name: "Loki",                      flag: "🐍", cat: "Dieux & Mythes", fr: false },
  { name: "Anubis",                    flag: "🐕", cat: "Dieux & Mythes", fr: false },
  { name: "Râ",                        flag: "🌅", cat: "Dieux & Mythes", fr: false },
  /* Scientifiques (10) */
  { name: "Albert Einstein",           flag: "🇩🇪", cat: "Scientifiques", fr: false },
  { name: "Isaac Newton",              flag: "🇬🇧", cat: "Scientifiques", fr: false },
  { name: "Galilée",                   flag: "🇮🇹", cat: "Scientifiques", fr: false },
  { name: "Charles Darwin",            flag: "🇬🇧", cat: "Scientifiques", fr: false },
  { name: "Elon Musk",                 flag: "🇺🇸", cat: "Scientifiques", fr: false },
  { name: "Archimède",                 flag: "🇬🇷", cat: "Scientifiques", fr: false },
  { name: "OSS 117",                   flag: "🇫🇷", cat: "Fictifs", fr: true },
  { name: "Alan Turing",               flag: "🇬🇧", cat: "Scientifiques", fr: false },
  { name: "H.P. Lovecraft",            flag: "🇺🇸", cat: "Écrivains", fr: false },
  { name: "Léonard de Vinci",          flag: "🇮🇹", cat: "Scientifiques", fr: false },
  /* Artistes & écrivains (9) */
  { name: "Michel-Ange",               flag: "🇮🇹", cat: "Artistes", fr: false },
  { name: "Pablo Picasso",             flag: "🇪🇸", cat: "Artistes", fr: false },
  { name: "Vincent van Gogh",          flag: "🇳🇱", cat: "Artistes", fr: false },
  { name: "Salvador Dalí",             flag: "🇪🇸", cat: "Artistes", fr: false },
  { name: "Jésus",                     flag: "✝️", cat: "Dieux & Mythes", fr: false },
  { name: "Mozart",                    flag: "🇦🇹", cat: "Musique", fr: false },
  { name: "Beethoven",                 flag: "🇩🇪", cat: "Musique", fr: false },
  { name: "William Shakespeare",       flag: "🇬🇧", cat: "Écrivains", fr: false },
  { name: "Agatha Christie",           flag: "🇬🇧", cat: "Écrivains", fr: false },
  /* Musique & cinéma (9) */
  { name: "Elvis Presley",             flag: "🇺🇸", cat: "Musique", fr: false },
  { name: "Michael Jackson",           flag: "🇺🇸", cat: "Musique", fr: false },
  { name: "Freddie Mercury",           flag: "🇬🇧", cat: "Musique", fr: false },
  { name: "John Lennon",               flag: "🇬🇧", cat: "Musique", fr: false },
  { name: "Bob Marley",                flag: "🇯🇲", cat: "Musique", fr: false },
  { name: "Marilyn Monroe",            flag: "🇺🇸", cat: "Cinéma", fr: false },
  { name: "Charlie Chaplin",           flag: "🇬🇧", cat: "Cinéma", fr: false },
  { name: "Audrey Hepburn",            flag: "🇬🇧", cat: "Cinéma", fr: false },
  { name: "Bruce Lee",                 flag: "🇭🇰", cat: "Cinéma", fr: false },
  /* Aventuriers & explorateurs (6) */
  { name: "Christophe Colomb",         flag: "🇮🇹", cat: "Aventuriers", fr: false },
  { name: "Magellan",                  flag: "🇵🇹", cat: "Aventuriers", fr: false },
  { name: "Marco Polo",                flag: "🇮🇹", cat: "Aventuriers", fr: false },
  { name: "Neil Armstrong",            flag: "🇺🇸", cat: "Aventuriers", fr: false },
  { name: "Tintin",                    flag: "🇧🇪", cat: "Aventuriers", fr: false },
  { name: "Youri Gagarine",            flag: "🇷🇺", cat: "Aventuriers", fr: false },
  /* Sportifs (5) */
  { name: "Muhammad Ali",              flag: "🇺🇸", cat: "Sportifs", fr: false },
  { name: "Pelé",                      flag: "🇧🇷", cat: "Sportifs", fr: false },
  { name: "Diego Maradona",            flag: "🇦🇷", cat: "Sportifs", fr: false },
  { name: "Ayrton Senna",              flag: "🇧🇷", cat: "Sportifs", fr: false },
  { name: "Usain Bolt",                flag: "🇯🇲", cat: "Sportifs", fr: false },
  /* Fictifs (19) */
  { name: "Sherlock Holmes",           flag: "🇬🇧", cat: "Fictifs", fr: false },
  { name: "Dracula",                   flag: "🇷🇴", cat: "Fictifs", fr: false },
  { name: "James Bond",                flag: "🇬🇧", cat: "Fictifs", fr: false },
  { name: "Superman",                  flag: "🦸", cat: "Fictifs", fr: false },
  { name: "Batman",                    flag: "🦇", cat: "Fictifs", fr: false },
  { name: "Wonder Woman",              flag: "🦸‍♀️", cat: "Fictifs", fr: false },
  { name: "Dark Vador",                flag: "🌑", cat: "Fictifs", fr: false },
  { name: "Yoda",                      flag: "🟢", cat: "Fictifs", fr: false },
  { name: "Gandalf",                   flag: "🧙", cat: "Fictifs", fr: false },
  { name: "Harry Potter",              flag: "🇬🇧", cat: "Fictifs", fr: false },
  { name: "Merlin l'Enchanteur",       flag: "🪄", cat: "Fictifs", fr: false },
  { name: "Robin des Bois",            flag: "🏹", cat: "Fictifs", fr: false },
  { name: "Zorro",                     flag: "🇲🇽", cat: "Fictifs", fr: false },
  { name: "Don Quichotte",             flag: "🇪🇸", cat: "Fictifs", fr: false },
  { name: "Tarzan",                    flag: "🦍", cat: "Fictifs", fr: false },
  { name: "Lara Croft",                flag: "🇬🇧", cat: "Fictifs", fr: false },
  { name: "Super Mario",               flag: "🍄", cat: "Fictifs", fr: false },
  { name: "Pikachu",                   flag: "⚡", cat: "Fictifs", fr: false },
  { name: "Goldorak",                  flag: "🤖", cat: "Fictifs", fr: false },
];

/* Sanity check silencieux */
if (DEFAULT_PLAYERS.length !== 127) {
  console.warn("Attention : la liste par défaut contient " + DEFAULT_PLAYERS.length + " joueurs au lieu de 127.");
}

/* ---------- Mode "Top 128 ATP" ----------
   Le top 127 du classement ATP réel (le 128e siège est pour TON champion) (août 2026, post-Cincinnati).
   Compétences FIXES : niveau global de 99 (n°1) à 75 (n°127), identique
   sur toutes les surfaces et conservé d'une saison à l'autre. */
const ATP_RANKING_2026 = [
  ["Jannik Sinner", "🇮🇹"], ["Carlos Alcaraz", "🇪🇸"], ["Alexander Zverev", "🇩🇪"],
  ["Félix Auger-Aliassime", "🇨🇦"], ["Novak Djokovic", "🇷🇸"], ["Ben Shelton", "🇺🇸"],
  ["Daniil Medvedev", "🇷🇺"], ["Alex de Minaur", "🇦🇺"], ["Taylor Fritz", "🇺🇸"],
  ["Flavio Cobolli", "🇮🇹"], ["Rafael Jódar", "🇪🇸"], ["Learner Tien", "🇺🇸"],
  ["Alexander Bublik", "🇰🇿"], ["Jiří Lehečka", "🇨🇿"], ["Lorenzo Musetti", "🇮🇹"],
  ["Jakub Menšík", "🇨🇿"], ["Casper Ruud", "🇳🇴"], ["Andrey Rublev", "🇷🇺"],
  ["Valentin Vacherot", "🇲🇨"], ["Luciano Darderi", "🇮🇹"], ["Arthur Fils", "🇫🇷"],
  ["Brandon Nakashima", "🇺🇸"], ["Frances Tiafoe", "🇺🇸"], ["Tommy Paul", "🇺🇸"],
  ["Francisco Cerúndolo", "🇦🇷"], ["João Fonseca", "🇧🇷"], ["Alejandro Davidovich Fokina", "🇪🇸"],
  ["Arthur Rinderknech", "🇫🇷"], ["Alejandro Tabilo", "🇨🇱"], ["Ugo Humbert", "🇫🇷"],
  ["Tomás Martín Etcheverry", "🇦🇷"], ["Alexander Blockx", "🇧🇪"], ["Zizou Bergs", "🇧🇪"],
  ["Matteo Arnaldi", "🇮🇹"], ["Cameron Norrie", "🇬🇧"], ["Ignacio Buse", "🇵🇪"],
  ["Arthur Fery", "🇬🇧"], ["Raphaël Collignon", "🇧🇪"], ["Karen Khachanov", "🇷🇺"],
  ["Daniel Mérida", "🇪🇸"], ["Alex Michelsen", "🇺🇸"], ["Matteo Berrettini", "🇮🇹"],
  ["Jan-Lennard Struff", "🇩🇪"], ["Mariano Navone", "🇦🇷"], ["Térence Atmane", "🇫🇷"],
  ["Jaume Munar", "🇪🇸"], ["Nuno Borges", "🇵🇹"], ["Denis Shapovalov", "🇨🇦"],
  ["Stefanos Tsitsipas", "🇬🇷"], ["Thiago Agustín Tirante", "🇦🇷"], ["Juan Manuel Cerúndolo", "🇦🇷"],
  ["Adrian Mannarino", "🇫🇷"], ["Sebastián Báez", "🇦🇷"], ["Luca Van Assche", "🇫🇷"],
  ["Yannick Hanfmann", "🇩🇪"], ["Tallon Griekspoor", "🇳🇱"], ["Quentin Halys", "🇫🇷"],
  ["Ethan Quinn", "🇺🇸"], ["Botic van de Zandschulp", "🇳🇱"], ["Corentin Moutet", "🇫🇷"],
  ["Román Andrés Burruchaga", "🇦🇷"], ["Tomáš Macháč", "🇨🇿"], ["Fábián Marozsán", "🇭🇺"],
  ["Sebastian Korda", "🇺🇸"], ["Daniel Altmaier", "🇩🇪"], ["Miomir Kecmanović", "🇷🇸"],
  ["Martín Landaluce", "🇪🇸"], ["Kamil Majchrzak", "🇵🇱"], ["Hubert Hurkacz", "🇵🇱"],
  ["Adolfo Daniel Vallejo", "🇵🇾"], ["Vít Kopřiva", "🇨🇿"], ["Pablo Carreño Busta", "🇪🇸"],
  ["Hamad Medjedović", "🇷🇸"], ["Jenson Brooksby", "🇺🇸"], ["Alex Molčan", "🇸🇰"],
  ["Camilo Ugo Carabelli", "🇦🇷"], ["Jan Choinski", "🇬🇧"], ["Valentin Royer", "🇫🇷"],
  ["Jaime Faria", "🇵🇹"], ["Marin Čilić", "🇭🇷"], ["Mattia Bellucci", "🇮🇹"],
  ["Márton Fucsovics", "🇭🇺"], ["Marcos Giron", "🇺🇸"], ["Zachary Svajda", "🇺🇸"],
  ["Arthur Géa", "🇫🇷"], ["James Duckworth", "🇦🇺"], ["Facundo Díaz Acosta", "🇦🇷"],
  ["Lorenzo Sonego", "🇮🇹"], ["Aleksandr Shevchenko", "🇰🇿"], ["Sho Shimabukuro", "🇯🇵"],
  ["Marco Trungelliti", "🇦🇷"], ["Giovanni Mpetshi Perricard", "🇫🇷"], ["Coleman Wong", "🇭🇰"],
  ["Martin Damm", "🇺🇸"], ["Rinky Hijikata", "🇦🇺"], ["Aleksandar Kovačević", "🇺🇸"],
  ["Hugo Gaston", "🇫🇷"], ["Adam Walton", "🇦🇺"], ["Aleksandar Vukic", "🇦🇺"],
  ["Benjamin Bonzi", "🇫🇷"], ["Dino Prižmić", "🇭🇷"], ["Holger Rune", "🇩🇰"],
  ["Roman Safiullin", "🇷🇺"], ["Damir Džumhur", "🇧🇦"], ["Gabriel Diallo", "🇨🇦"],
  ["Jesper de Jong", "🇳🇱"], ["Jacob Fearnley", "🇬🇧"], ["Emilio Nava", "🇺🇸"],
  ["Francisco Comesaña", "🇦🇷"], ["Michael Zheng", "🇺🇸"], ["Titouan Droguet", "🇫🇷"],
  ["Shintaro Mochizuki", "🇯🇵"], ["Toby Samuel", "🇬🇧"], ["Dalibor Svrčina", "🇨🇿"],
  ["Patrick Kypson", "🇺🇸"], ["Otto Virtanen", "🇫🇮"], ["Eliot Spizzirri", "🇺🇸"],
  ["Wu Yibing", "🇨🇳"], ["Kyrian Jacquet", "🇫🇷"], ["Bu Yunchaokete", "🇨🇳"],
  ["Zsombor Piros", "🇭🇺"], ["Nicolás Mejía", "🇨🇴"], ["Vilius Gaubas", "🇱🇹"],
  ["Dane Sweeny", "🇦🇺"], ["Stan Wawrinka", "🇨🇭"], ["Henrique Rocha", "🇵🇹"],
  ["Sebastian Ofner", "🇦🇹"], ["Alexei Popyrin", "🇦🇺"],
];

/* Nationalités (affichées sur les cartes) et surface fétiche par nation */
const COUNTRY_NAMES = {
  "🇮🇹": "Italie", "🇪🇸": "Espagne", "🇩🇪": "Allemagne", "🇨🇦": "Canada", "🇷🇸": "Serbie",
  "🇺🇸": "États-Unis", "🇷🇺": "Russie", "🇦🇺": "Australie", "🇰🇿": "Kazakhstan", "🇨🇿": "Tchéquie",
  "🇳🇴": "Norvège", "🇲🇨": "Monaco", "🇫🇷": "France", "🇦🇷": "Argentine", "🇧🇷": "Brésil",
  "🇨🇱": "Chili", "🇧🇪": "Belgique", "🇬🇧": "Royaume-Uni", "🇵🇪": "Pérou", "🇵🇹": "Portugal",
  "🇬🇷": "Grèce", "🇳🇱": "Pays-Bas", "🇭🇺": "Hongrie", "🇵🇱": "Pologne", "🇵🇾": "Paraguay",
  "🇸🇰": "Slovaquie", "🇭🇷": "Croatie", "🇯🇵": "Japon", "🇭🇰": "Hong Kong", "🇩🇰": "Danemark",
  "🇧🇦": "Bosnie-Herzégovine", "🇫🇮": "Finlande", "🇨🇳": "Chine", "🇨🇴": "Colombie",
  "🇱🇹": "Lituanie", "🇨🇭": "Suisse", "🇦🇹": "Autriche",
};
const COUNTRY_SURFACE = {
  // terriens
  "🇦🇷": "terre", "🇪🇸": "terre", "🇨🇱": "terre", "🇧🇷": "terre", "🇵🇪": "terre",
  "🇵🇾": "terre", "🇨🇴": "terre", "🇮🇹": "terre", "🇲🇨": "terre", "🇬🇷": "terre",
  "🇭🇺": "terre", "🇧🇦": "terre", "🇦🇹": "terre", "🇨🇭": "terre", "🇳🇴": "terre",
  // herbe
  "🇬🇧": "gazon", "🇦🇺": "gazon", "🇳🇱": "gazon",
  // indoor
  "🇫🇷": "indoor", "🇩🇪": "indoor", "🇨🇿": "indoor", "🇧🇪": "indoor", "🇵🇱": "indoor",
  "🇸🇰": "indoor", "🇫🇮": "indoor", "🇱🇹": "indoor", "🇭🇷": "indoor",
  // dur par défaut (🇺🇸 🇨🇦 🇯🇵 🇨🇳 🇭🇰 🇰🇿 🇷🇺 🇷🇸 🇩🇰 …)
};

/* PRNG déterministe : les compétences des pros sont FIXES d'une saison à l'autre */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Compétences entières et typées : total = niveau global (99 -> 75),
   surface fétiche de la nation favorisée, petites variations individuelles. */
function atpSkills(rankIdx, flag) {
  const total = Math.round(99 - rankIdx * 24 / 126);
  const keys = ["terre", "gazon", "dur", "indoor", "force", "endurance", "adresse", "tactique", "service", "mental"];
  const rng = mulberry32((rankIdx + 1) * 2654435761);
  const sk = {};
  // Répartition de base (q ou q+1, motif décalé par rang)
  const q = Math.floor(total / 10), r = total - q * 10;
  keys.forEach((k, j) => { sk[k] = q + (((j + rankIdx) % 10) < r ? 1 : 0); });
  // Spécialité nationale : +2 sur la surface fétiche, pris sur la surface opposée
  const pref = COUNTRY_SURFACE[flag] || "dur";
  const opp = { terre: "gazon", gazon: "terre", dur: "indoor", indoor: "dur" }[pref];
  for (let m = 0; m < 2 && sk[pref] < 10 && sk[opp] > 1; m++) { sk[pref]++; sk[opp]--; }
  // Garantie de spécificité : la surface opposée reste strictement sous la fétiche
  while (sk[opp] >= sk[pref] && sk[opp] > 1) {
    sk[opp]--;
    let target = sk[pref] < 10 ? pref
      : keys.filter(k => k !== opp && sk[k] < 10).sort((a, b) => sk[a] - sk[b])[0];
    if (!target) { sk[opp]++; break; }
    sk[target]++;
  }
  // Variations individuelles déterministes sur les compétences de jeu
  const jeu = keys.slice(4);
  for (let t = 0; t < 6; t++) {
    const a = jeu[Math.floor(rng() * jeu.length)];
    const b = jeu[Math.floor(rng() * jeu.length)];
    if (a !== b && sk[a] < 10 && sk[b] > Math.max(1, q - 2)) { sk[a]++; sk[b]--; }
  }
  return sk;
}

const ATP_PLAYERS = ATP_RANKING_2026.slice(0, 127).map(([name, flag], i) => ({
  name,
  flag,
  cat: COUNTRY_NAMES[flag] || "International",
  fr: flag === "🇫🇷",
  // Niveau global fixe : 99 (n°1) → 75 (n°127), linéaire — jamais retiré au sort
  overall: Math.round(99 - i * 24 / 126),
  sk: atpSkills(i, flag),
}));

if (ATP_PLAYERS.length !== 127) {
  console.warn("Attention : le plateau ATP contient " + ATP_PLAYERS.length + " joueurs au lieu de 127.");
}
