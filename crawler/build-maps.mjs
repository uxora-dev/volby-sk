// Generuje podklady pre okresnú mapu parlamentných/eurovolieb zo ŠÚSR:
//  - okresy-paths.json: predpočítané SVG cesty okresov (raz, spoločné) z geojson/okresy.geo.json
//  - maps/<id>.json: víťaz + top strany za každý okres (z json/map03d.json)
// Vylučuje agregáty (kódy končiace "00": 100 Bratislava, 800 Košice) a 900 Cudzina.
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

// --- predpočítané SVG cesty okresov (spoločné pre všetky voľby) ---
async function buildPaths() {
  const geo = await getJson("https://volby.statistics.sk/nrsr/nrsr2023/geojson/okresy.geo.json");
  if (!geo?.features) { process.stderr.write("# okresy.geo.json nedostupné\n"); return; }
  const features = geo.features.filter((f) => !isAggregate(f.properties.OKRES));

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const eachCoord = (geom, fn) => {
    const rings = geom.type === "Polygon" ? geom.coordinates : geom.type === "MultiPolygon" ? geom.coordinates.flat() : [];
    for (const ring of rings) for (const c of ring) fn(c);
  };
  for (const f of features) eachCoord(f.geometry, ([x, y]) => { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; });

  const W = 1000, scale = W / (maxX - minX), H = Math.round((maxY - minY) * scale);
  const px = (x) => Math.round((x - minX) * scale);
  const py = (y) => Math.round((maxY - y) * scale); // flip Y
  const ringD = (r) => r.map((c, i) => (i ? "L" : "M") + px(c[0]) + " " + py(c[1])).join(" ") + "Z";
  const geomD = (g) => g.type === "Polygon" ? g.coordinates.map(ringD).join(" ") : g.type === "MultiPolygon" ? g.coordinates.flatMap((poly) => poly.map(ringD)).join(" ") : "";

  const okresy = features.map((f) => ({ code: String(f.properties.OKRES), name: f.properties.OKRES_SK, d: geomD(f.geometry) })).filter((o) => o.d);
  fs.writeFileSync(path.join(DIR, "okresy-paths.json"), JSON.stringify({ viewBox: `0 0 ${W} ${H}`, okresy }));
  process.stderr.write(`✓ okresy-paths.json — ${okresy.length} okresov, viewBox 0 0 ${W} ${H}\n`);
}

// --- víťaz + top strany za okres, per voľba ---
async function buildElectionMap(e) {
  const year = e.date.slice(0, 4);
  const d = await getJson(`https://volby.statistics.sk/${PORTAL[e.type](year)}/json/map03d.json`);
  if (!d || !d.length) return false;
  const okresy = {};
  for (const r of d) {
    if (isAggregate(r.C01)) continue;
    const top = [[r.C00, num(r.C03)], [r.C04, num(r.C06)], [r.C07, num(r.C09)], [r.C10, num(r.C12)], [r.C13, num(r.C15)]]
      .filter(([a, p]) => a && Number.isFinite(p));
    okresy[String(r.C01)] = { w: r.C00, t: top };
  }
  if (!Object.keys(okresy).length) return false;
  fs.mkdirSync(path.join(DIR, "maps"), { recursive: true });
  fs.writeFileSync(path.join(DIR, "maps", `${e.id}.json`), JSON.stringify({ generatedAt: new Date().toISOString(), okresy }));
  return Object.keys(okresy).length;
}

// --- main ---
const { elections } = JSON.parse(fs.readFileSync(ELECTIONS, "utf8"));
const today = new Date().toISOString().slice(0, 10);
await buildPaths();
const targets = elections.filter((e) => !e.predicted && ["parliamentary", "european"].includes(e.type) && e.date.slice(0, 4) >= "2019" && e.date < today);
let n = 0;
for (const e of targets) {
  const count = await buildElectionMap(e).catch(() => false);
  if (count) { process.stderr.write(`✓ maps/${e.id}.json — ${count} okresov\n`); n++; }
  else process.stderr.write(`— ${e.id} (bez map03d)\n`);
}
process.stderr.write(`\n✓ ${n} máp do ${path.join(DIR, "maps")}\n`);
