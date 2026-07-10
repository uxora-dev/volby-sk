import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Preferences } from '@capacitor/preferences';

import { SettingsService } from './settings.service';
import { AppSettings, NATIONAL_TYPES } from '../models/settings';

const APPLIED_KEY = 'volby-sk.fcm-topics';

export type PermissionState = 'unknown' | 'granted' | 'denied' | 'prompt';

/** Odvodí zoznam FCM tém, na ktoré má byť zariadenie prihlásené, z nastavení. */
export function topicsForSettings(s: AppSettings): string[] {
  if (!s.notificationsEnabled) return [];
  const topics: string[] = [];
  for (const t of NATIONAL_TYPES) {
    if (s.national[t]) topics.push(`elections_${t}`);
  }
  if (s.regionalEnabled && s.regionCode) topics.push(`vuc_${s.regionCode}`);
  if (s.municipalEnabled) {
    topics.push('elections_municipal'); // riadne komunálne (celoštátne)
    if (s.municipality) topics.push(`obec_${s.municipality.id}`); // doplňujúce v mojej obci
  }
  return topics;
}

function mapPerm(v: string | undefined): PermissionState {
  if (v === 'granted') return 'granted';
  if (v === 'denied') return 'denied';
  return 'prompt';
}

/**
 * Napája nastavenia na reálne FCM topic subscriptions. Pri každej zmene nastavení
 * (cez signal + effect) zosúladí prihlásené témy s požadovanými. Na webe `subscribeToTopic`
 * neexistuje — zámer sa len zaznamená, aby sa logika dala overiť v prehliadači.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly settings = inject(SettingsService);
  private readonly isNative = Capacitor.isNativePlatform();

  private applied: string[] = [];
  private restored: Promise<void>;
  private running = false;
  private pending = false;

  private readonly _permission = signal<PermissionState>('unknown');
  readonly permission = this._permission.asReadonly();

  /** Témy, na ktoré má byť zariadenie prihlásené podľa aktuálnych nastavení. */
  readonly desiredTopics = computed<string[]>(() => topicsForSettings(this.settings.settings()));

  constructor() {
    this.restored = this.restoreApplied();
    // Reaktívne zosúladenie pri každej zmene nastavení.
    effect(() => {
      this.desiredTopics(); // sleduje zmeny
      void this.reconcile();
    });
  }

  /** Explicitné zapnutie — vyžiada systémové povolenie (na natíve). */
  async enable(): Promise<PermissionState> {
    if (!this.isNative) {
      this._permission.set('prompt');
      return 'prompt';
    }
    const res = await FirebaseMessaging.requestPermissions();
    const state = mapPerm(res.receive);
    this._permission.set(state);
    return state;
  }

  private async restoreApplied(): Promise<void> {
    const { value } = await Preferences.get({ key: APPLIED_KEY });
    if (!value) return;
    try {
      this.applied = JSON.parse(value);
    } catch {
      /* ignoruj poškodený záznam */
    }
  }

  private async reconcile(): Promise<void> {
    await this.restored;
    if (this.running) {
      this.pending = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.pending = false;
        const desired = topicsForSettings(this.settings.settings());
        const appliedSet = new Set(this.applied);
        const desiredSet = new Set(desired);
        const toAdd = desired.filter((t) => !appliedSet.has(t));
        const toRemove = this.applied.filter((t) => !desiredSet.has(t));
        if (!toAdd.length && !toRemove.length) continue;

        if (this.isNative) {
          if (desiredSet.size > 0) await this.ensurePermission();
          for (const topic of toAdd) await FirebaseMessaging.subscribeToTopic({ topic });
          for (const topic of toRemove) await FirebaseMessaging.unsubscribeFromTopic({ topic });
        } else {
          // Web: len zámer (subscribeToTopic nie je podporované v prehliadači).
          console.info('[FCM/web] subscribe:', toAdd, '| unsubscribe:', toRemove);
        }

        this.applied = desired;
        await Preferences.set({ key: APPLIED_KEY, value: JSON.stringify(desired) });
      } while (this.pending);
    } finally {
      this.running = false;
    }
  }

  private async ensurePermission(): Promise<void> {
    const check = await FirebaseMessaging.checkPermissions();
    let state = mapPerm(check.receive);
    if (state === 'prompt') {
      const req = await FirebaseMessaging.requestPermissions();
      state = mapPerm(req.receive);
    }
    this._permission.set(state);
  }
}
