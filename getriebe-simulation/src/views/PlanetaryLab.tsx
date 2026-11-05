/**
 * "Planetengetriebe verstehen": ein einzelner Planetenradsatz, frei konfigurierbar.
 * Drehzahlen aus der Willis-Gleichung, Momente aus dem Kräftegleichgewicht.
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import { create } from 'zustand';
import { toRad } from '../sim/engine';
import { MEMBER_LABEL, checkGeometry, completeSpeeds, planetSpeedRelative, solveSingleSet, type SetMember, type SetSpeeds } from '../sim/planetary';
import { VISUAL_SPEED_SCALE, type SimSnapshot } from '../sim/simulation';
import type { Role, RoleKey } from '../sim/topology';
import { PanelToggles, usePanelClass } from '../ui/Hud';
import { useStore } from '../state/store';
import { ExplodeDriver, MaterialController } from '../three/core';
import { PlanetarySet3D } from '../three/PlanetarySet3D';
import { CameraRig, Controls, LabelLayer, LabelProjector, Lighting } from '../three/Scene';
import { Section, Segmented, Slider, Stat, fmt } from '../ui/common';
import { ROLE_CSS } from '../ui/InfoPanel';

export type FixedChoice = SetMember | 'none' | 'block';

interface LabState {
  zs: number;
  zp: number;
  planets: number;
  input: SetMember;
  fixed: FixedChoice;
  output: SetMember;
  inputRpm: number;
  secondRpm: number;
  set: (p: Partial<Omit<LabState, 'set'>>) => void;
}

export const useLab = create<LabState>((set) => ({
  zs: 30,
  zp: 21,
  planets: 3,
  input: 'sun',
  fixed: 'ring',
  output: 'carrier',
  inputRpm: 1000,
  secondRpm: 0,
  set: (p) => set(p),
}));

const MEMBERS: SetMember[] = ['sun', 'carrier', 'ring'];
const angles = { sun: 0, carrier: 0, ring: 0 };

export interface LabResult {
  speeds: SetSpeeds | null;
  ratio: number;
  error?: string;
  note?: string;
  formula: string;
  kind: string;
  second?: SetMember;
}

export function computeLab(s: Pick<LabState, 'zs' | 'zp' | 'input' | 'fixed' | 'output' | 'inputRpm' | 'secondRpm'>): LabResult {
  const zr = s.zs + 2 * s.zp;
  const g = { zs: s.zs, zr };
  if (s.fixed === 'block') {
    const v = s.inputRpm;
    return { speeds: { sun: v, carrier: v, ring: v }, ratio: 1, formula: 'zwei Glieder verbunden ⇒ i = 1', kind: 'Direktgang (Block)' };
  }
  if (s.fixed === 'none') {
    const second = MEMBERS.find((m) => m !== s.input && m !== s.output);
    if (!second || s.input === s.output) return { speeds: null, ratio: NaN, error: 'Antrieb und Abtrieb müssen verschieden sein.', formula: '', kind: '' };
    const sp = completeSpeeds(g, { [s.input]: s.inputRpm, [second]: s.secondRpm });
    const out = sp[s.output];
    return {
      speeds: sp,
      ratio: out === 0 ? Infinity : s.inputRpm / out,
      formula: 'Überlagerung: zwei Antriebe, Abtrieb aus der Willis-Gleichung',
      kind: 'Überlagerungsgetriebe (2 Freiheitsgrade)',
      second,
    };
  }
  if (s.input === s.fixed) return { speeds: null, ratio: NaN, error: 'Das angetriebene Glied kann nicht gleichzeitig festgehalten werden.', formula: '', kind: '' };
  const r = solveSingleSet(g, s.input, s.fixed, s.output, s.inputRpm);
  let note: string | undefined;
  if (s.output === s.fixed) note = 'Das Abtriebsglied ist festgehalten – es dreht nicht.';
  if (s.output === s.input) note = 'Abtrieb = Antrieb: trivial i = 1.';
  return { speeds: r.speeds, ratio: r.ratio, formula: r.formula, kind: r.kind, note };
}

function roleOf(m: SetMember, s: LabState, res: LabResult): Role {
  if (s.fixed === 'block') return m === s.output ? 'output' : 'input';
  if (m === s.input || m === res.second) return 'input';
  if (m === s.fixed) return 'held';
  if (m === s.output) return 'output';
  return 'idle';
}

function LabDriver() {
  useFrame((_, delta) => {
    const ui = useStore.getState();
    if (!ui.running) return;
    const s = useLab.getState();
    const res = computeLab(s);
    if (!res.speeds) return;
    const dt = Math.min(delta, 0.05) * ui.timeScale;
    // Labor: 1000 1/min ≈ 0,28 U/s sichtbar (gleicher Maßstab wie im Getriebe)
    for (const m of MEMBERS) angles[m] += toRad(res.speeds[m]) * VISUAL_SPEED_SCALE * dt * 1.5;
  });
  return null;
}

const KEY: Record<SetMember, RoleKey> = { sun: 'S', carrier: 'M', ring: 'RF' };

const getLabSnapshot = (): SimSnapshot => {
  const g = useStore.getState().snapshot;
  const s = useLab.getState();
  const res = computeLab(s);
  const roles = { ...g.roles };
  for (const m of MEMBERS) roles[KEY[m]] = res.speeds ? roleOf(m, s, res) : 'idle';
  roles.P_PF = res.speeds && s.fixed !== 'block' ? 'driven' : res.speeds ? 'output' : 'idle';
  return { ...g, roles };
};

export function LabSet3D() {
  const s = useLab();
  const zr = s.zs + 2 * s.zp;
  // Bei neuen Zähnezahlen Winkel zurücksetzen (Willis-Beziehung der Winkel muss zum neuen Satz passen)
  useEffect(() => {
    angles.sun = 0;
    angles.carrier = 0;
    angles.ring = 0;
  }, [s.zs, s.zp, s.planets]);
  const module = Math.round((3.4 / (zr + 3)) * 1000) / 1000;
  const face = 0.5;
  return (
    <PlanetarySet3D
      key={`${s.zs}-${s.zp}-${s.planets}`}
      zs={s.zs}
      zp={s.zp}
      zr={zr}
      planets={s.planets}
      module={module}
      x={0}
      face={face}
      ringOuter={(zr * module) / 2 + 3.2 * module}
      sunBore={Math.max(0.08, (s.zs * module) / 2 - 2.4 * module)}
      spiderCarrier
      getAngles={() => angles}
      keys={{ sun: 'S', carrier: 'M', ring: 'RF', planets: 'P_PF' }}
      parts={{ sun: 'lab-sonne', carrier: 'lab-traeger', ring: 'lab-hohlrad', planets: 'lab-planeten' }}
    />
  );
}

const LAB_LABELS = [
  { part: 'lab-sonne', text: 'Sonnenrad', pos: [-0.4, 0.0, 0.0] as [number, number, number] },
  { part: 'lab-hohlrad', text: 'Hohlrad', pos: [-0.3, 1.95, 0] as [number, number, number] },
  { part: 'lab-traeger', text: 'Planetenträger', pos: [-0.45, -0.25, -0.75] as [number, number, number] },
];

const LAB_PRESETS = {
  iso: { pos: [-3.7, 1.5, 2.2] as [number, number, number], target: [0, 0, 0] as [number, number, number], label: 'Schräg' },
  front: { pos: [-4.6, 0, 0.01] as [number, number, number], target: [0, 0, 0] as [number, number, number], label: 'Frontal' },
  side: { pos: [0, 1.2, 4.6] as [number, number, number], target: [0, 0, 0] as [number, number, number], label: 'Seitlich' },
};

export function PlanetaryStage() {
  const set = useStore((s) => s.set);
  const requestCamera = useStore((s) => s.requestCamera);
  useEffect(() => {
    const prev = useStore.getState().section;
    set({ section: 'off' });
    const t = setTimeout(() => requestCamera({ preset: 'iso' }), 60);
    return () => {
      clearTimeout(t);
      set({ section: prev });
    };
  }, [set, requestCamera]);
  return (
    <div className="stage">
      <Canvas className="canvas3d" dpr={[1, 1.75]} camera={{ position: [-3.7, 1.5, 2.2], fov: 40 }} gl={{ localClippingEnabled: true, antialias: true, alpha: true }}>
        <Lighting />
        <LabDriver />
        <MaterialController getSnapshot={getLabSnapshot} />
        <ExplodeDriver />
        <LabSet3D />
        <LabelProjector defs={LAB_LABELS} />
        <Controls />
        <CameraRig presets={LAB_PRESETS} />
      </Canvas>
      <LabelLayer defs={LAB_LABELS} />
      <LabLegend />
      <PanelToggles />
    </div>
  );
}

function LabLegend() {
  return (
    <div className="hud-bottom">
      <div className="legend">
        <span>
          <i style={{ background: 'var(--c-input)' }} /> Antrieb
        </span>
        <span>
          <i style={{ background: 'var(--c-held)' }} /> festgehalten
        </span>
        <span>
          <i style={{ background: 'var(--c-output)' }} /> Abtrieb
        </span>
        <span>
          <i style={{ background: 'var(--c-driven)' }} /> Planeten
        </span>
        <span>
          <i style={{ background: 'var(--c-idle)' }} /> frei mitlaufend
        </span>
      </div>
    </div>
  );
}

const PRESET_CONFIGS: { label: string; input: SetMember; fixed: FixedChoice; output: SetMember }[] = [
  { label: 'Sonne → Steg (Hohlrad fest)', input: 'sun', fixed: 'ring', output: 'carrier' },
  { label: 'Hohlrad → Steg (Sonne fest)', input: 'ring', fixed: 'sun', output: 'carrier' },
  { label: 'Steg → Hohlrad (Sonne fest)', input: 'carrier', fixed: 'sun', output: 'ring' },
  { label: 'Steg → Sonne (Hohlrad fest)', input: 'carrier', fixed: 'ring', output: 'sun' },
  { label: 'Sonne → Hohlrad (Steg fest)', input: 'sun', fixed: 'carrier', output: 'ring' },
  { label: 'Hohlrad → Sonne (Steg fest)', input: 'ring', fixed: 'carrier', output: 'sun' },
  { label: 'Block (2 Glieder gekuppelt)', input: 'sun', fixed: 'block', output: 'carrier' },
];

export function LabControls() {
  const s = useLab();
  const zr = s.zs + 2 * s.zp;
  const geo = checkGeometry({ zs: s.zs, zp: s.zp, zr, planets: s.planets, module: 1 });
  const memberOpts = MEMBERS.map((m) => ({ value: m, label: MEMBER_LABEL[m].replace('Planetenträger', 'Träger') }));
  return (
    <>
      <Section title="Schaltung wählen">
        <div className="field">
          <span>Angetrieben</span>
          <Segmented small value={s.input} onChange={(v) => s.set({ input: v })} options={memberOpts} />
        </div>
        <div className="field">
          <span>Festgehalten</span>
          <Segmented
            small
            value={s.fixed}
            onChange={(v) => s.set({ fixed: v })}
            options={[...memberOpts, { value: 'none' as FixedChoice, label: 'keins' }, { value: 'block' as FixedChoice, label: 'Block' }]}
          />
        </div>
        <div className="field">
          <span>Abtrieb</span>
          <Segmented small value={s.output} onChange={(v) => s.set({ output: v })} options={memberOpts} />
        </div>
        <Slider label="Antriebsdrehzahl" value={s.inputRpm} min={-3000} max={3000} step={50} onChange={(v) => s.set({ inputRpm: v })} format={(v) => `${fmt(v)} 1/min`} />
        {s.fixed === 'none' && (
          <Slider
            label={`2. Antrieb (${MEMBER_LABEL[MEMBERS.find((m) => m !== s.input && m !== s.output) ?? 'ring']})`}
            value={s.secondRpm}
            min={-3000}
            max={3000}
            step={50}
            onChange={(v) => s.set({ secondRpm: v })}
            format={(v) => `${fmt(v)} 1/min`}
          />
        )}
        <div className="preset-list">
          {PRESET_CONFIGS.map((p) => (
            <button
              key={p.label}
              className={`btn small ${s.input === p.input && s.fixed === p.fixed && s.output === p.output ? 'active' : ''}`}
              onClick={() => s.set({ input: p.input, fixed: p.fixed, output: p.output })}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Zähnezahlen">
        <Slider label="Sonnenrad Zs" value={s.zs} min={12} max={60} step={1} onChange={(v) => s.set({ zs: v })} />
        <Slider label="Planetenrad Zp" value={s.zp} min={12} max={40} step={1} onChange={(v) => s.set({ zp: v })} />
        <div className="field">
          <span>Anzahl Planeten</span>
          <Segmented small value={String(s.planets)} onChange={(v) => s.set({ planets: parseInt(v, 10) })} options={[3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))} />
        </div>
        <div className="stats">
          <Stat label="Hohlrad Zr = Zs + 2·Zp" value={String(zr)} />
          <Stat label="Standübersetzung i₀" value={fmt(-zr / s.zs, 3)} />
        </div>
        <ul className="checks">
          <li className={geo.coaxial ? 'ok' : 'bad'}>Koaxialbedingung Zr = Zs + 2·Zp</li>
          <li className={geo.assembly ? 'ok' : 'bad'}>
            Montagebedingung (Zs + Zr) / N = {fmt((s.zs + zr) / s.planets, 2)} {geo.assembly ? 'ganzzahlig' : 'nicht ganzzahlig'}
          </li>
          <li className={geo.neighbour ? 'ok' : 'bad'}>Nachbarbedingung (Planeten berühren sich nicht)</li>
        </ul>
        {geo.messages.map((m) => (
          <p key={m} className="warn">
            {m}
          </p>
        ))}
        {!geo.assembly && <p className="hint">Die Darstellung zeigt die Planeten trotzdem gleichmäßig verteilt – in der Realität nicht montierbar.</p>}
      </Section>
    </>
  );
}

export function LabResults() {
  const s = useLab();
  const res = computeLab(s);
  const zr = s.zs + 2 * s.zp;
  if (res.error || !res.speeds) {
    return (
      <Section title="Ergebnis">
        <p className="warn">{res.error}</p>
      </Section>
    );
  }
  const sp = res.speeds;
  const fixedTxt = s.fixed === 'none' ? 'kein Glied' : s.fixed === 'block' ? 'Block' : MEMBER_LABEL[s.fixed];
  const known = (m: SetMember) => m === s.input || m === s.fixed || m === res.second || s.fixed === 'block';
  const sym = { sun: 'ωs', carrier: 'ωc', ring: 'ωr' } as const;
  const val = (m: SetMember) => (known(m) ? fmt(sp[m]) : sym[m]);
  const unknown = MEMBERS.find((m) => !known(m));
  // Momente (ideal) für 100 Nm am Antrieb
  const coef = { sun: s.zs, ring: zr, carrier: -(s.zs + zr) };
  const F = 100 / coef[s.input];
  const torque = (m: SetMember) => coef[m] * F;
  const planetRel = planetSpeedRelative(s.zs, s.zp, sp.sun, sp.carrier);
  return (
    <>
      <Section title="Ergebnis">
        <div className="stats">
          {MEMBERS.map((m) => {
            const role = roleOf(m, s, res);
            return <Stat key={m} label={MEMBER_LABEL[m]} value={fmt(sp[m])} unit="1/min" accent={ROLE_CSS[role]} />;
          })}
          <Stat label="Planeten (rel. zum Träger)" value={fmt(planetRel)} unit="1/min" accent="var(--c-driven)" />
          <Stat label="Übersetzung i = n_an / n_ab" value={Number.isFinite(res.ratio) ? fmt(res.ratio, 3) : '∞'} />
        </div>
        <div className="result-kind">{res.kind}</div>
        {res.note && <p className="hint">{res.note}</p>}
        <p className="explain">
          Antrieb: <b>{MEMBER_LABEL[s.input]}</b> · festgehalten: <b>{fixedTxt}</b> · Abtrieb: <b>{MEMBER_LABEL[s.output]}</b> →{' '}
          {sp[s.output] === 0 ? 'Abtrieb steht' : sp[s.output] * s.inputRpm < 0 ? 'Drehrichtung umgekehrt' : 'gleiche Drehrichtung'}.
        </p>
      </Section>
      <Section title="Willis-Gleichung Schritt für Schritt">
        <div className="formula">
          <div>(Zs + Zr) · ωc = Zs · ωs + Zr · ωr</div>
          <div>
            ({s.zs} + {zr}) · {val('carrier')} = {s.zs} · {val('sun')} + {zr} · {val('ring')}
          </div>
          {unknown && (
            <div className="formula-result">
              ⇒ {sym[unknown]} = {fmt(sp[unknown], 1)} 1/min
            </div>
          )}
          {s.fixed !== 'none' && s.fixed !== 'block' && <div className="formula-sub">{res.formula}</div>}
        </div>
      </Section>
      <Section title="Momente (ideal, 100 Nm Antrieb)">
        <p className="hint">T_s : T_r : T_c = Zs : Zr : −(Zs + Zr) = {s.zs} : {zr} : −{s.zs + zr}</p>
        <div className="stats">
          {MEMBERS.map((m) => (
            <Stat key={m} label={MEMBER_LABEL[m]} value={s.fixed === 'block' ? '–' : fmt(torque(m), 1)} unit={s.fixed === 'block' ? '' : 'Nm'} />
          ))}
        </div>
        <p className="hint">Vorzeichen: Moment, das von außen auf das Glied wirkt. Positiv = in Antriebsrichtung; das negative Moment am Abtrieb ist die Last, die der Abtrieb überwindet.</p>
        <p className="explain">
          Das festgehaltene Glied muss das Reaktionsmoment ins Gehäuse ableiten. Leistung bleibt erhalten: Wird die Drehzahl um den Faktor i verringert, steigt das Moment um denselben Faktor.
        </p>
      </Section>
      <Section title="Alle Grundschaltungen (aktuelle Zähnezahlen)" defaultOpen={false}>
        <table className="el-table">
          <thead>
            <tr>
              <th>Antrieb</th>
              <th>fest</th>
              <th>Abtrieb</th>
              <th>i</th>
              <th>Art</th>
            </tr>
          </thead>
          <tbody>
            {PRESET_CONFIGS.filter((p) => p.fixed !== 'block').map((p) => {
              const r = computeLab({ ...s, input: p.input, fixed: p.fixed, output: p.output });
              const active = s.input === p.input && s.fixed === p.fixed && s.output === p.output;
              return (
                <tr key={p.label} className={active ? 'active-row' : ''} onClick={() => s.set({ input: p.input, fixed: p.fixed, output: p.output })}>
                  <td>{MEMBER_LABEL[p.input]}</td>
                  <td>{MEMBER_LABEL[p.fixed as SetMember]}</td>
                  <td>{MEMBER_LABEL[p.output]}</td>
                  <td className="num">{fmt(r.ratio, 3)}</td>
                  <td>{r.kind}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="hint">Warum unterschiedlich? Entscheidend ist, welches Glied sich abstützt: Steht das Hohlrad (größter Hebel), entsteht die größte Untersetzung; steht der Steg, wirken die Planeten als Zwischenräder und kehren die Drehrichtung um.</p>
      </Section>
    </>
  );
}

export function PlanetaryLab() {
  const requestCamera = useStore((s) => s.requestCamera);
  return (
    <div className="view-main">
      <aside className={usePanelClass('left')}>
        <LabControls />
        <Section title="Ansicht" defaultOpen={false}>
          <div className="btn-row">
            {Object.entries(LAB_PRESETS).map(([k, p]) => (
              <button key={k} className="btn small" onClick={() => requestCamera({ preset: k as 'iso' })}>
                {p.label}
              </button>
            ))}
          </div>
        </Section>
      </aside>
      <PlanetaryStage />
      <aside className={usePanelClass('right')}>
        <LabResults />
      </aside>
    </div>
  );
}
