import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { closeModal, dismissToast, useUi } from '../state/ui';

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger' | 'accent';
  icon?: string;
  small?: boolean;
};

export function Button({ variant = 'ghost', icon, small, className, children, ...rest }: BtnProps) {
  return (
    <button type="button" className={`btn btn-${variant}${small ? ' btn-sm' : ''}${className ? ' ' + className : ''}`} {...rest}>
      {icon ? <Icon name={icon} size={small ? 15 : 17} /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

/**
 * Zahlenfeld, das beim Tippen nicht eingreift: Zwischenstände wie „3“ (auf dem Weg zu „34“) oder ein
 * leeres Feld bleiben stehen. Gültige Werte werden sofort übernommen, beim Verlassen wird auf den
 * erlaubten Bereich begrenzt.
 */
export function NumberInput({ id, value, onCommit, min, max, step = 1, decimals = 0, label, suffix }: {
  id?: string; value: number; onCommit: (v: number) => void; min: number; max: number; step?: number; decimals?: number; label?: string; suffix?: string;
}) {
  const fmt = (v: number) => (decimals ? String(v).replace('.', ',') : String(Math.round(v)));
  const [draft, setDraft] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(fmt(value));
  }, [value]);
  const parse = (s: string) => {
    const n = Number(s.trim().replace(',', '.'));
    return s.trim() !== '' && Number.isFinite(n) ? n : null;
  };
  const clamp = (n: number) => {
    const f = 10 ** decimals;
    return Math.min(max, Math.max(min, Math.round(n * f) / f));
  };
  const commit = () => {
    focused.current = false;
    const n = parse(draft);
    const v = n === null ? value : clamp(n);
    setDraft(fmt(v));
    if (v !== value) onCommit(v);
  };
  return (
    <span className="num-input">
      <input
        id={id}
        type="text"
        inputMode={decimals ? 'decimal' : 'numeric'}
        aria-label={label}
        value={draft}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onChange={(e) => {
          const s = e.target.value.replace(/[^0-9.,-]/g, '');
          setDraft(s);
          const n = parse(s);
          if (n !== null && n >= min && n <= max && n !== value) onCommit(clamp(n));
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const base = parse(draft) ?? value;
            const v = clamp(base + (e.key === 'ArrowUp' ? step : -step));
            setDraft(fmt(v));
            onCommit(v);
          }
        }}
      />
      {suffix ? <span className="num-suffix">{suffix}</span> : null}
    </span>
  );
}

export function IconButton({ icon, label, className, active, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; active?: boolean }) {
  return (
    <button type="button" className={`icon-btn${active ? ' is-active' : ''}${className ? ' ' + className : ''}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={18} />
    </button>
  );
}

export function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button type="button" className={`chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onClick} title={title}>
      {on ? <Icon name="check" size={14} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function Switch({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="switch-row" htmlFor={id}>
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        {hint ? <span className="switch-hint">{hint}</span> : null}
      </span>
      <input id={id} type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, format, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`${label} verringern`} disabled={value <= min} onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}>
        <Icon name="minus" size={16} />
      </button>
      <output aria-live="polite">{format ? format(value) : value}</output>
      <button type="button" aria-label={`${label} erhöhen`} disabled={value >= max} onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; icon?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'is-on' : ''} onClick={() => onChange(o.id)}>
          {o.icon ? <Icon name={o.icon} size={15} /> : null}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Stars({ value, onRate, size = 18 }: { value: number; onRate?: (n: number) => void; size?: number }) {
  return (
    <div className={`stars${onRate ? ' is-input' : ''}`} role={onRate ? 'radiogroup' : 'img'} aria-label={onRate ? 'Bewertung' : `${value || 0} von 5 Sternen`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onRate ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} Stern${n > 1 ? 'e' : ''}`} onClick={() => onRate(n)} className={n <= value ? 'on' : ''}>
            <Icon name={n <= value ? 'starFill' : 'star'} size={size} />
          </button>
        ) : (
          <span key={n} className={n <= value ? 'on' : ''}>
            <Icon name={n <= value ? 'starFill' : 'star'} size={size} />
          </span>
        ),
      )}
    </div>
  );
}

export function Est({ children, title = 'Geschätzter Wert' }: { children: React.ReactNode; title?: string }) {
  return (
    <span className="est" title={title}>
      {children}
      <span className="est-mark" aria-label="geschätzt">geschätzt</span>
    </span>
  );
}

export function Modal({ title, children, footer, wide, onClose, labelledBy }: { title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean; onClose?: () => void; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = onClose ?? closeModal;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);
  const id = useRef(labelledBy ?? 'modal-title-' + Math.random().toString(36).slice(2, 7)).current;
  return (
    <div className="modal-layer" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={ref}>
        <header className="modal-head">
          <h2 id={id}>{title}</h2>
          <IconButton icon="x" label="Schließen" onClick={close} />
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useUi();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.text}</span>
          {t.undo ? (
            <button
              type="button"
              onClick={() => {
                t.undo!();
                dismissToast(t.id);
              }}
            >
              Rückgängig
            </button>
          ) : null}
          <button type="button" className="toast-x" aria-label="Hinweis schließen" onClick={() => dismissToast(t.id)}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon: string; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function Section({ title, aside, children, id }: { title: string; aside?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-head">
        <h2 id={id}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
