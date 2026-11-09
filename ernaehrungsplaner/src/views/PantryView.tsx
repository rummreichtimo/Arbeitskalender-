import React, { useMemo, useState } from 'react';
import type { View } from '../App';
import { useApp } from '../state/store';
import { addBasics, addPantry, allRecipes, removePantry, todayISO, updatePantry } from '../state/actions';
import { openModal } from '../state/ui';
import { INGREDIENTS, ING, SUBSTITUTE_ONLY } from '../data/ingredients';
import { CATEGORIES, CATEGORY_LABEL } from '../data/labels';
import { analyze } from '../lib/recipe';
import { pantryAmount } from '../lib/shopping';
import { daysBetween, fmtDateShort } from '../lib/format';
import { Button, Empty, IconButton } from '../ui/Controls';
import { Icon } from '../ui/Icon';
import { Dish } from '../ui/Dish';
import { useAi } from '../state/hooks';
import type { Ingredient } from '../lib/types';

const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const unitText = (ing: Ingredient) => (ing.unit === 'stk' ? ing.pl?.[1] ?? 'Stück' : ing.unit);

export function PantryView({ go }: { go: (v: View) => void }) {
  const s = useApp();
  const ai = useAi();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [enough, setEnough] = useState(false);
  const [exp, setExp] = useState('');
  const today = todayISO();

  const matches = useMemo(() => {
    const t = norm(q.trim());
    if (!t || sel) return [];
    return INGREDIENTS.filter((i) => !i.free && norm(i.name).includes(t))
      .sort((a, b) => Number(SUBSTITUTE_ONLY.has(a.id)) - Number(SUBSTITUTE_ONLY.has(b.id)) || norm(a.name).indexOf(t) - norm(b.name).indexOf(t))
      .slice(0, 8);
  }, [q, sel]);

  const choose = (id: string) => {
    const ing = ING[id];
    setSel(id);
    setQ(ing.name);
    setEnough(!!ing.staple || ing.cat === 'gewuerze');
    setAmount(ing.unit === 'stk' ? '1' : String(ing.pack));
    setExp('');
  };

  const add = () => {
    if (!sel) return;
    const n = Number(amount.replace(',', '.'));
    addPantry(sel, enough ? null : Number.isFinite(n) && n > 0 ? n : ING[sel].pack, exp || undefined);
    setSel(null);
    setQ('');
    setAmount('');
    setExp('');
  };

  const groups = CATEGORIES.map((c) => ({ c, items: s.pantry.filter((p) => ING[p.i]?.cat === c.id).sort((a, b) => ING[a.i].name.localeCompare(ING[b.i].name, 'de')) })).filter((g) => g.items.length);

  const cookable = useMemo(() => {
    if (!s.pantry.length) return [];
    return allRecipes(s)
      .map((r) => analyze(r, s.profile, s.profile.equipment, s.prefs.prices))
      .filter((a) => a.ok)
      .map((a) => {
        let have = 0;
        let total = 0;
        const missing: string[] = [];
        for (const it of a.items) {
          const ing = ING[it.i];
          if (!ing || ing.free) continue;
          const value = (it.qty / ing.pack) * ing.price + 0.05;
          total += value;
          if (pantryAmount(s.pantry, it.i) >= it.qty * 0.9) have += value;
          else if (!it.opt && !ing.staple) missing.push(ing.name);
        }
        return { a, share: total ? have / total : 0, missing };
      })
      .filter((x) => x.share > 0.35)
      .sort((x, y) => y.share - x.share || x.missing.length - y.missing.length)
      .slice(0, 6);
  }, [s.pantry, s.recipes, s.profile, s.prefs.prices]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Vorratsverwaltung</p>
          <h1>Was ist schon da?</h1>
        </div>
        <div className="page-actions">
          <Button icon="plus" onClick={addBasics}>Grundvorrat ergänzen</Button>
          <Button icon="cart" onClick={() => go('einkauf')}>Einkaufsliste</Button>
        </div>
      </header>

      <p className="lead">Vorräte werden von der Einkaufsliste abgezogen, beim Planen bevorzugt verwendet und beim Abhaken „Gekocht“ verbraucht. Mit Haltbarkeitsdatum plant Wochentisch bald ablaufende Lebensmittel zuerst ein.</p>

      <section className="pantry-add" aria-labelledby="h-add">
        <h2 id="h-add">Lebensmittel hinzufügen</h2>
        <div className="pantry-form">
          <div className="combo">
            <div className="search-box">
              <Icon name="search" size={17} />
              <input id="pantry-search" type="text" value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }} placeholder="Zutat suchen, z. B. Reis" aria-label="Zutat suchen" autoComplete="off" />
            </div>
            {matches.length ? (
              <ul className="combo-list" role="listbox">
                {matches.map((m) => (
                  <li key={m.id}><button type="button" onClick={() => choose(m.id)}>{m.name}<span className="muted small">{CATEGORY_LABEL[m.cat]}</span></button></li>
                ))}
              </ul>
            ) : null}
          </div>
          {sel ? (
            <>
              <label className="inline-field">
                <span>Menge</span>
                <input type="text" inputMode="decimal" value={amount} disabled={enough} onChange={(e) => setAmount(e.target.value)} aria-label="Menge" />
                <span className="muted">{unitText(ING[sel])}</span>
              </label>
              <label className="mini-check"><input type="checkbox" checked={enough} onChange={(e) => setEnough(e.target.checked)} /> ausreichend vorhanden</label>
              <label className="inline-field">
                <span>Haltbar bis</span>
                <input type="date" value={exp} onChange={(e) => setExp(e.target.value)} aria-label="Haltbar bis" />
              </label>
              <Button variant="primary" icon="plus" onClick={add}>Hinzufügen</Button>
            </>
          ) : null}
        </div>
      </section>

      {groups.length ? (
        <div className="pantry-groups">
          {groups.map(({ c, items }) => (
            <section key={c.id} className="pantry-group">
              <h2>{c.label}</h2>
              <ul>
                {items.map((p) => {
                  const ing = ING[p.i];
                  const d = p.exp ? daysBetween(today, p.exp) : null;
                  return (
                    <li key={p.i} className="pantry-row">
                      <span className="pantry-name">{ing.name}</span>
                      <span className="pantry-amt">
                        {p.a === null ? (
                          <button type="button" className="chip is-on" onClick={() => updatePantry(p.i, { a: ing.unit === 'stk' ? 1 : ing.pack })} title="Menge eintragen">ausreichend</button>
                        ) : (
                          <>
                            <input type="text" inputMode="decimal" aria-label={`Menge ${ing.name}`} defaultValue={String(Math.round(p.a * 10) / 10).replace('.', ',')} key={p.a}
                              onBlur={(e) => { const n = Number(e.target.value.replace(/\./g, '').replace(',', '.')); if (Number.isFinite(n)) n <= 0 ? removePantry(p.i) : updatePantry(p.i, { a: n }); }} />
                            <span className="muted">{unitText(ing)}</span>
                          </>
                        )}
                      </span>
                      <span className="pantry-exp">
                        <input type="date" aria-label={`Haltbar bis ${ing.name}`} value={p.exp ?? ''} onChange={(e) => updatePantry(p.i, { exp: e.target.value || undefined })} />
                        {d !== null ? <span className={`pill ${d < 0 ? 'pill-mehr' : d <= 3 ? 'pill-ok' : 'pill-gut'}`}>{d < 0 ? 'abgelaufen' : d === 0 ? 'heute' : d <= 3 ? `noch ${d} T.` : `bis ${fmtDateShort(p.exp!)}`}</span> : null}
                      </span>
                      <IconButton icon="trash" label={`${ing.name} entfernen`} onClick={() => removePantry(p.i)} />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <Empty icon="box" title="Der Vorrat ist leer" action={<Button variant="primary" icon="plus" onClick={addBasics}>Grundvorrat hinzufügen</Button>}>Salz, Öl, Gewürze und Brühe hat fast jeder im Haus. Mit einem Klick trägst du sie ein.</Empty>
      )}

      {cookable.length ? (
        <section className="section" aria-labelledby="h-cook">
          <div className="section-head">
            <h2 id="h-cook">Was kann ich damit kochen?</h2>
            {ai !== false ? <Button small variant="accent" icon="sparkles" disabled={ai === null} onClick={() => openModal({ type: 'ai' })}>KI-Rezept aus dem Vorrat</Button> : null}
          </div>
          <div className="cook-grid">
            {cookable.map(({ a, share, missing }) => (
              <button key={a.recipe.id} type="button" className="cook-card" onClick={() => openModal({ type: 'recipe', id: a.recipe.id })}>
                <Dish recipe={a.recipe} size={60} />
                <span>
                  <strong>{a.recipe.name}</strong>
                  <span className="meter meter-ok"><span style={{ width: Math.round(share * 100) + '%' }} /></span>
                  <span className="muted small">{Math.round(share * 100)} % vorhanden{missing.length ? ` · fehlt: ${missing.slice(0, 3).join(', ')}` : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
