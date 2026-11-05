/**
 * Drehmomentwandler: Wandlergehäuse/Pumpenrad (Motor), Turbinenrad (Eingangswelle),
 * Leitrad auf Freilauf, Überbrückungskupplung mit Torsionsdämpfer, Ölströmung.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { VISUAL_SPEED_SCALE } from '../sim/simulation';
import { sim, useStore } from '../state/store';
import { PartMesh } from './core';
import { bladeGeometry, latheX, radialArray, statorBladeGeometry, tubeX } from './geometry';

export interface ConverterVisualState {
  pumpAngle: number;
  turbineAngle: number;
  statorAngle: number;
  /** reale Winkelgeschwindigkeiten [rad/s] */
  wp: number;
  wt: number;
  statorLocked: boolean;
  /** 0 = offen … 1 = geschlossen */
  lockup: number;
}

export const globalConverterState = (): ConverterVisualState => ({
  pumpAngle: sim.angles.ENG ?? 0,
  turbineAngle: sim.angles.IN ?? 0,
  statorAngle: sim.angles.STATOR ?? 0,
  wp: sim.we,
  wt: sim.wt,
  statorLocked: useStore.getState().snapshot.converter.statorLocked,
  lockup: sim.lockLevel,
});

const R0 = 1.7;
const A = 0.78;
const CORE = 0.3;

/** geschlossenes Profil einer Halbtorus-Schale mit Wandstärke */
function shellProfile(side: 1 | -1, ra: number, t: number, segs = 22): [number, number][] {
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const th = -Math.PI / 2 + (Math.PI * i) / segs;
    outer.push([side * (ra + t) * Math.cos(th), R0 + (ra + t) * Math.sin(th)]);
    inner.push([side * ra * Math.cos(th), R0 + ra * Math.sin(th)]);
  }
  return [...outer, ...inner.reverse(), outer[0]];
}

export function Converter3D({
  x,
  getState = globalConverterState,
  particles = 700,
  scaleParticles = 1,
}: {
  x: number;
  getState?: () => ConverterVisualState;
  particles?: number;
  scaleParticles?: number;
}) {
  const pumpRef = useRef<THREE.Group>(null);
  const turbRef = useRef<THREE.Group>(null);
  const statorRef = useRef<THREE.Group>(null);
  const rollerRef = useRef<THREE.Group>(null);
  const pistonRef = useRef<THREE.Group>(null);

  const geo = useMemo(() => {
    const pumpShell = latheX(shellProfile(1, A, 0.05), 72, 'conv-pump-shell');
    const turbShell = latheX(shellProfile(-1, A, 0.04), 72, 'conv-turb-shell');
    const pumpCore = latheX(shellProfile(1, CORE - 0.035, 0.035, 14), 64, 'conv-pump-core');
    const turbCore = latheX(shellProfile(-1, CORE - 0.035, 0.035, 14), 64, 'conv-turb-core');
    // Wandlerdeckel (motorseitig), mit dem Pumpengehäuse am Außenrand verschweißt
    const cover = latheX(
      [
        [0.02, R0 + A + 0.05],
        [0.0, 2.62],
        [-0.5, 2.66],
        [-0.95, 2.6],
        [-1.12, 2.4],
        [-1.15, 0.32],
        [-1.38, 0.3],
        [-1.38, 0.16],
        [-1.32, 0.16],
        [-1.32, 0.25],
        [-1.09, 0.27],
        [-1.08, 2.36],
        [-0.92, 2.55],
        [-0.5, 2.6],
        [0.02, R0 + A + 0.0],
      ],
      96,
      'conv-cover',
    );
    // Pumpenrad-Nabe (treibt die Ölpumpe)
    const pumpHubProfile: [number, number][] = [
      [0, R0 - A - 0.05],
      [0.18, 0.62],
      [1.75, 0.58],
      [1.75, 0.47],
      [0.15, 0.5],
      [0, R0 - A],
    ];
    const pumpHub = latheX(pumpHubProfile, 64, 'conv-pump-hub');
    // Turbinennabe → Eingangswelle
    const turbHub = latheX(
      [
        [-0.05, R0 - A - 0.02],
        [-0.55, 0.62],
        [-0.72, 0.45],
        [-0.72, 0.22],
        [-0.6, 0.22],
        [-0.6, 0.4],
        [-0.48, 0.56],
        [-0.02, R0 - A + 0.03],
      ],
      64,
      'conv-turb-hub',
    );
    const pumpBlade = radialArray('pump-blades', bladeGeometry(R0, A, CORE, 1, 0.0), 26, 'rotate');
    const turbBlade = radialArray('turb-blades', bladeGeometry(R0, A, CORE, -1, 0.38), 28, 'rotate');
    const statorBlade = radialArray('stator-blades', statorBladeGeometry(0.86, 1.36, 0.26, 0.6), 15, 'rotate');
    const statorHub = tubeX(-0.14, 0.14, 0.62, 0.86);
    const statorRing = tubeX(-0.13, 0.13, 1.36, 1.42);
    const freewheelInner = tubeX(-0.16, 0.16, 0.42, 0.5);
    const roller = radialArray('stator-rollers', new THREE.CylinderGeometry(0.045, 0.045, 0.26, 10).rotateZ(Math.PI / 2), 12, 'place', 0.555);
    const piston = tubeX(-1.0, -0.96, 0.62, 2.3);
    const lining = tubeX(-1.04, -1.0, 1.86, 2.26);
    const damperSpring = radialArray('damper-springs', new THREE.TorusGeometry(0.07, 0.022, 6, 12), 8, 'place', 0, (g, a) => {
      g.rotateY(Math.PI / 2).rotateX(a).translate(-0.88, 1.42 * Math.cos(a), 1.42 * Math.sin(a));
    });
    const damperRing = tubeX(-0.93, -0.88, 1.2, 1.6);
    return {
      pumpShell,
      turbShell,
      pumpCore,
      turbCore,
      cover,
      pumpHub,
      turbHub,
      pumpBlade,
      turbBlade,
      statorBlade,
      statorHub,
      statorRing,
      freewheelInner,
      roller,
      piston,
      lining,
      damperSpring,
      damperRing,
    };
  }, []);


  useFrame(() => {
    const s = getState();
    if (pumpRef.current) pumpRef.current.rotation.x = s.pumpAngle;
    if (turbRef.current) turbRef.current.rotation.x = s.turbineAngle;
    if (statorRef.current) statorRef.current.rotation.x = s.statorAngle;
    if (rollerRef.current) rollerRef.current.rotation.x = s.statorAngle * 0.5;
    if (pistonRef.current) pistonRef.current.position.x = -0.035 * s.lockup;
  });

  return (
    <group position={[x, 0, 0]}>
      {/* Pumpenseite + Deckel = Wandlergehäuse, dreht mit dem Motor */}
      <group ref={pumpRef}>
        <PartMesh geometry={geo.pumpShell} part="pumpenrad" colorKey="ENG" kind="shell" />
        <PartMesh geometry={geo.cover} part="wandlergehaeuse" colorKey="ENG" kind="shell" />
        <PartMesh geometry={geo.pumpHub} part="pumpenrad" colorKey="ENG" kind="shell" />
        <PartMesh geometry={geo.pumpCore} part="pumpenrad" colorKey="ENG" />
        <PartMesh geometry={geo.pumpBlade} part="pumpenrad" colorKey="ENG" kind="plate" />
      </group>
      {/* Turbinenrad + Überbrückungskolben mit Dämpfer */}
      <group ref={turbRef}>
        <PartMesh geometry={geo.turbShell} part="turbinenrad" colorKey="IN" kind="shell" />
        <PartMesh geometry={geo.turbCore} part="turbinenrad" colorKey="IN" />
        <PartMesh geometry={geo.turbHub} part="turbinenrad" colorKey="IN" />
        <PartMesh geometry={geo.turbBlade} part="turbinenrad" colorKey="IN" kind="plate" />
        <group ref={pistonRef}>
          <PartMesh geometry={geo.piston} part="ueberbrueckungskupplung" colorKey="LOCKUP" kind="shell" />
          <PartMesh geometry={geo.lining} part="ueberbrueckungskupplung" colorKey="LOCKUP" kind="friction" />
          <PartMesh geometry={geo.damperRing} part="ueberbrueckungskupplung" colorKey="IN" />
          <PartMesh geometry={geo.damperSpring} part="ueberbrueckungskupplung" colorKey="STEEL" />
        </group>
      </group>
      {/* Leitrad auf Freilauf */}
      <group ref={statorRef}>
        <PartMesh geometry={geo.statorHub} part="leitrad" colorKey="STATOR" />
        <PartMesh geometry={geo.statorRing} part="leitrad" colorKey="STATOR" />
        <PartMesh geometry={geo.statorBlade} part="leitrad" colorKey="STATOR" />
      </group>
      <PartMesh geometry={geo.freewheelInner} part="leitrad-freilauf" colorKey="FIXED" />
      <group ref={rollerRef}>
        <PartMesh geometry={geo.roller} part="leitrad-freilauf" colorKey="STATOR" />
      </group>
      <OilFlow getState={getState} count={particles} sizeScale={scaleParticles} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ölströmung im Wandler (Partikel)
// ---------------------------------------------------------------------------

let dotTexture: THREE.Texture | null = null;
function getDotTexture() {
  if (dotTexture) return dotTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  dotTexture = new THREE.CanvasTexture(c);
  return dotTexture;
}

const C_PUMP = new THREE.Color('#ff5a4e');
const C_TURB = new THREE.Color('#ffa142');
const C_STATOR = new THREE.Color('#58a6ff');
const C_FREE = new THREE.Color('#d9dee5');

/**
 * Partikel bewegen sich auf der Meridianbahn (Pumpe → außen → Turbine → innen → Leitrad → Pumpe).
 * Meridiangeschwindigkeit ∝ Drehzahldifferenz Pumpe–Turbine (ohne Schlupf keine Zirkulation),
 * Umfangsgeschwindigkeit = Drehzahl des jeweils durchströmten Rades. Qualitative Darstellung.
 */
export function OilFlow({ getState, count, sizeScale = 1 }: { getState: () => ConverterVisualState; count: number; sizeScale?: number }) {
  const showOil = useStore((s) => s.showOil);
  const pointsRef = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const alpha = new Float32Array(count);
    const phi = new Float32Array(count);
    const rho = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      alpha[i] = Math.random() * Math.PI * 2;
      phi[i] = Math.random() * Math.PI * 2;
      rho[i] = CORE + 0.06 + Math.random() * (A - CORE - 0.12);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return { alpha, phi, rho, geom };
  }, [count]);
  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.075 * sizeScale,
        map: getDotTexture(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    [sizeScale],
  );
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const st = useStore.getState();
    const dt = st.running || st.pendingSteps > 0 ? Math.min(delta, 0.05) * st.timeScale : 0;
    const s = getState();
    const k = VISUAL_SPEED_SCALE;
    // Zirkulation (meridional) – proportional zum Schlupf, gedämpft bei Überbrückung
    const slip = Math.max(0, s.wp - s.wt);
    const circ = (slip * k * 2.2 + (s.wp > 1 ? 0.04 : 0)) * (1 - 0.95 * s.lockup);
    const pos = data.geom.attributes.position.array as Float32Array;
    const colr = data.geom.attributes.color.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const a = data.alpha[i];
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Umfangsgeschwindigkeit: Pumpenseite ωp, Turbinenseite ωt, Leitrad (innen) gebremst
      const w = (1 + ca) / 2;
      let wl = w * s.wp + (1 - w) * s.wt;
      const statorZone = sa < -0.75;
      if (statorZone && s.statorLocked) wl *= 0.35;
      data.phi[i] += wl * k * dt;
      data.alpha[i] = a + circ * dt * (1.4 - 0.4 * sa);
      if (data.alpha[i] > Math.PI * 2) data.alpha[i] -= Math.PI * 2;
      const rr = data.rho[i];
      const r = R0 + rr * sa;
      const xx = rr * ca;
      pos[i * 3] = xx;
      pos[i * 3 + 1] = r * Math.cos(data.phi[i]);
      pos[i * 3 + 2] = r * Math.sin(data.phi[i]);
      if (statorZone) tmp.copy(s.statorLocked ? C_STATOR : C_FREE);
      else if (ca > 0) tmp.copy(C_PUMP).lerp(C_TURB, Math.max(0, sa) * 0.5);
      else tmp.copy(C_TURB);
      colr[i * 3] = tmp.r;
      colr[i * 3 + 1] = tmp.g;
      colr[i * 3 + 2] = tmp.b;
    }
    data.geom.attributes.position.needsUpdate = true;
    data.geom.attributes.color.needsUpdate = true;
  });

  if (!showOil) return null;
  return <points ref={pointsRef} geometry={data.geom} material={material} frustumCulled={false} renderOrder={5} />;
}
