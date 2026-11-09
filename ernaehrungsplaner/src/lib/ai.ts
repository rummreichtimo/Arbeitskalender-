import type { Cuisine, Equipment, MealType, PantryItem, Profile, Protein, Recipe, RecipeItem, Visual } from './types';
import { getSample } from './platform';
import { INGREDIENTS, ING } from '../data/ingredients';
import { violates } from './recipe';
import { ALLERGEN_LABEL, CUISINES, DIET_LABEL, GOAL_LABEL } from '../data/labels';

// KI-Funktionen über die sample-Capability (Claude, auf dem Konto der Person, die die Seite nutzt).

/* eslint-disable @typescript-eslint/no-explicit-any */
let blocked = false;

export async function aiAvailable(): Promise<boolean> {
  if (blocked) return false;
  const s = await getSample();
  return !!s;
}

export function aiErrorText(e: any): string {
  const code = e?.code;
  switch (code) {
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
    case 'capability_removed':
      blocked = true;
      return 'Claude ist für diese Seite nicht freigegeben. Die übrigen Funktionen laufen normal weiter.';
    case 'rate_limited':
      return 'Gerade zu viele Anfragen. Versuch es in ein paar Minuten noch einmal.';
    case 'session_expired':
      return 'Bitte melde dich erneut an, um Claude zu nutzen.';
    case 'invalid_json':
      return 'Die Antwort ließ sich nicht als Rezept lesen. Versuch es noch einmal.';
    case 'refused':
      return 'Zu dieser Anfrage gibt es keine Antwort. Formuliere den Wunsch etwas anders.';
    case 'cancelled':
      return '';
    default:
      return 'Claude ist gerade nicht erreichbar. Versuch es gleich noch einmal.';
  }
}

export function isBlocked() {
  return blocked;
}

function constraintsText(p: Profile): string {
  const parts = [`Ernährungsweise: ${DIET_LABEL[p.diet]}`];
  if (p.allergens.length) parts.push(`Allergien: ${p.allergens.map((a) => ALLERGEN_LABEL[a]).join(', ')}`);
  if (p.intolerances.includes('laktose')) parts.push('Laktoseintoleranz');
  if (p.dislikes.length) parts.push(`mag nicht: ${p.dislikes.map((d) => ING[d]?.name ?? d).join(', ')}`);
  if (p.goals.length) parts.push(`Ziele: ${p.goals.map((g) => GOAL_LABEL[g]).join(', ')}`);
  return parts.join('; ');
}

const VISUALS: Visual[] = ['plate', 'bowl', 'pasta', 'bread', 'glass', 'pan', 'tray'];
const PROTEINS: Protein[] = ['rind', 'schwein', 'huhn', 'fisch', 'ei', 'kaese', 'milch', 'tofu', 'huelsen', 'getreide', 'gemuese', 'nuss'];
const MEALS: MealType[] = ['fruehstueck', 'mittag', 'abend', 'snack'];

export interface RecipeRequest {
  profile: Profile;
  pantry: PantryItem[];
  expiring: string[];
  meal: MealType;
  wish: string;
  maxTime: number;
}

export async function generateRecipe(req: RecipeRequest, signal?: AbortSignal): Promise<Recipe> {
  const sample = await getSample();
  if (!sample) throw { code: 'not_granted' };
  const p = req.profile;
  const allowed = INGREDIENTS.filter((i) => !i.free && !violates(i, p));
  const catalog = allowed.map((i) => `${i.id}|${i.name}|${i.unit}`).join('\n');
  const pantryNames = req.pantry.filter((x) => ING[x.i] && !ING[x.i].staple).map((x) => ING[x.i].name);
  const equipment = p.equipment.join(', ') || 'keine besonderen Geräte';
  const prompt = `Du bist eine erfahrene Köchin und entwickelst ein alltagstaugliches, realistisches Rezept für einen deutschen Haushalt.

Vorgaben:
- Mahlzeit: ${req.meal === 'fruehstueck' ? 'Frühstück' : req.meal === 'snack' ? 'Snack' : req.meal === 'mittag' ? 'Mittagessen' : 'Abendessen'}
- Gesamtzeit höchstens ${req.maxTime} Minuten
- ${constraintsText(p)}
- Vorhandene Küchengeräte: ${equipment}
- Bitte möglichst diese Vorräte verwenden: ${pantryNames.join(', ') || '–'}
- Bald ablaufend, unbedingt verwenden: ${req.expiring.map((i) => ING[i]?.name ?? i).join(', ') || '–'}
- Wunsch: ${req.wish.trim() || 'kein besonderer Wunsch'}

Verwende AUSSCHLIESSLICH Zutaten aus diesem Katalog (Format id|Name|Einheit). Mengen in der Einheit des Katalogs (g, ml oder stk = Stück); Gewürze, Öl und Saucen dürfen stattdessen "u": "el", "tl" oder "prise" haben. Wasser nicht aufführen.
${catalog}

Antworte nur mit einem JSON-Objekt in genau dieser Form:
{"name": "…", "meals": ["abend"], "servings": 2, "prep": 15, "cook": 20, "diff": 1, "equip": ["herd"], "cuisine": "deutsch", "protein": "huelsen", "visual": "bowl", "keeps": true,
 "items": [{"i": "zwiebel", "a": 80}, {"i": "olivenoel", "a": 1, "u": "el"}],
 "steps": ["…", "…"], "tips": ["…"]}
Erlaubte Werte: meals aus ${MEALS.join(', ')}; diff 1 (einfach) bis 3; equip aus ${p.equipment.join(', ') || 'herd'}; cuisine aus ${CUISINES.map((c) => c.id).join(', ')}; protein aus ${PROTEINS.join(', ')}; visual aus ${VISUALS.join(', ')}.
Schritte auf Deutsch, präzise mit Temperaturen und Garzeiten, ohne Mengenangaben im Text. Mengen realistisch für die angegebene Portionenzahl.`;

  const data: any = await sample.json(prompt, { modelTier: 'default', cache: false, signal });
  return normalizeAiRecipe(data, p);
}

export function normalizeAiRecipe(data: any, p: Pick<Profile, 'equipment' | 'diet' | 'allergens' | 'intolerances' | 'dislikes'>): Recipe {
  if (!data || typeof data !== 'object') throw { code: 'invalid_json' };
  const num = (x: unknown, lo: number, hi: number, d: number) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const items: RecipeItem[] = [];
  for (const raw of Array.isArray(data.items) ? data.items : []) {
    const id = String(raw?.i ?? '');
    const ing = ING[id];
    if (!ing || ing.free || violates(ing, p)) continue;
    const u = raw?.u === 'el' || raw?.u === 'tl' || raw?.u === 'prise' ? raw.u : undefined;
    const a = num(raw?.a, 0, ing.unit === 'stk' ? 30 : 5000, 0);
    if (a <= 0) continue;
    items.push({ i: id, a, u, note: typeof raw?.note === 'string' ? raw.note.slice(0, 60) : undefined });
  }
  const steps = (Array.isArray(data.steps) ? data.steps : []).map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 12);
  if (items.length < 2 || steps.length < 2) throw { code: 'invalid_json' };
  const meals = (Array.isArray(data.meals) ? data.meals : []).filter((m: string) => MEALS.includes(m as MealType));
  const cuisine = CUISINES.some((c) => c.id === data.cuisine) ? (data.cuisine as Cuisine) : 'international';
  const equip = (Array.isArray(data.equip) ? data.equip : []).filter((e: string) => p.equipment.includes(e as Equipment));
  return {
    id: `ki-${Date.now().toString(36)}`,
    name: String(data.name ?? 'Rezeptidee').slice(0, 80),
    meals: meals.length ? meals : ['abend'],
    servings: Math.round(num(data.servings, 1, 8, 2)),
    prep: Math.round(num(data.prep, 0, 240, 15)),
    cook: Math.round(num(data.cook, 0, 480, 20)),
    diff: Math.round(num(data.diff, 1, 3, 1)) as 1 | 2 | 3,
    equip,
    cuisine,
    protein: PROTEINS.includes(data.protein) ? data.protein : 'gemuese',
    visual: VISUALS.includes(data.visual) ? data.visual : 'plate',
    keeps: !!data.keeps,
    tags: ['ki-idee'],
    items,
    steps,
    tips: (Array.isArray(data.tips) ? data.tips : []).map((x: unknown) => String(x)).filter(Boolean).slice(0, 4),
    source: 'ki',
    createdAt: Date.now(),
  };
}

export async function streamText(prompt: string, onText: (t: string) => void, signal: AbortSignal, tier: 'quick' | 'default'): Promise<string> {
  const sample = await getSample();
  if (!sample) throw { code: 'not_granted' };
  const res = await sample(prompt, { onText: ({ text }: { text: string }) => onText(text), signal, modelTier: tier, cache: false });
  return res.text;
}

export function weekReviewPrompt(summary: string, p: Profile): string {
  return `Du bist eine freundliche Ernährungsberaterin. Schau dir diesen Wochenplan an und gib 3 bis 5 kurze, konkrete Tipps auf Deutsch, wie die Woche noch ausgewogener, abwechslungsreicher oder günstiger wird. Nenne Gerichte beim Namen. Keine Kalorienvorgaben, keine Diätratschläge, keine medizinischen Aussagen. Beachte: ${constraintsText(p)}.

Antwortformat: nur Stichpunkte, jeder beginnt mit "- ", höchstens zwei Sätze pro Punkt.

${summary}`;
}

export function recipeQuestionPrompt(recipeText: string, question: string, p: Profile): string {
  return `Du bist eine erfahrene Köchin. Beantworte die Frage zu diesem Rezept kurz und praktisch auf Deutsch (höchstens 120 Wörter). Beachte: ${constraintsText(p)}.

Rezept:
${recipeText}

Frage: ${question.trim()}`;
}
