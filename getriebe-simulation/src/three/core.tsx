/**
 * Gemeinsame Bausteine der 3D-Szene: Bauteil-Mesh mit registriertem Material,
 * drehende Glieder, Explosionsgruppen und die zentrale Materialsteuerung.
 */
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import gsap from 'gsap';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import type { SimSnapshot, TransmissionSim } from '../sim/simulation';
import { ELEMENTS, type ElementId, type Role, type RoleKey } from '../sim/topology';
import { sim, useStore } from '../state/store';
import { EXPLODE } from './layout';
import {
  ROLE_COLORS,
  SECTION_PLANE,
  SLIP_COLOR,
  STEEL,
  createMaterial,
  registry,
  type ColorKey,
  type MaterialEntry,
  type PartKind,
} from './materials';

// ---------------------------------------------------------------------------
// Simulationskontext (erlaubt mehrere unabhängige Simulationen, z. B. Gangvergleich)
// ---------------------------------------------------------------------------

export interface SimCtx {
  sim: TransmissionSim;
  getSnapshot: () => SimSnapshot;
}
export const SimContext = createContext<SimCtx>({ sim, getSnapshot: () => useStore.getState().snapshot });
export const useSimCtx = () => useContext(SimContext);

// ---------------------------------------------------------------------------
// Bauteil-Mesh
// ---------------------------------------------------------------------------

export interface PartMeshProps {
  geometry: THREE.BufferGeometry;
  part: string;
  colorKey: ColorKey;
  kind?: PartKind;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  renderOrder?: number;
}

export function useRegisteredMaterial(part: string, colorKey: ColorKey, kind: PartKind): THREE.MeshStandardMaterial {
  const mat = useMemo(() => createMaterial(kind, colorKey), [kind, colorKey]);
  useEffect(() => {
    const entry: MaterialEntry = { mat, key: colorKey, part, kind, base: mat.color.clone() };
    registry.add(entry);
    return () => {
      registry.delete(entry);
      mat.dispose();
    };
  }, [mat, part, colorKey, kind]);
  return mat;
}

export function onPartClick(part: string) {
  return (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 5) return;
    e.stopPropagation();
    const st = useStore.getState();
    st.select(st.selected === part ? null : part);
  };
}

export function PartMesh({ geometry, part, colorKey, kind = 'metal', position, rotation, scale, renderOrder }: PartMeshProps) {
  const mat = useRegisteredMaterial(part, colorKey, kind);
  return (
    <mesh
      geometry={geometry}
      material={mat}
      userData={{ part }}
      position={position}
      rotation={rotation}
      scale={scale}
      renderOrder={renderOrder}
      onClick={onPartClick(part)}
    />
  );
}

// ---------------------------------------------------------------------------
// Drehende Glieder
// ---------------------------------------------------------------------------

/** Gruppe, deren Drehwinkel um X dem Simulationswinkel des Glieds folgt. */
export function Spin({ angleKey, children, offset = 0 }: { angleKey: string; children: ReactNode; offset?: number }) {
  const ref = useRef<THREE.Group>(null);
  const ctx = useSimCtx();
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = (ctx.sim.angles[angleKey] ?? 0) + offset;
  });
  return <group ref={ref}>{children}</group>;
}

// ---------------------------------------------------------------------------
// Explosionsansicht (GSAP-animierter Faktor)
// ---------------------------------------------------------------------------

export const explodeProxy = { value: 0 };
// Kameraflüge und Explosion sollen auch bei niedriger Bildrate in Echtzeit ablaufen
gsap.ticker.lagSmoothing(0);

export function ExplodeDriver() {
  const explode = useStore((s) => s.explode);
  useEffect(() => {
    const tw = gsap.to(explodeProxy, { value: explode, duration: 1.1, ease: 'power2.inOut' });
    return () => {
      tw.kill();
    };
  }, [explode]);
  return null;
}

export function Explode({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const off = EXPLODE[id] ?? [0, 0, 0];
  useFrame(() => {
    if (!ref.current) return;
    const f = explodeProxy.value;
    ref.current.position.set(off[0] * f, off[1] * f, off[2] * f);
  });
  return <group ref={ref}>{children}</group>;
}

// ---------------------------------------------------------------------------
// Zentrale Materialsteuerung (Kraftflussfarben, Schnitt, Röntgen, Isolieren)
// ---------------------------------------------------------------------------

const tmp = new THREE.Color();
const white = new THREE.Color('#ffffff');
const highlightColor = new THREE.Color('#ffe066');
const roleColorCache: Record<string, THREE.Color> = {};
const col = (hex: string) => (roleColorCache[hex] ??= new THREE.Color(hex));
/** Rollenfarbe mit Stahl gemischt – bleibt metallisch, aber eindeutig erkennbar */
const tintCache: Partial<Record<Role, THREE.Color>> = {};
const tinted = (r: Role) => (tintCache[r] ??= new THREE.Color(STEEL).lerp(new THREE.Color(ROLE_COLORS[r]), 0.72));

function elementColor(e: ElementId, snap: SimSnapshot, fixedSide: boolean): { hex: string; slip: boolean } {
  const el = snap.elements[e];
  const spec = ELEMENTS[e];
  const isBrake = !spec.b;
  switch (el.state) {
    case 'geschlossen':
    case 'sperrt':
    case 'gesperrt':
      if (Math.abs(el.torque) < 0.5 && snap.flowGear !== 'N' && snap.flowGear !== 'P') {
        // geschlossen, aber lastfrei
        return { hex: isBrake ? '#5f86b8' : '#b08a5c', slip: false };
      }
      if (isBrake) return { hex: ROLE_COLORS.held, slip: false };
      void fixedSide;
      return { hex: ROLE_COLORS.driven, slip: false };
    case 'übernimmt':
    case 'löst':
    case 'schlupft':
      return { hex: SLIP_COLOR, slip: true };
    case 'füllt':
      return { hex: '#d6c46a', slip: false };
    default:
      return { hex: ROLE_COLORS.idle, slip: false };
  }
}

function targetColor(entry: MaterialEntry, snap: SimSnapshot, flow: boolean): { color: THREE.Color; emissive: number; pulse: boolean } {
  const k = entry.key;
  if (entry.kind === 'housing') return { color: entry.base, emissive: 0, pulse: false };
  if (!flow) return { color: entry.base, emissive: 0, pulse: false };
  if (k === 'ENG') return { color: tinted('input'), emissive: 0.1, pulse: false };
  if (k === 'STATOR') {
    const held = snap.converter.statorLocked && snap.converter.lockup !== 'geschlossen' && snap.engineRpm > 50;
    return { color: col(held ? ROLE_COLORS.held : ROLE_COLORS.idle), emissive: held ? 0.15 : 0, pulse: false };
  }
  if (k === 'LOCKUP') {
    const l = snap.converter.lockup;
    if (l === 'geschlossen') return { color: col(ROLE_COLORS.input), emissive: 0.18, pulse: false };
    if (l === 'schlupft') return { color: col(SLIP_COLOR), emissive: 0.25, pulse: true };
    return { color: col(ROLE_COLORS.idle), emissive: 0, pulse: false };
  }
  if (k === 'PARK') {
    return snap.parkLock ? { color: col(ROLE_COLORS.held), emissive: 0.2, pulse: false } : { color: entry.base, emissive: 0, pulse: false };
  }
  if (k.startsWith('EL_') || k.startsWith('ELFIX_')) {
    const id = k.replace('ELFIX_', '').replace('EL_', '') as ElementId;
    const c = elementColor(id, snap, k.startsWith('ELFIX_'));
    return { color: col(c.hex), emissive: c.slip ? 0.3 : c.hex === ROLE_COLORS.idle ? 0 : 0.15, pulse: c.slip };
  }
  if (k === 'FIXED' || k === 'STEEL' || k === 'TCU' || k === 'SENSOR' || k === 'VALVE') return { color: entry.base, emissive: 0, pulse: false };
  const role: Role = snap.roles[k as RoleKey] ?? 'idle';
  if (role === 'idle') return { color: col('#9aa2ab'), emissive: 0, pulse: false };
  return { color: tinted(role), emissive: 0.1, pulse: false };
}

export function MaterialController({ getSnapshot }: { getSnapshot?: () => SimSnapshot } = {}) {
  const ctx = useSimCtx();
  useFrame((state, delta) => {
    const st = useStore.getState();
    const snap = getSnapshot ? getSnapshot() : ctx.getSnapshot();
    const flow = st.showFlow;
    const t = state.clock.elapsedTime;
    const k = Math.min(1, delta * 6);
    const explodeF = explodeProxy.value;
    for (const e of registry) {
      const { color, emissive, pulse } = targetColor(e, snap, flow);
      e.mat.color.lerp(color, k);
      let em = emissive * (pulse ? 0.6 + 0.4 * Math.sin(t * 9) : 1);
      tmp.copy(e.mat.color);
      // Auswahl / Hervorhebung
      const isSel = st.selected === e.part;
      const isHl = st.highlight.includes(e.part);
      if (isSel) {
        tmp.lerp(white, 0.35);
        em = Math.max(em, 0.32 + 0.12 * Math.sin(t * 4));
      } else if (isHl) {
        tmp.lerp(highlightColor, 0.5);
        em = Math.max(em, 0.25 + 0.2 * Math.sin(t * 4));
      }
      e.mat.emissive.copy(tmp);
      e.mat.emissiveIntensity = em;

      // Transparenz
      let opacity = 1;
      if (e.kind === 'housing') opacity = (st.xray ? Math.min(st.housingOpacity, 0.06) : st.housingOpacity) * (1 - 0.75 * explodeF);
      else if (e.kind === 'shell' && st.xray) opacity = 0.2;
      if (st.isolate && st.selected && e.part !== st.selected) opacity = Math.min(opacity, 0.05);
      const transparent = opacity < 0.999;
      if (e.mat.transparent !== transparent) {
        e.mat.transparent = transparent;
        e.mat.needsUpdate = true;
      }
      e.mat.opacity = opacity;
      e.mat.depthWrite = !transparent || opacity > 0.5;

      // Schnittansicht
      const clip = st.section === 'full' || (st.section === 'shells' && e.kind !== 'metal' && e.kind !== 'detail');
      const want = clip ? 1 : 0;
      if (e.mat.clippingPlanes?.length !== want) {
        e.mat.clippingPlanes = clip ? [SECTION_PLANE] : [];
        e.mat.needsUpdate = true;
      }
    }
  });
  return null;
}
