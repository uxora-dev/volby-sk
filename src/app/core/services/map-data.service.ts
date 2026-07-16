import { Injectable, Signal, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

import { RegionPaths, RegionMapData } from '../models/region-map';
import { environment } from '../../../environments/environment';

const BUNDLED = 'assets/data';
const BASE = environment.electionsUrl
  ? environment.electionsUrl.replace(/\/elections\.json$/, '')
  : BUNDLED;

/**
 * Dáta pre okresnú mapu — predpočítané SVG cesty okresov (raz, zdieľané) a
 * per-voľba výsledky (víťaz + top strany za okres). Načítané na požiadanie,
 * s bundled fallbackom (rovnako ako výsledky).
 */
@Injectable({ providedIn: 'root' })
export class MapDataService {
  private readonly http = inject(HttpClient);
  private readonly _paths = signal<RegionPaths | null | undefined>(undefined);
  private pathsRequested = false;
  private readonly cache = new Map<string, ReturnType<typeof signal<RegionMapData | null | undefined>>>();

  private load<T>(url: string) {
    const bundled = this.http.get<T>(`${BUNDLED}/${url}`).pipe(catchError(() => of(null)));
    return BASE === BUNDLED ? bundled : this.http.get<T>(`${BASE}/${url}`).pipe(catchError(() => bundled));
  }

  /** Cesty krajov (undefined = načítava, null = nedostupné, objekt = dáta). */
  paths(): Signal<RegionPaths | null | undefined> {
    if (!this.pathsRequested) {
      this.pathsRequested = true;
      this.load<RegionPaths>('kraje-paths.json').subscribe((p) => this._paths.set(p ?? null));
    }
    return this._paths.asReadonly();
  }

  /** Krajské výsledky voľby (undefined = načítava, null = nie sú, objekt = dáta). */
  mapFor(id: string): Signal<RegionMapData | null | undefined> {
    let sig = this.cache.get(id);
    if (!sig) {
      sig = signal<RegionMapData | null | undefined>(undefined);
      this.cache.set(id, sig);
      this.load<RegionMapData>(`maps/${id}.json`).subscribe((m) => sig!.set(m ?? null));
    }
    return sig;
  }
}
