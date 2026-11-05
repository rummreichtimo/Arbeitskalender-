import { describe, expect, it } from 'vitest';
import { CONVERTER, converterState, solveSlipForTorque, torqueRatio } from '../src/sim/converter';
import { GEAR_RATIOS } from '../src/sim/kinematics';
import { PHASE_DURATION, ShiftProcess, planShift } from '../src/sim/shift';
import { TransmissionSim } from '../src/sim/simulation';
import { SHIFT_MAP, decideGear, downshiftSpeed, upshiftSpeed } from '../src/sim/tcu';
import { toRad } from '../src/sim/engine';

describe('Drehmomentwandler', () => {
  it('Festbremspunkt: maximale Wandlung, Turbine steht', () => {
    const s = converterState(toRad(2000), 0);
    expect(s.tr).toBeCloseTo(CONVERTER.stallRatio, 9);
    expect(s.turbineTorque).toBeCloseTo(CONVERTER.stallRatio * s.pumpTorque, 9);
    expect(s.efficiency).toBe(0);
    expect(s.statorLocked).toBe(true);
  });
  it('Wandlung fällt bis zum Kupplungspunkt auf 1, danach Leitrad im Freilauf', () => {
    expect(torqueRatio(0.4)).toBeLessThan(CONVERTER.stallRatio);
    expect(torqueRatio(0.4)).toBeGreaterThan(1);
    expect(torqueRatio(CONVERTER.couplingPoint)).toBeCloseTo(1, 9);
    expect(converterState(100, 90).statorLocked).toBe(false);
  });
  it('Wirkungsgrad bleibt unter 1 und Pumpenmoment sinkt mit steigendem Drehzahlverhältnis', () => {
    let last = Infinity;
    for (let sr = 0; sr < 1; sr += 0.05) {
      const s = converterState(200, 200 * sr);
      expect(s.efficiency).toBeLessThanOrEqual(1);
      expect(s.pumpTorque).toBeLessThanOrEqual(last + 1e-9);
      last = s.pumpTorque;
    }
  });
  it('Gleiche Drehzahl ⇒ kein Moment (ohne Schlupf keine Kraftübertragung durch das Öl)', () => {
    const s = converterState(150, 150);
    expect(Math.abs(s.turbineTorque)).toBeLessThan(1e-9);
  });
  it('Schubbetrieb: Turbine schneller als Pumpe ⇒ Moment fließt zurück (negativ)', () => {
    const s = converterState(100, 140);
    expect(s.turbineTorque).toBeLessThan(0);
    expect(s.regime).toBe('Schubbetrieb');
  });
  it('Prüfstand: Schlupf so gewählt, dass das Pumpenmoment dem Motormoment entspricht', () => {
    const wp = toRad(2500);
    const r = solveSlipForTorque(wp, 150);
    expect(r.limited).toBe(false);
    expect(converterState(wp, r.sr * wp).pumpTorque).toBeCloseTo(150, 6);
    expect(solveSlipForTorque(toRad(1000), 400).limited).toBe(true);
  });
});

describe('Schaltkennfeld (TCU)', () => {
  it('Rückschaltlinien liegen unter den Hochschaltlinien (Hysterese)', () => {
    for (let th = 0; th <= 1.0001; th += 0.05) {
      expect(downshiftSpeed(2, th)).toBeLessThan(upshiftSpeed(1, th));
      expect(downshiftSpeed(3, th)).toBeLessThan(upshiftSpeed(2, th));
      expect(downshiftSpeed(4, th)).toBeLessThan(upshiftSpeed(3, th));
    }
  });
  it('Hochschaltlinien steigen mit dem Lastgrad', () => {
    for (const g of [1, 2, 3] as const) {
      const line = SHIFT_MAP.up[g];
      for (let i = 1; i < line.length; i++) expect(line[i][1]).toBeGreaterThan(line[i - 1][1]);
    }
  });
  it('Hochschaltung bei Vollgas erfolgt unterhalb der Abregeldrehzahl', () => {
    // n_Motor = v / r · i_Achse · i_Gang
    for (const g of [1, 2, 3] as const) {
      const v = upshiftSpeed(g, 1) / 3.6;
      const rpm = ((v / 0.32) * 3.7 * GEAR_RATIOS[String(g) as '1'] * 60) / (2 * Math.PI);
      expect(rpm).toBeLessThan(6200);
    }
  });
  it('Gang wird zwischen den Linien gehalten, Manuelle Begrenzung wirkt', () => {
    expect(decideGear(2, 30, 0.3).target).toBe(2);
    expect(decideGear(2, 80, 0.3).target).toBe(3);
    expect(decideGear(3, 80, 0.3, 2).target).toBe(2);
  });
});

describe('Schaltablauf', () => {
  it('1→2 ist eine Freilaufschaltung: nur B1 wird zugeschaltet', () => {
    const p = planShift('1', '2');
    expect(p.oncoming).toEqual(['B1']);
    expect(p.offgoing).toEqual(['F1']);
    expect(p.freewheel).toBe(true);
    expect(p.kind).toBe('hoch');
  });
  it('2→3: B1 löst, K2 schließt (Überschneidungsschaltung)', () => {
    const p = planShift('2', '3');
    expect(p.oncoming).toEqual(['K2']);
    expect(p.offgoing).toEqual(['B1']);
    expect(p.kept.sort()).toEqual(['K1', 'K3']);
  });
  it('3→4: K3 löst, B3 schließt; Hochschaltung mit Momentenphase vor Drehzahlphase', () => {
    const p = planShift('3', '4');
    expect(p.oncoming).toEqual(['B3']);
    expect(p.offgoing).toEqual(['K3']);
    expect(p.phases.map((x) => x.phase)).toEqual(['fill', 'torque', 'inertia', 'finish']);
    expect(planShift('4', '3').phases.map((x) => x.phase)).toEqual(['fill', 'inertia', 'torque', 'finish']);
  });
  it('Phasen laufen in der richtigen Reihenfolge ab, Überblendungen monoton', () => {
    const sp = new ShiftProcess(planShift('2', '3'));
    let lastT = 0;
    let lastS = 0;
    const total = Object.values(PHASE_DURATION).reduce((a, b) => a + b, 0);
    for (let t = 0; t < total + 0.1; t += 0.01) {
      sp.advance(0.01);
      expect(sp.torqueBlend).toBeGreaterThanOrEqual(lastT - 1e-12);
      expect(sp.speedBlend).toBeGreaterThanOrEqual(lastS - 1e-12);
      // Momentenübergabe ist abgeschlossen, bevor sich die Drehzahl ändert (Hochschaltung)
      if (sp.speedBlend > 0) expect(sp.torqueBlend).toBe(1);
      lastT = sp.torqueBlend;
      lastS = sp.speedBlend;
    }
    expect(sp.done).toBe(true);
  });
  it('Schrittmodus hält am Phasenende an und läuft erst nach Freigabe weiter', () => {
    const sp = new ShiftProcess(planShift('3', '4'), true);
    sp.advance(5);
    expect(sp.waiting).toBe(true);
    expect(sp.phase).toBe('fill');
    sp.continue();
    expect(sp.phase).toBe('torque');
  });
});

describe('Gesamtsimulation', () => {
  it('D + Bremse: Motor läuft im Leerlauf, Turbine steht, Fahrzeug steht (Wandlerschlupf 100 %)', () => {
    const sim = new TransmissionSim();
    sim.setInputs({ selector: 'D', brake: 1 });
    for (let i = 0; i < 80; i++) sim.step(0.05);
    const s = sim.snapshot();
    expect(s.gear).toBe('1');
    expect(s.vehicleKmh).toBe(0);
    expect(s.turbineRpm).toBeLessThan(1);
    expect(s.engineRpm).toBeGreaterThan(600);
    expect(s.engineRpm).toBeLessThan(900);
    expect(s.converter.slip).toBeCloseTo(1, 3);
    expect(s.outputTorque).toBeGreaterThan(0); // Kriechmoment wird von der Bremse gehalten
  });

  it('Beschleunigen schaltet 1→2→3→4, Übersetzung im eingelegten Gang konsistent', () => {
    const sim = new TransmissionSim();
    sim.setInputs({ selector: 'D', throttle: 0.6 });
    const seen: string[] = [];
    for (let i = 0; i < 900; i++) {
      sim.step(0.05);
      const s = sim.snapshot();
      if (seen[seen.length - 1] !== s.gear) seen.push(s.gear);
      if (!s.shift && ['1', '2', '3', '4'].includes(s.gear) && s.outputRpm > 50 && !s.overrun) {
        expect(s.turbineRpm / s.outputRpm).toBeCloseTo(GEAR_RATIOS[s.gear], 6);
      }
    }
    expect(seen).toEqual(['P', '1', '2', '3', '4']);
  });

  it('Wandlerüberbrückung schließt bei konstanter Fahrt im 4. Gang (kein Schlupf mehr)', () => {
    const sim = new TransmissionSim();
    sim.setInputs({ selector: 'D', throttle: 0.6 });
    for (let i = 0; i < 700; i++) sim.step(0.05);
    sim.setInputs({ throttle: 0.25 });
    for (let i = 0; i < 200; i++) sim.step(0.05);
    const s = sim.snapshot();
    expect(s.gear).toBe('4');
    expect(s.converter.lockup).toBe('geschlossen');
    expect(Math.abs(s.engineRpm - s.turbineRpm)).toBeLessThan(1);
  });

  it('Rückwärtsgang: Fahrzeug fährt rückwärts, Ausgangswelle dreht negativ', () => {
    const sim = new TransmissionSim();
    sim.setInputs({ selector: 'R', throttle: 0.2 });
    for (let i = 0; i < 100; i++) sim.step(0.05);
    const s = sim.snapshot();
    expect(s.gear).toBe('R');
    expect(s.vehicleKmh).toBeLessThan(-1);
    expect(s.outputRpm).toBeLessThan(0);
    expect(s.elements.B2.state).toBe('geschlossen');
  });

  it('Parksperre lässt sich bei Fahrt nicht einlegen', () => {
    const sim = new TransmissionSim();
    sim.setInputs({ selector: 'D', throttle: 0.5 });
    for (let i = 0; i < 100; i++) sim.step(0.05);
    sim.setInputs({ selector: 'P' });
    expect(sim.inputs.selector).toBe('D');
  });

  it('Prüfstand: Ausgangsdrehzahl = Eingangsdrehzahl / i (Wandler überbrückt)', () => {
    const sim = new TransmissionSim({ mode: 'bench' });
    for (const g of ['1', '2', '3', '4', 'R'] as const) {
      sim.setInputs({ benchGear: g, benchRpm: 3000, benchLockup: true, benchTorque: 120 });
      for (let i = 0; i < 80; i++) sim.step(0.05);
      const s = sim.snapshot();
      expect(s.gear).toBe(g);
      expect(s.outputRpm).toBeCloseTo(3000 / GEAR_RATIOS[g], 3);
      expect(s.outputTorque).toBeCloseTo(120 * GEAR_RATIOS[g], 3);
    }
  });

  it('Freilauf F1 überholt im 2. Gang, Overdrive-Sonne steht im 4. Gang', () => {
    const sim = new TransmissionSim({ mode: 'bench' });
    sim.setInputs({ benchGear: '2', benchRpm: 2000, benchLockup: true });
    for (let i = 0; i < 60; i++) sim.step(0.05);
    expect(sim.snapshot().elements.F1.state).toBe('überholt');
    sim.setInputs({ benchGear: '4' });
    for (let i = 0; i < 60; i++) sim.step(0.05);
    const s = sim.snapshot();
    expect(Math.abs(s.members.SO.rpm)).toBeLessThan(1e-6);
    expect(s.elements.B3.state).toBe('geschlossen');
  });
});
