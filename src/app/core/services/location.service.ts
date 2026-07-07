import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Municipality, Region } from '../models/location';

interface MunicipalitiesFile {
  municipalities: Municipality[];
}

/** Číselník krajov (eager, malý) a obcí (lazy, ~320 kB — načíta sa až pri výbere obce). */
@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly http = inject(HttpClient);

  private readonly _regions = signal<Region[]>([]);
  private readonly _municipalities = signal<Municipality[]>([]);
  private municipalitiesRequested = false;

  readonly regions = this._regions.asReadonly();
  readonly municipalities = this._municipalities.asReadonly();

  constructor() {
    this.http.get<Region[]>('assets/data/regions.json').subscribe((r) => this._regions.set(r ?? []));
  }

  loadMunicipalities(): void {
    if (this.municipalitiesRequested) return;
    this.municipalitiesRequested = true;
    this.http
      .get<MunicipalitiesFile>('assets/data/municipalities.json')
      .subscribe((d) => this._municipalities.set(d?.municipalities ?? []));
  }

  /** Filter obcí podľa kraja + textu, orezané na `limit` položiek. */
  search(region: string | null, query: string, limit = 80): Municipality[] {
    let list = this._municipalities();
    if (region) list = list.filter((m) => m.region === region);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((m) => m.name.toLowerCase().includes(q));
    return list.slice(0, limit);
  }

  regionName(code: string | null): string | null {
    return this._regions().find((r) => r.code === code)?.name ?? null;
  }
}
