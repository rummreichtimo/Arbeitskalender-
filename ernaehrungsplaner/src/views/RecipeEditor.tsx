import React, { useMemo, useState } from 'react';
import type { Cuisine, Equipment, ItemUnit, MealType, Protein, Recipe, RecipeItem, Visual } from '../lib/types';
import { useApp } from '../state/store';
import { closeModal, replaceModal, toast } from '../state/ui';
import { newRecipeId, recipeById, saveRecipe } from '../state/actions';
import { INGREDIENTS, ING, SUBSTITUTE_ONLY } from '../data/ingredients';
import { CATEGORIES, CUISINES, EQUIPMENT, MEAL_LABEL } from '../data/labels';
import { Modal, Button, Chip, Field, Segmented, Switch, IconButton } from '../ui/Controls';
import { Dish } from '../ui/Dish';
import { analyze } from '../lib/recipe';
import { fmtEst } from '../lib/format';

const PROTEIN_LABEL: Record<Protein, string> = {
  rind: 'Rind', schwein: 'Schwein', huhn: 'Geflügel', fisch: 'Fisch', ei: 'Ei', kaese: 'Käse', milch: 'Milchprodukte', tofu: 'Tofu', huelsen: 'Hülsenfrüchte', getreide: 'Getreide', gemuese: 'Gemüse', nuss: 'Nüsse & Saaten',
};
const VISUAL_LABEL: Record<Visual, string> = { plate: 'Teller', bowl: 'Schüssel', pasta: 'Pasta', bread: 'Brot', glass: 'Glas', pan: 'Pfanne', tray: 'Blech / Auflauf' };
const UNIT_LABEL = { g: 'g', ml: 'ml', stk: 'Stück' } as const;

interface Row {
  i: string;
  a: string;
  u: '' | ItemUnit;
  opt: boolean;
  note: string;
}

function toRows(items: RecipeItem[]): Row[] {
  return items.map((it) => ({ i: it.i, a: String(it.a).replace('.', ','), u: it.u ?? '', opt: !!it.opt, note: it.note ?? '' }));
}

export function RecipeEditor({ id, draft }: { id?: string; draft?: unknown }) {
  const s = useApp();
  const existing = id ? recipeById(id, s) : undefined;
  const base = (existing ?? (draft as Partial<Recipe> | undefined)) as Partial<Recipe> | undefined;
  const [name, setName] = useState(base?.name ?? '');
  const [meals, setMeals] = useState<MealType[]>(base?.meals ?? ['abend']);
  const [servings, setServings] = useState(String(base?.servings ?? 2));
  const [prep, setPrep] = useState(String(base?.prep ?? 15));
  const [cook, setCook] = useState(String(base?.cook ?? 20));
  const [diff, setDiff] = useState<'1' | '2' | '3'>(String(base?.diff ?? 1) as '1' | '2' | '3');
  const [cuisine, setCuisine] = useState<Cuisine>(base?.cuisine ?? 'deutsch');
  const [protein, setProtein] = useState<Protein>(base?.protein ?? 'gemuese');
  const [visual, setVisual] = useState<Visual>(base?.visual ?? 'plate');
  const [keeps, setKeeps] = useState(!!base?.keeps);
  const [equip, setEquip] = useState<string[]>(base?.equip ?? ['herd']);
  const [rows, setRows] = useState<Row[]>(base?.items?.length ? toRows(base.items) : [{ i: 'zwiebel', a: '80', u: '', opt: false, note: '' }]);
  const [steps, setSteps] = useState((base?.steps ?? []).join('\n'));
  const [tips, setTips] = useState((base?.tips ?? []).join('\n'));
  const [error, setError] = useState('');

  const options = useMemo(
    () => CATEGORIES.map((c) => ({ c, items: INGREDIENTS.filter((i) => i.cat === c.id && !i.free).sort((a, b) => Number(SUBSTITUTE_ONLY.has(a.id)) - Number(SUBSTITUTE_ONLY.has(b.id)) || a.name.localeCompare(b.name, 'de')) })),
    [],
  );

  const build = (): Recipe | null => {
    const items: RecipeItem[] = rows
      .map((r) => ({ i: r.i, a: Number(r.a.replace(',', '.')), u: r.u || undefined, opt: r.opt || undefined, note: r.note.trim() || undefined }))
      .filter((r) => ING[r.i] && Number.isFinite(r.a) && r.a > 0);
    const stepList = steps.split('\n').map((x) => x.trim()).filter(Boolean);
    if (!name.trim()) return null;
    return {
      id: existing?.id ?? newRecipeId(name),
      name: name.trim(),
      meals: meals.length ? meals : ['abend'],
      servings: Math.max(1, Math.min(12, Math.round(Number(servings) || 2))),
      prep: Math.max(0, Math.round(Number(prep) || 0)),
      cook: Math.max(0, Math.round(Number(cook) || 0)),
      diff: Number(diff) as 1 | 2 | 3,
      equip,
      cuisine,
      protein,
      visual,
      keeps,
      tags: existing?.tags ?? [],
      items,
      steps: stepList,
      tips: tips.split('\n').map((x) => x.trim()).filter(Boolean),
      source: existing?.source ?? ((draft as Recipe | undefined)?.source === 'ki' ? 'ki' : 'eigen'),
    };
  };

  const preview = build();
  const analysis = preview && preview.items.length ? analyze(preview, s.profile, s.profile.equipment, s.prefs.prices) : undefined;

  const save = () => {
    const r = build();
    if (!r) return setError('Gib dem Rezept einen Namen.');
    if (!r.items.length) return setError('Füge mindestens eine Zutat mit Menge hinzu.');
    if (!r.steps.length) return setError('Beschreibe mindestens einen Zubereitungsschritt.');
    saveRecipe(r);
    toast(existing ? 'Rezept gespeichert.' : 'Rezept angelegt.');
    replaceModal({ type: 'recipe', id: r.id });
  };

  const setRow = (k: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, i) => (i === k ? { ...r, ...patch } : r)));

  return (
    <Modal
      title={existing ? 'Rezept bearbeiten' : 'Eigenes Rezept'}
      wide
      footer={
        <>
          {error ? <span className="error-text">{error}</span> : null}
          <Button onClick={closeModal}>Abbrechen</Button>
          <Button variant="primary" icon="check" onClick={save}>Speichern</Button>
        </>
      }
    >
      <div className="editor">
        <div className="editor-top">
          {preview ? <Dish recipe={preview} size={96} /> : null}
          <div className="editor-top-fields">
            <Field label="Name" htmlFor="ed-name">
              <input id="ed-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Omas Linsensuppe" />
            </Field>
            {analysis ? <p className="muted small">{analysis.total} Min. · {fmtEst(analysis.cost)} pro Portion (geschätzt)</p> : null}
          </div>
        </div>

        <Field label="Passt zu">
          <div className="chip-row">
            {(Object.keys(MEAL_LABEL) as MealType[]).map((m) => (
              <Chip key={m} on={meals.includes(m)} onClick={() => setMeals((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]))}>{MEAL_LABEL[m]}</Chip>
            ))}
          </div>
        </Field>

        <div className="form-grid form-grid-4">
          <Field label="Portionen" htmlFor="ed-serv"><input id="ed-serv" type="number" min={1} max={12} value={servings} onChange={(e) => setServings(e.target.value)} /></Field>
          <Field label="Vorbereitung (Min.)" htmlFor="ed-prep"><input id="ed-prep" type="number" min={0} value={prep} onChange={(e) => setPrep(e.target.value)} /></Field>
          <Field label="Garzeit (Min.)" htmlFor="ed-cook"><input id="ed-cook" type="number" min={0} value={cook} onChange={(e) => setCook(e.target.value)} /></Field>
          <Field label="Schwierigkeit">
            <Segmented label="Schwierigkeit" value={diff} onChange={setDiff} options={[{ id: '1', label: 'Einfach' }, { id: '2', label: 'Mittel' }, { id: '3', label: 'Schwer' }]} />
          </Field>
        </div>

        <div className="form-grid form-grid-3">
          <Field label="Küche" htmlFor="ed-cuisine">
            <select id="ed-cuisine" value={cuisine} onChange={(e) => setCuisine(e.target.value as Cuisine)}>{CUISINES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          </Field>
          <Field label="Hauptzutat" htmlFor="ed-protein">
            <select id="ed-protein" value={protein} onChange={(e) => setProtein(e.target.value as Protein)}>{(Object.keys(PROTEIN_LABEL) as Protein[]).map((p) => <option key={p} value={p}>{PROTEIN_LABEL[p]}</option>)}</select>
          </Field>
          <Field label="Darstellung" htmlFor="ed-visual">
            <select id="ed-visual" value={visual} onChange={(e) => setVisual(e.target.value as Visual)}>{(Object.keys(VISUAL_LABEL) as Visual[]).map((v) => <option key={v} value={v}>{VISUAL_LABEL[v]}</option>)}</select>
          </Field>
        </div>

        <Field label="Benötigte Geräte">
          <div className="chip-row">
            {EQUIPMENT.map((e) => (
              <Chip key={e.id} on={equip.includes(e.id)} onClick={() => setEquip((x) => (x.includes(e.id) ? x.filter((y) => y !== e.id) : [...x, e.id as Equipment]))}>{e.label}</Chip>
            ))}
          </div>
        </Field>
        <Switch id="ed-keeps" checked={keeps} onChange={setKeeps} label="Gut zum Aufwärmen und Mitnehmen" hint="Solche Gerichte nutzt der Planer für Reste am nächsten Mittag." />

        <h3 className="editor-h">Zutaten</h3>
        <div className="ing-editor">
          {rows.map((r, k) => {
            const ing = ING[r.i];
            return (
              <div key={k} className="ing-row">
                <select aria-label="Zutat" value={r.i} onChange={(e) => setRow(k, { i: e.target.value, u: '' })}>
                  {options.map(({ c, items }) => (
                    <optgroup key={c.id} label={c.label}>
                      {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <input aria-label="Menge" type="text" inputMode="decimal" value={r.a} onChange={(e) => setRow(k, { a: e.target.value })} />
                <select aria-label="Einheit" value={r.u} onChange={(e) => setRow(k, { u: e.target.value as Row['u'] })}>
                  <option value="">{ing ? (ing.unit === 'stk' ? ing.pl?.[1] ?? 'Stück' : UNIT_LABEL[ing.unit]) : 'g'}</option>
                  {ing && ing.unit !== 'stk' ? (
                    <>
                      <option value="el">EL</option>
                      <option value="tl">TL</option>
                      <option value="prise">Prise</option>
                    </>
                  ) : null}
                </select>
                <input aria-label="Hinweis" type="text" placeholder="Hinweis" value={r.note} onChange={(e) => setRow(k, { note: e.target.value })} />
                <label className="mini-check"><input type="checkbox" checked={r.opt} onChange={(e) => setRow(k, { opt: e.target.checked })} /> optional</label>
                <IconButton icon="trash" label="Zutat entfernen" onClick={() => setRows((rs) => rs.filter((_, i) => i !== k))} />
              </div>
            );
          })}
          <Button small icon="plus" onClick={() => setRows((rs) => [...rs, { i: 'salz', a: '1', u: 'prise', opt: false, note: '' }])}>Zutat hinzufügen</Button>
        </div>

        <Field label="Zubereitung" htmlFor="ed-steps" hint="Ein Schritt pro Zeile.">
          <textarea id="ed-steps" rows={7} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={'Zwiebel würfeln und in Öl glasig dünsten.\n…'} />
        </Field>
        <Field label="Tipps (optional)" htmlFor="ed-tips" hint="Ein Tipp pro Zeile.">
          <textarea id="ed-tips" rows={3} value={tips} onChange={(e) => setTips(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
