import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

import { MapDataService } from '../../core/services/map-data.service';
import { partyColor } from '../../core/models/party-brand';

const NEUTRAL = '#8a93a6'; // víťaz bez brand farby (koalície, menšie strany)
const NODATA = 'var(--map-nodata)'; // okres bez dát

@Component({
  selector: 'app-region-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  templateUrl: './region-map.component.html',
  styleUrl: './region-map.component.scss',
})
export class RegionMapComponent {
  private readonly maps = inject(MapDataService);

  /** Id voľby (napr. parliamentary-2023-09-30). */
  readonly electionId = input.required<string>();

  protected readonly regionPaths = this.maps.paths();
  protected readonly data = computed(() => this.maps.mapFor(this.electionId())());

  protected readonly selected = signal<string | null>(null);

  /** Kraje s predpočítanou cestou a farbou víťaza. */
  protected readonly regions = computed(() => {
    const paths = this.regionPaths();
    const d = this.data();
    if (!paths || !d) return [];
    return paths.kraje.map((o) => {
      const res = d.kraje[o.code];
      const fill = res ? partyColor({ abbr: res.w, name: res.w }) ?? NEUTRAL : NODATA;
      return { code: o.code, d: o.d, fill };
    });
  });

  /** Detail vybraného kraja — názov + top strany s farbami. */
  protected readonly selectedInfo = computed(() => {
    const code = this.selected();
    const d = this.data();
    const paths = this.regionPaths();
    if (!code || !d || !paths) return null;
    const res = d.kraje[code];
    if (!res) return null;
    const name = paths.kraje.find((o) => o.code === code)?.name ?? code;
    return {
      name,
      top: res.t.map(([abbr, pct]) => ({ abbr, pct, color: partyColor({ abbr, name: abbr }) ?? NEUTRAL })),
    };
  });

  /** Legenda — víťazné strany a v koľkých krajoch vyhrali. */
  protected readonly legend = computed(() => {
    const d = this.data();
    if (!d) return [];
    const counts = new Map<string, number>();
    for (const o of Object.values(d.kraje)) counts.set(o.w, (counts.get(o.w) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([abbr, count]) => ({ abbr, count, color: partyColor({ abbr, name: abbr }) ?? NEUTRAL }));
  });

  protected select(code: string | null): void {
    this.selected.update((cur) => (cur === code ? null : code));
  }
}
