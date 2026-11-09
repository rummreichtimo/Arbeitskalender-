// Gemeinsame Typen für Zutaten, Rezepte, Profil, Wochenplan, Vorrat und Einkaufsliste.

/** Kanonische Einheit einer Zutat: Gramm, Milliliter oder Stück. */
export type Unit = 'g' | 'ml' | 'stk';
/** Einheit, in der ein Rezept eine Menge angibt (leer = kanonisch). */
export type ItemUnit = 'el' | 'tl' | 'prise';

export type Category =
  | 'obst-gemuese'
  | 'brot'
  | 'kuehl'
  | 'fleisch-fisch'
  | 'tk'
  | 'trocken'
  | 'konserven'
  | 'gewuerze'
  | 'backen'
  | 'nuesse'
  | 'sonstiges';

/** Die 14 kennzeichnungspflichtigen Allergene der EU-Lebensmittelinformationsverordnung. */
export type Allergen =
  | 'gluten'
  | 'krebstiere'
  | 'ei'
  | 'fisch'
  | 'erdnuss'
  | 'soja'
  | 'milch'
  | 'nuesse'
  | 'sellerie'
  | 'senf'
  | 'sesam'
  | 'sulfite'
  | 'lupinen'
  | 'weichtiere';

/** Tierische Herkunft – daraus wird die Ernährungsweise eines Gerichts abgeleitet. */
export type Animal = 'fleisch' | 'fisch' | 'milch' | 'ei' | 'honig';

/** Lebensmittelgruppe für die Ausgewogenheits-Auswertung. */
export type Group = 'gemuese' | 'obst' | 'huelsen' | 'vollkorn' | 'fisch' | 'fleisch' | 'rot' | 'milch' | 'nuss';

export type Diet = 'mischkost' | 'flexitarisch' | 'pescetarisch' | 'vegetarisch' | 'vegan';

export type MealType = 'fruehstueck' | 'mittag' | 'abend' | 'snack';
export type SlotId = 'fruehstueck' | 'mittag' | 'abend' | 'snack1' | 'snack2';

export type Equipment = 'herd' | 'ofen' | 'airfryer' | 'mikrowelle' | 'stabmixer' | 'mixer' | 'toaster';

export type Cuisine =
  | 'deutsch'
  | 'italienisch'
  | 'mediterran'
  | 'orientalisch'
  | 'indisch'
  | 'asiatisch'
  | 'mexikanisch'
  | 'international';

export type Visual = 'plate' | 'bowl' | 'pasta' | 'bread' | 'glass' | 'pan' | 'tray';

/** Hauptproteinquelle – dient der Abwechslung von Tag zu Tag. */
export type Protein = 'rind' | 'schwein' | 'huhn' | 'fisch' | 'ei' | 'kaese' | 'milch' | 'tofu' | 'huelsen' | 'getreide' | 'gemuese' | 'nuss';

/** Nährwerte je 100 g (bzw. 100 ml): kcal, Eiweiß, Kohlenhydrate, Fett, Ballaststoffe. */
export type Nutr = [number, number, number, number, number];

export interface Ingredient {
  id: string;
  name: string;
  cat: Category;
  unit: Unit;
  /** Packungsgröße in kanonischer Einheit */
  pack: number;
  /** geschätzter Preis je Packung in Euro */
  price: number;
  packLabel?: string;
  n: Nutr;
  /** Gramm je Stück (für stk) bzw. ungefähres Stückgewicht für die Anzeige */
  pg?: number;
  /** Stückbezeichnung [Singular, Plural] – für stk die Zutat selbst, für g/ml die Hilfsangabe */
  pl?: [string, string];
  al?: Allergen[];
  an?: Animal[];
  /** nennenswerter Laktosegehalt */
  lac?: boolean;
  grp?: Group;
  /** Grundvorrat (Salz, Pfeffer, Öl …) */
  staple?: boolean;
  /** kostet nichts und erscheint nicht auf der Einkaufsliste (Leitungswasser) */
  free?: boolean;
  /** lose Ware: Preis anteilig, Kauf auf das Stück gerundet */
  loose?: boolean;
  /** Haltbarkeit nach Kauf bzw. Anbruch in Tagen (nur verderbliche Ware) */
  keep?: number;
  el?: number;
  tl?: number;
  /** Farbe für die Gericht-Illustration */
  col: string;
  /** Ersatz-Zutaten in Reihenfolge der Eignung */
  sub?: string[];
  /** Faktor für den Ersatz (Standard 1) */
  subF?: Record<string, number>;
  /** in Illustrationen ignorieren (Gewürze, Brühe, Wasser) */
  hide?: boolean;
}

export interface RecipeItem {
  i: string;
  a: number;
  u?: ItemUnit;
  opt?: boolean;
  note?: string;
}

export interface Recipe {
  id: string;
  name: string;
  meals: MealType[];
  servings: number;
  prep: number;
  cook: number;
  /** passive Wartezeit (z. B. über Nacht im Kühlschrank) – zählt nicht zur Kochzeit */
  rest?: number;
  diff: 1 | 2 | 3;
  /** benötigte Geräte; "ofen|airfryer" heißt: eines von beiden */
  equip: string[];
  cuisine: Cuisine;
  protein: Protein;
  visual: Visual;
  /** lässt sich gut aufwärmen bzw. mitnehmen (für Reste und Meal-Prep) */
  keeps?: boolean;
  tags: string[];
  items: RecipeItem[];
  steps: string[];
  tips?: string[];
  /** rezeptspezifischer Ersatz: Zutat → [Ersatz-ID, Faktor, Hinweis] */
  isub?: Record<string, [string, number, string]>;
  source?: 'eigen' | 'ki';
  createdAt?: number;
}

export type Activity = 'sitzend' | 'leicht' | 'aktiv' | 'sehr-aktiv';
export type Sex = 'w' | 'm' | 'x';
export type Goal = 'ausgewogen' | 'protein' | 'gemuese' | 'leichter' | 'sparen' | 'schnell' | 'familie';
export type LunchMode = 'kochen' | 'reste' | 'aus';
export type Intolerance = 'laktose';

export interface Profile {
  age: number;
  sex: Sex;
  activity: Activity;
  goals: Goal[];
  diet: Diet;
  allergens: Allergen[];
  intolerances: Intolerance[];
  dislikes: string[];
  likes: string[];
  cuisines: Cuisine[];
  persons: number;
  portion: number;
  breakfast: boolean;
  lunch: LunchMode;
  dinner: boolean;
  snacks: number;
  budget: number;
  maxTime: number;
  maxTimeWeekend: number;
  equipment: Equipment[];
  /** true, solange das Beispielprofil noch nicht angepasst wurde */
  example: boolean;
}

export interface PlannedMeal {
  r: string;
  /** Portionen, die in dieser Mahlzeit gegessen werden */
  s: number;
  /** zusätzlich gekochte Portionen für Reste am Folgetag */
  x?: number;
  /** Reste vom Abendessen des Tages mit diesem Index */
  from?: number;
  lock?: boolean;
  done?: boolean;
}

export type DayPlan = Partial<Record<SlotId, PlannedMeal | null>>;

export interface WeekPlan {
  start: string;
  days: DayPlan[];
  seed: number;
  createdAt: number;
}

export interface PantryItem {
  i: string;
  /** Menge in kanonischer Einheit; null = ausreichend vorhanden */
  a: number | null;
  /** Mindesthaltbarkeit bzw. "verbrauchen bis" (YYYY-MM-DD) */
  exp?: string;
  added: number;
}

export interface ManualItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ShoppingState {
  checked: Record<string, boolean>;
  manual: ManualItem[];
}

export interface Prefs {
  favorites: string[];
  ratings: Record<string, number>;
  prices: Record<string, number>;
}

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface UiPrefs {
  theme: ThemeChoice;
  nutrition: boolean;
  usePantry: boolean;
}

export interface AppState {
  profile: Profile;
  ui: UiPrefs;
  plans: Record<string, WeekPlan>;
  prefs: Prefs;
  pantry: PantryItem[];
  shopping: Record<string, ShoppingState>;
  recipes: Recipe[];
}

export type SliceKey = 'profile' | 'plans' | 'prefs' | 'pantry' | 'shopping' | 'recipes';
