# Voľby SK 🗳️

Mobilná appka (iOS + Android) so zoznamom **všetkých volieb na Slovensku** — parlamentné,
prezidentské, referendá, eurovoľby, župné (VÚC) a komunálne — s **push notifikáciami**,
ktoré sa dajú v nastaveniach vypínať podľa typu a podľa zvolenej lokality.

## Princíp: maximálne súkromie, nulové náklady na infra

- **Žiadny login, žiadne účty, žiadne GPS.** Kraj/obec si user vyberá ručne a ostáva len na
  zariadení. Server nevie kto je kto.
- **Push cez FCM „topics".** Appka sa prihlási na témy (napr. `elections_referendum`,
  `vuc_kosice`); notifikácie sa posielajú na tému, nie na konkrétneho usera. Žiadne device
  tokeny, žiadne osobné údaje.
- **Zadarmo, bez kreditky.** Dáta aj push beží cez GitHub Actions + GitHub Pages + FCM
  (Spark plán). **Žiadne Firebase Cloud Functions / Blaze.**

> ⚠️ Store poplatky (nie infra): iOS push + App Store = Apple Developer **$99/rok**,
> Google Play = **$25** jednorazovo. Android vývoj a testovanie je zadarmo.

## Architektúra

```
GitHub Actions (cron, zdarma)
  ├─ crawler/build-elections.mjs   -> public/elections.json   -> GitHub Pages (CDN)
  └─ crawler/send-notifications.mjs -> diff vs. publikovaný -> FCM push na topics

Ionic/Angular appka
  ├─ stiahne elections.json z Pages (fallback: bundled src/assets/data/elections.json)
  └─ subscribe/unsubscribe FCM topics podľa togglov v nastaveniach
```

## Dátový zdroj (self-sufficient, bez ručného zadávania)

Termíny sa ťahajú z **Zbierky zákonov (Slov-lex)** — z rozhodnutí o vyhlásení volieb/referenda:
1. ročný register `static.slov-lex.sk/static/SK/ZZ/{rok}/` → tabuľka predpisov,
2. filter názvov `o vyhlásení volieb/referenda` (voľby vyhlasuje predseda NR SR, referendum prezident),
3. z detailu sa vytiahne deň konania (kotva na deň v týždni).

Novely (posun termínu) sa zlúčia s originálom. Detaily a známe medzery (doplňujúce voľby na
úrovni obce = parsovanie prílohy, Fáza 4) sú v kóde `crawler/build-elections.mjs`.

## Crawler — lokálne spustenie

```bash
cd crawler
node build-elections.mjs --from 2022 --to 2027 --out ../public/elections.json
node send-notifications.mjs --new ../public/elections.json   # dry-run bez credentials
```

## Nastavenie push (raz, keď budeš chcieť reálne notifikácie)

1. **Firebase projekt** (zdarma, Spark): [console.firebase.google.com](https://console.firebase.google.com) → *Add project*.
2. Pridaj **Android app** (`sk.volby.app`) → stiahni `google-services.json` do `android/app/`.
   (iOS neskôr: `GoogleService-Info.plist` + APNs kľúč z Apple Developer účtu.)
3. **Service account:** Project settings → *Service accounts* → *Generate new private key* →
   celý JSON vlož ako GitHub secret **`FIREBASE_SERVICE_ACCOUNT`** (Settings → Secrets → Actions).
4. **GitHub Pages:** Settings → Pages → Source = *GitHub Actions*.
5. Workflow `.github/workflows/crawl.yml` sa spustí sám (denne) alebo manuálne (*Run workflow*).

Bez kroku 3 workflow beží v **dry-run** (len vypíše čo by poslal) — dá sa bezpečne testovať.

### Natívny build s push (Android) — Fáza 3

Klientská logika je hotová (`NotificationsService`), reálny push treba otestovať na zariadení:

```bash
npm run build
npx cap add android          # jednorazovo — vytvorí android/ projekt
# skopíruj google-services.json do android/app/
npx cap sync
npx cap run android          # emulátor / zariadenie
```

Do `android/build.gradle` a `android/app/build.gradle` treba pridať **google-services** gradle plugin
(podľa dokumentácie `@capacitor-firebase/messaging`). iOS navyše vyžaduje APNs kľúč z Apple Developer účtu.

**Schéma FCM tém** (na ktoré sa appka prihlasuje podľa nastavení):
`elections_parliamentary` · `elections_presidential` · `elections_referendum` · `elections_european`
· `vuc_<kraj>` (napr. `vuc_kosice`) · `obec_<id>` (dočasné id, zosúladí sa vo Fáze 4).
Odosielaciu stranu (`crawler/send-notifications.mjs`) mapuj na rovnaké témy.

## Appka — vývoj

```bash
npm install
npx ionic serve                 # v prehliadači
npx ionic capacitor add android # natívny Android projekt
npx ionic capacitor run android # na emulátore/zariadení
```

## Stav

- [x] **Fáza 0** — scaffold, crawler (produkčný), CI workflow, počiatočné dáta
- [x] **Fáza 1** — zoznam volieb (segment nadchádzajúce/minulé, filter typov, **filter rokov** odvodený z dát) + detail; číta `elections.json`. **Standalone Angular** (signal/service-based, tenké komponenty). Civic-editorial dizajn (Fraunces + Hanken Grotesk, light+dark).
- [x] **Fáza 2** — nastavenia: master toggle, 4 celoštátne toggly, výber kraja (8 VÚC) + obce (4208 obcí, vyhľadávateľný modal), župné/komunálne toggly, pripomienky. Lokálne cez `@capacitor/preferences`. Číselník generuje `crawler/build-municipalities.mjs`.
- [x] **Fáza 3** — FCM integrácia (`@capacitor-firebase/messaging`): `NotificationsService` reaktívne (signal + effect) zosúlaďuje topic subscriptions s nastaveniami; master toggle žiada systémové povolenie. Web bezpečne loguje zámer (subscribeToTopic nie je na webe). **Reálny push sa testuje až na natíve s Firebase configom** (viď nižšie).
- [ ] **Fáza 4** — parsovanie prílohy rozhodnutí → doplňujúce voľby na úrovni obce
- [ ] **Fáza 5** — onboarding, privacy stránka, ladenie
