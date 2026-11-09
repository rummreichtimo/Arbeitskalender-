import React, { useState } from 'react';
import type { View } from '../App';
import { useUi, openModal } from '../state/ui';
import { useWeekData } from '../state/hooks';
import { addManual, ensureWeek, removeManual, resetChecks, setPrice, toggleCheck, toggleManual, transferToPantry, updateUi } from '../state/actions';
import { WeekNav } from './PlanView';
import { CATEGORY_LABEL } from '../data/labels';
import { fmtEst, fmtEuro, fmtWeekRange, isoWeek, shortAmount } from '../lib/format';
import { lineAmount, packText, shoppingCsv, shoppingText, type ShopLine } from '../lib/shopping';
import { Button, Empty, Est, IconButton, Switch } from '../ui/Controls';
import { Icon } from '../ui/Icon';

export function ShoppingView({ go }: { go: (v: View) => void }) {
  const { week: start } = useUi();
  const { s, week, shopping } = useWeekData(start);
  const [hideDone, setHideDone] = useState(false);
  const [manual, setManual] = useState('');
  const [editPrice, setEditPrice] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const st = s.shopping[start];

  if (!week || !shopping) {
    return (
      <div className="page">
        <header className="page-head">
          <div><p className="eyebrow">Einkaufsliste</p><h1>Einkaufen</h1></div>
          <WeekNav start={start} />
        </header>
        <Empty icon="cart" title="Noch kein Wochenplan" action={<Button variant="primary" icon="sparkles" onClick={() => ensureWeek(start)}>Woche planen</Button>}>
          Die Einkaufsliste entsteht automatisch aus dem Wochenplan.
        </Empty>
      </div>
    );
  }

  const checked = shopping.lines.filter((l) => st?.checked[l.i]);
  const openCost = shopping.lines.filter((l) => !st?.checked[l.i]).reduce((x, l) => x + l.cost, 0);
  const groups: { cat: string; lines: ShopLine[] }[] = [];
  for (const l of shopping.lines) {
    if (hideDone && st?.checked[l.i]) continue;
    const g = groups[groups.length - 1];
    if (g && g.cat === l.ing.cat) g.lines.push(l);
    else groups.push({ cat: l.ing.cat, lines: [l] });
  }
  const leftovers = shopping.lines.filter((l) => l.leftover > 0 && !l.durable && l.ing.keep && l.ing.keep <= 10 && l.leftover >= l.ing.pack * 0.15);
  const title = `Einkaufsliste KW ${isoWeek(start)} (${fmtWeekRange(start)})`;
  const doneManual = st?.manual.filter((m) => m.done).length ?? 0;
  const totalItems = shopping.lines.length + (st?.manual.length ?? 0);
  const doneItems = checked.length + doneManual;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Einkaufsliste</p>
          <h1>{doneItems} von {totalItems} erledigt</h1>
        </div>
        <WeekNav start={start} />
      </header>

      <div className="shop-summary">
        <div className="shop-sum-item">
          <span className="label">An der Kasse</span>
          <strong><Est>{fmtEst(shopping.total)}</Est></strong>
          <span className="muted small">noch offen {fmtEst(openCost)}</span>
        </div>
        <div className="shop-sum-item">
          <span className="label">Wochenkosten</span>
          <strong className={shopping.weekCost > s.profile.budget ? 'is-over' : ''}><Est>{fmtEst(shopping.weekCost)}</Est></strong>
          <span className="muted small">Budget {fmtEuro(s.profile.budget)}</span>
        </div>
        <div className="shop-sum-item">
          <span className="label">Davon Vorrat für später</span>
          <strong><Est>{fmtEst(shopping.stockValue)}</Est></strong>
          <span className="muted small">Gewürze, Trockenware & Co.</span>
        </div>
        <p className="shop-note">
          Preise sind geschätzte Durchschnittspreise deutscher Supermärkte (2026) und können im Laden abweichen. Eigene Preise kannst du je Zutat über das Stift-Symbol eintragen.
        </p>
      </div>

      <div className="shop-toolbar">
        <Switch id="use-pantry" checked={s.ui.usePantry} onChange={(v) => updateUi({ usePantry: v })} label="Vorrat abziehen" hint={`${shopping.covered.length} Zutaten sind schon da`} />
        <Switch id="hide-done" checked={hideDone} onChange={setHideDone} label="Erledigte ausblenden" />
        <div className="row-gap">
          <Button icon="download" onClick={() => openModal({ type: 'export', title: 'Einkaufsliste exportieren', text: shoppingText(title, shopping, st, false), filename: `einkaufsliste-kw${isoWeek(start)}.txt`, csv: shoppingCsv(shopping, st) })}>Exportieren</Button>
          <Button icon="box" onClick={() => transferToPantry(start)} disabled={!checked.length} title="Abgehakte Zutaten mit ihrer Packungsgröße in den Vorrat übernehmen">Gekauftes in den Vorrat</Button>
          <Button icon="refresh" variant="quiet" onClick={() => resetChecks(start)} disabled={!doneItems}>Häkchen zurücksetzen</Button>
        </div>
      </div>

      <div className="shop-list">
        {groups.map((g) => (
          <section key={g.cat} className="shop-group" aria-label={CATEGORY_LABEL[g.cat as keyof typeof CATEGORY_LABEL]}>
            <h2>{CATEGORY_LABEL[g.cat as keyof typeof CATEGORY_LABEL]}</h2>
            <ul>
              {g.lines.map((l) => {
                const done = !!st?.checked[l.i];
                return (
                  <li key={l.i} className={`shop-line${done ? ' is-done' : ''}`}>
                    <label className="shop-check">
                      <input type="checkbox" checked={done} onChange={() => toggleCheck(start, l.i)} />
                      <span className="box" aria-hidden="true"><Icon name="check" size={14} /></span>
                      <span className="shop-text">
                        <span className="shop-name">
                          <span className="qty">{lineAmount(l)}</span> {l.ing.unit === 'stk' ? '' : l.ing.name}
                          {l.optional ? <span className="tag tag-quiet">optional</span> : null}
                        </span>
                        <span className="shop-sub">
                          {[packText(l), l.pantry > 0 ? `${shortAmount(l.ing, l.pantry)} aus dem Vorrat` : '', `für ${l.recipes.slice(0, 3).join(', ')}${l.recipes.length > 3 ? ` +${l.recipes.length - 3}` : ''}`].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </label>
                    {editPrice === l.i ? (
                      <form className="price-edit" onSubmit={(e) => { e.preventDefault(); const v = Number(priceDraft.replace(',', '.')); setPrice(l.i, priceDraft.trim() === '' ? null : v); setEditPrice(null); }}>
                        <input aria-label={`Preis je Packung für ${l.ing.name} in Euro`} type="text" inputMode="decimal" value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} autoFocus />
                        <span className="muted small">€ je {l.ing.packLabel ?? 'Packung'}</span>
                        <Button small variant="primary" type="submit">OK</Button>
                      </form>
                    ) : (
                      <span className="shop-price">
                        <span className={s.prefs.prices[l.i] !== undefined ? 'own-price' : ''} title={s.prefs.prices[l.i] !== undefined ? 'Eigener Preis' : 'Geschätzter Preis'}>{fmtEst(l.cost)}</span>
                        <IconButton icon="edit" label={`Preis für ${l.ing.name} anpassen`} onClick={() => { setEditPrice(l.i); setPriceDraft(String(s.prefs.prices[l.i] ?? l.ing.price).replace('.', ',')); }} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section className="shop-group">
          <h2>Eigene Einträge</h2>
          <ul>
            {(st?.manual ?? []).filter((m) => !(hideDone && m.done)).map((m) => (
              <li key={m.id} className={`shop-line${m.done ? ' is-done' : ''}`}>
                <label className="shop-check">
                  <input type="checkbox" checked={m.done} onChange={() => toggleManual(start, m.id)} />
                  <span className="box" aria-hidden="true"><Icon name="check" size={14} /></span>
                  <span className="shop-text"><span className="shop-name">{m.text}</span></span>
                </label>
                <IconButton icon="trash" label={`${m.text} entfernen`} onClick={() => removeManual(start, m.id)} />
              </li>
            ))}
          </ul>
          <form className="manual-add" onSubmit={(e) => { e.preventDefault(); addManual(start, manual); setManual(''); }}>
            <input id="manual-item" type="text" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="z. B. Spülmittel, Kaffee, Brot für Freitag" aria-label="Eigenen Eintrag hinzufügen" />
            <Button type="submit" icon="plus" disabled={!manual.trim()}>Hinzufügen</Button>
          </form>
        </section>
      </div>

      {shopping.covered.length ? (
        <details className="details shop-covered">
          <summary>Schon im Vorrat ({shopping.covered.length})</summary>
          <ul className="plain-list">
            {shopping.covered.map((l) => (
              <li key={l.i}><span>{l.ing.unit === 'stk' ? shortAmount(l.ing, l.need) : `${shortAmount(l.ing, l.need)} ${l.ing.name}`}</span><span className="muted small">für {l.recipes.slice(0, 2).join(', ')}</span></li>
            ))}
          </ul>
          <Button small icon="box" onClick={() => go('vorrat')}>Vorrat ansehen</Button>
        </details>
      ) : null}

      {leftovers.length ? (
        <section className="tile leftover-tile">
          <h3><Icon name="refresh" size={17} /> Bleibt nach der Woche übrig</h3>
          <p className="tile-note">Aus angebrochenen Packungen frischer Zutaten (geschätzt). Der Planer verwertet solche Reste bevorzugt – plane die nächste Woche, um sie aufzubrauchen, oder übernimm sie nach dem Einkauf in den Vorrat.</p>
          <div className="chip-row">
            {leftovers.map((l) => <span key={l.i} className="tag">{l.ing.unit === 'stk' ? shortAmount(l.ing, l.leftover) : `${shortAmount(l.ing, l.leftover)} ${l.ing.name}`}</span>)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
