import { Injectable, Signal, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

import { ElectionResult } from '../models/result';
import { environment } from '../../../environments/environment';

const BUNDLED = 'assets/data/results';
const BASE = environment.electionsUrl
  ? environment.electionsUrl.replace(/\/elections\.json$/, '/results')
  : BUNDLED;

/**
 * Výsledky minulých volieb — načítané na požiadanie (results/<id>.json), s bundled fallbackom.
 * `index.json` hovorí, ktoré voľby výsledky majú, aby appka vedela dopredu (bez zbytočných 404).
 */
@Injectable({ providedIn: 'root' })
export class ResultsService {
  private readonly http = inject(HttpClient);
  private readonly _available = signal<Set<string>>(new Set());
  private readonly cache = new Map<string, ReturnType<typeof signal<ElectionResult | null | undefined>>>();

  constructor() {
    this.http
      .get<{ ids: string[] }>(`${BASE}/index.json`)
      .pipe(catchError(() => of({ ids: [] as string[] })))
      .subscribe((i) => this._available.set(new Set(i.ids)));
  }

  has(id: string): boolean {
    return this._available().has(id);
  }

  /** Signál s výsledkom: undefined = načítava sa, null = nie sú, objekt = dáta. */
  get(id: string): Signal<ElectionResult | null | undefined> {
    let sig = this.cache.get(id);
    if (!sig) {
      sig = signal<ElectionResult | null | undefined>(undefined);
      this.cache.set(id, sig);
      const bundled = this.http.get<ElectionResult>(`${BUNDLED}/${id}.json`).pipe(catchError(() => of(null)));
      const req =
        BASE === BUNDLED
          ? bundled
          : this.http.get<ElectionResult>(`${BASE}/${id}.json`).pipe(catchError(() => bundled));
      req.subscribe((r) => sig!.set(r ?? null));
    }
    return sig;
  }
}
