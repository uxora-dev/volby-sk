// Produkčný crawler: zo Zbierky zákonov (Slov-lex) vygeneruje elections.json.
// Discovery cez ročný register -> filter -> detail -> typ + deň konania.
// Zlučuje novely s originálom. Bez závislostí (Node 18+).
//
// Použitie:  node build-elections.mjs [--out elections.json] [--from 2022] [--to 2027]

import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const UA = "Mozilla/5.0 (VolbySK crawler; kontakt: jur.vanko@gmail.com)";
const MONTHS = {
  "januára": 1, "februára": 2, "marca": 3, "apríla": 4, "mája": 5, "júna": 6,
  "júla": 7, "augusta": 8, "septembra": 9, "októbra": 10, "novembra": 11, "decembra": 12,
};
const TYPE_LABEL = {
  parliamentary: "Voľby do NR SR",
  presidential: "Voľby prezidenta SR",
  european: "Voľby do Európskeho parlamentu",
  referendum: "Referendum",
  vuc: "Voľby do orgánov samosprávnych krajov (župné)",
  municipal: "Voľby do orgánov samosprávy obcí (komunálne)",
};

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const OUT = opt("--out", "elections.json");
const nowYear = new Date().getUTCFullYear();
const FROM = parseInt(opt("--from", String(nowYear - 1)), 10);
const TO = parseInt(opt("--to", String(nowYear + 1)), 10);

const stripTags = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

async function get(url, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.status === 404) throw new Error(`HTTP 404 ${url}`); // rok/predpis neexistuje — neopakuj
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
      return r.text();
    } catch (e) {
      if (attempt >= retries || /HTTP 404/.test(e.message)) throw e;
      await new Promise((res) => setTimeout(res, 400 * (attempt + 1))); // prechodná chyba — skús znova
    }
  }
}

function classify(title) {
  const t = title.toLowerCase();
  if (t.includes("referend")) return "referendum";
  if (t.includes("národnej rady slovenskej republiky") && t.includes("volieb do národnej rady")) return "parliamentary";
  if (t.includes("volieb do národnej rady")) return "parliamentary";
  if (t.includes("prezident")) return "presidential";
  if (t.includes("európskeho parlamentu")) return "european";
  if (t.includes("samosprávnych krajov")) return "vuc";
  if (t.includes("samosprávy obcí")) return "municipal";
  return "unknown";
}
const SCOPE = { parliamentary: "national", presidential: "national", european: "national", referendum: "national", vuc: "regional", municipal: "municipal" };

function isElectionAnnouncement(title) {
  const t = title.toLowerCase();
  // Pozn.: staršie prezidentské = "o vyhlásení voľby prezidenta" (nie "volieb").
  return /rozhodnutie (predsedu národnej rady|prezident)/.test(t) &&
    /o vyhlásení (volieb|voľby|referenda|nových volieb)/.test(t);
}
const isAmendment = (title) => /ktorým sa mení/i.test(title);

// Referencia na pôvodné rozhodnutie v novele: "č. 285/2024 Z. z."
function referencedRef(text) {
  const m = text.match(/č\.\s*(\d+)\/(\d{4})\s*Z\.\s*z\./i);
  return m ? `${m[1]}/${m[2]} Z. z.` : null;
}

function extractElectionDay(text) {
  const re = /(?:sobotu|nedeľu|piatok)\s+(\d{1,2})\.\s*(januára|februára|marca|apríla|mája|júna|júla|augusta|septembra|októbra|novembra|decembra)\s*(\d{4})/i;
  const m = text.match(re);
  if (!m) return null;
  return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
}

async function fetchDetail(indexUrl, num) {
  const detailIndex = await get(`${indexUrl}${num}/`).catch(() => "");
  const fileMatch = detailIndex.match(/href="(\d{8}\.html)"/);
  if (!fileMatch) return { url: null, text: "" };
  const url = `${indexUrl}${num}/${fileMatch[1]}`;
  const text = stripTags(await get(url).catch(() => ""));
  return { url, text };
}

async function crawlYear(year) {
  const indexUrl = `https://static.slov-lex.sk/static/SK/ZZ/${year}/`;
  const html = await get(indexUrl);
  const rowRe = /<td>\s*(\d+)\/(\d{4})&nbsp;Z\.&nbsp;z\.\s*<\/td>\s*<td>\s*<a[^>]*href="(\d+)\/"[^>]*>(.*?)<\/a>/gis;
  const found = [];
  for (const m of html.matchAll(rowRe)) {
    const [, num, yr, , rawTitle] = m;
    const title = stripTags(rawTitle);
    if (!isElectionAnnouncement(title)) continue;
    const { url, text } = await fetchDetail(indexUrl, num);
    found.push({
      ref: `${num}/${yr} Z. z.`, title, type: classify(title),
      amendment: isAmendment(title), electionDay: extractElectionDay(text),
      referencedRef: isAmendment(title) ? referencedRef(text) : null, sourceUrl: url,
    });
  }
  return found;
}

// --- PDF prílohy (zoznam obcí pri komunálnych voľbách) ---
const PDF_RECENT_DAYS = 760; // PDF sťahujeme len pre nedávne/budúce komunálne (efektivita)
const REGULAR_THRESHOLD = 400; // ≥ toľko obcí = riadne (celoštátne) komunálne, inak doplňujúce

function pdfUrlFromSource(sourceUrl) {
  const m = sourceUrl && sourceUrl.match(/\/ZZ\/(\d{4})\/(\d+)\/(\d{8})\.html$/);
  if (!m) return null;
  const [, y, num, date8] = m;
  return `https://static.slov-lex.sk/pdf/SK/ZZ/${y}/${num}/ZZ_${y}_${num}_${date8}.pdf`;
}

async function pdfText(pdfUrl) {
  const res = await fetch(pdfUrl, { headers: { "User-Agent": UA } }).catch(() => null);
  if (!res || !res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = join(tmpdir(), `vsk_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
  try {
    writeFileSync(tmp, buf);
    return execFileSync("pdftotext", ["-layout", tmp, "-"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  } catch {
    return null; // pdftotext nedostupný alebo chyba
  } finally {
    try { unlinkSync(tmp); } catch { /* ignore */ }
  }
}

// Názvy obcí zo "Zoznam obcí" v prílohe č. 1.
function parseObceNames(text) {
  const start = text.indexOf("ZOZNAM OBCÍ");
  if (start < 0) return [];
  const end = text.indexOf("Príloha č. 2", start);
  const seg = text.slice(start, end < 0 ? undefined : end);
  const names = [];
  for (const line of seg.split("\n")) {
    const m = line.match(/^\s*(.+?)\s{2,}(?:poslanec|poslanci|starosta)\b/);
    if (m) names.push(m[1].trim());
  }
  return names;
}

// Index názov -> [id] z datasetu obcí (na spárovanie prílohy s topic obec_<id>).
let _munIndex = null;
function municipalityIndex() {
  if (_munIndex) return _munIndex;
  _munIndex = new Map();
  try {
    const url = new URL("../src/assets/data/municipalities.json", import.meta.url);
    const data = JSON.parse(readFileSync(url, "utf8"));
    for (const m of data.municipalities) {
      const key = m.name.toLowerCase();
      if (!_munIndex.has(key)) _munIndex.set(key, []);
      _munIndex.get(key).push(m.id);
    }
  } catch { /* dataset nenájdený */ }
  return _munIndex;
}

// Spáruje názvy na id; viacznačné (rovnaký názov vo viac obciach) preskočí = žiadne falošné notifikácie.
function matchObecIds(names) {
  const idx = municipalityIndex();
  const ids = [];
  for (const n of names) {
    const hits = idx.get(n.toLowerCase());
    if (hits && hits.length === 1) ids.push(hits[0]);
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

// --- main ---
const raw = [];
for (let y = FROM; y <= TO; y++) {
  process.stderr.write(`# ${y} ... `);
  try { const r = await crawlYear(y); process.stderr.write(`${r.length}\n`); raw.push(...r); }
  catch (e) {
    if (/HTTP 404/.test(e.message)) process.stderr.write(`(rok zatiaľ nevyšiel v Zbierke)\n`);
    else process.stderr.write(`CHYBA ${e.message}\n`);
  }
}

// Zlúč novely: aplikuj nový termín na pôvodné rozhodnutie, novelu zahoď
const byRef = new Map(raw.filter(r => !r.amendment).map(r => [r.ref, r]));
for (const a of raw.filter(r => r.amendment)) {
  const orig = a.referencedRef && byRef.get(a.referencedRef);
  if (orig && a.electionDay) orig.electionDay = a.electionDay; // posun termínu
}

const today = new Date().toISOString().slice(0, 10);
const recentCutoff = new Date(Date.now() - PDF_RECENT_DAYS * 86400000).toISOString().slice(0, 10);
const decisions = [...byRef.values()].filter(e => e.electionDay && e.type !== "unknown");

const baseEntry = (e) => ({
  id: `${e.type}-${e.electionDay}`,
  type: e.type,
  scope: SCOPE[e.type],
  title: `${TYPE_LABEL[e.type]} ${e.electionDay.slice(0, 4)}`,
  date: e.electionDay,
  status: e.electionDay >= today ? "upcoming" : "past",
  predicted: false,
  legalRef: e.ref,
  sourceUrl: e.sourceUrl,
});

// Nemunicipálne: jedna položka na id (typ-dátum)
const seen = new Set();
const nonMunEntries = [];
for (const e of decisions.filter(e => e.type !== "municipal")) {
  const id = `${e.type}-${e.electionDay}`;
  if (seen.has(id)) continue;
  seen.add(id);
  nonMunEntries.push(baseEntry(e));
}

// Municipálne: zoskup podľa dátumu, z prílohy zisti obce a rozlíš riadne/doplňujúce.
// Spojené voľby (obce + kraje jedným rozhodnutím) sú klasifikované ako vuc — zahrň ich aj sem.
const isCombined = (e) => e.type === "vuc" && /samosprávy obcí/i.test(e.title || "");
const munByDate = new Map();
for (const e of decisions.filter((e) => e.type === "municipal" || isCombined(e))) {
  if (!munByDate.has(e.electionDay)) munByDate.set(e.electionDay, []);
  munByDate.get(e.electionDay).push(e);
}
const munEntries = [];
for (const [date, decs] of munByDate) {
  const year = date.slice(0, 4);
  // Vynúť municipal (decs[0] môže byť spojené vuc rozhodnutie → baseEntry by dal vuc id/typ)
  const base = {
    ...baseEntry(decs[0]),
    id: `municipal-${date}`,
    type: "municipal",
    scope: "municipal",
    title: `${TYPE_LABEL.municipal} ${year}`,
    subtype: "unknown",
  };
  if (date >= recentCutoff) {
    process.stderr.write(`  · komunálne ${date}: čítam prílohy (${decs.length}) ... `);
    const names = new Set();
    for (const d of decs) {
      const url = pdfUrlFromSource(d.sourceUrl);
      const txt = url ? await pdfText(url) : null;
      if (txt) for (const n of parseObceNames(txt)) names.add(n);
    }
    const count = names.size;
    process.stderr.write(`${count} obcí\n`);
    if (count >= REGULAR_THRESHOLD) {
      munEntries.push({ ...base, subtype: "regular", title: `Komunálne voľby ${year}` });
    } else if (count > 0) {
      const ids = matchObecIds([...names]);
      munEntries.push({ ...base, subtype: "byelection", title: `Doplňujúce komunálne voľby ${year}`, municipalityCount: count, municipalityIds: ids });
    } else {
      munEntries.push(base); // prílohu sa nepodarilo prečítať
    }
  } else {
    munEntries.push(base);
  }
}

// Kurátorované historické voľby, ktoré nie sú v Zbierke zákonov ako „rozhodnutie o vyhlásení volieb".
// 1993: prvého prezidenta SR (Michal Kováč) zvolila Národná rada SR — priama voľba bola zavedená
// až 1999, preto ju crawler zo Slov-lexu nenájde. Označené `indirect`.
const CURATED = [
  {
    id: "presidential-1993-02-15",
    type: "presidential",
    scope: "national",
    title: "Voľba prezidenta SR 1993",
    date: "1993-02-15",
    status: "past",
    predicted: false,
    indirect: true,
    legalRef: null,
    sourceUrl: "https://sk.wikipedia.org/wiki/Michal_Kov%C3%A1%C4%8D",
  },
];

const curatedNew = CURATED.filter((c) => !nonMunEntries.some((e) => e.id === c.id));
const elections = [...nonMunEntries, ...munEntries, ...curatedNew]
  .sort((a, b) => a.date.localeCompare(b.date));

// --- Predpokladané budúce voľby (z pravidelných cyklov, ~10 rokov dopredu) ---
// Oficiálne dáta kodačía vyhlásia; toto dopĺňa odhad. Referendá/doplňujúce sa nepredpovedajú.
const CYCLE_YEARS = { parliamentary: 4, presidential: 5, european: 5, vuc: 5 };
const HORIZON = new Date().getUTCFullYear() + 10;

function predictFuture(official) {
  // Základ = najnovšia oficiálna voľba daného typu (národné + VÚC nemajú doplňujúce, sú čisté).
  const latest = {};
  for (const e of official) {
    if (CYCLE_YEARS[e.type] && (!latest[e.type] || e.date > latest[e.type])) latest[e.type] = e.date;
  }
  const preds = [];
  const vucDates = [];
  const push = (type, date) => preds.push({
    id: `${type}-${date}`, type, scope: SCOPE[type],
    title: `${TYPE_LABEL[type]} ${date.slice(0, 4)}`, date,
    status: "upcoming", predicted: true, legalRef: null, sourceUrl: null,
  });
  for (const [type, step] of Object.entries(CYCLE_YEARS)) {
    if (!latest[type]) continue;
    let [y, m, d] = latest[type].split("-").map(Number);
    while ((y += step) <= HORIZON) {
      const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      push(type, date);
      if (type === "vuc") vucDates.push(date);
    }
  }
  // Komunálne sú spojené so župnými → rovnaké budúce termíny.
  for (const date of vucDates) push("municipal", date);
  return preds;
}

const known = new Set(elections.map((e) => e.id));
const predicted = predictFuture(elections).filter((p) => !known.has(p.id)); // oficiálne majú prednosť
const all = [...elections, ...predicted].sort((a, b) => a.date.localeCompare(b.date));

const output = {
  generatedAt: new Date().toISOString(),
  count: all.length,
  official: elections.length,
  predicted: predicted.length,
  elections: all,
};
const fs = await import("node:fs");
fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
process.stderr.write(`\n✓ zapísané ${all.length} volieb (${elections.length} oficiálnych + ${predicted.length} predpokladaných) do ${OUT}\n`);
