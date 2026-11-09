import type { Allergen, Diet, Equipment, Group, Ingredient, ItemUnit, Nutr, Profile, Recipe } from './types';
import { ING } from '../data/ingredients';
import { gramsOf, toCanonical } from './format';

/** Zutat nach Anpassung an Profil, Menge kanonisch für die Grund-Portionenzahl des Rezepts. */
export interface AdaptedItem {
  i: string;
  qty: number;
  /** Löffeleinheit für die Anzeige */
  u?: ItemUnit;
  opt?: boolean;
  note?: string;
  /** ursprüngliche Zutat, falls ersetzt */
  from?: string;
}

export interface Swap {
  from: string;
  to: string;
  note?: string;
}

export interface Analysis {
  recipe: Recipe;
  ok: boolean;
  items: AdaptedItem[];
  swaps: Swap[];
  omitted: string[];
  blockers: string[];
  missingEquip: string[];
  /** geschätzte Kosten je Portion (anteilig verbraucht) */
  cost: number;
  /** Nährwerte je Portion */
  nutr: Nutr;
  allergens: Allergen[];
  diet: Diet;
  /** Gramm je Portion nach Lebensmittelgruppe */
  groups: Partial<Record<Group, number>>;
  total: number;
}

export type Constraints = Pick<Profile, 'diet' | 'allergens' | 'intolerances' | 'dislikes'>;

export function violates(ing: Ingredient, c: Constraints): boolean {
  const an = ing.an ?? [];
  if (c.diet === 'vegan' && an.length) return true;
  if (c.diet === 'vegetarisch' && (an.includes('fleisch') || an.includes('fisch'))) return true;
  if (c.diet === 'pescetarisch' && an.includes('fleisch')) return true;
  if (ing.al?.some((a) => c.allergens.includes(a))) return true;
  if (ing.lac && c.intolerances.includes('laktose')) return true;
  if (c.dislikes.includes(ing.id)) return true;
  return false;
}

export function equipmentMissing(recipe: Recipe, equipment: Equipment[]): string[] {
  return recipe.equip.filter((e) => !e.split('|').some((x) => equipment.includes(x as Equipment)));
}

export function totalTime(r: Recipe): number {
  return r.prep + r.cook;
}

/** Ernährungsweise, die ein Zutatenset erfüllt. */
export function dietOf(itemIds: string[]): Diet {
  const an = new Set(itemIds.flatMap((i) => ING[i]?.an ?? []));
  if (an.size === 0) return 'vegan';
  if (!an.has('fleisch') && !an.has('fisch')) return 'vegetarisch';
  if (!an.has('fleisch')) return 'pescetarisch';
  return 'mischkost';
}

const cache = new Map<string, Analysis>();
let cacheKey = '';

export function constraintKey(c: Constraints, equipment: Equipment[], prices: Record<string, number>): string {
  return JSON.stringify([c.diet, [...c.allergens].sort(), [...c.intolerances].sort(), [...c.dislikes].sort(), [...equipment].sort(), prices]);
}

export function priceOf(ing: Ingredient, prices?: Record<string, number>): number {
  return prices?.[ing.id] ?? ing.price;
}

/** Rezept an Ernährungsweise, Allergien, Unverträglichkeiten und Abneigungen anpassen und auswerten. */
export function analyze(recipe: Recipe, c: Constraints, equipment: Equipment[], prices: Record<string, number> = {}): Analysis {
  const key = constraintKey(c, equipment, prices);
  if (key !== cacheKey) {
    cache.clear();
    cacheKey = key;
  }
  const ck = recipe.id + '@' + (recipe.createdAt ?? 0) + ':' + recipe.items.length;
  const hit = cache.get(ck);
  if (hit && hit.recipe === recipe) return hit;

  const items: AdaptedItem[] = [];
  const swaps: Swap[] = [];
  const omitted: string[] = [];
  const blockers: string[] = [];

  for (const it of recipe.items) {
    const ing = ING[it.i];
    if (!ing) continue;
    const qty = toCanonical(ing, it.a, it.u);
    if (!violates(ing, c)) {
      items.push({ i: it.i, qty, u: it.u, opt: it.opt, note: it.note });
      continue;
    }
    // rezeptspezifischer Ersatz zuerst, dann allgemeine Ersatzliste der Zutat; optionale Zutaten ohne Ersatz entfallen
    const special = recipe.isub?.[it.i];
    const candidates: [string, number, string | undefined][] = [];
    if (special) candidates.push([special[0], special[1], special[2]]);
    for (const s of ing.sub ?? []) candidates.push([s, ing.subF?.[s] ?? 1, undefined]);
    const pick = candidates.find(([id]) => ING[id] && !violates(ING[id], c));
    if (pick) {
      const [to, factor, note] = pick;
      const target = ING[to];
      // Löffelangaben bleiben Löffelangaben, wenn die Einheiten zusammenpassen
      const keepSpoon = it.u && target.unit === ing.unit && factor === 1;
      const tq = keepSpoon ? toCanonical(target, it.a, it.u) : qty * factor;
      items.push({ i: to, qty: tq, u: keepSpoon ? it.u : undefined, opt: it.opt, note: it.note, from: it.i });
      swaps.push({ from: it.i, to, note });
    } else if (it.opt) {
      omitted.push(it.i);
    } else {
      blockers.push(it.i);
    }
  }

  const missingEquip = equipmentMissing(recipe, equipment);
  const per = 1 / recipe.servings;
  let cost = 0;
  const nutr: Nutr = [0, 0, 0, 0, 0];
  const groups: Partial<Record<Group, number>> = {};
  const allergens = new Set<Allergen>();
  for (const a of items) {
    const ing = ING[a.i];
    cost += (a.qty / ing.pack) * priceOf(ing, prices) * per;
    const g = gramsOf(ing, a.qty) * per;
    for (let k = 0; k < 5; k++) nutr[k] += (g * ing.n[k]) / 100;
    if (ing.grp) groups[ing.grp] = (groups[ing.grp] ?? 0) + g;
    for (const al of ing.al ?? []) allergens.add(al);
  }
  const res: Analysis = {
    recipe,
    ok: blockers.length === 0 && missingEquip.length === 0,
    items,
    swaps,
    omitted,
    blockers,
    missingEquip,
    cost,
    nutr: nutr.map((x) => Math.round(x * 10) / 10) as Nutr,
    allergens: [...allergens],
    diet: dietOf(items.map((x) => x.i)),
    groups,
    total: totalTime(recipe),
  };
  cache.set(ck, res);
  return res;
}

/** Gemüse- und Obstportionen je Portion (1 Portion ≈ 100 g). */
export function vegPortions(a: Analysis): number {
  return ((a.groups.gemuese ?? 0) + (a.groups.obst ?? 0)) / 100;
}

export function isVeggieForward(a: Analysis): boolean {
  return a.diet === 'vegan' || a.diet === 'vegetarisch';
}
