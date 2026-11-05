import { lazy, Suspense, useEffect } from 'react';
import { useStore, type ViewId } from './state/store';
import { MainView } from './views/MainView';

const ConverterView = lazy(() => import('./views/ConverterView').then((m) => ({ default: m.ConverterView })));
const PlanetaryLab = lazy(() => import('./views/PlanetaryLab').then((m) => ({ default: m.PlanetaryLab })));
const CompareView = lazy(() => import('./views/CompareView').then((m) => ({ default: m.CompareView })));
const LearnMode = lazy(() => import('./views/LearnMode').then((m) => ({ default: m.LearnMode })));

const TABS: { id: ViewId; label: string }[] = [
  { id: 'transmission', label: 'Getriebe' },
  { id: 'converter', label: 'Drehmomentwandler' },
  { id: 'planetary', label: 'Planetensatz verstehen' },
  { id: 'compare', label: 'Gangvergleich' },
  { id: 'learn', label: 'Lernmodus' },
];

export default function App() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      const st = useStore.getState();
      if (e.code === 'Space') {
        e.preventDefault();
        st.setRunning(!st.running);
      } else if (e.key === '.') st.stepFrame();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ⚙
          </span>
          <div>
            <h1>Automatikgetriebe 3D</h1>
            <span className="subtitle">Lehrmodell LM-4S · Wandler + Simpson-Radsatz + Overdrive</span>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={view === t.id ? 'active' : ''} onClick={() => setView(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        <Suspense fallback={<div className="loading">Lade Ansicht …</div>}>
          {view === 'transmission' && <MainView />}
          {view === 'converter' && <ConverterView />}
          {view === 'planetary' && <PlanetaryLab />}
          {view === 'compare' && <CompareView />}
          {view === 'learn' && <LearnMode />}
        </Suspense>
      </main>
    </div>
  );
}
