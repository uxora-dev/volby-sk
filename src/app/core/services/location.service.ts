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
  private readonly _mayors = signal<Record<string, Record<string, string>>>({});
  private municipalitiesRequested = false;
  private mayorsRequested = false;

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

  loadMayors(): void {
    if (this.mayorsRequested) return;
    this.mayorsRequested = true;
    this.http
      .get<{ byElection: Record<string, Record<string, string>> }>('assets/data/mayors.json')
      .subscribe((d) => this._mayors.set(d?.byElection ?? {}));
  }

  /** Zvolený starosta/primátor obce v danej komunálnej voľbe (podľa id voľby), alebo null. */
  mayorFor(electionId: string, obecId: number): string | null {
    return this._mayors()[electionId]?.[obecId] ?? null;
  }

  /** Majú komunálne voľby (podľa id) k dispozícii dáta o zvolených starostoch? */
  hasMayors(electionId: string): boolean {
    return !!this._mayors()[electionId];
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
