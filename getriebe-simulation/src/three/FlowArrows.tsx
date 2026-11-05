/**
 * Animierte Kraftflusspfeile entlang der Pfade der aktuellen Schaltstufe.
 * Im Schubbetrieb laufen die Pfeile rückwärts (Moment fließt vom Rad zum Motor).
 */
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '../state/store';
import { useSimCtx } from './core';
import { flowPathsFor, type FlowKind, type FlowPath } from './flowPaths';
import type { GearId } from '../sim/topology';
import { ROLE_COLORS } from './materials';

const KIND_COLOR: Record<FlowKind, string> = {
  input: ROLE_COLORS.input,
  driven: ROLE_COLORS.driven,
  output: ROLE_COLORS.output,
  reaction: ROLE_COLORS.held,
};

const coneGeo = new THREE.ConeGeometry(0.075, 0.22, 10).rotateZ(-Math.PI / 2);

function PathArrows({ path, z }: { path: FlowPath; z: number }) {
  const pts = useMemo(() => path.pts.map(([x, r]) => new THREE.Vector3(x, r, z)), [path, z]);
  const { lengths, total } = useMemo(() => {
    const lengths = [0];
    for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { lengths, total: lengths[lengths.length - 1] };
  }, [pts]);
  const spacing = 0.42;
  const n = Math.max(1, Math.floor(total / spacing));
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: KIND_COLOR[path.kind], depthTest: false, transparent: true, opacity: 0.95 }),
    [path.kind],
  );
  const offset = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const xAxis = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const ctx = useSimCtx();
  useFrame((_, delta) => {
    const st = useStore.getState();
    const snap = ctx.getSnapshot();
    const moving = st.running ? delta * st.timeScale : 0;
    const sign = snap.coast && path.kind !== 'reaction' ? -1 : 1;
    const torqueOn = Math.abs(snap.turbineTorque) > 1 || path.kind === 'input' || snap.parkLock;
    offset.current = (offset.current + sign * moving * 0.9 + total) % total;
    if (!ref.current) return;
    for (let i = 0; i < n; i++) {
      const s = (offset.current + (i * total) / n) % total;
      let k = 1;
      while (k < lengths.length - 1 && lengths[k] < s) k++;
      const a = pts[k - 1];
      const b = pts[k];
      const segLen = lengths[k] - lengths[k - 1] || 1;
      const u = (s - lengths[k - 1]) / segLen;
      dummy.position.copy(a).lerp(b, u);
      dir.copy(b).sub(a).normalize().multiplyScalar(sign);
      dummy.quaternion.setFromUnitVectors(xAxis, dir);
      dummy.scale.setScalar(torqueOn ? 1 : 0.6);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    mat.opacity = torqueOn ? 0.95 : 0.35;
  });
  return (
    <group>
      <Line points={pts} color={KIND_COLOR[path.kind]} lineWidth={2.2} transparent opacity={0.45} depthTest={false} renderOrder={9} />
      <instancedMesh ref={ref} args={[coneGeo, mat, n]} renderOrder={10} frustumCulled={false} />
    </group>
  );
}

export function FlowArrows({ gear: gearProp, lockup: lockupProp, filter }: { gear?: GearId; lockup?: boolean; filter?: (p: FlowPath) => boolean } = {}) {
  const showFlow = useStore((s) => s.showFlow);
  const gearStore = useStore((s) => s.snapshot.flowGear);
  const lockupStore = useStore((s) => s.snapshot.converter.lockup === 'geschlossen');
  const explode = useStore((s) => s.explode);
  const gear = gearProp ?? gearStore;
  const lockup = lockupProp ?? lockupStore;
  const paths = useMemo(() => flowPathsFor(gear, lockup).filter(filter ?? (() => true)), [gear, lockup, filter]);
  if (!showFlow || explode > 0.05) return null;
  return (
    <group>
      {paths.map((p, i) => (
        <PathArrows key={`${gear}-${lockup}-${i}`} path={p} z={0.02} />
      ))}
    </group>
  );
}
