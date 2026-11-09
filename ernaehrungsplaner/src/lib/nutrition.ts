import type { Activity, Nutr, Profile, Sex, SlotId, WeekPlan } from './types';
import type { Ctx } from './shopping';
import { analyze, vegPortions } from './recipe';

// Richtwerte für die Energiezufuhr in kcal/Tag nach Alter und PAL (1,4 / 1,6 / 1,8),
// orientiert an den D-A-CH-Referenzwerten der DGE. Nur zur Orientierung – keine Vorgabe.
const REF: { max: number; m: [number, number, number]; w: [number, number, number] }[] = [
  { max: 18, m: [2600, 3000, 3400], w: [2000, 2300, 2600] },
  { max: 24, m: [2400, 2800, 3100], w: [1900, 2200, 2500] },
  { max: 50, m: [2300, 2700, 3000], w: [1800, 2100, 2400] },
  { max: 64, m: [2200, 2500, 2800], w: [1700, 2000, 2200] },
  { max: 200, m: [2100, 2500, 2800], w: [1700, 1900, 2100] },
];

const PAL_INDEX: Record<Activity, number> = { sitzend: 0, leicht: 1, aktiv: 2, 'sehr-aktiv': 2 };

export function energyReference(age: number, sex: Sex, activity: Activity): { low: number; high: number; mid: number } {
  const row = REF.find((r) => age <= r.max) ?? REF[REF.length - 1];
  const k = PAL_INDEX[activity];
  const pick = (s: 'm' | 'w') => row[s][k] * (activity === 'sehr-aktiv' ? 1.1 : 1);
  const mid = sex === 'm' ? pick('m') : sex === 'w' ? pick('w') : (pick('m') + pick('w')) / 2;
  const round = (x: number) => Math.round(x / 50) * 50;
  return { low: round(mid * 0.9), high: round(mid * 1.1), mid: round(mid) };
}

/** Vorschlag für die Portionsgröße aus Aktivität. */
export function suggestedPortion(activity: Activity): number {
  return activity === 'sehr-aktiv' ? 1.25 : activity === 'aktiv' ? 1.1 : 1;
}

export interface DayNutrition {
  nutr: Nutr;
  meals: number;
}

export interface Balance {
  vegPerDay: number;
  legumeMeals: number;
  fishMeals: number;
  meatGrams: number;
  wholegrainMeals: number;
  uniqueMains: number;
  plantMeals: number;
  mainMeals: number;
  days: DayNutrition[];
  avg: Nutr;
}

/** Ausgewogenheit je Person für eine Woche (Schätzung aus den geplanten Portionen). */
export function weekBalance(week: WeekPlan, ctx: Ctx, profile: Profile): Balance {
  const portion = profile.portion || 1;
  let veg = 0;
  let legumeMeals = 0;
  let fishMeals = 0;
  let meat = 0;
  let whole = 0;
  let plant = 0;
  let mains = 0;
  const mainIds = new Set<string>();
  const days: DayNutrition[] = week.days.map((day) => {
    const n: Nutr = [0, 0, 0, 0, 0];
    let meals = 0;
    for (const slot of Object.keys(day) as SlotId[]) {
      const m = day[slot];
      if (!m) continue;
      const r = ctx.recipes[m.r];
      if (!r) continue;
      const a = analyze(r, ctx.constraints, ctx.equipment, ctx.prices);
      for (let k = 0; k < 5; k++) n[k] += a.nutr[k] * portion;
      meals++;
      veg += vegPortions(a) * portion;
      const isMain = slot === 'mittag' || slot === 'abend';
      if (isMain) {
        mains++;
        mainIds.add(r.id);
        if ((a.groups.huelsen ?? 0) >= 40) legumeMeals++;
        if ((a.groups.fisch ?? 0) >= 50) fishMeals++;
        if (a.diet === 'vegan' || a.diet === 'vegetarisch') plant++;
      }
      meat += ((a.groups.fleisch ?? 0) + (a.groups.rot ?? 0)) * portion;
      if ((a.groups.vollkorn ?? 0) >= 30) whole++;
    }
    return { nutr: n, meals };
  });
  const planned = days.filter((d) => d.meals > 0);
  const avg: Nutr = [0, 0, 0, 0, 0];
  for (const d of planned) for (let k = 0; k < 5; k++) avg[k] += d.nutr[k] / planned.length;
  return {
    vegPerDay: planned.length ? veg / planned.length : 0,
    legumeMeals,
    fishMeals,
    meatGrams: meat,
    wholegrainMeals: whole,
    uniqueMains: mainIds.size,
    plantMeals: plant,
    mainMeals: mains,
    days,
    avg,
  };
}

export type Level = 'gut' | 'ok' | 'mehr';

export interface BalanceItem {
  id: string;
  label: string;
  value: string;
  target: string;
  level: Level;
}

export function balanceItems(b: Balance, profile: Profile): BalanceItem[] {
  const items: BalanceItem[] = [];
  const v = b.vegPerDay;
  items.push({
    id: 'veg', label: 'Gemüse & Obst', value: `${v.toFixed(1).replace('.', ',')} Portionen/Tag`, target: 'Orientierung: 5 am Tag',
    level: v >= 4.5 ? 'gut' : v >= 3 ? 'ok' : 'mehr',
  });
  items.push({
    id: 'huelsen', label: 'Hülsenfrüchte', value: `${b.legumeMeals}× pro Woche`, target: 'Orientierung: mind. 1–2×',
    level: b.legumeMeals >= 2 ? 'gut' : b.legumeMeals >= 1 ? 'ok' : 'mehr',
  });
  if (profile.diet === 'mischkost' || profile.diet === 'flexitarisch' || profile.diet === 'pescetarisch') {
    items.push({
      id: 'fisch', label: 'Fisch', value: `${b.fishMeals}× pro Woche`, target: 'Orientierung: 1–2×',
      level: b.fishMeals >= 1 && b.fishMeals <= 3 ? 'gut' : b.fishMeals > 3 ? 'ok' : 'mehr',
    });
  }
  if (profile.diet === 'mischkost' || profile.diet === 'flexitarisch') {
    const m = Math.round(b.meatGrams / 10) * 10;
    items.push({
      id: 'fleisch', label: 'Fleisch & Wurst', value: `ca. ${m} g pro Person`, target: 'Orientierung: höchstens 300 g/Woche',
      level: m <= 300 ? 'gut' : m <= 450 ? 'ok' : 'mehr',
    });
  }
  items.push({
    id: 'vollkorn', label: 'Vollkorn', value: `${b.wholegrainMeals} Mahlzeiten`, target: 'Orientierung: täglich',
    level: b.wholegrainMeals >= 7 ? 'gut' : b.wholegrainMeals >= 4 ? 'ok' : 'mehr',
  });
  items.push({
    id: 'vielfalt', label: 'Abwechslung', value: `${b.uniqueMains} verschiedene Hauptgerichte`, target: 'Möglichst wenig Wiederholung',
    level: b.mainMeals === 0 || b.uniqueMains >= Math.min(b.mainMeals, 6) ? 'gut' : b.uniqueMains >= b.mainMeals / 2 ? 'ok' : 'mehr',
  });
  return items;
}
