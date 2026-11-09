import type { Analysis } from './recipe';
import type { Ctx } from './shopping';
import type { DayPlan, Ingredient, MealType, PantryItem, PlannedMeal, Profile, Recipe, SlotId, WeekPlan } from './types';
import { analyze, vegPortions } from './recipe';
import { buildShopping, pantryAmount } from './shopping';
import { ING } from '../data/ingredients';
import { SLOT_MEAL } from '../data/labels';
import { addDays, daysBetween } from './format';
import { weekBalance } from './nutrition';

// Wochenplanung: viele randomisierte, gierig aufgebaute Pläne werden erzeugt und nach einer
// Zielfunktion bewertet (Budget, Abwechslung, Ausgewogenheit, Vorlieben, Resteverwertung).
// Der beste Plan gewinnt. Gesperrte und bereits gekochte Mahlzeiten bleiben unverändert.

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PlanInput {
  profile: Profile;
  recipes: Recipe[];
  favorites: string[];
  ratings: Record<string, number>;
  prices: Record<string, number>;
  pantry: PantryItem[];
  /** Rezepte der Vorwoche – werden seltener wiederholt */
  recent: string[];
  start: string;
  seed: number;
  /** bisheriger Plan: gesperrte, gekochte und vergangene Mahlzeiten bleiben */
  keep?: WeekPlan;
  today?: string;
}

export function servingsFor(p: Profile): number {
  return Math.max(1, Math.round(p.persons * (p.portion || 1) * 2) / 2);
}

export function slotsFor(p: Profile): SlotId[] {
  const s: SlotId[] = [];
  if (p.breakfast) s.push('fruehstueck');
  if (p.lunch !== 'aus') s.push('mittag');
  if (p.dinner) s.push('abend');
  if (p.snacks >= 1) s.push('snack1');
  if (p.snacks >= 2) s.push('snack2');
  return s;
}

export function ctxFrom(input: Pick<PlanInput, 'profile' | 'prices' | 'recipes'>): Ctx {
  return {
    constraints: input.profile,
    equipment: input.profile.equipment,
    prices: input.prices,
    recipes: Object.fromEntries(input.recipes.map((r) => [r.id, r])),
  };
}

const SLOT_WEIGHT: Record<MealType, number> = { fruehstueck: 0.55, mittag: 1.3, abend: 1.4, snack: 0.3 };

export function timeLimit(p: Profile, day: number): number {
  return day >= 5 ? Math.max(p.maxTime, p.maxTimeWeekend) : p.maxTime;
}

interface State {
  used: Map<string, number>;
  /** offene Restmengen aus angebrochenen Packungen (kanonisch) */
  open: Map<string, number>;
  /** bereits eingeplanter Bedarf je Zutat */
  planned: Map<string, number>;
  prevProtein?: string;
  prevCuisine?: string;
  fish: number;
  legumes: number;
  meatMeals: number;
  meatGrams: number;
}

export interface Reason {
  kind: 'fav' | 'rating' | 'pantry' | 'reste' | 'cheap' | 'quick' | 'like' | 'expiring' | 'balance';
  text: string;
}

interface ScoreCtx {
  input: PlanInput;
  ctx: Ctx;
  target: Record<MealType, number>;
  servings: number;
  expiring: Set<string>;
}

function perishable(ing: Ingredient): boolean {
  return !!ing.keep && ing.keep <= 10 && !ing.staple;
}

function scoreRecipe(a: Analysis, mt: MealType, day: number, st: State, sc: ScoreCtx, reasons?: Reason[]): number {
  const { profile, favorites, ratings, recent } = sc.input;
  const r = a.recipe;
  let s = 0;
  const main = mt === 'mittag' || mt === 'abend';
  const push = (kind: Reason['kind'], text: string) => reasons?.push({ kind, text });

  if (favorites.includes(r.id)) {
    s += 2.5;
    push('fav', 'Lieblingsgericht');
  }
  const rating = ratings[r.id];
  if (rating) {
    s += (rating - 3) * 1.2;
    if (rating >= 4) push('rating', `${rating} Sterne`);
  }
  const liked = a.items.filter((it) => profile.likes.includes(it.i)).length;
  if (liked) {
    s += Math.min(3, liked);
    push('like', 'enthält Lieblingszutaten');
  }
  if (profile.cuisines.includes(r.cuisine)) s += 1.2;

  const goals = profile.goals;
  const veg = vegPortions(a);
  if (goals.includes('protein') && main) s += ((a.nutr[1] - 20) / 10) * 1.5;
  if (goals.includes('gemuese')) s += veg * 0.8;
  if (goals.includes('leichter') && main) s -= Math.max(0, a.nutr[0] - 600) / 200;
  if (goals.includes('sparen')) s -= a.cost * 1.2;
  if (goals.includes('schnell')) s -= a.total / 20;
  if (goals.includes('familie') && (r.tags.includes('familie') || r.tags.includes('klassiker'))) s += 1.5;
  if (goals.includes('ausgewogen') || goals.length === 0) {
    s += veg * 0.4 + ((a.groups.huelsen ?? 0) >= 40 ? 0.8 : 0) + ((a.groups.vollkorn ?? 0) >= 30 ? 0.4 : 0);
  }

  // Ernährungsweise: Fleisch in Maßen
  const meat = (a.groups.fleisch ?? 0) + (a.groups.rot ?? 0);
  if (meat > 0 && main) {
    if (profile.diet === 'flexitarisch') s -= st.meatMeals >= 2 ? 12 : 1.5;
    if (profile.diet === 'mischkost' && st.meatGrams / Math.max(1, sc.servings) > 300) s -= 3;
  }

  // Abwechslung
  const u = st.used.get(r.id) ?? 0;
  if (u) s -= u * (mt === 'fruehstueck' ? 2.2 : mt === 'snack' ? 1.5 : 8);
  if (recent.includes(r.id)) s -= main ? 1.5 : 0.5;
  if (main && st.prevProtein === r.protein) s -= 1.8;
  if (main && st.prevCuisine === r.cuisine) s -= 0.8;

  // Resteverwertung: angebrochene Packungen und Vorrat
  let reuse = 0;
  let pantryValue = 0;
  let expiringHits = 0;
  const reuseNames: string[] = [];
  const pantryNames: string[] = [];
  const factor = sc.servings / r.servings;
  for (const it of a.items) {
    const ing = ING[it.i];
    if (!ing || ing.staple || ing.free) continue;
    const need = it.qty * factor;
    const open = st.open.get(it.i) ?? 0;
    if (open > 0 && perishable(ing)) {
      reuse += (Math.min(need, open) / ing.pack) * ing.price;
      reuseNames.push(ing.name);
    }
    const inPantry = pantryAmount(sc.input.pantry, it.i) - (st.planned.get(it.i) ?? 0);
    if (inPantry > 0) {
      pantryValue += (Math.min(need, inPantry === Infinity ? need : inPantry) / ing.pack) * ing.price;
      if (inPantry !== Infinity) pantryNames.push(ing.name);
    }
    if (sc.expiring.has(it.i)) expiringHits++;
  }
  if (reuse > 0.15) {
    s += Math.min(3, reuse * 1.5);
    push('reste', `nutzt Reste: ${reuseNames.slice(0, 2).join(', ')}`);
  }
  if (pantryValue > 0) s += Math.min(3, pantryValue);
  if (pantryNames.length) push('pantry', `im Vorrat: ${pantryNames.slice(0, 2).join(', ')}`);
  if (expiringHits) {
    s += Math.min(3, expiringHits * 1.5);
    push('expiring', 'verwertet bald ablaufende Vorräte');
  }

  // Budget: Kosten der Mahlzeit gegen den Anteil des Wochenbudgets
  const mealCost = a.cost * sc.servings;
  const target = sc.target[mt];
  if (target > 0 && mealCost > target) s -= ((mealCost - target) / target) * 2.2;
  else if (target > 0 && mealCost < target * 0.6) push('cheap', 'günstig');

  // Zeit
  const limit = timeLimit(profile, day);
  if (a.total <= Math.min(20, limit * 0.6)) push('quick', `${a.total} Min.`);
  if (mt === 'fruehstueck' && day < 5 && a.total > 15) s -= (a.total - 15) / 6;

  // Reste vom Vortag zum Mittag: aufwärmbare Abendessen bevorzugen
  if (mt === 'abend' && profile.lunch === 'reste' && day < 6) s += r.keeps ? 1.6 : -1.2;

  // Ausgewogenheit über die Woche
  const fishOk = profile.diet === 'mischkost' || profile.diet === 'flexitarisch' || profile.diet === 'pescetarisch';
  if (main && fishOk && st.fish === 0 && day >= 2 && (a.groups.fisch ?? 0) >= 50) {
    s += 2;
    push('balance', 'Fisch für die Woche');
  }
  if (main && profile.diet === 'mischkost' && st.meatMeals < 2 && meat > 0) s += 2.2;
  if (main && st.legumes < 2 && day >= 2 && (a.groups.huelsen ?? 0) >= 40) {
    s += 1.5;
    push('balance', 'Hülsenfrüchte für die Woche');
  }
  return s;
}

function emptyState(): State {
  return { used: new Map(), open: new Map(), planned: new Map(), fish: 0, legumes: 0, meatMeals: 0, meatGrams: 0 };
}

function applyNeeds(st: State, a: Analysis, servingsCooked: number) {
  const factor = servingsCooked / a.recipe.servings;
  for (const it of a.items) {
    const ing = ING[it.i];
    if (!ing || ing.free) continue;
    const need = it.qty * factor;
    st.planned.set(it.i, (st.planned.get(it.i) ?? 0) + need);
    const open = st.open.get(it.i) ?? 0;
    if (open >= need) st.open.set(it.i, open - need);
    else {
      const rest = need - open;
      const packs = Math.ceil(rest / ing.pack - 0.03);
      st.open.set(it.i, Math.max(0, packs * ing.pack - rest));
    }
  }
}

function applyToState(st: State, a: Analysis, mt: MealType, servingsCooked: number) {
  const r = a.recipe;
  st.used.set(r.id, (st.used.get(r.id) ?? 0) + 1);
  applyNeeds(st, a, servingsCooked);
  if (mt === 'mittag' || mt === 'abend') {
    st.prevProtein = r.protein;
    st.prevCuisine = r.cuisine;
    if ((a.groups.fisch ?? 0) >= 50) st.fish++;
    if ((a.groups.huelsen ?? 0) >= 40) st.legumes++;
    const meat = (a.groups.fleisch ?? 0) + (a.groups.rot ?? 0);
    if (meat > 0) {
      st.meatMeals++;
      st.meatGrams += meat * servingsCooked;
    }
  }
}

export interface Pools {
  byMeal: Record<MealType, Analysis[]>;
  all: Analysis[];
}

export function buildPools(input: PlanInput): Pools {
  const { profile, ratings, prices } = input;
  const all = input.recipes.map((r) => analyze(r, profile, profile.equipment, prices)).filter((a) => a.ok && (ratings[a.recipe.id] ?? 3) > 1);
  const byMeal: Record<MealType, Analysis[]> = { fruehstueck: [], mittag: [], abend: [], snack: [] };
  for (const a of all) for (const m of a.recipe.meals) byMeal[m].push(a);
  return { byMeal, all };
}

function weightedPick<T>(items: { v: T; s: number }[], rand: () => number, temp = 1): T | undefined {
  if (!items.length) return undefined;
  const max = Math.max(...items.map((x) => x.s));
  const w = items.map((x) => Math.exp((x.s - max) / temp));
  const sum = w.reduce((p, c) => p + c, 0);
  let t = rand() * sum;
  for (let k = 0; k < items.length; k++) {
    t -= w[k];
    if (t <= 0) return items[k].v;
  }
  return items[items.length - 1].v;
}

function makeScoreCtx(input: PlanInput, ctx: Ctx): ScoreCtx {
  const p = input.profile;
  const slots = slotsFor(p);
  const servings = servingsFor(p);
  const totalWeight = slots.reduce((s, sl) => s + SLOT_WEIGHT[SLOT_MEAL[sl]], 0) * 7;
  const target = { fruehstueck: 0, mittag: 0, abend: 0, snack: 0 } as Record<MealType, number>;
  for (const m of Object.keys(target) as MealType[]) target[m] = totalWeight ? (p.budget * SLOT_WEIGHT[m]) / totalWeight : 0;
  const expiring = new Set<string>();
  const ref = input.today ?? input.start;
  for (const it of input.pantry) if (it.exp && daysBetween(ref, it.exp) <= 4) expiring.add(it.i);
  return { input, ctx, target, servings, expiring };
}

function isKept(meal: PlannedMeal | null | undefined, day: number, input: PlanInput): boolean {
  if (!meal) return false;
  if (meal.lock || meal.done) return true;
  if (input.today) {
    const dayIso = addDays(input.start, day);
    if (dayIso < input.today) return true;
  }
  return false;
}

function construct(input: PlanInput, pools: Pools, sc: ScoreCtx, rand: () => number): WeekPlan {
  const p = input.profile;
  const slots = slotsFor(p);
  const servings = sc.servings;
  const st = emptyState();
  const days: DayPlan[] = [];
  const byId = new Map(pools.all.map((a) => [a.recipe.id, a]));
  const keep = input.keep;

  for (let d = 0; d < 7; d++) {
    const day: DayPlan = {};
    days.push(day);
    for (const slot of slots) {
      const mt = SLOT_MEAL[slot];
      const kept = keep?.days[d]?.[slot];
      if (kept && isKept(kept, d, input)) {
        day[slot] = { ...kept };
        const a = byId.get(kept.r) ?? (sc.ctx.recipes[kept.r] ? analyze(sc.ctx.recipes[kept.r], p, p.equipment, input.prices) : undefined);
        if (a && kept.from === undefined) applyToState(st, a, mt, kept.s + (kept.x ?? 0));
        continue;
      }
      // Reste vom Vorabend: das Abendessen wird mit Extra-Portionen gekocht
      if (slot === 'mittag' && p.lunch === 'reste' && d > 0) {
        const prev = days[d - 1].abend;
        const ra = prev && prev.from === undefined ? byId.get(prev.r) : undefined;
        if (prev && ra?.recipe.keeps) {
          prev.x = (prev.x ?? 0) + servings;
          applyNeeds(st, ra, servings);
          day.mittag = { r: prev.r, s: servings, from: d - 1 };
          continue;
        }
      }
      const limit = timeLimit(p, d);
      const pool = pools.byMeal[mt].filter((a) => a.total <= limit);
      if (!pool.length) {
        day[slot] = null;
        continue;
      }
      const scored = pool.map((a) => ({ v: a, s: scoreRecipe(a, mt, d, st, sc) + rand() * 2 }));
      scored.sort((x, y) => y.s - x.s);
      const choice = weightedPick(scored.slice(0, 6), rand, 1.1)!;
      day[slot] = { r: choice.recipe.id, s: servings };
      applyToState(st, choice, mt, servings);
    }
  }
  return { start: input.start, days, seed: input.seed, createdAt: Date.now() };
}

export interface PlanQuality {
  score: number;
  cost: number;
  waste: number;
}

export function evaluate(plan: WeekPlan, input: PlanInput, ctx: Ctx, sc?: ScoreCtx): PlanQuality {
  const p = input.profile;
  const shop = buildShopping(plan, ctx, input.pantry, true);
  const bal = weekBalance(plan, ctx, p);
  let score = 0;
  // Präferenzen (ohne Zufall) aufsummieren
  if (sc) {
    const st = emptyState();
    plan.days.forEach((day, d) => {
      for (const slot of Object.keys(day) as SlotId[]) {
        const m = day[slot];
        if (!m || m.from !== undefined) continue;
        const r = ctx.recipes[m.r];
        if (!r) continue;
        const a = analyze(r, p, p.equipment, input.prices);
        score += scoreRecipe(a, SLOT_MEAL[slot], d, st, sc) * 0.5;
        applyToState(st, a, SLOT_MEAL[slot], m.s + (m.x ?? 0));
      }
    });
  }
  const over = Math.max(0, shop.weekCost - p.budget);
  score -= (over / Math.max(10, p.budget)) * 40;
  score -= shop.wasteValue * 2;
  score += bal.uniqueMains * 0.6;
  if (bal.vegPerDay < 3) score -= (3 - bal.vegPerDay) * 3;
  if (bal.legumeMeals === 0 && bal.mainMeals > 0) score -= 2;
  const fishOk = p.diet === 'mischkost' || p.diet === 'flexitarisch' || p.diet === 'pescetarisch';
  if (fishOk && bal.fishMeals === 0 && bal.mainMeals >= 5) score -= 1.5;
  if ((p.diet === 'mischkost' || p.diet === 'flexitarisch') && bal.meatGrams > 300) score -= (bal.meatGrams - 300) / 35;
  // Mischkost heißt: auch Fleisch und Fisch, nur in Maßen
  if (p.diet === 'mischkost' && bal.mainMeals >= 5) {
    const animal = cookedAnimalMains(plan, ctx, p);
    if (animal < 3) score -= (3 - animal) * 3;
  }
  return { score, cost: shop.weekCost, waste: shop.wasteValue };
}

function cookedAnimalMains(plan: WeekPlan, ctx: Ctx, p: Profile): number {
  let n = 0;
  for (const day of plan.days)
    for (const slot of ['mittag', 'abend'] as SlotId[]) {
      const m = day[slot];
      if (!m || m.from !== undefined || !ctx.recipes[m.r]) continue;
      const a = analyze(ctx.recipes[m.r], p, p.equipment, ctx.prices);
      if (a.diet === 'mischkost' || a.diet === 'pescetarisch') n++;
    }
  return n;
}

export interface PlanResult {
  plan: WeekPlan;
  quality: PlanQuality;
  warnings: string[];
}

export interface Suggestion {
  analysis: Analysis;
  score: number;
  reasons: Reason[];
}

function rank(input: PlanInput, pools: Pools, sc: ScoreCtx, ctx: Ctx, week: WeekPlan, day: number, slot: SlotId): Suggestion[] {
  const mt = SLOT_MEAL[slot];
  // Zustand aus allen übrigen Mahlzeiten der Woche
  const st = emptyState();
  week.days.forEach((dp, d) => {
    for (const sl of Object.keys(dp) as SlotId[]) {
      if (d === day && sl === slot) continue;
      const m = dp[sl];
      if (!m || m.from !== undefined) continue;
      const r = ctx.recipes[m.r];
      if (!r) continue;
      applyToState(st, analyze(r, input.profile, input.profile.equipment, input.prices), SLOT_MEAL[sl], m.s + (m.x ?? 0));
    }
  });
  const prev = day > 0 ? week.days[day - 1]?.abend : undefined;
  if (prev && ctx.recipes[prev.r]) {
    st.prevProtein = ctx.recipes[prev.r].protein;
    st.prevCuisine = ctx.recipes[prev.r].cuisine;
  }
  const current = week.days[day]?.[slot]?.r;
  const limit = timeLimit(input.profile, day);
  const res = pools.byMeal[mt]
    .filter((a) => a.recipe.id !== current && a.total <= limit)
    .map((a) => {
      const reasons: Reason[] = [];
      const score = scoreRecipe(a, mt, day, st, sc, reasons);
      return { analysis: a, score, reasons };
    });
  res.sort((a, b) => b.score - a.score);
  return res;
}

/** Bewertete Alternativen für einen einzelnen Platz im Plan. */
export function suggestForSlot(input: PlanInput, week: WeekPlan, day: number, slot: SlotId, n = 8): Suggestion[] {
  const ctx = ctxFrom(input);
  return rank(input, buildPools(input), makeScoreCtx(input, ctx), ctx, week, day, slot).slice(0, n);
}

/** Ersetzt eine Mahlzeit und hält Reste-Verknüpfungen stimmig. */
export function replaceMeal(week: WeekPlan, day: number, slot: SlotId, recipe: Recipe): void {
  const old = week.days[day][slot];
  if (!old) return;
  const hadLeftovers = slot === 'abend' && (old.x ?? 0) > 0;
  week.days[day][slot] = { r: recipe.id, s: old.s, lock: old.lock };
  if (hadLeftovers) {
    week.days.forEach((dp) => {
      for (const sl of Object.keys(dp) as SlotId[]) {
        const m = dp[sl];
        if (m && m.from === day) {
          if (recipe.keeps) m.r = recipe.id;
          else delete m.from;
        }
      }
    });
  }
  normalizeWeek(week);
}

/** Teure Gerichte gegen günstigere tauschen, bis das Budget passt. */
function repairBudget(plan: WeekPlan, input: PlanInput, pools: Pools, sc: ScoreCtx, ctx: Ctx): void {
  const p = input.profile;
  const tried = new Set<string>();
  for (let iter = 0; iter < 10; iter++) {
    const cost = buildShopping(plan, ctx, input.pantry, true).weekCost;
    if (cost <= p.budget) return;
    const meals: { d: number; slot: SlotId; value: number }[] = [];
    plan.days.forEach((dp, d) => {
      for (const slot of Object.keys(dp) as SlotId[]) {
        const m = dp[slot];
        if (!m || m.from !== undefined || isKept(m, d, input) || tried.has(`${d}:${slot}`)) continue;
        const r = ctx.recipes[m.r];
        if (!r) continue;
        meals.push({ d, slot, value: analyze(r, p, p.equipment, input.prices).cost * (m.s + (m.x ?? 0)) });
      }
    });
    if (!meals.length) return;
    meals.sort((a, b) => b.value - a.value);
    const target = meals[0];
    tried.add(`${target.d}:${target.slot}`);
    const m = plan.days[target.d][target.slot]!;
    const servings = m.s + (m.x ?? 0);
    const used = new Set(plan.days.flatMap((dp) => Object.values(dp).map((x) => x?.r)));
    const options = rank(input, pools, sc, ctx, plan, target.d, target.slot).filter(
      (o) => o.analysis.cost * servings < target.value * 0.75 && !used.has(o.analysis.recipe.id) && (!m.x || o.analysis.recipe.keeps),
    );
    if (options.length) replaceMeal(plan, target.d, target.slot, options[0].analysis.recipe);
  }
}

export function generateWeek(input: PlanInput, trials = 28): PlanResult {
  const ctx = ctxFrom(input);
  const pools = buildPools(input);
  const sc = makeScoreCtx(input, ctx);
  const warnings: string[] = [];
  const missing = new Set<string>();
  for (const slot of slotsFor(input.profile)) {
    const mt = SLOT_MEAL[slot];
    if (pools.byMeal[mt].length === 0) missing.add(mt);
  }
  for (const mt of missing) {
    const label = { fruehstueck: 'Frühstück', mittag: 'Mittagessen', abend: 'Abendessen', snack: 'Snacks' }[mt as MealType];
    warnings.push(`Für ${label} passt mit deinen Einstellungen kein Rezept. Prüfe Allergien, Abneigungen, Geräte und Kochzeit.`);
  }
  const rand = rng(input.seed);
  let best: PlanResult | undefined;
  for (let t = 0; t < trials; t++) {
    const plan = construct(input, pools, sc, rand);
    normalizeWeek(plan);
    const quality = evaluate(plan, input, ctx, sc);
    if (!best || quality.score > best.quality.score) best = { plan, quality, warnings };
  }
  if (best && best.quality.cost > input.profile.budget) {
    repairBudget(best.plan, input, pools, sc, ctx);
    best.quality = evaluate(best.plan, input, ctx, sc);
  }
  if (best && best.quality.cost > input.profile.budget * 1.03) {
    warnings.push('Das Budget ist mit deinen Einstellungen knapp. Der Plan liegt etwas darüber – günstigere Gerichte findest du über „Austauschen“.');
  }
  return best!;
}

/** Konsistenz der Reste-Verknüpfungen nach Änderungen herstellen. */
export function normalizeWeek(week: WeekPlan): WeekPlan {
  week.days.forEach((day, d) => {
    for (const slot of Object.keys(day) as SlotId[]) {
      const m = day[slot];
      if (!m || m.from === undefined) continue;
      const src = week.days[m.from]?.abend;
      if (!(m.from < d && src && src.r === m.r && src.from === undefined)) delete m.from;
    }
  });
  week.days.forEach((day) => {
    if (day.abend) delete day.abend.x;
  });
  week.days.forEach((day) => {
    for (const slot of Object.keys(day) as SlotId[]) {
      const m = day[slot];
      if (!m || m.from === undefined) continue;
      const src = week.days[m.from].abend!;
      src.x = (src.x ?? 0) + m.s;
    }
  });
  return week;
}

export function cloneWeek(w: WeekPlan): WeekPlan {
  return { ...w, days: w.days.map((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v ? { ...v } : v])) as DayPlan) };
}

export function emptyWeek(start: string): WeekPlan {
  return { start, days: Array.from({ length: 7 }, () => ({})), seed: 0, createdAt: Date.now() };
}
