import React, { useEffect } from 'react';
import { useApp, useSyncStatus, connectCloud, isFirstRun, isSoft, onRemoteApplied, type SyncStatus } from './state/store';
import { useUi } from './state/ui';
import { useHashView } from './state/hooks';
import { ensureWeek, currentWeekStart, replanSoft, updateUi } from './state/actions';
import { Icon } from './ui/Icon';
import { Toasts } from './ui/Controls';
import { Dashboard } from './views/Dashboard';
import { PlanView } from './views/PlanView';
import { RecipesView } from './views/RecipesView';
import { ShoppingView } from './views/ShoppingView';
import { PantryView } from './views/PantryView';
import { ProfileView } from './views/ProfileView';
import { ModalRoot } from './views/Modals';
import type { ThemeChoice } from './lib/types';

export const VIEWS = ['start', 'plan', 'rezepte', 'einkauf', 'vorrat', 'profil'] as const;
export type View = (typeof VIEWS)[number];

const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'start', label: 'Übersicht', icon: 'home' },
  { id: 'plan', label: 'Wochenplan', icon: 'calendar' },
  { id: 'rezepte', label: 'Rezepte', icon: 'book' },
  { id: 'einkauf', label: 'Einkauf', icon: 'cart' },
  { id: 'vorrat', label: 'Vorrat', icon: 'box' },
  { id: 'profil', label: 'Profil', icon: 'user' },
];

const hostTheme = document.documentElement.getAttribute('data-theme');

function applyTheme(t: ThemeChoice) {
  const root = document.documentElement;
  if (t === 'system') {
    if (hostTheme) root.setAttribute('data-theme', hostTheme);
    else root.removeAttribute('data-theme');
  } else root.setAttribute('data-theme', t);
}

const SYNC_TEXT: Record<SyncStatus, { icon: string; text: string }> = {
  lokal: { icon: 'cloudOff', text: 'Auf diesem Gerät gespeichert' },
  verbinde: { icon: 'cloud', text: 'Verbinde mit deinem Konto …' },
  synchron: { icon: 'cloud', text: 'Im Konto gespeichert' },
  speichert: { icon: 'cloud', text: 'Speichert …' },
  'verzögert': { icon: 'cloudOff', text: 'Konto antwortet nicht – lokal gesichert' },
  fehler: { icon: 'alert', text: 'Konto-Speicher fehlgeschlagen – lokal gesichert' },
};

export function SyncBadge() {
  const st = useSyncStatus();
  const t = SYNC_TEXT[st];
  return (
    <span className={`sync sync-${st === 'verzögert' ? 'warn' : st}`} title={t.text}>
      <Icon name={t.icon} size={15} />
      <span>{t.text}</span>
    </span>
  );
}

const THEME_NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_ICON: Record<ThemeChoice, string> = { system: 'monitor', light: 'sun', dark: 'moon' };
const THEME_LABEL: Record<ThemeChoice, string> = { system: 'Design: System', light: 'Design: Hell', dark: 'Design: Dunkel' };

export function App() {
  const s = useApp();
  const ui = useUi();
  const [view, go] = useHashView(VIEWS, 'start');

  useEffect(() => {
    ensureWeek(currentWeekStart(), isFirstRun());
    // Kommt das Profil aus dem Konto, der Plan aber nicht, wird der automatische Beispielplan neu berechnet.
    const off = onRemoteApplied((slices) => {
      if (slices.includes('profile') && !slices.includes('plans') && isSoft('plans')) replanSoft(currentWeekStart());
    });
    connectCloud();
    return () => {
      off();
    };
  }, []);

  useEffect(() => applyTheme(s.ui.theme), [s.ui.theme]);

  useEffect(() => {
    document.body.classList.toggle('has-modal', ui.modals.length > 0);
  }, [ui.modals.length]);

  const theme = s.ui.theme;
  return (
    <div className="app" lang="de">
      <aside className="rail" aria-label="Hauptnavigation">
        <div className="brand">
          <BrandMark />
          <div>
            <strong>Wochentisch</strong>
            <span>Ernährungsplaner</span>
          </div>
        </div>
        <nav className="rail-nav">
          {NAV.map((n) => (
            <a key={n.id} href={'#' + n.id} className={view === n.id ? 'is-active' : ''} aria-current={view === n.id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go(n.id); }}>
              <Icon name={n.icon} size={19} />
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="rail-foot">
          <button type="button" className="theme-btn" onClick={() => updateUi({ theme: THEME_NEXT[theme] })} aria-label={`${THEME_LABEL[theme]} – wechseln`}>
            <Icon name={THEME_ICON[theme]} size={16} />
            <span>{THEME_LABEL[theme]}</span>
          </button>
          <SyncBadge />
        </div>
      </aside>

      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <strong>Wochentisch</strong>
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-btn" onClick={() => updateUi({ theme: THEME_NEXT[theme] })} aria-label={`${THEME_LABEL[theme]} – wechseln`} title={THEME_LABEL[theme]}>
            <Icon name={THEME_ICON[theme]} size={18} />
          </button>
        </div>
      </header>

      <main className="main" id="inhalt">
        {view === 'start' && <Dashboard go={go} />}
        {view === 'plan' && <PlanView go={go} />}
        {view === 'rezepte' && <RecipesView />}
        {view === 'einkauf' && <ShoppingView go={go} />}
        {view === 'vorrat' && <PantryView go={go} />}
        {view === 'profil' && <ProfileView />}
      </main>

      <nav className="tabbar" aria-label="Hauptnavigation">
        {NAV.map((n) => (
          <a key={n.id} href={'#' + n.id} className={view === n.id ? 'is-active' : ''} aria-current={view === n.id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go(n.id); }}>
            <Icon name={n.icon} size={20} />
            <span>{n.id === 'plan' ? 'Plan' : n.label}</span>
          </a>
        ))}
      </nav>

      <ModalRoot />
      <Toasts />
    </div>
  );
}

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="var(--primary)" />
      <circle cx="20" cy="20" r="12.5" fill="var(--surface)" />
      <circle cx="20" cy="20" r="8.5" fill="none" stroke="var(--line)" strokeWidth="1" />
      <path d="M14.5 21.5q2.5-6 5.5-6t5.5 6" fill="var(--accent)" />
      <circle cx="17" cy="23.5" r="1.6" fill="var(--primary)" />
      <circle cx="22.5" cy="24" r="1.3" fill="var(--primary)" />
    </svg>
  );
}
