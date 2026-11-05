/**
 * Schlankes SVG-Liniendiagramm mit Fadenkreuz-Tooltip und Betriebspunkt.
 * Eine Achse, dünne Linien, zurückhaltendes Raster; Identität über Legende + Strichart.
 */
import { useMemo, useRef, useState } from 'react';
import { fmt } from './common';

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  dash?: string;
  points: [number, number][];
}

interface Props {
  title: string;
  series: ChartSeries[];
  xDomain: [number, number];
  yDomain: [number, number];
  xLabel: string;
  yLabel: string;
  xTicks: number[];
  yTicks: number[];
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  marker?: { x: number; y: number; label: string } | null;
  height?: number;
  legend?: boolean;
}

function interpAt(points: [number, number][], x: number): number | null {
  if (x < points[0][0] || x > points[points.length - 1][0]) return null;
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return null;
}

export function LineChart({ title, series, xDomain, yDomain, xLabel, yLabel, xTicks, yTicks, xFormat = (v) => fmt(v, 1), yFormat = (v) => fmt(v, 1), marker, height = 170, legend = true }: Props) {
  const W = 320;
  const H = height;
  const m = { l: 40, r: 10, t: 8, b: 30 };
  const sx = (x: number) => m.l + ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * (W - m.l - m.r);
  const sy = (y: number) => H - m.b - ((y - yDomain[0]) / (yDomain[1] - yDomain[0])) * (H - m.t - m.b);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const paths = useMemo(() => series.map((s) => s.points.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('')), [series, xDomain, yDomain]); // eslint-disable-line react-hooks/exhaustive-deps
  const onMove = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const x = xDomain[0] + ((px - m.l) / (W - m.l - m.r)) * (xDomain[1] - xDomain[0]);
    setHoverX(x >= xDomain[0] && x <= xDomain[1] ? x : null);
  };
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      {legend && series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.id}>
              <svg width="18" height="8">
                <line x1="0" y1="4" x2="18" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />
              </svg>
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="chart-box">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={() => setHoverX(null)} role="img" aria-label={title}>
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} className="grid" />
              <text x={m.l - 5} y={sy(t) + 3} textAnchor="end" className="tick">
                {yFormat(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={`x${t}`} x={sx(t)} y={H - m.b + 13} textAnchor="middle" className="tick">
              {xFormat(t)}
            </text>
          ))}
          <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} className="axis" />
          <text x={(m.l + W - m.r) / 2} y={H - 3} textAnchor="middle" className="axis-label">
            {xLabel}
          </text>
          <text x={10} y={(m.t + H - m.b) / 2} textAnchor="middle" className="axis-label" transform={`rotate(-90 10 ${(m.t + H - m.b) / 2})`}>
            {yLabel}
          </text>
          {series.map((s, i) => (
            <path key={s.id} d={paths[i]} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {marker && (
            <g>
              <circle cx={sx(marker.x)} cy={sy(marker.y)} r={6} fill="var(--panel-solid)" />
              <circle cx={sx(marker.x)} cy={sy(marker.y)} r={4.5} fill="#ffffff" />
              <text x={Math.min(sx(marker.x) + 8, W - 60)} y={Math.max(sy(marker.y) - 7, 12)} className="marker-label">
                {marker.label}
              </text>
            </g>
          )}
          {hoverX !== null && (
            <g pointerEvents="none">
              <line x1={sx(hoverX)} x2={sx(hoverX)} y1={m.t} y2={H - m.b} className="crosshair" />
              {series.map((s) => {
                const y = interpAt(s.points, hoverX);
                return y === null ? null : <circle key={s.id} cx={sx(hoverX)} cy={sy(y)} r={3.5} fill={s.color} stroke="var(--panel-solid)" strokeWidth={2} />;
              })}
            </g>
          )}
        </svg>
        {hoverX !== null && (
          <div className="chart-tip" style={{ left: `${(sx(hoverX) / W) * 100}%` }}>
            <div className="tip-x">
              {xLabel}: <b>{xFormat(hoverX)}</b>
            </div>
            {series.map((s) => {
              const y = interpAt(s.points, hoverX);
              return y === null ? null : (
                <div key={s.id}>
                  <b>{yFormat(y)}</b> <span>{s.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </figure>
  );
}
