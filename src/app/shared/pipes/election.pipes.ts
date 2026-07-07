import { Pipe, PipeTransform } from '@angular/core';

const MS_DAY = 86_400_000;

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / MS_DAY);
}

/** Relatívny čas po slovensky: "dnes", "zajtra", "o 3 dni", "pred 5 dňami". */
@Pipe({ name: 'relativeSk' })
export class RelativeSkPipe implements PipeTransform {
  transform(date: string): string {
    const d = daysUntil(date);
    if (d === 0) return 'dnes';
    if (d === 1) return 'zajtra';
    if (d === -1) return 'včera';
    if (d > 1) return `o ${d} ${d < 5 ? 'dni' : 'dní'}`;
    return `pred ${-d} dňami`;
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
