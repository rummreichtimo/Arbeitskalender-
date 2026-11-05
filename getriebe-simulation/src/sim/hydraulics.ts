/**
 * Stark vereinfachtes Lehrmodell der elektrohydraulischen Steuerung.
 * Die Logik (Magnetventilmuster, Handschieber, Systemdruck) ist typisch für
 * klassische 4-Gang-Automaten, die Zahlenwerte sind jedoch Größenordnungen
 * und keine Daten eines realen Ventilkörpers.
 */
import { ELEMENT_IDS, type ElementId } from './topology';

export type Selector = 'P' | 'R' | 'N' | 'D';

export interface ElementHydraulics {
  /** Kolbendruck [bar] */
  pressure: number;
  /** Kolbenhub 0 (Lüftspiel offen) … 1 (Lamellen angepresst) */
  stroke: number;
}

export interface SolenoidState {
  /** Schaltmagnetventil 1 */
  MV1: boolean;
  /** Schaltmagnetventil 2 */
  MV2: boolean;
  /** Wandlerkupplungs-Magnetventil (Tastverhältnis 0…1) */
  MVWK: number;
  /** Druckregel-Magnetventil (Tastverhältnis 0…1) */
  DR: number;
}

export interface HydraulicState {
  linePressure: number;
  elements: Record<ElementId | 'WK', ElementHydraulics>;
  solenoids: SolenoidState;
  manualValve: Selector;
}

/** Magnetventil-Schaltmuster je Gang (Lehrmodell) */
export const SOLENOID_PATTERN: Record<number, { MV1: boolean; MV2: boolean }> = {
  1: { MV1: true, MV2: false },
  2: { MV1: true, MV2: true },
  3: { MV1: false, MV2: true },
  4: { MV1: false, MV2: false },
};

/** Systemdruck: steigt mit der Last (höheres Moment braucht höhere Anpresskraft), im R-Gang angehoben. */
export function linePressure(engineRpm: number, throttle: number, reverse: boolean): number {
  const pumpFactor = Math.min(1, Math.max(0, (engineRpm - 150) / 450));
  const base = 4.5 + 9.5 * Math.min(1, Math.max(0, throttle));
  return pumpFactor * base * (reverse ? 1.45 : 1);
}

export function emptyElements(): Record<ElementId | 'WK', ElementHydraulics> {
  const r = {} as Record<ElementId | 'WK', ElementHydraulics>;
  for (const e of ELEMENT_IDS) r[e] = { pressure: 0, stroke: 0 };
  r.WK = { pressure: 0, stroke: 0 };
  return r;
}
