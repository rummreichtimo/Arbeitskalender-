import { describe, expect, it } from 'vitest';
import {
  carrierSpeed,
  checkGeometry,
  completeSpeeds,
  planetAngle,
  planetSpeedAbsolute,
  ringToothOffset,
  setTorques,
  solveSingleSet,
  toothPhase,
  willisResidual,
  type SetMember,
} from '../src/sim/planetary';
import { SETS, SET_IDS } from '../src/sim/topology';

const g = { zs: 30, zr: 72 };

describe('Willis-Gleichung', () => {
  it('erfüllt (Zs+Zr)·ωc = Zs·ωs + Zr·ωr für beliebige Kombinationen', () => {
    for (let i = 0; i < 50; i++) {
      const ws = Math.random() * 200 - 100;
      const wr = Math.random() * 200 - 100;
      const s = completeSpeeds(g, { sun: ws, ring: wr });
      expect(Math.abs(willisResidual(g, s))).toBeLessThan(1e-9);
      expect(s.carrier).toBeCloseTo(carrierSpeed(g.zs, g.zr, ws, wr), 12);
    }
  });

  it('verbundene Glieder ⇒ Block (alle Glieder gleich schnell)', () => {
    const s = completeSpeeds(g, { sun: 7, carrier: 7 });
    expect(s.ring).toBeCloseTo(7, 12);
  });
});

describe('Einzelner Planetensatz – sechs Grundschaltungen', () => {
  const cases: [SetMember, SetMember, SetMember, number][] = [
    ['sun', 'ring', 'carrier', (30 + 72) / 30], // große Untersetzung
    ['ring', 'sun', 'carrier', (30 + 72) / 72], // kleine Untersetzung
    ['carrier', 'ring', 'sun', 30 / (30 + 72)], // große Übersetzung ins Schnelle
    ['carrier', 'sun', 'ring', 72 / (30 + 72)], // kleine Übersetzung ins Schnelle (Overdrive)
    ['sun', 'carrier', 'ring', -72 / 30], // Umkehr, Untersetzung
    ['ring', 'carrier', 'sun', -30 / 72], // Umkehr, Übersetzung ins Schnelle
  ];
  for (const [input, fixed, output, expected] of cases) {
    it(`Antrieb ${input}, fest ${fixed}, Abtrieb ${output}: i = ${expected.toFixed(4)}`, () => {
      const r = solveSingleSet(g, input, fixed, output, 1);
      expect(r.ratio).toBeCloseTo(expected, 10);
      expect(r.speeds[fixed]).toBe(0);
      expect(r.direction).toBe(expected < 0 ? 'umgekehrt' : 'gleich');
    });
  }

  it('Momentengleichgewicht T_s + T_r + T_c = 0 und Leistungsbilanz', () => {
    const t = setTorques(30, 72, 1.7);
    expect(t.sun + t.ring + t.carrier).toBeCloseTo(0, 12);
    // Leistung: Σ T·ω = 0 für jede kinematisch zulässige Bewegung
    const s = completeSpeeds(g, { sun: 3.3, ring: -1.2 });
    const P = t.sun * s.sun + t.ring * s.ring + t.carrier * s.carrier;
    expect(P).toBeCloseTo(0, 9);
  });
});

describe('Geometrie der verwendeten Planetensätze', () => {
  for (const sid of SET_IDS) {
    const s = SETS[sid];
    it(`${s.name}: Koaxial-, Montage- und Nachbarbedingung erfüllt`, () => {
      const c = checkGeometry(s);
      expect(c.coaxial).toBe(true);
      expect(c.assembly).toBe(true);
      expect(c.neighbour).toBe(true);
    });
  }
  it('erkennt verletzte Bedingungen', () => {
    const c = checkGeometry({ zs: 30, zp: 20, zr: 72, planets: 3, module: 1 });
    expect(c.coaxial).toBe(false);
    const d = checkGeometry({ zs: 30, zp: 21, zr: 72, planets: 4, module: 1 });
    expect(d.assembly).toBe(false);
  });
});

describe('Zahneingriff der Darstellung (Phasenlage)', () => {
  for (const sid of SET_IDS) {
    const s = SETS[sid];
    it(`${s.name}: Zahn trifft Lücke an allen Planeten (Sonne und Hohlrad)`, () => {
      const offset = ringToothOffset(s.zp, s.zr);
      for (let trial = 0; trial < 40; trial++) {
        // zulässige Bewegung: beliebige Sonne/Steg-Winkel, Hohlrad aus Willis
        const ts = (Math.random() - 0.5) * 50;
        const tc = (Math.random() - 0.5) * 50;
        const tr = ((s.zs + s.zr) * tc - s.zs * ts) / s.zr;
        for (let i = 0; i < s.planets; i++) {
          const slot = (2 * Math.PI * i) / s.planets;
          const psi = tc + slot;
          const tp = planetAngle(s.zs, s.zp, ts, tc, slot);
          // Sonne–Planet: Phase Sonne bei ψ + Phase Planet bei ψ+π = 1/2
          const us = toothPhase(s.zs, ts, psi);
          const up = toothPhase(s.zp, tp, psi + Math.PI);
          const sumSP = (us + up) % 1;
          expect(Math.min(Math.abs(sumSP - 0.5), 1 - Math.abs(sumSP - 0.5))).toBeLessThan(1e-6);
          // Hohlrad–Planet: Phase Hohlrad bei ψ − Phase Planet bei ψ = 1/2
          const ur = toothPhase(s.zr, tr, psi, offset);
          const upo = toothPhase(s.zp, tp, psi);
          let d = (ur - upo) % 1;
          if (d < 0) d += 1;
          expect(Math.min(Math.abs(d - 0.5), 1 - Math.abs(d - 0.5))).toBeLessThan(1e-6);
        }
      }
    });
  }

  it('Planetendrehzahl entspricht der Ableitung des Planetenwinkels', () => {
    const s = SETS.PF;
    const ws = 2.5;
    const wc = 0.8;
    const dt = 1e-6;
    const a0 = planetAngle(s.zs, s.zp, 0, 0, 0);
    const a1 = planetAngle(s.zs, s.zp, ws * dt, wc * dt, 0);
    expect((a1 - a0) / dt).toBeCloseTo(planetSpeedAbsolute(s.zs, s.zp, ws, wc), 6);
  });
});
