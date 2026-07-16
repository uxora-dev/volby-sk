/** Predpočítaná SVG cesta kraja (spoločné pre všetky voľby). */
export interface RegionPath {
  code: string; // kód kraja (1–8, join key)
  name: string; // názov kraja
  d: string; // SVG path data
}
export interface RegionPaths {
  viewBox: string;
  kraje: RegionPath[];
}

/** Výsledok v jednom kraji: víťaz + top strany. */
export interface RegionResult {
  w: string; // skratka víťaznej strany
  t: [string, number][]; // top strany [skratka, %]
}
export interface RegionMapData {
  generatedAt?: string;
  kraje: Record<string, RegionResult>; // kód kraja → výsledok
}
