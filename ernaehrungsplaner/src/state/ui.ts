import { useSyncExternalStore } from 'react';
import type { SlotId } from '../lib/types';
import { weekStartOf } from '../lib/format';

// Flüchtiger Oberflächenzustand: geöffnete Dialoge, Hinweise, gewählte Woche.

export type Modal =
  | { type: 'recipe'; id: string; servings?: number; day?: number; slot?: SlotId }
  | { type: 'meal'; day: number; slot: SlotId }
  | { type: 'swap'; day: number; slot: SlotId; mode: 'swap' | 'add' }
  | { type: 'addToPlan'; id: string }
  | { type: 'editor'; id?: string; draft?: unknown }
  | { type: 'ai'; day?: number; slot?: SlotId }
  | { type: 'export'; title: string; text: string; filename: string; csv?: string }
  | { type: 'confirm'; title: string; body: string; confirm: string; danger?: boolean; onConfirm: () => void };

export interface Toast {
  id: number;
  text: string;
  undo?: () => void;
}

interface UiState {
  modals: Modal[];
  toasts: Toast[];
  week: string;
}

let ui: UiState = { modals: [], toasts: [], week: weekStartOf(new Date()) };
const listeners = new Set<() => void>();
const set = (next: UiState) => {
  ui = next;
  for (const l of listeners) l();
};

export function useUi(): UiState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => ui,
    () => ui,
  );
}

export const openModal = (m: Modal) => set({ ...ui, modals: [...ui.modals, m] });
export const closeModal = () => set({ ...ui, modals: ui.modals.slice(0, -1) });
export const closeAllModals = () => set({ ...ui, modals: [] });
export const replaceModal = (m: Modal) => set({ ...ui, modals: [...ui.modals.slice(0, -1), m] });
export const setWeek = (week: string) => set({ ...ui, week });

let toastId = 0;
export function toast(text: string, undo?: () => void) {
  const id = ++toastId;
  set({ ...ui, toasts: [...ui.toasts.slice(-2), { id, text, undo }] });
  window.setTimeout(() => dismissToast(id), undo ? 6500 : 3500);
}
export function dismissToast(id: number) {
  if (!ui.toasts.some((t) => t.id === id)) return;
  set({ ...ui, toasts: ui.toasts.filter((t) => t.id !== id) });
}
