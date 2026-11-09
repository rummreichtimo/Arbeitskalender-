import React, { useMemo, useRef, useState } from 'react';
import type { View } from '../App';
import { useAi, useWeekData } from '../state/hooks';
import { currentWeekStart, recipeById, todayISO, toggleDone } from '../state/actions';
import { openModal, setWeek } from '../state/ui';
import { Icon } from '../ui/Icon';
import { Button, Est } from '../ui/Controls';
import { Dish } from '../ui/Dish';
import { SLOT_LABEL, SLOT_ORDER, DIET_LABEL, WEEKDAYS } from '../data/labels';
import { daysBetween, fmt0, fmtDayLong, fmtEst, fmtEuro, fmtWeekRange, isoWeek, fmtMinutes } from '../lib/format';
import { balanceItems, energyReference, type Level } from '../lib/nutrition';
import { analyze } from '../lib/recipe';
import { allRecipes } from '../state/actions';
import { ING } from '../data/ingredients';
import { streamText, weekReviewPrompt, aiErrorText } from '../lib/ai';
import type { SlotId } from '../lib/types';

const LEVEL_TEXT: Record<Level, string> = { gut: 'passt', ok: 'fast', mehr: 'ausbaufähig' };

export function LevelPill({ level }: { level: Level }) {
  return <span className={`pill pill-${level}`}>{LEVEL_TEXT[level]}</span>;
}

export function Dashboard({ go }: { go: (v: View) => void }) {
  const start = currentWeekStart();
  const { s, week, shopping, balance } = useWeekData(start);
  const today = todayISO();
  const dayIdx = Math.max(0, Math.min(6, daysBetween(start, today)));
  const p = s.profile;
  const sh = s.shopping[start];

  const todayMeals = week ? SLOT_ORDER.map((slot) => ({ slot, m: week.days[dayIdx]?.[slot] })).filter((x) => x.m) : [];
  const checkedCount = shopping ? shopping.lines.filter((l) => sh?.checked[l.i]).length : 0;
  const balanceList = balance ? balanceItems(balance, p) : [];
  const ref = energyReference(p.age, p.sex, p.activity);

  const expiring = useMemo(
    () => s.pantry.filter((x) => x.exp && daysBetween(today, x.exp) <= 4).sort((a, b) => (a.exp! < b.exp! ? -1 : 1)),
    [s.pantry, today],
  );
  const rescue = useMemo(() => {
    if (!expiring.length) return [];
    const ids = new Set(expiring.map((e) => e.i));
    return allRecipes(s)
      .map((r) => analyze(r, p, p.equipment, s.prefs.prices))
      .filter((a) => a.ok && a.items.some((it) => ids.has(it.i)))
      .map((a) => ({ a, hits: a.items.filter((it) => ids.has(it.i)).length }))
      .sort((x, y) => y.hits - x.hits || x.a.total - y.a.total)
      .slice(0, 3);
  }, [expiring, s.recipes, p, s.prefs.prices]);

  const upcoming = week
    ? week.days
        .map((d, i) => ({ i, m: d.abend }))
        .filter((x) => x.i > dayIdx && x.m)
        .slice(0, 3)
    : [];

  const weekCost = shopping?.weekCost ?? 0;
  const pct = p.budget > 0 ? Math.min(100, (weekCost / p.budget) * 100) : 0;
  const over = weekCost > p.budget;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">KW {isoWeek(start)} · {fmtWeekRange(start)}</p>
          <h1>{fmtDayLong(today)}</h1>
        </div>
        <div className="page-actions">
          <Button icon="calendar" onClick={() => { setWeek(start); go('plan'); }}>Wochenplan</Button>
          <Button variant="primary" icon="cart" onClick={() => { setWeek(start); go('einkauf'); }}>Einkaufsliste</Button>
        </div>
      </header>

      {p.example ? (
        <div className="banner">
          <Icon name="info" size={20} />
          <p>
            <strong>Beispielprofil:</strong> {p.persons} Personen, {DIET_LABEL[p.diet]}, {fmt0(p.budget)} € pro Woche, bis {p.maxTime} Min. Kochzeit.
            Trage deine Angaben ein, dann plant Wochentisch passend für dich.
          </p>
          <Button variant="accent" onClick={() => go('profil')}>Profil einrichten</Button>
        </div>
      ) : null}

      <section className="today" aria-labelledby="h-today">
        <div className="section-head">
          <h2 id="h-today">Heute auf dem Tisch</h2>
          <span className="muted">{WEEKDAYS[dayIdx]}</span>
        </div>
        {todayMeals.length ? (
          <div className="today-grid">
            {todayMeals.map(({ slot, m }) => {
              const r = recipeById(m!.r);
              if (!r) return null;
              const a = analyze(r, p, p.equipment, s.prefs.prices);
              return (
                <article key={slot} className={`today-card${m!.done ? ' is-done' : ''}`}>
                  <button type="button" className="today-open" onClick={() => openModal({ type: 'recipe', id: r.id, servings: m!.s + (m!.from === undefined ? m!.x ?? 0 : 0), day: dayIdx, slot: slot as SlotId })}>
                    <Dish recipe={r} size={76} />
                    <span className="today-text">
                      <span className="slot-label">{SLOT_LABEL[slot]}{m!.from !== undefined ? ' · Reste vom Vortag' : ''}</span>
                      <span className="today-name">{r.name}</span>
                      <span className="meta">
                        <Icon name="clock" size={14} /> {m!.from !== undefined ? 'aufwärmen' : fmtMinutes(a.total)} · {fmt0(m!.s)} Portionen
                      </span>
                    </span>
                  </button>
                  <button type="button" className={`done-btn${m!.done ? ' is-on' : ''}`} onClick={() => toggleDone(start, dayIdx, slot as SlotId)} aria-pressed={!!m!.done}>
                    <Icon name="check" size={16} />
                    <span>{m!.done ? 'Gegessen' : 'Gekocht?'}</span>
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted">Für heute ist nichts geplant. <button type="button" className="link" onClick={() => go('plan')}>Zum Wochenplan</button></p>
        )}
      </section>

      <div className="tiles">
        <article className="tile">
          <h3><Icon name="euro" size={17} /> Budget dieser Woche</h3>
          <p className="big-num">
            <Est>{fmtEst(weekCost)}</Est>
          </p>
          <div className={`meter${over ? ' is-over' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={p.budget} aria-valuenow={Math.round(weekCost)} aria-label="Wochenkosten im Verhältnis zum Budget">
            <span style={{ width: pct + '%' }} />
          </div>
          <p className="tile-note">
            {over ? `${fmtEuro(weekCost - p.budget)} über` : `${fmtEuro(p.budget - weekCost)} unter`} deinem Budget von {fmtEuro(p.budget)}.
            {shopping && shopping.stockValue > 0.5 ? ` An der Kasse ${fmtEst(shopping.total)} – davon ${fmtEst(shopping.stockValue)} für Vorräte, die länger reichen.` : ''}
          </p>
        </article>

        <article className="tile">
          <h3><Icon name="cart" size={17} /> Einkauf</h3>
          {shopping ? (
            <>
              <p className="big-num">{checkedCount}<small> / {shopping.lines.length}</small></p>
              <div className="meter meter-ok"><span style={{ width: shopping.lines.length ? (checkedCount / shopping.lines.length) * 100 + '%' : '0%' }} /></div>
              <p className="tile-note">{shopping.covered.length} Zutaten sind schon im Vorrat und fehlen deshalb auf der Liste.</p>
              <Button small icon="list" onClick={() => go('einkauf')}>Liste öffnen</Button>
            </>
          ) : <p className="muted">Noch kein Plan für diese Woche.</p>}
        </article>

        <article className="tile tile-wide">
          <h3><Icon name="leaf" size={17} /> Ausgewogenheit</h3>
          <ul className="balance">
            {balanceList.map((b) => (
              <li key={b.id}>
                <span className="balance-label">{b.label}</span>
                <span className="balance-value">{b.value}</span>
                <LevelPill level={b.level} />
                <span className="balance-target">{b.target}</span>
              </li>
            ))}
          </ul>
          <p className="tile-note">Orientierung an den Empfehlungen der Deutschen Gesellschaft für Ernährung, aus den Rezepten geschätzt. Keine Vorgabe.</p>
        </article>

        {s.ui.nutrition && balance ? (
          <article className="tile">
            <h3><Icon name="scale" size={17} /> Nährwerte pro Tag</h3>
            <p className="tile-sub">Durchschnitt je Person, <Est>aus den Rezepten geschätzt</Est></p>
            <dl className="nutr-grid">
              <div><dt>Energie</dt><dd>{fmt0(balance.avg[0])} kcal</dd></div>
              <div><dt>Eiweiß</dt><dd>{fmt0(balance.avg[1])} g</dd></div>
              <div><dt>Kohlenhydrate</dt><dd>{fmt0(balance.avg[2])} g</dd></div>
              <div><dt>Fett</dt><dd>{fmt0(balance.avg[3])} g</dd></div>
              <div><dt>Ballaststoffe</dt><dd>{fmt0(balance.avg[4])} g</dd></div>
            </dl>
            <p className="tile-note">
              Zum Vergleich: Richtwert für {p.age} Jahre und dein Aktivitätsniveau etwa {fmt0(ref.low)}–{fmt0(ref.high)} kcal am Tag.
              Snacks, Getränke und Essen außer Haus sind nicht enthalten.
            </p>
          </article>
        ) : null}

        <article className="tile">
          <h3><Icon name="box" size={17} /> Vorrat</h3>
          {expiring.length ? (
            <>
              <ul className="plain-list">
                {expiring.slice(0, 4).map((e) => {
                  const d = daysBetween(today, e.exp!);
                  return (
                    <li key={e.i}>
                      <span>{ING[e.i]?.name}</span>
                      <span className={`pill ${d < 0 ? 'pill-mehr' : 'pill-ok'}`}>{d < 0 ? 'abgelaufen' : d === 0 ? 'heute' : d === 1 ? 'morgen' : `in ${d} Tagen`}</span>
                    </li>
                  );
                })}
              </ul>
              {rescue.length ? (
                <>
                  <p className="tile-sub">Passt dazu:</p>
                  <div className="chip-row">
                    {rescue.map(({ a }) => (
                      <button key={a.recipe.id} type="button" className="chip" onClick={() => openModal({ type: 'recipe', id: a.recipe.id })}>{a.recipe.name}</button>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <p className="tile-note">Nichts läuft in den nächsten Tagen ab. Trage Haltbarkeitsdaten im Vorrat ein, dann schlägt der Planer passende Resteessen vor.</p>
          )}
          <Button small icon="box" onClick={() => go('vorrat')}>Vorrat verwalten</Button>
        </article>

        <article className="tile">
          <h3><Icon name="calendar" size={17} /> Die nächsten Abende</h3>
          {upcoming.length ? (
            <ul className="next-list">
              {upcoming.map(({ i, m }) => {
                const r = recipeById(m!.r);
                return r ? (
                  <li key={i}>
                    <button type="button" onClick={() => openModal({ type: 'recipe', id: r.id, servings: m!.s + (m!.x ?? 0), day: i, slot: 'abend' })}>
                      <Dish recipe={r} size={40} />
                      <span><span className="slot-label">{WEEKDAYS[i]}</span>{r.name}</span>
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          ) : <p className="tile-note">Die Woche ist fast vorbei. Plane schon die nächste.</p>}
        </article>

        <article className="tile">
          <h3><Icon name="heart" size={17} /> Lieblingsgerichte</h3>
          {s.prefs.favorites.length ? (
            <div className="chip-row">
              {s.prefs.favorites.map((id) => recipeById(id)).filter(Boolean).slice(0, 8).map((r) => (
                <button key={r!.id} type="button" className="chip" onClick={() => openModal({ type: 'recipe', id: r!.id })}>{r!.name}</button>
              ))}
            </div>
          ) : <p className="tile-note">Markiere Gerichte mit dem Herz. Favoriten plant Wochentisch häufiger ein.</p>}
        </article>

        <AiReview start={start} />
      </div>
    </div>
  );
}

function AiReview({ start }: { start: string }) {
  const ai = useAi();
  const { s, week, shopping, balance } = useWeekData(start);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ctl = useRef<AbortController | null>(null);
  if (ai === false || !week) return null;

  const run = async () => {
    if (!balance || !shopping) return;
    ctl.current = new AbortController();
    setBusy(true);
    setErr('');
    setText('');
    const lines = week.days.map((d, i) => {
      const meals = SLOT_ORDER.filter((sl) => d[sl]).map((sl) => `${SLOT_LABEL[sl]}: ${recipeById(d[sl]!.r)?.name ?? '?'}${d[sl]!.from !== undefined ? ' (Reste)' : ''}`);
      return `${WEEKDAYS[i]}: ${meals.join('; ') || '–'}`;
    });
    const bal = balanceItems(balance, s.profile).map((b) => `${b.label}: ${b.value} (${b.target})`);
    const summary = `Haushalt: ${s.profile.persons} Personen. Budget ${fmt0(s.profile.budget)} €/Woche, geschätzte Wochenkosten ${fmt0(shopping.weekCost)} €.\n\nPlan:\n${lines.join('\n')}\n\nAuswertung:\n${bal.join('\n')}`;
    try {
      await streamText(weekReviewPrompt(summary, s.profile), setText, ctl.current.signal, 'default');
    } catch (e: unknown) {
      const msg = aiErrorText(e);
      if (msg) setErr(msg);
      setText((e as { text?: string })?.text ?? '');
    } finally {
      setBusy(false);
    }
  };

  const bullets = text.split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
  return (
    <article className="tile tile-ai">
      <h3><Icon name="sparkles" size={17} /> Wochen-Check mit Claude</h3>
      {!text && !busy ? <p className="tile-note">Claude schaut sich deinen Plan an und gibt kurze Tipps für mehr Abwechslung, Ausgewogenheit oder Ersparnis. Nutzt dein Claude-Konto.</p> : null}
      {busy && !text ? <p className="thinking">Claude denkt nach …</p> : null}
      {bullets.length ? <ul className="ai-list">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul> : null}
      {err ? <p className="error-text">{err}</p> : null}
      <div className="row-gap">
        {busy ? <Button small icon="x" onClick={() => ctl.current?.abort()}>Stopp</Button> : <Button small variant="accent" icon="sparkles" disabled={ai === null} onClick={run}>{text ? 'Erneut prüfen' : 'Plan prüfen lassen'}</Button>}
      </div>
    </article>
  );
}
