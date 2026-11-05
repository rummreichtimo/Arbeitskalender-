import { useState, type ReactNode } from 'react';

export const fmt = (v: number, digits = 0) =>
  Number.isFinite(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '–';

export function Section({ title, children, defaultOpen = true, right }: { title: string; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`section ${open ? 'open' : ''}`}>
      <header onClick={() => setOpen(!open)}>
        <span className="chev">{open ? '▾' : '▸'}</span>
        <h3>{title}</h3>
        {right && <span className="section-right" onClick={(e) => e.stopPropagation()}>{right}</span>}
      </header>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}) {
  return (
    <label className="slider">
      <span className="slider-head">
        <span>{label}</span>
        <b>{format ? format(value) : value}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="toggle" title={hint}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track">
        <span className="thumb" />
      </span>
      <span>{label}</span>
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  small,
}: {
  options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div className={`segmented ${small ? 'small' : ''}`}>
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)} title={o.title} disabled={o.disabled}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
        {unit && <small> {unit}</small>}
      </span>
    </div>
  );
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const f = Math.max(0, Math.min(1, Math.abs(value) / max));
  return (
    <span className="bar">
      <span style={{ width: `${f * 100}%`, background: color }} />
    </span>
  );
}

export function Legend() {
  const items: [string, string][] = [
    ['var(--c-input)', 'Eingang (Motor)'],
    ['var(--c-driven)', 'angetrieben'],
    ['var(--c-held)', 'festgehalten'],
    ['var(--c-output)', 'zum Abtrieb'],
    ['var(--c-idle)', 'inaktiv'],
    ['var(--c-slip)', 'Schlupf'],
  ];
  return (
    <div className="legend">
      {items.map(([c, t]) => (
        <span key={t}>
          <i style={{ background: c }} />
          {t}
        </span>
      ))}
    </div>
  );
}
