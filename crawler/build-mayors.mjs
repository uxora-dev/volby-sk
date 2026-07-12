// Generuje mayors.json: pre každé komunálne voľby obec id (z datasetu) -> zvolený starosta/primátor.
// Zdroje: ŠÚSR OSO exporty (faktické verejné údaje). 2022 = CSV (tab05f), 2018 = XLSX (tab05).
// Staršie riadne voľby (2014, 2010, 2006, 2002) nemajú v tomto formáte dostupný export → medzery.
// Spúšťa sa jednorazovo / po každých komunálnych voľbách (nie v daily CI).
//
// Použitie: node build-mayors.mjs [--out ../src/assets/data/mayors.json]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const UA = 'Mozilla/5.0 (VolbySK mayors; kontakt: jur.vanko@gmail.com)';
const here = path.dirname(new URL(import.meta.url).pathname);
const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : path.join(here, '../src/assets/data/mayors.json');

// zdroje zvolených starostov podľa volieb (election id musí sedieť s elections.json)
const SOURCES = [
  { election: 'municipal-2018-11-10', kind: 'xlsx', url: 'https://volby.statistics.sk/oso/oso2018/files/OSO_2018_xlsx.zip', member: 'tab05' },
  { election: 'municipal-2022-10-29', kind: 'csv', url: 'https://volby.statistics.sk/oso/oso2022/files/OSO2022_SK_csv.zip' },
];

async function download(url, tmp) {
  const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  const zip = path.join(tmp, 'src.zip');
  fs.writeFileSync(zip, buf);
  execFileSync('unzip', ['-o', '-q', zip, '-d', tmp]);
}

// --- minimálny XLSX čítač (bez závislostí): unzip .xlsx → sharedStrings + hárok → riadky buniek ---
const xmlDecode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const colIdx = (ref) => { const m = ref.match(/^([A-Z]+)/); let n = 0; for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };
function readXlsx(file) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-'));
  execFileSync('unzip', ['-o', '-q', file, '-d', tmp]);
  const ssPath = path.join(tmp, 'xl', 'sharedStrings.xml');
  const shared = [];
  if (fs.existsSync(ssPath)) for (const m of fs.readFileSync(ssPath, 'utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(xmlDecode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')));
  const wf = path.join(tmp, 'xl', 'worksheets');
  const sheet = fs.readFileSync(path.join(wf, fs.readdirSync(wf).find((f) => f.endsWith('.xml'))), 'utf8');
  const rows = [];
  for (const rm of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1] || '', inner = cm[2] || '';
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
      const t = (attrs.match(/t="([^"]+)"/) || [])[1];
      const im = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
      const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
      const val = im ? xmlDecode(im[1]) : vm ? (t === 's' ? shared[Number(vm[1])] ?? '' : vm[1]) : '';
      cells[ref ? colIdx(ref) : cells.length] = val;
    }
    rows.push(cells);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return rows;
}

// zvolení starostovia z XLSX tab05 (obec + zvolený kandidát v jednom hárku)
function electedFromXlsx(tmp, member) {
  const file = fs.readdirSync(tmp).find((f) => f.includes(member) && f.endsWith('.xlsx'));
  const rows = readXlsx(path.join(tmp, file));
  const hi = rows.findIndex((r) => r.includes('Kód obce'));
  const H = rows[hi];
  const ci = (n) => H.findIndex((c) => c === n);
  const [cOb, cOk, cMeno, cPri, cKand] = [ci('Názov obce'), ci('Názov okresu'), ci('Meno'), ci('Priezvisko'), ci('Kandidát')];
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    if (!(r[cKand] || '').toLowerCase().includes('zvolen')) continue;
    const mayor = `${r[cMeno] || ''} ${r[cPri] || ''}`.trim();
    if (r[cOb] && mayor) out.push({ obec: r[cOb], district: r[cOk], mayor });
  }
  return out;
}

// zvolení starostovia z CSV (tab0dd obec->názov/okres, tab05f zvolený PC_HL, tab0ad meno)
function electedFromCsv(tmp) {
  const csv = (name) => {
    const file = fs.readdirSync(tmp).find((f) => f.includes(name));
    const lines = fs.readFileSync(path.join(tmp, file), 'utf8').split('\n').filter(Boolean);
    return { header: lines[0].split('|'), rows: lines.slice(1).map((l) => l.split('|')) };
  };
  const col = (h, n) => h.indexOf(n);
  const dd = csv('tab0dd');
  const [cOb, cNob, cNok] = [col(dd.header, 'OBEC'), col(dd.header, 'NOBEC'), col(dd.header, 'NOKRES')];
  const obec = new Map();
  for (const r of dd.rows) if (r[cOb]) obec.set(r[cOb], { name: r[cNob], district: r[cNok] });
  const f = csv('tab05f');
  const [fOb, fPc, fKand] = [col(f.header, 'OBEC'), col(f.header, 'PC_HL'), col(f.header, 'KANDIDAT')];
  const electedPc = new Map();
  for (const r of f.rows) if (r[fKand] === '1') electedPc.set(r[fOb], r[fPc]);
  const ad = csv('tab0ad');
  const [aOb, aPc, aMeno, aPri] = [col(ad.header, 'OBEC'), col(ad.header, 'PC_HL'), col(ad.header, 'MENO'), col(ad.header, 'PRIEZVISKO')];
  const nameByKey = new Map();
  for (const r of ad.rows) nameByKey.set(`${r[aOb]}|${r[aPc]}`, `${r[aMeno]} ${r[aPri]}`.trim());
  const out = [];
  for (const [code, pc] of electedPc) {
    const info = obec.get(code), nm = nameByKey.get(`${code}|${pc}`);
    if (info && nm) out.push({ obec: info.name, district: info.district, mayor: nm });
  }
  return out;
}

// --- spárovanie s datasetom obcí (podľa názvu, disambiguácia okresom) ---
const dataset = JSON.parse(fs.readFileSync(path.join(here, '../src/assets/data/municipalities.json'), 'utf8')).municipalities;
const normName = (s) => (s || '').toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();
const normDist = (s) => (s || '').toLowerCase().replace(/^okres\s+/, '').replace(/\s+/g, ' ').trim();
const byName = new Map();
for (const m of dataset) { const k = normName(m.name); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(m); }

function matchToIds(elected) {
  const mayors = {};
  let matched = 0, unmatched = 0, ambiguous = 0;
  for (const e of elected) {
    const hits = byName.get(normName(e.obec));
    if (!hits) { unmatched++; continue; }
    let target = hits[0];
    if (hits.length > 1) {
      const byDist = hits.find((h) => normDist(h.district) === normDist(e.district));
      if (byDist) target = byDist; else { ambiguous++; continue; } // radšej vynechať než zle
    }
    mayors[target.id] = e.mayor;
    matched++;
  }
  return { mayors, matched, unmatched, ambiguous };
}

// --- main ---
const byElection = {};
for (const src of SOURCES) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsk-oso-'));
  process.stderr.write(`# ${src.election}: sťahujem ${src.kind.toUpperCase()} ... `);
  await download(src.url, tmp);
  const elected = src.kind === 'xlsx' ? electedFromXlsx(tmp, src.member) : electedFromCsv(tmp);
  const { mayors, matched, unmatched, ambiguous } = matchToIds(elected);
  byElection[src.election] = mayors;
  process.stderr.write(`✓ ${matched}/${elected.length} spárovaných (nespár. ${unmatched}, viacznač. ${ambiguous})\n`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), byElection }));
process.stderr.write(`✓ ${Object.keys(byElection).length} volieb → ${OUT}\n`);
