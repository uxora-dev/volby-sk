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

const CONTACT = 'Uxora s.r.o., kontakt: juraj.vanko@uxora.sk';

const DOCS: Record<Doc, LegalDoc> = {
  privacy: {
    title: 'Ochrana súkromia',
    effective: 'Účinné od 12. júla 2026',
    intro:
      'Voľby SK je navrhnutá tak, aby fungovala s minimom údajov. Nevyžaduje prihlásenie, nepristupuje k tvojej polohe a neukladá tvoje osobné údaje na našich serveroch.',
    sections: [
      {
        h: 'Prevádzkovateľ',
        p: ['Aplikáciu Voľby SK prevádzkuje Uxora s.r.o. Otázky k súkromiu posielaj na juraj.vanko@uxora.sk.'],
      },
      {
        h: 'Čo spracúvame',
        p: [
          'Nastavenia v aplikácii (vybrané typy volieb, kraj, obec, pripomienky) sú uložené len lokálne na tvojom zariadení. Neposielajú sa nám a neopúšťajú zariadenie.',
          'Push notifikácie (Firebase Cloud Messaging od spoločnosti Google): na doručovanie upozornení sa tvoje zariadenie prihlasuje na „témy" (napr. typ voľby, kraj, obec). Na doručenie Google spracúva technický identifikátor zariadenia a zoznam tém. Nie sú prepojené s tvojím menom ani účtom — aplikácia žiadny účet nemá.',
          'Poznámka: prihlásenie na tému konkrétneho kraja alebo obce technicky vidí poskytovateľ doručovania (Google), nie je však spojené s tvojou identitou. Upozornenia môžeš kedykoľvek vypnúť — vtedy sa z tém odhlásime.',
          'Údaje o voľbách sa sťahujú ako statické súbory z GitHub Pages. Ide o jednosmerné čítanie; neposielame pri tom žiadne tvoje údaje.',
        ],
      },
      {
        h: 'Čo nespracúvame',
        p: [
          'Žiadne prihlásenie ani používateľský účet.',
          'Žiadna poloha ani GPS — kraj a obec si vyberáš ručne.',
          'Žiadna analytika, reklama ani sledovanie správania.',
          'Žiadne meno, e-mail, telefón ani iné priamo identifikujúce údaje.',
        ],
      },
      {
        h: 'Poskytovatelia',
        p: [
          'Google (Firebase Cloud Messaging) — doručovanie push notifikácií; riadi sa zásadami spoločnosti Google.',
          'GitHub (GitHub Pages) — hosting statických údajov o voľbách; pri sťahovaní spracúva bežné technické logy (napr. IP adresu) ako každý webový server.',
        ],
      },
      {
        h: 'Uchovávanie a tvoje práva',
        p: [
          'Nastavenia zostávajú na tvojom zariadení, kým ich nezmeníš alebo aplikáciu neodinštaluješ; odinštalovaním sa vymažú.',
          'Keďže na serveroch nespracúvame tvoje osobné údaje, väčšinu ochrany napĺňaš priamo — vypnutím notifikácií a vymazaním či odinštalovaním aplikácie. S otázkami podľa GDPR sa obráť na juraj.vanko@uxora.sk.',
        ],
      },
      {
        h: 'Deti a zmeny',
        p: [
          'Aplikácia nie je určená deťom a cielene od nich nezbiera údaje.',
          'Tieto zásady môžeme aktualizovať; zmeny zverejníme s novým dátumom účinnosti.',
        ],
      },
    ],
  },
  terms: {
    title: 'Podmienky používania',
    effective: 'Účinné od 12. júla 2026',
    sections: [
      {
        h: 'O aplikácii',
        p: ['Voľby SK poskytuje informatívny prehľad volieb a referend na Slovensku vrátane termínov, histórie a výsledkov.'],
      },
      {
        h: 'Zdroje a presnosť',
        p: [
          'Údaje pochádzajú z verejných zdrojov — Zbierka zákonov (Slov-lex), Štatistický úrad SR (volby.statistics.sk) a Wikipédia.',
          'Snažíme sa o presnosť a aktuálnosť, ale nezaručujeme úplnosť ani bezchybnosť. Aplikácia nie je oficiálnym zdrojom. Záväzné informácie nájdeš na oficiálnych stránkach (minv.sk, volby.statistics.sk, slov-lex.sk).',
        ],
      },
      {
        h: 'Predpokladané termíny',
        p: ['Voľby označené ako „predpokladané" sú odhad z pravidelného volebného cyklu, nie oficiálne vyhlásený termín.'],
      },
      {
        h: 'Zodpovednosť',
        p: ['Aplikácia sa poskytuje „tak ako je". Prevádzkovateľ nezodpovedá za rozhodnutia prijaté na základe zobrazených informácií.'],
      },
      {
        h: 'Prevádzkovateľ',
        p: [CONTACT + '.'],
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
