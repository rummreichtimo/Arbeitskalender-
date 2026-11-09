import type { AppState, PantryItem, Profile, Recipe, SlotId, UiPrefs, WeekPlan } from '../lib/types';
import { getState, update, replaceAll } from './store';
import { toast } from './ui';
import { RECIPES } from '../data/recipes';
import { cloneWeek, ctxFrom, emptyWeek, generateWeek, normalizeWeek, replaceMeal, rng, servingsFor, suggestForSlot, type PlanInput } from '../lib/planner';
import { addDays, toISO, weekStartOf } from '../lib/format';
import { analyze } from '../lib/recipe';
import { addPurchasesToPantry, buildShopping, deductFromPantry } from '../lib/shopping';
import { basicPantry } from '../lib/defaults';
import { ING } from '../data/ingredients';

export function allRecipes(s: AppState = getState()): Recipe[] {
  return [...RECIPES, ...s.recipes];
}

export function recipeById(id: string, s: AppState = getState()): Recipe | undefined {
  return RECIPES.find((r) => r.id === id) ?? s.recipes.find((r) => r.id === id);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function planInput(start: string, seed: number, s: AppState = getState(), keep?: WeekPlan): PlanInput {
  const prev = s.plans[addDays(start, -7)];
  const recent = prev ? prev.days.flatMap((d) => Object.values(d).map((m) => m?.r)).filter((x): x is string => !!x) : [];
  return {
    profile: s.profile,
    recipes: allRecipes(s),
    favorites: s.prefs.favorites,
    ratings: s.prefs.ratings,
    prices: s.prefs.prices,
    pantry: s.ui.usePantry ? s.pantry : [],
    recent,
    start,
    seed,
    keep,
    today: todayISO(),
  };
}

export function ctxOf(s: AppState = getState()) {
  return ctxFrom({ profile: s.profile, prices: s.prefs.prices, recipes: allRecipes(s) });
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

function setWeekPlan(start: string, plan: WeekPlan, soft = false) {
  update((s) => ({ ...s, plans: { ...s.plans, [start]: plan } }), ['plans'], soft);
}

/** Plan für die Woche anlegen, falls noch keiner existiert. */
export function ensureWeek(start: string, soft = false): WeekPlan {
  const s = getState();
  if (s.plans[start]) return s.plans[start];
  const res = generateWeek(planInput(start, newSeed(), s));
  setWeekPlan(start, res.plan, soft);
  for (const w of res.warnings) toast(w);
  return res.plan;
}

/** Automatisch erzeugten Plan nach neuem Profil neu berechnen, ohne dass er Vorrang vor dem Konto bekommt. */
export function replanSoft(start: string) {
  const res = generateWeek(planInput(start, newSeed(), getState()));
  setWeekPlan(start, res.plan, true);
}

export function regenerateWeek(start: string) {
  const s = getState();
  const before = s.plans[start];
  const res = generateWeek(planInput(start, newSeed(), s, before));
  setWeekPlan(start, res.plan);
  const kept = before ? before.days.flatMap((d) => Object.values(d)).filter((m) => m && (m.lock || m.done)).length : 0;
  toast(kept ? `Woche neu geplant – ${kept} gesperrte oder gekochte Mahlzeiten behalten.` : 'Woche neu geplant.', before ? () => setWeekPlan(start, before) : undefined);
  for (const w of res.warnings) toast(w);
}

export function clearWeek(start: string) {
  const before = getState().plans[start];
  setWeekPlan(start, emptyWeek(start));
  toast('Woche geleert.', before ? () => setWeekPlan(start, before) : undefined);
}

function mutateWeek(start: string, fn: (w: WeekPlan) => void, message?: string, undoable = true) {
  const s = getState();
  const before = s.plans[start] ?? emptyWeek(start);
  const w = cloneWeek(before);
  fn(w);
  normalizeWeek(w);
  setWeekPlan(start, w);
  if (message) toast(message, undoable ? () => setWeekPlan(start, before) : undefined);
}

export function setMealRecipe(start: string, day: number, slot: SlotId, recipeId: string) {
  const r = recipeById(recipeId);
  if (!r) return;
  const servings = servingsFor(getState().profile);
  mutateWeek(start, (w) => {
    if (w.days[day][slot]) {
      const wasLeftover = w.days[day][slot]!.from !== undefined;
      if (wasLeftover) w.days[day][slot] = { r: r.id, s: w.days[day][slot]!.s };
      else replaceMeal(w, day, slot, r);
    } else w.days[day][slot] = { r: r.id, s: servings };
  }, `${r.name} eingeplant.`);
}

/** Einzelnes Gericht neu würfeln: eine der besten Alternativen. */
export function rerollMeal(start: string, day: number, slot: SlotId) {
  const s = getState();
  const week = s.plans[start];
  if (!week) return;
  const options = suggestForSlot(planInput(start, newSeed(), s), week, day, slot, 5);
  if (!options.length) {
    toast('Keine passende Alternative gefunden.');
    return;
  }
  const rand = rng(newSeed());
  const pick = options[Math.floor(rand() * Math.min(options.length, 4))].analysis.recipe;
  mutateWeek(start, (w) => {
    const m = w.days[day][slot];
    if (m?.from !== undefined) w.days[day][slot] = { r: pick.id, s: m.s };
    else replaceMeal(w, day, slot, pick);
  }, `Neu: ${pick.name}`);
}

export function removeMeal(start: string, day: number, slot: SlotId) {
  mutateWeek(start, (w) => {
    w.days[day][slot] = null;
  }, 'Mahlzeit entfernt.');
}

export function toggleLock(start: string, day: number, slot: SlotId) {
  mutateWeek(start, (w) => {
    const m = w.days[day][slot];
    if (m) m.lock = !m.lock;
  });
}

export function setServings(start: string, day: number, slot: SlotId, servings: number) {
  mutateWeek(start, (w) => {
    const m = w.days[day][slot];
    if (m) m.s = Math.max(0.5, Math.min(20, servings));
  });
}

/** Mahlzeiten tauschen (Drag & Drop oder „Verschieben nach“). */
export function moveMeal(start: string, from: { day: number; slot: SlotId }, to: { day: number; slot: SlotId }) {
  if (from.day === to.day && from.slot === to.slot) return;
  mutateWeek(start, (w) => {
    const a = w.days[from.day][from.slot] ?? null;
    const b = w.days[to.day][to.slot] ?? null;
    // Reste-Verknüpfungen lösen, wenn eine der Mahlzeiten verschoben wird
    for (const m of [a, b]) if (m) delete m.from;
    w.days[to.day][to.slot] = a;
    w.days[from.day][from.slot] = b;
  }, 'Mahlzeiten getauscht.');
}

export function toggleDone(start: string, day: number, slot: SlotId) {
  const s = getState();
  const week = s.plans[start];
  const m = week?.days[day]?.[slot];
  if (!week || !m) return;
  const r = recipeById(m.r);
  const nowDone = !m.done;
  const beforePantry = s.pantry;
  const beforeWeek = week;
  const w = cloneWeek(week);
  w.days[day][slot]!.done = nowDone;
  let pantry = s.pantry;
  if (r && m.from === undefined && s.ui.usePantry) {
    const a = analyze(r, s.profile, s.profile.equipment, s.prefs.prices);
    const factor = (m.s + (m.x ?? 0)) / r.servings;
    const used = a.items.map((it) => ({ i: it.i, qty: it.qty * factor }));
    pantry = nowDone ? deductFromPantry(s.pantry, used) : s.pantry;
  }
  update((st) => ({ ...st, plans: { ...st.plans, [start]: w }, pantry }), ['plans', 'pantry']);
  if (nowDone) {
    toast(`${r?.name ?? 'Mahlzeit'} als gekocht markiert${pantry !== beforePantry ? ' – Vorrat aktualisiert' : ''}.`, () =>
      update((st) => ({ ...st, plans: { ...st.plans, [start]: beforeWeek }, pantry: beforePantry }), ['plans', 'pantry']),
    );
  }
}

// ───── Favoriten & Bewertungen ─────

export function toggleFavorite(id: string) {
  update((s) => {
    const fav = s.prefs.favorites.includes(id) ? s.prefs.favorites.filter((x) => x !== id) : [...s.prefs.favorites, id];
    return { ...s, prefs: { ...s.prefs, favorites: fav } };
  }, ['prefs']);
}

export function rate(id: string, stars: number) {
  update((s) => {
    const ratings = { ...s.prefs.ratings };
    if (ratings[id] === stars) delete ratings[id];
    else ratings[id] = stars;
    return { ...s, prefs: { ...s.prefs, ratings } };
  }, ['prefs']);
  if (stars === 1) toast('Mit einem Stern bewertet – das Gericht wird nicht mehr automatisch eingeplant.');
}

export function setPrice(id: string, price: number | null) {
  update((s) => {
    const prices = { ...s.prefs.prices };
    if (price === null || !Number.isFinite(price)) delete prices[id];
    else prices[id] = Math.max(0, price);
    return { ...s, prefs: { ...s.prefs, prices } };
  }, ['prefs']);
}

// ───── Einkaufsliste ─────

function shoppingOf(s: AppState, start: string) {
  return s.shopping[start] ?? { checked: {}, manual: [] };
}

export function toggleCheck(start: string, id: string) {
  update((s) => {
    const sh = shoppingOf(s, start);
    return { ...s, shopping: { ...s.shopping, [start]: { ...sh, checked: { ...sh.checked, [id]: !sh.checked[id] } } } };
  }, ['shopping']);
}

export function addManual(start: string, text: string) {
  const t = text.trim();
  if (!t) return;
  update((s) => {
    const sh = shoppingOf(s, start);
    return { ...s, shopping: { ...s.shopping, [start]: { ...sh, manual: [...sh.manual, { id: 'm' + Date.now().toString(36), text: t, done: false }] } } };
  }, ['shopping']);
}

export function toggleManual(start: string, id: string) {
  update((s) => {
    const sh = shoppingOf(s, start);
    return { ...s, shopping: { ...s.shopping, [start]: { ...sh, manual: sh.manual.map((m) => (m.id === id ? { ...m, done: !m.done } : m)) } } };
  }, ['shopping']);
}

export function removeManual(start: string, id: string) {
  update((s) => {
    const sh = shoppingOf(s, start);
    return { ...s, shopping: { ...s.shopping, [start]: { ...sh, manual: sh.manual.filter((m) => m.id !== id) } } };
  }, ['shopping']);
}

export function resetChecks(start: string) {
  const before = getState().shopping[start];
  update((s) => {
    const sh = shoppingOf(s, start);
    return { ...s, shopping: { ...s.shopping, [start]: { checked: {}, manual: sh.manual.map((m) => ({ ...m, done: false })) } } };
  }, ['shopping']);
  toast('Alle Häkchen entfernt.', before ? () => update((s) => ({ ...s, shopping: { ...s.shopping, [start]: before } }), ['shopping']) : undefined);
}

/** Abgehakte Einkäufe in den Vorrat übernehmen. */
export function transferToPantry(start: string) {
  const s = getState();
  const week = s.plans[start];
  if (!week) return;
  const sh = shoppingOf(s, start);
  const res = buildShopping(week, ctxOf(s), s.pantry, s.ui.usePantry);
  const lines = res.lines.filter((l) => sh.checked[l.i]);
  if (!lines.length) {
    toast('Hake zuerst gekaufte Zutaten ab.');
    return;
  }
  const before = { pantry: s.pantry, shopping: s.shopping };
  const pantry = addPurchasesToPantry(s.pantry, lines, new Date());
  const checked = { ...sh.checked };
  for (const l of lines) delete checked[l.i];
  update((st) => ({ ...st, pantry, shopping: { ...st.shopping, [start]: { ...sh, checked } }, ui: { ...st.ui, usePantry: true } }), ['pantry', 'shopping', 'profile']);
  toast(`${lines.length} Zutaten in den Vorrat übernommen.`, () => update((st) => ({ ...st, ...before }), ['pantry', 'shopping']));
}

// ───── Vorrat ─────

export function addPantry(i: string, a: number | null, exp?: string) {
  if (!ING[i]) return;
  update((s) => {
    const existing = s.pantry.findIndex((p) => p.i === i);
    const pantry = [...s.pantry];
    if (existing >= 0) {
      const cur = pantry[existing];
      pantry[existing] = { ...cur, a: a === null || cur.a === null ? null : cur.a + a, exp: exp ?? cur.exp };
    } else pantry.push({ i, a, exp, added: Date.now() });
    return { ...s, pantry };
  }, ['pantry']);
}

export function updatePantry(i: string, patch: Partial<PantryItem>) {
  update((s) => ({ ...s, pantry: s.pantry.map((p) => (p.i === i ? { ...p, ...patch } : p)) }), ['pantry']);
}

export function removePantry(i: string) {
  const before = getState().pantry;
  update((s) => ({ ...s, pantry: s.pantry.filter((p) => p.i !== i) }), ['pantry']);
  toast(`${ING[i]?.name ?? 'Eintrag'} aus dem Vorrat entfernt.`, () => update((s) => ({ ...s, pantry: before }), ['pantry']));
}

export function addBasics() {
  const have = new Set(getState().pantry.map((p) => p.i));
  const add = basicPantry().filter((p) => !have.has(p.i));
  update((s) => ({ ...s, pantry: [...s.pantry, ...add] }), ['pantry']);
  toast(add.length ? `${add.length} Basics ergänzt.` : 'Alle Basics sind schon im Vorrat.');
}

// ───── Eigene Rezepte ─────

export function saveRecipe(r: Recipe) {
  update((s) => {
    const exists = s.recipes.some((x) => x.id === r.id);
    const rec = { ...r, createdAt: Date.now() };
    return { ...s, recipes: exists ? s.recipes.map((x) => (x.id === r.id ? rec : x)) : [...s.recipes, rec] };
  }, ['recipes']);
}

export function deleteRecipe(id: string) {
  const s = getState();
  const before = s.recipes;
  update((st) => ({ ...st, recipes: st.recipes.filter((r) => r.id !== id) }), ['recipes']);
  toast('Rezept gelöscht.', () => update((st) => ({ ...st, recipes: before }), ['recipes']));
}

export function newRecipeId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 40);
  return `eigen-${slug || 'rezept'}-${Date.now().toString(36).slice(-4)}`;
}

// ───── Profil ─────

export function updateProfile(patch: Partial<Profile>) {
  update((s) => ({ ...s, profile: { ...s.profile, ...patch, example: false } }), ['profile']);
}

export function updateUi(patch: Partial<UiPrefs>) {
  update((s) => ({ ...s, ui: { ...s.ui, ...patch } }), ['profile']);
}

export function importBackup(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<AppState> & { app?: string };
  if (d.app !== 'wochentisch' || !d.profile || !d.plans) return false;
  const cur = getState();
  replaceAll({
    profile: { ...cur.profile, ...d.profile },
    ui: { ...cur.ui, ...(d.ui ?? {}) },
    plans: d.plans ?? {},
    prefs: { ...cur.prefs, ...(d.prefs ?? {}) },
    pantry: Array.isArray(d.pantry) ? d.pantry : [],
    shopping: d.shopping ?? {},
    recipes: Array.isArray(d.recipes) ? d.recipes : [],
  });
  return true;
}

export function backupJson(): string {
  return JSON.stringify({ app: 'wochentisch', version: 1, exportedAt: new Date().toISOString(), ...getState() }, null, 2);
}

export function currentWeekStart(): string {
  return weekStartOf(new Date());
}
