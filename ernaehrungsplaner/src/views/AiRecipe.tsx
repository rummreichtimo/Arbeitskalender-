import React, { useMemo, useRef, useState } from 'react';
import type { MealType, Recipe, SlotId } from '../lib/types';
import { useApp } from '../state/store';
import { closeModal, replaceModal, toast, useUi } from '../state/ui';
import { ensureWeek, saveRecipe, setMealRecipe, todayISO } from '../state/actions';
import { aiErrorText, generateRecipe } from '../lib/ai';
import { analyze } from '../lib/recipe';
import { ING } from '../data/ingredients';
import { MEAL_LABEL, SLOT_LABEL, SLOT_MEAL, WEEKDAYS, DIET_LABEL } from '../data/labels';
import { daysBetween, describeAmount, fmtEst, fmtMinutes } from '../lib/format';
import { Modal, Button, Field, Est } from '../ui/Controls';
import { Icon } from '../ui/Icon';
import { Dish } from '../ui/Dish';

export function AiRecipeModal({ day, slot }: { day?: number; slot?: SlotId }) {
  const s = useApp();
  const { week: start } = useUi();
  const [meal, setMeal] = useState<MealType>(slot ? SLOT_MEAL[slot] : 'abend');
  const [wish, setWish] = useState('');
  const [maxTime, setMaxTime] = useState(String(s.profile.maxTime));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<Recipe | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const today = todayISO();
  const expiring = useMemo(() => s.pantry.filter((p) => p.exp && daysBetween(today, p.exp) <= 4).map((p) => p.i), [s.pantry, today]);
  const pantryNames = s.pantry.filter((p) => ING[p.i] && !ING[p.i].staple).map((p) => ING[p.i].name);

  const run = async () => {
    ctl.current = new AbortController();
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const r = await generateRecipe({ profile: s.profile, pantry: s.pantry, expiring, meal, wish, maxTime: Math.max(5, Number(maxTime) || s.profile.maxTime) }, ctl.current.signal);
      setResult(r);
    } catch (e) {
      const m = aiErrorText(e);
      if (m) setErr(m);
    } finally {
      setBusy(false);
    }
  };

  const a = result ? analyze(result, s.profile, s.profile.equipment, s.prefs.prices) : undefined;
  const inSlot = day !== undefined && slot !== undefined;

  return (
    <Modal title={<><Icon name="sparkles" size={18} /> KI-Rezept mit Claude</>} wide>
      {!result ? (
        <div className="ai-form">
          <p className="muted">Claude entwickelt ein Rezept, das zu deinem Profil passt und möglichst deinen Vorrat nutzt. Zutaten stammen aus der Zutatendatenbank, damit Mengen, Preise und Einkaufsliste stimmen. Nutzt dein Claude-Konto.</p>
          <div className="form-grid form-grid-3">
            <Field label="Mahlzeit" htmlFor="ai-meal">
              <select id="ai-meal" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
                {(Object.keys(MEAL_LABEL) as MealType[]).map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
              </select>
            </Field>
            <Field label="Höchstens (Min.)" htmlFor="ai-time">
              <input id="ai-time" type="number" min={5} max={240} value={maxTime} onChange={(e) => setMaxTime(e.target.value)} />
            </Field>
            <Field label="Ernährungsweise">
              <span className="static-field">{DIET_LABEL[s.profile.diet]}</span>
            </Field>
          </div>
          <Field label="Wunsch (optional)" htmlFor="ai-wish">
            <input id="ai-wish" type="text" value={wish} onChange={(e) => setWish(e.target.value)} placeholder="z. B. etwas Wärmendes mit Kürbis, kindertauglich" />
          </Field>
          <p className="muted small">
            Vorrat: {pantryNames.length ? pantryNames.slice(0, 12).join(', ') : 'nur Grundvorrat'}
            {expiring.length ? ` · bald ablaufend: ${expiring.map((i) => ING[i]?.name).join(', ')}` : ''}
          </p>
          {err ? <p className="error-text">{err}</p> : null}
          <div className="row-gap">
            {busy ? (
              <>
                <span className="thinking">Claude entwickelt ein Rezept … das dauert meist 20–60 Sekunden.</span>
                <Button icon="x" onClick={() => ctl.current?.abort()}>Stopp</Button>
              </>
            ) : (
              <Button variant="accent" icon="sparkles" onClick={run}>Rezept entwickeln</Button>
            )}
          </div>
        </div>
      ) : (
        <div className="ai-result">
          <div className="recipe-hero">
            <figure className="recipe-figure">
              <Dish recipe={result} size={130} />
              <figcaption>Illustration</figcaption>
            </figure>
            <div>
              <h3>{result.name}</h3>
              <p className="meta">{fmtMinutes(result.prep + result.cook)} · {result.servings} Portionen · {a ? DIET_LABEL[a.diet] : ''}</p>
              {a ? <p className="meta"><Est>{fmtEst(a.cost)} pro Portion</Est></p> : null}
              {a && !a.ok ? <p className="error-text">Hinweis: Das Rezept braucht ein Gerät, das in deinem Profil fehlt.</p> : null}
            </div>
          </div>
          <div className="recipe-cols">
            <section>
              <h4>Zutaten</h4>
              <ul className="ing-list">
                {(a?.items ?? []).map((it, k) => {
                  const d = describeAmount(ING[it.i], it.qty, it.u);
                  return <li key={k}><span className="ing-amt">{d.amount}</span><span className="ing-name">{d.label}</span></li>;
                })}
              </ul>
            </section>
            <section>
              <h4>Zubereitung</h4>
              <ol className="plain-steps">{result.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
              {result.tips?.length ? <><h4>Tipps</h4><ul className="tips">{result.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></> : null}
            </section>
          </div>
          <p className="muted small">KI-generiert: Bitte Garzeiten und Mengen beim Kochen kurz prüfen.</p>
          <div className="row-gap">
            {inSlot ? (
              <Button variant="primary" icon="calendar" onClick={() => { saveRecipe(result); if (!s.plans[start]) ensureWeek(start); setMealRecipe(start, day!, slot!, result.id); closeModal(); }}>
                Speichern & für {WEEKDAYS[day!]}, {SLOT_LABEL[slot!]} einplanen
              </Button>
            ) : null}
            <Button variant={inSlot ? 'ghost' : 'primary'} icon="check" onClick={() => { saveRecipe(result); toast('In „Meine Rezepte“ gespeichert.'); replaceModal({ type: 'recipe', id: result.id }); }}>Speichern</Button>
            <Button icon="edit" onClick={() => replaceModal({ type: 'editor', draft: result })}>Bearbeiten</Button>
            <Button icon="refresh" onClick={run} disabled={busy}>Neuer Vorschlag</Button>
          </div>
          {busy ? <p className="thinking">Claude entwickelt ein neues Rezept …</p> : null}
          {err ? <p className="error-text">{err}</p> : null}
        </div>
      )}
    </Modal>
  );
}
