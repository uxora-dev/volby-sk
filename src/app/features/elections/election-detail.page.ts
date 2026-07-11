import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonContent, IonButtons, IonBackButton, IonIcon, IonNote, IonButton,
} from '@ionic/angular/standalone';

import { ElectionsService } from '../../core/services/elections.service';
import { SettingsService } from '../../core/services/settings.service';
import { ResultsService } from '../../core/services/results.service';
import { LocationService } from '../../core/services/location.service';
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
    IonIcon, IonNote, IonButton, RelativeSkPipe, SkDatePipe,
  ],
  templateUrl: './election-detail.page.html',
  styleUrl: './election-detail.page.scss',
})
export class ElectionDetailPage {
  private readonly svc = inject(ElectionsService);
  protected readonly settings = inject(SettingsService);
  private readonly results = inject(ResultsService);
  private readonly loc = inject(LocationService);

  constructor() {
    this.loc.loadMayors();
  }

  /** Zvolený starosta/primátor vo vybranej obci — pri komunálnych voľbách 2022. */
  protected readonly obecMayor = computed(() => {
    const e = this.election();
    const m = this.settings.settings().municipality;
    if (!e || e.type !== 'municipal' || e.date !== '2022-10-29' || !m) return null;
    return this.loc.mayor(m.id);
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

  /** Brand farba strany (z Wikidata mapy), fallback na farbu typu voľby. */
  protected color(p: ResultParty): string {
    return partyColor(p) ?? 'var(--type)';
  }
}
