import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

import { NotificationsService } from './core/services/notifications.service';

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
}
