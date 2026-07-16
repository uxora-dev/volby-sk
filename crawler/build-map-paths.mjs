// Generuje kraje-paths.json: predpočítané SVG cesty 8 krajov (okresy zlúčené = dissolve cez
// topojson) z geojson/okresy.geo.json. Geometria krajov sa nemení, tak sa NEspúšťa v daily CI —
// len lokálne pri zmene (vyžaduje devDeps topojson-server/topojson-client). Výstup sa commitne.
//
// Použitie: node build-map-paths.mjs [--dir ../src/assets/data]

import fs from "node:fs";
import path from "node:path";
import { topology } from "topojson-server";
import { merge } from "topojson-client";

const UA = "Mozilla/5.0 (VolbySK maps; kontakt: jur.vanko@gmail.com)";
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const here = path.dirname(new URL(import.meta.url).pathname);
const DIR = opt("--dir", path.join(here, "../src/assets/data"));

const getJson = async (url) => { const r = await fetch(url, { headers: { "User-Agent": UA } }).catch(() => null); return r && r.ok ? r.json().catch(() => null) : null; };
const isAggregate = (code) => /00$/.test(String(code)); // 100/800 agregáty + 900 Cudzina
const krajOf = (okres) => Math.floor(Number(okres) / 100);
const KRAJ_NAMES = {
  1: "Bratislavský kraj", 2: "Trnavský kraj", 3: "Trenčiansky kraj", 4: "Nitriansky kraj",
  5: "Žilinský kraj", 6: "Banskobystrický kraj", 7: "Prešovský kraj", 8: "Košický kraj",
};

const geo = await getJson("https://volby.statistics.sk/nrsr/nrsr2023/geojson/okresy.geo.json");
if (!geo?.features) { process.stderr.write("# okresy.geo.json nedostupné\n"); process.exit(1); }
const features = geo.features.filter((f) => !isAggregate(f.properties.OKRES));

const krajByIndex = features.map((f) => krajOf(f.properties.OKRES)); // poradie == poradie geometrií
const topo = topology({ o: { type: "GeometryCollection", geometries: features.map((f) => ({ type: f.geometry.type, coordinates: f.geometry.coordinates })) } });
const geoms = topo.objects.o.geometries;
const kraje = [];
for (let k = 1; k <= 8; k++) {
  const gs = geoms.filter((_, i) => krajByIndex[i] === k);
  if (gs.length) kraje.push({ code: String(k), name: KRAJ_NAMES[k], geom: merge(topo, gs) });
}

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
process.stderr.write(`✓ kraje-paths.json — ${out.length} krajov, viewBox 0 0 ${W} ${H}\n`);
