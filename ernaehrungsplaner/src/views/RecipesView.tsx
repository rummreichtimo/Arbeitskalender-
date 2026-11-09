import React, { useMemo, useState } from 'react';
import type { MealType, Diet } from '../lib/types';
import { useApp } from '../state/store';
import { allRecipes, toggleFavorite } from '../state/actions';
import { openModal } from '../state/ui';
import { analyze } from '../lib/recipe';
import { ING } from '../data/ingredients';
import { CUISINE_LABEL, DIET_LABEL, DIFFICULTY_LABEL, MEAL_LABEL } from '../data/labels';
import { fmtEst } from '../lib/format';
import { Button, Chip, Est, Segmented, Stars } from '../ui/Controls';
import { Icon } from '../ui/Icon';
import { Dish } from '../ui/Dish';
import { useAi } from '../state/hooks';

type Sort = 'passend' | 'zeit' | 'preis' | 'name';

const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function RecipesView() {
  const s = useApp();
  const ai = useAi();
  const [q, setQ] = useState('');
  const [meal, setMeal] = useState<'alle' | MealType>('alle');
  const [fit, setFit] = useState(true);
  const [onlyFav, setOnlyFav] = useState(false);
  const [onlyOwn, setOnlyOwn] = useState(false);
  const [maxTime, setMaxTime] = useState(0);
  const [diet, setDiet] = useState<'alle' | Diet>('alle');
  const [sort, setSort] = useState<Sort>('passend');

  const list = useMemo(() => {
    const t = norm(q.trim());
    const rows = allRecipes(s).map((r) => analyze(r, s.profile, s.profile.equipment, s.prefs.prices));
    const filtered = rows.filter((a) => {
      const r = a.recipe;
      if (fit && !a.ok) return false;
      if (meal !== 'alle' && !r.meals.includes(meal)) return false;
      if (onlyFav && !s.prefs.favorites.includes(r.id)) return false;
      if (onlyOwn && !r.source) return false;
      if (maxTime && a.total > maxTime) return false;
      if (diet !== 'alle') {
        const order: Diet[] = ['vegan', 'vegetarisch', 'pescetarisch', 'mischkost'];
        if (order.indexOf(a.diet) > order.indexOf(diet)) return false;
      }
      if (t) {
        const hay = norm([r.name, CUISINE_LABEL[r.cuisine], ...r.tags, ...a.items.map((it) => ING[it.i]?.name ?? '')].join(' '));
        if (!t.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const rating = (id: string) => s.prefs.ratings[id] ?? 3;
    filtered.sort((x, y) => {
      if (sort === 'zeit') return x.total - y.total;
      if (sort === 'preis') return x.cost - y.cost;
      if (sort === 'name') return x.recipe.name.localeCompare(y.recipe.name, 'de');
      const fx = (s.prefs.favorites.includes(x.recipe.id) ? 2 : 0) + rating(x.recipe.id);
      const fy = (s.prefs.favorites.includes(y.recipe.id) ? 2 : 0) + rating(y.recipe.id);
      return fy - fx || Number(y.ok) - Number(x.ok) || x.recipe.name.localeCompare(y.recipe.name, 'de');
    });
    return filtered;
  }, [s.recipes, s.profile, s.prefs, q, meal, fit, onlyFav, onlyOwn, maxTime, diet, sort]);

  const total = allRecipes(s).length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Rezeptdatenbank</p>
          <h1>{total} Rezepte</h1>
        </div>
        <div className="page-actions">
          {ai !== false ? <Button variant="accent" icon="sparkles" disabled={ai === null} onClick={() => openModal({ type: 'ai' })}>KI-Rezept</Button> : null}
          <Button variant="primary" icon="plus" onClick={() => openModal({ type: 'editor' })}>Eigenes Rezept</Button>
        </div>
      </header>

      <div className="filters">
        <div className="search-box search-lg">
          <Icon name="search" size={18} />
          <input id="recipe-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche nach Gericht, Zutat oder Küche – z. B. „Linsen“, „Ofen“, „italienisch“" aria-label="Rezepte durchsuchen" />
        </div>
        <div className="filter-row">
          <Segmented<'alle' | MealType>
            label="Mahlzeit"
            value={meal}
            onChange={setMeal}
            options={[{ id: 'alle', label: 'Alle' }, ...(Object.keys(MEAL_LABEL) as MealType[]).map((m) => ({ id: m, label: m === 'fruehstueck' ? 'Frühstück' : m === 'snack' ? 'Snacks' : MEAL_LABEL[m].replace('essen', '') }))]}
          />
          <Chip on={fit} onClick={() => setFit(!fit)} title="Nur Rezepte, die zu Ernährungsweise, Allergien und Geräten passen">Passt zu meinem Profil</Chip>
          <Chip on={onlyFav} onClick={() => setOnlyFav(!onlyFav)}>Favoriten</Chip>
          <Chip on={onlyOwn} onClick={() => setOnlyOwn(!onlyOwn)}>Meine Rezepte</Chip>
        </div>
        <div className="filter-row">
          <label className="inline-field">
            <span>Zeit</span>
            <select value={maxTime} onChange={(e) => setMaxTime(+e.target.value)}>
              <option value={0}>beliebig</option>
              <option value={15}>bis 15 Min.</option>
              <option value={30}>bis 30 Min.</option>
              <option value={45}>bis 45 Min.</option>
              <option value={60}>bis 60 Min.</option>
            </select>
          </label>
          <label className="inline-field">
            <span>Ernährung</span>
            <select value={diet} onChange={(e) => setDiet(e.target.value as 'alle' | Diet)}>
              <option value="alle">alle</option>
              <option value="vegan">vegan</option>
              <option value="vegetarisch">vegetarisch</option>
              <option value="pescetarisch">pescetarisch</option>
            </select>
          </label>
          <label className="inline-field">
            <span>Sortieren</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="passend">Favoriten & Bewertung</option>
              <option value="zeit">Zubereitungszeit</option>
              <option value="preis">Preis pro Portion</option>
              <option value="name">Name</option>
            </select>
          </label>
          <span className="muted">{list.length} Treffer</span>
        </div>
      </div>

      {list.length ? (
        <div className="recipe-grid">
          {list.map((a) => {
            const r = a.recipe;
            const fav = s.prefs.favorites.includes(r.id);
            return (
              <article key={r.id} className={`rcard${a.ok ? '' : ' is-unfit'}`}>
                <button type="button" className="rcard-main" onClick={() => openModal({ type: 'recipe', id: r.id })}>
                  <div className="rcard-img"><Dish recipe={r} size={112} /></div>
                  <div className="rcard-body">
                    <h3>{r.name}</h3>
                    <p className="meta">{a.total} Min. · {DIFFICULTY_LABEL[r.diff]} · {DIET_LABEL[a.diet]}</p>
                    <p className="meta"><Est>{fmtEst(a.cost)} / Portion</Est></p>
                    <div className="rcard-foot">
                      <Stars value={s.prefs.ratings[r.id] ?? 0} size={13} />
                      {a.swaps.length ? <span className="tag tag-quiet">angepasst</span> : null}
                      {!a.ok ? <span className="tag tag-warn">passt nicht</span> : null}
                      {r.source === 'ki' ? <span className="tag tag-ai">KI</span> : r.source ? <span className="tag">eigen</span> : null}
                    </div>
                  </div>
                </button>
                <button type="button" className={`fav-btn${fav ? ' is-on' : ''}`} aria-pressed={fav} aria-label={fav ? `${r.name} aus Favoriten entfernen` : `${r.name} merken`} onClick={() => toggleFavorite(r.id)}>
                  <Icon name={fav ? 'heartFill' : 'heart'} size={18} />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <Icon name="search" size={28} />
          <h3>Keine Rezepte gefunden</h3>
          <p>Lockere die Filter oder suche nach einer anderen Zutat.{fit ? ' Mit „Passt zu meinem Profil“ siehst du nur Rezepte ohne deine Allergene und mit deinen Geräten.' : ''}</p>
        </div>
      )}
    </div>
  );
}
