/**
 * Getriebesteuergerät (TCU) – Schaltkennfeld und Wandlerüberbrückung.
 * Kennfeld: Schaltgeschwindigkeit als Funktion des Lastgrads (Gaspedal).
 * Rückschaltlinien liegen unterhalb der Hochschaltlinien (Hysterese gegen Pendelschaltungen).
 */
import { interp } from './engine';

export type ShiftLine = [number, number][]; // [Lastgrad 0…1, Geschwindigkeit km/h]

export const SHIFT_MAP: { up: Record<1 | 2 | 3, ShiftLine>; down: Record<2 | 3 | 4, ShiftLine> } = {
  up: {
    1: [
      [0, 14],
      [0.25, 22],
      [0.5, 36],
      [0.75, 54],
      [0.95, 70],
      [1, 72],
    ],
    2: [
      [0, 32],
      [0.25, 44],
      [0.5, 66],
      [0.75, 94],
      [0.95, 122],
      [1, 125],
    ],
    3: [
      [0, 52],
      [0.25, 62],
      [0.5, 90],
      [0.75, 128],
      [0.95, 172],
      [1, 178],
    ],
  },
  down: {
    2: [
      [0, 8],
      [0.25, 12],
      [0.5, 22],
      [0.75, 34],
      [0.95, 50],
      [1, 62],
    ],
    3: [
      [0, 20],
      [0.25, 28],
      [0.5, 44],
      [0.75, 68],
      [0.95, 100],
      [1, 112],
    ],
    4: [
      [0, 38],
      [0.25, 46],
      [0.5, 68],
      [0.75, 104],
      [0.95, 145],
      [1, 160],
    ],
  },
};

export function upshiftSpeed(from: 1 | 2 | 3, throttle: number): number {
  return interp(SHIFT_MAP.up[from], throttle);
}

export function downshiftSpeed(from: 2 | 3 | 4, throttle: number): number {
  return interp(SHIFT_MAP.down[from], throttle);
}

export interface TcuDecision {
  target: number;
  reason: string;
}

/**
 * Bestimmt den Sollgang (1…4) für Wählhebel "D".
 * @param current aktueller Gang
 * @param vKmh Fahrgeschwindigkeit (aus Abtriebsdrehzahlsensor)
 * @param throttle Lastgrad 0…1 (vom Motorsteuergerät)
 * @param maxGear manuelle Begrenzung (4 = keine)
 * @param minGear manuell gehaltener Gang (1 = keine Untergrenze)
 */
export function decideGear(current: number, vKmh: number, throttle: number, maxGear = 4, minGear = 1): TcuDecision {
  const th = Math.min(1, Math.max(0, throttle));
  if (current > maxGear) return { target: current - 1, reason: `Gang ${maxGear} vorgewählt – Rückschaltung` };
  if (current < minGear) return { target: current + 1, reason: `Gang ${minGear} vorgewählt – Hochschaltung` };
  if (current < maxGear && current >= 1 && current <= 3) {
    const vUp = upshiftSpeed(current as 1 | 2 | 3, th);
    if (vKmh > vUp) return { target: current + 1, reason: `v = ${vKmh.toFixed(0)} km/h > Hochschaltlinie ${current}→${current + 1} (${vUp.toFixed(0)} km/h bei ${(th * 100).toFixed(0)} % Last)` };
  }
  if (current > minGear && current >= 2) {
    const vDown = downshiftSpeed(current as 2 | 3 | 4, th);
    if (vKmh < vDown) {
      const kd = th > 0.95 ? ' (Kickdown)' : '';
      return { target: current - 1, reason: `v = ${vKmh.toFixed(0)} km/h < Rückschaltlinie ${current}→${current - 1} (${vDown.toFixed(0)} km/h)${kd}` };
    }
  }
  return { target: current, reason: 'Betriebspunkt zwischen Hoch- und Rückschaltlinie – Gang wird gehalten' };
}

/** Wandlerüberbrückung: im 3./4. Gang bei konstanter Fahrt mit mäßiger Last. */
export function decideLockup(gear: number, vKmh: number, throttle: number, currentlyCommanded: boolean, shifting: boolean): boolean {
  if (shifting || gear < 3) return false;
  const onSpeed = gear === 4 ? 58 : 72;
  if (currentlyCommanded) {
    if (throttle > 0.72) return false;
    if (vKmh < onSpeed - 8) return false;
    return true;
  }
  return vKmh > onSpeed && throttle < 0.55;
}
