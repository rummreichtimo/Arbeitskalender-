import type { Activity, Allergen, Category, Cuisine, Diet, Equipment, Goal, MealType, SlotId, Intolerance } from '../lib/types';

/** Reihenfolge entspricht einem typischen Weg durch den Supermarkt. */
export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'obst-gemuese', label: 'Obst & Gemüse' },
  { id: 'brot', label: 'Brot & Backwaren' },
  { id: 'kuehl', label: 'Milchprodukte, Eier & Kühlregal' },
  { id: 'fleisch-fisch', label: 'Fleisch & Fisch' },
  { id: 'trocken', label: 'Nudeln, Reis & Getreide' },
  { id: 'konserven', label: 'Konserven, Saucen & Aufstriche' },
  { id: 'nuesse', label: 'Nüsse, Saaten & Trockenobst' },
  { id: 'backen', label: 'Backen & Süßes' },
  { id: 'gewuerze', label: 'Gewürze, Öle & Brühe' },
  { id: 'tk', label: 'Tiefkühl' },
  { id: 'sonstiges', label: 'Sonstiges' },
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<Category, string>;

export const ALLERGENS: { id: Allergen; label: string }[] = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'milch', label: 'Milch' },
  { id: 'ei', label: 'Ei' },
  { id: 'nuesse', label: 'Schalenfrüchte (Nüsse)' },
  { id: 'erdnuss', label: 'Erdnüsse' },
  { id: 'soja', label: 'Soja' },
  { id: 'fisch', label: 'Fisch' },
  { id: 'krebstiere', label: 'Krebstiere' },
  { id: 'weichtiere', label: 'Weichtiere' },
  { id: 'sellerie', label: 'Sellerie' },
  { id: 'senf', label: 'Senf' },
  { id: 'sesam', label: 'Sesam' },
  { id: 'sulfite', label: 'Sulfite' },
  { id: 'lupinen', label: 'Lupinen' },
];
export const ALLERGEN_LABEL = Object.fromEntries(ALLERGENS.map((a) => [a.id, a.label])) as Record<Allergen, string>;
export const ALLERGEN_SHORT: Record<Allergen, string> = {
  gluten: 'Gluten', milch: 'Milch', ei: 'Ei', nuesse: 'Nüsse', erdnuss: 'Erdnuss', soja: 'Soja', fisch: 'Fisch',
  krebstiere: 'Krebstiere', weichtiere: 'Weichtiere', sellerie: 'Sellerie', senf: 'Senf', sesam: 'Sesam',
  sulfite: 'Sulfite', lupinen: 'Lupinen',
};

export const INTOLERANCES: { id: Intolerance; label: string; hint: string }[] = [
  { id: 'laktose', label: 'Laktoseintoleranz', hint: 'Milch, Joghurt, Quark und Sahne werden durch laktosefreie Varianten ersetzt. Butter und gereifter Käse bleiben.' },
];

export const DIETS: { id: Diet; label: string; hint: string }[] = [
  { id: 'mischkost', label: 'Mischkost', hint: 'Alles, mit Fleisch in Maßen' },
  { id: 'flexitarisch', label: 'Flexitarisch', hint: 'Überwiegend pflanzlich, höchstens 2× Fleisch pro Woche' },
  { id: 'pescetarisch', label: 'Pescetarisch', hint: 'Vegetarisch plus Fisch' },
  { id: 'vegetarisch', label: 'Vegetarisch', hint: 'Ohne Fleisch und Fisch' },
  { id: 'vegan', label: 'Vegan', hint: 'Rein pflanzlich' },
];
export const DIET_LABEL = Object.fromEntries(DIETS.map((d) => [d.id, d.label])) as Record<Diet, string>;

export const MEAL_LABEL: Record<MealType, string> = { fruehstueck: 'Frühstück', mittag: 'Mittagessen', abend: 'Abendessen', snack: 'Snack' };
export const SLOT_LABEL: Record<SlotId, string> = { fruehstueck: 'Frühstück', mittag: 'Mittag', abend: 'Abend', snack1: 'Snack', snack2: 'Snack 2' };
export const SLOT_MEAL: Record<SlotId, MealType> = { fruehstueck: 'fruehstueck', mittag: 'mittag', abend: 'abend', snack1: 'snack', snack2: 'snack' };
export const SLOT_ORDER: SlotId[] = ['fruehstueck', 'mittag', 'abend', 'snack1', 'snack2'];

export const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: 'herd', label: 'Herd / Kochfeld' },
  { id: 'ofen', label: 'Backofen' },
  { id: 'airfryer', label: 'Heißluftfritteuse' },
  { id: 'mikrowelle', label: 'Mikrowelle' },
  { id: 'stabmixer', label: 'Stabmixer' },
  { id: 'mixer', label: 'Standmixer / Zerkleinerer' },
  { id: 'toaster', label: 'Toaster' },
];
export const EQUIPMENT_LABEL = Object.fromEntries(EQUIPMENT.map((e) => [e.id, e.label])) as Record<Equipment, string>;

export const CUISINES: { id: Cuisine; label: string }[] = [
  { id: 'deutsch', label: 'Deutsch' },
  { id: 'italienisch', label: 'Italienisch' },
  { id: 'mediterran', label: 'Mediterran' },
  { id: 'orientalisch', label: 'Orientalisch' },
  { id: 'indisch', label: 'Indisch' },
  { id: 'asiatisch', label: 'Asiatisch' },
  { id: 'mexikanisch', label: 'Mexikanisch' },
  { id: 'international', label: 'International' },
];
export const CUISINE_LABEL = Object.fromEntries(CUISINES.map((c) => [c.id, c.label])) as Record<Cuisine, string>;

export const GOALS: { id: Goal; label: string; hint: string }[] = [
  { id: 'ausgewogen', label: 'Ausgewogen essen', hint: 'Viel Gemüse, Hülsenfrüchte, Vollkorn' },
  { id: 'protein', label: 'Mehr Eiweiß', hint: 'Bevorzugt eiweißreiche Gerichte' },
  { id: 'gemuese', label: 'Mehr Gemüse', hint: 'Gemüsereiche Gerichte zuerst' },
  { id: 'leichter', label: 'Leichter essen', hint: 'Etwas leichtere Gerichte, ohne Kalorienzählen' },
  { id: 'sparen', label: 'Geld sparen', hint: 'Günstige Gerichte und weniger Reste' },
  { id: 'schnell', label: 'Schnell & einfach', hint: 'Kurze Zubereitung bevorzugt' },
  { id: 'familie', label: 'Familienfreundlich', hint: 'Klassiker, die allen schmecken' },
];
export const GOAL_LABEL = Object.fromEntries(GOALS.map((g) => [g.id, g.label])) as Record<Goal, string>;

export const ACTIVITIES: { id: Activity; label: string; hint: string; pal: number }[] = [
  { id: 'sitzend', label: 'Überwiegend sitzend', hint: 'Bürojob, wenig Bewegung', pal: 1.4 },
  { id: 'leicht', label: 'Leicht aktiv', hint: 'Viel auf den Beinen oder 1–2× Sport', pal: 1.6 },
  { id: 'aktiv', label: 'Aktiv', hint: 'Körperliche Arbeit oder 3–4× Sport', pal: 1.8 },
  { id: 'sehr-aktiv', label: 'Sehr aktiv', hint: 'Schwere Arbeit oder tägliches Training', pal: 2.0 },
];

export const DIFFICULTY_LABEL: Record<1 | 2 | 3, string> = { 1: 'Einfach', 2: 'Mittel', 3: 'Anspruchsvoll' };

export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
