/**
 * Eigene Ansicht für den Drehmomentwandler mit Betriebszuständen, Ölströmung und Kennlinien.
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { CONVERTER, converterCurves, converterState, statorSpeedVisual } from '../sim/converter';
import { toRad, toRpm } from '../sim/engine';
import { VISUAL_SPEED_SCALE, type SimSnapshot } from '../sim/simulation';
import { PanelToggles, usePanelClass } from '../ui/Hud';
import { useStore } from '../state/store';
import { Converter3D, type ConverterVisualState } from '../three/Converter3D';
import { ExplodeDriver, MaterialController, PartMesh } from '../three/core';
import { tubeX } from '../three/geometry';
import { CameraRig, Controls, LabelLayer, LabelProjector, Lighting } from '../three/Scene';
import { Section, Segmented, Slider, Stat, Toggle, fmt } from '../ui/common';
import { LineChart } from '../ui/LineChart';

interface Scenario {
  id: string;
  title: string;
  np: number;
  sr: number;
  lockup: number;
  simple: string;
  technical: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: '1',
    title: '1 · Motor läuft, Fahrzeug steht (D + Bremse)',
    np: 750,
    sr: 0,
    lockup: 0,
    simple:
      'Das Pumpenrad dreht mit Leerlaufdrehzahl und schleudert Öl gegen die Turbine. Die Turbine ist über den eingelegten Gang mit den Rädern verbunden – die Bremse hält sie fest. Weil zwischen Pumpe und Turbine nur Öl ist, kann die Pumpe einfach weiterdrehen: Der Motor wird nicht abgewürgt. Das Öl wird dabei verwirbelt und erwärmt.',
    technical:
      'Festbremspunkt (ν = 0): Das Pumpenmoment wächst mit dem Quadrat der Drehzahl (T_P = c₀·ω_P²). Bei 750 1/min sind das nur ≈ 35 Nm, an der Turbine ≈ 73 Nm (μ = 2,1). Über die Getriebeübersetzung und Achse ergibt das ein kleines Kriechmoment am Rad, das die Bremse problemlos hält. Die gesamte Leistung wird im Wandler in Wärme umgesetzt (η = 0).',
  },
  {
    id: '2',
    title: '2 · Langsames Anfahren',
    np: 1300,
    sr: 0.35,
    lockup: 0,
    simple:
      'Bremse los, etwas Gas: Die Pumpe dreht schneller, die Ölströmung wird stärker und die Turbine beginnt sich zu drehen. Das Fahrzeug rollt sanft an – ganz ohne Kupplungspedal.',
    technical:
      'Wandlungsbereich (0 < ν < ν_K): Die Turbine dreht langsamer als die Pumpe. Das Leitrad wird von vorne angeströmt und stützt sich über seinen Freilauf am Gehäuse ab; es lenkt das Öl so um, dass es das Pumpenrad in Drehrichtung unterstützt. Dadurch ist das Turbinenmoment größer als das Pumpenmoment (μ > 1).',
  },
  {
    id: '3',
    title: '3 · Drehmomentverstärkung beim Anfahren (Vollgas)',
    np: 2200,
    sr: 0.05,
    lockup: 0,
    simple:
      'Bei Vollgas aus dem Stand dreht der Motor schnell hoch, während die Turbine noch fast steht. Jetzt verstärkt der Wandler das Moment am stärksten – ungefähr auf das Doppelte. Das wirkt wie ein zusätzlicher, stufenloser „Gang“.',
    technical:
      'Nahe dem Festbremspunkt ist die Umlenkung am Leitrad maximal: μ ≈ 2,1. Die Motordrehzahl stellt sich dort ein, wo das Volllastmoment des Motors gleich der Aufnahme des Pumpenrads ist (Festbremsdrehzahl ≈ 2200 1/min bei 300 Nm).',
  },
  {
    id: '4',
    title: '4 · Turbine nähert sich der Pumpendrehzahl',
    np: 2400,
    sr: 0.9,
    lockup: 0,
    simple:
      'Mit steigender Geschwindigkeit holt die Turbine die Pumpe fast ein. Die Momentverstärkung verschwindet, das Leitrad wird nicht mehr gebraucht und dreht frei mit. Der Wandler arbeitet jetzt wie eine einfache Ölkupplung – mit etwas Schlupf.',
    technical:
      'Kupplungspunkt ν_K = 0,85: Ab hier trifft das Öl die Rückseite der Leitradschaufeln, der Freilauf löst, μ = 1. Der verbleibende Schlupf (hier 10 %) kostet Wirkungsgrad: η = μ·ν = 0,9 – deshalb wird bei Konstantfahrt überbrückt.',
  },
  {
    id: '5',
    title: '5 · Wandlerüberbrückungskupplung geschlossen',
    np: 1900,
    sr: 1,
    lockup: 1,
    simple:
      'Die Überbrückungskupplung presst sich gegen den Wandlerdeckel und verbindet Motor und Getriebe direkt mechanisch. Pumpe und Turbine drehen exakt gleich schnell – kein Schlupf, keine Verluste. Das Öl rotiert nur noch als Ganzes mit.',
    technical:
      'Kraftschluss über Reibung statt Strömung: T_Turbine = T_Motor, ν = 1, η ≈ 1. Ohne Schlupf entsteht keine Zirkulation zwischen Pumpe und Turbine mehr (keine Strömungsübertragung). Der Torsionsdämpfer übernimmt die Schwingungsdämpfung, die sonst das Öl leistet. Die TCU schließt die Kupplung typischerweise im 3./4. Gang bei mäßiger Last.',
  },
];

/** Zustand der Wandleransicht (außerhalb von React, damit der Render-Loop ihn fortschreiben kann) */
const cv = {
  np: 750,
  sr: 0,
  lockup: 0,
  target: { np: 750, sr: 0, lockup: 0 },
  angles: { pump: 0, turb: 0, stator: 0 },
};

function currentState() {
  const wp = toRad(cv.np);
  const wt = wp * cv.sr;
  const st = converterState(wp, Math.min(wt, wp * 0.99999));
  return { wp, wt, st };
}

function ConverterDriver() {
  useFrame((_, delta) => {
    const ui = useStore.getState();
    const d = Math.min(delta, 0.05);
    const k = Math.min(1, d * 1.6);
    cv.np += (cv.target.np - cv.np) * k;
    cv.sr += (cv.target.sr - cv.sr) * k;
    cv.lockup += (cv.target.lockup - cv.lockup) * Math.min(1, d * 2.5);
    if (cv.lockup > 0.98) cv.sr = 1;
    if (!ui.running) return;
    const dt = d * ui.timeScale;
    const { wp, wt, st } = currentState();
    const ws = cv.lockup > 0.98 ? wp : statorSpeedVisual(wp, wt, st.statorLocked);
    cv.angles.pump += wp * VISUAL_SPEED_SCALE * dt;
    cv.angles.turb += wt * VISUAL_SPEED_SCALE * dt;
    cv.angles.stator += ws * VISUAL_SPEED_SCALE * dt;
  });
  return null;
}

const getConvVisual = (): ConverterVisualState => {
  const { wp, wt, st } = currentState();
  return {
    pumpAngle: cv.angles.pump,
    turbineAngle: cv.angles.turb,
    statorAngle: cv.angles.stator,
    wp,
    wt,
    statorLocked: st.statorLocked && cv.lockup < 0.98,
    lockup: cv.lockup,
  };
};

const getSnapshotForColors = (): SimSnapshot => {
  const g = useStore.getState().snapshot;
  const { st } = currentState();
  return {
    ...g,
    engineRpm: cv.np,
    converter: { ...g.converter, statorLocked: st.statorLocked, lockup: cv.lockup > 0.98 ? 'geschlossen' : cv.lockup > 0.02 ? 'schlupft' : 'offen' },
    roles: { ...g.roles, IN: 'input' },
  };
};

const CONV_LABELS = [
  { part: 'wandlergehaeuse', text: 'Wandlergehäuse (Motor)', pos: [-0.6, 2.75, 0] as [number, number, number] },
  { part: 'pumpenrad', text: 'Pumpenrad', pos: [0.6, 2.2, 0.2] as [number, number, number] },
  { part: 'turbinenrad', text: 'Turbinenrad', pos: [-0.55, 2.05, 0.2] as [number, number, number] },
  { part: 'leitrad', text: 'Leitrad', pos: [0, 1.15, 0.25] as [number, number, number] },
  { part: 'leitrad-freilauf', text: 'Leitrad-Freilauf', pos: [0.05, 0.45, 0.35] as [number, number, number] },
  { part: 'ueberbrueckungskupplung', text: 'Überbrückungskupplung', pos: [-1.05, 1.6, 0.2] as [number, number, number] },
  { part: 'eingangswelle', text: 'Turbinenwelle → Getriebe', pos: [1.6, 0.0, 0.3] as [number, number, number] },
];

const PRESETS = {
  iso: { pos: [2.3, 2.0, 5.6] as [number, number, number], target: [-0.1, 0.75, 0] as [number, number, number], label: 'Schräg' },
  side: { pos: [0, 0.9, 6.8] as [number, number, number], target: [-0.1, 0.8, 0] as [number, number, number], label: 'Schnitt' },
  front: { pos: [-7, 0.5, 0.01] as [number, number, number], target: [0, 0, 0] as [number, number, number], label: 'Axial' },
};

function Stubs() {
  const shaft = useMemo(() => tubeX(-0.72, 2.2, 0, 0.22), []);
  const support = useMemo(() => tubeX(-0.1, 2.0, 0.28, 0.42), []);
  return (
    <>
      <PartMesh geometry={shaft} part="eingangswelle" colorKey="IN" />
      <PartMesh geometry={support} part="leitradwelle" colorKey="FIXED" />
    </>
  );
}

export function ConverterView() {
  const [scenario, setScenario] = useState<string>('1');
  const [manual, setManual] = useState(false);
  const [, force] = useState(0);
  const section = useStore((s) => s.section);
  const set = useStore((s) => s.set);
  const requestCamera = useStore((s) => s.requestCamera);

  useEffect(() => {
    const prev = useStore.getState().section;
    set({ section: 'shells' });
    const s = SCENARIOS[0];
    cv.target = { np: s.np, sr: s.sr, lockup: s.lockup };
    const t = setInterval(() => force((x) => x + 1), 120);
    setTimeout(() => requestCamera({ preset: 'iso' }), 50);
    return () => {
      clearInterval(t);
      set({ section: prev });
    };
  }, [set, requestCamera]);

  const sc = SCENARIOS.find((s) => s.id === scenario) ?? SCENARIOS[0];
  const choose = (id: string) => {
    const s = SCENARIOS.find((x) => x.id === id)!;
    setScenario(id);
    setManual(false);
    cv.target = { np: s.np, sr: s.sr, lockup: s.lockup };
  };
  const { st } = currentState();
  const locked = cv.lockup > 0.98;
  const curves = useMemo(() => converterCurves(80), []);
  const muSeries = [{ id: 'mu', label: 'Wandlung μ', color: '#3987e5', points: curves.map((p) => [p.sr, p.tr] as [number, number]) }];
  const etaSeries = [{ id: 'eta', label: 'Wirkungsgrad η', color: '#199e70', points: curves.map((p) => [p.sr, p.eta * 100] as [number, number]) }];
  const sr = locked ? 1 : cv.sr;
  const engineTorqueAtPoint = st.pumpTorque;

  return (
    <div className="view-main">
      <aside className={usePanelClass('left')}>
        <Section title="Betriebszustände">
          <div className="scenario-list">
            {SCENARIOS.map((s) => (
              <button key={s.id} className={`scenario ${!manual && scenario === s.id ? 'active' : ''}`} onClick={() => choose(s.id)}>
                {s.title}
              </button>
            ))}
          </div>
        </Section>
        <Section title="Manuell einstellen">
          <Slider
            label="Pumpendrehzahl (Motor)"
            value={cv.target.np}
            min={600}
            max={4000}
            step={10}
            onChange={(v) => {
              setManual(true);
              cv.target = { ...cv.target, np: v };
            }}
            format={(v) => `${fmt(v)} 1/min`}
          />
          <Slider
            label="Drehzahlverhältnis ν = nT / nP"
            value={cv.target.sr}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => {
              setManual(true);
              cv.target = { ...cv.target, sr: v, lockup: v < 1 ? 0 : cv.target.lockup };
            }}
            format={(v) => fmt(v, 2)}
          />
          <Toggle
            label="Überbrückungskupplung geschlossen"
            checked={cv.target.lockup > 0.5}
            onChange={(v) => {
              setManual(true);
              cv.target = { ...cv.target, lockup: v ? 1 : 0, sr: v ? 1 : Math.min(cv.target.sr, 0.95) };
            }}
          />
        </Section>
        <Section title="Darstellung">
          <Toggle label="Ölströmung (Partikel)" checked={useStore.getState().showOil} onChange={(v) => set({ showOil: v })} />
          <Toggle label="Kraftfluss-Farben" checked={useStore.getState().showFlow} onChange={(v) => set({ showFlow: v })} />
          <Toggle label="Beschriftungen" checked={useStore.getState().showLabels} onChange={(v) => set({ showLabels: v })} />
          <div className="field">
            <span>Schnitt</span>
            <Segmented
              small
              value={section}
              onChange={(v) => set({ section: v })}
              options={[
                { value: 'off', label: 'Aus' },
                { value: 'shells', label: 'Gehäuse' },
                { value: 'full', label: 'Vollschnitt' },
              ]}
            />
          </div>
          <div className="btn-row">
            {Object.entries(PRESETS).map(([k, p]) => (
              <button key={k} className="btn small" onClick={() => requestCamera({ preset: k as 'iso' })}>
                {p.label}
              </button>
            ))}
          </div>
          <Slider label="Animationsgeschwindigkeit" value={useStore.getState().timeScale} min={0.1} max={3} step={0.05} onChange={(v) => set({ timeScale: v })} format={(v) => `${fmt(v, 2)}×`} />
        </Section>
      </aside>
      <ConverterStage />
      <aside className={usePanelClass('right')}>
        <Section title={manual ? 'Manueller Betriebspunkt' : sc.title}>
          {!manual && <p className="explain">{sc.simple}</p>}
          {!manual && <p className="explain tech">{sc.technical}</p>}
          {manual && <p className="explain">Freier Betriebspunkt. Die Werte unten folgen direkt aus der Wandlerkennlinie.</p>}
        </Section>
        <Section title="Werte am Betriebspunkt">
          <div className="stats">
            <Stat label="Pumpenmoment (Motorlast)" value={locked ? 'mechanisch' : fmt(engineTorqueAtPoint)} unit={locked ? '' : 'Nm'} accent="var(--c-input)" />
            <Stat label="Turbinenmoment" value={locked ? '= Motormoment' : fmt(st.turbineTorque)} unit={locked ? '' : 'Nm'} accent="var(--c-driven)" />
            <Stat label="Wandlung μ" value={fmt(locked ? 1 : st.tr, 2)} />
            <Stat label="Wirkungsgrad η" value={`${fmt((locked ? 1 : st.efficiency) * 100)} %`} />
            <Stat label="Schlupf" value={`${fmt((1 - sr) * 100)} %`} />
            <Stat label="Bereich" value={locked ? 'Überbrückt' : st.regime} />
            <Stat label="Verlustleistung" value={locked ? '≈ 0' : fmt((st.pumpTorque * toRad(cv.np) - st.turbineTorque * toRad(cv.np) * cv.sr) / 1000, 1)} unit={locked ? '' : 'kW'} />
            <Stat label="Leitraddrehzahl" value={fmt(locked ? cv.np : toRpm(statorSpeedVisual(toRad(cv.np), toRad(cv.np) * cv.sr, st.statorLocked)))} unit="1/min" />
          </div>
          <p className="hint">Kennlinie: halb-empirisches Modell (T_P = c₀·ω_P²·(1 − ν⁴), μ linear von 2,1 auf 1 bis ν_K = {fmt(CONVERTER.couplingPoint, 2)}). Typische Größenordnung, keine Messdaten. Die Partikelbewegung ist qualitativ.</p>
        </Section>
        <Section title="Kennlinien">
          <div className="chart-row">
            <LineChart
              title="Momentenwandlung μ über ν"
              series={muSeries}
              xDomain={[0, 1]}
              yDomain={[0.8, 2.2]}
              xLabel="ν"
              yLabel="μ"
              xTicks={[0, 0.25, 0.5, 0.75, 1]}
              yTicks={[1, 1.5, 2]}
              xFormat={(v) => fmt(v, 2)}
              yFormat={(v) => fmt(v, 2)}
              marker={{ x: sr, y: locked ? 1 : st.tr, label: 'Betriebspunkt' }}
            />
            <LineChart
              title="Wirkungsgrad η über ν"
              series={etaSeries}
              xDomain={[0, 1]}
              yDomain={[0, 100]}
              xLabel="ν"
              yLabel="η %"
              xTicks={[0, 0.25, 0.5, 0.75, 1]}
              yTicks={[0, 50, 100]}
              xFormat={(v) => fmt(v, 2)}
              yFormat={(v) => `${fmt(v)} %`}
              marker={{ x: sr, y: (locked ? 1 : st.efficiency) * 100, label: locked ? 'überbrückt' : 'Betriebspunkt' }}
            />
          </div>
        </Section>
        <Section title="Strömung oder Reibung?" defaultOpen={false}>
          <p className="explain">
            <b>Hydrodynamisch (offen):</b> Das Moment wird nur übertragen, wenn die Pumpe schneller dreht als die Turbine – ohne Schlupf keine Ölzirkulation und kein Moment. Vorteil: sanft, verschleißfrei, Momentenverstärkung. Nachteil: Schlupfverluste.
          </p>
          <p className="explain">
            <b>Mechanisch (überbrückt):</b> Die Reibkupplung verbindet Deckel und Turbine. Das Moment fließt ohne Schlupf, der Wandler wirkt nicht mehr als Strömungsmaschine. Vorteil: Wirkungsgrad, Verbrauch. Nachteil: keine Dämpfung durch das Öl (daher Torsionsdämpfer), keine Verstärkung.
          </p>
        </Section>
      </aside>
    </div>
  );
}

function Mini({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="mini">
      <span>{label}</span>
      <b style={color ? { color } : undefined}>
        {value}
        {unit && <small> {unit}</small>}
      </b>
    </div>
  );
}

/** Szenario aus anderen Ansichten (Lernmodus) setzen */
export function applyConverterScenario(id: string) {
  const s = SCENARIOS.find((x) => x.id === id);
  if (s) cv.target = { np: s.np, sr: s.sr, lockup: s.lockup };
}

/** 3D-Bühne des Wandlers inkl. Kennwertanzeige */
export function ConverterStage() {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 150);
    return () => clearInterval(t);
  }, []);
  const { st } = currentState();
  const locked = cv.lockup > 0.98;
  const sr = locked ? 1 : cv.sr;
  return (
    <div className="stage">
        <Canvas className="canvas3d" dpr={[1, 1.75]} camera={{ position: [2.6, 2.6, 6.4], fov: 40 }} gl={{ localClippingEnabled: true, antialias: true, alpha: true }} onPointerMissed={() => useStore.getState().select(null)}>
          <Lighting />
          <ConverterDriver />
          <MaterialController getSnapshot={getSnapshotForColors} />
          <ExplodeDriver />
          <Converter3D x={0} getState={getConvVisual} particles={1600} scaleParticles={1.1} />
          <Stubs />
          <LabelProjector defs={CONV_LABELS} />
          <Controls />
          <CameraRig presets={PRESETS} />
        </Canvas>
        <LabelLayer defs={CONV_LABELS} />
        <PanelToggles />
        <div className="hud-top">
          <div className="hud-gauges">
            <Mini label="Pumpe" value={fmt(cv.np)} unit="1/min" color="var(--c-input)" />
            <Mini label="Turbine" value={fmt(locked ? cv.np : cv.np * cv.sr)} unit="1/min" color="var(--c-driven)" />
            <Mini label="ν" value={fmt(sr, 2)} />
            <Mini label="μ" value={fmt(locked ? 1 : st.tr, 2)} />
            <Mini label="Leitrad" value={locked ? 'frei' : st.statorLocked ? 'gehalten' : 'frei'} color={!locked && st.statorLocked ? 'var(--c-held)' : undefined} />
          </div>
        </div>
        <div className="hud-bottom">
          <div className="legend">
            <span>
              <i style={{ background: '#ff5a4e' }} /> Öl im Pumpenrad
            </span>
            <span>
              <i style={{ background: '#ffa142' }} /> Öl im Turbinenrad
            </span>
            <span>
              <i style={{ background: '#58a6ff' }} /> Umlenkung am gehaltenen Leitrad
            </span>
            <span>
              <i style={{ background: '#d9dee5' }} /> Leitrad läuft frei
            </span>
          </div>
        </div>
      </div>
  );
}
