/**
 * Ablauf eines Gangwechsels (Lastschaltung) in Phasen.
 *
 * Zug-Hochschaltung:  Befüllen → Momentenphase → Drehzahlphase (Synchronisation) → Abschluss
 * Zug-Rückschaltung:  Befüllen → Drehzahlphase → Momentenphase → Abschluss
 * Einlegen aus N/P:   Befüllen → Drehzahlphase (Turbine wird abgebremst) → Abschluss
 *
 * Die Dauer der Phasen ist zeitgesteuert (didaktische Vereinfachung); die
 * Drehzahlen während der Drehzahlphase werden zwischen alter und neuer
 * Synchrondrehzahl interpoliert, der Momentenübergang linear überblendet.
 */
import { GEARS, isDriveGear, type ElementId, type GearId } from './topology';


export type ShiftPhase = 'fill' | 'torque' | 'inertia' | 'finish';

export const PHASE_LABEL: Record<ShiftPhase, string> = {
  fill: 'Befüllphase',
  torque: 'Momentenphase',
  inertia: 'Drehzahlphase',
  finish: 'Abschluss',
};

export const PHASE_TEXT: Record<ShiftPhase, string> = {
  fill:
    'Das Steuergerät schaltet das Magnetventil um. Öl strömt in den Kolbenraum des zuschaltenden Elements, der Kolben überwindet das Lüftspiel – es wird noch kein Moment übertragen.',
  torque:
    'Das zuschaltende Element übernimmt schrittweise das Moment, während das abschaltende Element gleichzeitig entlastet wird (Überschneidung). Die Drehzahlen ändern sich noch nicht, aber das Abtriebsmoment geht auf das Niveau des neuen Gangs über.',
  inertia:
    'Ein Element rutscht (Schlupf). Die Eingangsdrehzahl wird auf die Synchrondrehzahl des neuen Gangs gebracht. Die Reibarbeit wird in Wärme umgesetzt.',
  finish: 'Das neue Element haftet vollständig, der Druck wird auf Systemdruck angehoben. Der neue Gang ist eingelegt.',
};

export interface ShiftPlan {
  from: GearId;
  to: GearId;
  kind: 'hoch' | 'runter' | 'einlegen' | 'auslegen' | 'wechsel';
  kept: ElementId[];
  offgoing: ElementId[];
  oncoming: ElementId[];
  phases: { phase: ShiftPhase; duration: number }[];
  /** Freilaufschaltung: abschaltendes Element ist ein Freilauf → kein Überschneidungs-Timing nötig */
  freewheel: boolean;
}

export const PHASE_DURATION: Record<ShiftPhase, number> = {
  fill: 0.2,
  torque: 0.25,
  inertia: 0.5,
  finish: 0.15,
};

export function gearIndex(g: GearId): number {
  const map: Record<GearId, number> = { P: -2, R: -1, N: 0, '1': 1, '1M': 1, '2': 2, '3': 3, '4': 4 };
  return map[g];
}

export function planShift(from: GearId, to: GearId): ShiftPlan {
  const a = GEARS[from].elements;
  const b = GEARS[to].elements;
  const kept = a.filter((e) => b.includes(e));
  const offgoing = a.filter((e) => !b.includes(e));
  const oncoming = b.filter((e) => !a.includes(e));
  const fromDrive = isDriveGear(from) || from === 'R';
  const toDrive = isDriveGear(to) || to === 'R';
  let kind: ShiftPlan['kind'];
  let phases: ShiftPhase[];
  if (!fromDrive && toDrive) {
    kind = 'einlegen';
    phases = ['fill', 'inertia', 'finish'];
  } else if (fromDrive && !toDrive) {
    kind = 'auslegen';
    phases = ['finish'];
  } else if (!fromDrive && !toDrive) {
    kind = 'wechsel';
    phases = ['finish'];
  } else if (from === 'R' || to === 'R') {
    kind = 'wechsel';
    phases = ['fill', 'inertia', 'finish'];
  } else if (gearIndex(to) > gearIndex(from)) {
    kind = 'hoch';
    phases = ['fill', 'torque', 'inertia', 'finish'];
  } else if (gearIndex(to) < gearIndex(from)) {
    kind = 'runter';
    phases = ['fill', 'inertia', 'torque', 'finish'];
  } else {
    // 1 ↔ 1M: nur Zu-/Abschalten der Bremse B2, keine Drehzahländerung
    kind = 'wechsel';
    phases = ['fill', 'finish'];
  }
  return {
    from,
    to,
    kind,
    kept,
    offgoing,
    oncoming,
    phases: phases.map((p) => ({ phase: p, duration: PHASE_DURATION[p] })),
    freewheel: offgoing.length === 1 && offgoing[0] === 'F1',
  };
}

export type ElementPhaseState = 'offen' | 'füllt' | 'übernimmt' | 'löst' | 'schlupft' | 'geschlossen';

export class ShiftProcess {
  plan: ShiftPlan;
  phaseIndex = 0;
  /** Zeit innerhalb der aktuellen Phase */
  t = 0;
  /** Schrittmodus: am Ende jeder Phase anhalten */
  stepMode: boolean;
  waiting = false;
  done = false;
  /** Turbinendrehzahl zu Beginn der Drehzahlphase */
  inertiaStartSpeed: number | null = null;

  constructor(plan: ShiftPlan, stepMode = false) {
    this.plan = plan;
    this.stepMode = stepMode;
  }

  get phase(): ShiftPhase {
    return this.plan.phases[Math.min(this.phaseIndex, this.plan.phases.length - 1)].phase;
  }

  get phaseDuration(): number {
    return this.plan.phases[Math.min(this.phaseIndex, this.plan.phases.length - 1)].duration;
  }

  /** Fortschritt innerhalb der Phase 0…1 */
  get phaseProgress(): number {
    return Math.min(1, this.t / this.phaseDuration);
  }

  /** Gesamtfortschritt 0…1 */
  get progress(): number {
    const total = this.plan.phases.reduce((s, p) => s + p.duration, 0);
    let done = 0;
    for (let i = 0; i < this.phaseIndex && i < this.plan.phases.length; i++) done += this.plan.phases[i].duration;
    return Math.min(1, (done + Math.min(this.t, this.phaseDuration)) / total);
  }

  private phaseDone(p: ShiftPhase): boolean {
    const i = this.plan.phases.findIndex((x) => x.phase === p);
    if (i < 0) return false;
    return this.phaseIndex > i || (this.phaseIndex === i && this.t >= this.plan.phases[i].duration);
  }

  private phaseActive(p: ShiftPhase): boolean {
    return this.phase === p && !this.done;
  }

  /** Momentenüberblendung alt → neu (0…1) */
  get torqueBlend(): number {
    if (this.done) return 1;
    if (this.hasPhase('torque')) {
      if (this.phaseDone('torque')) return 1;
      return this.phaseActive('torque') ? smooth(this.phaseProgress) : 0;
    }
    if (this.hasPhase('inertia')) {
      if (this.phaseDone('inertia')) return 1;
      return this.phaseActive('inertia') ? smooth(this.phaseProgress) : 0;
    }
    // Auslegen / Wechsel ohne Drehzahlphase: Moment geht beim Lösen sofort auf das Ziel über
    return this.phase === 'finish' ? 1 : 0;
  }

  hasPhase(p: ShiftPhase): boolean {
    return this.plan.phases.some((x) => x.phase === p);
  }

  /** Drehzahlüberblendung alt → neu (0…1) */
  get speedBlend(): number {
    if (!this.hasPhase('inertia')) return this.done || this.phase === 'finish' ? 1 : 0;
    if (this.phaseDone('inertia')) return 1;
    if (this.phaseActive('inertia')) return smooth(this.phaseProgress);
    return 0;
  }

  /** Füllgrad / Kolbenhub des zuschaltenden Elements 0…1 */
  get oncomingStroke(): number {
    if (this.phaseDone('fill') || !this.hasPhase('fill')) return 1;
    return this.phaseActive('fill') ? this.phaseProgress : 0;
  }

  /** relativer Anpressdruck des zuschaltenden Elements 0…1 */
  get oncomingPressure(): number {
    const fillLevel = 0.15;
    if (this.done) return 1;
    if (this.phase === 'fill') return fillLevel * this.phaseProgress;
    if (this.plan.kind === 'hoch') {
      if (this.phase === 'torque') return fillLevel + (0.55 - fillLevel) * this.phaseProgress;
      if (this.phase === 'inertia') return 0.55 + 0.15 * this.phaseProgress;
      return 0.7 + 0.3 * this.phaseProgress;
    }
    if (this.phase === 'inertia') return fillLevel + 0.15 * this.phaseProgress;
    if (this.phase === 'torque') return 0.3 + 0.4 * this.phaseProgress;
    return 0.7 + 0.3 * this.phaseProgress;
  }

  /** relativer Druck des abschaltenden Elements 0…1 */
  get offgoingPressure(): number {
    if (this.done) return 0;
    if (this.plan.kind === 'auslegen' || this.plan.kind === 'wechsel') return this.phase === 'finish' ? 1 - this.phaseProgress : 1;
    if (this.plan.kind === 'hoch') {
      if (this.phase === 'fill') return 1 - 0.4 * this.phaseProgress;
      if (this.phase === 'torque') return 0.6 * (1 - this.phaseProgress);
      return 0;
    }
    // Rückschaltung: abschaltendes Element wird auf Schlupf geregelt
    if (this.phase === 'fill') return 1 - 0.5 * this.phaseProgress;
    if (this.phase === 'inertia') return 0.5 - 0.2 * this.phaseProgress;
    if (this.phase === 'torque') return 0.3 * (1 - this.phaseProgress);
    return 0;
  }

  elementState(e: ElementId): ElementPhaseState {
    if (this.plan.kept.includes(e)) return 'geschlossen';
    if (this.plan.oncoming.includes(e)) {
      if (this.done) return 'geschlossen';
      if (this.phase === 'fill') return 'füllt';
      if (this.phase === 'torque') return 'übernimmt';
      if (this.phase === 'inertia') return this.plan.kind === 'hoch' || this.plan.kind === 'einlegen' || this.plan.kind === 'wechsel' ? 'schlupft' : 'füllt';
      return 'geschlossen';
    }
    if (this.plan.offgoing.includes(e)) {
      if (this.done) return 'offen';
      if (this.plan.kind === 'runter' && this.phase === 'inertia') return 'schlupft';
      if (this.phase === 'torque') return 'löst';
      if (this.phase === 'fill') return 'geschlossen';
      if (this.phase === 'finish' && (this.plan.kind === 'auslegen' || this.plan.kind === 'wechsel')) return 'löst';
      return 'offen';
    }
    return 'offen';
  }

  /** Welche Elemente wirken gerade starr (für die Kinematik)? */
  rigidElements(): ElementId[] {
    if (!this.hasPhase('inertia')) {
      // Auslegen: das Getriebe ist kinematisch sofort entkoppelt; der Druckabbau wird nur angezeigt
      return this.torqueBlend >= 1 ? GEARS[this.plan.to].elements : GEARS[this.plan.from].elements;
    }
    const sb = this.speedBlend;
    if (sb <= 0 && !this.phaseActive('inertia')) return GEARS[this.plan.from].elements;
    if (sb >= 1) return GEARS[this.plan.to].elements;
    return this.plan.kept;
  }

  /** Simulationszeit fortschreiben. Gibt true zurück, wenn die Schaltung abgeschlossen ist. */
  advance(dt: number): boolean {
    if (this.done) return true;
    if (this.waiting) return false;
    this.t += dt;
    while (this.t >= this.phaseDuration && !this.done) {
      if (this.stepMode) {
        this.t = this.phaseDuration;
        this.waiting = true;
        return false;
      }
      this.nextPhase();
    }
    return this.done;
  }

  /** Im Schrittmodus: nächste Phase freigeben */
  continue(): void {
    if (!this.waiting) return;
    this.waiting = false;
    this.nextPhase();
  }

  private nextPhase() {
    const overflow = Math.max(0, this.t - this.phaseDuration);
    if (this.phaseIndex >= this.plan.phases.length - 1) {
      this.done = true;
      this.t = this.phaseDuration;
      return;
    }
    this.phaseIndex++;
    this.t = this.stepMode ? 0 : overflow;
  }
}

export function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
