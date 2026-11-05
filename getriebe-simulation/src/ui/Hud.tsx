/**
 * Einblendungen über der 3D-Ansicht: Ganganzeige, Drehzahlmesser, Farblegende, Schaltfortschritt.
 */
import { GEARS } from '../sim/topology';
import { PHASE_LABEL } from '../sim/shift';
import { useStore } from '../state/store';
import { Legend, fmt } from './common';

export function HudOverlay({ compact = false }: { compact?: boolean }) {
  const snap = useStore((s) => s.snapshot);
  const running = useStore((s) => s.running);
  const timeScale = useStore((s) => s.timeScale);
  const sh = snap.shift;
  const sel = snap.mode === 'drive' ? snap.selector : 'Prüfstand';
  return (
    <>
      <div className="hud-top">
        <div className="hud-gear">
          <span className="hud-sel">{sel}</span>
          <span className="hud-g">{GEARS[snap.flowGear].label}</span>
        </div>
        <div className="hud-gauges">
          <Gauge label="Motor" value={snap.engineRpm} max={6500} unit="1/min" color="var(--c-input)" />
          <Gauge label="Turbine" value={snap.turbineRpm} max={6500} unit="1/min" color="var(--c-driven)" />
          <Gauge label="Abtrieb" value={Math.abs(snap.outputRpm)} max={6500} unit="1/min" color="var(--c-output)" />
          {!compact && <Gauge label="Fahrzeug" value={Math.abs(snap.vehicleKmh)} max={220} unit="km/h" color="#c9d4e2" />}
        </div>
        {!running && <div className="hud-paused">PAUSE</div>}
        {timeScale !== 1 && <div className="hud-speed">{fmt(timeScale, 2)}×</div>}
      </div>
      {sh && (
        <div className="hud-shift">
          <b>
            {GEARS[sh.from].label} → {GEARS[sh.to].label}
          </b>
          <span>{PHASE_LABEL[sh.phase]}</span>
          <span className="phase-bar">
            <span style={{ width: `${sh.progress * 100}%` }} />
          </span>
          {sh.waiting && <em>angehalten</em>}
        </div>
      )}
      <div className="hud-bottom">
        <Legend />
        {snap.coast && <span className="hud-note">Schubbetrieb: Moment fließt vom Rad zum Motor (Pfeile rückwärts)</span>}
        {snap.overrun && <span className="hud-note">Freilauf F1 überholt – keine Motorbremse</span>}
      </div>
    </>
  );
}

function Gauge({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const f = Math.max(0, Math.min(1, value / max));
  const r = 22;
  const c = 2 * Math.PI * r * 0.75;
  return (
    <div className="gauge">
      <svg viewBox="0 0 56 50" width="64" height="56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" strokeDasharray={`${c} 999`} transform="rotate(135 28 28)" strokeLinecap="round" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5" strokeDasharray={`${c * f} 999`} transform="rotate(135 28 28)" strokeLinecap="round" />
        <text x="28" y="31" textAnchor="middle" fontSize="10" fill="#e6edf5" fontWeight="600">
          {fmt(value)}
        </text>
      </svg>
      <span>
        {label} <small>{unit}</small>
      </span>
    </div>
  );
}

/** Ein-/Ausklappen der Seitenpanels (in jeder Ansicht) */
export function PanelToggles() {
  const panelOpen = useStore((s) => s.panelOpen);
  const set = useStore((s) => s.set);
  return (
    <>
      <button className="panel-toggle left" onClick={() => set({ panelOpen: { ...panelOpen, left: !panelOpen.left } })} title="Bedienpanel ein/aus" aria-label="Bedienpanel ein- oder ausblenden">
        {panelOpen.left ? '◀' : '▶'}
      </button>
      <button className="panel-toggle right" onClick={() => set({ panelOpen: { ...panelOpen, right: !panelOpen.right } })} title="Infopanel ein/aus" aria-label="Infopanel ein- oder ausblenden">
        {panelOpen.right ? '▶' : '◀'}
      </button>
    </>
  );
}

export function usePanelClass(side: 'left' | 'right') {
  const open = useStore((s) => s.panelOpen[side]);
  return `panel ${side} ${open ? '' : 'collapsed'}`;
}
