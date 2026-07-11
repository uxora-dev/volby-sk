// Brand farby politických strán (zdroj: Wikidata, P465 sRGB). Kľúčované na skratku/názov
// z výsledkov ŠÚSR. Ľahko upraviteľné — mení sa tu, bez re-crawlu. Žiadne logá (autorské právo).

interface Brand {
  color: string;
  abbr?: string[]; // presná zhoda skratky (case-insensitive)
  contains?: string[]; // podreťazec v názve strany
}

const BRANDS: Brand[] = [
  { color: '#D82222', contains: ['smer'] },
  { color: '#830F38', contains: ['hlas'] },
  { color: '#00BFFF', abbr: ['ps'], contains: ['progresívne slovensko'] },
  { color: '#42B5C2', abbr: ['oľano a priatelia'], contains: ['oľano', 'obyčajní ľudia'] },
  { color: '#173A70', abbr: ['kdh'], contains: ['kresťanskodemokratické'] },
  { color: '#9BC31C', abbr: ['sas'], contains: ['sloboda a solidarita'] },
  { color: '#253A79', abbr: ['sns'], contains: ['slovenská národná strana'] },
  { color: '#E30512', contains: ['republika'] },
  { color: '#39A72E', contains: ['szövetség', 'maďarská aliancia'] },
  { color: '#50168E', abbr: ['demokrati'] },
  { color: '#104E8B', contains: ['sme rodina'] },
  { color: '#005222', abbr: ['ľsns'], contains: ['kotleba', 'naše slovensko'] },
  { color: '#303E81', contains: ['za ľudí'] },
  { color: '#73C2FB', contains: ['hnutie za demokratické slovensko'] },
  { color: '#FF5300', contains: ['most - híd', 'most-híd', 'most – híd'] },
  { color: '#134B9E', contains: ['demokratická a kresťanská únia'] },
];

export function partyColor(p: { abbr: string; name: string }): string | null {
  const abbr = (p.abbr || '').toLowerCase().trim();
  const name = (p.name || '').toLowerCase();
  for (const b of BRANDS) {
    if (b.abbr?.some((a) => a === abbr)) return b.color;
    if (b.contains?.some((c) => name.includes(c))) return b.color;
  }
  return null;
}
