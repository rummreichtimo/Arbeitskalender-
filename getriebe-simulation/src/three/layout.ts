/**
 * Räumliche Anordnung des Lehrmodells (Szeneneinheiten, 1 Einheit ≈ 100 mm).
 * Getriebeachse = X-Achse; Motor bei −X, Abtrieb bei +X.
 *
 * Verschachtelung (von vorne nach hinten):
 *  Wandler │ Ölpumpe │ Sonnenradtrommel (K2 innen, Bremsband B1 außen) ⊃ Eingangstrommel (K1)
 *  │ vorderer Satz │ hinterer Satz (Trägertrommel mit B2/F1) │ OD-Einheit (K3 innen, B3 außen) │ Abtrieb
 * Die Verbindungen kreuzen sich nicht (konstruktiv widerspruchsfreie Schachtelung).
 */
import { MODULE, SETS } from '../sim/topology';

const m = MODULE;
const pitchR = (z: number) => (z * m) / 2;

export const FACE = 0.42;

export const SET_LAYOUT = {
  PF: { x: -2.3, centerR: pitchR(SETS.PF.zs + SETS.PF.zp), ringOuter: 1.62 },
  PR: { x: -1.05, centerR: pitchR(SETS.PR.zs + SETS.PR.zp), ringOuter: 1.71 },
  PO: { x: 1.6, centerR: pitchR(SETS.PO.zs + SETS.PO.zp), ringOuter: 1.76 },
} as const;

export const L = {
  m,
  shaft: { in: 0.22, statorSupportIn: 0.28, statorSupportOut: 0.42, m: 0.24, out: 0.3 },
  engine: { x0: -9.2, x1: -8.35 },
  conv: { xc: -7.0, R0: 1.7, a: 0.78, core: 0.3, coverX: -8.1, rim: 2.62, pumpHubX1: -5.25 },
  pump: { x0: -5.65, x1: -5.2 },
  sDrum: { front: -4.95, end: -1.74, rIn: 1.94, rOut: 2.0, plateX: -1.77, hubR: 0.48 },
  inDrum: { plateX: -4.52, x0: -4.85, x1: -3.05, rIn: 1.5, rOut: 1.55 },
  k2: { x0: -4.8, x1: -4.3, rIn: 1.56, rOut: 1.92, pistonX: -4.88 },
  b1: { x0: -4.72, x1: -4.36, r: 2.0 },
  k1: { x0: -4.1, x1: -3.3, rIn: 1.07, rOut: 1.48, pistonX: -4.3 },
  rfHub: { x0: -4.15, x1: -2.62, rIn: 1.0, rOut: 1.06 },
  rfPlateX: -2.65,
  cfFrontX: -2.555,
  sun: { x0: -2.53, x1: -0.82 },
  crDrum: { plateX: -1.37, x1: -0.33, rIn: 1.87, rOut: 1.93 },
  b2: { x0: -1.28, x1: -0.78, rIn: 1.94, rOut: 2.36 },
  f1: { x0: -0.72, x1: -0.38, rIn: 1.93, rOut: 2.36 },
  rrPlateX: -0.67,
  soCup: { front: 0.1, end: 0.95, rIn: 1.9, rOut: 1.96, hubR: 0.42 },
  coDrum: { x0: 0.3, plateX: 1.33, rIn: 1.45, rOut: 1.5 },
  k3: { x0: 0.36, x1: 0.86, rIn: 1.51, rOut: 1.88, pistonX: 0.22 },
  b3: { x0: 0.26, x1: 0.86, rIn: 1.97, rOut: 2.36 },
  coRearX: 1.89,
  roPlateX: 2.03,
  out: { x0: 2.0, x1: 5.9 },
  park: { x: 2.82, z: 18, m: 0.09 },
  toneOut: { x: 3.36 },
  toneIn: { x: -3.15 },
  housing: { rMain: 2.5, rBell: 2.92, xBell: -8.3, xFront: -5.65, xRear: 2.35 },
  valveBody: { x0: -4.6, x1: 1.2, y0: -3.2, y1: -2.68, z: 0.9 },
} as const;

/** Explosionsversatz je Baugruppe (bei Explosionsfaktor 1) */
export const EXPLODE: Record<string, [number, number, number]> = {
  engine: [-6.0, 0, 0],
  converter: [-4.2, 0, 0],
  pump: [-2.8, 0, 0],
  drumS: [-0.8, 3.4, 0],
  bandB1: [-0.8, 4.4, 0],
  inDrum: [-2.0, 0, 0],
  rf: [-1.0, 0, 0],
  pf: [-0.2, 0, 0],
  sun: [0.3, 0, 0],
  pr: [0.5, -3.2, 0],
  rr: [1.0, 0, 0],
  brakesRear: [0.5, -4.4, 0],
  mshaft: [0.4, 0, 0],
  od: [1.4, 3.2, 0],
  odBrake: [1.4, 4.4, 0],
  po: [2.0, 0, 0],
  out: [3.0, 0, 0],
  housing: [0, 0, -4.5],
  valveBody: [0, -2.4, 0],
  tcu: [0, -1, 2.0],
  sensors: [0, 1.0, 0],
};
