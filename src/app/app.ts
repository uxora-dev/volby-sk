import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

import { NotificationsService } from './core/services/notifications.service';
import { SettingsService } from './core/services/settings.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class App {
  // Inštancuje sa hneď pri štarte → spustí reaktívne zosúladenie FCM tém s nastaveniami.
  private readonly notifications = inject(NotificationsService);
  private readonly settings = inject(SettingsService);
  private readonly router = inject(Router);

  constructor() {
    // Onboarding NEblokuje vykreslenie appky — domovská obrazovka sa zobrazí vždy.
    // Sprievodcu otvoríme až po načítaní nastavení a len pri prvom spustení na úvodnej
    // obrazovke (nie pri otvorení cez notifikáciu na detail voľby).
    void this.settings.ready.then(() => {
      const url = this.router.url;
      if (!this.settings.settings().onboarded && (url === '/' || url === '')) {
        void this.router.navigateByUrl('/onboarding');
      }
    });
  }
}
