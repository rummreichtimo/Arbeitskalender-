/**
 * Allgemeiner Kinematik- und Momentenlöser für die Getriebetopologie.
 * Jede Bedingung (Willis-Gleichung, Kupplung, Bremse, vorgegebene Drehzahl)
 * ist eine lineare Gleichung in den Gliederdrehzahlen.
 */
import { solveMinNorm, solveSquare } from './linalg';
import { planetSpeedAbsolute, planetSpeedRelative } from './planetary';
import {
  ELEMENTS,
  GEARS,
  MEMBER_IDS,
  SETS,
  SET_IDS,
  type ElementId,
  type GearId,
  type MemberId,
  type SetId,
} from './topology';

export type MemberSpeeds = Record<MemberId, number>;

export interface PlanetMotion {
  /** absolute Drehzahl des Planeten um die eigene Achse */
  abs: number;
  /** Drehzahl relativ zum Planetenträger (Abwälzbewegung) */
  rel: number;
}

export interface SpeedSolution {
  speeds: MemberSpeeds;
  planets: Record<SetId, PlanetMotion>;
  rank: number;
  freeDof: number;
  inconsistent: boolean;
}

export interface SpeedProblem {
  /** starr wirkende Schaltelemente (Kupplung: gleiche Drehzahl; Bremse/Freilauf: Stillstand) */
  engaged: ElementId[];
  /** vorgegebene Drehzahlen (z. B. Eingang = Turbine, Ausgang = Fahrzeug) */
  fixed?: Partial<Record<MemberId, number>>;
  parkLock?: boolean;
}

const idx = (m: MemberId) => MEMBER_IDS.indexOf(m);

/** Baut die Gleichungsmatrix für ein Drehzahlproblem. */
function buildRows(p: SpeedProblem): { A: number[][]; b: number[] } {
  const n = MEMBER_IDS.length;
  const A: number[][] = [];
  const b: number[] = [];
  for (const sid of SET_IDS) {
    const s = SETS[sid];
    const row = new Array(n).fill(0);
    row[idx(s.carrier)] += s.zs + s.zr;
    row[idx(s.sun)] -= s.zs;
    row[idx(s.ring)] -= s.zr;
    A.push(row);
    b.push(0);
  }
  for (const eid of p.engaged) {
    const e = ELEMENTS[eid];
    const row = new Array(n).fill(0);
    row[idx(e.a)] = 1;
    if (e.b) row[idx(e.b)] = -1;
    A.push(row);
    b.push(0);
  }
  if (p.parkLock) {
    const row = new Array(n).fill(0);
    row[idx('OUT')] = 1;
    A.push(row);
    b.push(0);
  }
  if (p.fixed) {
    for (const [m, v] of Object.entries(p.fixed) as [MemberId, number][]) {
      if (v === undefined) continue;
      const row = new Array(n).fill(0);
      row[idx(m)] = 1;
      A.push(row);
      b.push(v);
    }
  }
  return { A, b };
}

export function planetMotions(speeds: MemberSpeeds): Record<SetId, PlanetMotion> {
  const out = {} as Record<SetId, PlanetMotion>;
  for (const sid of SET_IDS) {
    const s = SETS[sid];
    const ws = speeds[s.sun];
    const wc = speeds[s.carrier];
    out[sid] = { abs: planetSpeedAbsolute(s.zs, s.zp, ws, wc), rel: planetSpeedRelative(s.zs, s.zp, ws, wc) };
  }
  return out;
}

/** Löst die Gliederdrehzahlen. Unterbestimmte Freiheitsgrade erhalten die Lösung minimaler Norm. */
export function solveSpeeds(p: SpeedProblem): SpeedSolution {
  const { A, b } = buildRows(p);
  const res = solveMinNorm(A, b, MEMBER_IDS.length);
  const speeds = {} as MemberSpeeds;
  MEMBER_IDS.forEach((m, i) => (speeds[m] = Math.abs(res.x[i]) < 1e-12 ? 0 : res.x[i]));
  return { speeds, planets: planetMotions(speeds), rank: res.rank, freeDof: res.freeDof, inconsistent: res.inconsistent };
}

/** Stationäre Drehzahlen eines Gangs bei gegebener Eingangsdrehzahl. */
export function gearSpeeds(gear: GearId, inputSpeed: number, outputSpeed?: number): SpeedSolution {
  const g = GEARS[gear];
  const fixed: Partial<Record<MemberId, number>> = { IN: inputSpeed };
  const hasDrive = g.elements.includes('K1') || g.elements.includes('K2');
  if (!hasDrive) fixed.OUT = g.parkLock ? 0 : (outputSpeed ?? 0);
  return solveSpeeds({ engaged: g.elements, fixed, parkLock: g.parkLock });
}

/** Übersetzung i = ω_ein / ω_aus eines Gangs (NaN für P/N). */
export function gearRatio(gear: GearId): number {
  const g = GEARS[gear];
  if (!(g.elements.includes('K1') || g.elements.includes('K2'))) return NaN;
  const sol = solveSpeeds({ engaged: g.elements, fixed: { IN: 1 } });
  if (sol.freeDof > 0 || sol.inconsistent) return NaN;
  return 1 / sol.speeds.OUT;
}

export const GEAR_RATIOS: Record<GearId, number> = {
  P: NaN,
  N: NaN,
  R: gearRatio('R'),
  '1': gearRatio('1'),
  '1M': gearRatio('1M'),
  '2': gearRatio('2'),
  '3': gearRatio('3'),
  '4': gearRatio('4'),
};

// ---------------------------------------------------------------------------
// Statische Momentenanalyse (ideal, verlustfrei, stationär)
// ---------------------------------------------------------------------------

export interface TorqueAnalysis {
  /** Moment an der Ausgangswelle (an das Fahrzeug abgegeben) */
  output: number;
  /** Moment im Schaltelement (Kupplung: von a nach b übertragenes Moment, Bremse/Freilauf: Abstützmoment des Gehäuses) */
  elements: Partial<Record<ElementId, number>>;
  /** Zahnkraftgröße je Satz (Sonnenmoment = Zs·F) */
  setForce: Record<SetId, number>;
  /** Momente auf Sonne/Steg/Hohlrad je Satz */
  setTorques: Record<SetId, { sun: number; carrier: number; ring: number }>;
  /** übertragenes Moment je Glied (halbe Summe der Beträge aller angreifenden Momente) */
  memberLoad: Record<MemberId, number>;
  /** Parksperren-Abstützmoment */
  parkLock: number;
  determinate: boolean;
}

function zeroAnalysis(): TorqueAnalysis {
  const setForce = { PF: 0, PR: 0, PO: 0 };
  const setTorques = {
    PF: { sun: 0, carrier: 0, ring: 0 },
    PR: { sun: 0, carrier: 0, ring: 0 },
    PO: { sun: 0, carrier: 0, ring: 0 },
  };
  const memberLoad = {} as Record<MemberId, number>;
  MEMBER_IDS.forEach((m) => (memberLoad[m] = 0));
  return { output: 0, elements: {}, setForce, setTorques, memberLoad, parkLock: 0, determinate: true };
}

/**
 * Berechnet alle inneren Momente für einen Gang bei gegebenem Eingangsmoment.
 * Gleichgewicht an jedem Glied: Σ(Zahnmomente) + Σ(Schaltelemente) + äußere Momente = 0.
 * Planetensatz: T_s = Zs·F, T_r = Zr·F, T_c = −(Zs+Zr)·F.
 */
export function analyzeTorques(gear: GearId, inputTorque: number, engagedOverride?: ElementId[]): TorqueAnalysis {
  const g = GEARS[gear];
  const engaged = engagedOverride ?? g.elements;
  const hasDrive = engaged.includes('K1') || engaged.includes('K2');
  if (!hasDrive || inputTorque === 0) return zeroAnalysis();

  const nM = MEMBER_IDS.length;
  // Unbekannte: F je Satz, Moment je Element, Lastmoment am Ausgang
  const unknowns: string[] = [...SET_IDS.map((s) => `F_${s}`), ...engaged.map((e) => `T_${e}`), 'T_L'];
  const nU = unknowns.length;
  const A: number[][] = Array.from({ length: nM }, () => new Array(nU).fill(0));
  const b: number[] = new Array(nM).fill(0);
  SET_IDS.forEach((sid, k) => {
    const s = SETS[sid];
    A[idx(s.sun)][k] += s.zs;
    A[idx(s.ring)][k] += s.zr;
    A[idx(s.carrier)][k] -= s.zs + s.zr;
  });
  engaged.forEach((eid, j) => {
    const e = ELEMENTS[eid];
    const col = SET_IDS.length + j;
    // Kupplung: überträgt T von a nach b (auf a: −T, auf b: +T); Bremse: Gehäuse wirkt mit +T auf a
    if (e.b) {
      A[idx(e.a)][col] -= 1;
      A[idx(e.b)][col] += 1;
    } else A[idx(e.a)][col] += 1;
  });
  A[idx('OUT')][nU - 1] = 1;
  b[idx('IN')] = -inputTorque;

  let x: number[] | null = null;
  let determinate = true;
  if (nU === nM) x = solveSquare(A, b);
  if (!x) {
    determinate = false;
    x = solveMinNorm(A, b, nU).x;
  }
  const res = zeroAnalysis();
  res.determinate = determinate;
  SET_IDS.forEach((sid, k) => {
    const s = SETS[sid];
    const F = x![k];
    res.setForce[sid] = F;
    res.setTorques[sid] = { sun: s.zs * F, ring: s.zr * F, carrier: -(s.zs + s.zr) * F };
  });
  engaged.forEach((eid, j) => (res.elements[eid] = x![SET_IDS.length + j]));
  const TL = x[nU - 1];
  res.output = -TL;

  // Belastung je Glied
  const contrib: Record<MemberId, number[]> = {} as Record<MemberId, number[]>;
  MEMBER_IDS.forEach((m) => (contrib[m] = []));
  SET_IDS.forEach((sid) => {
    const s = SETS[sid];
    const t = res.setTorques[sid];
    contrib[s.sun].push(t.sun);
    contrib[s.ring].push(t.ring);
    contrib[s.carrier].push(t.carrier);
  });
  engaged.forEach((eid) => {
    const e = ELEMENTS[eid];
    const T = res.elements[eid] ?? 0;
    if (e.b) {
      contrib[e.a].push(-T);
      contrib[e.b].push(T);
    } else contrib[e.a].push(T);
  });
  contrib.IN.push(inputTorque);
  contrib.OUT.push(TL);
  MEMBER_IDS.forEach((m) => {
    const sum = contrib[m].reduce((s, v) => s + Math.abs(v), 0) / 2;
    res.memberLoad[m] = sum < 1e-9 ? 0 : sum;
  });
  return res;
}

/** Interpoliert zwei Momentenanalysen (für die Momentenphase einer Schaltung). */
export function blendTorque(a: TorqueAnalysis, b: TorqueAnalysis, t: number): TorqueAnalysis {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  const res = zeroAnalysis();
  res.output = lerp(a.output, b.output);
  const ids = new Set<ElementId>([...(Object.keys(a.elements) as ElementId[]), ...(Object.keys(b.elements) as ElementId[])]);
  ids.forEach((e) => (res.elements[e] = lerp(a.elements[e] ?? 0, b.elements[e] ?? 0)));
  SET_IDS.forEach((s) => {
    res.setForce[s] = lerp(a.setForce[s], b.setForce[s]);
    res.setTorques[s] = {
      sun: lerp(a.setTorques[s].sun, b.setTorques[s].sun),
      carrier: lerp(a.setTorques[s].carrier, b.setTorques[s].carrier),
      ring: lerp(a.setTorques[s].ring, b.setTorques[s].ring),
    };
  });
  MEMBER_IDS.forEach((m) => (res.memberLoad[m] = lerp(a.memberLoad[m], b.memberLoad[m])));
  res.parkLock = lerp(a.parkLock, b.parkLock);
  return res;
}
