import { Pipe, PipeTransform } from '@angular/core';

const MS_DAY = 86_400_000;

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / MS_DAY);
}

// Slovenská pluralizácia: [1, 2-4, 5+]
function skPlural(n: number, forms: [string, string, string]): string {
  if (n === 1) return forms[0];
  if (n >= 2 && n <= 4) return forms[1];
  return forms[2];
}

/** Relatívny čas po slovensky s jednotkami: "o 3 dni", "o 5 mesiacov", "pred 2 rokmi". */
@Pipe({ name: 'relativeSk' })
export class RelativeSkPipe implements PipeTransform {
  transform(date: string): string {
    const days = daysUntil(date);
    if (days === 0) return 'dnes';
    if (days === 1) return 'zajtra';
    if (days === -1) return 'včera';

    const future = days > 0;
    const abs = Math.abs(days);
    let n: number;
    let forms: [string, string, string];
    if (abs < 45) {
      n = abs;
      forms = future ? ['deň', 'dni', 'dní'] : ['dňom', 'dňami', 'dňami'];
    } else if (abs < 345) {
      n = Math.max(1, Math.round(abs / 30));
      forms = future ? ['mesiac', 'mesiace', 'mesiacov'] : ['mesiacom', 'mesiacmi', 'mesiacmi'];
    } else {
      n = Math.round(abs / 365);
      forms = future ? ['rok', 'roky', 'rokov'] : ['rokom', 'rokmi', 'rokmi'];
    }
    return `${future ? 'o' : 'pred'} ${n} ${skPlural(n, forms)}`;
  }
}

/** ISO dátum -> "24. 10. 2026". */
@Pipe({ name: 'skDate' })
export class SkDatePipe implements PipeTransform {
  transform(date: string): string {
    const [y, m, d] = date.split('-');
    return `${+d}. ${+m}. ${y}`;
  }
}
