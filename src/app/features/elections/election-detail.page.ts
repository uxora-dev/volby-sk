import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonContent, IonButtons, IonBackButton, IonIcon, IonNote, IonButton,
  IonSearchbar,
} from '@ionic/angular/standalone';

import { ElectionsService } from '../../core/services/elections.service';
import { SettingsService } from '../../core/services/settings.service';
import { ResultsService } from '../../core/services/results.service';
import { LocationService } from '../../core/services/location.service';
import { MapDataService } from '../../core/services/map-data.service';
import { RegionMapComponent } from './region-map.component';
import { TYPE_META } from '../../core/models/election';
import { ElectionResult, ResultParty } from '../../core/models/result';
import { partyColor } from '../../core/models/party-brand';
import { RelativeSkPipe, SkDatePipe } from '../../shared/pipes/election.pipes';

const todayStr = () => new Date().toISOString().slice(0, 10);

@Component({
  selector: 'app-election-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, IonHeader, IonToolbar, IonContent, IonButtons, IonBackButton,
    IonIcon, IonNote, IonButton, IonSearchbar, RelativeSkPipe, SkDatePipe, RegionMapComponent,
  ],
  templateUrl: './election-detail.page.html',
  styleUrl: './election-detail.page.scss',
})
export class ElectionDetailPage {
  private readonly svc = inject(ElectionsService);
  protected readonly settings = inject(SettingsService);
  private readonly results = inject(ResultsService);
  private readonly loc = inject(LocationService);
  private readonly mapData = inject(MapDataService);

  constructor() {
    this.loc.loadMayors();
    // Číselník obcí načítaj len pri komunálnych voľbách (kvôli vyhľadávaniu obce v detaile).
    effect(() => {
      if (this.election()?.type === 'municipal') this.loc.loadMunicipalities();
    });
  }

  /** Má voľba okresnú mapu (parlamentné/euro s dátami)? */
  protected readonly hasRegionMap = computed(() => {
    const e = this.election();
    if (!e || (e.type !== 'parliamentary' && e.type !== 'european')) return false;
    return !!this.mapData.mapFor(e.id)();
  });

  /** Zvolený starosta/primátor vo vybranej obci — pri komunálnych voľbách s dátami (2018, 2022). */
  protected readonly obecMayor = computed(() => {
    const e = this.election();
    const m = this.settings.settings().municipality;
    if (!e || e.type !== 'municipal' || !m) return null;
    return this.loc.mayorFor(e.id, m.id);
  });

  /** Naviazané z route parametra :id cez withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected readonly meta = TYPE_META;
  protected readonly election = computed(() => this.svc.all().find((e) => e.id === this.id()));

  /** Koná sa doplňujúca voľba aj v obci, ktorú si používateľ vybral? */
  protected readonly affectsMyObec = computed(() => {
    const e = this.election();
    const m = this.settings.settings().municipality;
    return !!(e?.municipalityIds && m && e.municipalityIds.includes(m.id));
  });

  /** Výsledky minulej voľby (undefined = načítava, null = nie sú, objekt = dáta). */
  protected readonly resultData = computed<ElectionResult | null | undefined>(() => {
    const e = this.election();
    if (!e || e.predicted || e.date >= todayStr() || !this.results.has(e.id)) return null;
    return this.results.get(e.id)();
  });

  protected readonly inParliament = computed(() => this.resultData()?.parties.filter((p) => p.inParliament) ?? []);
  protected readonly outParliament = computed(() => this.resultData()?.parties.filter((p) => !p.inParliament) ?? []);
  protected readonly maxPct = computed(() => this.resultData()?.parties[0]?.pct ?? 100);

  /** Prezidentské kolá zostupne (2. kolo hore — je rozhodujúce). */
  protected readonly roundsDesc = computed(() => {
    const r = this.resultData()?.rounds;
    return r ? [...r].sort((a, b) => b.round - a.round) : [];
  });

  /** VÚC — zvolení predsedovia (župani) za kraje; váš kraj hore a zvýraznený. */
  protected readonly regionResults = computed(() => {
    const regions = this.resultData()?.regions;
    if (!regions) return [];
    const mine = this.settings.settings().regionCode;
    return [...regions].sort((a, b) => (a.code === mine ? -1 : 0) - (b.code === mine ? -1 : 0));
  });

  protected readonly myRegionCode = computed(() => this.settings.settings().regionCode);

  /** Ktorýkoľvek kraj má zoznam kandidátov (novšie ročníky 2017+)? */
  protected readonly hasAnyRegionCandidates = computed(() =>
    !!this.resultData()?.regions?.some((r) => r.candidates?.length),
  );

  /** Rozbalený kraj v akordeóne — undefined = ešte neprepnuté (default = kraj z nastavení). */
  private readonly regionOverride = signal<string | null | undefined>(undefined);
  protected readonly expandedRegion = computed(() => {
    const o = this.regionOverride();
    return o !== undefined ? o : this.myRegionCode();
  });
  protected toggleRegion(code: string): void {
    this.regionOverride.set(this.expandedRegion() === code ? null : code);
  }

  // --- Komunálne: vyhľadávanie obce priamo v detaile (bez preklikávania cez nastavenia) ---

  /** Majú tieto komunálne voľby dáta o zvolených starostoch (2018, 2022)? */
  protected readonly hasMayorData = computed(() => {
    const e = this.election();
    return !!e && e.type === 'municipal' && this.loc.hasMayors(e.id);
  });

  protected readonly obecQuery = signal('');

  /** Obce zodpovedajúce hľadaniu spolu so zvoleným starostom v tejto voľbe. */
  protected readonly obecResults = computed(() => {
    const e = this.election();
    if (!e || !this.loc.hasMayors(e.id)) return [];
    if (this.obecQuery().trim().length < 2) return [];
    return this.loc
      .search(null, this.obecQuery(), 20)
      .map((m) => ({ m, mayor: this.loc.mayorFor(e.id, m.id) }));
  });

  /** Zvolení poslanci zoskupení podľa strany (v poradí podľa mandátov). */
  protected readonly mpsByParty = computed(() => {
    const r = this.resultData();
    if (!r?.mps?.length) return [];
    return r.parties
      .map((p) => ({ party: p, names: r.mps!.filter((d) => d.party === p.abbr).map((d) => d.name) }))
      .filter((g) => g.names.length);
  });

  protected readonly expandedParties = signal<Set<string>>(new Set());
  protected toggleParty(abbr: string): void {
    const s = new Set(this.expandedParties());
    s.has(abbr) ? s.delete(abbr) : s.add(abbr);
    this.expandedParties.set(s);
  }

  /** Brand farba strany (z Wikidata mapy), fallback na farbu typu voľby. */
  protected color(p: ResultParty): string {
    return partyColor(p) ?? 'var(--type)';
  }
}
