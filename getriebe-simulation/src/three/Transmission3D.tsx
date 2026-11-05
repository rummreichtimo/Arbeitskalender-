/**
 * Gesamtmodell des Lehrgetriebes LM-4S (siehe layout.ts für die Schachtelung).
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SETS } from '../sim/topology';
import { Explode, PartMesh, Spin, useSimCtx } from './core';
import { Converter3D } from './Converter3D';
import { Band3D, ClutchPack3D, Freewheel3D } from './Elements3D';
import { gearGeometry, latheX, ringGearGeometry, tubeX } from './geometry';
import { Hydraulics3D } from './Hydraulics3D';
import { FACE, L, SET_LAYOUT } from './layout';
import { PlanetarySet3D } from './PlanetarySet3D';

export function Transmission3D({ gearsetOnly = false }: { gearsetOnly?: boolean }) {
  const g = useMemo(() => buildStaticGeometry(), []);
  const ctx = useSimCtx();
  const ang = (k: string) => ctx.sim.angles[k] ?? 0;
  return (
    <group>
      {!gearsetOnly && (
        <>
          <Explode id="engine">
            <Spin angleKey="ENG">
              <PartMesh geometry={g.flexplate} part="motor-flansch" colorKey="ENG" kind="shell" />
              <PartMesh geometry={g.starterRing} part="motor-flansch" colorKey="ENG" kind="shell" position={[L.engine.x1 + 0.03, 0, 0]} />
              <PartMesh geometry={g.crank} part="motor-flansch" colorKey="ENG" />
            </Spin>
          </Explode>
          <Explode id="converter">
            <Converter3D x={L.conv.xc} particles={650} />
          </Explode>
          <Explode id="pump">
            <PartMesh geometry={g.pumpHousing} part="oelpumpe" colorKey="FIXED" kind="shell" />
            <PartMesh geometry={g.statorSupport} part="leitradwelle" colorKey="FIXED" />
            <OilPump3D />
          </Explode>
        </>
      )}

      {/* Eingangswelle + Eingangstrommel (Glied IN) */}
      <Explode id="inDrum">
        <Spin angleKey="IN">
          {!gearsetOnly && <PartMesh geometry={g.inputShaft} part="eingangswelle" colorKey="IN" />}
          <PartMesh geometry={g.inDrum} part="eingangstrommel" colorKey="IN" kind="shell" />
          <PartMesh geometry={g.toneIn} part="sensor-turbine" colorKey="IN" />
        </Spin>
        <ClutchPack3D id="K1" part="k1" x0={L.k1.x0} x1={L.k1.x1} rIn={L.k1.rIn} rOut={L.k1.rOut} plates={4} outerAngle="IN" innerAngle="RF" outerKey="IN" pistonSide={-1} />
      </Explode>

      {/* Sonnenradtrommel mit Mantel (Glied S), K2, Bremsband B1 */}
      <Explode id="drumS">
        <Spin angleKey="S">
          <PartMesh geometry={g.sDrum} part="sonnenradtrommel" colorKey="S" kind="shell" />
        </Spin>
        <ClutchPack3D id="K2" part="k2" x0={L.k2.x0} x1={L.k2.x1} rIn={L.k2.rIn} rOut={L.k2.rOut} plates={3} outerAngle="S" innerAngle="IN" outerKey="S" pistonSide={-1} />
      </Explode>
      <Explode id="bandB1">
        <Band3D x0={L.b1.x0} x1={L.b1.x1} r={L.b1.r} part="b1" />
      </Explode>

      {/* Hohlrad vorne mit Nabe (Glied RF) */}
      <Explode id="rf">
        <Spin angleKey="RF">
          <PartMesh geometry={g.rfHub} part="hohlrad-vorne" colorKey="RF" kind="shell" />
        </Spin>
      </Explode>

      {/* Langes Sonnenrad (gemeinsam für beide Simpson-Sätze) */}
      <Explode id="sun">
        <Spin angleKey="S">
          <PartMesh geometry={g.sun} part="sonnenrad" colorKey="S" position={[(L.sun.x0 + L.sun.x1) / 2, 0, 0]} />
        </Spin>
      </Explode>

      {/* Vorderer Satz: Sonne S, Träger M, Hohlrad RF */}
      <Explode id="pf">
        <PlanetarySet3D
          {...SETS.PF}
          x={SET_LAYOUT.PF.x}
          face={FACE}
          ringOuter={SET_LAYOUT.PF.ringOuter}
          renderSun={false}
          carrierFrontInner={L.shaft.m}
          carrierRearInner={0.8}
          getAngles={() => ({ sun: ang('S'), carrier: ang('M'), ring: ang('RF') })}
          keys={{ sun: 'S', carrier: 'M', ring: 'RF', planets: 'P_PF' }}
          parts={{ sun: 'sonnenrad', carrier: 'traeger-vorne', ring: 'hohlrad-vorne', planets: 'planeten-vorne' }}
        />
      </Explode>

      {/* Hinterer Satz: Sonne S, Träger CR (mit Trommel), Hohlrad M */}
      <Explode id="pr">
        <PlanetarySet3D
          {...SETS.PR}
          x={SET_LAYOUT.PR.x}
          face={FACE}
          ringOuter={SET_LAYOUT.PR.ringOuter}
          renderSun={false}
          carrierFrontInner={0.8}
          carrierRearInner={0.8}
          getAngles={() => ({ sun: ang('S'), carrier: ang('CR'), ring: ang('M') })}
          keys={{ sun: 'S', carrier: 'CR', ring: 'M', planets: 'P_PR' }}
          parts={{ sun: 'sonnenrad', carrier: 'traeger-hinten', ring: 'hohlrad-hinten', planets: 'planeten-hinten' }}
        />
        <Spin angleKey="CR">
          <PartMesh geometry={g.crDrum} part="traeger-hinten" colorKey="CR" kind="shell" />
        </Spin>
      </Explode>

      <Explode id="brakesRear">
        <ClutchPack3D id="B2" part="b2" x0={L.b2.x0} x1={L.b2.x1} rIn={L.b2.rIn} rOut={L.b2.rOut} plates={4} outerAngle={null} innerAngle="CR" outerKey="ELFIX_B2" pistonSide={-1} />
        <Freewheel3D x0={L.f1.x0} x1={L.f1.x1} rIn={L.f1.rIn} rOut={L.f1.rOut} angleKey="CR" part="f1" />
      </Explode>

      {/* Zwischenwelle (Glied M): Träger vorne, Hohlrad hinten, OD-Träger */}
      <Explode id="mshaft">
        <Spin angleKey="M">
          <PartMesh geometry={g.mShaft} part="zwischenwelle" colorKey="M" />
          <PartMesh geometry={g.rrPlate} part="hohlrad-hinten" colorKey="M" kind="shell" />
          <PartMesh geometry={g.coDrum} part="od-traeger" colorKey="M" kind="shell" />
        </Spin>
      </Explode>

      {/* Overdrive-Einheit: Sonnenradtrommel SO, K3, B3 */}
      <Explode id="od">
        <Spin angleKey="SO">
          <PartMesh geometry={g.soCup} part="od-sonnenrad" colorKey="SO" kind="shell" />
        </Spin>
        <ClutchPack3D id="K3" part="k3" x0={L.k3.x0} x1={L.k3.x1} rIn={L.k3.rIn} rOut={L.k3.rOut} plates={3} outerAngle="SO" innerAngle="M" outerKey="SO" pistonSide={-1} />
      </Explode>
      <Explode id="odBrake">
        <ClutchPack3D id="B3" part="b3" x0={L.b3.x0} x1={L.b3.x1} rIn={L.b3.rIn} rOut={L.b3.rOut} plates={4} outerAngle={null} innerAngle="SO" outerKey="ELFIX_B3" pistonSide={1} />
      </Explode>
      <Explode id="po">
        <PlanetarySet3D
          {...SETS.PO}
          x={SET_LAYOUT.PO.x}
          face={FACE}
          ringOuter={SET_LAYOUT.PO.ringOuter}
          sunBore={L.soCup.hubR}
          carrierFrontInner={0.8}
          carrierRearInner={L.shaft.m}
          getAngles={() => ({ sun: ang('SO'), carrier: ang('M'), ring: ang('OUT') })}
          keys={{ sun: 'SO', carrier: 'M', ring: 'OUT', planets: 'P_PO' }}
          parts={{ sun: 'od-sonnenrad', carrier: 'od-traeger', ring: 'od-hohlrad', planets: 'od-planeten' }}
        />
      </Explode>

      {/* Ausgangswelle (Glied OUT) mit Parksperrenrad und Geberrad */}
      <Explode id="out">
        <Spin angleKey="OUT">
          <PartMesh geometry={g.roPlate} part="od-hohlrad" colorKey="OUT" kind="shell" />
          <PartMesh geometry={g.outShaft} part="ausgangswelle" colorKey="OUT" />
          <PartMesh geometry={g.parkGear} part="parksperre" colorKey="OUT" kind="shell" position={[L.park.x, 0, 0]} />
          <PartMesh geometry={g.toneOut} part="sensor-abtrieb" colorKey="OUT" position={[L.toneOut.x, 0, 0]} />
          {!gearsetOnly && <PartMesh geometry={g.flange} part="ausgangswelle" colorKey="OUT" kind="shell" />}
        </Spin>
      </Explode>
      <Explode id="housing">
        <ParkPawl />
        {!gearsetOnly && <PartMesh geometry={g.housing} part="gehaeuse" colorKey="HOUSING" kind="housing" />}
      </Explode>
      {!gearsetOnly && <Hydraulics3D />}
    </group>
  );
}

/** Parksperrenklinke: greift im P in eine Zahnlücke des Parksperrenrades */
function ParkPawl() {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.9, -0.02);
    s.lineTo(0.95, 0.14);
    s.lineTo(1.05, 0.14);
    s.lineTo(1.1, -0.06);
    s.lineTo(1.15, -0.14);
    s.lineTo(0, -0.14);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false });
    g.translate(0, 0, -0.09);
    return g;
  }, []);
  const pivotGeo = useMemo(() => new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12).rotateX(Math.PI / 2), []);
  const rTip = (L.park.z / 2 + 1) * L.park.m;
  const ctx = useSimCtx();
  useFrame((_, dt) => {
    if (!ref.current) return;
    const engaged = ctx.getSnapshot().parkLock;
    const target = engaged ? 0 : -0.16;
    ref.current.rotation.z += (target - ref.current.rotation.z) * Math.min(1, dt * 8);
  });
  return (
    <group position={[L.park.x + 1.1, -rTip - 0.11, 0]} rotation={[0, Math.PI, 0]}>
      <PartMesh geometry={pivotGeo} part="parksperre" colorKey="FIXED" />
      <group ref={ref}>
        <PartMesh geometry={geo} part="parksperre" colorKey="PARK" />
      </group>
    </group>
  );
}

/** Innenzahnradpumpe (Sichelpumpe), angetrieben von der Pumpenradnabe */
function OilPump3D() {
  const zi = 14;
  const zo = 20;
  const pm = 0.105;
  const inner = gearGeometry(zi, pm, 0.3, 0.58);
  const outer = ringGearGeometry(zo, pm, 0.3, 1.35);
  const outerRef = useRef<THREE.Group>(null);
  const ecc = ((zo - zi) * pm) / 2;
  const crescent = useMemo(() => {
    // Sichel in der Lücke gegenüber dem Zahneingriff (Formkoordinaten: x → Welt-y)
    const r1 = (zi / 2 + 1) * pm + 0.02;
    const r2 = (zo / 2 - 1) * pm - 0.02;
    const s2 = new THREE.Shape();
    s2.absarc(0, 0, r1, Math.PI - 0.75, Math.PI + 0.75, false);
    s2.absarc(-ecc, 0, r2, Math.PI + 0.62, Math.PI - 0.62, true);
    const g = new THREE.ExtrudeGeometry(s2, { depth: 0.28, bevelEnabled: false });
    g.translate(0, 0, -0.14);
    g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
    return g;
  }, [ecc]);
  const ctx = useSimCtx();
  useFrame(() => {
    if (outerRef.current) outerRef.current.rotation.x = (ctx.sim.angles.ENG ?? 0) * (zi / zo);
  });
  const x = (L.pump.x0 + L.pump.x1) / 2;
  return (
    <group position={[x, 0, 0]}>
      <Spin angleKey="ENG">
        <PartMesh geometry={inner} part="oelpumpe" colorKey="ENG" />
      </Spin>
      <group position={[0, -ecc, 0]}>
        <group ref={outerRef}>
          <PartMesh geometry={outer} part="oelpumpe" colorKey="ENG" />
        </group>
      </group>
      <PartMesh geometry={crescent} part="oelpumpe" colorKey="FIXED" />
    </group>
  );
}

function buildStaticGeometry() {
  const s = L.shaft;
  const flexplate = latheX(
    [
      [L.engine.x1 - 0.04, 0.3],
      [L.engine.x1 - 0.04, 2.55],
      [L.engine.x1, 2.55],
      [L.engine.x1, 0.3],
    ],
    96,
    'flexplate',
  );
  const starterRing = gearGeometry(96, 0.055, 0.12, 2.5);
  const crank = latheX(
    [
      [L.engine.x0, 0.0],
      [L.engine.x0, 0.45],
      [L.engine.x1 - 0.25, 0.45],
      [L.engine.x1 - 0.25, 0.7],
      [L.engine.x1 - 0.04, 0.7],
      [L.engine.x1 - 0.04, 0.0],
    ],
    48,
    'crank',
  );
  const pumpHousing = latheX(
    [
      [L.pump.x0, s.statorSupportOut + 0.18],
      [L.pump.x0, L.housing.rMain],
      [L.pump.x1, L.housing.rMain],
      [L.pump.x1, 0.95],
      [L.pump.x1 - 0.02, 0.95],
      [L.pump.x1 - 0.02, s.statorSupportOut + 0.18],
      [L.pump.x0, s.statorSupportOut + 0.18],
    ],
    96,
    'pump-housing',
  );
  const statorSupport = tubeX(L.conv.xc - 0.1, L.sDrum.front - 0.1, s.statorSupportIn, s.statorSupportOut);
  const inputShaft = latheX(
    [
      [L.conv.xc - 0.72, 0],
      [L.conv.xc - 0.72, s.in],
      [L.inDrum.plateX + 0.03, s.in],
      [L.inDrum.plateX + 0.03, 0],
    ],
    32,
    'input-shaft',
  );
  const inDrum = latheX(
    [
      [L.inDrum.plateX - 0.03, s.in],
      [L.inDrum.plateX - 0.03, L.inDrum.rIn],
      [L.inDrum.x0, L.inDrum.rIn],
      [L.inDrum.x0, L.inDrum.rOut],
      [L.inDrum.x1, L.inDrum.rOut],
      [L.inDrum.x1, L.inDrum.rIn],
      [L.inDrum.plateX + 0.03, L.inDrum.rIn],
      [L.inDrum.plateX + 0.03, s.in],
      [L.inDrum.plateX - 0.03, s.in],
    ],
    96,
    'in-drum',
  );
  // Geberzähne für den Turbinendrehzahlsensor am Ende der Eingangstrommel
  const toneIn = (() => {
    const g = gearGeometry(40, 0.08, 0.1, L.inDrum.rIn - 0.05);
    const c = g.clone();
    c.translate(L.toneIn.x, 0, 0);
    return c;
  })();
  const sd = L.sDrum;
  const sDrum = latheX(
    [
      [sd.front - 0.15, sd.hubR],
      [sd.front - 0.15, sd.hubR + 0.12],
      [sd.front, sd.hubR + 0.12],
      [sd.front, sd.rOut],
      [sd.end, sd.rOut],
      [sd.end, 0.73],
      [sd.plateX - 0.03, 0.73],
      [sd.plateX - 0.03, sd.rIn],
      [sd.front + 0.06, sd.rIn],
      [sd.front + 0.06, sd.hubR + 0.06],
      [sd.front - 0.1, sd.hubR + 0.06],
      [sd.front - 0.1, sd.hubR],
      [sd.front - 0.15, sd.hubR],
    ],
    96,
    's-drum',
  );
  const rfHub = latheX(
    [
      [L.rfHub.x0, L.rfHub.rIn],
      [L.rfHub.x0, L.rfHub.rOut],
      [L.rfPlateX - 0.03, L.rfHub.rOut],
      [L.rfPlateX - 0.03, SET_LAYOUT.PF.ringOuter],
      [SET_LAYOUT.PF.x - FACE / 2 + 0.1, SET_LAYOUT.PF.ringOuter],
      [SET_LAYOUT.PF.x - FACE / 2 + 0.1, SET_LAYOUT.PF.ringOuter - 0.04],
      [L.rfPlateX + 0.03, SET_LAYOUT.PF.ringOuter - 0.04],
      [L.rfPlateX + 0.03, L.rfHub.rIn],
      [L.rfHub.x0, L.rfHub.rIn],
    ],
    96,
    'rf-hub',
  );
  const sun = gearGeometry(SETS.PF.zs, L.m, L.sun.x1 - L.sun.x0, 0.42);
  const pr = SET_LAYOUT.PR;
  const prPlateX0 = pr.x - FACE / 2 - 0.08;
  const crDrum = latheX(
    [
      [prPlateX0, pr.centerR + 0.18],
      [prPlateX0, L.crDrum.rOut],
      [L.crDrum.x1, L.crDrum.rOut],
      [L.crDrum.x1, L.crDrum.rIn],
      [prPlateX0 + 0.06, L.crDrum.rIn],
      [prPlateX0 + 0.06, pr.centerR + 0.18],
      [prPlateX0, pr.centerR + 0.18],
    ],
    96,
    'cr-drum',
  );
  const mShaft = latheX(
    [
      [L.cfFrontX - 0.03, 0],
      [L.cfFrontX - 0.03, s.m],
      [L.coRearX + 0.06, s.m],
      [L.coRearX + 0.06, 0],
    ],
    32,
    'm-shaft',
  );
  const rrPlate = latheX(
    [
      [L.rrPlateX - 0.03, s.m],
      [L.rrPlateX - 0.03, SET_LAYOUT.PR.ringOuter - 0.04],
      [pr.x + FACE / 2 - 0.1, SET_LAYOUT.PR.ringOuter - 0.04],
      [pr.x + FACE / 2 - 0.1, SET_LAYOUT.PR.ringOuter],
      [L.rrPlateX + 0.03, SET_LAYOUT.PR.ringOuter],
      [L.rrPlateX + 0.03, s.m],
      [L.rrPlateX - 0.03, s.m],
    ],
    96,
    'rr-plate',
  );
  const po = SET_LAYOUT.PO;
  const coPlateX0 = po.x - FACE / 2 - 0.08;
  const coDrum = latheX(
    [
      [coPlateX0 + 0.06, po.centerR + 0.2],
      [coPlateX0 + 0.06, L.coDrum.rOut],
      [L.coDrum.x0, L.coDrum.rOut],
      [L.coDrum.x0, L.coDrum.rIn],
      [coPlateX0, L.coDrum.rIn],
      [coPlateX0, po.centerR + 0.2],
      [coPlateX0 + 0.06, po.centerR + 0.2],
    ],
    96,
    'co-drum',
  );
  const sc = L.soCup;
  const soCup = latheX(
    [
      [sc.front, sc.hubR],
      [sc.front, sc.rOut],
      [sc.end, sc.rOut],
      [sc.end, sc.rIn],
      [sc.front + 0.06, sc.rIn],
      [sc.front + 0.06, sc.hubR + 0.13],
      [po.x - FACE / 2 - 0.01, sc.hubR + 0.13],
      [po.x - FACE / 2 - 0.01, sc.hubR],
      [sc.front, sc.hubR],
    ],
    96,
    'so-cup',
  );
  const roPlate = latheX(
    [
      [po.x + FACE / 2 - 0.1, po.ringOuter - 0.05],
      [po.x + FACE / 2 - 0.1, po.ringOuter],
      [L.roPlateX + 0.03, po.ringOuter],
      [L.roPlateX + 0.03, s.out],
      [L.roPlateX - 0.03, s.out],
      [L.roPlateX - 0.03, po.ringOuter - 0.05],
      [po.x + FACE / 2 - 0.1, po.ringOuter - 0.05],
    ],
    96,
    'ro-plate',
  );
  const outShaft = latheX(
    [
      [L.out.x0, 0],
      [L.out.x0, s.out],
      [L.out.x1, s.out],
      [L.out.x1, 0],
    ],
    32,
    'out-shaft',
  );
  const parkGear = gearGeometry(L.park.z, L.park.m, 0.22, s.out);
  const toneOut = gearGeometry(28, 0.05, 0.1, s.out);
  const flange = latheX(
    [
      [L.out.x1 - 0.3, s.out],
      [L.out.x1 - 0.3, 0.45],
      [L.out.x1 - 0.12, 0.45],
      [L.out.x1 - 0.12, 0.85],
      [L.out.x1, 0.85],
      [L.out.x1, s.out],
    ],
    64,
    'flange',
  );
  const H = L.housing;
  const housing = latheX(
    [
      [H.xBell, H.rBell],
      [H.xFront - 0.1, H.rBell],
      [H.xFront, H.rMain + 0.02],
      [H.xRear, H.rMain + 0.02],
      [3.0, 1.9],
      [4.0, 1.3],
      [4.35, 0.75],
      [5.45, 0.75],
      [5.5, 0.5],
    ],
    96,
    'housing',
  );
  return {
    flexplate,
    starterRing,
    crank,
    pumpHousing,
    statorSupport,
    inputShaft,
    inDrum,
    toneIn,
    sDrum,
    rfHub,
    sun,
    crDrum,
    mShaft,
    rrPlate,
    coDrum,
    soCup,
    roPlate,
    outShaft,
    parkGear,
    toneOut,
    flange,
    housing,
  };
}
