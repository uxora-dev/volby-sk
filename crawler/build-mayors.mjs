// Generuje mayors.json: obec id (z datasetu) -> zvolený starosta/primátor.
// Zdroj: komunálne voľby 2022, ŠÚSR CSV export (faktické verejné údaje).
// Spúšťa sa jednorazovo / po každých komunálnych voľbách (nie v daily CI).
//
// Použitie: node build-mayors.mjs [--out ../src/assets/data/mayors.json]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const UA = 'Mozilla/5.0 (VolbySK mayors; kontakt: jur.vanko@gmail.com)';
const ZIP = 'https://volby.statistics.sk/oso/oso2022/files/OSO2022_SK_csv.zip';
const here = path.dirname(new URL(import.meta.url).pathname);
const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : path.join(here, '../src/assets/data/mayors.json');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsk-oso-'));
process.stderr.write('# sťahujem ŠÚSR OSO2022 CSV ... ');
const buf = Buffer.from(await (await fetch(ZIP, { headers: { 'User-Agent': UA } })).arrayBuffer());
fs.writeFileSync(path.join(tmp, 'oso.zip'), buf);
execFileSync('unzip', ['-o', '-q', path.join(tmp, 'oso.zip'), '-d', tmp]);
process.stderr.write('OK\n');

const csv = (name) => {
  const file = fs.readdirSync(tmp).find((f) => f.includes(name));
  const lines = fs.readFileSync(path.join(tmp, file), 'utf8').split('\n').filter(Boolean);
  const header = lines[0].split('|');
  return { header, rows: lines.slice(1).map((l) => l.split('|')) };
};
const col = (header, name) => header.indexOf(name);

// tab0dd — obec kód -> názov + okres
const dd = csv('tab0dd');
const [cOb, cNob, cNok] = [col(dd.header, 'OBEC'), col(dd.header, 'NOBEC'), col(dd.header, 'NOKRES')];
const obec = new Map(); // kód -> {name, district}
for (const r of dd.rows) if (r[cOb]) obec.set(r[cOb], { name: r[cNob], district: r[cNok] });

// tab05f — zvolený kandidát (KANDIDAT=1) na obec -> PC_HL
const f = csv('tab05f');
const [fOb, fPc, fKand] = [col(f.header, 'OBEC'), col(f.header, 'PC_HL'), col(f.header, 'KANDIDAT')];
const electedPc = new Map(); // obec kód -> PC_HL zvoleného
for (const r of f.rows) if (r[fKand] === '1') electedPc.set(r[fOb], r[fPc]);

// tab0ad — obec+PC_HL -> meno
const ad = csv('tab0ad');
const [aOb, aPc, aMeno, aPri] = [col(ad.header, 'OBEC'), col(ad.header, 'PC_HL'), col(ad.header, 'MENO'), col(ad.header, 'PRIEZVISKO')];
const nameByKey = new Map(); // "obec|pc" -> "Meno Priezvisko"
for (const r of ad.rows) nameByKey.set(`${r[aOb]}|${r[aPc]}`, `${r[aMeno]} ${r[aPri]}`.trim());

// obec kód -> starosta
const mayorByCode = new Map();
for (const [code, pc] of electedPc) {
  const nm = nameByKey.get(`${code}|${pc}`);
  if (nm) mayorByCode.set(code, nm);
}

// spárovanie s datasetom obcí (podľa názvu, disambiguácia okresom)
const dataset = JSON.parse(fs.readFileSync(path.join(here, '../src/assets/data/municipalities.json'), 'utf8')).municipalities;
const byName = new Map();
for (const m of dataset) {
  const k = m.name.toLowerCase();
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(m);
}
const norm = (s) => (s || '').toLowerCase().replace(/^okres\s+/, '').trim();

const mayors = {};
let matched = 0, ambiguousUnresolved = 0, unmatched = 0;
for (const [code, mayor] of mayorByCode) {
  const info = obec.get(code);
  if (!info) { unmatched++; continue; }
  const hits = byName.get(info.name.toLowerCase());
  if (!hits) { unmatched++; continue; }
  let target = hits[0];
  if (hits.length > 1) {
    const d = norm(info.district);
    const byDist = hits.find((h) => norm(h.district) === d);
    if (byDist) target = byDist;
    else { ambiguousUnresolved++; continue; } // radšej vynechať než priradiť zle
  }
  mayors[target.id] = mayor;
  matched++;
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), election: 'oso2022', count: matched, mayors }));
fs.rmSync(tmp, { recursive: true, force: true });
process.stderr.write(`✓ ${matched} starostov spárovaných (nespárované ${unmatched}, viacznačné vynechané ${ambiguousUnresolved}) do ${OUT}\n`);
