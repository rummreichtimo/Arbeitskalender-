import { create } from 'zustand';
import { TransmissionSim, type SimInputs, type SimSnapshot } from '../sim/simulation';
import type { GearId } from '../sim/topology';

const isNarrow = () => typeof window !== 'undefined' && window.innerWidth < 820;

/** Globale Simulationsinstanz (wird im Render-Loop fortgeschrieben) */
export const sim = new TransmissionSim();

export type ViewId = 'transmission' | 'converter' | 'planetary' | 'compare' | 'learn';
export type SectionMode = 'off' | 'shells' | 'full';
export type CameraPreset = 'iso' | 'front' | 'side' | 'top' | 'section' | 'converter' | 'gearsets' | 'od' | 'clutches' | 'valvebody' | 'tcu' | 'explode';

export interface CameraRequest {
  id: number;
  preset?: CameraPreset;
  focus?: string;
}

export interface UIState {
  view: ViewId;
  running: boolean;
  timeScale: number;
  pendingSteps: number;
  showFlow: boolean;
  showLabels: boolean;
  showOil: boolean;
  housingOpacity: number;
  xray: boolean;
  section: SectionMode;
  explode: number;
  selected: string | null;
  hovered: string | null;
  isolate: boolean;
  camera: CameraRequest;
  snapshot: SimSnapshot;
  /** vom Lernmodus hervorgehobene Bauteile */
  highlight: string[];
  panelOpen: { left: boolean; right: boolean };

  setView: (v: ViewId) => void;
  setRunning: (r: boolean) => void;
  setTimeScale: (t: number) => void;
  stepFrame: () => void;
  resetSim: () => void;
  setSim: (p: Partial<SimInputs>) => void;
  set: (p: Partial<UIState>) => void;
  select: (id: string | null) => void;
  requestCamera: (r: Omit<CameraRequest, 'id'>) => void;
  refresh: () => void;
  benchGear: (g: GearId) => void;
}

export const useStore = create<UIState>((set, get) => ({
  view: 'transmission',
  running: true,
  timeScale: 1,
  pendingSteps: 0,
  showFlow: true,
  showLabels: true,
  showOil: true,
  housingOpacity: 0.16,
  xray: false,
  section: 'shells',
  explode: 0,
  selected: null,
  hovered: null,
  isolate: false,
  camera: { id: 0, preset: 'iso' },
  snapshot: sim.snapshot(),
  highlight: [],
  panelOpen: { left: !isNarrow(), right: !isNarrow() },

  setView: (view) => set({ view, selected: null, isolate: false, highlight: [] }),
  setRunning: (running) => set({ running }),
  setTimeScale: (timeScale) => set({ timeScale }),
  stepFrame: () => set({ pendingSteps: get().pendingSteps + 1, running: false }),
  resetSim: () => {
    sim.reset({ ...sim.inputs, throttle: 0, brake: 0, selector: sim.inputs.mode === 'drive' ? 'P' : sim.inputs.selector });
    set({ snapshot: sim.snapshot() });
  },
  setSim: (p) => {
    sim.setInputs(p);
    set({ snapshot: sim.snapshot() });
  },
  set: (p) => set(p),
  select: (selected) => set({ selected, isolate: selected ? get().isolate : false }),
  requestCamera: (r) => set({ camera: { ...r, id: get().camera.id + 1 } }),
  refresh: () => set({ snapshot: sim.snapshot() }),
  benchGear: (g) => {
    sim.setInputs({ benchGear: g });
    set({ snapshot: sim.snapshot() });
  },
}));

// Für automatisierte Browser-Tests (nur Entwicklungsmodus)
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__app = { sim, useStore };
