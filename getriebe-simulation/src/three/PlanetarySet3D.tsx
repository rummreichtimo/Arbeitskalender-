/**
 * Ein einfacher Planetenradsatz als 3D-Modell mit kinematisch korrekt
 * kämmenden Zähnen (Phasenlage aus planetAngle / ringToothOffset).
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { planetAngle, ringToothOffset } from '../sim/planetary';
import { PartMesh } from './core';
import { gearGeometry, radialArray, ringGearGeometry, tubeX } from './geometry';
import type { ColorKey } from './materials';

export interface SetAngles {
  sun: number;
  carrier: number;
  ring: number;
}

export interface PlanetarySetProps {
  zs: number;
  zp: number;
  zr: number;
  planets: number;
  module: number;
  x: number;
  face: number;
  ringOuter: number;
  getAngles: () => SetAngles;
  keys: { sun: ColorKey; carrier: ColorKey; ring: ColorKey; planets: ColorKey };
  parts: { sun: string; carrier: string; ring: string; planets: string };
  /** Sonnenrad hier zeichnen (beim langen Simpson-Sonnenrad separat) */
  renderSun?: boolean;
  sunBore?: number;
  /** Trägerplatten: Innenradius und Lage relativ zur Satzmitte */
  carrierInner?: number;
  carrierFrontInner?: number;
  carrierRearInner?: number;
  carrierFront?: boolean;
  carrierRear?: boolean;
  /** Speichenförmige Trägerplatten (für Frontalansicht im Labor) */
  spiderCarrier?: boolean;
}

export function PlanetarySet3D(p: PlanetarySetProps) {
  const a = ((p.zs + p.zp) * p.module) / 2;
  const sunRef = useRef<THREE.Group>(null);
  const carrierRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Group>(null);
  const planetRefs = useRef<(THREE.Group | null)[]>([]);
  const slots = useMemo(() => Array.from({ length: p.planets }, (_, i) => (2 * Math.PI * i) / p.planets), [p.planets]);
  const ringOffset = ringToothOffset(p.zp, p.zr);

  const sunGeo = gearGeometry(p.zs, p.module, p.face, p.sunBore ?? 0.42);
  const planetGeo = gearGeometry(p.zp, p.module, p.face * 0.96, Math.min(0.12, p.zp * p.module * 0.18));
  const ringGeo = ringGearGeometry(p.zr, p.module, p.face, p.ringOuter, ringOffset);
  const pinGeo = useMemo(
    () => radialArray(`pins:${p.planets}:${a}:${p.face}`, new THREE.CylinderGeometry(0.09, 0.09, p.face + 0.16, 16).rotateZ(Math.PI / 2), p.planets, 'place', a),
    [p.face, p.planets, a],
  );
  const carrierIn = p.carrierInner ?? Math.max(0.3, a - 0.38);
  const carrierOut = a + 0.24;
  const plateT = 0.06;
  const plateFront = tubeX(-p.face / 2 - 0.02 - plateT, -p.face / 2 - 0.02, p.carrierFrontInner ?? carrierIn, carrierOut);
  const plateRear = tubeX(p.face / 2 + 0.02, p.face / 2 + 0.02 + plateT, p.carrierRearInner ?? carrierIn, carrierOut);
  const armGeo = useMemo(() => new THREE.BoxGeometry(plateT, carrierOut - 0.05, 0.22), [carrierOut]);
  const hubGeo = tubeX(-p.face / 2 - 0.08, -p.face / 2 - 0.02, Math.max(0.2, p.zs * p.module * 0.3), Math.max(0.36, p.zs * p.module * 0.45));

  useFrame(() => {
    const an = p.getAngles();
    if (sunRef.current) sunRef.current.rotation.x = an.sun;
    if (carrierRef.current) carrierRef.current.rotation.x = an.carrier;
    if (ringRef.current) ringRef.current.rotation.x = an.ring;
    for (let i = 0; i < slots.length; i++) {
      const g = planetRefs.current[i];
      if (g) g.rotation.x = planetAngle(p.zs, p.zp, an.sun, an.carrier, slots[i]) - an.carrier;
    }
  });

  return (
    <group position={[p.x, 0, 0]}>
      {p.renderSun !== false && (
        <group ref={sunRef}>
          <PartMesh geometry={sunGeo} part={p.parts.sun} colorKey={p.keys.sun} />
        </group>
      )}
      <group ref={ringRef}>
        <PartMesh geometry={ringGeo} part={p.parts.ring} colorKey={p.keys.ring} kind="shell" />
      </group>
      <group ref={carrierRef}>
        <PartMesh geometry={pinGeo} part={p.parts.carrier} colorKey={p.keys.carrier} />
        {slots.map((s, i) => (
          <group key={i} position={[0, a * Math.cos(s), a * Math.sin(s)]}>
            <group ref={(el) => (planetRefs.current[i] = el)}>
              <PartMesh geometry={planetGeo} part={p.parts.planets} colorKey={p.keys.planets} />
            </group>
          </group>
        ))}
        {p.spiderCarrier ? (
          <>
            <PartMesh geometry={hubGeo} part={p.parts.carrier} colorKey={p.keys.carrier} />
            {slots.map((s, i) => (
              <group key={`arm${i}`} rotation={[s - Math.PI / 2, 0, 0]}>
                <PartMesh
                  geometry={armGeo}
                  part={p.parts.carrier}
                  colorKey={p.keys.carrier}
                  position={[-p.face / 2 - 0.05, 0, (carrierOut - 0.05) / 2]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              </group>
            ))}
            <PartMesh geometry={plateRear} part={p.parts.carrier} colorKey={p.keys.carrier} />
          </>
        ) : (
          <>
            {p.carrierFront !== false && <PartMesh geometry={plateFront} part={p.parts.carrier} colorKey={p.keys.carrier} kind="shell" />}
            {p.carrierRear !== false && <PartMesh geometry={plateRear} part={p.parts.carrier} colorKey={p.keys.carrier} kind="shell" />}
          </>
        )}
      </group>
    </group>
  );
}
