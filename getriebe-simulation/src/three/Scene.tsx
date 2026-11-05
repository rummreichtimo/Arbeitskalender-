/**
 * Szenenbausteine: Beleuchtung/Umgebung, Simulationstakt, Kamerasteuerung, Beschriftungen.
 */
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { sim, useStore, type CameraPreset } from '../state/store';
import { L } from './layout';

export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.28} />
      <directionalLight position={[4, 9, 7]} intensity={1.5} />
      <directionalLight position={[-8, -2, -6]} intensity={0.55} color="#9db8ff" />
      <directionalLight position={[2, -6, 8]} intensity={0.35} color="#ffd9b0" />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#39424f']} />
        <Lightformer form="rect" intensity={2.2} position={[0, 6, -6]} scale={[16, 3, 1]} color="#dfe8ff" />
        <Lightformer form="rect" intensity={1.4} position={[-8, 2, 4]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.0} position={[8, -1, 3]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} color="#9fc2ff" />
        <Lightformer form="ring" intensity={0.8} position={[0, -6, 0]} rotation-x={Math.PI / 2} scale={6} color="#ffcf9f" />
      </Environment>
    </>
  );
}

/** Schreibt die globale Simulation fort und aktualisiert den UI-Zustand (~15 Hz). */
export function SimDriver() {
  const acc = useRef(0);
  useFrame((_, delta) => {
    const st = useStore.getState();
    const d = Math.min(delta, 0.05);
    let forceUpdate = false;
    if (st.running) sim.step(d * st.timeScale);
    else if (st.pendingSteps > 0) {
      sim.step((1 / 60) * Math.max(st.timeScale, 0.1));
      useStore.setState({ pendingSteps: st.pendingSteps - 1 });
      forceUpdate = true;
    }
    acc.current += delta;
    if (acc.current > 0.066 || forceUpdate) {
      acc.current = 0;
      useStore.setState({ snapshot: sim.snapshot() });
    }
  });
  return null;
}

export const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number]; label: string }> = {
  iso: { pos: [2.6, 6.2, 14.5], target: [-1.6, -0.4, 0], label: 'Übersicht' },
  front: { pos: [-16, 1.2, 0.01], target: [-1.5, 0, 0], label: 'Vorderansicht' },
  side: { pos: [-1.5, 0.4, 15.5], target: [-1.5, -0.4, 0], label: 'Seitenansicht' },
  top: { pos: [-1.5, 15.5, 0.01], target: [-1.5, 0, 0], label: 'Draufsicht' },
  section: { pos: [-1.2, 1.4, 13], target: [-1.2, -0.2, 0], label: 'Schnitt' },
  tcu: { pos: [-3.5, 1.5, -11], target: [-1.6, -1.6, -1.5], label: 'Steuergerät' },
  explode: { pos: [1.5, 9.5, 24], target: [-2.6, 0, 0], label: 'Explosion' },
  converter: { pos: [-6.2, 2.2, 6.5], target: [-7.0, 0.2, 0], label: 'Wandler' },
  gearsets: { pos: [-1.2, 1.6, 6.8], target: [-1.6, 0.3, 0], label: 'Radsätze' },
  od: { pos: [1.6, 1.4, 5.8], target: [1.2, 0.3, 0], label: 'Overdrive' },
  clutches: { pos: [-3.9, 1.6, 6.2], target: [-4.1, 0.4, 0], label: 'Kupplungen' },
  valvebody: { pos: [-1.2, -0.9, 8.0], target: [-1.6, -2.6, 0.4], label: 'Hydraulik' },
};

const box = new THREE.Box3();
const tmpBox = new THREE.Box3();

export function CameraRig({ presets = CAMERA_PRESETS }: { presets?: Partial<typeof CAMERA_PRESETS> }) {
  const { camera, scene, size, gl } = useThree();
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const request = useStore((s) => s.camera);
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__camera = { camera, controls, gl, scene };
  }, [camera, controls, gl, scene]);
  useEffect(() => {
    if (!controls) return;
    let pos: THREE.Vector3 | null = null;
    let target: THREE.Vector3 | null = null;
    if (request.preset && presets[request.preset]) {
      const p = presets[request.preset]!;
      target = new THREE.Vector3(...p.target);
      pos = new THREE.Vector3(...p.pos);
      // Abstand an das Seitenverhältnis der Leinwand anpassen (schmale Ansichten → weiter weg)
      const aspect = size.width / Math.max(1, size.height);
      const fit = Math.min(2.2, Math.max(0.8, 1.32 / aspect));
      pos.sub(target).multiplyScalar(fit).add(target);
    } else if (request.focus) {
      box.makeEmpty();
      scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.userData.part === request.focus) {
          tmpBox.setFromObject(o);
          box.union(tmpBox);
        }
      });
      if (!box.isEmpty()) {
        target = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3()).length();
        const dir = camera.position.clone().sub(controls.target).normalize();
        pos = target.clone().add(dir.multiplyScalar(Math.max(2.2, size * 1.6)));
      }
    }
    if (!pos || !target) return;
    const tl = gsap.timeline();
    tl.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: 1.2, ease: 'power2.inOut', onUpdate: () => controls.update() }, 0);
    tl.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: 1.2, ease: 'power2.inOut', onUpdate: () => controls.update() }, 0);
    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id, controls]);
  return null;
}

export function Controls() {
  return <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={1.5} maxDistance={40} />;
}

interface LabelDef {
  part: string;
  text: string;
  pos: [number, number, number];
}

export const LABELS: LabelDef[] = [
  { part: 'wandlergehaeuse', text: 'Drehmomentwandler', pos: [L.conv.xc, 3.0, 0] },
  { part: 'oelpumpe', text: 'Ölpumpe', pos: [-5.42, 2.85, 0] },
  { part: 'b1', text: 'B1 Bremsband', pos: [-4.54, 2.42, 0] },
  { part: 'k2', text: 'K2', pos: [-4.55, 1.74, 0.25] },
  { part: 'k1', text: 'K1', pos: [-3.7, 1.27, 0.25] },
  { part: 'planeten-vorne', text: 'Vorderer Satz', pos: [-2.3, -1.95, 0.3] },
  { part: 'planeten-hinten', text: 'Hinterer Satz', pos: [-1.05, -2.05, 0.3] },
  { part: 'b2', text: 'B2', pos: [-1.03, 2.5, 0] },
  { part: 'f1', text: 'F1', pos: [-0.55, 2.5, 0] },
  { part: 'k3', text: 'K3', pos: [0.6, 1.7, 0.25] },
  { part: 'b3', text: 'B3', pos: [0.56, 2.5, 0] },
  { part: 'od-planeten', text: 'Overdrive-Satz', pos: [1.6, -2.05, 0.3] },
  { part: 'parksperre', text: 'Parksperre', pos: [L.park.x, -1.45, 0.2] },
  { part: 'ausgangswelle', text: 'Abtrieb', pos: [5.2, 0.95, 0] },
  { part: 'motor-flansch', text: 'Motor', pos: [-8.9, 1.0, 0] },
  { part: 'ventilkoerper', text: 'Ventilkörper', pos: [-2.0, -3.3, 1.0] },
  { part: 'magnetventile', text: 'Magnetventile', pos: [-2.25, -2.6, 1.5] },
  { part: 'sensor-turbine', text: 'n-Turbine', pos: [L.toneIn.x, 2.75, 0] },
  { part: 'sensor-abtrieb', text: 'n-Abtrieb', pos: [L.toneOut.x, 2.45, 0] },
];

/**
 * Beschriftungen als DOM-Overlay: Die Projektion erfolgt im Render-Loop
 * (LabelProjector), die Buttons liegen außerhalb der Leinwand (LabelLayer).
 */
const labelEls = new Map<string, HTMLElement>();
const projVec = new THREE.Vector3();

export function LabelProjector({ defs = LABELS }: { defs?: LabelDef[] }) {
  const { camera, size } = useThree();
  useFrame(() => {
    for (const l of defs) {
      const el = labelEls.get(l.part + l.text);
      if (!el) continue;
      projVec.set(...l.pos).project(camera);
      const visible = projVec.z < 1 && Math.abs(projVec.x) < 1.1 && Math.abs(projVec.y) < 1.1;
      const x = ((projVec.x + 1) / 2) * size.width;
      const y = ((1 - projVec.y) / 2) * size.height;
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.opacity = visible ? '1' : '0';
    }
  });
  return null;
}

export function LabelLayer({ defs = LABELS }: { defs?: LabelDef[] }) {
  const show = useStore((s) => s.showLabels);
  const explode = useStore((s) => s.explode);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  if (!show || explode > 0.05) return null;
  return (
    <div className="label-layer">
      {defs.map((l) => (
        <button
          key={l.part + l.text}
          ref={(el) => {
            if (el) labelEls.set(l.part + l.text, el);
            else labelEls.delete(l.part + l.text);
          }}
          className={`label3d ${selected === l.part ? 'active' : ''}`}
          onClick={() => select(selected === l.part ? null : l.part)}
        >
          {l.text}
        </button>
      ))}
    </div>
  );
}

/**
 * Setzt die Kamera so, dass ein Bereich (Breite × Höhe um center) vollständig sichtbar ist.
 * Reagiert auf Größenänderungen der Leinwand.
 */
export function AutoFit({ center, width, height, dir }: { center: [number, number, number]; width: number; height: number; dir: [number, number, number] }) {
  const { camera, size } = useThree();
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const vfov = (cam.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(1, size.height);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const d = Math.max(width / 2 / Math.tan(hfov / 2), height / 2 / Math.tan(vfov / 2)) * 1.08;
    const c = new THREE.Vector3(...center);
    const v = new THREE.Vector3(...dir).normalize().multiplyScalar(d);
    cam.position.copy(c).add(v);
    if (controls) {
      controls.target.copy(c);
      controls.update();
    } else cam.lookAt(c);
  }, [camera, controls, size.width, size.height, center, width, height, dir]);
  return null;
}
