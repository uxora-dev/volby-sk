// Generuje per-voľba krajské výsledky pre mapu zo ŠÚSR: maps/<id>.json = víťaz + top strany
// za každý kraj (agregované z okresných dát map03d + map01d). Bez npm závislostí (beží v daily CI).
// Cesty krajov (kraje-paths.json) sa nemenia → generuje ich samostatný build-map-paths.mjs (lokálne).
//
// Použitie: node build-maps.mjs [--elections ../src/assets/data/elections.json] [--dir ../src/assets/data]

import fs from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (VolbySK maps; kontakt: jur.vanko@gmail.com)";
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const here = path.dirname(new URL(import.meta.url).pathname);
const ELECTIONS = opt("--elections", path.join(here, "../src/assets/data/elections.json"));
const DIR = opt("--dir", path.join(here, "../src/assets/data"));

const num = (s) => parseFloat(String(s ?? "").replace(/[\s ]/g, "").replace(",", "."));
const getJson = async (url) => { const r = await fetch(url, { headers: { "User-Agent": UA } }).catch(() => null); return r && r.ok ? r.json().catch(() => null) : null; };
const PORTAL = { parliamentary: (y) => `nrsr/nrsr${y}`, european: (y) => `ep/ep${y}` };
const isAggregate = (code) => /00$/.test(String(code)); // 100/800 agregáty + 900 Cudzina
const krajOf = (okres) => Math.floor(Number(okres) / 100); // 101 → 1, 702 → 7

// víťaz + top strany za kraj (agregované z okresných top-5 v map03d; podiel z voličov map01d)
async function buildElectionMap(e) {
  const year = e.date.slice(0, 4);
  const [d, voters] = await Promise.all([
    getJson(`https://volby.statistics.sk/${PORTAL[e.type](year)}/json/map03d.json`),
    getJson(`https://volby.statistics.sk/${PORTAL[e.type](year)}/json/map01d.json`),
  ]);
  if (!d || !d.length) return false;
  const votersByKraj = {};
  for (const r of voters || []) { if (!isAggregate(r.C01)) { const k = krajOf(r.C01); votersByKraj[k] = (votersByKraj[k] || 0) + (num(r.C02) || 0); } }

  const tally = {}; // kraj → { party → hlasy }
  for (const r of d) {
    if (isAggregate(r.C01)) continue;
    const k = krajOf(r.C01);
    tally[k] ??= {};
    const pairs = [[r.C00, r.C02], [r.C04, r.C05], [r.C07, r.C08], [r.C10, r.C11], [r.C13, r.C14]];
    for (const [party, votes] of pairs) { if (party) tally[k][party] = (tally[k][party] || 0) + (num(votes) || 0); }
  }

  const kraje = {};
  for (const [k, parties] of Object.entries(tally)) {
    const total = votersByKraj[k] || Object.values(parties).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(parties).sort((a, b) => b[1] - a[1]).slice(0, 5);
    kraje[k] = { w: sorted[0][0], t: sorted.map(([party, v]) => [party, Math.round((v / total) * 1000) / 10]) };
  }
  if (!Object.keys(kraje).length) return false;
  fs.mkdirSync(path.join(DIR, "maps"), { recursive: true });
  fs.writeFileSync(path.join(DIR, "maps", `${e.id}.json`), JSON.stringify({ generatedAt: new Date().toISOString(), kraje }));
  return Object.keys(kraje).length;
}

// --- main ---
const { elections } = JSON.parse(fs.readFileSync(ELECTIONS, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const targets = elections.filter((e) => !e.predicted && ["parliamentary", "european"].includes(e.type) && e.date.slice(0, 4) >= "2019" && e.date < today);
let n = 0;
for (const e of targets) {
  const count = await buildElectionMap(e).catch(() => false);
  if (count) { process.stderr.write(`✓ maps/${e.id}.json — ${count} krajov\n`); n++; }
  else process.stderr.write(`— ${e.id} (bez map03d)\n`);
}
process.stderr.write(`\n✓ ${n} máp do ${path.join(DIR, "maps")}\n`);
