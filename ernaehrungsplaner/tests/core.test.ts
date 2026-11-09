import { describe, expect, it } from 'vitest';
import { INGREDIENTS, ING } from '../src/data/ingredients';
import { RECIPES } from '../src/data/recipes';
import { analyze } from '../src/lib/recipe';
import { DEFAULT_PROFILE, basicPantry } from '../src/lib/defaults';
import { buildShopping, collectNeeds, packaging, deductFromPantry, addPurchasesToPantry } from '../src/lib/shopping';
import { generateWeek, ctxFrom, normalizeWeek, suggestForSlot, emptyWeek, type PlanInput } from '../src/lib/planner';
import { describeAmount, fmtFrac, isoWeek, weekStartOf } from '../src/lib/format';
import type { Profile, WeekPlan } from '../src/lib/types';

const base = (p: Partial<Profile> = {}): PlanInput => ({
  profile: { ...DEFAULT_PROFILE, ...p },
  recipes: RECIPES,
  favorites: [],
  ratings: {},
  prices: {},
  pantry: basicPantry(),
  recent: [],
  start: '2026-11-09',
  seed: 42,
});

describe('Daten', () => {
  it('alle Rezeptzutaten und Ersatzzutaten existieren', () => {
    for (const r of RECIPES) {
      for (const it of r.items) {
        expect(ING[it.i], `${r.id}: ${it.i}`).toBeDefined();
        expect(Number.isFinite(it.a) && it.a > 0, `${r.id}: Menge ${it.i}`).toBe(true);
      }
      expect(r.steps.length).toBeGreaterThan(0);
    }
    for (const i of INGREDIENTS) for (const s of i.sub ?? []) expect(ING[s], `${i.id} → ${s}`).toBeDefined();
  });

  it('IDs sind eindeutig', () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    expect(new Set(INGREDIENTS.map((r) => r.id)).size).toBe(INGREDIENTS.length);
  });

  it('Preise und Nährwerte je Portion sind plausibel', () => {
    for (const r of RECIPES) {
      const a = analyze(r, DEFAULT_PROFILE, ['herd', 'ofen', 'stabmixer', 'mixer', 'airfryer'], {});
      const main = r.meals.includes('abend') || r.meals.includes('mittag');
      expect(a.cost, r.id).toBeGreaterThan(0.1);
      expect(a.cost, r.id).toBeLessThan(6);
      if (main && !r.meals.includes('fruehstueck')) {
        expect(a.nutr[0], `${r.id} kcal`).toBeGreaterThan(280);
        expect(a.nutr[0], `${r.id} kcal`).toBeLessThan(1200);
      }
    }
  });
});

describe('Anpassung an das Profil', () => {
  it('vegan ersetzt Milchprodukte und schließt Fleischgerichte aus', () => {
    const vegan = { ...DEFAULT_PROFILE, diet: 'vegan' as const };
    const porridge = analyze(RECIPES.find((r) => r.id === 'apfel-zimt-porridge')!, vegan, ['herd'], {});
    expect(porridge.ok).toBe(true);
    expect(porridge.items.map((i) => i.i)).toContain('haferdrink');
    expect(porridge.items.map((i) => i.i)).toContain('ahornsirup');
    expect(porridge.diet).toBe('vegan');
    const bolo = analyze(RECIPES.find((r) => r.id === 'spaghetti-bolognese')!, vegan, ['herd'], {});
    expect(bolo.ok).toBe(false);
  });

  it('Glutenfrei + vegan nimmt Sojadrink statt Haferdrink', () => {
    const p = { ...DEFAULT_PROFILE, diet: 'vegan' as const, allergens: ['gluten' as const] };
    const a = analyze(RECIPES.find((r) => r.id === 'apfel-zimt-porridge')!, p, ['herd'], {});
    expect(a.items.map((i) => i.i)).toEqual(expect.arrayContaining(['gf-haferflocken', 'sojadrink']));
    expect(a.allergens).not.toContain('gluten');
  });

  it('Laktoseintoleranz nutzt laktosefreie Milch, Butter bleibt', () => {
    const p = { ...DEFAULT_PROFILE, intolerances: ['laktose' as const] };
    const a = analyze(RECIPES.find((r) => r.id === 'gemueselasagne')!, p, ['herd', 'ofen'], {});
    const ids = a.items.map((i) => i.i);
    expect(ids).toContain('milch-lf');
    expect(ids).toContain('butter');
  });

  it('Selleriefrei lässt optionalen Sellerie weg und ersetzt die Brühe', () => {
    const p = { ...DEFAULT_PROFILE, allergens: ['sellerie' as const] };
    const a = analyze(RECIPES.find((r) => r.id === 'minestrone')!, p, ['herd'], {});
    expect(a.omitted).toContain('sellerie');
    expect(a.items.map((i) => i.i)).toContain('bruehe-ohne-sellerie');
  });

  it('fehlendes Gerät schließt das Rezept aus', () => {
    const a = analyze(RECIPES.find((r) => r.id === 'gemueselasagne')!, DEFAULT_PROFILE, ['herd'], {});
    expect(a.ok).toBe(false);
    expect(a.missingEquip).toEqual(['ofen']);
  });
});

describe('Einkaufsliste', () => {
  const ctx = ctxFrom(base());
  const week: WeekPlan = emptyWeek('2026-11-09');
  week.days[0].abend = { r: 'spaghetti-bolognese', s: 2 };
  week.days[1].abend = { r: 'chili-con-carne', s: 2 };

  it('fasst gleiche Zutaten zusammen und skaliert Portionen', () => {
    const needs = collectNeeds(week, ctx);
    // Bolognese 400 g für 4 → 200 g für 2; Chili 400 g für 4 → 200 g für 2
    expect(needs.get('rinderhack')!.need).toBeCloseTo(400);
    expect(needs.get('rinderhack')!.recipes.size).toBe(2);
  });

  it('rechnet in Packungen und zieht Vorrat ab', () => {
    const res = buildShopping(week, ctx, [{ i: 'rinderhack', a: 150, added: 0 }], true);
    const hack = res.lines.find((l) => l.i === 'rinderhack')!;
    expect(hack.buy).toBeCloseTo(250);
    expect(hack.packs).toBe(1);
    expect(hack.cost).toBeCloseTo(ING.rinderhack.price);
    // Salz ist im Grundvorrat nicht enthalten, Öl schon nicht → steht auf der Liste
    expect(res.total).toBeGreaterThan(5);
  });

  it('Grundvorrat deckt Basics vollständig', () => {
    const res = buildShopping(week, ctx, basicPantry(), true);
    expect(res.lines.find((l) => l.i === 'salz')).toBeUndefined();
    expect(res.covered.find((l) => l.i === 'salz')).toBeDefined();
  });

  it('lose Ware wird auf ganze Stücke gerundet', () => {
    expect(packaging(ING.paprika, 1.5, ING.paprika.price).purchase).toBe(2);
    expect(packaging(ING.zwiebel, 120, ING.zwiebel.price).packs).toBe(1);
  });

  it('übernimmt Einkäufe in den Vorrat und zieht Gekochtes wieder ab', () => {
    const res = buildShopping(week, ctx, [], true);
    const pantry = addPurchasesToPantry([], res.lines.filter((l) => l.i === 'rinderhack'), new Date(2026, 10, 9));
    expect(pantry[0].a).toBe(500);
    const after = deductFromPantry(pantry, [{ i: 'rinderhack', qty: 200 }]);
    expect(after[0].a).toBe(300);
  });
});

describe('Planer', () => {
  it('erstellt eine volle, abwechslungsreiche Woche im Budget', () => {
    const { plan, quality } = generateWeek(base());
    expect(plan.days).toHaveLength(7);
    const dinners = plan.days.map((d) => d.abend?.r).filter(Boolean);
    expect(dinners).toHaveLength(7);
    expect(new Set(dinners).size).toBeGreaterThanOrEqual(6);
    for (const d of plan.days) expect(d.fruehstueck).toBeTruthy();
    expect(quality.cost).toBeLessThan(DEFAULT_PROFILE.budget * 1.05);
  });

  it('plant Reste vom Vorabend als Mittagessen', () => {
    const { plan } = generateWeek(base());
    const withLeftovers = plan.days.filter((d) => d.mittag?.from !== undefined);
    expect(withLeftovers.length).toBeGreaterThan(2);
    for (let d = 0; d < 7; d++) {
      const m = plan.days[d].mittag;
      if (m?.from !== undefined) {
        expect(plan.days[m.from].abend!.r).toBe(m.r);
        expect(plan.days[m.from].abend!.x).toBe(m.s);
      }
    }
  });

  it('respektiert vegane Ernährung und Allergien', () => {
    const input = base({ diet: 'vegan', allergens: ['erdnuss', 'soja'] });
    const { plan } = generateWeek(input);
    const ctx = ctxFrom(input);
    for (const d of plan.days)
      for (const m of Object.values(d)) {
        if (!m) continue;
        const a = analyze(ctx.recipes[m.r], input.profile, input.profile.equipment, {});
        expect(a.diet).toBe('vegan');
        expect(a.allergens).not.toContain('soja');
        expect(a.allergens).not.toContain('erdnuss');
      }
  });

  it('behält gesperrte Mahlzeiten', () => {
    const first = generateWeek(base()).plan;
    first.days[3].abend = { r: 'rindergulasch-nudeln', s: 2, lock: true };
    normalizeWeek(first);
    const second = generateWeek({ ...base(), seed: 7, keep: first }).plan;
    expect(second.days[3].abend!.r).toBe('rindergulasch-nudeln');
    expect(second.days[3].abend!.lock).toBe(true);
  });

  it('kleines Budget führt zu günstigeren Plänen', () => {
    const cheap = generateWeek(base({ budget: 40 })).quality.cost;
    const rich = generateWeek(base({ budget: 150 })).quality.cost;
    expect(cheap).toBeLessThan(rich);
  });

  it('liefert Vorschläge zum Austauschen', () => {
    const { plan } = generateWeek(base());
    const s = suggestForSlot(base(), plan, 2, 'abend', 6);
    expect(s.length).toBe(6);
    expect(s.every((x) => x.analysis.recipe.id !== plan.days[2].abend!.r)).toBe(true);
  });
});

describe('Formatierung', () => {
  it('zeigt Mengen wie im Kochbuch', () => {
    expect(fmtFrac(0.5)).toBe('½');
    expect(fmtFrac(1.5)).toBe('1½');
    expect(describeAmount(ING.knoblauch, 2).label).toBe('Knoblauchzehen');
    expect(describeAmount(ING.kartoffel, 1250).amount).toBe('1,25 kg');
    expect(describeAmount(ING.olivenoel, 30, 'el').amount).toBe('3 EL');
  });
  it('Kalenderwoche', () => {
    expect(isoWeek('2026-11-09')).toBe(46);
    expect(weekStartOf(new Date(2026, 10, 12))).toBe('2026-11-09');
    expect(isoWeek('2027-01-04')).toBe(1);
  });
});
