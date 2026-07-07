import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonLabel, IonIcon,
  IonSegment, IonSegmentButton, IonSpinner, IonRefresher, IonRefresherContent,
  IonNote, IonButton, IonButtons,
} from '@ionic/angular/standalone';

import { ElectionsService, Segment, TypeFilter, YearFilter } from '../../core/services/elections.service';
import { ELECTION_TYPES, TYPE_META } from '../../core/models/election';
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
  protected readonly meta = TYPE_META;
  protected readonly types = ELECTION_TYPES;

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
