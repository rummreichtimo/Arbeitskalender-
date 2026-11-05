import { describe, expect, it } from 'vitest';
import { analyzeTorques, gearRatio, gearSpeeds, GEAR_RATIOS, solveSpeeds } from '../src/sim/kinematics';
import { ELEMENTS, GEARS, MEMBER_IDS, SETS, type GearId, type MemberId, type RoleKey } from '../src/sim/topology';

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('Übersetzungen des Lehrmodells', () => {
  const zs = 30;
  const zrv = 66;
  const zrh = 70;
  const zso = 30;
  const zro = 72;
  const expected: Record<string, number> = {
    '1': 1 + (zs + zrh) / zrv,
    '1M': 1 + (zs + zrh) / zrv,
    '2': 1 + zs / zrv,
    '3': 1,
    '4': zro / (zso + zro),
    R: -zrh / zs,
  };
  for (const [gear, i] of Object.entries(expected)) {
    it(`Gang ${gear}: i = ${i.toFixed(4)}`, () => {
      expect(gearRatio(gear as GearId)).toBeCloseTo(i, 10);
    });
  }
  it('Gangsprünge sind monoton fallend und 4. Gang ist ein Overdrive', () => {
    expect(GEAR_RATIOS['1']).toBeGreaterThan(GEAR_RATIOS['2']);
    expect(GEAR_RATIOS['2']).toBeGreaterThan(GEAR_RATIOS['3']);
    expect(GEAR_RATIOS['3']).toBeGreaterThan(GEAR_RATIOS['4']);
    expect(GEAR_RATIOS['4']).toBeLessThan(1);
  });
  it('Rückwärtsgang dreht die Ausgangswelle entgegengesetzt', () => {
    const s = gearSpeeds('R', 100);
    expect(s.speeds.OUT).toBeLessThan(0);
    expect(GEAR_RATIOS.R).toBeLessThan(0);
  });
  it('P und N übertragen keine Übersetzung', () => {
    expect(gearRatio('P')).toBeNaN();
    expect(gearRatio('N')).toBeNaN();
  });
});

describe('Kinematische Konsistenz aller Gänge', () => {
  const gears: GearId[] = ['R', '1', '1M', '2', '3', '4'];
  for (const gear of gears) {
    it(`Gang ${gear}: eindeutig bestimmt, widerspruchsfrei, Willis in allen Sätzen erfüllt`, () => {
      const sol = gearSpeeds(gear, 314.16);
      expect(sol.inconsistent).toBe(false);
      expect(sol.freeDof).toBe(0);
      for (const s of Object.values(SETS)) {
        const res = (s.zs + s.zr) * sol.speeds[s.carrier] - s.zs * sol.speeds[s.sun] - s.zr * sol.speeds[s.ring];
        expect(Math.abs(res)).toBeLessThan(1e-6);
      }
    });
    it(`Gang ${gear}: geschlossene Elemente – Kupplungen gleiche Drehzahl, Bremsen Stillstand`, () => {
      const sol = gearSpeeds(gear, 200);
      for (const eid of GEARS[gear].elements) {
        const e = ELEMENTS[eid];
        if (e.b) expect(close(sol.speeds[e.a], sol.speeds[e.b], 1e-7)).toBe(true);
        else expect(Math.abs(sol.speeds[e.a])).toBeLessThan(1e-7);
      }
    });
  }

  it('2 gleichzeitig geschlossene Bremsen + Kupplung verspannen das Getriebe (Widerspruch wird erkannt)', () => {
    const sol = solveSpeeds({ engaged: ['K1', 'K2', 'K3', 'B1'], fixed: { IN: 100 } });
    expect(sol.inconsistent).toBe(true);
  });

  it('Freilauf F1 überholt im 2., 3. und 4. Gang (Träger hinten dreht vorwärts)', () => {
    for (const gear of ['2', '3', '4'] as GearId[]) {
      const sol = gearSpeeds(gear, 100);
      expect(sol.speeds.CR).toBeGreaterThan(0);
    }
  });

  it('Sonnenrad dreht im 1. Gang rückwärts (−Zr,h/Zs · ω_ab)', () => {
    const sol = gearSpeeds('1', 100);
    expect(sol.speeds.S).toBeCloseTo((-70 / 30) * sol.speeds.OUT, 9);
  });

  it('OD-Sonnenrad dreht im 4. Gang still, im 3. Gang mit Eingangsdrehzahl', () => {
    expect(gearSpeeds('4', 100).speeds.SO).toBeCloseTo(0, 9);
    expect(gearSpeeds('3', 100).speeds.SO).toBeCloseTo(100, 9);
  });

  it('Neutral: Fahrzeug steht ⇒ alle Radsatzglieder stehen, nur die Eingangswelle dreht', () => {
    const sol = gearSpeeds('N', 80, 0);
    expect(sol.speeds.IN).toBe(80);
    for (const m of ['S', 'RF', 'M', 'CR', 'SO', 'OUT'] as MemberId[]) expect(Math.abs(sol.speeds[m])).toBeLessThan(1e-9);
  });

  it('Parken: Ausgangswelle gesperrt, auch wenn die Eingangswelle dreht', () => {
    const sol = gearSpeeds('P', 80);
    expect(sol.speeds.OUT).toBe(0);
  });
});

describe('Momentenanalyse (ideal, verlustfrei)', () => {
  const Tin = 200;
  const gears: GearId[] = ['R', '1', '1M', '2', '3', '4'];
  for (const gear of gears) {
    it(`Gang ${gear}: Abtriebsmoment = i · Eingangsmoment und Leistungsbilanz`, () => {
      const t = analyzeTorques(gear, Tin);
      const i = gearRatio(gear);
      expect(t.determinate).toBe(true);
      expect(t.output).toBeCloseTo(Tin * i, 6);
      const sol = gearSpeeds(gear, 100);
      expect(Tin * sol.speeds.IN).toBeCloseTo(t.output * sol.speeds.OUT, 6);
    });

    it(`Gang ${gear}: Bremsen leisten keine Arbeit, Farbrollen passen zur Momentenanalyse`, () => {
      const t = analyzeTorques(gear, Tin);
      const sol = gearSpeeds(gear, 100);
      const roles = GEARS[gear].roles;
      for (const m of MEMBER_IDS) {
        const role = roles[m];
        const load = t.memberLoad[m];
        if (role === 'idle') expect(load).toBeLessThan(1e-6);
        if (role === 'driven' || role === 'output' || role === 'input') expect(load).toBeGreaterThan(1e-3);
        if (role === 'held') expect(Math.abs(sol.speeds[m])).toBeLessThan(1e-9);
      }
      const planetKeys: [RoleKey, 'PF' | 'PR' | 'PO'][] = [
        ['P_PF', 'PF'],
        ['P_PR', 'PR'],
        ['P_PO', 'PO'],
      ];
      for (const [key, sid] of planetKeys) {
        const active = Math.abs(t.setForce[sid]) > 1e-6;
        expect(active).toBe(roles[key] !== 'idle');
      }
    });
  }

  it('Freilauf F1 stützt im 1. Gang ein positives Moment ab (sperrt gegen Rückwärtsdrehung)', () => {
    const t = analyzeTorques('1', Tin);
    expect(t.elements.F1!).toBeGreaterThan(0);
  });

  it('3. Gang: Momentenaufteilung K1 : K2 = Zr : Zs des vorderen Satzes', () => {
    const t = analyzeTorques('3', 100);
    expect(t.elements.K1!).toBeCloseTo((100 * 66) / 96, 9);
    expect(t.elements.K2!).toBeCloseTo((100 * 30) / 96, 9);
  });

  it('Neutral und Parken übertragen kein Moment', () => {
    expect(analyzeTorques('N', Tin).output).toBe(0);
    expect(analyzeTorques('P', Tin).output).toBe(0);
  });
});
