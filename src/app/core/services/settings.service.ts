import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import { AppSettings, DEFAULT_SETTINGS, NationalType } from '../models/settings';

const KEY = 'volby-sk.settings';

/**
 * Nastavenia notifikácií a lokality. Stav drží service v signáli a perzistuje
 * lokálne cez @capacitor/preferences (na webe localStorage). Žiadny server, žiadne osobné údaje.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly _settings = signal<AppSettings>(DEFAULT_SETTINGS);
  readonly settings = this._settings.asReadonly();

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return;
    try {
      const parsed = JSON.parse(value) as Partial<AppSettings>;
      this._settings.set({
        ...DEFAULT_SETTINGS,
        ...parsed,
        national: { ...DEFAULT_SETTINGS.national, ...parsed.national },
        reminders: { ...DEFAULT_SETTINGS.reminders, ...parsed.reminders },
      });
    } catch {
      /* poškodený záznam ignorujeme, ostávajú defaulty */
    }
  }

  private persist(next: AppSettings): void {
    this._settings.set(next);
    void Preferences.set({ key: KEY, value: JSON.stringify(next) });
  }

  patch(partial: Partial<AppSettings>): void {
    this.persist({ ...this._settings(), ...partial });
  }

  setNational(type: NationalType, on: boolean): void {
    const s = this._settings();
    this.persist({ ...s, national: { ...s.national, [type]: on } });
  }

  setReminder(key: 'd7' | 'd1' | 'd0', on: boolean): void {
    const s = this._settings();
    this.persist({ ...s, reminders: { ...s.reminders, [key]: on } });
  }
}
