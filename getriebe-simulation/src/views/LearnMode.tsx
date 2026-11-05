/**
 * Geführter Lernmodus mit 8 Kapiteln. Jedes Kapitel steuert eine passende Szene
 * (Getriebe, Wandler oder Planetensatz) und bietet interaktive Aktionen.
 */
import { useEffect, useState } from 'react';
import { CHAPTERS, type ChapterAction } from '../content/chapters';
import { GEARS } from '../sim/topology';
import { sim, useStore, type CameraPreset } from '../state/store';
import { LabelLayer } from '../three/Scene';
import { Section, Stat, fmt } from '../ui/common';
import { HudOverlay, PanelToggles, usePanelClass } from '../ui/Hud';
import { ElementTable, GearInfo, ShiftPanel } from '../ui/InfoPanel';
import { ShiftMapChart } from '../ui/ShiftMap';
import { ConverterStage, applyConverterScenario } from './ConverterView';
import { TransmissionCanvas } from './MainView';
import { LabResults, PlanetaryStage, useLab } from './PlanetaryLab';

function runAction(a: ChapterAction) {
  const st = useStore.getState();
  switch (a.kind) {
    case 'drive': {
      if (sim.inputs.mode !== 'drive') st.setSim({ mode: 'drive' });
      const p: Parameters<typeof st.setSim>[0] = {};
      if (a.selector) p.selector = a.selector;
      if (a.throttle !== undefined) p.throttle = a.throttle;
      if (a.brake !== undefined) p.brake = a.brake;
      if (a.hold !== undefined) p.holdGear = a.hold;
      st.setSim(p);
      st.setRunning(true);
      break;
    }
    case 'bench': {
      if (sim.inputs.mode !== 'bench') st.setSim({ mode: 'bench' });
      const p: Parameters<typeof st.setSim>[0] = { benchGear: a.gear };
      if (a.rpm !== undefined) p.benchRpm = a.rpm;
      if (a.lockup !== undefined) p.benchLockup = a.lockup;
      if (a.step !== undefined) p.shiftStepMode = a.step;
      st.setSim(p);
      st.setRunning(true);
      break;
    }
    case 'converter':
      applyConverterScenario(a.scenario);
      break;
    case 'planetary':
      useLab.getState().set({ input: a.input, fixed: a.fixed, output: a.output });
      break;
    case 'camera':
      st.requestCamera({ preset: a.preset as CameraPreset });
      break;
    case 'focus':
      st.set({ selected: a.part, isolate: !!a.isolate });
      if (a.isolate) st.requestCamera({ focus: a.part });
      break;
    case 'explode':
      st.set({ explode: a.value });
      st.requestCamera({ preset: a.value > 0.5 ? 'explode' : 'iso' });
      break;
    case 'continueShift':
      sim.continueShift();
      st.refresh();
      break;
    case 'speed':
      st.setTimeScale(a.value);
      break;
  }
}

export function LearnMode() {
  const [idx, setIdx] = useState(0);
  const [deep, setDeep] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const ch = CHAPTERS[idx];
  const set = useStore((s) => s.set);
  const snap = useStore((s) => s.snapshot);

  useEffect(() => {
    set({ highlight: ch.highlight ?? [], selected: null, isolate: false, explode: 0, section: 'shells', showFlow: true });
    // kurze Verzögerung, damit die neue Szene montiert ist (Kamera-Rig)
    const t = setTimeout(() => ch.start.forEach(runAction), 80);
    setDeep(false);
    return () => clearTimeout(t);
  }, [idx, ch, set]);

  useEffect(() => () => set({ highlight: [], isolate: false, explode: 0 }), [set]);

  const go = (i: number) => {
    setDone((d) => new Set(d).add(idx));
    setIdx(Math.max(0, Math.min(CHAPTERS.length - 1, i)));
  };

  const stage =
    ch.scene === 'converter' ? (
      <ConverterStage />
    ) : ch.scene === 'planetary' ? (
      <PlanetaryStage />
    ) : (
      <div className="stage">
        <TransmissionCanvas />
        <LabelLayer />
        <HudOverlay compact />
        <PanelToggles />
      </div>
    );

  return (
    <div className="view-main learn">
      <aside className={`${usePanelClass('left')} chapters`}>
        <div className="learn-progress">
          Kapitel {idx + 1} von {CHAPTERS.length}
          <span className="phase-bar">
            <span style={{ width: `${((idx + 1) / CHAPTERS.length) * 100}%`, background: 'var(--accent)' }} />
          </span>
        </div>
        {CHAPTERS.map((c, i) => (
          <button key={c.id} className={`chapter-btn ${i === idx ? 'active' : ''} ${done.has(i) ? 'done' : ''}`} onClick={() => go(i)}>
            <span className="chapter-no">{done.has(i) && i !== idx ? '✓' : c.id}</span>
            <span>
              <b>{c.title}</b>
              <small>{c.question}</small>
            </span>
          </button>
        ))}
      </aside>
      {stage}
      <aside className={`${usePanelClass('right')} learn-content`}>
        <div className="chapter-head">
          <span className="chapter-kicker">Kapitel {ch.id}</span>
          <h2>{ch.title}</h2>
          <p className="chapter-question">{ch.question}</p>
        </div>
        <Section title="Einfach erklärt">
          {ch.simple.map((t) => (
            <p key={t} className="explain">
              {t}
            </p>
          ))}
        </Section>
        <Section title="Probier es aus">
          <div className="action-grid">
            {ch.actions.map((a) => (
              <button key={a.label} className={`btn small ${a.kind === 'continueShift' ? (snap.shift?.waiting ? 'primary pulse' : '') : ''}`} onClick={() => runAction(a)} disabled={a.kind === 'continueShift' && !snap.shift?.waiting}>
                {a.label}
              </button>
            ))}
          </div>
          {(ch.scene === 'transmission' || ch.scene === 'shiftmap') && (
            <div className="stats">
              <Stat label="Gang" value={GEARS[snap.flowGear].label} />
              <Stat label="Übersetzung" value={Number.isFinite(snap.gearRatio) ? fmt(snap.gearRatio, 3) : '–'} />
              <Stat label="n Motor" value={fmt(snap.engineRpm)} unit="1/min" accent="var(--c-input)" />
              <Stat label="n Abtrieb" value={fmt(snap.outputRpm)} unit="1/min" accent="var(--c-output)" />
              <Stat label="M Eingang" value={fmt(snap.turbineTorque)} unit="Nm" />
              <Stat label="M Abtrieb" value={fmt(snap.outputTorque)} unit="Nm" />
              {snap.mode === 'drive' && <Stat label="Geschwindigkeit" value={fmt(snap.vehicleKmh, 1)} unit="km/h" />}
              {snap.mode === 'drive' && <Stat label="Wandler" value={snap.converter.lockup === 'geschlossen' ? 'überbrückt' : snap.converter.regime} />}
            </div>
          )}
        </Section>
        {ch.scene === 'shiftmap' && (
          <Section title="Schaltkennfeld live">
            <ShiftMapChart />
            <p className="hint">{snap.tcuReason}</p>
          </Section>
        )}
        {(ch.id === 6 || ch.id === 5) && <ShiftPanel />}
        {ch.id === 5 && <ElementTable />}
        {(ch.id === 4 || ch.id === 7) && <GearInfo />}
        {ch.scene === 'planetary' && <LabResults />}
        <Section title="Merke">
          <ul className="keypoints">
            {ch.keyPoints.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </Section>
        <button className="link deep-toggle" onClick={() => setDeep(!deep)}>
          {deep ? '▾ Technische Vertiefung ausblenden' : '▸ Technische Vertiefung anzeigen'}
        </button>
        {deep && (
          <Section title="Technische Vertiefung">
            {ch.technical.map((t) => (
              <p key={t} className="explain tech">
                {t}
              </p>
            ))}
          </Section>
        )}
        <div className="btn-row chapter-nav">
          <button className="btn" disabled={idx === 0} onClick={() => go(idx - 1)}>
            ◀ Zurück
          </button>
          <button className="btn primary" disabled={idx === CHAPTERS.length - 1} onClick={() => go(idx + 1)}>
            Weiter ▶
          </button>
        </div>
      </aside>
    </div>
  );
}
