/**
 * Schaltkennfeld der TCU mit aktuellem Betriebspunkt.
 * Farbe = Gangpaar (Kategorien in fester Reihenfolge), Strichart = Hoch-/Rückschaltung.
 */
import { SHIFT_MAP } from '../sim/tcu';
import { useStore } from '../state/store';
import { GEARS } from '../sim/topology';
import { LineChart, type ChartSeries } from './LineChart';
import { fmt } from './common';

const PAIR_COLORS = ['#3987e5', '#d95926', '#199e70'];

export function ShiftMapChart() {
  const snap = useStore((s) => s.snapshot);
  const series: ChartSeries[] = [];
  ([1, 2, 3] as const).forEach((g, i) => {
    series.push({
      id: `up${g}`,
      label: `${g}→${g + 1} hoch`,
      color: PAIR_COLORS[i],
      points: SHIFT_MAP.up[g].map(([th, v]) => [v, th * 100] as [number, number]),
    });
    series.push({
      id: `down${g + 1}`,
      label: `${g + 1}→${g} zurück`,
      color: PAIR_COLORS[i],
      dash: '5 4',
      points: SHIFT_MAP.down[(g + 1) as 2 | 3 | 4].map(([th, v]) => [v, th * 100] as [number, number]),
    });
  });
  const drive = snap.mode === 'drive';
  return (
    <LineChart
      title="Schaltkennfeld (Lastgrad über Geschwindigkeit)"
      series={series}
      xDomain={[0, 200]}
      yDomain={[0, 100]}
      xLabel="v [km/h]"
      yLabel="Gaspedal %"
      xTicks={[0, 50, 100, 150, 200]}
      yTicks={[0, 25, 50, 75, 100]}
      xFormat={(v) => fmt(v)}
      yFormat={(v) => `${fmt(v)} %`}
      marker={drive ? { x: Math.min(200, Math.max(0, snap.vehicleKmh)), y: snap.throttle * 100, label: `Gang ${GEARS[snap.flowGear].label}` } : null}
      height={190}
    />
  );
}
