import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonContent, IonButtons, IonBackButton, IonIcon, IonNote, IonButton,
} from '@ionic/angular/standalone';

import { ElectionsService } from '../../core/services/elections.service';
import { SettingsService } from '../../core/services/settings.service';
import { ResultsService } from '../../core/services/results.service';
import { TYPE_META } from '../../core/models/election';
import { ElectionResult } from '../../core/models/result';
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

  protected readonly topParties = computed(() => this.resultData()?.parties.slice(0, 8) ?? []);
}
