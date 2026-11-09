import type { Constraints } from './recipe';
import type { Equipment, Ingredient, PantryItem, Recipe, WeekPlan, SlotId, ShoppingState } from './types';
import { analyze, priceOf } from './recipe';
import { ING } from '../data/ingredients';
import { CATEGORIES, CATEGORY_LABEL } from '../data/labels';
import { fmtEuro, fmtMass, shortAmount, toISO, addDays } from './format';

export interface ShopLine {
  i: string;
  ing: Ingredient;
  /** benötigt für alle noch nicht gekochten Mahlzeiten */
  need: number;
  /** davon im Vorrat */
  pantry: number;
  /** zu kaufen */
  buy: number;
  packs: number;
  /** gekaufte Menge (Packungen × Packungsgröße bzw. lose Ware) */
  purchase: number;
  cost: number;
  /** Wert der tatsächlich verbrauchten Menge */
  used: number;
  /** Rest nach der Woche aus dem Einkauf */
  leftover: number;
  recipes: string[];
  /** nur als optionale Zutat eingeplant */
  optional: boolean;
  /** lange haltbar (Gewürze, Trockenware): Rest wandert in den Vorrat */
  durable: boolean;
}

export interface ShoppingResult {
  lines: ShopLine[];
  covered: ShopLine[];
  /** geschätzter Betrag an der Kasse */
  total: number;
  /** Wochenkosten: verderbliche Packungen voll, lange haltbare Vorräte anteilig */
  weekCost: number;
  /** Wert der Vorratskäufe, der über die Woche hinaus reicht */
  stockValue: number;
  usedValue: number;
  /** Wert verderblicher Reste, die nach der Woche übrig bleiben */
  wasteValue: number;
}

export interface Ctx {
  constraints: Constraints;
  equipment: Equipment[];
  prices: Record<string, number>;
  recipes: Record<string, Recipe>;
}

export interface MealRef {
  day: number;
  slot: SlotId;
}

/** Mengenbedarf je Zutat für alle Mahlzeiten der Woche, die noch gekocht werden müssen. */
export interface Need {
  need: number;
  recipes: Set<string>;
  required: boolean;
}

export function isDurable(ing: Ingredient): boolean {
  return !ing.keep || ing.keep >= 60;
}

export function collectNeeds(week: WeekPlan, ctx: Ctx, opts: { includeDone?: boolean } = {}): Map<string, Need> {
  const needs = new Map<string, Need>();
  week.days.forEach((day) => {
    for (const slot of Object.keys(day) as SlotId[]) {
      const m = day[slot];
      if (!m || m.from !== undefined) continue;
      if (m.done && !opts.includeDone) continue;
      const r = ctx.recipes[m.r];
      if (!r) continue;
      const a = analyze(r, ctx.constraints, ctx.equipment, ctx.prices);
      const factor = (m.s + (m.x ?? 0)) / r.servings;
      for (const it of a.items) {
        const e = needs.get(it.i) ?? { need: 0, recipes: new Set<string>(), required: false };
        e.need += it.qty * factor;
        e.recipes.add(r.name);
        if (!it.opt) e.required = true;
        needs.set(it.i, e);
      }
    }
  });
  return needs;
}

export function pantryAmount(pantry: PantryItem[], id: string): number {
  let sum = 0;
  for (const p of pantry) {
    if (p.i !== id) continue;
    if (p.a === null) return Infinity;
    sum += p.a;
  }
  return sum;
}

/** Packungen bzw. lose Stückzahl, die für eine Menge gekauft werden müssen. */
export function packaging(ing: Ingredient, buy: number, price: number): { packs: number; purchase: number; cost: number } {
  if (buy <= 1e-9) return { packs: 0, purchase: 0, cost: 0 };
  if (ing.loose) {
    let purchase = buy;
    if (ing.unit === 'stk') purchase = Math.ceil(buy - 0.05);
    else if (ing.pg) purchase = Math.max(ing.pg, Math.ceil(buy / ing.pg - 0.15) * ing.pg);
    purchase = Math.max(purchase, ing.unit === 'stk' ? 1 : buy);
    const packs = ing.unit === 'stk' ? purchase : purchase / ing.pack;
    return { packs, purchase, cost: (purchase / ing.pack) * price };
  }
  const packs = Math.max(1, Math.ceil(buy / ing.pack - 0.03));
  return { packs, purchase: packs * ing.pack, cost: packs * price };
}

export function buildShopping(week: WeekPlan, ctx: Ctx, pantry: PantryItem[], usePantry: boolean): ShoppingResult {
  const needs = collectNeeds(week, ctx);
  const lines: ShopLine[] = [];
  const covered: ShopLine[] = [];
  let total = 0;
  let weekCost = 0;
  let stockValue = 0;
  let usedValue = 0;
  let wasteValue = 0;
  for (const [i, { need, recipes, required }] of needs) {
    const ing = ING[i];
    if (!ing || ing.free) continue;
    const price = priceOf(ing, ctx.prices);
    const inPantry = usePantry ? Math.min(need, pantryAmount(pantry, i)) : 0;
    const buy = Math.max(0, need - inPantry);
    const p = packaging(ing, buy, price);
    const line: ShopLine = {
      i, ing, need, pantry: inPantry, buy, packs: p.packs, purchase: p.purchase, cost: p.cost,
      used: (buy / ing.pack) * price, leftover: Math.max(0, p.purchase - buy), recipes: [...recipes],
      optional: !required, durable: isDurable(ing),
    };
    if (buy <= need * 0.01 || buy < 1e-6) {
      covered.push(line);
      continue;
    }
    lines.push(line);
    total += p.cost;
    usedValue += line.used;
    if (line.durable) {
      weekCost += line.used;
      stockValue += p.cost - line.used;
    } else weekCost += p.cost;
    if (ing.keep && ing.keep <= 10 && !ing.staple) wasteValue += (line.leftover / ing.pack) * price;
  }
  const order = new Map(CATEGORIES.map((c, k) => [c.id, k]));
  const sorter = (a: ShopLine, b: ShopLine) =>
    (order.get(a.ing.cat) ?? 99) - (order.get(b.ing.cat) ?? 99) || a.ing.name.localeCompare(b.ing.name, 'de');
  lines.sort(sorter);
  covered.sort(sorter);
  return { lines, covered, total, weekCost, stockValue, usedValue, wasteValue };
}

/** Kaufmenge in Worten: "2 × Dose 400 g" oder "4 Stück (lose)". */
export function packText(l: ShopLine): string {
  const ing = l.ing;
  if (ing.unit === 'stk' && ing.pack === 1 && !ing.loose) return '';
  if (ing.loose) {
    if (ing.unit === 'stk') return 'lose';
    return `lose, ${fmtMass(l.purchase, ing.unit === 'ml' ? 'ml' : 'g')}`;
  }
  const label = ing.packLabel ?? (ing.unit === 'stk' ? `${ing.pack} Stück` : fmtMass(ing.pack, ing.unit));
  return `${l.packs} × ${label}`;
}

/** Kaufmenge: Stückware als ganze Stücke, sonst der Bedarf. */
export function lineAmount(l: ShopLine): string {
  if (l.ing.unit === 'stk' && (l.ing.loose || l.ing.pack === 1)) return shortAmount(l.ing, l.purchase);
  return shortAmount(l.ing, l.buy);
}

export function lineLabel(l: ShopLine): string {
  return l.ing.unit === 'stk' ? lineAmount(l) : `${lineAmount(l)} ${l.ing.name}`;
}

export function shoppingText(title: string, res: ShoppingResult, st: ShoppingState | undefined, onlyOpen: boolean): string {
  const out: string[] = [title, ''];
  let cat = '';
  for (const l of res.lines) {
    const done = !!st?.checked[l.i];
    if (onlyOpen && done) continue;
    if (l.ing.cat !== cat) {
      cat = l.ing.cat;
      out.push('', CATEGORY_LABEL[l.ing.cat].toUpperCase());
    }
    const pack = packText(l);
    out.push(`${done ? '[x]' : '[ ]'} ${lineLabel(l)}${pack ? ` (${pack})` : ''} · ca. ${fmtEuro(l.cost)}`);
  }
  const manual = st?.manual.filter((m) => !(onlyOpen && m.done)) ?? [];
  if (manual.length) {
    out.push('', 'EIGENE EINTRÄGE');
    for (const m of manual) out.push(`${m.done ? '[x]' : '[ ]'} ${m.text}`);
  }
  out.push('', `Geschätzte Kosten: ca. ${fmtEuro(res.total)} (Schätzwerte, Preise im Laden können abweichen)`);
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

function csvCell(s: string): string {
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function shoppingCsv(res: ShoppingResult, st: ShoppingState | undefined): string {
  const rows = [['Kategorie', 'Zutat', 'Menge', 'Packung', 'Geschätzter Preis (EUR)', 'Für', 'Erledigt']];
  for (const l of res.lines) {
    rows.push([
      CATEGORY_LABEL[l.ing.cat], l.ing.name, lineAmount(l), packText(l), l.cost.toFixed(2).replace('.', ','),
      l.recipes.join(', '), st?.checked[l.i] ? 'ja' : 'nein',
    ]);
  }
  for (const m of st?.manual ?? []) rows.push(['Eigene Einträge', m.text, '', '', '', '', m.done ? 'ja' : 'nein']);
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
}

/** Gekaufte Mengen in den Vorrat übernehmen. */
export function addPurchasesToPantry(pantry: PantryItem[], lines: ShopLine[], today: Date): PantryItem[] {
  const next = pantry.map((p) => ({ ...p }));
  const now = Date.now();
  for (const l of lines) {
    if (l.purchase <= 0) continue;
    const exp = l.ing.keep && l.ing.keep <= 60 ? addDays(toISO(today), l.ing.keep) : undefined;
    const existing = next.find((p) => p.i === l.i);
    if (existing) {
      if (existing.a !== null) existing.a += l.purchase;
      // der ältere Bestand läuft zuerst ab – ein vorhandenes Datum bleibt stehen
      if (exp && !existing.exp) existing.exp = exp;
    } else {
      next.push({ i: l.i, a: l.purchase, exp, added: now });
    }
  }
  return next;
}

/** Nach dem Kochen verbrauchte Zutaten aus dem Vorrat abziehen. */
export function deductFromPantry(pantry: PantryItem[], used: { i: string; qty: number }[]): PantryItem[] {
  const next = pantry.map((p) => ({ ...p }));
  for (const u of used) {
    let rest = u.qty;
    for (const p of next) {
      if (p.i !== u.i || p.a === null || rest <= 0) continue;
      const take = Math.min(p.a, rest);
      p.a -= take;
      rest -= take;
    }
  }
  return next.filter((p) => p.a === null || p.a > 0.5 || (ING[p.i]?.unit === 'stk' && p.a > 0.05));
}
