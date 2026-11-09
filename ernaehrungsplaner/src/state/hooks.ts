import { useEffect, useMemo, useState } from 'react';
import { useApp } from './store';
import { ctxOf } from './actions';
import { buildShopping } from '../lib/shopping';
import { weekBalance } from '../lib/nutrition';
import { analyze } from '../lib/recipe';
import type { Recipe } from '../lib/types';
import { aiAvailable } from '../lib/ai';

export function useCtx() {
  const s = useApp();
  return useMemo(() => ctxOf(s), [s.profile, s.prefs.prices, s.recipes]);
}

export function useWeekData(start: string) {
  const s = useApp();
  const ctx = useCtx();
  const week = s.plans[start];
  const shopping = useMemo(() => (week ? buildShopping(week, ctx, s.pantry, s.ui.usePantry) : null), [week, ctx, s.pantry, s.ui.usePantry]);
  const balance = useMemo(() => (week ? weekBalance(week, ctx, s.profile) : null), [week, ctx, s.profile]);
  return { s, ctx, week, shopping, balance };
}

export function useAnalysis(recipe: Recipe | undefined) {
  const s = useApp();
  return useMemo(() => (recipe ? analyze(recipe, s.profile, s.profile.equipment, s.prefs.prices) : undefined), [recipe, s.profile, s.prefs.prices]);
}

/** true, sobald Claude für diese Seite verfügbar ist; null während der Prüfung. */
export function useAi(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    aiAvailable().then((v) => alive && setOk(v));
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}

export function useHashView<T extends string>(views: readonly T[], fallback: T): [T, (v: T) => void] {
  const read = () => {
    const h = window.location.hash.replace('#', '') as T;
    return views.includes(h) ? h : fallback;
  };
  const [view, setView] = useState<T>(read);
  useEffect(() => {
    const on = () => setView(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (v: T) => {
    if (window.location.hash !== '#' + v) {
      try {
        window.location.hash = v;
      } catch {
        /* ignorieren */
      }
    }
    setView(v);
    window.scrollTo({ top: 0 });
  };
  return [view, go];
}
