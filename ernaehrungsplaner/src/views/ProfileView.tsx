import React, { useMemo, useRef, useState } from 'react';
import type { Activity, Allergen, Cuisine, Diet, Equipment, Goal, LunchMode, Sex, ThemeChoice } from '../lib/types';
import { useApp, resetAll } from '../state/store';
import { backupJson, currentWeekStart, ensureWeek, importBackup, regenerateWeek, updateProfile, updateUi } from '../state/actions';
import { openModal, toast } from '../state/ui';
import { ACTIVITIES, ALLERGENS, CUISINES, DIETS, EQUIPMENT, GOALS, INTOLERANCES } from '../data/labels';
import { INGREDIENTS, ING, SUBSTITUTE_ONLY } from '../data/ingredients';
import { energyReference, suggestedPortion } from '../lib/nutrition';
import { servingsFor } from '../lib/planner';
import { fmt0, fmtFrac } from '../lib/format';
import { Button, Chip, Field, Segmented, Stepper, Switch } from '../ui/Controls';
import { Icon } from '../ui/Icon';
import { SyncBadge } from '../App';

const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function IngredientPicker({ id, label, values, onChange, hint }: { id: string; label: string; values: string[]; onChange: (v: string[]) => void; hint: string }) {
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    return INGREDIENTS.filter((i) => !i.free && !i.staple && !SUBSTITUTE_ONLY.has(i.id) && !values.includes(i.id) && norm(i.name).includes(t)).slice(0, 6);
  }, [q, values]);
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="chip-row">
        {values.map((v) => (
          <span key={v} className="chip is-on">
            {ING[v]?.name ?? v}
            <button type="button" className="chip-x" aria-label={`${ING[v]?.name} entfernen`} onClick={() => onChange(values.filter((x) => x !== v))}><Icon name="x" size={12} /></button>
          </span>
        ))}
      </div>
      <div className="combo">
        <input id={id} type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zutat suchen …" autoComplete="off" />
        {matches.length ? (
          <ul className="combo-list">
            {matches.map((m) => <li key={m.id}><button type="button" onClick={() => { onChange([...values, m.id]); setQ(''); }}>{m.name}</button></li>)}
          </ul>
        ) : null}
      </div>
    </Field>
  );
}

export function ProfileView() {
  const s = useApp();
  const p = s.profile;
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Parameters<typeof updateProfile>[0]) => {
    updateProfile(patch);
    setDirty(true);
  };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const ref = energyReference(p.age, p.sex, p.activity);
  const sugg = suggestedPortion(p.activity);

  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const ok = importBackup(JSON.parse(String(reader.result)));
        toast(ok ? 'Sicherung wiederhergestellt.' : 'Die Datei ist keine Wochentisch-Sicherung.');
      } catch {
        toast('Die Datei konnte nicht gelesen werden.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="page page-profile">
      <header className="page-head">
        <div>
          <p className="eyebrow">Profil & Einstellungen</p>
          <h1>Deine Angaben</h1>
        </div>
        <SyncBadge />
      </header>

      {dirty || p.example ? (
        <div className="banner banner-sticky">
          <Icon name={p.example ? 'info' : 'refresh'} size={20} />
          <p>{p.example ? 'Du siehst das Beispielprofil. Jede Änderung macht es zu deinem eigenen.' : 'Änderungen gelten für neue Pläne. Gesperrte und gekochte Mahlzeiten bleiben beim Neuplanen erhalten.'}</p>
          {dirty ? <Button variant="primary" icon="shuffle" onClick={() => { regenerateWeek(currentWeekStart()); setDirty(false); }}>Diese Woche neu planen</Button> : null}
        </div>
      ) : null}

      <div className="profile-grid">
        <section className="card" aria-labelledby="h-about">
          <h2 id="h-about">Über dich</h2>
          <div className="form-grid">
            <Field label="Alter" htmlFor="pf-age">
              <input id="pf-age" type="number" min={14} max={110} value={p.age} onChange={(e) => set({ age: Math.max(14, Math.min(110, Number(e.target.value) || 30)) })} />
            </Field>
            <Field label="Geschlecht (optional)">
              <Segmented<Sex> label="Geschlecht" value={p.sex} onChange={(v) => set({ sex: v })} options={[{ id: 'w', label: 'weiblich' }, { id: 'm', label: 'männlich' }, { id: 'x', label: 'keine Angabe' }]} />
            </Field>
          </div>
          <Field label="Aktivitätsniveau">
            <div className="radio-cards">
              {ACTIVITIES.map((a) => (
                <label key={a.id} className={`radio-card${p.activity === a.id ? ' is-on' : ''}`}>
                  <input type="radio" name="activity" value={a.id} checked={p.activity === a.id} onChange={() => set({ activity: a.id as Activity })} />
                  <strong>{a.label}</strong>
                  <span>{a.hint}</span>
                </label>
              ))}
            </div>
          </Field>
          <p className="muted small">Richtwert für deinen Energiebedarf: etwa {fmt0(ref.low)}–{fmt0(ref.high)} kcal am Tag (Orientierung nach DGE, geschätzt). Der Planer zählt keine Kalorien – der Wert erscheint nur zum Vergleich.</p>
          <Field label="Ziele">
            <div className="chip-row">
              {GOALS.map((g) => <Chip key={g.id} on={p.goals.includes(g.id)} onClick={() => set({ goals: toggle<Goal>(p.goals, g.id) })} title={g.hint}>{g.label}</Chip>)}
            </div>
          </Field>
        </section>

        <section className="card" aria-labelledby="h-diet">
          <h2 id="h-diet">Ernährungsweise</h2>
          <div className="radio-cards radio-cards-diet">
            {DIETS.map((d) => (
              <label key={d.id} className={`radio-card${p.diet === d.id ? ' is-on' : ''}`}>
                <input type="radio" name="diet" value={d.id} checked={p.diet === d.id} onChange={() => set({ diet: d.id as Diet })} />
                <strong>{d.label}</strong>
                <span>{d.hint}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="card" aria-labelledby="h-allergy">
          <h2 id="h-allergy">Allergien & Unverträglichkeiten</h2>
          <p className="muted small">Betroffene Zutaten werden automatisch ersetzt (z. B. Milch durch Haferdrink) oder das Gericht wird nicht mehr vorgeschlagen.</p>
          <div className="chip-row">
            {ALLERGENS.map((a) => <Chip key={a.id} on={p.allergens.includes(a.id)} onClick={() => set({ allergens: toggle<Allergen>(p.allergens, a.id) })}>{a.label}</Chip>)}
          </div>
          <div className="chip-row">
            {INTOLERANCES.map((i) => <Chip key={i.id} on={p.intolerances.includes(i.id)} onClick={() => set({ intolerances: toggle(p.intolerances, i.id) })} title={i.hint}>{i.label}</Chip>)}
          </div>
          {p.intolerances.includes('laktose') ? <p className="muted small">{INTOLERANCES[0].hint}</p> : null}
        </section>

        <section className="card" aria-labelledby="h-likes">
          <h2 id="h-likes">Vorlieben</h2>
          <Field label="Lieblingsküchen">
            <div className="chip-row">
              {CUISINES.map((c) => <Chip key={c.id} on={p.cuisines.includes(c.id)} onClick={() => set({ cuisines: toggle<Cuisine>(p.cuisines, c.id) })}>{c.label}</Chip>)}
            </div>
          </Field>
          <IngredientPicker id="pf-likes" label="Mag ich besonders" values={p.likes} onChange={(v) => set({ likes: v })} hint="Gerichte mit diesen Zutaten kommen häufiger vor." />
          <IngredientPicker id="pf-dislikes" label="Mag ich nicht" values={p.dislikes} onChange={(v) => set({ dislikes: v })} hint="Wird ersetzt, weggelassen oder das Gericht entfällt." />
        </section>

        <section className="card" aria-labelledby="h-household">
          <h2 id="h-household">Haushalt & Mahlzeiten</h2>
          <div className="sheet-row">
            <span>Personen</span>
            <Stepper label="Personen" value={p.persons} min={1} max={12} onChange={(v) => set({ persons: v })} />
          </div>
          <Field label="Portionsgröße">
            <Segmented<string> label="Portionsgröße" value={String(p.portion)} onChange={(v) => set({ portion: Number(v) })} options={[{ id: '0.8', label: 'klein' }, { id: '1', label: 'normal' }, { id: '1.1', label: 'etwas mehr' }, { id: '1.25', label: 'groß' }]} />
          </Field>
          <p className="muted small">
            Ergibt {fmtFrac(servingsFor(p))} Portionen pro Mahlzeit.{sugg !== p.portion ? ` Für dein Aktivitätsniveau passt eher „${sugg === 1 ? 'normal' : sugg === 1.1 ? 'etwas mehr' : 'groß'}“.` : ''}
          </p>
          <Switch id="pf-breakfast" checked={p.breakfast} onChange={(v) => set({ breakfast: v })} label="Frühstück planen" />
          <Field label="Mittagessen">
            <Segmented<LunchMode> label="Mittagessen" value={p.lunch} onChange={(v) => set({ lunch: v })} options={[{ id: 'kochen', label: 'Kochen' }, { id: 'reste', label: 'Reste vom Vorabend' }, { id: 'aus', label: 'Nicht planen' }]} />
          </Field>
          {p.lunch === 'reste' ? <p className="muted small">Passende Abendessen werden mit Extra-Portionen gekocht und am nächsten Mittag aufgewärmt oder mitgenommen.</p> : null}
          <Switch id="pf-dinner" checked={p.dinner} onChange={(v) => set({ dinner: v })} label="Abendessen planen" />
          <Field label="Snacks pro Tag">
            <Segmented<string> label="Snacks" value={String(p.snacks)} onChange={(v) => set({ snacks: Number(v) })} options={[{ id: '0', label: 'keine' }, { id: '1', label: '1' }, { id: '2', label: '2' }]} />
          </Field>
        </section>

        <section className="card" aria-labelledby="h-budget">
          <h2 id="h-budget">Budget & Zeit</h2>
          <Field label={`Wochenbudget: ${fmt0(p.budget)} €`} htmlFor="pf-budget" hint={`Etwa ${(p.budget / Math.max(1, p.persons) / 7).toFixed(2).replace('.', ',')} € pro Person und Tag.`}>
            <div className="range-row">
              <input id="pf-budget" type="range" min={20} max={300} step={5} value={p.budget} onChange={(e) => set({ budget: Number(e.target.value) })} />
              <input type="number" aria-label="Wochenbudget in Euro" min={10} max={1000} value={p.budget} onChange={(e) => set({ budget: Math.max(10, Number(e.target.value) || 10) })} />
            </div>
          </Field>
          <Field label={`Kochzeit unter der Woche: bis ${p.maxTime} Min.`} htmlFor="pf-time">
            <input id="pf-time" type="range" min={10} max={120} step={5} value={p.maxTime} onChange={(e) => set({ maxTime: Number(e.target.value) })} />
          </Field>
          <Field label={`Am Wochenende: bis ${p.maxTimeWeekend} Min.`} htmlFor="pf-time-we">
            <input id="pf-time-we" type="range" min={10} max={180} step={5} value={p.maxTimeWeekend} onChange={(e) => set({ maxTimeWeekend: Number(e.target.value) })} />
          </Field>
        </section>

        <section className="card" aria-labelledby="h-kitchen">
          <h2 id="h-kitchen">Küchengeräte</h2>
          <p className="muted small">Rezepte, die ein fehlendes Gerät brauchen, werden nicht vorgeschlagen. Heißluftfritteuse ersetzt den Backofen, wo es passt.</p>
          <div className="chip-row">
            {EQUIPMENT.map((e) => <Chip key={e.id} on={p.equipment.includes(e.id)} onClick={() => set({ equipment: toggle<Equipment>(p.equipment, e.id) })}>{e.label}</Chip>)}
          </div>
        </section>

        <section className="card" aria-labelledby="h-app">
          <h2 id="h-app">Darstellung & Daten</h2>
          <Field label="Design">
            <Segmented<ThemeChoice> label="Design" value={s.ui.theme} onChange={(v) => updateUi({ theme: v })} options={[{ id: 'system', label: 'System', icon: 'monitor' }, { id: 'light', label: 'Hell', icon: 'sun' }, { id: 'dark', label: 'Dunkel', icon: 'moon' }]} />
          </Field>
          <Switch id="pf-nutr" checked={s.ui.nutrition} onChange={(v) => updateUi({ nutrition: v })} label="Geschätzte Nährwerte anzeigen" hint="Kalorien und Makronährstoffe im Plan und in Rezepten – nur zur Orientierung." />
          <Switch id="pf-pantry" checked={s.ui.usePantry} onChange={(v) => updateUi({ usePantry: v })} label="Vorrat beim Planen und Einkaufen berücksichtigen" />
          <p className="muted small">
            Gespeichert wird sofort auf diesem Gerät und – wenn du angemeldet bist – privat in deinem Konto, damit Plan und Einstellungen auf allen Geräten gleich sind.
          </p>
          <div className="row-gap">
            <Button icon="download" onClick={() => openModal({ type: 'export', title: 'Sicherung exportieren', text: backupJson(), filename: 'wochentisch-sicherung.json' })}>Sicherung exportieren</Button>
            <Button icon="upload" onClick={() => fileRef.current?.click()}>Sicherung laden</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
            <Button variant="danger" icon="trash" onClick={() => openModal({ type: 'confirm', title: 'Alles zurücksetzen?', body: 'Profil, Pläne, Vorrat, Einkaufslisten, Bewertungen und eigene Rezepte werden gelöscht – auf diesem Gerät und in deinem Konto. Exportiere vorher eine Sicherung, wenn du sie behalten möchtest.', confirm: 'Alles löschen', danger: true, onConfirm: () => { resetAll(); ensureWeek(currentWeekStart()); toast('Alles zurückgesetzt.'); } })}>Alles zurücksetzen</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
