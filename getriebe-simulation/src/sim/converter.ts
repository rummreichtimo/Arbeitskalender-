/**
 * Drehmomentwandler-Modell (Föttinger-Wandler) – halb-empirisch.
 *
 *   Pumpenmoment     T_P = c₀ · ω_P² · (1 − ν⁴)        ν = ω_T / ω_P (Drehzahlverhältnis)
 *   Wandlung         μ(ν) = μ₀ − (μ₀ − 1) · ν / ν_K    für ν < ν_K (Kupplungspunkt), sonst 1
 *   Turbinenmoment   T_T = μ · T_P
 *   Wirkungsgrad     η = μ · ν
 *
 * Die Kennlinien (c₀, μ₀ = 2,1, ν_K = 0,85) sind typische Größenordnungen eines
 * Pkw-Wandlers, aber KEINE Messwerte eines bestimmten Wandlers.
 * Schubbetrieb (ν > 1): Turbine treibt Pumpe, Leitrad läuft im Freilauf (μ = 1).
 */

export const CONVERTER = {
  /** Leistungsbeiwert bei Stillstand der Turbine [Nm/(rad/s)²] → Festbremsdrehzahl ≈ 2200/min bei 300 Nm */
  c0: 5.65e-3,
  /** Wandlung im Festbremspunkt */
  stallRatio: 2.1,
  /** Kupplungspunkt: ab hier μ = 1, Leitrad löst sich vom Freilauf */
  couplingPoint: 0.85,
  /** Schubkennlinie relativ zum Zugbetrieb */
  coastFactor: 0.6,
};

export type ConverterRegime = 'Stillstand' | 'Festbremspunkt' | 'Wandlungsbereich' | 'Kupplungsbereich' | 'Schubbetrieb' | 'Überbrückt';

export interface ConverterState {
  /** Drehzahlverhältnis ν = ω_T/ω_P */
  sr: number;
  /** Momentenwandlung μ = T_T/T_P */
  tr: number;
  /** Pumpenmoment (Last am Motor) [Nm] */
  pumpTorque: number;
  /** Turbinenmoment [Nm] */
  turbineTorque: number;
  /** Wirkungsgrad η = μ·ν */
  efficiency: number;
  /** Schlupf 1 − ν */
  slip: number;
  /** Leitrad vom Freilauf gehalten? */
  statorLocked: boolean;
  regime: ConverterRegime;
}

export function torqueRatio(sr: number): number {
  const { stallRatio, couplingPoint } = CONVERTER;
  if (sr <= 0) return stallRatio;
  if (sr >= couplingPoint) return 1;
  return stallRatio - ((stallRatio - 1) * sr) / couplingPoint;
}

/** Kapazitätsfaktor (1 − ν⁴) im Zugbetrieb */
export function capacityFactor(sr: number): number {
  const s = Math.min(Math.max(sr, 0), 1);
  return 1 - s ** 4;
}

export function converterState(wp: number, wt: number): ConverterState {
  const { c0, coastFactor, couplingPoint } = CONVERTER;
  if (wp <= 1e-3 && Math.abs(wt) <= 1e-3) {
    return { sr: 0, tr: torqueRatio(0), pumpTorque: 0, turbineTorque: 0, efficiency: 0, slip: 1, statorLocked: true, regime: 'Stillstand' };
  }
  if (wt > wp) {
    // Schub: Turbine schneller als Pumpe – Moment fließt rückwärts, Leitrad im Freilauf
    const ratio = wp <= 1e-6 ? 0 : wp / wt;
    const T = -c0 * coastFactor * wt * wt * (1 - ratio ** 4);
    const sr = wp <= 1e-6 ? 99 : wt / wp;
    return {
      sr,
      tr: 1,
      pumpTorque: T,
      turbineTorque: T,
      efficiency: sr > 0 ? 1 / sr : 0,
      slip: 1 - sr,
      statorLocked: false,
      regime: 'Schubbetrieb',
    };
  }
  const sr = wp <= 1e-6 ? 0 : wt / wp;
  const tr = torqueRatio(sr);
  const Tp = c0 * wp * wp * capacityFactor(sr);
  const Tt = tr * Tp;
  const efficiency = Math.max(0, tr * sr);
  const regime: ConverterRegime = sr < 0.02 ? 'Festbremspunkt' : sr < couplingPoint ? 'Wandlungsbereich' : 'Kupplungsbereich';
  return { sr, tr, pumpTorque: Tp, turbineTorque: Tt, efficiency, slip: 1 - sr, statorLocked: sr < couplingPoint, regime };
}

/**
 * Für den Prüfstand: Welches Drehzahlverhältnis stellt sich ein, wenn der Motor
 * bei ω_P das Moment T in den Wandler leitet? (stationär: T_P(ν) = T)
 * Gibt außerdem zurück, ob das Moment die Festbremsgrenze übersteigt.
 */
export function solveSlipForTorque(wp: number, T: number): { sr: number; limited: boolean; maxTorque: number } {
  const maxTorque = CONVERTER.c0 * wp * wp;
  if (wp <= 1e-3) return { sr: 0, limited: true, maxTorque: 0 };
  if (T <= 0) return { sr: 1, limited: false, maxTorque };
  if (T >= maxTorque) return { sr: 0, limited: true, maxTorque };
  const sr = Math.pow(1 - T / maxTorque, 0.25);
  return { sr, limited: false, maxTorque };
}

/** Qualitative Leitraddrehzahl (für die Darstellung): steht bis zum Kupplungspunkt, läuft danach mit. */
export function statorSpeedVisual(wp: number, wt: number, locked: boolean): number {
  if (locked) return 0;
  const sr = wp > 1e-6 ? wt / wp : 0;
  const k = Math.min(1, Math.max(0, (sr - CONVERTER.couplingPoint) / (1 - CONVERTER.couplingPoint)));
  return wt * (0.4 + 0.5 * k);
}

/** Kennlinien für Diagramme */
export function converterCurves(steps = 60): { sr: number; tr: number; eta: number; k: number }[] {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const sr = Math.min(0.999, i / steps);
    const tr = torqueRatio(sr);
    pts.push({ sr, tr, eta: tr * sr, k: capacityFactor(sr) });
  }
  return pts;
}
