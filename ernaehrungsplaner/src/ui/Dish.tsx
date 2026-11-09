import React, { useMemo } from 'react';
import type { Recipe } from '../lib/types';
import { ING } from '../data/ingredients';
import { gramsOf, toCanonical } from '../lib/format';
import { rng } from '../lib/planner';

// Gericht-Illustration: aus den Hauptzutaten (Farbe und Menge) und der Art des Gerichts
// wird eine Draufsicht gezeichnet – kein Foto, sondern eine stilisierte Darstellung.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function blob(cx: number, cy: number, r: number, rand: () => number, n = 7): string {
  const pts: [number, number][] = [];
  const rot = rand() * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * Math.PI * 2;
    const rr = r * (0.82 + rand() * 0.3);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = '';
  for (let k = 0; k < n; k++) {
    const p = pts[k];
    const q = pts[(k + 1) % n];
    const m = mid(p, q);
    if (k === 0) {
      const m0 = mid(pts[n - 1], p);
      d += `M${m0[0].toFixed(1)} ${m0[1].toFixed(1)}`;
    }
    d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return d + 'Z';
}

const GREENS = ['#3D8B3D', '#4A9A40', '#6FA84A'];

interface Part {
  col: string;
  g: number;
  id: string;
}

function partsOf(r: Recipe): Part[] {
  const parts: Part[] = [];
  for (const it of r.items) {
    const ing = ING[it.i];
    if (!ing || ing.hide) continue;
    parts.push({ col: ing.col, g: gramsOf(ing, toCanonical(ing, it.a, it.u)), id: ing.id });
  }
  parts.sort((a, b) => b.g - a.g);
  return parts;
}

const HERBS = new Set(['petersilie', 'schnittlauch', 'basilikum', 'dill', 'fruehlingszwiebel', 'rucola', 'spinat']);
const CREAMY = new Set(['sahne', 'kokosmilch', 'joghurt', 'schmand', 'quark', 'hafer-cuisine', 'soja-cuisine', 'soja-joghurt', 'frischkaese']);

export function Dish({ recipe, size = 96, className }: { recipe: Recipe; size?: number; className?: string }) {
  const svg = useMemo(() => {
    const rand = rng(hash(recipe.id));
    const parts = partsOf(recipe);
    const main = parts.filter((p) => !HERBS.has(p.id));
    const herbs = parts.filter((p) => HERBS.has(p.id));
    const cream = recipe.items.some((it) => CREAMY.has(it.i));
    const colors = main.slice(0, 5).map((p) => p.col);
    while (colors.length < 3) colors.push(colors[colors.length - 1] ?? '#D9B26A');
    const herb = herbs[0]?.col ?? GREENS[Math.floor(rand() * GREENS.length)];
    const els: React.ReactNode[] = [];
    let key = 0;
    const k = () => key++;

    const garnish = (cx: number, cy: number, spread: number, count: number, col: string, rmin = 1.2, rmax = 2.4) => {
      for (let i = 0; i < count; i++) {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * spread;
        els.push(<circle key={k()} cx={cx + Math.cos(a) * d} cy={cy + Math.sin(a) * d} r={rmin + rand() * (rmax - rmin)} fill={col} />);
      }
    };
    const leaves = (cx: number, cy: number, spread: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * spread;
        const x = cx + Math.cos(a) * d;
        const y = cy + Math.sin(a) * d;
        const rot = rand() * 180;
        els.push(<ellipse key={k()} cx={x} cy={y} rx={2.6} ry={1.2} fill={herb} transform={`rotate(${rot} ${x} ${y})`} />);
      }
    };
    const chunks = (cx: number, cy: number, spread: number, cols: string[], count: number, s = 4.5) => {
      for (let i = 0; i < count; i++) {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * spread;
        const x = cx + Math.cos(a) * d;
        const y = cy + Math.sin(a) * d;
        const w = s * (0.7 + rand() * 0.6);
        els.push(
          <rect key={k()} x={x - w / 2} y={y - w / 2} width={w} height={w * (0.7 + rand() * 0.4)} rx={w * 0.3}
            fill={cols[i % cols.length]} transform={`rotate(${rand() * 90} ${x} ${y})`} />,
        );
      }
    };
    const plate = (r = 43) => {
      els.push(<circle key={k()} cx={50} cy={51.5} r={r} fill="var(--dish-shadow)" />);
      els.push(<circle key={k()} cx={50} cy={50} r={r} fill="var(--plate)" stroke="var(--plate-rim)" strokeWidth={1.6} />);
      els.push(<circle key={k()} cx={50} cy={50} r={r - 8} fill="none" stroke="var(--plate-rim)" strokeWidth={0.8} />);
    };

    switch (recipe.visual) {
      case 'bowl': {
        const glaze = ['#2F5D62', '#5B7DB1', '#B85C38', '#3F6B4F', '#7A5C8E'][Math.floor(rand() * 5)];
        els.push(<circle key={k()} cx={50} cy={51.5} r={43} fill="var(--dish-shadow)" />);
        els.push(<circle key={k()} cx={50} cy={50} r={43} fill={glaze} />);
        els.push(<circle key={k()} cx={50} cy={50} r={36.5} fill="var(--plate)" />);
        els.push(<path key={k()} d={blob(50, 50, 32, rand, 9)} fill={colors[0]} />);
        chunks(50, 50, 22, colors.slice(1, 4), 9, 5.5);
        if (cream) els.push(<path key={k()} d="M34 46 q8 -9 16 -2 t16 2" fill="none" stroke="#FBF8EF" strokeWidth={2.4} strokeLinecap="round" opacity={0.9} />);
        leaves(50, 50, 18, 6);
        break;
      }
      case 'pasta': {
        plate();
        const pasta = main.find((p) => ['spaghetti', 'vollkornspaghetti', 'penne', 'bandnudeln', 'mie-nudeln', 'gf-pasta', 'tortellini'].includes(p.id))?.col ?? '#EDD48A';
        const sauce = main.find((p) => p.col !== pasta)?.col ?? colors[1];
        for (let i = 0; i < 9; i++) {
          const r = 9 + rand() * 15;
          const a0 = rand() * 360;
          const a1 = a0 + 120 + rand() * 160;
          const p0 = [50 + r * Math.cos((a0 * Math.PI) / 180), 50 + r * Math.sin((a0 * Math.PI) / 180)];
          const p1 = [50 + r * Math.cos((a1 * Math.PI) / 180), 50 + r * Math.sin((a1 * Math.PI) / 180)];
          els.push(<path key={k()} d={`M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${r} ${r} 0 0 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`} fill="none" stroke={pasta} strokeWidth={3.2} strokeLinecap="round" />);
        }
        els.push(<path key={k()} d={blob(50 + (rand() - 0.5) * 6, 48, 13, rand)} fill={sauce} opacity={0.95} />);
        chunks(50, 48, 10, colors.filter((c) => c !== pasta && c !== sauce).slice(0, 2).concat(sauce), 4, 4);
        garnish(50, 48, 12, 7, '#F4E7C5', 0.8, 1.6);
        leaves(50, 48, 12, 4);
        break;
      }
      case 'bread': {
        els.push(<rect key={k()} x={9} y={20} width={82} height={62} rx={8} fill="#B07A45" />);
        els.push(<rect key={k()} x={9} y={18} width={82} height={62} rx={8} fill="#C8955C" />);
        for (let i = 0; i < 4; i++) els.push(<path key={k()} d={`M14 ${28 + i * 14} q36 ${-4 + rand() * 8} 72 0`} stroke="#B58049" strokeWidth={0.8} fill="none" />);
        const bread = parts.find((p) => ['vollkornbrot', 'toast', 'broetchen', 'tortilla', 'gf-brot', 'reiswaffeln', 'mais-tortilla'].includes(p.id))?.col ?? '#7A5233';
        const toppings = main.filter((p) => p.col !== bread).map((p) => p.col);
        if (!toppings.length) toppings.push('#F7F4EC');
        for (const [x, y, rot] of [[32, 49, -8], [66, 49, 7]] as const) {
          els.push(
            <g key={k()} transform={`rotate(${rot} ${x} ${y})`}>
              <rect x={x - 17} y={y - 19} width={34} height={38} rx={9} fill={bread} />
              <rect x={x - 14} y={y - 16} width={28} height={32} rx={7} fill={bread === '#7A5233' ? '#8E6440' : '#E2C38F'} />
              <path d={blob(x, y, 11, rand)} fill={toppings[0]} />
            </g>,
          );
          garnish(x, y, 9, 5, toppings[1] ?? toppings[0], 2, 3.4);
          if (toppings[2]) garnish(x, y, 9, 3, toppings[2], 1.5, 2.6);
        }
        leaves(50, 49, 26, 5);
        break;
      }
      case 'glass': {
        els.push(<circle key={k()} cx={50} cy={50} r={44} fill="var(--dish-bg)" />);
        els.push(<path key={k()} d="M31 22 L69 22 L64 84 Q63 88 59 88 L41 88 Q37 88 36 84 Z" fill="var(--plate)" stroke="var(--plate-rim)" strokeWidth={1.4} />);
        els.push(<path key={k()} d="M33.5 34 L66.5 34 L62.6 82 Q62 85 58.6 85 L41.4 85 Q38 85 37.4 82 Z" fill={colors[0]} />);
        els.push(<path key={k()} d="M33.5 34 L66.5 34 L65.7 44 L34.3 44 Z" fill={colors[1]} opacity={0.85} />);
        garnish(50, 30, 12, 6, colors[2], 1.6, 2.8);
        els.push(<path key={k()} d="M57 12 L52 40" stroke="#E2532E" strokeWidth={3} strokeLinecap="round" />);
        break;
      }
      case 'pan': {
        els.push(<rect key={k()} x={74} y={64} width={26} height={8} rx={4} fill="#3A3D42" transform="rotate(32 74 64)" />);
        els.push(<circle key={k()} cx={46} cy={47} r={40} fill="#2E3135" />);
        els.push(<circle key={k()} cx={46} cy={47} r={35} fill="#3F4349" />);
        els.push(<path key={k()} d={blob(46, 47, 30, rand, 9)} fill={colors[0]} />);
        chunks(46, 47, 22, colors.slice(1, 5), 14, 5);
        leaves(46, 47, 20, 7);
        break;
      }
      case 'tray': {
        els.push(<rect key={k()} x={7} y={16} width={86} height={70} rx={7} fill="var(--dish-shadow)" />);
        els.push(<rect key={k()} x={7} y={14} width={86} height={70} rx={7} fill="#8E949A" />);
        els.push(<rect key={k()} x={12} y={19} width={76} height={60} rx={4} fill="#A9AEB3" />);
        const cols = main.slice(0, 5).map((p) => p.col);
        const total = main.slice(0, 5).reduce((s, p) => s + p.g, 0) || 1;
        let idx = 0;
        for (const p of main.slice(0, 5)) {
          const n = Math.max(2, Math.round((p.g / total) * 22));
          for (let i = 0; i < n; i++) {
            const x = 18 + rand() * 64;
            const y = 25 + rand() * 48;
            els.push(<path key={k()} d={blob(x, y, 4 + rand() * 3, rand, 6)} fill={p.col} />);
          }
          idx++;
        }
        if (!idx) chunks(50, 49, 26, cols.length ? cols : ['#D9B26A'], 16);
        leaves(50, 49, 26, 6);
        break;
      }
      default: {
        plate();
        const angles = [210, 330, 90].map((a) => ((a + rand() * 30) * Math.PI) / 180);
        main.slice(0, 3).forEach((p, i) => {
          const share = Math.min(1, p.g / (main[0]?.g || 1));
          const r = 9 + share * 7;
          const cx = 50 + Math.cos(angles[i]) * 13;
          const cy = 50 + Math.sin(angles[i]) * 13;
          els.push(<path key={k()} d={blob(cx, cy, r, rand)} fill={p.col} />);
          if (i === 0) chunks(cx, cy, r * 0.5, [colors[3] ?? colors[1]], 3, 3.2);
        });
        if (!main.length) els.push(<path key={k()} d={blob(50, 50, 16, rand)} fill="#D9B26A" />);
        leaves(50, 50, 20, 5);
        if (cream) els.push(<path key={k()} d={blob(50 + 12, 50 - 10, 6, rand)} fill="#FBF8EF" />);
      }
    }
    return els;
  }, [recipe]);

  return (
    <svg className={'dish ' + (className ?? '')} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Illustration: ${recipe.name}`}>
      {svg}
    </svg>
  );
}
