// Stiahne výsledky minulých národných volieb zo ŠÚSR (volby.statistics.sk) a vygeneruje
// results/<id>.json (účasť + strany s % a farbami + víťaz). Zatiaľ parlamentné a eurovoľby
// (rovnaká štruktúra JSON). Prezidentské/referendum majú inú štruktúru — doplnia sa neskôr.
//
// Použitie: node build-results.mjs [--elections ../src/assets/data/elections.json] [--dir ../src/assets/data/results]

import fs from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (VolbySK results; kontakt: jur.vanko@gmail.com)";
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const here = path.dirname(new URL(import.meta.url).pathname);
const ELECTIONS = opt("--elections", path.join(here, "../src/assets/data/elections.json"));
const DIR = opt("--dir", path.join(here, "../src/assets/data/results"));

// typ voľby -> cesta na výsledkový portál ŠÚSR (idsk-frontend s /json/ dátami, ~2020+)
const PORTAL = {
  parliamentary: (y) => `nrsr/nrsr${y}`,
  european: (y) => `ep/ep${y}`,
};

const num = (s) => parseFloat(String(s ?? "").replace(/[\s ]/g, "").replace("%", "").replace(",", "."));

async function getJson(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } }).catch(() => null);
  if (!r || !r.ok) return null;
  return r.json().catch(() => null);
}

async function fetchResult(election) {
  const build = PORTAL[election.type];
  if (!build) return null;
  const year = election.date.slice(0, 4);
  const base = `https://volby.statistics.sk/${build(year)}/json`;
  const [tab01, graph, seatsGraph] = await Promise.all([
    getJson(`${base}/tab01.json`),
    getJson(`${base}/graph01a.json`),
    getJson(`${base}/graph02a.json`), // mandáty (kreslá) — len strany v parlamente
  ]);
  if (!tab01 || !graph || !graph.length) return null;

  // mapa strana -> počet mandátov (podľa skratky aj názvu)
  const seatsBy = new Map();
  for (const s of seatsGraph || []) {
    const seats = Number(s.y) || 0;
    if (s.skratka) seatsBy.set(String(s.skratka).toLowerCase(), seats);
    if (s.nazov) seatsBy.set(String(s.nazov).toLowerCase(), seats);
  }
  const seatsOf = (p) =>
    seatsBy.get(String(p.skratka).toLowerCase()) ?? seatsBy.get(String(p.nazov).toLowerCase()) ?? 0;

  const t = tab01[0] || {};
  const parties = graph
    .map((p) => {
      const seats = seatsOf(p);
      return { name: p.nazov, abbr: p.skratka, votes: p.y, pct: p.c01, seats, inParliament: seats > 0 };
    })
    .filter((p) => p.name && Number.isFinite(p.pct))
    .sort((a, b) => b.pct - a.pct);
  if (!parties.length) return null;

  return {
    id: election.id,
    type: election.type,
    date: election.date,
    turnout: { pct: num(t.C07), eligible: num(t.C05), voted: num(t.C06) },
    parties,
    winner: { name: parties[0].name, abbr: parties[0].abbr, pct: parties[0].pct },
    source: `https://volby.statistics.sk/${build(year)}/sk/`,
    generatedAt: new Date().toISOString(),
  };
}

// Historické parlamentné výsledky z Wikipédie (staršie ako ŠÚSR /json/, ~pred 2020).
// Faktické dáta z šablón {{bar percent}} (strana + %) a {{legenda}} (strana + mandáty).
function parseWikiParty(s) {
  const m = s.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (!m) return { label: s.replace(/[[\]']/g, "").trim(), name: s.replace(/[[\]']/g, "").trim() };
  return { name: m[1].trim(), label: (m[2] || m[1]).trim() };
}

async function fetchResultWiki(election) {
  if (election.type !== "parliamentary") return null;
  const year = election.date.slice(0, 4);
  const title = `Voľby do Národnej rady Slovenskej republiky v roku ${year}`;
  // len section 0 (infobox súhrn) — konzistentné a presné; celý článok má viac šablón a mýli parse
  const api = `https://sk.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&section=0`;
  const j = await getJson(api);
  const w = j?.parse?.wikitext;
  if (!w) return null;

  // Pozor: wikilink [[Full|Display]] obsahuje '|', preto berieme celý blok a z neho
  // vytiahneme prvý wikilink (strana) a % (číslo s desatinnou čiarkou pred %).
  const pctByLabel = new Map();
  const nameByLabel = new Map();
  for (const m of w.matchAll(/\{\{bar percent\|(.+?)\}\}/g)) {
    const { label, name } = parseWikiParty(m[1]);
    if (/ostatn|iné strany|\bgraf\b|\|/i.test(label)) continue; // preskoč "ostatní" a artefakty
    const pctM = m[1].match(/([\d]+[,.]\d+)\s*%/);
    if (!pctM) continue;
    const pct = parseFloat(pctM[1].replace(",", "."));
    if (label && Number.isFinite(pct) && !pctByLabel.has(label)) { pctByLabel.set(label, pct); nameByLabel.set(label, name); }
  }
  const seatsByLabel = new Map();
  for (const m of w.matchAll(/\{\{legenda\|.*?(\[\[.+?\]\]).*?\((\d+)\)\s*\}\}/g)) {
    seatsByLabel.set(parseWikiParty(m[1]).label, Number(m[2]));
  }
  if (!pctByLabel.size) return null;
  // bez mandátov (staršie infoboxy) by vznikol mylný dojem "nikto v parlamente" → vynechať
  if (![...seatsByLabel.values()].some((s) => s > 0)) return null;

  const turnoutM = w.match(/účas[ťt][^\n]{0,30}?([\d]{1,2}[,.]\d+)\s*%/i);
  const parties = [...pctByLabel.entries()]
    .map(([label, pct]) => {
      const seats = seatsByLabel.get(label) ?? 0;
      return { name: nameByLabel.get(label) || label, abbr: label, votes: 0, pct, seats, inParliament: seats > 0 };
    })
    .sort((a, b) => b.pct - a.pct);

  return {
    id: election.id, type: election.type, date: election.date,
    turnout: { pct: turnoutM ? parseFloat(turnoutM[1].replace(",", ".")) : null, eligible: null, voted: null },
    parties,
    winner: { name: parties[0].name, abbr: parties[0].abbr, pct: parties[0].pct },
    source: `https://sk.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    sourceLabel: "Wikipédia",
    generatedAt: new Date().toISOString(),
  };
}

// --- main ---
const { elections } = JSON.parse(fs.readFileSync(ELECTIONS, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const past = elections.filter((e) => !e.predicted && e.date < today && PORTAL[e.type]);

fs.mkdirSync(DIR, { recursive: true });
const generated = [];
for (const e of past) {
  process.stderr.write(`# ${e.id} ... `);
  let res = await fetchResult(e).catch(() => null);
  if (!res) res = await fetchResultWiki(e).catch(() => null); // starší formát → Wikipédia
  if (res) {
    fs.writeFileSync(path.join(DIR, `${e.id}.json`), JSON.stringify(res, null, 2));
    generated.push(e.id);
    process.stderr.write(`✓ účasť ${res.turnout.pct}%, víťaz ${res.winner.abbr} ${res.winner.pct}%\n`);
  } else {
    process.stderr.write(`— výsledky nedostupné (starší formát)\n`);
  }
}
// index (zoznam id, ktoré majú výsledky) — appka vie dopredu, čo je k dispozícii
fs.writeFileSync(path.join(DIR, "index.json"), JSON.stringify({ generatedAt: new Date().toISOString(), ids: generated }));
process.stderr.write(`\n✓ ${generated.length} výsledkov do ${DIR}\n`);
