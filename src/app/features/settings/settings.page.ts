import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton,
  IonList, IonListHeader, IonItem, IonLabel, IonIcon, IonToggle, IonNote, IonSelect,
  IonSelectOption, IonModal, IonSearchbar,
} from '@ionic/angular/standalone';

import { SettingsService } from '../../core/services/settings.service';
import { LocationService } from '../../core/services/location.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { NATIONAL_TYPES, NationalType } from '../../core/models/settings';
import { Municipality } from '../../core/models/location';
import { TYPE_META } from '../../core/models/election';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton,
    IonList, IonListHeader, IonItem, IonLabel, IonIcon, IonToggle, IonNote, IonSelect,
    IonSelectOption, IonModal, IonSearchbar,
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  protected readonly settings = inject(SettingsService);
  protected readonly loc = inject(LocationService);
  protected readonly notifications = inject(NotificationsService);

  protected readonly meta = TYPE_META;
  protected readonly nationalTypes = NATIONAL_TYPES;

  protected readonly s = this.settings.settings;

  // Stav modálneho výberu obce
  protected readonly pickerOpen = signal(false);
  protected readonly query = signal('');
  protected readonly results = computed(() => this.loc.search(this.s().regionCode, this.query()));

  protected openMunicipalityPicker(): void {
    this.loc.loadMunicipalities();
    this.query.set('');
    this.pickerOpen.set(true);
  }

  protected chooseMunicipality(m: Municipality): void {
    this.settings.patch({ municipality: { id: m.id, name: m.name } });
    this.pickerOpen.set(false);
  }

  protected clearMunicipality(): void {
    this.settings.patch({ municipality: null });
  }

  protected async toggleNotifications(enabled: boolean): Promise<void> {
    this.settings.patch({ notificationsEnabled: enabled });
    if (enabled) await this.notifications.enable(); // vyžiada systémové povolenie (na natíve)
  }

  protected regionNameOf(code: string): string {
    return this.loc.regionName(code) ?? '';
  }

  protected label(type: NationalType): string {
    return this.meta[type].label;
  }
}
