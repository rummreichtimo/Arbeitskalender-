import React, { useMemo, useState } from 'react';
import { useUi, closeModal, openModal, replaceModal, type Modal as ModalT, toast } from '../state/ui';
import { useApp } from '../state/store';
import { Modal, Button, Stepper, Est } from '../ui/Controls';
import { Icon } from '../ui/Icon';
import { Dish } from '../ui/Dish';
import { RecipeDetail } from './RecipeDetail';
import { RecipeEditor } from './RecipeEditor';
import { AiRecipeModal } from './AiRecipe';
import {
  allRecipes, ensureWeek, moveMeal, planInput, recipeById, removeMeal, rerollMeal, setMealRecipe, setServings, toggleDone, toggleFavorite, toggleLock,
} from '../state/actions';
import { suggestForSlot, slotsFor } from '../lib/planner';
import { analyze } from '../lib/recipe';
import { SLOT_LABEL, SLOT_MEAL, SLOT_ORDER, WEEKDAYS, DIET_LABEL } from '../data/labels';
import { fmtEst, fmtFrac } from '../lib/format';
import { copyText, saveFile } from '../lib/platform';
import { ING } from '../data/ingredients';
import type { SlotId } from '../lib/types';
import { useAi } from '../state/hooks';

export function ModalRoot() {
  const { modals } = useUi();
  return (
    <>
      {modals.map((m, i) => (
        <ModalSwitch key={i + m.type} m={m} />
      ))}
    </>
  );
}

function ModalSwitch({ m }: { m: ModalT }) {
  switch (m.type) {
    case 'recipe':
      return <RecipeDetail id={m.id} servings={m.servings} day={m.day} slot={m.slot} />;
    case 'meal':
      return <MealModal day={m.day} slot={m.slot} />;
    case 'swap':
      return <SwapModal day={m.day} slot={m.slot} mode={m.mode} />;
    case 'addToPlan':
      return <AddToPlanModal id={m.id} />;
    case 'editor':
      return <RecipeEditor id={m.id} draft={m.draft} />;
    case 'ai':
      return <AiRecipeModal day={m.day} slot={m.slot} />;
    case 'export':
      return <ExportModal title={m.title} text={m.text} filename={m.filename} csv={m.csv} />;
    case 'confirm':
      return (
        <Modal
          title={m.title}
          footer={
            <>
              <Button onClick={closeModal}>Abbrechen</Button>
              <Button variant={m.danger ? 'danger' : 'primary'} onClick={() => { closeModal(); m.onConfirm(); }}>{m.confirm}</Button>
            </>
          }
        >
          <p>{m.body}</p>
        </Modal>
      );
  }
}

function MealModal({ day, slot }: { day: number; slot: SlotId }) {
  const s = useApp();
  const { week: start } = useUi();
  const week = s.plans[start];
  const m = week?.days[day]?.[slot];
  const [moveTo, setMoveTo] = useState<{ day: number; slot: SlotId }>({ day: (day + 1) % 7, slot });
  if (!week || !m) {
    return <Modal title="Mahlzeit"><p>Diese Mahlzeit gibt es nicht mehr.</p></Modal>;
  }
  const r = recipeById(m.r, s);
  const a = r ? analyze(r, s.profile, s.profile.equipment, s.prefs.prices) : undefined;
  const leftover = m.from !== undefined;
  const slots = slotsFor(s.profile).length ? slotsFor(s.profile) : SLOT_ORDER;
  const cooked = m.s + (leftover ? 0 : m.x ?? 0);
  return (
    <Modal title={`${WEEKDAYS[day]} · ${SLOT_LABEL[slot]}`}>
      {r && a ? (
        <div className="meal-sheet">
          <div className="meal-sheet-head">
            <Dish recipe={r} size={92} />
            <div>
              <h3>{r.name}</h3>
              <p className="meta">
                {leftover ? `Reste vom ${WEEKDAYS[m.from!]}abend – nur aufwärmen` : `${a.total} Min. · ${DIET_LABEL[a.diet]}`}
              </p>
              <p className="meta"><Est>{fmtEst(a.cost * cooked)} für {fmtFrac(cooked)} Portionen</Est></p>
            </div>
          </div>
          <div className="sheet-row">
            <span>Portionen {leftover ? '(Reste)' : ''}</span>
            <Stepper label="Portionen" value={m.s} min={0.5} max={20} step={0.5} format={(v) => fmtFrac(v)} onChange={(v) => setServings(start, day, slot, v)} />
          </div>
          {m.x ? <p className="muted small">Das Rezept wird mit {fmtFrac(m.x)} zusätzlichen Portionen für das Mittagessen am nächsten Tag gekocht.</p> : null}
          <div className="action-grid">
            <Button icon="book" onClick={() => replaceModal({ type: 'recipe', id: r.id, servings: cooked, day, slot })}>Rezept öffnen</Button>
            <Button icon="swap" onClick={() => replaceModal({ type: 'swap', day, slot, mode: 'swap' })}>Austauschen …</Button>
            <Button icon="shuffle" onClick={() => rerollMeal(start, day, slot)} disabled={m.lock}>Neu würfeln</Button>
            <Button icon={m.lock ? 'unlock' : 'lock'} onClick={() => toggleLock(start, day, slot)}>{m.lock ? 'Entsperren' : 'Sperren'}</Button>
            <Button icon="check" variant={m.done ? 'accent' : 'ghost'} onClick={() => toggleDone(start, day, slot)}>{m.done ? 'Nicht gekocht' : 'Als gekocht markieren'}</Button>
            <Button icon={s.prefs.favorites.includes(r.id) ? 'heartFill' : 'heart'} onClick={() => toggleFavorite(r.id)}>{s.prefs.favorites.includes(r.id) ? 'Favorit' : 'Zu Favoriten'}</Button>
          </div>
          <div className="move-box">
            <span className="move-label"><Icon name="move" size={15} /> Tauschen mit</span>
            <select aria-label="Tag" value={moveTo.day} onChange={(e) => setMoveTo({ ...moveTo, day: +e.target.value })}>
              {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
            </select>
            <select aria-label="Mahlzeit" value={moveTo.slot} onChange={(e) => setMoveTo({ ...moveTo, slot: e.target.value as SlotId })}>
              {slots.map((sl) => <option key={sl} value={sl}>{SLOT_LABEL[sl]}</option>)}
            </select>
            <Button small onClick={() => { moveMeal(start, { day, slot }, moveTo); closeModal(); }}>Tauschen</Button>
          </div>
          <p className="muted small">Gesperrte Gerichte bleiben beim Neuplanen der Woche erhalten. „Gekocht“ zieht die Zutaten aus dem Vorrat ab.</p>
          <div className="row-gap end">
            <Button variant="danger" icon="trash" onClick={() => { removeMeal(start, day, slot); closeModal(); }}>Entfernen</Button>
          </div>
        </div>
      ) : (
        <div className="row-gap">
          <Button icon="swap" onClick={() => replaceModal({ type: 'swap', day, slot, mode: 'swap' })}>Anderes Gericht wählen</Button>
          <Button variant="danger" icon="trash" onClick={() => { removeMeal(start, day, slot); closeModal(); }}>Entfernen</Button>
        </div>
      )}
    </Modal>
  );
}

const REASON_ICON: Record<string, string> = { fav: 'heart', rating: 'star', pantry: 'box', reste: 'refresh', cheap: 'euro', quick: 'clock', like: 'heart', expiring: 'alert', balance: 'leaf' };

function SwapModal({ day, slot, mode }: { day: number; slot: SlotId; mode: 'swap' | 'add' }) {
  const s = useApp();
  const { week: start } = useUi();
  const ai = useAi();
  const [q, setQ] = useState('');
  const week = s.plans[start];
  const suggestions = useMemo(() => {
    if (!week) return [];
    return suggestForSlot(planInput(start, 1, s), week, day, slot, 8);
  }, [week, s.profile, s.prefs, s.pantry, s.recipes, day, slot]);
  const mt = SLOT_MEAL[slot];
  const search = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return allRecipes(s)
      .map((r) => analyze(r, s.profile, s.profile.equipment, s.prefs.prices))
      .filter((a) => a.ok && (a.recipe.name.toLowerCase().includes(t) || a.items.some((it) => (ING[it.i]?.name ?? '').toLowerCase().includes(t))))
      .sort((x, y) => Number(y.recipe.meals.includes(mt)) - Number(x.recipe.meals.includes(mt)))
      .slice(0, 12);
  }, [q, s.recipes, s.profile, s.prefs.prices, mt]);
  const pick = (id: string) => {
    if (!week) ensureWeek(start);
    setMealRecipe(start, day, slot, id);
    closeModal();
  };
  const current = week?.days[day]?.[slot];
  return (
    <Modal title={`${mode === 'add' ? 'Gericht hinzufügen' : 'Austauschen'} · ${WEEKDAYS[day]}, ${SLOT_LABEL[slot]}`} wide>
      {current && mode === 'swap' ? <p className="muted">Bisher: {recipeById(current.r, s)?.name}. Vorschläge passen zu deinem Profil und berücksichtigen den Rest der Woche.</p> : <p className="muted">Vorschläge passen zu deinem Profil und berücksichtigen den Rest der Woche.</p>}
      <div className="search-box">
        <Icon name="search" size={17} />
        <input id="swap-search" type="search" placeholder="Rezept oder Zutat suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="suggest-list">
        {(q.trim() ? search.map((a) => ({ analysis: a, reasons: [] as { kind: string; text: string }[], score: 0 })) : suggestions).map(({ analysis: a, reasons }) => (
          <li key={a.recipe.id}>
            <button type="button" className="suggest" onClick={() => pick(a.recipe.id)}>
              <Dish recipe={a.recipe} size={56} />
              <span className="suggest-text">
                <span className="suggest-name">{a.recipe.name}</span>
                <span className="meta">{a.total} Min. · {DIET_LABEL[a.diet]} · <Est>{fmtEst(a.cost)} / Portion</Est></span>
                {reasons.length ? (
                  <span className="reason-row">
                    {reasons.slice(0, 3).map((rs, i) => (
                      <span key={i} className="reason"><Icon name={REASON_ICON[rs.kind] ?? 'info'} size={12} />{rs.text}</span>
                    ))}
                  </span>
                ) : null}
              </span>
            </button>
            <button type="button" className="icon-btn" aria-label={`Rezept ${a.recipe.name} ansehen`} title="Rezept ansehen" onClick={() => openModal({ type: 'recipe', id: a.recipe.id, day, slot })}>
              <Icon name="book" size={17} />
            </button>
          </li>
        ))}
      </ul>
      {q.trim() && !search.length ? <p className="muted">Kein passendes Rezept gefunden.</p> : null}
      {ai !== false ? (
        <div className="ai-cta">
          <Icon name="sparkles" size={18} />
          <span>Nichts dabei? Lass Claude ein neues Rezept aus deinem Vorrat entwickeln.</span>
          <Button small variant="accent" onClick={() => replaceModal({ type: 'ai', day, slot })} disabled={ai === null}>KI-Rezept</Button>
        </div>
      ) : null}
    </Modal>
  );
}

function AddToPlanModal({ id }: { id: string }) {
  const s = useApp();
  const { week: start } = useUi();
  const r = recipeById(id, s);
  const slots = slotsFor(s.profile).length ? slotsFor(s.profile) : SLOT_ORDER;
  const prefer = r?.meals.includes('abend') ? 'abend' : r?.meals.includes('fruehstueck') ? 'fruehstueck' : r?.meals.includes('snack') ? 'snack1' : 'mittag';
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<SlotId>(slots.includes(prefer as SlotId) ? (prefer as SlotId) : slots[0]);
  const week = s.plans[start];
  const occupied = week?.days[day]?.[slot];
  return (
    <Modal
      title="Zum Wochenplan hinzufügen"
      footer={
        <>
          <Button onClick={closeModal}>Abbrechen</Button>
          <Button variant="primary" icon="calendar" onClick={() => { if (!week) ensureWeek(start); setMealRecipe(start, day, slot, id); closeModal(); }}>Einplanen</Button>
        </>
      }
    >
      <p><strong>{r?.name}</strong></p>
      <div className="form-grid">
        <label className="field">
          <span>Tag</span>
          <select value={day} onChange={(e) => setDay(+e.target.value)}>
            {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Mahlzeit</span>
          <select value={slot} onChange={(e) => setSlot(e.target.value as SlotId)}>
            {slots.map((sl) => <option key={sl} value={sl}>{SLOT_LABEL[sl]}</option>)}
          </select>
        </label>
      </div>
      {occupied ? <p className="muted">Ersetzt: {recipeById(occupied.r, s)?.name ?? 'bisheriges Gericht'}</p> : null}
      <p className="muted small">Woche: KW der aktuell gewählten Woche im Wochenplan.</p>
    </Modal>
  );
}

function ExportModal({ title, text, filename, csv }: { title: string; text: string; filename: string; csv?: string }) {
  const [msg, setMsg] = useState('');
  const save = async (name: string, data: string) => {
    const res = await saveFile(name, data);
    if (res === 'saved') {
      setMsg('Datei gespeichert.');
      return;
    }
    if (res === 'declined') {
      setMsg('Speichern abgebrochen.');
      return;
    }
    setMsg('Herunterladen ist hier nicht möglich. Kopiere den Text stattdessen.');
  };
  return (
    <Modal title={title} wide>
      <textarea className="export-text" readOnly value={text} rows={14} onFocus={(e) => e.currentTarget.select()} aria-label="Exporttext" />
      <div className="row-gap">
        <Button variant="primary" icon="copy" onClick={async () => { const ok = await copyText(text); setMsg(ok ? 'In die Zwischenablage kopiert.' : 'Kopieren nicht möglich – markiere den Text und kopiere ihn selbst.'); if (ok) toast('Kopiert.'); }}>Kopieren</Button>
        <Button icon="download" onClick={() => save(filename, text)}>{filename.endsWith('.json') ? 'Als Datei speichern' : 'Als Textdatei'}</Button>
        {csv ? <Button icon="download" onClick={() => save(filename.replace(/\.txt$/, '.csv'), csv)}>Als Tabelle (CSV)</Button> : null}
      </div>
      {msg ? <p className="muted" role="status">{msg}</p> : null}
    </Modal>
  );
}
