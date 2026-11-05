/**
 * Geometrie-Erzeugung: Evolventenverzahnung (außen/innen), Rotationskörper um
 * die Getriebeachse (X-Achse), Lamellen mit Mitnahmeverzahnung, Schaufeln.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Zyklische Achsvertauschung (x←z, y←x, z←y): Extrusionsachse Z wird zur Getriebeachse X. */
const EXTRUDE_TO_X = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);
/** Lathe-Achse Y wird zur Getriebeachse X (x←y, y←z, z←x). */
const LATHE_TO_X = new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1);

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

const involute = (a: number) => Math.tan(a) - a;

/**
 * Umriss eines Außenrades (Evolventenverzahnung, Eingriffswinkel 20°).
 * Zahnmitte des Zahns k liegt bei Winkel 2πk/z + offset.
 */
export function externalGearOutline(
  z: number,
  m: number,
  opts: { addendum?: number; dedendum?: number; offset?: number; flankSteps?: number } = {},
): THREE.Vector2[] {
  const alpha = (20 * Math.PI) / 180;
  const r = (z * m) / 2;
  const rb = r * Math.cos(alpha);
  const ra = r + (opts.addendum ?? 1) * m;
  const rf = r - (opts.dedendum ?? 1.25) * m;
  const steps = opts.flankSteps ?? 6;
  const off = opts.offset ?? 0;
  const halfAt = (rho: number) => {
    const rr = Math.max(rho, rb);
    const a = Math.acos(rb / rr);
    return Math.PI / (2 * z) + involute(alpha) - involute(a);
  };
  const pts: THREE.Vector2[] = [];
  const flankStart = Math.max(rf, Math.min(rb, ra));
  const radii: number[] = [];
  if (rf < rb) radii.push(rf);
  for (let i = 0; i <= steps; i++) radii.push(flankStart + ((ra - flankStart) * i) / steps);
  for (let k = 0; k < z; k++) {
    const c = (2 * Math.PI * k) / z + off;
    // Fußkreisbogen bis zur rechten Flanke
    const rightRoot = c - halfAt(rf);
    const prevLeft = c - (2 * Math.PI) / z + halfAt(rf);
    for (let i = 1; i <= 2; i++) {
      const a = prevLeft + ((rightRoot - prevLeft) * i) / 3;
      pts.push(new THREE.Vector2(rf * Math.cos(a), rf * Math.sin(a)));
    }
    for (const rho of radii) {
      const a = c - Math.max(halfAt(rho), 0.002);
      pts.push(new THREE.Vector2(rho * Math.cos(a), rho * Math.sin(a)));
    }
    const ha = Math.max(halfAt(ra), 0.002);
    pts.push(new THREE.Vector2(ra * Math.cos(c), ra * Math.sin(c)));
    for (let i = radii.length - 1; i >= 0; i--) {
      const rho = radii[i];
      const a = c + Math.max(halfAt(rho), 0.002);
      pts.push(new THREE.Vector2(rho * Math.cos(a), rho * Math.sin(a)));
    }
    void ha;
  }
  return pts;
}

function circlePath(r: number, segs = 64, clockwise = false): THREE.Path {
  const p = new THREE.Path();
  p.absarc(0, 0, r, 0, Math.PI * 2, clockwise);
  void segs;
  return p;
}

/** Außenverzahntes Zahnrad mit Bohrung, zentriert um x = 0, Breite w entlang X. */
export function gearGeometry(z: number, m: number, width: number, bore: number, offset = 0): THREE.BufferGeometry {
  return cached(`gear:${z}:${m}:${width}:${bore}:${offset}`, () => {
    const shape = new THREE.Shape(externalGearOutline(z, m, { offset }));
    if (bore > 0) shape.holes.push(circlePath(bore, 48, true));
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: width,
      bevelEnabled: true,
      bevelThickness: Math.min(0.012, width * 0.05),
      bevelSize: m * 0.12,
      bevelSegments: 1,
      curveSegments: 48,
    });
    g.translate(0, 0, -width / 2);
    g.applyMatrix4(EXTRUDE_TO_X);
    g.computeVertexNormals();
    return g;
  });
}

/**
 * Hohlrad mit Innenverzahnung. Zahnmitte (nach innen gerichteter Zahn) bei Winkel
 * 2πk/z + toothOffset. Kopfkreis innen r − m, Fußkreis r + 1,25 m.
 */
export function ringGearGeometry(z: number, m: number, width: number, outer: number, toothOffset = 0): THREE.BufferGeometry {
  return cached(`ring:${z}:${m}:${width}:${outer}:${toothOffset}`, () => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    // Lücken des Hohlrades entsprechen Zähnen eines Außenrades mit z Zähnen,
    // dessen Zahnmitten um eine halbe Teilung versetzt liegen.
    const holePts = externalGearOutline(z, m, { addendum: 1.25, dedendum: 1, offset: toothOffset + Math.PI / z });
    const hole = new THREE.Path(holePts.slice().reverse());
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: width,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.008,
      bevelSegments: 1,
      curveSegments: 96,
    });
    g.translate(0, 0, -width / 2);
    g.applyMatrix4(EXTRUDE_TO_X);
    g.computeVertexNormals();
    return g;
  });
}

/**
 * Rotationskörper um die X-Achse aus einem Profil [x, r].
 * Jedes Profilsegment wird separat gedreht, damit Kanten scharf schattiert bleiben.
 */
export function latheX(profile: [number, number][], segments = 72, key?: string, phiStart = 0, phiLength = Math.PI * 2): THREE.BufferGeometry {
  const make = () => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < profile.length - 1; i++) {
      const [x0, r0] = profile[i];
      const [x1, r1] = profile[i + 1];
      if (Math.hypot(x1 - x0, r1 - r0) < 1e-6) continue;
      const pts = [new THREE.Vector2(Math.max(r0, 0.0001), x0), new THREE.Vector2(Math.max(r1, 0.0001), x1)];
      parts.push(new THREE.LatheGeometry(pts, segments, phiStart, phiLength));
    }
    const g = parts.length === 1 ? parts[0] : (mergeGeometries(parts, false) ?? parts[0]);
    if (parts.length > 1) parts.forEach((p) => p.dispose());
    g.applyMatrix4(LATHE_TO_X);
    return g;
  };
  return key ? cached(`lathe:${key}`, make) : make();
}

/** Hohlzylinder (Rohr) entlang X von x0 bis x1 mit Innen-/Außenradius. */
export function tubeX(x0: number, x1: number, rIn: number, rOut: number, segments = 72): THREE.BufferGeometry {
  return cached(`tube:${x0}:${x1}:${rIn}:${rOut}:${segments}`, () =>
    latheX(
      [
        [x0, rIn],
        [x0, rOut],
        [x1, rOut],
        [x1, rIn],
        [x0, rIn],
      ],
      segments,
    ),
  );
}

/** Ringscheibe bzw. Lamelle mit Mitnahmeverzahnung (innen oder außen). */
export function plateGeometry(
  rIn: number,
  rOut: number,
  thickness: number,
  tabs: { count: number; side: 'inner' | 'outer'; depth: number },
): THREE.BufferGeometry {
  return cached(`plate:${rIn}:${rOut}:${thickness}:${tabs.count}:${tabs.side}:${tabs.depth}`, () => {
    const n = tabs.count;
    const outerPts: THREE.Vector2[] = [];
    const innerPts: THREE.Vector2[] = [];
    const seg = 6;
    for (let k = 0; k < n; k++) {
      for (let j = 0; j < seg; j++) {
        const a = ((k + j / seg) * 2 * Math.PI) / n;
        const isTab = j >= 1 && j <= 2;
        const ro = tabs.side === 'outer' && isTab ? rOut + tabs.depth : rOut;
        const ri = tabs.side === 'inner' && isTab ? rIn - tabs.depth : rIn;
        outerPts.push(new THREE.Vector2(ro * Math.cos(a), ro * Math.sin(a)));
        innerPts.push(new THREE.Vector2(ri * Math.cos(a), ri * Math.sin(a)));
      }
    }
    const shape = new THREE.Shape(outerPts);
    shape.holes.push(new THREE.Path(innerPts.reverse()));
    const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    g.translate(0, 0, -thickness / 2);
    g.applyMatrix4(EXTRUDE_TO_X);
    g.computeVertexNormals();
    return g;
  });
}

/**
 * Wandlerschaufel in der Meridianebene: Fläche zwischen Außenschale (Radius a)
 * und Kernring (Radius c) eines Torus, auf einer Hälfte (side = +1 Pumpe, −1 Turbine).
 * twist verdreht die Schaufel entlang des Radius (gekrümmte Schaufel).
 */
export function bladeGeometry(R0: number, a: number, c: number, side: 1 | -1, twist: number, nu = 14, nv = 5): THREE.BufferGeometry {
  return cached(`blade:${R0}:${a}:${c}:${side}:${twist}`, () => {
    const pos: number[] = [];
    const idx: number[] = [];
    // u: Winkel entlang des Halbkreises (−90° innen … +90° außen), v: von Kernring zur Schale
    for (let i = 0; i <= nu; i++) {
      const t = -Math.PI / 2 + (Math.PI * i) / nu;
      for (let j = 0; j <= nv; j++) {
        const rho = c + ((a - c) * j) / nv;
        const x = side * rho * Math.cos(t);
        const r = R0 + rho * Math.sin(t);
        const phi = twist * ((r - R0) / a);
        pos.push(x, r * Math.cos(phi), r * Math.sin(phi));
      }
    }
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv; j++) {
        const p = i * (nv + 1) + j;
        idx.push(p, p + 1, p + nv + 1, p + 1, p + nv + 2, p + nv + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}

/** Halbtorus-Schale (Pumpen- oder Turbinenschale) als Rotationskörper. */
export function halfTorusShell(xc: number, R0: number, a: number, side: 1 | -1, segs = 20): [number, number][] {
  const prof: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / segs;
    prof.push([xc + side * a * Math.cos(t), R0 + a * Math.sin(t)]);
  }
  return prof;
}

/** Leitradschaufel: schräg angestellte Platte zwischen r0 und r1, Breite w entlang X */
export function statorBladeGeometry(r0: number, r1: number, w: number, angle: number): THREE.BufferGeometry {
  return cached(`stator:${r0}:${r1}:${w}:${angle}`, () => {
    const g = new THREE.BoxGeometry(w, r1 - r0, 0.03);
    g.translate(0, (r0 + r1) / 2, 0);
    g.rotateY(angle);
    return g;
  });
}

/**
 * Fasst n Kopien einer Geometrie zu einer zusammen (weniger Draw-Calls).
 * mode 'rotate': Kopie i wird um 2πi/n um X gedreht (Schaufeln);
 * mode 'place': Kopie i wird auf Radius r im Winkel 2πi/n verschoben (Rollen, Bolzen).
 */
export function radialArray(key: string, base: THREE.BufferGeometry, n: number, mode: 'rotate' | 'place', r = 0, pre?: (g: THREE.BufferGeometry, a: number) => void): THREE.BufferGeometry {
  return cached(`radial:${key}:${n}:${mode}:${r}`, () => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      const g = base.clone();
      if (pre) pre(g, a);
      if (mode === 'rotate') g.rotateX(a);
      else g.translate(0, r * Math.cos(a), r * Math.sin(a));
      parts.push(g);
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged ?? base;
  });
}
