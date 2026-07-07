// Change-detection + FCM push cez topics.
// Porovná novo vygenerovaný elections.json s už publikovaným, a pre nové/posunuté
// voľby pošle push na príslušné FCM topics. Bez credentials beží v dry-run režime.
//
// Použitie:
//   node send-notifications.mjs --new public/elections.json --published-url <URL elections.json>
//
// ENV:
//   FIREBASE_SERVICE_ACCOUNT  = JSON service accountu (z Firebase konzoly). Ak chýba -> dry-run.

import crypto from "node:crypto";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const NEW = opt("--new", "public/elections.json");
const PUBLISHED_URL = opt("--published-url", "");

// 8 samosprávnych krajov -> topics. Celoštátne typy -> jeden topic.
const VUC_TOPICS = ["vuc_bratislava","vuc_trnava","vuc_trencin","vuc_nitra","vuc_zilina","vuc_banskabystrica","vuc_presov","vuc_kosice"];
function topicsFor(e) {
  switch (e.type) {
    case "parliamentary": return ["elections_parliamentary"];
    case "presidential":  return ["elections_presidential"];
    case "referendum":    return ["elections_referendum"];
    case "european":      return ["elections_european"];
    case "vuc":           return VUC_TOPICS; // VÚC voľby sú vo všetkých krajoch naraz
    case "municipal":     return []; // TODO Fáza 4: cieliť podľa obcí z prílohy rozhodnutia
    default:              return [];
  }
}

const load = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
async function loadPublished(url) {
  if (!url) return { elections: [] };
  try { const r = await fetch(url); return r.ok ? await r.json() : { elections: [] }; }
  catch { return { elections: [] }; }
}

// --- diff: nová voľba, alebo zmenený dátum ---
const next = load(NEW);
const prev = await loadPublished(PUBLISHED_URL);
const prevById = new Map(prev.elections.map(e => [e.id, e]));
const today = new Date().toISOString().slice(0, 10);

const changes = [];
for (const e of next.elections) {
  if (e.status !== "upcoming") continue;              // notifikuj len budúce
  const old = prevById.get(e.id);
  if (!old) changes.push({ e, kind: "new" });
  else if (old.date !== e.date) changes.push({ e, kind: "moved", from: old.date });
}

if (!changes.length) { console.log("Žiadne nové/zmenené voľby — nič sa neposiela."); process.exit(0); }

// --- FCM v1 (voliteľné, ak sú credentials) ---
const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
const sa = saRaw ? JSON.parse(saRaw) : null;

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claim)}`;
  const sig = crypto.createSign("RSA-SHA256").update(signingInput).end().sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${signingInput}.${sig}` }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function sendToTopic(token, projectId, topic, title, body) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { topic, notification: { title, body } } }),
  });
  if (!res.ok) throw new Error(`send ${topic} ${res.status}: ${await res.text()}`);
}

function msg(c) {
  const daysWord = "voľby";
  if (c.kind === "new") return { title: c.e.title, body: `Termín konania: ${c.e.date}` };
  return { title: `Zmena termínu: ${c.e.title}`, body: `Nový termín: ${c.e.date} (pôvodne ${c.from})` };
}

let token = null;
if (sa) token = await accessToken(sa);

for (const c of changes) {
  const topics = topicsFor(c.e);
  const { title, body } = msg(c);
  for (const t of topics) {
    if (token) { await sendToTopic(token, sa.project_id, t, title, body); console.log(`✓ push -> ${t}: ${title}`); }
    else console.log(`[dry-run] push -> ${t}: ${title} | ${body}`);
  }
  if (!topics.length) console.log(`(preskočené, zatiaľ bez cielenia) ${c.e.id}`);
}
console.log(`\nHotovo: ${changes.length} zmien${sa ? "" : " (DRY-RUN, chýba FIREBASE_SERVICE_ACCOUNT)"}.`);
