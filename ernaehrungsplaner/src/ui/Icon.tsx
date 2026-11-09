import React from 'react';

// Schlanker Linien-Iconsatz (24 × 24, Strichstärke 2).
const PATHS: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  calendar: 'M4 6.5h16v13.5H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5',
  book: 'M5 4.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  cart: 'M3 4h2.5l2.2 11h10.6L20.5 7H7M9.5 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01',
  box: 'M4 8l8-4 8 4v8.5L12 20.5 4 16.5zM4 8l8 4 8-4M12 12v8.5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5 10 17.5 19 7',
  lock: 'M6.5 11h11v9h-11zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  unlock: 'M6.5 11h11v9h-11zM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2',
  shuffle: 'M4 7h3.5c4.5 0 4.5 10 9 10H20M4 17h3.5c1.6 0 2.6-1.3 3.4-3M14 10c.8-1.7 1.8-3 3.5-3H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5',
  refresh: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z',
  star: 'M12 3.8l2.5 5.2 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16 16l4.5 4.5',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  copy: 'M8.5 8.5h11v11h-11zM15.5 8.5v-4h-11v11h4',
  sparkles: 'M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8zM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  swap: 'M7 4.5 3.5 8 7 11.5M3.5 8h13M17 12.5l3.5 3.5-3.5 3.5M20.5 16h-13',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z',
  monitor: 'M3.5 5h17v11h-17zM9 20h6M12 16v4',
  edit: 'M4 20h4.5L19 9.5 14.5 5 4 15.5zM13 6.5l4.5 4.5',
  utensils: 'M7 3.5v8M4.5 3.5v5a2.5 2.5 0 0 0 5 0v-5M7 11.5v9M17 20.5v-17c-2 1-3.5 3.5-3.5 7h3.5',
  leaf: 'M5 19c0-9 6-14 15-14 0 9-5 15-14 15M5 19l7-7',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.5v.01',
  chevronLeft: 'M14.5 5.5 8 12l6.5 6.5',
  chevronRight: 'M9.5 5.5 16 12l-6.5 6.5',
  chevronDown: 'M5.5 9.5 12 16l6.5-6.5',
  euro: 'M17.5 6.5a6.5 6.5 0 1 0 0 11M5 10.5h9M5 13.5h9',
  flame: 'M12 21c-3.6 0-6-2.5-6-5.8 0-3.7 3.2-5.4 3.6-9.2 2.4 1.4 4 3.6 4.3 6 .9-.6 1.5-1.7 1.6-2.9 1.6 1.5 2.5 3.6 2.5 6.1 0 3.3-2.4 5.8-6 5.8z',
  move: 'M12 3.5v17M3.5 12h17M9 6.5l3-3 3 3M9 17.5l3 3 3-3M6.5 9l-3 3 3 3M17.5 9l3 3-3 3',
  filter: 'M4 5.5h16l-6.2 7.3v5.7l-3.6 1.8v-7.5z',
  list: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  cloud: 'M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.7A3.7 3.7 0 0 1 17.5 18.5z',
  cloudOff: 'M3.5 3.5l17 17M9.3 6.2A6 6 0 0 1 17.8 11a3.7 3.7 0 0 1 1.9 6.3M16 18.5H7a4.5 4.5 0 0 1-1.2-8.8',
  upload: 'M12 15.5V4.5M7.5 9 12 4.5 16.5 9M5 19.5h14',
  scale: 'M12 4v16M6 20h12M5.5 8h13M5.5 8l-2.5 6a3 3 0 0 0 5 0zM18.5 8l-2.5 6a3 3 0 0 0 5 0z',
  dots: 'M6 12h.01M12 12h.01M18 12h.01',
  bowl: 'M3.5 11h17a8.5 8.5 0 0 1-17 0zM9 20h6',
  alert: 'M12 4 21 19.5H3zM12 10v4.5M12 17v.01',
};

export function Icon({ name, size = 18, className, title }: { name: keyof typeof PATHS | string; size?: number; className?: string; title?: string }) {
  const d = PATHS[name] ?? PATHS.info;
  const filled = name === 'heartFill' || name === 'starFill';
  const path = filled ? PATHS[name.replace('Fill', '')] : d;
  return (
    <svg
      className={'icon ' + (className ?? '')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d={path} />
    </svg>
  );
}
