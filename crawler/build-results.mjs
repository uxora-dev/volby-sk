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

// Kurátorované mandáty pre roky, kde ich Wikipédia infobox/legenda nemá (2002, 2006).
// Faktické verejné výsledky (súčet = 150). % sa berie z infoboxu, mandáty odtiaľto.
const CURATED_SEATS = {
  '2002': [
    { m: ['hzds', 'demokratické slovensko'], seats: 36 },
    { m: ['sdkú', 'demokratická a kresťanská'], seats: 28 },
    { m: ['smer'], seats: 25 },
    { m: ['smk', 'maďar'], seats: 20 },
    { m: ['kdh', 'kresťanskodemokratické'], seats: 15 },
    { m: ['ano', 'nového občana'], seats: 15 },
    { m: ['kss', 'komunistická'], seats: 11 },
  ],
  '2006': [
    { m: ['smer'], seats: 50 },
    { m: ['sdkú', 'demokratická a kresťanská'], seats: 31 },
    { m: ['sns', 'slovenská národná'], seats: 20 },
    { m: ['smk', 'maďar'], seats: 20 },
    { m: ['hzds', 'demokratické slovensko'], seats: 15 },
    { m: ['kdh', 'kresťanskodemokratické'], seats: 14 },
  ],
};
function curatedSeatsFor(year, party) {
  const list = CURATED_SEATS[year];
  if (!list) return 0;
  const abbr = (party.abbr || '').toLowerCase();
  const name = (party.name || '').toLowerCase();
  for (const e of list) if (e.m.some((k) => abbr.includes(k) || name.includes(k))) return e.seats;
  return 0;
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

  const turnoutM = w.match(/účas[ťt][^\n]{0,30}?([\d]{1,2}[,.]\d+)\s*%/i);
  const parties = [...pctByLabel.entries()]
    .map(([label, pct]) => {
      const seats = seatsByLabel.get(label) ?? 0;
      return { name: nameByLabel.get(label) || label, abbr: label, votes: 0, pct, seats, inParliament: seats > 0 };
    })
    .sort((a, b) => b.pct - a.pct);

  // Roky bez legenda-mandátov (2002/2006): doplň kurátorované; bez mandátov nezobrazuj
  if (!parties.some((p) => p.seats > 0)) {
    if (!CURATED_SEATS[year]) return null; // inak mylný dojem "nikto v parlamente"
    for (const p of parties) {
      p.seats = curatedSeatsFor(year, p);
      p.inParliament = p.seats > 0;
    }
  }

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

// Prezidentské výsledky z Wikipédie — dve kolá kandidátov (šablóny bar percent,
// oddelené riadkom "ostatní"; 1. kolo = pred ním, 2. kolo = za ním).
async function fetchPresidentialWiki(election) {
  if (election.type !== "presidential") return null;
  const year = election.date.slice(0, 4);
  const title = `Voľba prezidenta Slovenskej republiky v roku ${year}`;
  const api = `https://sk.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&section=0`;
  const w = (await getJson(api))?.parse?.wikitext;
  if (!w) return null;

  const entries = [];
  for (const m of w.matchAll(/\{\{bar percent\|(.+?)\}\}/g)) {
    const block = m[1];
    const linkM = block.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    const rawName = linkM ? (linkM[2] || linkM[1]) : block.split("|")[0];
    const name = rawName.replace(/'''/g, "").trim();
    const pctM = block.match(/([\d]+[,.]\d+)\s*%/);
    if (!pctM) continue;
    const ostatni = /^ostatn/i.test(name) || (!linkM && /ostatn/i.test(block));
    entries.push({ name, pct: parseFloat(pctM[1].replace(",", ".")), ostatni });
  }
  if (!entries.length) return null;

  const oi = entries.findIndex((e) => e.ostatni);
  const round1 = (oi >= 0 ? entries.slice(0, oi) : entries.filter((e) => !e.ostatni));
  const rest = oi >= 0 ? entries.slice(oi + 1).filter((e) => !e.ostatni) : [];
  const round2 = rest.length ? rest : null;
  if (!round1.length) return null;

  const turnouts = [...w.matchAll(/účas[ťt][^\n]{0,30}?([\d]{1,2}[,.]\d+)\s*%/gi)].map((m) => parseFloat(m[1].replace(",", ".")));
  const rounds = [{ round: 1, turnout: turnouts[0] ?? null, candidates: round1.map((e) => ({ name: e.name, pct: e.pct })) }];
  if (round2) rounds.push({ round: 2, turnout: turnouts[1] ?? null, candidates: round2.map((e) => ({ name: e.name, pct: e.pct })) });

  const decisive = [...(round2 || round1)].sort((a, b) => b.pct - a.pct)[0];
  return {
    id: election.id, type: "presidential", date: election.date,
    turnout: { pct: (round2 ? turnouts[1] : turnouts[0]) ?? null, eligible: null, voted: null },
    parties: [], rounds,
    winner: { name: decisive.name, abbr: decisive.name, pct: decisive.pct },
    source: `https://sk.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    sourceLabel: "Wikipédia", generatedAt: new Date().toISOString(),
  };
}

// Referendá — z Wikipédie: účasť, platnosť (kvórum 50 %), podiel ÁNO. Téma („o čo šlo")
// je stručný faktický súhrn (referendá mali 1 – 6 otázok rôznych formátov).
const REFERENDUM_TOPICS = {
  '2000': 'Predčasné parlamentné voľby (skrátenie volebného obdobia NR SR)',
  '2003': 'Vstup Slovenska do Európskej únie',
  '2004': 'Predčasné parlamentné voľby',
  '2010': 'Balík 6 otázok (napr. zrušenie koncesionárskych poplatkov, zníženie počtu poslancov, obmedzenie imunity)',
  '2015': 'Ochrana rodiny – 3 otázky (manželstvo muža a ženy, adopcie, sexuálna výchova detí)',
  '2023': 'Umožnenie predčasných volieb skrátením volebného obdobia',
  '2026': 'Obnovenie Úradu špeciálnej prokuratúry a NAKA (2 otázky)',
};

async function fetchReferendumWiki(election) {
  if (election.type !== 'referendum') return null;
  const year = election.date.slice(0, 4);
  const title = `Referendum na Slovensku v roku ${year}`;
  const api = `https://sk.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&section=0`;
  const w = (await getJson(api))?.parse?.wikitext;
  if (!w) return null;

  const param = (name) => {
    const m = w.match(new RegExp('\\|\\s*' + name + '\\s*=\\s*([^\\n]+)'));
    return m ? m[1].trim() : null;
  };
  // Účasť z úvodu článku (spoľahlivé pre všetky roky), fallback na infobox.
  const exApi = `https://sk.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(title)}&format=json&formatversion=2`;
  const ex = (await getJson(exApi))?.query?.pages?.[0]?.extract || '';
  const tmEx = ex.match(/účas[ťt]\s*bola\s*([\d]{1,2}[,.]\d+)\s*%/i);
  const tmIb = (param('účasť') || '').match(/([\d]{1,2}[,.]\d+)\s*%/);
  const turnout = tmEx ? parseFloat(tmEx[1].replace(',', '.')) : tmIb ? parseFloat(tmIb[1].replace(',', '.')) : null;
  const vysledok = (param('výsledok') || '').replace(/\[\[([^\]|]*\|)?([^\]]+)\]\]/g, '$2').trim();
  // Platnosť = kvórum účasti 50 %; ak účasť neznáma, z textu úvodu.
  const valid = turnout != null ? turnout >= 50 : /\bplatné\b/i.test(ex) && !/neplatné/i.test(ex);
  if (turnout == null && !/platné|neplatné/i.test(ex)) return null; // nevieme určiť → nezobraz
  const qCount = parseInt(param('počet kandidátov') || '1', 10) || 1;
  const yesM = w.match(/ÁNO[^\d{]*\{\{[^|]*\|([\d.,]+)/i) || w.match(/ÁNO[^\d]*([\d.,]+)/i);
  const yesPct = yesM ? parseFloat(yesM[1].replace(',', '.')) : null;

  return {
    id: election.id, type: 'referendum', date: election.date,
    turnout: { pct: turnout, eligible: null, voted: null },
    parties: [],
    referendum: {
      topic: REFERENDUM_TOPICS[year] || null,
      questionCount: qCount,
      valid,
      yesPct: qCount === 1 ? yesPct : null,
      resultText: vysledok || (valid ? 'Referendum platné' : 'Referendum neplatné pre nízku účasť (kvórum 50 %)'),
    },
    winner: { name: valid ? 'Platné' : 'Neplatné', abbr: valid ? 'Platné' : 'Neplatné', pct: turnout ?? 0 },
    source: `https://sk.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    sourceLabel: 'Wikipédia', generatedAt: new Date().toISOString(),
  };
}

// --- main ---
const { elections } = JSON.parse(fs.readFileSync(ELECTIONS, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const RESULT_TYPES = new Set(["parliamentary", "european", "presidential", "referendum"]);
const past = elections.filter((e) => !e.predicted && e.date < today && RESULT_TYPES.has(e.type));

fs.mkdirSync(DIR, { recursive: true });
const generated = [];
for (const e of past) {
  process.stderr.write(`# ${e.id} ... `);
  let res = await fetchResult(e).catch(() => null);
  if (!res) res = await fetchResultWiki(e).catch(() => null); // parlamentné → Wikipédia
  if (!res) res = await fetchPresidentialWiki(e).catch(() => null); // prezidentské → Wikipédia
  if (!res) res = await fetchReferendumWiki(e).catch(() => null); // referendum → Wikipédia
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
