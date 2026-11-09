import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { closeModal, openModal, replaceModal, useUi } from '../state/ui';
import { deleteRecipe, ensureWeek, rate, recipeById, setMealRecipe, toggleFavorite } from '../state/actions';
import { servingsFor } from '../lib/planner';
import { analyze } from '../lib/recipe';
import { pantryAmount } from '../lib/shopping';
import { ING } from '../data/ingredients';
import { ALLERGEN_SHORT, CUISINE_LABEL, DIET_LABEL, DIFFICULTY_LABEL, EQUIPMENT_LABEL, MEAL_LABEL, SLOT_LABEL, WEEKDAYS } from '../data/labels';
import { describeAmount, fmt0, fmt1, fmtEst, fmtFrac, fmtMinutes } from '../lib/format';
import { Modal, Button, Stepper, Stars, Est } from '../ui/Controls';
import { Icon } from '../ui/Icon';
import { Dish } from '../ui/Dish';
import { useAi } from '../state/hooks';
import { aiErrorText, recipeQuestionPrompt, streamText } from '../lib/ai';
import type { Equipment, SlotId } from '../lib/types';

export function RecipeDetail({ id, servings, day, slot }: { id: string; servings?: number; day?: number; slot?: SlotId }) {
  const s = useApp();
  const { week: start } = useUi();
  const recipe = recipeById(id, s);
  const [n, setN] = useState<number>(servings ?? servingsFor(s.profile));
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const a = useMemo(() => (recipe ? analyze(recipe, s.profile, s.profile.equipment, s.prefs.prices) : undefined), [recipe, s.profile, s.prefs.prices]);
  if (!recipe || !a) return <Modal title="Rezept"><p>Dieses Rezept gibt es nicht mehr.</p></Modal>;

  const factor = n / recipe.servings;
  const fav = s.prefs.favorites.includes(recipe.id);
  const custom = !!recipe.source;
  const alternatives = a.items
    .filter((it) => !it.from && ING[it.i]?.sub?.length)
    .map((it) => ({ from: ING[it.i], to: ING[it.i].sub!.slice(0, 2).map((x) => ING[x]?.name).filter(Boolean) }))
    .filter((x) => x.to.length)
    .slice(0, 6);
  const inSlot = day !== undefined && slot !== undefined;

  return (
    <Modal title={recipe.name} wide>
      <div className="recipe">
        <div className="recipe-hero">
          <figure className="recipe-figure">
            <Dish recipe={recipe} size={168} />
            <figcaption>Illustration aus den Zutaten</figcaption>
          </figure>
          <div className="recipe-summary">
            <div className="chip-row">
              {recipe.meals.map((m) => <span key={m} className="tag">{MEAL_LABEL[m]}</span>)}
              <span className="tag tag-diet">{DIET_LABEL[a.diet]}</span>
              <span className="tag">{CUISINE_LABEL[recipe.cuisine]}</span>
              {recipe.source === 'ki' ? <span className="tag tag-ai"><Icon name="sparkles" size={12} /> KI-Rezept</span> : null}
              {recipe.source === 'eigen' ? <span className="tag">Eigenes Rezept</span> : null}
            </div>
            <dl className="facts">
              <div><dt>Gesamtzeit</dt><dd>{fmtMinutes(a.total)}</dd></div>
              <div><dt>Vorbereitung</dt><dd>{fmtMinutes(recipe.prep)}</dd></div>
              <div><dt>Garen</dt><dd>{recipe.cook ? fmtMinutes(recipe.cook) : '–'}</dd></div>
              {recipe.rest ? <div><dt>Ruhezeit</dt><dd>{fmtMinutes(recipe.rest)}</dd></div> : null}
              <div><dt>Schwierigkeit</dt><dd>{DIFFICULTY_LABEL[recipe.diff]}</dd></div>
              <div className="fact-wide"><dt>Kosten pro Portion</dt><dd><Est>{fmtEst(a.cost)}</Est></dd></div>
            </dl>
            {recipe.equip.length ? (
              <p className="muted small">
                <Icon name="utensils" size={14} /> {recipe.equip.map((e) => e.split('|').map((x) => EQUIPMENT_LABEL[x as Equipment] ?? x).join(' oder ')).join(', ')}
              </p>
            ) : <p className="muted small"><Icon name="utensils" size={14} /> Keine besonderen Geräte nötig</p>}
            <div className="recipe-actions">
              <Button icon={fav ? 'heartFill' : 'heart'} variant={fav ? 'accent' : 'ghost'} onClick={() => toggleFavorite(recipe.id)}>{fav ? 'Favorit' : 'Merken'}</Button>
              <Stars value={s.prefs.ratings[recipe.id] ?? 0} onRate={(v) => rate(recipe.id, v)} />
            </div>
            <div className="recipe-actions">
              {inSlot ? (
                <Button variant="primary" icon="calendar" onClick={() => { if (!s.plans[start]) ensureWeek(start); setMealRecipe(start, day!, slot!, recipe.id); closeModal(); }}>
                  Für {WEEKDAYS[day!]}, {SLOT_LABEL[slot!]} wählen
                </Button>
              ) : (
                <Button variant="primary" icon="calendar" onClick={() => openModal({ type: 'addToPlan', id: recipe.id })}>Einplanen</Button>
              )}
              {custom ? (
                <>
                  <Button icon="edit" onClick={() => replaceModal({ type: 'editor', id: recipe.id })}>Bearbeiten</Button>
                  <Button icon="trash" variant="quiet" onClick={() => openModal({ type: 'confirm', title: 'Rezept löschen?', body: `„${recipe.name}“ wird aus deinen Rezepten entfernt.`, confirm: 'Löschen', danger: true, onConfirm: () => { deleteRecipe(recipe.id); closeModal(); } })}>Löschen</Button>
                </>
              ) : (
                <Button icon="copy" onClick={() => replaceModal({ type: 'editor', draft: { ...recipe, id: undefined, name: recipe.name + ' (meine Version)' } })}>Als eigene Version</Button>
              )}
            </div>
          </div>
        </div>

        {!a.ok ? (
          <div className="notice notice-warn">
            <Icon name="alert" size={18} />
            <div>
              <strong>Passt nicht zu deinem Profil.</strong>
              {a.blockers.length ? <p>Enthält {a.blockers.map((b) => ING[b]?.name).join(', ')} – dafür gibt es keinen passenden Ersatz.</p> : null}
              {a.missingEquip.length ? <p>Benötigt {a.missingEquip.map((e) => e.split('|').map((x) => EQUIPMENT_LABEL[x as Equipment] ?? x).join(' oder ')).join(', ')}.</p> : null}
              <p className="small">Der Planer schlägt dieses Rezept deshalb nicht automatisch vor.</p>
            </div>
          </div>
        ) : null}
        {a.swaps.length || a.omitted.length ? (
          <div className="notice">
            <Icon name="check" size={18} />
            <div>
              <strong>Für dein Profil angepasst</strong>
              <ul>
                {a.swaps.map((sw) => <li key={sw.from}>{ING[sw.from]?.name} → {ING[sw.to]?.name}{sw.note ? ` (${sw.note})` : ''}</li>)}
                {a.omitted.map((o) => <li key={o}>{ING[o]?.name} weggelassen (optional)</li>)}
              </ul>
            </div>
          </div>
        ) : null}

        <div className="recipe-cols">
          <section className="ingredients" aria-labelledby="h-zutaten">
            <div className="section-head">
              <h3 id="h-zutaten">Zutaten</h3>
              <Stepper label="Portionen" value={n} min={0.5} max={20} step={recipe.servings % 1 === 0 && n >= 1 ? 1 : 0.5} format={(v) => `${fmtFrac(v)} ${v === 1 ? 'Portion' : 'Portionen'}`} onChange={setN} />
            </div>
            <ul className="ing-list">
              {a.items.map((it, idx) => {
                const ing = ING[it.i];
                if (!ing) return null;
                const qty = it.qty * factor;
                const amt = describeAmount(ing, qty, it.u);
                const have = s.ui.usePantry && pantryAmount(s.pantry, it.i) >= qty * 0.999;
                return (
                  <li key={idx} className={it.from ? 'is-swapped' : ''}>
                    <span className="ing-amt">{amt.amount}</span>
                    <span className="ing-name">
                      {amt.label}
                      {it.note ? <span className="muted">, {it.note}</span> : null}
                      {amt.hint ? <span className="ing-hint">{amt.hint}</span> : null}
                      {it.opt ? <span className="tag tag-quiet">optional</span> : null}
                      {it.from ? <span className="tag tag-quiet">statt {ING[it.from]?.name}</span> : null}
                    </span>
                    {have ? <span className="have" title="Im Vorrat"><Icon name="box" size={14} /><span className="sr">im Vorrat</span></span> : null}
                  </li>
                );
              })}
            </ul>
            <p className="muted small">Mengen gelten für {fmtFrac(n)} {n === 1 ? 'Portion' : 'Portionen'} (Rezept für {recipe.servings}). Wasser, Salz für Nudelwasser und Pfeffer nach Geschmack.</p>

            <h4>Allergene</h4>
            {a.allergens.length ? (
              <div className="chip-row">{a.allergens.map((al) => <span key={al} className="tag tag-allergen">{ALLERGEN_SHORT[al]}</span>)}</div>
            ) : <p className="muted small">Enthält keines der 14 Hauptallergene laut Zutatenliste.</p>}
            <p className="muted small">Abgeleitet aus den Zutaten. Prüfe bei Allergien immer die Packungsangaben – Spuren und Rezepturen variieren je nach Hersteller.</p>

            {s.ui.nutrition ? <NutritionTable nutr={a.nutr} /> : (
              <details className="details">
                <summary>Nährwerte anzeigen</summary>
                <NutritionTable nutr={a.nutr} />
              </details>
            )}
          </section>

          <section className="steps" aria-labelledby="h-zubereitung">
            <h3 id="h-zubereitung">Zubereitung</h3>
            <ol className="step-list">
              {recipe.steps.map((st, i) => (
                <li key={i} className={doneSteps.has(i) ? 'is-done' : ''}>
                  <button type="button" aria-pressed={doneSteps.has(i)} onClick={() => setDoneSteps((d) => { const x = new Set(d); if (x.has(i)) x.delete(i); else x.add(i); return x; })}>
                    <span className="step-num">{doneSteps.has(i) ? <Icon name="check" size={14} /> : i + 1}</span>
                    <span>{st}</span>
                  </button>
                </li>
              ))}
            </ol>
            {recipe.tips?.length || alternatives.length ? (
              <>
                <h4>Tipps & Alternativen</h4>
                <ul className="tips">
                  {recipe.tips?.map((t, i) => <li key={'t' + i}>{t}</li>)}
                  {alternatives.map((x) => <li key={x.from.id}>Statt {x.from.name}: {x.to.join(' oder ')}</li>)}
                </ul>
              </>
            ) : null}
            <AskClaude recipeId={recipe.id} servings={n} />
          </section>
        </div>
      </div>
    </Modal>
  );
}

function NutritionTable({ nutr }: { nutr: number[] }) {
  return (
    <div className="nutr-box">
      <h4>Nährwerte pro Portion <span className="est-mark">geschätzt</span></h4>
      <table className="nutr-table">
        <tbody>
          <tr><th>Energie</th><td>{fmt0(nutr[0])} kcal</td></tr>
          <tr><th>Eiweiß</th><td>{fmt1(nutr[1])} g</td></tr>
          <tr><th>Kohlenhydrate</th><td>{fmt1(nutr[2])} g</td></tr>
          <tr><th>Fett</th><td>{fmt1(nutr[3])} g</td></tr>
          <tr><th>Ballaststoffe</th><td>{fmt1(nutr[4])} g</td></tr>
        </tbody>
      </table>
      <p className="muted small">Berechnet aus Durchschnittswerten der Zutaten. Tatsächliche Werte hängen von Produkt und Zubereitung ab.</p>
    </div>
  );
}

function AskClaude({ recipeId, servings }: { recipeId: string; servings: number }) {
  const ai = useAi();
  const s = useApp();
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ctl = useRef<AbortController | null>(null);
  if (ai === false) return null;
  const recipe = recipeById(recipeId, s);
  if (!recipe) return null;
  const ask = async (question: string) => {
    if (!question.trim()) return;
    const a = analyze(recipe, s.profile, s.profile.equipment, s.prefs.prices);
    const factor = servings / recipe.servings;
    const text = `${recipe.name} (${fmtFrac(servings)} Portionen)\nZutaten:\n${a.items.map((it) => { const d = describeAmount(ING[it.i], it.qty * factor, it.u); return `- ${d.amount} ${d.label}`; }).join('\n')}\nZubereitung:\n${recipe.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}`;
    ctl.current = new AbortController();
    setBusy(true);
    setErr('');
    setAnswer('');
    try {
      await streamText(recipeQuestionPrompt(text, question, s.profile), setAnswer, ctl.current.signal, 'quick');
    } catch (e) {
      const m = aiErrorText(e);
      if (m) setErr(m);
    } finally {
      setBusy(false);
    }
  };
  const presets = ['Kann ich das vorkochen?', 'Womit kann ich Zutaten ersetzen?', 'Was passt als Beilage?'];
  return (
    <div className="ask">
      <h4><Icon name="sparkles" size={15} /> Frag Claude zum Rezept</h4>
      <div className="chip-row">
        {presets.map((p) => <button key={p} type="button" className="chip" disabled={busy || ai === null} onClick={() => { setQ(p); ask(p); }}>{p}</button>)}
      </div>
      <form className="ask-form" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input id={`ask-${recipeId}`} type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="z. B. Geht das auch im Airfryer?" aria-label="Frage an Claude" />
        {busy ? <Button small onClick={() => ctl.current?.abort()} icon="x">Stopp</Button> : <Button small variant="accent" type="submit" disabled={!q.trim() || ai === null}>Fragen</Button>}
      </form>
      {busy && !answer ? <p className="thinking">Claude denkt nach …</p> : null}
      {answer ? <p className="ask-answer">{answer}</p> : null}
      {err ? <p className="error-text">{err}</p> : null}
    </div>
  );
}
