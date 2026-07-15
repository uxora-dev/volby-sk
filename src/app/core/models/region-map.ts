/** Predpočítané SVG cesty okresov (spoločné pre všetky voľby). */
export interface OkresPath {
  code: string; // kód okresu (join key)
  name: string; // názov okresu
  d: string; // SVG path data
}
export interface OkresPaths {
  viewBox: string;
  okresy: OkresPath[];
}

/** Výsledok v jednom okrese: víťaz + top strany. */
export interface OkresResult {
  w: string; // skratka víťaznej strany
  t: [string, number][]; // top strany [skratka, %]
}
export interface RegionMapData {
  generatedAt?: string;
  okresy: Record<string, OkresResult>; // kód okresu → výsledok
}
