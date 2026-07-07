import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonContent, IonButtons, IonBackButton, IonIcon, IonNote, IonButton,
} from '@ionic/angular/standalone';

import { ElectionsService } from '../../core/services/elections.service';
import { TYPE_META } from '../../core/models/election';
import { RelativeSkPipe, SkDatePipe } from '../../shared/pipes/election.pipes';

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

  /** Naviazané z route parametra :id cez withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected readonly meta = TYPE_META;
  protected readonly election = computed(() => this.svc.all().find((e) => e.id === this.id()));
}
