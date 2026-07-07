// Vygeneruje číselník krajov a obcí (regions.json, municipalities.json) do app assetov.
// Zdroj: github.com/gunsoft/obce-okresy-kraje-slovenska (8 krajov, 79 okresov, 4208 obcí).
// Pozn.: obec dostane dočasné `id` z tohto zdroja; oficiálny "kód obce" pre FCM topic
// (obec_<kód>) sa zosúladí vo Fáze 4 pri parsovaní príloh rozhodnutí.
//
// Použitie: node build-municipalities.mjs [--dir ../src/assets/data]

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const DIR = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : path.resolve(new URL(".", import.meta.url).pathname, "../src/assets/data");
const BASE = "https://raw.githubusercontent.com/gunsoft/obce-okresy-kraje-slovenska/master/JSON";

// shortcut kraja -> môj kód (zhodný s FCM topic vuc_<code>)
const REGION_CODE = { BL: "bratislava", TA: "trnava", TC: "trencin", NI: "nitra", ZI: "zilina", BC: "banskabystrica", PV: "presov", KI: "kosice" };

const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status} ${u}`); return r.json(); };

const [regionsSrc, districtsSrc, villagesSrc] = await Promise.all([
  get(`${BASE}/regions.json`), get(`${BASE}/districts.json`), get(`${BASE}/villages.json`),
]);

const codeByRegionId = new Map(regionsSrc.map((r) => [r.id, REGION_CODE[r.shortcut]]));
const districtNameById = new Map(districtsSrc.map((d) => [d.id, d.name]));

const regions = regionsSrc
  .map((r) => ({ code: REGION_CODE[r.shortcut], name: r.name, topic: `vuc_${REGION_CODE[r.shortcut]}` }))
  .sort((a, b) => a.name.localeCompare(b.name, "sk"));

const municipalities = villagesSrc
  .map((v) => ({ id: v.id, name: v.fullname, region: codeByRegionId.get(v.region_id), district: districtNameById.get(v.district_id) }))
  .filter((m) => m.region && m.name)
  .sort((a, b) => a.name.localeCompare(b.name, "sk"));

fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(path.join(DIR, "regions.json"), JSON.stringify(regions, null, 2));
fs.writeFileSync(path.join(DIR, "municipalities.json"), JSON.stringify({ generatedAt: new Date().toISOString(), count: municipalities.length, municipalities }));

console.log(`✓ regions.json: ${regions.length} krajov`);
console.log(`✓ municipalities.json: ${municipalities.length} obcí`);
