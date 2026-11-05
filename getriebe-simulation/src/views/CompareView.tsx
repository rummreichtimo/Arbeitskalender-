/**
 * Gangvergleich: zwei Gänge nebeneinander mit identischer Eingangsdrehzahl.
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GEAR_RATIOS, analyzeTorques } from '../sim/kinematics';
import { planShift } from '../sim/shift';
import { TransmissionSim, type SimSnapshot } from '../sim/simulation';
import { ELEMENTS, GEARS, MEMBERS, MEMBER_IDS, type GearId, type Role } from '../sim/topology';
import { PanelToggles, usePanelClass } from '../ui/Hud';
import { useStore } from '../state/store';
import { ExplodeDriver, MaterialController, SimContext, type SimCtx } from '../three/core';
import { FlowArrows } from '../three/FlowArrows';
import type { FlowPath } from '../three/flowPaths';
import { AutoFit, Controls, Lighting } from '../three/Scene';
import { Transmission3D } from '../three/Transmission3D';
import { Section, Slider, fmt } from '../ui/common';

const GEAR_CHOICES: GearId[] = ['1', '2', '3', '4', 'R'];

export const MECHANISM: Record<string, string> = {
  '1': 'Beide Simpson-Sätze arbeiten gekoppelt: Hohlrad vorne treibt, der hintere Träger stützt sich über F1 ab, das gemeinsame Sonnenrad dreht rückwärts und leitet einen Teil der Leistung über den hinteren Satz.',
  '2': 'Nur der vordere Satz arbeitet: Hohlrad treibt, Sonnenrad steht (B1), der Träger wird langsamer mitgenommen.',
  '3': 'Hohlrad und Sonnenrad vorne werden gleich schnell angetrieben (K1 + K2) – der Satz läuft als starrer Block, i = 1.',
  '4': 'Der Simpson-Satz läuft als Block; im Overdrive-Satz treibt der Träger, die Sonne steht (B3) und das Hohlrad läuft schneller als der Antrieb.',
  R: 'Im hinteren Satz steht der Träger (B2); das angetriebene Sonnenrad dreht die Planeten wie Zwischenräder, das Hohlrad läuft rückwärts.',
};

function makeSim(gear: GearId, rpm: number) {
  const s = new TransmissionSim({ mode: 'bench' });
  s.setInputs({ mode: 'bench' });
  s.setInputs({ benchGear: gear, benchRpm: rpm, benchLockup: true, benchTorque: 150 });
  s.gear = gear;
  s.shift = null;
  s.step(0.05);
  return s;
}

function LocalDriver({ ctx, snapRef }: { ctx: SimCtx; snapRef: React.MutableRefObject<SimSnapshot> }) {
  const acc = useRef(0);
  useFrame((_, delta) => {
    const st = useStore.getState();
    if (st.running) ctx.sim.step(Math.min(delta, 0.05) * st.timeScale);
    acc.current += delta;
    if (acc.current > 0.1) {
      acc.current = 0;
      snapRef.current = ctx.sim.snapshot();
    }
  });
  return null;
}

const noInput = (p: FlowPath) => p.kind !== 'input';
const FIT_CENTER: [number, number, number] = [0, -0.2, 0];
const FIT_DIR: [number, number, number] = [-0.12, 0.3, 1];

function GearCanvas({ gear, rpm, label }: { gear: GearId; rpm: number; label: string }) {
  const simRef = useRef<TransmissionSim>(makeSim(gear, rpm));
  const snapRef = useRef<SimSnapshot>(simRef.current.snapshot());
  useEffect(() => {
    simRef.current.setInputs({ benchGear: gear, benchRpm: rpm });
  }, [gear, rpm]);
  const ctx = useMemo<SimCtx>(() => ({ sim: simRef.current, getSnapshot: () => snapRef.current }), []);
  const [snap, setSnap] = useState<SimSnapshot>(snapRef.current);
  useEffect(() => {
    const t = setInterval(() => setSnap(snapRef.current), 200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="compare-stage">
      <SimContext.Provider value={ctx}>
        <Canvas className="canvas3d" dpr={[1, 1.5]} camera={{ position: [-1.4, 2.4, 11.5], fov: 36 }} gl={{ localClippingEnabled: true, antialias: true, alpha: true }}>
          <Lighting />
          <LocalDriver ctx={ctx} snapRef={snapRef} />
          <MaterialController />
          <ExplodeDriver />
          <group position={[1.3, 0, 0]}>
            <Transmission3D gearsetOnly />
            <FlowArrows gear={snap.flowGear} lockup={false} filter={noInput} />
          </group>
          <Controls />
          <AutoFit center={FIT_CENTER} width={7.8} height={5.0} dir={FIT_DIR} />
        </Canvas>
      </SimContext.Provider>
      <div className="compare-head">
        <span className="compare-tag">{label}</span>
        <b>{GEARS[snap.flowGear].title}</b>
        <span>
          i = {fmt(GEAR_RATIOS[gear], 3)} · n_ab = {fmt(snap.outputRpm)} 1/min
        </span>
      </div>
    </div>
  );
}

function rolesList(g: GearId, r: Role) {
  return (
    MEMBER_IDS.filter((m) => GEARS[g].roles[m] === r)
      .map((m) => MEMBERS[m].short)
      .join(', ') || '–'
  );
}

export function CompareView() {
  const [a, setA] = useState<GearId>('1');
  const [b, setB] = useState<GearId>('2');
  const [rpm, setRpm] = useState(2000);
  const [torque, setTorque] = useState(150);
  const set = useStore((s) => s.set);
  useEffect(() => {
    const prev = useStore.getState().section;
    set({ section: 'shells' });
    return () => set({ section: prev });
  }, [set]);
  const ia = GEAR_RATIOS[a];
  const ib = GEAR_RATIOS[b];
  const ta = analyzeTorques(a, torque);
  const tb = analyzeTorques(b, torque);
  const plan = a !== b ? planShift(a, b) : null;
  const sets = (g: GearId) =>
    (['P_PF', 'P_PR', 'P_PO'] as const)
      .filter((k) => GEARS[g].roles[k] !== 'idle')
      .map((k) => (k === 'P_PF' ? 'vorne' : k === 'P_PR' ? 'hinten' : 'Overdrive'))
      .join(', ');
  const rows: [string, string, string][] = [
    ['Übersetzung i', fmt(ia, 3), fmt(ib, 3)],
    ['Formel', GEARS[a].formula, GEARS[b].formula],
    ['Ausgangsdrehzahl', `${fmt(rpm / ia)} 1/min`, `${fmt(rpm / ib)} 1/min`],
    ['Drehrichtung', ia > 0 ? 'vorwärts' : 'rückwärts', ib > 0 ? 'vorwärts' : 'rückwärts'],
    ['Abtriebsmoment', `${fmt(ta.output)} Nm`, `${fmt(tb.output)} Nm`],
    ['Geschlossen', GEARS[a].elements.join(', '), GEARS[b].elements.join(', ')],
    ['Angetrieben', rolesList(a, 'driven'), rolesList(b, 'driven')],
    ['Festgehalten', rolesList(a, 'held'), rolesList(b, 'held')],
    ['Arbeitende Sätze', sets(a), sets(b)],
  ];
  const faster = Math.abs(ia) > Math.abs(ib) ? b : a;
  const factor = Math.max(Math.abs(ia), Math.abs(ib)) / Math.min(Math.abs(ia), Math.abs(ib));
  return (
    <div className="view-main compare">
      <aside className={usePanelClass('left')}>
        <Section title="Gänge wählen">
          <div className="field">
            <span>Gang A</span>
            <div className="gear-grid five">
              {GEAR_CHOICES.map((g) => (
                <button key={g} className={`gear-btn ${a === g ? 'active' : ''}`} onClick={() => setA(g)}>
                  <b>{GEARS[g].label}</b>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Gang B</span>
            <div className="gear-grid five">
              {GEAR_CHOICES.map((g) => (
                <button key={g} className={`gear-btn ${b === g ? 'active' : ''}`} onClick={() => setB(g)}>
                  <b>{GEARS[g].label}</b>
                </button>
              ))}
            </div>
          </div>
          <Slider label="Eingangsdrehzahl (beide)" value={rpm} min={600} max={5000} step={50} onChange={setRpm} format={(v) => `${fmt(v)} 1/min`} />
          <Slider label="Eingangsmoment (beide)" value={torque} min={0} max={300} step={5} onChange={setTorque} format={(v) => `${fmt(v)} Nm`} />
          <p className="hint">Beide Ansichten: Wandler überbrückt, Eingangswelle mit gleicher Drehzahl. Gezeigt wird der Radsatz mit Schaltelementen.</p>
        </Section>
      </aside>
      <div className="compare-grid">
        <GearCanvas gear={a} rpm={rpm} label="A" />
        <GearCanvas gear={b} rpm={rpm} label="B" />
        <PanelToggles />
      </div>
      <aside className={usePanelClass('right')}>
        <Section title="Vergleich">
          <table className="el-table compare-table">
            <thead>
              <tr>
                <th></th>
                <th>A: {GEARS[a].title}</th>
                <th>B: {GEARS[b].title}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, x, y]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{x}</td>
                  <td>{y}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section title="Warum unterscheiden sich die Übersetzungen?">
          <p className="explain">
            <b>A ({GEARS[a].label}):</b> {MECHANISM[a]}
          </p>
          <p className="explain">
            <b>B ({GEARS[b].label}):</b> {MECHANISM[b]}
          </p>
          {a !== b && (
            <p className="explain">
              Bei gleicher Eingangsdrehzahl dreht der Abtrieb in Gang {GEARS[faster].label} um den Faktor {fmt(factor, 2)} schneller – das Abtriebsmoment ist dort um denselben Faktor kleiner (Leistung = Moment × Drehzahl bleibt im verlustfreien Modell gleich).
              {Math.sign(ia) !== Math.sign(ib) && ' Zusätzlich kehrt sich die Drehrichtung um.'}
            </p>
          )}
          {plan && (
            <p className="hint">
              Wechsel A → B: {plan.oncoming.length ? `zuschalten ${plan.oncoming.map((e) => ELEMENTS[e].name).join(', ')}` : ''}
              {plan.oncoming.length && plan.offgoing.length ? '; ' : ''}
              {plan.offgoing.length ? `abschalten ${plan.offgoing.map((e) => ELEMENTS[e].name).join(', ')}` : ''}.
            </p>
          )}
        </Section>
      </aside>
    </div>
  );
}
