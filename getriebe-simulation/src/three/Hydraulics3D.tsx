/**
 * Elektrohydraulik (vereinfachtes Lehrmodell): Ventilkörper mit Schieberventilen
 * und Magnetventilen, Ölwanne, Druckkanäle zu den Schaltelementen, Sensoren und
 * elektronisches Getriebesteuergerät (TCU) mit Kabeln.
 * Kanalführung ist schematisch (reale Kanäle verlaufen im Gehäuse und über Wellendichtungen).
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ElementId } from '../sim/topology';
import { useStore } from '../state/store';
import { Explode, PartMesh } from './core';
import { L } from './layout';

type ChannelId = ElementId | 'WK' | 'SYS';

interface ChannelDef {
  id: ChannelId;
  from: [number, number, number];
  to: [number, number, number];
}

const VB = L.valveBody;
const vbTop = VB.y1;

export const CHANNELS: ChannelDef[] = [
  { id: 'SYS', from: [-5.42, -2.45, 0.35], to: [-4.45, vbTop, 0.35] },
  { id: 'WK', from: [-4.3, vbTop, -0.6], to: [-5.35, -2.45, -0.45] },
  { id: 'K2', from: [-4.05, vbTop, 0.1], to: [-4.88, -2.5, 0.1] },
  { id: 'B1', from: [-3.8, vbTop, -0.55], to: [-4.54, -2.62, -0.78] },
  { id: 'K1', from: [-3.3, vbTop, 0.0], to: [-4.2, -2.5, 0.0] },
  { id: 'B2', from: [-1.5, vbTop, 0.0], to: [-1.03, -2.42, 0.0] },
  { id: 'K3', from: [-0.4, vbTop, 0.25], to: [0.22, -2.5, 0.25] },
  { id: 'B3', from: [0.3, vbTop, -0.25], to: [0.56, -2.42, -0.25] },
];

const C_LOW = new THREE.Color('#33404d');
const C_HIGH = new THREE.Color('#2fd4ff');
const C_FILL = new THREE.Color('#ffd84d');

function Channel({ def }: { def: ChannelDef }) {
  const { curve, geo } = useMemo(() => {
    const a = new THREE.Vector3(...def.from);
    const b = new THREE.Vector3(...def.to);
    const mid1 = new THREE.Vector3(a.x, Math.max(a.y, b.y) - 0.05, a.z);
    const mid2 = new THREE.Vector3(b.x, Math.max(a.y, b.y) - 0.05, b.z);
    const curve = new THREE.CatmullRomCurve3([a, mid1, mid2, b], false, 'centripetal');
    return { curve, geo: new THREE.TubeGeometry(curve, 40, 0.032, 8, false) };
  }, [def]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: C_LOW, emissive: C_LOW, emissiveIntensity: 0.3, metalness: 0.2, roughness: 0.4 }), []);
  const dots = useRef<THREE.InstancedMesh>(null);
  const n = 7;
  const phase = useRef(Math.random());
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, delta) => {
    const st = useStore.getState();
    const snap = st.snapshot;
    const pl = Math.max(1, snap.hydraulics.linePressure);
    let p = 0;
    let filling = false;
    if (def.id === 'SYS') p = snap.hydraulics.linePressure;
    else if (def.id === 'WK') p = snap.hydraulics.elements.WK.pressure;
    else {
      p = snap.hydraulics.elements[def.id].pressure;
      const stt = snap.elements[def.id].state;
      filling = stt === 'füllt' || stt === 'übernimmt';
    }
    const f = Math.min(1, p / pl);
    const target = filling ? C_FILL : C_LOW.clone().lerp(C_HIGH, f);
    mat.color.lerp(target, Math.min(1, delta * 8));
    mat.emissive.copy(mat.color);
    mat.emissiveIntensity = 0.25 + 0.5 * f;
    const dt = st.running ? delta * st.timeScale : 0;
    phase.current = (phase.current + dt * (filling ? 1.2 : f > 0.05 ? 0.25 : 0)) % 1;
    if (dots.current) {
      for (let i = 0; i < n; i++) {
        const u = (phase.current + i / n) % 1;
        const pt = curve.getPointAt(def.id === 'WK' || def.id === 'SYS' ? u : u);
        dummy.position.copy(pt);
        const s = f > 0.05 || filling ? 1 : 0.001;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        dots.current.setMatrixAt(i, dummy.matrix);
      }
      dots.current.instanceMatrix.needsUpdate = true;
    }
  });
  const dotGeo = useMemo(() => new THREE.SphereGeometry(0.045, 8, 6), []);
  const dotMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#c8f4ff' }), []);
  return (
    <group onClick={(e) => (e.stopPropagation(), useStore.getState().select('hydraulikkanaele'))}>
      <mesh geometry={geo} material={mat} />
      <instancedMesh ref={dots} args={[dotGeo, dotMat, n]} />
    </group>
  );
}

/** Schieberventil im Ventilkörper; Position abhängig vom Schaltzustand */
function Spool({ x, z, getOffset, part }: { x: number; z: number; getOffset: () => number; part: string }) {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const pts: [number, number][] = [];
    const lands = 4;
    const len = 0.9;
    for (let i = 0; i <= lands * 2; i++) {
      const xx = -len / 2 + (len * i) / (lands * 2);
      const r = i % 2 === 0 ? 0.075 : 0.045;
      pts.push([xx, r]);
      pts.push([xx + len / (lands * 2) - 0.001, r]);
    }
    const prof = pts.map(([a, r]) => new THREE.Vector2(r, a));
    const g = new THREE.LatheGeometry(prof, 16);
    g.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
    return g;
  }, []);
  const boreGeo = useMemo(() => new THREE.CylinderGeometry(0.09, 0.09, 1.25, 16, 1, true).rotateZ(Math.PI / 2), []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const target = getOffset();
    ref.current.position.x += (target - ref.current.position.x) * Math.min(1, dt * 6);
  });
  return (
    <group position={[x, vbTop + 0.02, z]}>
      <PartMesh geometry={boreGeo} part={part} colorKey="VALVE" kind="shell" />
      <group ref={ref}>
        <PartMesh geometry={geo} part={part} colorKey="STEEL" />
      </group>
    </group>
  );
}

function Solenoid({ x, getOn, label }: { x: number; getOn: () => number; label: string }) {
  const coil = useMemo(() => new THREE.CylinderGeometry(0.16, 0.16, 0.38, 20).rotateX(Math.PI / 2), []);
  const plug = useMemo(() => new THREE.BoxGeometry(0.14, 0.12, 0.12), []);
  const glowMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#40362a', emissive: '#ffb020', emissiveIntensity: 0, metalness: 0.3, roughness: 0.5 }), []);
  useFrame(() => {
    const on = getOn();
    glowMat.emissiveIntensity = 0.05 + 1.1 * on;
    glowMat.color.set(on > 0.5 ? '#7a5a1c' : '#3a3530');
  });
  void label;
  return (
    <group position={[x, (VB.y0 + VB.y1) / 2, VB.z + 0.19]} onClick={(e) => (e.stopPropagation(), useStore.getState().select('magnetventile'))}>
      <mesh geometry={coil} material={glowMat} />
      <PartMesh geometry={plug} part="magnetventile" colorKey="TCU" position={[0, 0, 0.25]} />
    </group>
  );
}

/** Kabel vom Steuergerät (hinten) zum Ziel; Führung hinter bzw. unter dem Gehäuse */
function Cable({ from, to, part = 'tcu', via }: { from: [number, number, number]; to: [number, number, number]; part?: string; via?: [number, number, number][] }) {
  const geo = useMemo(() => {
    const pts = [new THREE.Vector3(...from), ...(via ?? []).map((v) => new THREE.Vector3(...v)), new THREE.Vector3(...to)];
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 48, 0.018, 6, false);
  }, [from, to, via]);
  return <PartMesh geometry={geo} part={part} colorKey="TCU" />;
}

export const TCU_POS: [number, number, number] = [-1.6, -2.1, -3.4];
export const SENSOR_POS = {
  turbine: [L.toneIn.x, 2.25, 0] as [number, number, number],
  output: [L.toneOut.x, 1.95, 0] as [number, number, number],
  temp: [0.75, (L.valveBody.y0 + L.valveBody.y1) / 2, L.valveBody.z + 0.08] as [number, number, number],
  range: [-2.4, -2.1, 2.45] as [number, number, number],
};

function Sensors() {
  const body = useMemo(() => new THREE.CylinderGeometry(0.11, 0.11, 0.5, 16), []);
  const tip = useMemo(() => new THREE.CylinderGeometry(0.05, 0.05, 0.32, 10), []);
  const box = useMemo(() => new THREE.BoxGeometry(0.4, 0.3, 0.12), []);
  return (
    <Explode id="sensors">
      <group position={SENSOR_POS.turbine}>
        <PartMesh geometry={body} part="sensor-turbine" colorKey="SENSOR" />
        <PartMesh geometry={tip} part="sensor-turbine" colorKey="SENSOR" position={[0, -0.4, 0]} />
      </group>
      <group position={SENSOR_POS.output}>
        <PartMesh geometry={body} part="sensor-abtrieb" colorKey="SENSOR" />
        <PartMesh geometry={tip} part="sensor-abtrieb" colorKey="SENSOR" position={[0, -0.5, 0]} scale={[1, 2.2, 1]} />
      </group>
      <group position={SENSOR_POS.temp}>
        <PartMesh geometry={tip} part="sensor-temperatur" colorKey="SENSOR" rotation={[Math.PI / 2, 0, 0]} />
      </group>
      <group position={SENSOR_POS.range}>
        <PartMesh geometry={box} part="sensor-waehlhebel" colorKey="SENSOR" />
      </group>
    </Explode>
  );
}

function Tcu() {
  const box = useMemo(() => new THREE.BoxGeometry(1.7, 0.26, 1.05), []);
  const led = useMemo(() => new THREE.SphereGeometry(0.05, 10, 8), []);
  const ledMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#30ff8a' }), []);
  const chip = useMemo(() => new THREE.BoxGeometry(0.4, 0.05, 0.4), []);
  useFrame(({ clock }) => {
    const snap = useStore.getState().snapshot;
    const busy = !!snap.shift;
    const on = busy ? Math.sin(clock.elapsedTime * 18) > 0 : Math.sin(clock.elapsedTime * 2) > 0.6;
    ledMat.color.set(busy ? (on ? '#ffd030' : '#3a2a00') : on ? '#30ff8a' : '#0a3a1a');
  });
  return (
    <group position={TCU_POS}>
      <PartMesh geometry={box} part="tcu" colorKey="TCU" />
      <PartMesh geometry={chip} part="tcu" colorKey="STEEL" position={[-0.3, 0.15, 0]} />
      <mesh geometry={led} material={ledMat} position={[0.6, 0.16, 0.3]} />
    </group>
  );
}

export function Hydraulics3D() {
  const vbGeo = useMemo(() => new THREE.BoxGeometry(VB.x1 - VB.x0, VB.y1 - VB.y0, VB.z * 2), []);
  const panGeo = useMemo(() => new THREE.BoxGeometry(VB.x1 - VB.x0 + 0.6, 0.55, VB.z * 2 + 0.6), []);
  const oilGeo = useMemo(() => new THREE.BoxGeometry(VB.x1 - VB.x0 + 0.5, 0.3, VB.z * 2 + 0.5), []);
  const oilMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b5651d', transparent: true, opacity: 0.35, roughness: 0.2, depthWrite: false }), []);
  const xm = (VB.x0 + VB.x1) / 2;
  const ym = (VB.y0 + VB.y1) / 2;
  const snapGear = () => {
    const s = useStore.getState().snapshot;
    return s.shift ? (s.shift.phase === 'fill' ? s.shift.from : s.shift.to) : s.gear;
  };
  const gearNum = () => {
    const g = snapGear();
    return g === '1' || g === '1M' ? 1 : g === '2' ? 2 : g === '3' ? 3 : g === '4' ? 4 : 0;
  };
  const manualOffset = () => {
    const sel = useStore.getState().snapshot.hydraulics.manualValve;
    return { P: -0.22, R: -0.11, N: 0, D: 0.12 }[sel];
  };
  const sol = () => useStore.getState().snapshot.hydraulics.solenoids;
  return (
    <>
      <Explode id="valveBody">
        <PartMesh geometry={vbGeo} part="ventilkoerper" colorKey="VALVE" position={[xm, ym, 0]} />
        <PartMesh geometry={panGeo} part="oelwanne" colorKey="HOUSING" kind="housing" position={[xm, VB.y0 - 0.2, 0]} />
        <mesh geometry={oilGeo} material={oilMat} position={[xm, VB.y0 - 0.32, 0]} />
        <Spool x={-3.7} z={0.45} part="ventilkoerper" getOffset={manualOffset} />
        <Spool x={-2.4} z={0.45} part="ventilkoerper" getOffset={() => (gearNum() >= 2 ? 0.14 : 0)} />
        <Spool x={-1.1} z={0.45} part="ventilkoerper" getOffset={() => (gearNum() >= 3 ? 0.14 : 0)} />
        <Spool x={0.2} z={0.45} part="ventilkoerper" getOffset={() => (gearNum() >= 4 ? 0.14 : 0)} />
        <Spool x={-2.4} z={-0.45} part="ventilkoerper" getOffset={() => sol().MVWK * 0.14} />
        <Spool x={-1.1} z={-0.45} part="ventilkoerper" getOffset={() => (useStore.getState().snapshot.hydraulics.linePressure / 20) * 0.14} />
        <Solenoid x={-3.6} label="MV1" getOn={() => (sol().MV1 ? 1 : 0)} />
        <Solenoid x={-2.7} label="MV2" getOn={() => (sol().MV2 ? 1 : 0)} />
        <Solenoid x={-1.8} label="MV-WK" getOn={() => sol().MVWK} />
        <Solenoid x={-0.9} label="DR" getOn={() => sol().DR * 0.7} />
        {CHANNELS.map((c) => (
          <Channel key={c.id} def={c} />
        ))}
      </Explode>
      <Sensors />
      <Explode id="tcu">
        <Tcu />
        {[-3.6, -2.7, -1.8, -0.9].map((x, i) => (
          <Cable
            key={x}
            from={[TCU_POS[0] - 0.6 + i * 0.4, TCU_POS[1] - 0.1, TCU_POS[2] + 0.5]}
            to={[x, ym - 0.12, VB.z + 0.42]}
            via={[
              [x * 0.5 + TCU_POS[0] * 0.5, VB.y0 - 0.65, -0.9],
              [x, VB.y0 - 0.6, VB.z + 0.7],
            ]}
          />
        ))}
        <Cable from={[TCU_POS[0] - 0.8, TCU_POS[1] + 0.1, TCU_POS[2]]} to={[SENSOR_POS.turbine[0], SENSOR_POS.turbine[1] + 0.25, 0]} via={[[SENSOR_POS.turbine[0], 1.0, -2.9], [SENSOR_POS.turbine[0], 2.6, -0.8]]} />
        <Cable from={[TCU_POS[0] + 0.8, TCU_POS[1] + 0.1, TCU_POS[2]]} to={[SENSOR_POS.output[0], SENSOR_POS.output[1] + 0.25, 0]} via={[[SENSOR_POS.output[0], 0.6, -2.4], [SENSOR_POS.output[0], 2.3, -0.6]]} />
        <Cable from={[TCU_POS[0] + 0.6, TCU_POS[1] - 0.1, TCU_POS[2] + 0.5]} to={SENSOR_POS.temp} via={[[0.4, VB.y0 - 0.6, -0.9], [0.75, VB.y0 - 0.55, VB.z + 0.5]]} />
        <Cable from={[TCU_POS[0] - 0.6, TCU_POS[1] + 0.1, TCU_POS[2] + 0.5]} to={SENSOR_POS.range} via={[[-2.4, -2.9, -2.6], [-2.4, -2.95, 2.3]]} />
      </Explode>
    </>
  );
}
