// Produkčný crawler: zo Zbierky zákonov (Slov-lex) vygeneruje elections.json.
// Discovery cez ročný register -> filter -> detail -> typ + deň konania.
// Zlučuje novely s originálom. Bez závislostí (Node 18+).
//
// Použitie:  node build-elections.mjs [--out elections.json] [--from 2022] [--to 2027]

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
const elections = [...byRef.values()]
  .filter(e => e.electionDay && e.type !== "unknown")
  .map(e => ({
    id: `${e.type}-${e.electionDay}`,
    type: e.type,
    scope: SCOPE[e.type],
    title: `${TYPE_LABEL[e.type]} ${e.electionDay.slice(0, 4)}`,
    date: e.electionDay,
    status: e.electionDay >= today ? "upcoming" : "past",
    legalRef: e.ref,
    sourceUrl: e.sourceUrl,
  }))
  // dedup podľa id (viac obecných rozhodnutí na rovnaký deň = jedna položka)
  .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
  .sort((a, b) => a.date.localeCompare(b.date));

const output = { generatedAt: new Date().toISOString(), count: elections.length, elections };
const fs = await import("node:fs");
fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
process.stderr.write(`\n✓ zapísané ${elections.length} volieb do ${OUT}\n`);
