/**
 * Gesamtsimulation: Motor → Drehmomentwandler (mit Überbrückungskupplung) →
 * Planetengetriebe → Ausgangswelle → Fahrzeug, inklusive Getriebesteuerung.
 *
 * Zwei Betriebsarten:
 *  - "Fahrbetrieb": Gaspedal, Bremse, Wählhebel P/R/N/D (+ Gang halten), Fahrzeugdynamik,
 *    automatische Gangwahl nach Schaltkennfeld.
 *  - "Prüfstand": Motordrehzahl und Eingangsmoment werden direkt vorgegeben, Gang frei wählbar.
 *    Die Ausgangsdrehzahl folgt rein kinematisch aus Turbinendrehzahl und Übersetzung.
 */
import { converterState, solveSlipForTorque, statorSpeedVisual, type ConverterState } from './converter';
import {
  ENGINE,
  VEHICLE,
  drivingResistance,
  engineTorque,
  kmh,
  outputSpeedFromVehicle,
  toRad,
  toRpm,
  vehicleFromOutputSpeed,
} from './engine';
import { SOLENOID_PATTERN, emptyElements, linePressure, type HydraulicState, type Selector } from './hydraulics';
import { GEAR_RATIOS, analyzeTorques, blendTorque, solveSpeeds, type SpeedSolution, type TorqueAnalysis } from './kinematics';
import { ShiftProcess, planShift, type ElementPhaseState, type ShiftPhase } from './shift';
import { decideGear, decideLockup } from './tcu';
import {
  ELEMENTS,
  ELEMENT_IDS,
  GEARS,
  MEMBER_IDS,
  gearForNumber,
  gearNumber,
  isDriveGear,
  type ElementId,
  type GearId,
  type MemberId,
  type Role,
  type RoleKey,
} from './topology';

export type SimMode = 'drive' | 'bench';

/** Darstellungsmaßstab der Drehbewegung: reale Drehzahl × VISUAL_SPEED_SCALE */
export const VISUAL_SPEED_SCALE = 1 / 60;

/** Maximales Moment der Wandlerüberbrückungskupplung [Nm] */
const LOCKUP_CAPACITY = 520;

export interface SimInputs {
  mode: SimMode;
  selector: Selector;
  /** 0 = automatisch, 1…4 = Gang halten (manuelle Gasse) */
  holdGear: number;
  throttle: number;
  brake: number;
  benchGear: GearId;
  benchRpm: number;
  benchTorque: number;
  benchLockup: boolean;
  /** Wandlerüberbrückung im Fahrbetrieb erlauben */
  lockupAllowed: boolean;
  shiftStepMode: boolean;
}

export type ElementDisplayState = ElementPhaseState | 'sperrt' | 'überholt' | 'frei' | 'gesperrt';

export interface ElementSnapshot {
  id: ElementId;
  state: ElementDisplayState;
  /** übertragenes bzw. abgestütztes Moment [Nm] */
  torque: number;
  /** Differenzdrehzahl [1/min] */
  slip: number;
  pressure: number;
  stroke: number;
}

export interface ShiftSnapshot {
  from: GearId;
  to: GearId;
  kind: string;
  phase: ShiftPhase;
  phaseIndex: number;
  phases: ShiftPhase[];
  phaseProgress: number;
  progress: number;
  waiting: boolean;
  oncoming: ElementId[];
  offgoing: ElementId[];
  kept: ElementId[];
  freewheel: boolean;
}

export interface SimSnapshot {
  time: number;
  mode: SimMode;
  selector: Selector;
  gear: GearId;
  /** Gang, dessen Kraftfluss gerade dargestellt wird */
  flowGear: GearId;
  targetGear: GearId;
  engineRpm: number;
  turbineRpm: number;
  outputRpm: number;
  vehicleKmh: number;
  /** effektive Übersetzung n_Turbine / n_Ausgang (NaN wenn entkoppelt) */
  ratio: number;
  gearRatio: number;
  engineTorque: number;
  turbineTorque: number;
  outputTorque: number;
  wheelTorque: number;
  throttle: number;
  brake: number;
  converter: ConverterState & { lockup: 'offen' | 'schlupft' | 'geschlossen'; lockupLevel: number };
  statorRpm: number;
  members: Record<MemberId, { rpm: number; load: number }>;
  planets: Record<'PF' | 'PR' | 'PO', { abs: number; rel: number; force: number }>;
  roles: Record<RoleKey, Role>;
  elements: Record<ElementId, ElementSnapshot>;
  shift: ShiftSnapshot | null;
  hydraulics: HydraulicState;
  overrun: boolean;
  coast: boolean;
  tcuReason: string;
  messages: { t: number; text: string }[];
  benchLimited: boolean;
  parkLock: boolean;
}

const DEFAULT_INPUTS: SimInputs = {
  mode: 'drive',
  selector: 'P',
  holdGear: 0,
  throttle: 0,
  brake: 0,
  benchGear: '1',
  benchRpm: 1500,
  benchTorque: 150,
  benchLockup: false,
  lockupAllowed: true,
  shiftStepMode: false,
};

type Link = { kind: 'rigid'; gear: GearId } | { kind: 'free'; gear: GearId } | { kind: 'prescribed' };

export class TransmissionSim {
  inputs: SimInputs = { ...DEFAULT_INPUTS };

  time = 0;
  we = toRad(ENGINE.idleRpm);
  wt = toRad(ENGINE.idleRpm) * 0.97;
  v = 0;
  gear: GearId = 'P';
  shift: ShiftProcess | null = null;
  overrun = false;
  lockCmd = false;
  lockLevel = 0;
  locked = false;
  idleI = 0.05;
  tcuReason = '';
  messages: { t: number; text: string }[] = [];
  benchLimited = false;

  // Zwischenwerte des letzten Rechenschritts
  private convState: ConverterState = converterState(this.we, this.wt);
  private engTorque = 0;
  private turbTorqueTotal = 0;
  private outTorque = 0;
  private wOut = 0;

  /** Darstellungswinkel [rad] */
  angles: Record<string, number> = {};
  speeds: SpeedSolution = solveSpeeds({ engaged: GEARS.P.elements, fixed: { IN: 0, OUT: 0 }, parkLock: true });
  statorSpeed = 0;

  constructor(inputs?: Partial<SimInputs>) {
    if (inputs) Object.assign(this.inputs, inputs);
    this.reset(inputs);
  }

  reset(inputs?: Partial<SimInputs>) {
    const keepMode = this.inputs.mode;
    this.inputs = { ...DEFAULT_INPUTS, mode: keepMode, ...(inputs ?? {}) };
    this.time = 0;
    this.we = toRad(ENGINE.idleRpm);
    this.wt = this.we * 0.97;
    this.v = 0;
    this.gear = this.inputs.mode === 'bench' ? this.inputs.benchGear : this.selectorGear();
    this.shift = null;
    this.overrun = false;
    this.lockCmd = false;
    this.lockLevel = 0;
    this.locked = false;
    this.idleI = 0.05;
    this.messages = [];
    this.tcuReason = '';
    this.angles = {};
    for (const m of [...MEMBER_IDS, 'ENG', 'STATOR', 'PF_P', 'PR_P', 'PO_P']) this.angles[m] = 0;
    if (this.inputs.mode === 'bench') {
      this.we = toRad(this.inputs.benchRpm);
      this.wt = this.we;
    }
    this.updateKinematics(0);
  }

  log(text: string) {
    this.messages.unshift({ t: this.time, text });
    if (this.messages.length > 30) this.messages.length = 30;
  }

  setInputs(p: Partial<SimInputs>) {
    const prev = this.inputs;
    if (p.mode && p.mode !== prev.mode) {
      this.inputs = { ...prev, ...p };
      this.reset({ ...this.inputs });
      return;
    }
    if (p.selector && p.selector !== prev.selector) {
      const speed = kmh(this.v);
      if (p.selector === 'P' && Math.abs(speed) > 3) {
        this.log('Parksperre verweigert: nur im Stillstand (< 3 km/h) einlegbar.');
        p = { ...p, selector: prev.selector };
      } else if (p.selector === 'R' && speed > 6) {
        this.log('Rückwärtsgang gesperrt: Fahrzeug rollt vorwärts (> 6 km/h).');
        p = { ...p, selector: prev.selector };
      } else if (p.selector === 'D' && speed < -6) {
        this.log('D gesperrt: Fahrzeug rollt rückwärts.');
        p = { ...p, selector: prev.selector };
      }
    }
    this.inputs = { ...prev, ...p };
    if (this.shift) this.shift.stepMode = this.inputs.shiftStepMode;
  }

  /** Im Schrittmodus nächste Schaltphase freigeben */
  continueShift() {
    this.shift?.continue();
  }

  private selectorGear(): GearId {
    switch (this.inputs.selector) {
      case 'P':
        return 'P';
      case 'R':
        return 'R';
      case 'N':
        return 'N';
      default:
        return '1';
    }
  }

  /** Sollgang aus Wählhebel und TCU */
  private desiredGear(): GearId {
    if (this.inputs.mode === 'bench') return this.inputs.benchGear;
    const sel = this.inputs.selector;
    if (sel !== 'D') return this.selectorGear();
    const hold = this.inputs.holdGear;
    const cur = gearNumber(this.gear);
    if (cur === 0) {
      // aus N/P/R kommend: im passenden Gang anfahren
      if (hold > 0) return gearForNumber(hold, hold === 1);
      return '1';
    }
    const maxGear = hold > 0 ? hold : 4;
    const minGear = hold > 0 ? hold : 1;
    const dec = decideGear(cur, kmh(this.v), this.inputs.throttle, maxGear, minGear);
    let target = dec.target;
    // Überdrehschutz bei manueller Rückschaltung
    if (target < cur) {
      const rpmAfter = toRpm(Math.abs(this.wOut) * GEAR_RATIOS[gearForNumber(target)]);
      if (rpmAfter > ENGINE.maxRpm - 200) {
        target = cur;
        this.tcuReason = `Rückschaltung ${cur}→${cur - 1} verzögert: Motor würde überdrehen (${rpmAfter.toFixed(0)} 1/min).`;
        return this.withEngineBrake(gearForNumber(cur), hold);
      }
    }
    this.tcuReason = dec.reason;
    return this.withEngineBrake(gearForNumber(target), hold);
  }

  private withEngineBrake(g: GearId, hold: number): GearId {
    if (g === '1' && hold === 1) return '1M';
    if (g === '1M' && hold !== 1) return '1';
    return g;
  }

  // -------------------------------------------------------------------------
  // Zeitschritt
  // -------------------------------------------------------------------------

  step(dt: number) {
    if (dt <= 0) return;
    const h = 0.002;
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-9) {
      const d = Math.min(h, remaining);
      this.substep(d);
      remaining -= d;
    }
    this.updateKinematics(dt);
  }

  private currentLink(): Link {
    const s = this.shift;
    const drivable = (g: GearId) => isDriveGear(g) || g === 'R';
    if (s) {
      if (s.hasPhase('inertia')) {
        if (s.phase === 'inertia' && !s.done) return { kind: 'prescribed' };
        const g = s.speedBlend >= 1 ? s.plan.to : s.plan.from;
        if (!drivable(g)) return { kind: 'free', gear: g };
        if (g === '1' && this.overrun) return { kind: 'free', gear: g };
        return { kind: 'rigid', gear: g };
      }
      const g = s.torqueBlend >= 1 ? s.plan.to : s.plan.from;
      if (!drivable(g)) return { kind: 'free', gear: g };
      if (g === '1' && this.overrun) return { kind: 'free', gear: g };
      return { kind: 'rigid', gear: g };
    }
    if (!drivable(this.gear)) return { kind: 'free', gear: this.gear };
    if (this.gear === '1' && this.overrun) return { kind: 'free', gear: this.gear };
    return { kind: 'rigid', gear: this.gear };
  }

  /** wirksame Übersetzung für das Abtriebsmoment (überblendet in der Momentenphase) */
  private effectiveTorqueRatio(): number {
    const s = this.shift;
    const r = (g: GearId) => (isDriveGear(g) || g === 'R' ? GEAR_RATIOS[g] : 0);
    if (!s) {
      if (this.gear === '1' && this.overrun) return 0;
      return r(this.gear);
    }
    const a = this.overrun && s.plan.from === '1' ? 0 : r(s.plan.from);
    const b = r(s.plan.to);
    return a + (b - a) * s.torqueBlend;
  }

  private manageShift() {
    // laufende Schaltung fortschreiben
    if (this.shift && this.shift.done) {
      this.gear = this.shift.plan.to;
      this.log(`Schaltung ${GEARS[this.shift.plan.from].label} → ${GEARS[this.shift.plan.to].label} abgeschlossen.`);
      this.shift = null;
      if (this.gear !== '1') this.overrun = false;
    }
    if (this.shift) return;
    const desired = this.desiredGear();
    if (desired === this.gear) return;
    // Im Fahrbetrieb wird sequentiell geschaltet (immer nur ein Gang)
    let next = desired;
    if (this.inputs.mode === 'drive' && isDriveGear(this.gear) && isDriveGear(desired)) {
      const a = gearNumber(this.gear);
      const b = gearNumber(desired);
      if (Math.abs(b - a) > 1) next = gearForNumber(a + Math.sign(b - a));
      if (a === b) next = desired; // 1 ↔ 1M
    }
    const plan = planShift(this.gear, next);
    this.shift = new ShiftProcess(plan, this.inputs.shiftStepMode);
    if (this.lockCmd) {
      this.lockCmd = false;
      this.locked = false;
    }
    const kindText: Record<string, string> = {
      hoch: 'Hochschaltung',
      runter: 'Rückschaltung',
      einlegen: 'Fahrstufe einlegen',
      auslegen: 'Fahrstufe auslegen',
      wechsel: 'Wechsel',
    };
    const on = plan.oncoming.length ? `zuschalten: ${plan.oncoming.join(', ')}` : '';
    const off = plan.offgoing.length ? `abschalten: ${plan.offgoing.join(', ')}` : '';
    this.log(`${kindText[plan.kind]} ${GEARS[plan.from].label} → ${GEARS[plan.to].label} (${[on, off].filter(Boolean).join('; ')})`);
  }

  private substep(h: number) {
    this.time += h;
    this.manageShift();
    if (this.shift) {
      const wasInertia = this.shift.phase === 'inertia';
      this.shift.advance(h);
      if (!wasInertia && this.shift.phase === 'inertia' && this.shift.inertiaStartSpeed === null) this.shift.inertiaStartSpeed = this.wt;
    }
    if (this.inputs.mode === 'bench') this.substepBench(h);
    else this.substepDrive(h);
  }

  private substepBench(h: number) {
    const inp = this.inputs;
    // Motordrehzahl folgt dem Sollwert mit begrenztem Gradienten
    const target = toRad(inp.benchRpm);
    const maxRate = toRad(4000) * h;
    this.we += Math.max(-maxRate, Math.min(maxRate, target - this.we));
    const link = this.currentLink();
    const T = inp.benchTorque;
    this.engTorque = T;
    this.lockLevel = inp.benchLockup ? 1 : 0;
    this.locked = inp.benchLockup;
    const coupled = link.kind !== 'free';
    if (!coupled) {
      // Turbine ohne Last: dreht nahezu mit Pumpendrehzahl, kein Moment
      this.wt = this.we * 0.995;
      this.convState = converterState(this.we, this.wt);
      this.turbTorqueTotal = 0;
      this.benchLimited = false;
      this.wOut = 0;
      this.outTorque = 0;
    } else {
      if (inp.benchLockup) {
        this.wt = this.we;
        this.convState = { ...converterState(this.we, this.we * 0.9999), turbineTorque: T, pumpTorque: T, tr: 1, efficiency: 1, slip: 0, sr: 1, regime: 'Überbrückt' };
        this.turbTorqueTotal = T;
        this.benchLimited = false;
      } else {
        const r = solveSlipForTorque(this.we, T);
        this.benchLimited = r.limited;
        this.wt = r.sr * this.we;
        this.convState = converterState(this.we, this.wt);
        this.turbTorqueTotal = this.convState.turbineTorque;
      }
      const iTo = GEAR_RATIOS[this.shift ? this.shift.plan.to : this.gear];
      if (link.kind === 'rigid') {
        this.wOut = this.wt / GEAR_RATIOS[link.gear];
      } else {
        const s = this.shift!;
        const iFrom = GEAR_RATIOS[s.plan.from];
        const fromOut = Number.isFinite(iFrom) ? this.wt / iFrom : 0;
        const toOut = Number.isFinite(iTo) ? this.wt / iTo : 0;
        this.wOut = fromOut + (toOut - fromOut) * s.speedBlend;
      }
      this.outTorque = this.turbTorqueTotal * this.effectiveTorqueRatio();
    }
    if (this.gear === 'P' && !this.shift) this.wOut = 0;
    this.v = vehicleFromOutputSpeed(this.wOut);
  }

  private substepDrive(h: number) {
    const inp = this.inputs;
    const rpm = toRpm(this.we);
    // Leerlaufregler (PI) des Motorsteuergeräts
    const err = ENGINE.idleRpm - rpm;
    this.idleI = Math.min(0.3, Math.max(0, this.idleI + err * h * 0.0006));
    const idleThrottle = Math.min(0.45, Math.max(0, 0.04 + 0.0015 * err + this.idleI));
    let throttle = Math.max(inp.throttle, idleThrottle);
    if (rpm > ENGINE.limiterRpm) throttle = 0;
    const Te = engineTorque(rpm, throttle);
    this.engTorque = Te;

    // Wandlerüberbrückung ansteuern
    const gNum = gearNumber(this.gear);
    const cmd = inp.lockupAllowed && decideLockup(gNum, kmh(this.v), inp.throttle, this.lockCmd, !!this.shift);
    if (cmd !== this.lockCmd) {
      this.lockCmd = cmd;
      this.log(cmd ? 'TCU: Wandlerüberbrückungskupplung wird geschlossen.' : 'TCU: Wandlerüberbrückungskupplung wird geöffnet.');
    }
    if (this.lockCmd) this.lockLevel = Math.min(1, this.lockLevel + h / 0.9);
    else this.lockLevel = Math.max(0, this.lockLevel - h / 0.25);
    if (!this.lockCmd) this.locked = false;

    const link = this.currentLink();
    this.wOut = outputSpeedFromVehicle(this.v);
    const { mass, wheelRadius: r, finalDrive: iAx, maxBrakeForce, turbineInertia: Jt } = VEHICLE;
    const Je = ENGINE.inertia;
    const iEff = this.effectiveTorqueRatio();

    if (link.kind === 'rigid' && this.locked) {
      // Motor direkt mit dem Radsatz verbunden
      const ratio = GEAR_RATIOS[link.gear];
      const k = (ratio * iAx) / r;
      this.convState = { ...converterState(this.we, this.we), regime: 'Überbrückt', turbineTorque: Te, pumpTorque: Te, tr: 1, sr: 1, slip: 0, efficiency: 1 };
      this.turbTorqueTotal = Te;
      this.outTorque = Te * ratio;
      const mEff = mass + (Je + Jt) * k * k;
      this.v = this.integrateVehicle(this.v, (Te * ratio * iAx) / r, mEff, h, maxBrakeForce);
      this.wOut = outputSpeedFromVehicle(this.v);
      this.wt = ratio * this.wOut;
      this.we = this.wt;
      return;
    }

    const conv = converterState(this.we, this.wt);
    const slip = this.we - this.wt;
    const Tlu = this.lockLevel > 0 ? this.lockLevel * LOCKUP_CAPACITY * Math.tanh(slip / 4) : 0;
    const Tp = conv.pumpTorque + Tlu;
    const Tt = conv.turbineTorque + Tlu;
    this.convState = conv;
    this.turbTorqueTotal = Tt;
    this.we = Math.max(0, this.we + ((Te - Tp) / Je) * h);

    if (link.kind === 'rigid') {
      const ratio = GEAR_RATIOS[link.gear];
      // Freilauf F1 überholt im Schub (keine Motorbremse im 1. Gang in D)
      if (link.gear === '1' && !this.shift && Tt < -0.5) {
        this.overrun = true;
        this.log('Freilauf F1 überholt (Schubbetrieb im 1. Gang – keine Motorbremse).');
      }
      const k = (ratio * iAx) / r;
      const mEff = mass + Jt * k * k;
      this.outTorque = Tt * iEff;
      this.v = this.integrateVehicle(this.v, (this.outTorque * iAx) / r, mEff, h, maxBrakeForce);
      this.wOut = outputSpeedFromVehicle(this.v);
      this.wt = ratio * this.wOut;
    } else if (link.kind === 'prescribed') {
      const s = this.shift!;
      const iTo = GEAR_RATIOS[s.plan.to];
      const target = Number.isFinite(iTo) ? iTo * this.wOut : this.wt;
      const start = s.inertiaStartSpeed ?? this.wt;
      this.outTorque = Tt * iEff;
      this.v = this.integrateVehicle(this.v, (this.outTorque * iAx) / r, mass, h, maxBrakeForce);
      this.wOut = outputSpeedFromVehicle(this.v);
      this.wt = start + (target - start) * s.speedBlend;
    } else {
      // entkoppelt: Turbine läuft frei, Fahrzeug rollt ohne Antriebsmoment
      this.outTorque = 0;
      const drag = 1.5 * Math.tanh(this.wt / 5);
      this.wt = this.wt + ((Tt - drag) / Jt) * h;
      if (link.gear === 'P') {
        if (Math.abs(this.v) < 0.9) this.v = 0;
        else this.v = this.integrateVehicle(this.v, 0, mass, h, maxBrakeForce);
      } else this.v = this.integrateVehicle(this.v, 0, mass, h, maxBrakeForce);
      this.wOut = outputSpeedFromVehicle(this.v);
      if (link.gear === '1' && this.overrun) {
        const sync = GEAR_RATIOS['1'] * this.wOut;
        if (this.wt >= sync) {
          this.overrun = false;
          this.wt = sync;
          this.log('Freilauf F1 sperrt wieder – Zugbetrieb.');
        }
      }
    }
    // Überbrückung haftet, sobald die Differenzdrehzahl klein genug ist
    if (this.lockCmd && this.lockLevel >= 0.98 && Math.abs(this.we - this.wt) < 4 && link.kind === 'rigid') {
      this.locked = true;
      this.we = this.wt;
    }
  }

  private integrateVehicle(v: number, driveForce: number, mEff: number, h: number, maxBrake: number): number {
    const Fres = drivingResistance(v);
    const Fbrake = this.inputs.brake * maxBrake;
    const Fnet = driveForce - Fres;
    if (Math.abs(v) < 0.05) {
      if (Math.abs(Fnet) <= Fbrake + 60) return 0; // Haftreibung der Bremse / Rollwiderstand
      const F = Fnet - Math.sign(Fnet) * Fbrake;
      return v + (F / mEff) * h;
    }
    const F = Fnet - Math.sign(v) * Fbrake;
    const nv = v + (F / mEff) * h;
    // Bremse kehrt die Fahrtrichtung nicht um
    if (Fbrake > 0 && Math.sign(nv) !== Math.sign(v) && Math.abs(driveForce) < Fbrake) return 0;
    return nv;
  }

  // -------------------------------------------------------------------------
  // Kinematik für Darstellung
  // -------------------------------------------------------------------------

  private kinematicElements(): { engaged: ElementId[]; fixOut: boolean } {
    const link = this.currentLink();
    if (link.kind === 'prescribed') return { engaged: this.shift!.plan.kept, fixOut: true };
    const els = GEARS[link.gear].elements;
    if (link.kind === 'free') return { engaged: els.filter((e) => e !== 'F1'), fixOut: true };
    return { engaged: els, fixOut: false };
  }

  updateKinematics(dt: number) {
    const { engaged, fixOut } = this.kinematicElements();
    const fixed: Partial<Record<MemberId, number>> = { IN: this.wt };
    if (fixOut) fixed.OUT = this.wOut;
    const parkLock = this.gear === 'P' && !this.shift;
    if (parkLock) delete fixed.OUT;
    let sol = solveSpeeds({ engaged, fixed, parkLock });
    if (sol.inconsistent) sol = solveSpeeds({ engaged: engaged.filter((e) => e !== 'F1'), fixed: { IN: this.wt, OUT: this.wOut } });
    this.speeds = sol;
    const conv = this.convState;
    this.statorSpeed = this.locked ? this.we : statorSpeedVisual(this.we, this.wt, conv.statorLocked);
    if (dt > 0) {
      const k = VISUAL_SPEED_SCALE * dt;
      for (const m of MEMBER_IDS) this.angles[m] = wrap(this.angles[m] + sol.speeds[m] * k);
      this.angles.ENG = wrap(this.angles.ENG + this.we * k);
      this.angles.STATOR = wrap(this.angles.STATOR + this.statorSpeed * k);
    }
  }

  // -------------------------------------------------------------------------
  // Momente, Rollen, Hydraulik → Snapshot
  // -------------------------------------------------------------------------

  private torqueAnalysis(): TorqueAnalysis {
    const Tin = this.turbTorqueTotal;
    const s = this.shift;
    const analyze = (g: GearId) => (g === '1' && this.overrun ? analyzeTorques('N', 0) : analyzeTorques(g, Tin));
    if (!s) return analyze(this.gear);
    return blendTorque(analyze(s.plan.from), analyze(s.plan.to), s.torqueBlend);
  }

  flowGear(): GearId {
    const s = this.shift;
    if (!s) return this.gear === '1' && this.overrun ? 'N' : this.gear;
    const g = s.torqueBlend < 0.5 ? s.plan.from : s.plan.to;
    return g === '1' && this.overrun ? 'N' : g;
  }

  private hydraulics(): HydraulicState {
    const inp = this.inputs;
    const rpm = toRpm(this.we);
    const throttleForPressure = inp.mode === 'bench' ? Math.min(1, inp.benchTorque / 300) : inp.throttle;
    const pl = linePressure(rpm, throttleForPressure, this.gear === 'R' || this.shift?.plan.to === 'R');
    const elements = emptyElements();
    const s = this.shift;
    for (const e of ELEMENT_IDS) {
      if (e === 'F1') continue; // mechanisch, keine Hydraulik
      let frac = 0;
      let stroke = 0;
      if (s) {
        if (s.plan.kept.includes(e)) {
          frac = 1;
          stroke = 1;
        } else if (s.plan.oncoming.includes(e)) {
          frac = s.oncomingPressure;
          stroke = s.oncomingStroke;
        } else if (s.plan.offgoing.includes(e)) {
          frac = s.offgoingPressure;
          stroke = frac > 0.05 ? 1 : Math.max(0, frac * 10);
        }
      } else if (GEARS[this.gear].elements.includes(e)) {
        frac = 1;
        stroke = 1;
      }
      elements[e] = { pressure: frac * pl, stroke };
    }
    elements.WK = { pressure: this.lockLevel * pl * 0.8, stroke: this.lockLevel };
    const gNum = gearNumber(s ? (s.torqueBlend < 0.5 ? s.plan.from : s.plan.to) : this.gear) || 1;
    const pat = SOLENOID_PATTERN[gNum];
    return {
      linePressure: pl,
      elements,
      solenoids: { MV1: pat.MV1, MV2: pat.MV2, MVWK: this.lockLevel, DR: Math.min(1, pl / 20) },
      manualValve: inp.mode === 'bench' ? benchSelector(this.gear) : inp.selector,
    };
  }

  snapshot(): SimSnapshot {
    const ta = this.torqueAnalysis();
    const hyd = this.hydraulics();
    const sp = this.speeds.speeds;
    const s = this.shift;
    const elements = {} as Record<ElementId, ElementSnapshot>;
    for (const e of ELEMENT_IDS) {
      const spec = ELEMENTS[e];
      const slipRad = spec.b ? sp[spec.a] - sp[spec.b] : sp[spec.a];
      let state: ElementDisplayState;
      if (e === 'F1') {
        const engagedNow = s ? s.rigidElements().includes('F1') : GEARS[this.gear].elements.includes('F1');
        if (engagedNow && !this.overrun && Math.abs(sp.CR) < 1e-6) state = 'sperrt';
        else if (this.gear === '1M' && Math.abs(sp.CR) < 1e-6) state = 'gesperrt';
        else if (sp.CR > 1e-6) state = 'überholt';
        else state = 'frei';
      } else if (s && (s.plan.kept.includes(e) || s.plan.oncoming.includes(e) || s.plan.offgoing.includes(e))) {
        state = s.elementState(e);
      } else state = GEARS[this.gear].elements.includes(e) ? 'geschlossen' : 'offen';
      elements[e] = {
        id: e,
        state,
        torque: ta.elements[e] ?? 0,
        slip: toRpm(slipRad),
        pressure: hyd.elements[e].pressure,
        stroke: hyd.elements[e].stroke,
      };
    }
    const members = {} as SimSnapshot['members'];
    for (const m of MEMBER_IDS) members[m] = { rpm: toRpm(sp[m]), load: ta.memberLoad[m] };
    const pl = this.speeds.planets;
    const planets = {
      PF: { abs: toRpm(pl.PF.abs), rel: toRpm(pl.PF.rel), force: ta.setForce.PF },
      PR: { abs: toRpm(pl.PR.abs), rel: toRpm(pl.PR.rel), force: ta.setForce.PR },
      PO: { abs: toRpm(pl.PO.abs), rel: toRpm(pl.PO.rel), force: ta.setForce.PO },
    };
    const fg = this.flowGear();
    const lockState: 'offen' | 'schlupft' | 'geschlossen' = this.locked ? 'geschlossen' : this.lockLevel > 0.02 ? 'schlupft' : 'offen';
    const ratio = Math.abs(this.wOut) > 1e-3 && fg !== 'N' && fg !== 'P' ? this.wt / this.wOut : NaN;
    const shiftSnap: ShiftSnapshot | null = s
      ? {
          from: s.plan.from,
          to: s.plan.to,
          kind: s.plan.kind,
          phase: s.phase,
          phaseIndex: s.phaseIndex,
          phases: s.plan.phases.map((p) => p.phase),
          phaseProgress: s.phaseProgress,
          progress: s.progress,
          waiting: s.waiting,
          oncoming: s.plan.oncoming,
          offgoing: s.plan.offgoing,
          kept: s.plan.kept,
          freewheel: s.plan.freewheel,
        }
      : null;
    return {
      time: this.time,
      mode: this.inputs.mode,
      selector: this.inputs.selector,
      gear: this.gear,
      flowGear: fg,
      targetGear: s ? s.plan.to : this.gear,
      engineRpm: toRpm(this.we),
      turbineRpm: toRpm(this.wt),
      outputRpm: toRpm(this.wOut),
      vehicleKmh: kmh(this.v),
      ratio,
      gearRatio: GEAR_RATIOS[fg],
      engineTorque: this.engTorque,
      turbineTorque: this.turbTorqueTotal,
      outputTorque: this.outTorque,
      wheelTorque: this.outTorque * VEHICLE.finalDrive,
      throttle: this.inputs.throttle,
      brake: this.inputs.brake,
      converter: { ...this.convState, lockup: lockState, lockupLevel: this.lockLevel },
      statorRpm: toRpm(this.statorSpeed),
      members,
      planets,
      roles: GEARS[fg].roles,
      elements,
      shift: shiftSnap,
      hydraulics: hyd,
      overrun: this.overrun,
      coast: this.turbTorqueTotal < -1 && fg !== 'N' && fg !== 'P',
      tcuReason: this.inputs.mode === 'bench' ? 'Prüfstand: Gang wird manuell vorgegeben.' : this.tcuReason,
      messages: this.messages.slice(0, 12),
      benchLimited: this.benchLimited,
      parkLock: this.gear === 'P' && !s,
    };
  }
}

function benchSelector(g: GearId): Selector {
  if (g === 'P' || g === 'R' || g === 'N') return g;
  return 'D';
}

function wrap(a: number): number {
  const T = Math.PI * 2 * 1000;
  return a > T || a < -T ? a % (Math.PI * 2 * 1000) : a;
}
