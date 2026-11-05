/**
 * Schaltelemente: Lamellenpakete (Kupplungen/Bremsen) mit Kolben,
 * Bremsband mit Servo, Rollenfreilauf.
 * Lamellenabstand und Kolbenhub folgen dem simulierten Hydraulikdruck.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ElementId } from '../sim/topology';
import { PartMesh, useSimCtx } from './core';
import { latheX, plateGeometry, radialArray, tubeX } from './geometry';
import type { ColorKey } from './materials';

interface PackProps {
  id: ElementId;
  part: string;
  x0: number;
  x1: number;
  rIn: number;
  rOut: number;
  /** Anzahl Reiblamellen */
  plates: number;
  /** Winkel-Schlüssel des Außenlamellenträgers (null = Gehäuse) */
  outerAngle: string | null;
  innerAngle: string;
  outerKey: ColorKey;
  /** Kolben auf der vorderen (−x) oder hinteren Seite */
  pistonSide: -1 | 1;
}

/** Lamellenpaket: Stahllamellen (Außenverzahnung) und Reiblamellen (Innenverzahnung) im Wechsel */
export function ClutchPack3D(p: PackProps) {
  const steelRef = useRef<THREE.Group>(null);
  const fricRef = useRef<THREE.Group>(null);
  const pistonRef = useRef<THREE.Group>(null);
  const steelPlates = useRef<(THREE.Object3D | null)[]>([]);
  const fricPlates = useRef<(THREE.Object3D | null)[]>([]);
  const t = 0.032;
  const nF = p.plates;
  const nS = p.plates + 1;
  const mid = (p.rIn + p.rOut) / 2;
  const steelGeo = plateGeometry(mid - 0.04, p.rOut, t, { count: 24, side: 'outer', depth: 0.035 });
  const fricGeo = plateGeometry(p.rIn, mid + 0.04, t, { count: 24, side: 'inner', depth: 0.035 });
  const ctx = useSimCtx();
  const pistonW = 0.07;
  const pistonGeo = tubeX(-pistonW / 2, pistonW / 2, p.rIn + 0.02, p.rOut - 0.02);

  useFrame(() => {
    const snap = ctx.getSnapshot();
    const stroke = snap.elements[p.id]?.stroke ?? 0;
    // offene Lamellen mit Lüftspiel, geschlossen aneinandergepresst
    const gap = 0.004 + (1 - stroke) * 0.022;
    const total = (nF + nS) * t + (nF + nS - 1) * gap;
    const pack = p.x1 - p.x0 - pistonW - 0.02;
    const scale = total > pack ? pack / total : 1;
    // Stapel beginnt an der Seite gegenüber dem Kolben (Sprengring)
    const start = p.pistonSide === 1 ? p.x0 + t / 2 : p.x1 - t / 2;
    const dir = p.pistonSide === 1 ? 1 : -1;
    for (let i = 0; i < nF + nS; i++) {
      const xi = start + dir * i * (t + gap) * scale;
      const obj = i % 2 === 0 ? steelPlates.current[i / 2] : fricPlates.current[(i - 1) / 2];
      if (obj) obj.position.x = xi;
    }
    const lastX = start + dir * (nF + nS - 1) * (t + gap) * scale;
    if (pistonRef.current) pistonRef.current.position.x = lastX + dir * (t / 2 + pistonW / 2 + 0.004);
    if (steelRef.current) steelRef.current.rotation.x = p.outerAngle ? ctx.sim.angles[p.outerAngle] : 0;
    if (fricRef.current) fricRef.current.rotation.x = ctx.sim.angles[p.innerAngle];
  });

  return (
    <group>
      <group ref={steelRef}>
        {Array.from({ length: nS }, (_, i) => (
          <group key={i} ref={(el) => (steelPlates.current[i] = el)}>
            <PartMesh geometry={steelGeo} part={p.part} colorKey={p.outerKey} kind="plate" />
          </group>
        ))}
        <group ref={pistonRef}>
          <PartMesh geometry={pistonGeo} part={p.part} colorKey={`EL_${p.id}`} />
        </group>
      </group>
      <group ref={fricRef}>
        {Array.from({ length: nF }, (_, i) => (
          <group key={i} ref={(el) => (fricPlates.current[i] = el)}>
            <PartMesh geometry={fricGeo} part={p.part} colorKey={`EL_${p.id}`} kind="friction" />
          </group>
        ))}
      </group>
    </group>
  );
}

/** Bremsband B1 mit Servokolben (unten), Anker am Gehäuse */
export function Band3D({ x0, x1, r, part }: { x0: number; x1: number; r: number; part: string }) {
  const bandRef = useRef<THREE.Group>(null);
  const rodRef = useRef<THREE.Group>(null);
  const gapHalf = 0.32;
  // Bandlage: von 180°+gap bis 180°−gap (Lücke unten, y < 0)
  const bandGeo = useMemo(
    () =>
      latheX(
        [
          [x0, r + 0.012],
          [x0, r + 0.06],
          [x1, r + 0.06],
          [x1, r + 0.012],
          [x0, r + 0.012],
        ],
        64,
        `band:${x0}:${x1}:${r}`,
        Math.PI + gapHalf,
        Math.PI * 2 - 2 * gapHalf,
      ),
    [x0, x1, r],
  );
  const liningGeo = useMemo(
    () =>
      latheX(
        [
          [x0 + 0.02, r + 0.0],
          [x0 + 0.02, r + 0.012],
          [x1 - 0.02, r + 0.012],
          [x1 - 0.02, r + 0.0],
          [x0 + 0.02, r],
        ],
        64,
        `bandlin:${x0}:${x1}:${r}`,
        Math.PI + gapHalf,
        Math.PI * 2 - 2 * gapHalf,
      ),
    [x0, x1, r],
  );
  const w = x1 - x0;
  const xm = (x0 + x1) / 2;
  const angA = Math.PI + gapHalf;
  const angB = Math.PI - gapHalf;
  const endPos = (ang: number, rr: number): [number, number, number] => [xm, rr * Math.cos(ang), rr * Math.sin(ang)];
  const servoGeo = useMemo(() => new THREE.CylinderGeometry(0.2, 0.2, 0.36, 24), []);
  const rodGeo = useMemo(() => new THREE.CylinderGeometry(0.04, 0.04, 0.42, 10), []);
  const blockGeo = useMemo(() => new THREE.BoxGeometry(w, 0.1, 0.14), [w]);
  const servoY = -(r + 0.42);
  const ctx = useSimCtx();
  useFrame(() => {
    const snap = ctx.getSnapshot();
    const stroke = snap.elements.B1.stroke;
    if (bandRef.current) bandRef.current.scale.set(1, 1 - 0.006 * stroke, 1 - 0.006 * stroke);
    if (rodRef.current) rodRef.current.position.z = 0.06 * stroke;
  });
  return (
    <group>
      <group ref={bandRef}>
        <PartMesh geometry={bandGeo} part={part} colorKey="EL_B1" kind="plate" />
        <PartMesh geometry={liningGeo} part={part} colorKey="EL_B1" kind="friction" />
      </group>
      {/* Anker (Gehäuse) und Betätigungsende */}
      <PartMesh geometry={blockGeo} part={part} colorKey="FIXED" position={endPos(angA, r + 0.1)} />
      <PartMesh geometry={blockGeo} part={part} colorKey="EL_B1" position={endPos(angB, r + 0.1)} />
      {/* Servo: Zylinder (Gehäuse) + Kolbenstange zum Bandende */}
      <PartMesh geometry={servoGeo} part={part} colorKey="FIXED" position={[xm, servoY, -0.55]} rotation={[Math.PI / 2, 0, 0]} />
      <group ref={rodRef}>
        <PartMesh geometry={rodGeo} part={part} colorKey="EL_B1" position={[xm, servoY, -0.2]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  );
}

/** Rollenfreilauf zwischen einem drehenden Innenring und dem Gehäuse (Außenring) */
export function Freewheel3D({ x0, x1, rIn, rOut, angleKey, part }: { x0: number; x1: number; rIn: number; rOut: number; angleKey: string; part: string }) {
  const cageRef = useRef<THREE.Group>(null);
  const n = 30;
  const rr = (rOut - rIn) * 0.22;
  const rm = rIn + (rOut - rIn) * 0.38;
  const rollerGeo = useMemo(
    () => radialArray(`fw-rollers:${x0}:${rm}`, new THREE.CylinderGeometry(rr, rr, x1 - x0 - 0.04, 10).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, 0, 0), n, 'place', rm),
    [rr, x0, x1, rm],
  );
  const outerGeo = tubeX(x0, x1, rm + rr + 0.005, rOut);
  const innerGeo = tubeX(x0 + 0.01, x1 - 0.01, rIn, rm - rr - 0.005);
  const ctx = useSimCtx();
  useFrame(() => {
    if (cageRef.current) cageRef.current.rotation.x = (ctx.sim.angles[angleKey] ?? 0) * 0.5;
  });
  return (
    <group>
      <PartMesh geometry={outerGeo} part={part} colorKey="ELFIX_F1" kind="plate" />
      <group ref={cageRef}>
        <PartMesh geometry={rollerGeo} part={part} colorKey="EL_F1" />
      </group>
      <SpinLocal angleKey={angleKey}>
        <PartMesh geometry={innerGeo} part={part} colorKey="CR" kind="plate" />
      </SpinLocal>
    </group>
  );
}

function SpinLocal({ angleKey, children }: { angleKey: string; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const ctx = useSimCtx();
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = ctx.sim.angles[angleKey] ?? 0;
  });
  return <group ref={ref}>{children}</group>;
}
