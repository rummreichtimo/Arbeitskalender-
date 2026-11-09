import React, { useState } from 'react';
import type { View } from '../App';
import type { PlannedMeal, SlotId } from '../lib/types';
import { useWeekData } from '../state/hooks';
import { clearWeek, ensureWeek, moveMeal, recipeById, regenerateWeek, todayISO, currentWeekStart } from '../state/actions';
import { openModal, setWeek, useUi } from '../state/ui';
import { slotsFor } from '../lib/planner';
import { analyze } from '../lib/recipe';
import { Icon } from '../ui/Icon';
import { Button, Empty, Est, IconButton } from '../ui/Controls';
import { Dish } from '../ui/Dish';
import { SLOT_LABEL, WEEKDAYS, WEEKDAYS_SHORT } from '../data/labels';
import { addDays, fmt0, fmtDateShort, fmtEst, fmtMinutes, fmtWeekRange, isoWeek } from '../lib/format';

export function WeekNav({ start }: { start: string }) {
  const isCurrent = start === currentWeekStart();
  return (
    <div className="weeknav">
      <IconButton icon="chevronLeft" label="Vorige Woche" onClick={() => setWeek(addDays(start, -7))} />
      <div className="weeknav-label">
        <strong>KW {isoWeek(start)}</strong>
        <span>{fmtWeekRange(start)}</span>
      </div>
      <IconButton icon="chevronRight" label="Nächste Woche" onClick={() => setWeek(addDays(start, 7))} />
      {!isCurrent ? <Button small onClick={() => setWeek(currentWeekStart())}>Diese Woche</Button> : null}
    </div>
  );
}

export function PlanView({ go }: { go: (v: View) => void }) {
  const { week: start } = useUi();
  const { s, week, shopping, balance, ctx } = useWeekData(start);
  const [drag, setDrag] = useState<{ day: number; slot: SlotId } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const p = s.profile;
  const slots = slotsFor(p);
  const today = todayISO();

  if (!week) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <p className="eyebrow">Wochenplan</p>
            <h1>Was gibt’s diese Woche?</h1>
          </div>
          <WeekNav start={start} />
        </header>
        <Empty icon="calendar" title="Für diese Woche gibt es noch keinen Plan" action={<Button variant="primary" icon="sparkles" onClick={() => ensureWeek(start)}>Woche planen</Button>}>
          Wochentisch stellt aus deinem Profil, deinem Budget und deinem Vorrat einen abwechslungsreichen Plan zusammen.
        </Empty>
      </div>
    );
  }

  const usedSlots = slots.length ? slots : (['abend'] as SlotId[]);
  const extraSlots = (['fruehstueck', 'mittag', 'abend', 'snack1', 'snack2'] as SlotId[]).filter((sl) => !usedSlots.includes(sl) && week.days.some((d) => d[sl]));
  const rows = [...usedSlots, ...extraSlots];
  const cookMinutes = week.days.reduce((sum, d) => {
    for (const sl of rows) {
      const m = d[sl];
      if (m && m.from === undefined && ctx.recipes[m.r]) sum += ctx.recipes[m.r].prep + ctx.recipes[m.r].cook;
    }
    return sum;
  }, 0);

  const onDrop = (day: number, slot: SlotId) => {
    if (drag) moveMeal(start, drag, { day, slot });
    setDrag(null);
    setOver(null);
  };

  const cell = (day: number, slot: SlotId) => {
    const m = week.days[day]?.[slot];
    const key = `${day}-${slot}`;
    const dropProps = {
      onDragOver: (e: React.DragEvent) => {
        if (!drag) return;
        e.preventDefault();
        setOver(key);
      },
      onDragLeave: () => setOver((o) => (o === key ? null : o)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        onDrop(day, slot);
      },
    };
    if (!m) {
      return (
        <div className={`cell cell-empty${over === key ? ' is-over' : ''}`} {...dropProps}>
          <button type="button" className="add-btn" onClick={() => openModal({ type: 'swap', day, slot, mode: 'add' })} aria-label={`${SLOT_LABEL[slot]} am ${WEEKDAYS[day]} hinzufügen`}>
            <Icon name="plus" size={16} />
            <span>Gericht</span>
          </button>
        </div>
      );
    }
    return (
      <div className={`cell${over === key ? ' is-over' : ''}`} {...dropProps}>
        <MealCard
          meal={m}
          day={day}
          slot={slot}
          onDragStart={() => setDrag({ day, slot })}
          onDragEnd={() => {
            setDrag(null);
            setOver(null);
          }}
        />
      </div>
    );
  };

  const dayStats = (day: number) => {
    let kcal = 0;
    for (const sl of rows) {
      const m = week.days[day]?.[sl];
      const r = m && ctx.recipes[m.r];
      if (r) kcal += analyze(r, p, p.equipment, s.prefs.prices).nutr[0] * (p.portion || 1);
    }
    return kcal;
  };

  const over_ = shopping ? shopping.weekCost > p.budget : false;

  return (
    <div className="page page-plan">
      <header className="page-head">
        <div>
          <p className="eyebrow">Wochenplan</p>
          <h1>Was gibt’s diese Woche?</h1>
        </div>
        <WeekNav start={start} />
      </header>

      <div className="plan-toolbar">
        <div className="plan-stats">
          <span className={`stat${over_ ? ' is-over' : ''}`}>
            <Icon name="euro" size={15} />
            <Est>{fmtEst(shopping?.weekCost ?? 0)}</Est>
            <span className="muted">von {fmt0(p.budget)} €</span>
          </span>
          <span className="stat"><Icon name="clock" size={15} /> {fmtMinutes(cookMinutes)} Kochzeit</span>
          <span className="stat"><Icon name="utensils" size={15} /> {fmt0(p.persons)} {p.persons === 1 ? 'Person' : 'Personen'}</span>
          {balance ? <span className="stat"><Icon name="leaf" size={15} /> {balance.vegPerDay.toFixed(1).replace('.', ',')} Portionen Gemüse & Obst/Tag</span> : null}
        </div>
        <div className="row-gap">
          <Button icon="shuffle" variant="primary" onClick={() => regenerateWeek(start)} title="Gesperrte und gekochte Mahlzeiten bleiben erhalten">Woche neu planen</Button>
          <Button icon="cart" onClick={() => go('einkauf')}>Einkaufsliste</Button>
          <Button icon="trash" variant="quiet" onClick={() => openModal({ type: 'confirm', title: 'Woche leeren?', body: 'Alle Mahlzeiten dieser Woche werden entfernt. Du kannst das direkt danach rückgängig machen.', confirm: 'Woche leeren', danger: true, onConfirm: () => clearWeek(start) })}>Leeren</Button>
        </div>
      </div>
      <p className="hint-line"><Icon name="info" size={14} /> Gericht antippen für Rezept, Austauschen, Sperren und mehr. Am Computer lassen sich Gerichte per Drag & Drop zwischen Tagen tauschen.</p>

      <div className="board" style={{ ['--rows' as string]: rows.length }}>
        <div className="board-corner" />
        {week.days.map((_, d) => {
          const iso = addDays(start, d);
          return (
            <div key={d} className={`board-day${iso === today ? ' is-today' : ''}${iso < today ? ' is-past' : ''}`}>
              <span className="dow">{WEEKDAYS_SHORT[d]}</span>
              <span className="date">{fmtDateShort(iso)}</span>
              {iso === today ? <span className="today-tag">Heute</span> : null}
            </div>
          );
        })}
        {rows.map((slot) => (
          <React.Fragment key={slot}>
            <div className="board-slot">{SLOT_LABEL[slot]}</div>
            {week.days.map((_, d) => (
              <React.Fragment key={d}>{cell(d, slot)}</React.Fragment>
            ))}
          </React.Fragment>
        ))}
        {s.ui.nutrition ? (
          <>
            <div className="board-slot board-foot">kcal p. P.<span className="est-mark">geschätzt</span></div>
            {week.days.map((_, d) => (
              <div key={d} className="board-foot-cell">≈ {fmt0(dayStats(d))}</div>
            ))}
          </>
        ) : null}
      </div>

      <div className="daylist">
        {week.days.map((_, d) => {
          const iso = addDays(start, d);
          return (
            <section key={d} className={`daycard${iso === today ? ' is-today' : ''}`} aria-label={WEEKDAYS[d]}>
              <header>
                <h2>{WEEKDAYS[d]} <span className="muted">{fmtDateShort(iso)}</span></h2>
                {iso === today ? <span className="today-tag">Heute</span> : null}
                {s.ui.nutrition ? <span className="muted small"><Est>{fmt0(dayStats(d))} kcal p. P.</Est></span> : null}
              </header>
              <div className="daycard-slots">
                {rows.map((slot) => (
                  <div key={slot} className="daycard-slot">
                    <span className="slot-label">{SLOT_LABEL[slot]}</span>
                    {cell(d, slot)}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MealCard({ meal, day, slot, onDragStart, onDragEnd }: { meal: PlannedMeal; day: number; slot: SlotId; onDragStart: () => void; onDragEnd: () => void }) {
  const { week: start } = useUi();
  const { s } = useWeekData(start);
  const r = recipeById(meal.r, s);
  if (!r) {
    return (
      <button type="button" className="meal meal-missing" onClick={() => openModal({ type: 'meal', day, slot })}>
        <span className="meal-name">Rezept nicht mehr vorhanden</span>
      </button>
    );
  }
  const a = analyze(r, s.profile, s.profile.equipment, s.prefs.prices);
  const leftover = meal.from !== undefined;
  return (
    <button
      type="button"
      className={`meal${leftover ? ' is-leftover' : ''}${meal.done ? ' is-done' : ''}${meal.lock ? ' is-locked' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', r.name);
        } catch {
          /* ignorieren */
        }
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => openModal({ type: 'meal', day, slot })}
      aria-label={`${SLOT_LABEL[slot]} ${WEEKDAYS[day]}: ${r.name}${leftover ? ', Reste' : ''}${meal.lock ? ', gesperrt' : ''}${meal.done ? ', gekocht' : ''}`}
    >
      <Dish recipe={r} size={46} />
      <span className="meal-text">
        <span className="meal-name">{r.name}</span>
        <span className="meal-meta">
          {leftover ? (
            <span className="tag tag-leftover">Reste vom {WEEKDAYS_SHORT[meal.from!]}</span>
          ) : (
            <>
              <span>{a.total} Min.</span>
              {meal.x ? <span className="tag">+{fmt0(meal.x)} für morgen</span> : null}
            </>
          )}
        </span>
      </span>
      <span className="meal-flags">
        {meal.lock ? <Icon name="lock" size={13} title="Gesperrt" /> : null}
        {meal.done ? <Icon name="check" size={13} title="Gekocht" /> : null}
        {s.prefs.favorites.includes(r.id) ? <Icon name="heartFill" size={13} title="Favorit" /> : null}
      </span>
    </button>
  );
}
