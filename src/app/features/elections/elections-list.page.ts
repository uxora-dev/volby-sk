import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonLabel, IonIcon,
  IonSegment, IonSegmentButton, IonSpinner, IonRefresher, IonRefresherContent,
  IonNote, IonButton, IonButtons,
} from '@ionic/angular/standalone';

import { ElectionsService, Segment, TypeFilter, YearFilter } from '../../core/services/elections.service';
import { ResultsService } from '../../core/services/results.service';
import { SettingsService } from '../../core/services/settings.service';
import { LocationService } from '../../core/services/location.service';
import { ELECTION_TYPES, TYPE_META, Election } from '../../core/models/election';
import { VUC_LEADERS } from '../../core/models/vuc-leaders';
import { RelativeSkPipe, SkDatePipe } from '../../shared/pipes/election.pipes';

@Component({
  selector: 'app-elections-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonLabel, IonIcon,
    IonSegment, IonSegmentButton, IonSpinner, IonRefresher, IonRefresherContent,
    IonNote, IonButton, IonButtons, RelativeSkPipe, SkDatePipe,
  ],
  templateUrl: './elections-list.page.html',
  styleUrl: './elections-list.page.scss',
})
export class ElectionsListPage {
  protected readonly svc = inject(ElectionsService);
  private readonly results = inject(ResultsService);
  private readonly settings = inject(SettingsService);
  private readonly loc = inject(LocationService);
  protected readonly meta = TYPE_META;
  protected readonly types = ELECTION_TYPES;

  constructor() {
    this.loc.loadMayors();
  }

  /** Víťaz na karte minulých parlamentných/prezidentských (euro necháme bez — #5). */
  protected winner(e: Election): { name: string; pct: number } | null {
    if (e.type !== 'parliamentary' && e.type !== 'presidential') return null;
    const s = this.results.summary(e.id);
    return s ? { name: e.type === 'presidential' ? s.winnerName : s.winnerAbbr, pct: s.winnerPct } : null;
  }

  /** Platnosť + účasť referenda na karte. */
  protected refInfo(e: Election): { valid: boolean; turnout: number | null } | null {
    if (e.type !== 'referendum') return null;
    const s = this.results.summary(e.id);
    return s ? { valid: !!s.valid, turnout: s.turnout } : null;
  }

  /** Personalizovaný lokálny víťaz (župan/starosta) — VÚC podľa výsledkov, komunálne 2022. */
  protected localWinner(e: Election): { role: string; name: string } | null {
    const set = this.settings.settings();
    if (e.type === 'vuc' && set.regionCode) {
      // Zvolený predseda vo vybranom kraji z výsledkov (2017, 2022); fallback na známych županov 2022.
      const z = this.results.summary(e.id)?.regionWinners?.[set.regionCode]
        ?? (e.date === '2022-10-29' ? VUC_LEADERS[set.regionCode] : undefined);
      return z ? { role: 'Váš župan', name: z } : null;
    }
    if (e.type === 'municipal' && e.date === '2022-10-29' && set.municipality) {
      const m = this.loc.mayor(set.municipality.id);
      return m ? { role: 'Váš starosta', name: m } : null;
    }
    return null;
  }

  protected onSegment(value: string | number | undefined): void {
    this.svc.segment.set(value as Segment);
  }

  protected setType(value: TypeFilter): void {
    this.svc.typeFilter.set(value);
  }

  protected setYear(value: YearFilter): void {
    this.svc.yearFilter.set(value);
  }

  protected refresh(ev: CustomEvent): void {
    this.svc.load();
    setTimeout(() => (ev.target as HTMLIonRefresherElement).complete(), 400);
  }
}
