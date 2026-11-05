/**
 * Rechtes Panel: Ganginformation, Schaltelemente, Live-Daten, Schaltablauf, Bauteilinfo, TCU.
 */
import { useState } from 'react';
import { PARTS } from '../content/parts';
import { PHASE_LABEL, PHASE_TEXT } from '../sim/shift';
import type { SimSnapshot } from '../sim/simulation';
import { ELEMENTS, ELEMENT_IDS, GEARS, MEMBERS, MEMBER_IDS, ROLE_LABEL, type ElementId, type MemberId, type Role } from '../sim/topology';
import { useStore } from '../state/store';
import { Bar, Section, Stat, fmt } from './common';
import { ShiftMapChart } from './ShiftMap';

export const ROLE_CSS: Record<Role, string> = {
  input: 'var(--c-input)',
  driven: 'var(--c-driven)',
  held: 'var(--c-held)',
  output: 'var(--c-output)',
  idle: 'var(--c-idle)',
};

const STATE_CLASS: Record<string, string> = {
  geschlossen: 'on',
  sperrt: 'held',
  gesperrt: 'held',
  offen: 'off',
  frei: 'off',
  überholt: 'off',
  füllt: 'fill',
  übernimmt: 'slip',
  löst: 'slip',
  schlupft: 'slip',
};

export function elementStateLabel(state: string, id: ElementId): string {
  if (id === 'F1') {
    if (state === 'sperrt') return 'sperrt';
    if (state === 'gesperrt') return 'gesperrt (B2)';
    if (state === 'überholt') return 'überholt';
    return 'frei';
  }
  return state;
}

export function directionText(snap: SimSnapshot): string {
  if (snap.flowGear === 'P') return 'gesperrt (Parksperre)';
  if (snap.flowGear === 'N') return 'frei (kein Kraftschluss)';
  if (Math.abs(snap.outputRpm) < 1) return snap.flowGear === 'R' ? 'rückwärts (steht)' : 'vorwärts (steht)';
  return snap.outputRpm > 0 ? 'vorwärts (wie Motor)' : 'rückwärts (entgegen Motor)';
}

export function GearInfo() {
  const snap = useStore((s) => s.snapshot);
  const [deep, setDeep] = useState(false);
  const g = GEARS[snap.flowGear];
  const roles = snap.roles;
  const list = (r: Role) =>
    MEMBER_IDS.filter((m) => roles[m] === r)
      .map((m) => MEMBERS[m].short)
      .concat(r === 'driven' ? (['P_PF', 'P_PR', 'P_PO'] as const).filter((k) => roles[k] === 'driven').map((k) => `Planeten ${k === 'P_PF' ? 'v.' : k === 'P_PR' ? 'h.' : 'OD'}`) : [])
      .join(', ') || '–';
  const ratioShown = snap.gearRatio;
  return (
    <Section title="Aktueller Gang">
      <div className="gear-head">
        <div className={`gear-big ${snap.shift ? 'shifting' : ''}`}>{g.label}</div>
        <div>
          <div className="gear-title">{g.title}</div>
          <div className="gear-formula">{g.formula}</div>
          {snap.shift && (
            <div className="gear-shift">
              Schaltung {GEARS[snap.shift.from].label} → {GEARS[snap.shift.to].label}
            </div>
          )}
        </div>
      </div>
      <div className="stats">
        <Stat label="Übersetzung i" value={Number.isFinite(ratioShown) ? fmt(ratioShown, 3) : '–'} />
        <Stat label="n Eingang" value={fmt(snap.turbineRpm)} unit="1/min" accent="var(--c-input)" />
        <Stat label="n Ausgang" value={fmt(snap.outputRpm)} unit="1/min" accent="var(--c-output)" />
        <Stat label="Drehrichtung Abtrieb" value={directionText(snap)} />
      </div>
      <div className="chips">
        <span className="chips-label">Geschlossen:</span>
        {g.elements.map((e) => (
          <span key={e} className={`chip ${ELEMENTS[e].b ? 'clutch' : 'brake'}`} title={ELEMENTS[e].name}>
            {e}
          </span>
        ))}
        {g.parkLock && <span className="chip brake">Parksperre</span>}
      </div>
      <dl className="roles">
        <dt style={{ color: ROLE_CSS.driven }}>Angetrieben</dt>
        <dd>{list('driven')}</dd>
        <dt style={{ color: ROLE_CSS.held }}>Festgehalten</dt>
        <dd>{list('held')}</dd>
        <dt style={{ color: ROLE_CSS.output }}>Zum Abtrieb</dt>
        <dd>{list('output')}</dd>
        <dt style={{ color: ROLE_CSS.idle }}>Lastfrei</dt>
        <dd>{list('idle')}</dd>
      </dl>
      <p className="explain">{g.simple}</p>
      <button className="link" onClick={() => setDeep(!deep)}>
        {deep ? '▾ Technische Vertiefung ausblenden' : '▸ Technische Vertiefung'}
      </button>
      {deep && <p className="explain tech">{g.technical}</p>}
    </Section>
  );
}

export function ElementTable() {
  const snap = useStore((s) => s.snapshot);
  const select = useStore((s) => s.select);
  const pl = Math.max(1, snap.hydraulics.linePressure);
  return (
    <Section title="Kupplungen, Bremsen, Freilauf">
      <table className="el-table">
        <thead>
          <tr>
            <th>Element</th>
            <th>Zustand</th>
            <th title="übertragenes bzw. abgestütztes Moment">Moment</th>
            <th title="Differenzdrehzahl">Δn</th>
            <th>Druck</th>
          </tr>
        </thead>
        <tbody>
          {ELEMENT_IDS.map((id) => {
            const e = snap.elements[id];
            return (
              <tr key={id} onClick={() => select(id.toLowerCase())} title={ELEMENTS[id].function}>
                <td>
                  <b>{id}</b> <small>{ELEMENTS[id].kind === 'kupplung' ? 'Kuppl.' : ELEMENTS[id].kind === 'freilauf' ? 'Freilauf' : ELEMENTS[id].kind === 'bremsband' ? 'Band' : 'Bremse'}</small>
                </td>
                <td>
                  <span className={`state ${STATE_CLASS[e.state] ?? 'off'}`}>{elementStateLabel(e.state, id)}</span>
                </td>
                <td className="num">{Math.abs(e.torque) > 0.5 ? `${fmt(Math.abs(e.torque))} Nm` : '–'}</td>
                <td className="num">{Math.abs(e.slip) > 0.5 ? fmt(e.slip) : '0'}</td>
                <td>{id === 'F1' ? <small>mech.</small> : <Bar value={e.pressure} max={pl} color="var(--c-hyd)" />}</td>
              </tr>
            );
          })}
          <tr onClick={() => select('ueberbrueckungskupplung')}>
            <td>
              <b>WK</b> <small>Überbr.</small>
            </td>
            <td>
              <span className={`state ${snap.converter.lockup === 'geschlossen' ? 'on' : snap.converter.lockup === 'schlupft' ? 'slip' : 'off'}`}>{snap.converter.lockup}</span>
            </td>
            <td className="num">{snap.converter.lockup !== 'offen' ? `${fmt(snap.engineTorque)} Nm` : '–'}</td>
            <td className="num">{fmt(snap.engineRpm - snap.turbineRpm)}</td>
            <td>
              <Bar value={snap.hydraulics.elements.WK.pressure} max={pl} color="var(--c-hyd)" />
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

export function LiveData() {
  const snap = useStore((s) => s.snapshot);
  const c = snap.converter;
  const sol = snap.hydraulics.solenoids;
  return (
    <Section title="Live-Daten">
      <div className="stats">
        <Stat label="Motor" value={fmt(snap.engineRpm)} unit="1/min" accent="var(--c-input)" />
        <Stat label="Turbine" value={fmt(snap.turbineRpm)} unit="1/min" />
        <Stat label="Abtrieb" value={fmt(snap.outputRpm)} unit="1/min" accent="var(--c-output)" />
        <Stat label="Geschwindigkeit" value={fmt(snap.vehicleKmh, 1)} unit="km/h" />
        <Stat label="Motormoment" value={fmt(snap.engineTorque)} unit="Nm" />
        <Stat label="Turbinenmoment" value={fmt(snap.turbineTorque)} unit="Nm" />
        <Stat label="Abtriebsmoment" value={fmt(snap.outputTorque)} unit="Nm" />
        <Stat label="Radmoment (×3,7)" value={fmt(snap.wheelTorque)} unit="Nm" />
        <Stat label="Wandler ν = nT/nP" value={fmt(Math.min(c.sr, 9.99), 2)} />
        <Stat label="Wandlung μ" value={fmt(c.tr, 2)} />
        <Stat label="Wirkungsgrad η" value={`${fmt(Math.min(1, c.efficiency) * 100)} %`} />
        <Stat label="Wandlerbereich" value={c.regime} />
        <Stat label="Systemdruck" value={fmt(snap.hydraulics.linePressure, 1)} unit="bar" accent="var(--c-hyd)" />
        <Stat label="Magnetventile" value={`MV1 ${sol.MV1 ? 'an' : 'aus'} · MV2 ${sol.MV2 ? 'an' : 'aus'}`} />
      </div>
      <p className="hint">Momente: idealisiert (verlustfrei) aus dem Kräftegleichgewicht der Planetensätze berechnet. Wandler- und Fahrzeugwerte: vereinfachtes Modell.</p>
    </Section>
  );
}

export function MemberTable() {
  const snap = useStore((s) => s.snapshot);
  const select = useStore((s) => s.select);
  const partFor: Record<MemberId, string> = {
    IN: 'eingangswelle',
    S: 'sonnenrad',
    RF: 'hohlrad-vorne',
    M: 'zwischenwelle',
    CR: 'traeger-hinten',
    SO: 'od-sonnenrad',
    OUT: 'ausgangswelle',
  };
  return (
    <Section title="Drehzahlen aller Glieder" defaultOpen={false}>
      <table className="el-table">
        <thead>
          <tr>
            <th>Glied</th>
            <th>n [1/min]</th>
            <th>Moment</th>
          </tr>
        </thead>
        <tbody>
          {MEMBER_IDS.map((m) => (
            <tr key={m} onClick={() => select(partFor[m])}>
              <td>
                <i className="dot" style={{ background: ROLE_CSS[snap.roles[m]] }} /> {MEMBERS[m].short}
              </td>
              <td className="num">{fmt(snap.members[m].rpm)}</td>
              <td className="num">{snap.members[m].load > 0.5 ? `${fmt(snap.members[m].load)} Nm` : '–'}</td>
            </tr>
          ))}
          {(['PF', 'PR', 'PO'] as const).map((k) => (
            <tr key={k}>
              <td>
                <i className="dot" style={{ background: ROLE_CSS[snap.roles[`P_${k}`]] }} /> Planeten {k === 'PF' ? 'vorne' : k === 'PR' ? 'hinten' : 'OD'}
              </td>
              <td className="num" title="Drehzahl relativ zum Träger (Abwälzen)">
                {fmt(snap.planets[k].rel)} <small>rel.</small>
              </td>
              <td className="num">{Math.abs(snap.planets[k].force) > 1e-3 ? 'trägt' : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

export function ShiftPanel() {
  const snap = useStore((s) => s.snapshot);
  const sh = snap.shift;
  if (!sh) return null;
  const kindText: Record<string, string> = { hoch: 'Hochschaltung', runter: 'Rückschaltung', einlegen: 'Fahrstufe einlegen', auslegen: 'Fahrstufe auslegen', wechsel: 'Wechsel' };
  return (
    <Section title={`${kindText[sh.kind]} ${GEARS[sh.from].label} → ${GEARS[sh.to].label}`}>
      <div className="phases">
        {sh.phases.map((p, i) => (
          <div key={p + i} className={`phase ${i < sh.phaseIndex ? 'done' : i === sh.phaseIndex ? 'active' : ''}`}>
            <span>{PHASE_LABEL[p]}</span>
            <span className="phase-bar">
              <span style={{ width: `${i < sh.phaseIndex ? 100 : i === sh.phaseIndex ? sh.phaseProgress * 100 : 0}%` }} />
            </span>
          </div>
        ))}
      </div>
      <p className="explain">{PHASE_TEXT[sh.phase]}</p>
      <p className="hint">
        {sh.oncoming.length > 0 && <>Zuschaltend: <b>{sh.oncoming.join(', ')}</b>. </>}
        {sh.offgoing.length > 0 && <>Abschaltend: <b>{sh.offgoing.join(', ')}</b>. </>}
        {sh.freewheel && <>Freilaufschaltung: F1 gibt automatisch frei, sobald B1 das Moment übernimmt.</>}
      </p>
      {sh.waiting && <p className="warn">Schrittmodus: Phase abgeschlossen – „Nächste Schaltphase“ drücken.</p>}
    </Section>
  );
}

export function PartInfo() {
  const selected = useStore((s) => s.selected);
  const snap = useStore((s) => s.snapshot);
  const select = useStore((s) => s.select);
  const requestCamera = useStore((s) => s.requestCamera);
  if (!selected) return null;
  const p = PARTS[selected];
  if (!p) return null;
  let live: { label: string; value: string }[] = [];
  let role: Role | null = null;
  if (p.member === 'ENG') live = [{ label: 'Drehzahl', value: `${fmt(snap.engineRpm)} 1/min` }, { label: 'Moment', value: `${fmt(snap.engineTorque)} Nm` }];
  else if (p.member === 'STATOR')
    live = [
      { label: 'Leitrad', value: snap.converter.statorLocked && snap.converter.lockup !== 'geschlossen' ? 'gehalten (Freilauf sperrt)' : 'läuft frei mit' },
      { label: 'Drehzahl', value: `${fmt(snap.statorRpm)} 1/min` },
    ];
  else if (p.member) {
    live = [
      { label: 'Drehzahl', value: `${fmt(snap.members[p.member].rpm)} 1/min` },
      { label: 'Übertragenes Moment', value: snap.members[p.member].load > 0.5 ? `${fmt(snap.members[p.member].load)} Nm` : 'keins' },
    ];
  }
  if (p.roleKey) role = snap.roles[p.roleKey];
  if (p.element) {
    const e = snap.elements[p.element];
    live = [
      { label: 'Zustand', value: elementStateLabel(e.state, p.element) },
      { label: 'Moment', value: Math.abs(e.torque) > 0.5 ? `${fmt(Math.abs(e.torque))} Nm` : '–' },
      { label: 'Differenzdrehzahl', value: `${fmt(e.slip)} 1/min` },
      ...(p.element !== 'F1' ? [{ label: 'Kolbendruck', value: `${fmt(e.pressure, 1)} bar` }] : []),
    ];
  }
  return (
    <Section title="Bauteilinformation" right={<button className="link" onClick={() => select(null)}>✕</button>}>
      <div className="part-name">{p.name}</div>
      <div className="part-group">{p.group}</div>
      {role && (
        <div className="part-role" style={{ borderColor: ROLE_CSS[role] }}>
          <i className="dot" style={{ background: ROLE_CSS[role] }} /> Im aktuellen Gang: {ROLE_LABEL[role]}
        </div>
      )}
      <h4>Funktion</h4>
      <p>{p.function}</p>
      <h4>Bedeutung für die Kraftübertragung</h4>
      <p>{p.significance}</p>
      {live.length > 0 && (
        <div className="stats">
          {live.map((l) => (
            <Stat key={l.label} label={l.label} value={l.value} />
          ))}
        </div>
      )}
      {p.note && <p className="hint">Hinweis: {p.note}</p>}
      <div className="btn-row">
        <button className="btn small" onClick={() => requestCamera({ focus: selected })}>
          ◎ Fokus
        </button>
        <button className="btn small" onClick={() => useStore.getState().set({ isolate: !useStore.getState().isolate })}>
          Isolieren an/aus
        </button>
      </div>
    </Section>
  );
}

export function TcuPanel() {
  const snap = useStore((s) => s.snapshot);
  return (
    <Section title="Getriebesteuerung (TCU)" defaultOpen={false}>
      <p className="explain">{snap.tcuReason || '–'}</p>
      {snap.mode === 'drive' && <ShiftMapChart />}
      <ul className="log">
        {snap.messages.map((m, i) => (
          <li key={i}>
            <span>{fmt(m.t, 1)} s</span> {m.text}
          </li>
        ))}
      </ul>
    </Section>
  );
}
