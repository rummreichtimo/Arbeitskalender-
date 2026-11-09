import type { Ingredient, ItemUnit } from './types';
import { MONTHS, WEEKDAYS } from '../data/labels';

const nf = (d: number) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: d });
const nf0 = nf(0);
const nf1 = nf(1);
const nf2 = nf(2);
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export const fmt0 = (n: number) => nf0.format(n);
export const fmt1 = (n: number) => nf1.format(n);
export const fmtEuro = (n: number) => eur.format(n);
/** Geschätzter Betrag: immer mit ≈ */
export const fmtEst = (n: number) => '≈ ' + eur.format(n);

const FRACTIONS: [number, string][] = [
  [0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, ''],
];

/** Zahl als Bruch für Stück- und Löffelangaben: 1.5 → "1½". */
export function fmtFrac(x: number): string {
  if (x <= 0) return '0';
  if (x >= 10) return nf0.format(Math.round(x));
  let whole = Math.floor(x);
  const rest = x - whole;
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(f[0] - rest) < Math.abs(best[0] - rest)) best = f;
  if (best[0] === 1) {
    whole += 1;
    best = FRACTIONS[0];
  }
  if (whole === 0 && best[1] === '') return '¼';
  return (whole > 0 ? String(whole) : '') + best[1];
}

export function roundQty(x: number): number {
  if (x < 5) return Math.round(x * 10) / 10;
  if (x < 50) return Math.round(x);
  if (x < 200) return Math.round(x / 5) * 5;
  if (x < 1000) return Math.round(x / 10) * 10;
  return Math.round(x / 50) * 50;
}

/** Gramm oder Milliliter lesbar: 1250 g → "1,25 kg". */
export function fmtMass(x: number, unit: 'g' | 'ml'): string {
  const r = roundQty(x);
  if (r >= 1000) return nf2.format(r / 1000) + (unit === 'g' ? ' kg' : ' l');
  return (r < 5 ? nf1.format(r) : nf0.format(r)) + ' ' + unit;
}

export function spoonFactor(ing: Ingredient, u: ItemUnit): number {
  if (u === 'el') return ing.el ?? (ing.unit === 'ml' ? 15 : 10);
  if (u === 'tl') return ing.tl ?? (ing.unit === 'ml' ? 5 : 4);
  return 0.3; // Prise
}

/** Menge einer Rezeptzeile in kanonischer Einheit. */
export function toCanonical(ing: Ingredient, a: number, u?: ItemUnit): number {
  return u ? a * spoonFactor(ing, u) : a;
}

/** Gramm einer kanonischen Menge (für Nährwerte und Illustration). */
export function gramsOf(ing: Ingredient, canonical: number): number {
  return ing.unit === 'stk' ? canonical * (ing.pg ?? 100) : canonical;
}

export interface AmountText {
  amount: string;
  label: string;
  hint?: string;
}

/** Anzeige einer Zutatenmenge wie in einem Kochbuch. */
export function describeAmount(ing: Ingredient, canonical: number, u?: ItemUnit): AmountText {
  if (u) {
    const spoons = canonical / spoonFactor(ing, u);
    if (u === 'prise') {
      const p = Math.max(1, Math.round(spoons));
      return { amount: p === 1 ? '1 Prise' : `${p} Prisen`, label: ing.name };
    }
    return { amount: `${fmtFrac(Math.round(spoons * 4) / 4)} ${u === 'el' ? 'EL' : 'TL'}`, label: ing.name };
  }
  if (ing.unit === 'stk') {
    const pl = ing.pl ?? [ing.name, ing.name];
    const shown = Math.round(canonical * 4) / 4;
    return { amount: fmtFrac(shown), label: shown <= 1 ? pl[0] : pl[1] };
  }
  const res: AmountText = { amount: fmtMass(canonical, ing.unit), label: ing.name };
  if (ing.pg && ing.pl) {
    const count = canonical / ing.pg;
    if (count >= 0.2 && count < 30) {
      const c = Math.round(count * 4) / 4 || 0.25;
      res.hint = `ca. ${fmtFrac(c)} ${c <= 1 ? ing.pl[0] : ing.pl[1]}`;
    }
  }
  return res;
}

/** Kurzform für Einkaufslisten: "650 g", "3 Eier", "1 Knolle". */
export function shortAmount(ing: Ingredient, canonical: number): string {
  if (ing.unit === 'stk') {
    const pl = ing.pl ?? [ing.name, ing.name];
    const n = Math.round(canonical * 4) / 4;
    return `${fmtFrac(n)} ${n <= 1 ? pl[0] : pl[1]}`;
  }
  return fmtMass(canonical, ing.unit);
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
}

// ───── Datum ─────

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Montag der Woche, in der das Datum liegt. */
export function weekStartOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return toISO(x);
}

/** ISO-8601-Kalenderwoche. */
export function isoWeek(iso: string): number {
  const d = fromISO(iso);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4, 12);
  const diff = target.valueOf() - firstThursday.valueOf();
  return 1 + Math.round((diff / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

export function fmtWeekRange(start: string): string {
  const a = fromISO(start);
  const b = fromISO(addDays(start, 6));
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}.–${b.getDate()}. ${MONTHS[b.getMonth()]}`;
  return `${a.getDate()}. ${MONTHS[a.getMonth()].slice(0, 3)}. – ${b.getDate()}. ${MONTHS[b.getMonth()].slice(0, 3)}.`;
}

export function fmtDayLong(iso: string): string {
  const d = fromISO(iso);
  return `${WEEKDAYS[(d.getDay() + 6) % 7]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

export function fmtDateShort(iso: string): string {
  const d = fromISO(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).valueOf() - fromISO(a).valueOf()) / 86400000);
}
