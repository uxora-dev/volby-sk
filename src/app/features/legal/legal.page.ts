import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent, IonTitle,
} from '@ionic/angular/standalone';

type Doc = 'privacy' | 'terms';
interface Section {
  h: string;
  p: string[];
}
interface LegalDoc {
  title: string;
  effective: string;
  intro?: string;
  sections: Section[];
}

const OPERATOR =
  'Uxora s.r.o., so sídlom Novomestská 1898/5, 940 02 Nové Zámky, Slovenská republika, IČO: 57345252, DIČ: 2122672145.';

const DOCS: Record<Doc, LegalDoc> = {
  privacy: {
    title: 'Zásady ochrany súkromia',
    effective: 'Účinné od 12. júla 2026',
    intro:
      'Aplikácia Voľby SK je navrhnutá s dôrazom na minimalizáciu údajov. Nevyžaduje registráciu ani prihlásenie, nepristupuje k polohe zariadenia a neukladá osobné údaje na serveroch prevádzkovateľa. Väčšina údajov zostáva výhradne v zariadení používateľa.',
    sections: [
      {
        h: 'Prevádzkovateľ',
        p: [
          'Prevádzkovateľom aplikácie Voľby SK a spracúvania osobných údajov je ' + OPERATOR,
          'Kontakt vo veciach ochrany osobných údajov: juraj.vanko@uxora.sk.',
        ],
      },
      {
        h: 'Aké údaje sa spracúvajú',
        p: [
          'Nastavenia aplikácie. Vybrané typy volieb, kraj, obec a pripomienky sa ukladajú výhradne lokálne v zariadení používateľa prostredníctvom lokálneho úložiska aplikácie (kľúče „volby-sk.settings" a „volby-sk.fcm-topics"). Tieto údaje sa neodosielajú prevádzkovateľovi a neopúšťajú zariadenie.',
          'Push notifikácie. Na doručovanie upozornení sa využíva služba Firebase Cloud Messaging spoločnosti Google. Na tento účel systém zariadenia vytvorí technický identifikátor (registračný token) a aplikácia prihlási zariadenie na „témy" zodpovedajúce zvoleným typom volieb, kraju alebo obci. Spoločnosť Google ako sprostredkovateľ spracúva registračný token a zoznam tém nevyhnutných na doručenie notifikácie. Tieto údaje nie sú prepojené s menom, e-mailovou adresou ani používateľským účtom, keďže aplikácia žiadny účet nevyužíva.',
          'Upozornenie: prihlásenie na tému konkrétneho kraja alebo obce je technicky viditeľné pre poskytovateľa doručovania (Google), nie je však spojené s totožnosťou používateľa. Notifikácie možno kedykoľvek vypnúť; v takom prípade sa zariadenie z tém odhlási.',
          'Sťahovanie údajov o voľbách. Údaje o voľbách sa načítavajú ako statické súbory zo služby GitHub Pages. Ide o jednosmerné čítanie, pri ktorom sa neodosielajú žiadne osobné údaje používateľa. Poskytovateľ hostingu (GitHub) môže pri každej požiadavke spracúvať bežné technické logy, napríklad IP adresu, rovnako ako ktorýkoľvek webový server.',
        ],
      },
      {
        h: 'Aké údaje sa nespracúvajú',
        p: [
          'Aplikácia nepoužíva prihlásenie ani používateľský účet, nepristupuje k polohe (GPS), nevyužíva analytické, reklamné ani sledovacie nástroje a nezhromažďuje meno, e-mailovú adresu, telefónne číslo ani iné priamo identifikujúce údaje.',
        ],
      },
      {
        h: 'Právny základ spracúvania',
        p: [
          'Poskytovanie funkcií aplikácie a lokálne nastavenia sa spracúvajú na základe plnenia funkcií požadovaných používateľom a oprávneného záujmu prevádzkovateľa na poskytovaní funkčnej aplikácie (čl. 6 ods. 1 písm. b) a f) GDPR).',
          'Push notifikácie sa spracúvajú na základe súhlasu používateľa (čl. 6 ods. 1 písm. a) GDPR), ktorý sa udeľuje zapnutím notifikácií a povolením na úrovni systému zariadenia a ktorý možno kedykoľvek odvolať vypnutím notifikácií.',
        ],
      },
      {
        h: 'Sprostredkovatelia a prenos do tretích krajín',
        p: [
          'Na doručovanie notifikácií sa využíva Firebase Cloud Messaging (Google Ireland Limited, resp. Google LLC). V rámci tejto služby môže dochádzať k prenosu údajov do tretích krajín (napríklad USA); poskytovateľ uplatňuje príslušné záruky ochrany, napríklad štandardné zmluvné doložky.',
          'Hosting statických údajov o voľbách zabezpečuje GitHub (GitHub, Inc.). Prevádzkovateľ odporúča oboznámiť sa aj so zásadami ochrany súkromia týchto poskytovateľov.',
        ],
      },
      {
        h: 'Doba uchovávania',
        p: [
          'Lokálne nastavenia zostávajú v zariadení, kým ich používateľ nezmení alebo kým nevymaže dáta aplikácie, prípadne aplikáciu neodinštaluje; odinštalovaním sa vymažú.',
          'Registračný token a prihlásenia na témy spravuje spoločnosť Google po dobu nevyhnutnú na doručovanie notifikácií, respektíve do odhlásenia.',
        ],
      },
      {
        h: 'Práva dotknutej osoby',
        p: [
          'V rozsahu, v akom dochádza k spracúvaniu osobných údajov, má používateľ podľa GDPR právo na prístup k údajom, ich opravu, vymazanie, obmedzenie spracúvania, namietanie proti spracúvaniu, prenosnosť údajov a právo odvolať súhlas.',
          'Vzhľadom na to, že prevádzkovateľ neuchováva osobné údaje na svojich serveroch a nedokáže priradiť údaje ku konkrétnej osobe, väčšinu práv možno naplniť priamo v zariadení — vypnutím notifikácií a vymazaním alebo odinštalovaním aplikácie. Žiadosti a otázky možno smerovať na juraj.vanko@uxora.sk.',
        ],
      },
      {
        h: 'Právo podať sťažnosť',
        p: [
          'Používateľ má právo podať sťažnosť dozornému orgánu, ktorým je Úrad na ochranu osobných údajov Slovenskej republiky, Hraničná 12, 820 07 Bratislava 27 (www.dataprotection.gov.sk).',
        ],
      },
      {
        h: 'Deti a zmeny zásad',
        p: [
          'Aplikácia nie je určená deťom a cielene od nich nezhromažďuje osobné údaje.',
          'Prevádzkovateľ môže tieto zásady aktualizovať; aktuálne znenie bude zverejnené s uvedeným dátumom účinnosti.',
        ],
      },
    ],
  },
  terms: {
    title: 'Podmienky používania',
    effective: 'Účinné od 12. júla 2026',
    sections: [
      {
        h: 'Prevádzkovateľ',
        p: ['Aplikáciu Voľby SK prevádzkuje ' + OPERATOR],
      },
      {
        h: 'O aplikácii',
        p: ['Aplikácia Voľby SK poskytuje informatívny prehľad volieb a referend na Slovensku vrátane termínov, histórie a výsledkov.'],
      },
      {
        h: 'Zdroje a presnosť údajov',
        p: [
          'Údaje pochádzajú z verejných zdrojov — Zbierka zákonov (Slov-lex), Štatistický úrad Slovenskej republiky (volby.statistics.sk) a Wikipédia.',
          'Prevádzkovateľ vynakladá primerané úsilie na presnosť a aktuálnosť údajov, nezaručuje však ich úplnosť ani bezchybnosť. Aplikácia nie je oficiálnym zdrojom informácií. Záväzné informácie sú dostupné na oficiálnych stránkach (minv.sk, volby.statistics.sk, slov-lex.sk).',
        ],
      },
      {
        h: 'Predpokladané termíny',
        p: ['Voľby označené ako „predpokladané" predstavujú odhad vychádzajúci z pravidelného volebného cyklu, nie oficiálne vyhlásený termín.'],
      },
      {
        h: 'Obmedzenie zodpovednosti',
        p: [
          'Aplikácia sa poskytuje „tak ako je". Prevádzkovateľ nezodpovedá za rozhodnutia prijaté na základe informácií zobrazených v aplikácii ani za prípadné škody vzniknuté ich použitím, a to v rozsahu povolenom právnymi predpismi.',
        ],
      },
      {
        h: 'Zmeny podmienok',
        p: ['Prevádzkovateľ môže tieto podmienky aktualizovať; aktuálne znenie bude zverejnené s uvedeným dátumom účinnosti. Kontakt: juraj.vanko@uxora.sk.'],
      },
    ],
  },
};

@Component({
  selector: 'app-legal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent, IonTitle],
  templateUrl: './legal.page.html',
  styleUrl: './legal.page.scss',
})
export class LegalPage {
  /** Naviazané z route data ({ doc }) cez withComponentInputBinding(). */
  readonly doc = input.required<Doc>();
  protected readonly content = computed(() => DOCS[this.doc()]);
}
