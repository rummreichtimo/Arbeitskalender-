import type { AppState, PantryItem, Profile } from './types';

/** Beispielprofil für den ersten Start – deutlich als Beispiel gekennzeichnet. */
export const DEFAULT_PROFILE: Profile = {
  age: 34,
  sex: 'x',
  activity: 'leicht',
  goals: ['ausgewogen'],
  diet: 'mischkost',
  allergens: [],
  intolerances: [],
  dislikes: [],
  likes: [],
  cuisines: [],
  persons: 2,
  portion: 1,
  breakfast: true,
  lunch: 'reste',
  dinner: true,
  snacks: 0,
  budget: 80,
  maxTime: 40,
  maxTimeWeekend: 90,
  equipment: ['herd', 'ofen', 'stabmixer', 'mikrowelle', 'toaster'],
  example: true,
};

/** Grundvorrat, den fast jeder Haushalt hat. */
export const BASIC_PANTRY: string[] = [
  'salz', 'pfeffer', 'rapsoel', 'olivenoel', 'zucker', 'mehl', 'paprikapulver', 'oregano', 'zimt',
  'currypulver', 'gemuesebruehe', 'tomatenmark', 'apfelessig', 'senf',
];

export function basicPantry(): PantryItem[] {
  const now = Date.now();
  return BASIC_PANTRY.map((i) => ({ i, a: null, added: now }));
}

export function defaultState(): AppState {
  return {
    profile: { ...DEFAULT_PROFILE },
    ui: { theme: 'system', nutrition: true, usePantry: true },
    plans: {},
    prefs: { favorites: [], ratings: {}, prices: {} },
    pantry: basicPantry(),
    shopping: {},
    recipes: [],
  };
}
