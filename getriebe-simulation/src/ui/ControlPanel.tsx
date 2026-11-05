/**
 * Linkes Bedienpanel: Simulationssteuerung, Betriebsart, Gangwahl, Darstellung, Kamera.
 */
import { GEAR_RATIOS } from '../sim/kinematics';
import { GEARS, type GearId } from '../sim/topology';
import { sim, useStore, type CameraPreset, type SectionMode } from '../state/store';
import { CAMERA_PRESETS } from '../three/Scene';
import { PARTS } from '../content/parts';
import { Section, Segmented, Slider, Toggle, fmt } from './common';

export function SimulationControls() {
  const running = useStore((s) => s.running);
  const timeScale = useStore((s) => s.timeScale);
  const st = useStore.getState();
  return (
    <Section title="Simulation">
      <div className="btn-row">
        <button className={`btn ${running ? '' : 'primary'}`} onClick={() => st.setRunning(!running)} title="Start / Pause (Leertaste)">
          {running ? '❚❚ Pause' : '▶ Start'}
        </button>
        <button className="btn" onClick={() => st.stepFrame()} title="Einzelbild vorwärts (1/60 s)">
          ⏭ Schritt
        </button>
        <button className="btn" onClick={() => st.resetSim()} title="Simulation zurücksetzen">
          ↺ Reset
        </button>
      </div>
      <div className="btn-row">
        <button className={`btn ${timeScale === 0.25 ? 'active' : ''}`} onClick={() => st.setTimeScale(timeScale === 0.25 ? 1 : 0.25)}>
          🐢 Zeitlupe
        </button>
        <button className={`btn ${timeScale === 1 ? 'active' : ''}`} onClick={() => st.setTimeScale(1)}>
          1×
        </button>
      </div>
      <Slider
        label="Animationsgeschwindigkeit"
        value={timeScale}
        min={0.1}
        max={3}
        step={0.05}
        onChange={(v) => st.setTimeScale(v)}
        format={(v) => `${fmt(v, 2)}×`}
        hint="Wirkt auf die gesamte Simulationszeit. Drehbewegungen werden zusätzlich 60-fach verlangsamt dargestellt."
      />
    </Section>
  );
}

export function OperatingControls() {
  const snap = useStore((s) => s.snapshot);
  const setSim = useStore((s) => s.setSim);
  const mode = snap.mode;
  const inputs = sim.inputs;
  return (
    <Section title="Betrieb">
      <Segmented
        value={mode}
        onChange={(m) => setSim({ mode: m })}
        options={[
          { value: 'drive', label: 'Fahrbetrieb', title: 'Fahrzeug mit Gaspedal, Bremse und automatischer Gangwahl' },
          { value: 'bench', label: 'Prüfstand', title: 'Motordrehzahl und Eingangsmoment direkt vorgeben, Gang frei wählen' },
        ]}
      />
      {mode === 'drive' ? (
        <>
          <Slider label="Gaspedal (Last)" value={inputs.throttle} min={0} max={1} step={0.01} onChange={(v) => setSim({ throttle: v })} format={(v) => `${fmt(v * 100)} %`} hint=">95 % = Kickdown" />
          <Slider label="Bremse" value={inputs.brake} min={0} max={1} step={0.01} onChange={(v) => setSim({ brake: v })} format={(v) => `${fmt(v * 100)} %`} />
          <div className="btn-row">
            <button className="btn" onClick={() => setSim({ throttle: 0, brake: 1 })}>
              Bremse halten
            </button>
            <button className="btn" onClick={() => setSim({ throttle: 0, brake: 0 })}>
              Pedale loslassen
            </button>
          </div>
          <Toggle label="Wandlerüberbrückung erlauben" checked={inputs.lockupAllowed} onChange={(v) => setSim({ lockupAllowed: v })} />
        </>
      ) : (
        <>
          <Slider label="Motordrehzahl" value={inputs.benchRpm} min={600} max={6000} step={10} onChange={(v) => setSim({ benchRpm: v })} format={(v) => `${fmt(v)} 1/min`} />
          <Slider label="Motormoment (Eingang)" value={inputs.benchTorque} min={0} max={300} step={5} onChange={(v) => setSim({ benchTorque: v })} format={(v) => `${fmt(v)} Nm`} />
          <Toggle
            label="Wandler überbrückt"
            checked={inputs.benchLockup}
            onChange={(v) => setSim({ benchLockup: v })}
            hint="Aus: Turbinendrehzahl ergibt sich aus der Wandlerkennlinie"
          />
          {snap.benchLimited && <p className="warn">Moment übersteigt die Aufnahme des Wandlers bei dieser Drehzahl – Festbremspunkt.</p>}
        </>
      )}
      <Toggle label="Schaltung schrittweise (Phasen anhalten)" checked={inputs.shiftStepMode} onChange={(v) => setSim({ shiftStepMode: v })} />
    </Section>
  );
}

export function GearSelector() {
  const snap = useStore((s) => s.snapshot);
  const setSim = useStore((s) => s.setSim);
  const inputs = sim.inputs;
  const shiftWaiting = snap.shift?.waiting;
  if (snap.mode === 'bench') {
    const gears: GearId[] = ['P', 'R', 'N', '1', '1M', '2', '3', '4'];
    return (
      <Section title="Gangwahl (Prüfstand)">
        <div className="gear-grid">
          {gears.map((g) => (
            <button
              key={g}
              className={`gear-btn ${inputs.benchGear === g ? 'active' : ''} ${snap.gear === g && !snap.shift ? 'engaged' : ''}`}
              onClick={() => setSim({ benchGear: g })}
              title={GEARS[g].title}
            >
              <b>{GEARS[g].label}</b>
              <small>{Number.isFinite(GEAR_RATIOS[g]) ? `i=${fmt(GEAR_RATIOS[g], 3)}` : GEARS[g].title}</small>
            </button>
          ))}
        </div>
        <ShiftStepButton waiting={!!shiftWaiting} />
      </Section>
    );
  }
  const sel = inputs.selector;
  return (
    <Section title="Wählhebel">
      <div className="selector">
        {(['P', 'R', 'N', 'D'] as const).map((s) => (
          <button key={s} className={`sel-btn ${sel === s ? 'active' : ''}`} onClick={() => setSim({ selector: s })}>
            {s}
          </button>
        ))}
      </div>
      <div className="hold-row">
        <span>Gang halten (manuell):</span>
        <Segmented
          small
          value={String(inputs.holdGear)}
          onChange={(v) => setSim({ holdGear: parseInt(v, 10), selector: 'D' })}
          options={[
            { value: '0', label: 'Auto' },
            { value: '1', label: '1', title: '1. Gang mit Motorbremse (B2)' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
            { value: '4', label: '4' },
          ]}
        />
      </div>
      <ShiftStepButton waiting={!!shiftWaiting} />
    </Section>
  );
}

function ShiftStepButton({ waiting }: { waiting: boolean }) {
  if (!waiting) return null;
  return (
    <button className="btn primary wide pulse" onClick={() => (sim.continueShift(), useStore.getState().refresh())}>
      Nächste Schaltphase ▶
    </button>
  );
}

export function ViewControls() {
  const s = useStore();
  return (
    <Section title="Darstellung">
      <Toggle label="Kraftfluss (Farben + Pfeile)" checked={s.showFlow} onChange={(v) => s.set({ showFlow: v })} />
      <Toggle label="Beschriftungen" checked={s.showLabels} onChange={(v) => s.set({ showLabels: v })} />
      <Toggle label="Ölströmung im Wandler" checked={s.showOil} onChange={(v) => s.set({ showOil: v })} />
      <Toggle label="Röntgenansicht" checked={s.xray} onChange={(v) => s.set({ xray: v })} />
      <div className="field">
        <span>Schnittansicht</span>
        <Segmented<SectionMode>
          small
          value={s.section}
          onChange={(v) => s.set({ section: v })}
          options={[
            { value: 'off', label: 'Aus' },
            { value: 'shells', label: 'Gehäuse & Trommeln' },
            { value: 'full', label: 'Vollschnitt' },
          ]}
        />
      </div>
      <Slider label="Gehäusetransparenz" value={1 - s.housingOpacity} min={0} max={1} step={0.01} onChange={(v) => s.set({ housingOpacity: 1 - v })} format={(v) => `${fmt(v * 100)} %`} />
      <Slider label="Explosionsansicht" value={s.explode} min={0} max={1} step={0.01} onChange={(v) => s.set({ explode: v })} format={(v) => `${fmt(v * 100)} %`} />
      <div className="btn-row">
        <button
          className="btn"
          onClick={() => {
            const open = s.explode <= 0.5;
            s.set({ explode: open ? 1 : 0 });
            s.requestCamera({ preset: open ? 'explode' : 'iso' });
          }}
        >
          {s.explode > 0.5 ? 'Zusammenbauen' : 'Explodieren'}
        </button>
      </div>
    </Section>
  );
}

export function CameraControls() {
  const selected = useStore((s) => s.selected);
  const isolate = useStore((s) => s.isolate);
  const st = useStore.getState();
  const presets: CameraPreset[] = ['iso', 'front', 'side', 'top', 'section', 'converter', 'clutches', 'gearsets', 'od', 'valvebody', 'tcu'];
  return (
    <Section title="Kamera & Bauteile">
      <p className="hint">Linke Maustaste: drehen · Rechte Maustaste / Shift: verschieben · Mausrad: zoomen · Klick auf Bauteil: Info</p>
      <div className="preset-grid">
        {presets.map((p) => (
          <button
            key={p}
            className="btn small"
            onClick={() => {
              if (p === 'section') st.set({ section: 'full' });
              st.requestCamera({ preset: p });
            }}
          >
            {CAMERA_PRESETS[p].label}
          </button>
        ))}
      </div>
      <div className="field">
        <span>Bauteil</span>
        <select value={selected ?? ''} onChange={(e) => st.select(e.target.value || null)}>
          <option value="">– auswählen –</option>
          {Object.entries(PARTS).map(([id, p]) => (
            <option key={id} value={id}>
              {p.group}: {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="btn-row">
        <button className="btn" disabled={!selected} onClick={() => selected && st.requestCamera({ focus: selected })}>
          ◎ Fokus
        </button>
        <button className={`btn ${isolate ? 'active' : ''}`} disabled={!selected} onClick={() => st.set({ isolate: !isolate })}>
          {isolate ? 'Alle zeigen' : 'Isolieren'}
        </button>
      </div>
    </Section>
  );
}
