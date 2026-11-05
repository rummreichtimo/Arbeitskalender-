/**
 * Materialverwaltung: Jedes Bauteil erhält eine eigene Materialinstanz, deren
 * Farbe pro Frame aus dem Simulationszustand (Kraftfluss-Rolle) abgeleitet wird.
 */
import * as THREE from 'three';
import type { ElementId, Role, RoleKey } from '../sim/topology';

export const ROLE_COLORS: Record<Role, string> = {
  input: '#e5484d',
  driven: '#f2902c',
  held: '#3d8ef7',
  output: '#2fbf6a',
  idle: '#8b939d',
};

export const SLIP_COLOR = '#f5d90a';
export const STEEL = '#a7afb9';
export const STEEL_DARK = '#6c737c';
export const FRICTION = '#8a6a4b';

export type ColorKey =
  | RoleKey
  | 'ENG'
  | 'STATOR'
  | 'FIXED'
  | 'HOUSING'
  | 'LOCKUP'
  | 'PARK'
  | 'STEEL'
  | 'TCU'
  | 'SENSOR'
  | 'VALVE'
  | `EL_${ElementId}`
  | `ELFIX_${ElementId}`;

/** Art des Bauteils – steuert Transparenz/Schnitt-Verhalten */
export type PartKind = 'metal' | 'shell' | 'housing' | 'friction' | 'plate' | 'detail';

export interface MaterialEntry {
  mat: THREE.MeshStandardMaterial;
  key: ColorKey;
  part: string;
  kind: PartKind;
  base: THREE.Color;
}

export const registry = new Set<MaterialEntry>();

/** Gemeinsame Schnittebene (alles mit z > 0 wird ausgeblendet) */
export const SECTION_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

export function createMaterial(kind: PartKind, key: ColorKey): THREE.MeshStandardMaterial {
  const base =
    kind === 'friction'
      ? FRICTION
      : kind === 'housing'
        ? '#9fb4c8'
        : key === 'FIXED'
          ? STEEL_DARK
          : key === 'TCU'
            ? '#2b3138'
            : STEEL;
  const mat = new THREE.MeshStandardMaterial({
    color: base,
    metalness: kind === 'friction' ? 0.1 : kind === 'housing' ? 0.2 : 0.62,
    roughness: kind === 'friction' ? 0.85 : kind === 'housing' ? 0.15 : 0.34,
    envMapIntensity: kind === 'housing' ? 0.6 : 1.15,
    side: kind === 'shell' || kind === 'housing' || kind === 'plate' ? THREE.DoubleSide : THREE.FrontSide,
    transparent: kind === 'housing',
    opacity: kind === 'housing' ? 0.16 : 1,
    depthWrite: kind !== 'housing',
  });
  return mat;
}
