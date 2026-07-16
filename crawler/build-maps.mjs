// Generuje podklady pre krajskú mapu parlamentných/eurovolieb zo ŠÚSR:
//  - kraje-paths.json: predpočítané SVG cesty 8 krajov (okresy zlúčené = dissolve cez topojson)
//  - maps/<id>.json: víťaz + top strany za každý kraj (agregované z okresných dát map03d)
// Okresy sa zlučujú do krajov podľa kódu (1xx=Bratislavský … 8xx=Košický). Vylúčené agregáty
// (kódy končiace "00": 100 Bratislava, 800 Košice) a 900 Cudzina.
//
// Použitie: node build-maps.mjs [--elections ../src/assets/data/elections.json] [--dir ../src/assets/data]

import fs from "node:fs";
import path from "node:path";
import { topology } from "topojson-server";
import { merge } from "topojson-client";

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
const KRAJ_NAMES = {
  1: "Bratislavský kraj", 2: "Trnavský kraj", 3: "Trenčiansky kraj", 4: "Nitriansky kraj",
  5: "Žilinský kraj", 6: "Banskobystrický kraj", 7: "Prešovský kraj", 8: "Košický kraj",
};

// --- SVG cesty 8 krajov: okresy zlúčené cez topojson (odstráni vnútorné hranice) ---
async function buildPaths() {
  const geo = await getJson("https://volby.statistics.sk/nrsr/nrsr2023/geojson/okresy.geo.json");
  if (!geo?.features) { process.stderr.write("# okresy.geo.json nedostupné\n"); return; }
  const features = geo.features.filter((f) => !isAggregate(f.properties.OKRES));

  const krajByIndex = features.map((f) => krajOf(f.properties.OKRES)); // poradie == poradie geometrií
  const topo = topology({ o: { type: "GeometryCollection", geometries: features.map((f) => ({ type: f.geometry.type, coordinates: f.geometry.coordinates })) } });
  const geoms = topo.objects.o.geometries;
  const kraje = [];
  for (let k = 1; k <= 8; k++) {
    const gs = geoms.filter((_, i) => krajByIndex[i] === k);
    if (!gs.length) continue;
    kraje.push({ code: String(k), name: KRAJ_NAMES[k], geom: merge(topo, gs) });
  }

  // bounds cez zlúčené geometrie
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const eachCoord = (geom, fn) => {
    const rings = geom.type === "Polygon" ? geom.coordinates : geom.type === "MultiPolygon" ? geom.coordinates.flat() : [];
    for (const ring of rings) for (const c of ring) fn(c);
  };
  for (const kr of kraje) eachCoord(kr.geom, ([x, y]) => { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; });

  const W = 1000, scale = W / (maxX - minX), H = Math.round((maxY - minY) * scale);
  const px = (x) => Math.round((x - minX) * scale);
  const py = (y) => Math.round((maxY - y) * scale); // flip Y
  const ringD = (r) => r.map((c, i) => (i ? "L" : "M") + px(c[0]) + " " + py(c[1])).join(" ") + "Z";
  const geomD = (g) => g.type === "Polygon" ? g.coordinates.map(ringD).join(" ") : g.type === "MultiPolygon" ? g.coordinates.flatMap((poly) => poly.map(ringD)).join(" ") : "";

  const out = kraje.map((kr) => ({ code: kr.code, name: kr.name, d: geomD(kr.geom) })).filter((o) => o.d);
  fs.writeFileSync(path.join(DIR, "kraje-paths.json"), JSON.stringify({ viewBox: `0 0 ${W} ${H}`, kraje: out }));
  fs.rmSync(path.join(DIR, "okresy-paths.json"), { force: true }); // stará okresná verzia
  process.stderr.write(`✓ kraje-paths.json — ${out.length} krajov, viewBox 0 0 ${W} ${H}\n`);
}

// --- víťaz + top strany za kraj (agregované z okresných top-5 v map03d) ---
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
await buildPaths();
const targets = elections.filter((e) => !e.predicted && ["parliamentary", "european"].includes(e.type) && e.date.slice(0, 4) >= "2019" && e.date < today);
let n = 0;
for (const e of targets) {
  const count = await buildElectionMap(e).catch(() => false);
  if (count) { process.stderr.write(`✓ maps/${e.id}.json — ${count} krajov\n`); n++; }
  else process.stderr.write(`— ${e.id} (bez map03d)\n`);
}
process.stderr.write(`\n✓ ${n} máp do ${path.join(DIR, "maps")}\n`);
