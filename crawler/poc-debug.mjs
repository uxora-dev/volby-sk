// PoC crawler: objaví a naparsuje vyhlásené voľby/referendá zo Zbierky zákonov (Slov-lex).
// Overuje: discovery cez ročný register -> filter názvov -> detail -> typ + deň konania.
// Bez závislostí, len Node 18+ fetch + regex.

const UA = "Mozilla/5.0 (VolbySK-PoC; research; kontakt: jur.vanko@gmail.com)";
const MONTHS = {
  "januára": 1, "februára": 2, "marca": 3, "apríla": 4, "mája": 5, "júna": 6,
  "júla": 7, "augusta": 8, "septembra": 9, "októbra": 10, "novembra": 11, "decembra": 12,
};

const stripTags = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

async function get(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}

// Klasifikácia typu voľby z názvu predpisu
function classify(title) {
  const t = title.toLowerCase();
  if (t.includes("referend")) return { type: "referendum", scope: "national" };
  if (t.includes("národnej rady slovenskej republiky") && t.includes("volieb do národnej rady"))
    return { type: "parliamentary", scope: "national" };
  if (t.includes("volieb do národnej rady")) return { type: "parliamentary", scope: "national" };
  if (t.includes("prezident")) return { type: "presidential", scope: "national" };
  if (t.includes("európskeho parlamentu")) return { type: "european", scope: "national" };
  if (t.includes("samosprávnych krajov")) return { type: "vuc", scope: "regional" };
  if (t.includes("samosprávy obcí")) return { type: "municipal", scope: "municipal" };
  return { type: "unknown", scope: "unknown" };
}

// Je to vyhlásenie volieb/referenda? Voľby vyhlasuje predseda NR SR, referendum prezident.
function isElectionAnnouncement(title) {
  const t = title.toLowerCase();
  const isDecision = /rozhodnutie (predsedu národnej rady|prezident)/.test(t);
  const isAnnounce = /o vyhlásení (volieb|referenda|nových volieb)/.test(t);
  return isDecision && isAnnounce;
}

// Novela — mení už vyhlásené voľby (napr. posun termínu), nie nové voľby
function isAmendment(title) {
  return /ktorým sa mení/i.test(title);
}

// Deň konania: kotvíme na deň v týždni (nie je preložený medzerami), dátum je čistý.
function extractElectionDay(text) {
  const re = /(?:sobotu|nedeľu|piatok)\s+(\d{1,2})\.\s*(januára|februára|marca|apríla|mája|júna|júla|augusta|septembra|októbra|novembra|decembra)\s*(\d{4})/i;
  const m = text.match(re);
  if (!m) return null;
  const day = String(m[1]).padStart(2, "0");
  const month = String(MONTHS[m[2].toLowerCase()]).padStart(2, "0");
  return `${m[3]}-${month}-${day}`;
}

async function crawlYear(year) {
  const indexUrl = `https://static.slov-lex.sk/static/SK/ZZ/${year}/`;
  const html = await get(indexUrl);
  // Register: <td>262/2025&nbsp;Z.&nbsp;z.</td><td><a href="262/">Názov...</a></td>
  const rowRe = /<td>\s*(\d+)\/(\d{4})&nbsp;Z\.&nbsp;z\.\s*<\/td>\s*<td>\s*<a[^>]*href="(\d+)\/"[^>]*>(.*?)<\/a>/gis;
  const candidates = [];
  for (const m of html.matchAll(rowRe)) {
    const [, num, yr, , rawTitle] = m;
    const title = stripTags(rawTitle);
    if (isElectionAnnouncement(title)) candidates.push({ num, year: yr, title });
  }

  const results = [];
  for (const c of candidates) {
    // Detail predpisu (statická verzia) — skúsime nájsť html súbor v priečinku predpisu
    const detailIndex = await get(`${indexUrl}${c.num}/`).catch(() => "");
    const fileMatch = detailIndex.match(/href="(\d{8}\.html)"/);
    const detailUrl = fileMatch
      ? `${indexUrl}${c.num}/${fileMatch[1]}`
      : null;
    let electionDay = null, cls = classify(c.title);
    if (detailUrl) {
      const dt = await get(detailUrl).catch(() => "");
      electionDay = extractElectionDay(stripTags(dt));
    }
    results.push({
      source: "slov-lex",
      ref: `${c.num}/${c.year} Z. z.`,
      title: c.title.slice(0, 90),
      type: cls.type,
      scope: cls.scope,
      electionDay,
      amendment: isAmendment(c.title),
      detailUrl,
    });
  }
  return results;
}

const years = process.argv.slice(2).length ? process.argv.slice(2) : ["2023", "2024", "2025", "2026"];
const all = [];
for (const y of years) {
  process.stderr.write(`\n# Rok ${y} ... `);
  try {
    const r = await crawlYear(y);
    process.stderr.write(`nájdené ${r.length} vyhlásení`);
    all.push(...r);
  } catch (e) {
    process.stderr.write(`CHYBA: ${e.message}`);
  }
}
process.stderr.write("\n\n");
console.log(JSON.stringify(all, null, 2));
