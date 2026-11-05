import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { useStore } from '../state/store';
import { ExplodeDriver, MaterialController } from '../three/core';
import { FlowArrows } from '../three/FlowArrows';
import { CameraRig, Controls, LabelLayer, LabelProjector, Lighting, SimDriver } from '../three/Scene';
import { Transmission3D } from '../three/Transmission3D';
import { CameraControls, GearSelector, OperatingControls, SimulationControls, ViewControls } from '../ui/ControlPanel';
import { ElementTable, GearInfo, LiveData, MemberTable, PartInfo, ShiftPanel, TcuPanel } from '../ui/InfoPanel';
import { HudOverlay, PanelToggles, usePanelClass } from '../ui/Hud';

/** 3D-Leinwand mit dem kompletten Getriebe – auch im Lernmodus verwendet. */
export function TransmissionCanvas({ children }: { children?: ReactNode }) {
  return (
    <Canvas
      className="canvas3d"
      dpr={[1, 1.75]}
      camera={{ position: [3.5, 8.5, 20], fov: 38, near: 0.1, far: 200 }}
      gl={{ localClippingEnabled: true, antialias: true, alpha: true }}
      onPointerMissed={() => useStore.getState().select(null)}
    >
      <Lighting />
      <SimDriver />
      <MaterialController />
      <ExplodeDriver />
      <Transmission3D />
      <FlowArrows />
      <LabelProjector />
      <Controls />
      <CameraRig />
      {children}
    </Canvas>
  );
}

export function MainView() {
  const leftClass = usePanelClass('left');
  const rightClass = usePanelClass('right');
  return (
    <div className="view-main">
      <aside className={leftClass}>
        <SimulationControls />
        <OperatingControls />
        <GearSelector />
        <ViewControls />
        <CameraControls />
      </aside>
      <div className="stage">
        <TransmissionCanvas />
        <LabelLayer />
        <HudOverlay />
        <PanelToggles />
      </div>
      <aside className={rightClass}>
        <PartInfo />
        <ShiftPanel />
        <GearInfo />
        <ElementTable />
        <LiveData />
        <MemberTable />
        <TcuPanel />
      </aside>
    </div>
  );
}
