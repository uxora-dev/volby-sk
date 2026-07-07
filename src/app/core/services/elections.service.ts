import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

import { Election, ElectionsFile, ElectionType } from '../models/election';
import { environment } from '../../../environments/environment';

export type Segment = 'upcoming' | 'past';
export type TypeFilter = ElectionType | 'all';
export type YearFilter = number | 'all';

const BUNDLED = 'assets/data/elections.json';
const todayStr = (): string => new Date().toISOString().slice(0, 10);

/**
 * Jediný zdroj pravdy o voľbách. Stav (dáta, filtre, loading) drží service
 * v signáloch; komponenty len čítajú computed hodnoty a prepínajú filtre.
 */
@Injectable({ providedIn: 'root' })
export class ElectionsService {
  private readonly http = inject(HttpClient);

  private readonly _all = signal<Election[]>([]);
  private readonly _loading = signal(true);
  private readonly _error = signal(false);

  readonly all = this._all.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // Filtre — stav drží service.
  readonly segment = signal<Segment>('upcoming');
  readonly typeFilter = signal<TypeFilter>('all');
  readonly yearFilter = signal<YearFilter>('all');

  /** Roky prítomné v dátach, zostupne (najnovšie/budúce prvé). Rastie automaticky s dátami. */
  readonly availableYears = computed<number[]>(() => {
    const years = new Set<number>();
    for (const e of this._all()) years.add(+e.date.slice(0, 4));
    return [...years].sort((a, b) => b - a);
  });

  /**
   * Viditeľné voľby po filtroch. Keď je zvolený konkrétny rok, zobrazí sa celý ten rok
   * (chronologicky) a segment sa ignoruje; inak platí segment nadchádzajúce/minulé.
   */
  readonly visible = computed<Election[]>(() => {
    const tf = this.typeFilter();
    const yf = this.yearFilter();
    const byType = tf === 'all' ? this._all() : this._all().filter((e) => e.type === tf);

    if (yf !== 'all') {
      return byType
        .filter((e) => +e.date.slice(0, 4) === yf)
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    const today = todayStr();
    const seg = this.segment();
    return byType
      .filter((e) => (seg === 'upcoming' ? e.date >= today : e.date < today))
      .sort((a, b) => (seg === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  });

  readonly upcomingCount = computed(() => this._all().filter((e) => e.date >= todayStr()).length);

  constructor() {
    this.load();
  }

  /** Načíta zoznam volieb: primárne z Pages (environment.electionsUrl), fallback bundled asset. */
  load(): void {
    this._loading.set(true);
    this._error.set(false);
    const url = environment.electionsUrl || BUNDLED;

    this.http
      .get<ElectionsFile>(url)
      .pipe(
        catchError(() =>
          url === BUNDLED
            ? of<ElectionsFile | null>(null)
            : this.http.get<ElectionsFile>(BUNDLED).pipe(catchError(() => of<ElectionsFile | null>(null))),
        ),
      )
      .subscribe((file) => {
        if (file?.elections) {
          this._all.set(file.elections);
        } else {
          this._error.set(true);
        }
        this._loading.set(false);
      });
  }

  byId(id: string): Election | undefined {
    return this._all().find((e) => e.id === id);
  }
}
