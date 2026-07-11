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
  const [tab01, graph] = await Promise.all([getJson(`${base}/tab01.json`), getJson(`${base}/graph01a.json`)]);
  if (!tab01 || !graph || !graph.length) return null;

  const t = tab01[0] || {};
  const parties = graph
    .map((p) => ({ name: p.nazov, abbr: p.skratka, votes: p.y, pct: p.c01, color: p.gcolor || null }))
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

// --- main ---
const { elections } = JSON.parse(fs.readFileSync(ELECTIONS, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const past = elections.filter((e) => !e.predicted && e.date < today && PORTAL[e.type]);

fs.mkdirSync(DIR, { recursive: true });
const generated = [];
for (const e of past) {
  process.stderr.write(`# ${e.id} ... `);
  const res = await fetchResult(e).catch(() => null);
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
