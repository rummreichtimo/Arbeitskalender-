import { useSyncExternalStore } from 'react';
import type { AppState, SliceKey } from '../lib/types';
import { defaultState } from '../lib/defaults';
import { getDb, getUser, lsGet, lsSet, lsRemove } from '../lib/platform';
import { addDays, weekStartOf } from '../lib/format';

// Zentraler App-Zustand mit zwei Speicherebenen:
// 1. localStorage – sofort, offline, ohne Anmeldung
// 2. db-Capability – privat je Person unter data/users/<id>/, geräteübergreifend
// Abgeglichen wird je Bereich (Profil, Pläne, Vorrat …): der jüngere Stand gewinnt.

const LS_KEY = 'wochentisch:v1';
export const SLICES: SliceKey[] = ['profile', 'plans', 'prefs', 'pantry', 'shopping', 'recipes'];

type Meta = Partial<Record<SliceKey, number>>;
export type SyncStatus = 'lokal' | 'verbinde' | 'synchron' | 'speichert' | 'verzögert' | 'fehler';

let state: AppState = defaultState();
let meta: Meta = {};
let firstRun = true;
const listeners = new Set<() => void>();

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function sliceValue(s: AppState, k: SliceKey): unknown {
  return k === 'profile' ? { profile: s.profile, ui: s.ui } : s[k];
}

function applySlice(s: AppState, k: SliceKey, v: any): AppState {
  if (k === 'profile') {
    const base = defaultState();
    return { ...s, profile: { ...base.profile, ...(v?.profile ?? {}) }, ui: { ...base.ui, ...(v?.ui ?? {}) } };
  }
  if (k === 'prefs') return { ...s, prefs: { ...defaultState().prefs, ...(v ?? {}) } };
  if (k === 'pantry' || k === 'recipes') return { ...s, [k]: Array.isArray(v) ? v : [] };
  return { ...s, [k]: v && typeof v === 'object' ? v : {} };
}

/** Alte Wochen entfernen, damit die Dokumente klein bleiben. */
function prune(s: AppState): AppState {
  const min = addDays(weekStartOf(new Date()), -7 * 8);
  const plans = Object.fromEntries(Object.entries(s.plans).filter(([k]) => k >= min));
  const shopping = Object.fromEntries(Object.entries(s.shopping).filter(([k]) => k >= min));
  return { ...s, plans, shopping };
}

// ───── Laden ─────
(function load() {
  const raw = lsGet(LS_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    let s = defaultState();
    const src = parsed.state ?? {};
    for (const k of SLICES) {
      const v = k === 'profile' ? { profile: src.profile, ui: src.ui } : src[k];
      if (v !== undefined) s = applySlice(s, k, v);
    }
    state = prune(s);
    meta = parsed.meta ?? {};
    firstRun = false;
  } catch {
    /* beschädigter Speicher: mit Standardwerten weiter */
  }
})();

export function isFirstRun() {
  return firstRun;
}

let saveTimer: number | undefined;
function saveLocal() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    lsSet(LS_KEY, JSON.stringify({ state, meta }));
  }, 250);
}

export function getState(): AppState {
  return state;
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const l of listeners) l();
}

/**
 * Zustand ändern; `slices` nennt die Bereiche, die gespeichert werden müssen.
 * `soft`: automatisch erzeugte Inhalte (z. B. der erste Beispielplan) – ein Stand aus dem Konto hat Vorrang.
 */
export function update(fn: (s: AppState) => AppState, slices: SliceKey[], soft = false) {
  const next = fn(state);
  if (next === state) return;
  state = next;
  const now = Date.now();
  for (const k of slices) meta[k] = soft ? (meta[k] ?? 1) : now;
  saveLocal();
  for (const k of slices) schedulePush(k);
  emit();
}

export function useApp(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function resetAll() {
  state = defaultState();
  const now = Date.now();
  for (const k of SLICES) meta[k] = now;
  lsRemove(LS_KEY);
  saveLocal();
  for (const k of SLICES) schedulePush(k);
  emit();
}

export function replaceAll(next: AppState) {
  state = prune(next);
  const now = Date.now();
  for (const k of SLICES) meta[k] = now;
  saveLocal();
  for (const k of SLICES) schedulePush(k);
  emit();
}

// ───── Konto-Speicher ─────

let syncStatus: SyncStatus = 'verbinde';
const syncListeners = new Set<() => void>();
function setSync(s: SyncStatus) {
  if (s === syncStatus) return;
  syncStatus = s;
  for (const l of syncListeners) l();
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (fn) => {
      syncListeners.add(fn);
      return () => syncListeners.delete(fn);
    },
    () => syncStatus,
    () => syncStatus,
  );
}

const remoteListeners = new Set<(k: SliceKey[]) => void>();
/** Benachrichtigt, wenn Bereiche aus dem Konto übernommen wurden. */
export function onRemoteApplied(fn: (k: SliceKey[]) => void) {
  remoteListeners.add(fn);
  return () => remoteListeners.delete(fn);
}
/** true, wenn der Bereich nur automatisch erzeugte Inhalte enthält. */
export function isSoft(k: SliceKey) {
  return (meta[k] ?? 0) <= 1;
}

let db: any = null;
let uid: string | null = null;
let cloudReady = false;
const pushTimers: Partial<Record<SliceKey, number>> = {};
const pushChains: Partial<Record<SliceKey, Promise<void>>> = {};
const pending = new Set<SliceKey>();
let failedWrites = false;

function schedulePush(k: SliceKey) {
  if (!cloudReady) return;
  pending.add(k);
  setSync('speichert');
  window.clearTimeout(pushTimers[k]);
  pushTimers[k] = window.setTimeout(() => push(k), 1200);
}

function push(k: SliceKey) {
  if (!db || !uid) return;
  const body = { updatedAt: meta[k] ?? Date.now(), v: clone(sliceValue(state, k)) };
  const size = JSON.stringify(body).length;
  if (size > 240_000) {
    pending.delete(k);
    setSync('fehler');
    return;
  }
  const prev = pushChains[k] ?? Promise.resolve();
  pushChains[k] = prev.then(async () => {
    try {
      await db.doc(`data/users/${uid}/${k}`).set(body);
      pending.delete(k);
      if (!pending.size) setSync(failedWrites ? 'fehler' : 'synchron');
    } catch (e: any) {
      if (e?.code === 'unavailable') {
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
        try {
          await db.doc(`data/users/${uid}/${k}`).set(body);
          pending.delete(k);
          if (!pending.size) setSync('synchron');
          return;
        } catch {
          /* unten behandeln */
        }
      }
      failedWrites = true;
      pending.delete(k);
      setSync('fehler');
    }
  });
}

export async function connectCloud() {
  const [user, database] = await Promise.all([getUser(), getDb()]);
  if (!database || !user) {
    setSync('lokal');
    return;
  }
  let id: string | null = null;
  try {
    id = await user.id();
  } catch {
    id = null;
  }
  if (!id) {
    setSync('lokal');
    return;
  }
  db = database;
  uid = id;
  let settled = false;
  const timer = window.setTimeout(() => {
    if (!settled) setSync('verzögert');
  }, 10_000);
  let first = true;
  try {
    db.collection(`data/users/${uid}`).onSnapshot(
      (snap: any) => {
        const seen = new Set<string>();
        const applied: SliceKey[] = [];
        let changed = false;
        for (const doc of snap.docs) {
          const k = doc.id as SliceKey;
          if (!SLICES.includes(k)) continue;
          seen.add(k);
          const data = doc.data();
          const remoteAt = Number(data?.updatedAt ?? 0);
          const localAt = meta[k] ?? 0;
          if (remoteAt > localAt && !pending.has(k)) {
            state = applySlice(state, k, clone(data.v));
            meta[k] = remoteAt;
            applied.push(k);
            changed = true;
          } else if (first && localAt > remoteAt) {
            pending.add(k);
            push(k);
          }
        }
        if (!snap.metadata?.fromCache) {
          settled = true;
          window.clearTimeout(timer);
          if (first) {
            // Bereiche, die es im Konto noch nicht gibt, einmal hochladen (nur wenn lokal etwas vorliegt)
            for (const k of SLICES) if (!seen.has(k) && meta[k]) {
              pending.add(k);
              push(k);
            }
          }
          first = false;
          cloudReady = true;
          if (!pending.size) setSync('synchron');
        }
        if (changed) {
          state = prune(state);
          saveLocal();
          emit();
          for (const l of remoteListeners) l(applied);
        }
      },
      () => {
        settled = true;
        window.clearTimeout(timer);
        setSync('lokal');
      },
    );
  } catch {
    setSync('lokal');
  }
}
