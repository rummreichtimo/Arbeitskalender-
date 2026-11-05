/**
 * Kraftflusspfade je Gang in der Schnittebene (x = Achsrichtung, r = Radius).
 * Sie folgen den tatsächlichen Bauteilverbindungen des Modells.
 */
import type { GearId } from '../sim/topology';
import { L, SET_LAYOUT } from './layout';

export type FlowKind = 'input' | 'driven' | 'output' | 'reaction';
export interface FlowPath {
  kind: FlowKind;
  pts: [number, number][];
  label?: string;
}

const PF = SET_LAYOUT.PF;
const PR = SET_LAYOUT.PR;
const PO = SET_LAYOUT.PO;
const sunR = 0.62;
const shaftR = 0.1;

const converterPath: [number, number][] = [
  [L.engine.x0 + 0.2, 0.3],
  [L.engine.x1 - 0.1, 0.3],
  [L.engine.x1 - 0.1, 2.2],
  [L.conv.xc - 0.9, 2.45],
  [L.conv.xc + 0.5, 2.3],
  [L.conv.xc + 0.45, 1.6],
  [L.conv.xc - 0.45, 1.6],
  [L.conv.xc - 0.6, 0.55],
  [L.conv.xc - 0.66, shaftR],
  [L.inDrum.plateX, shaftR],
  [L.inDrum.plateX, 1.45],
];

const lockupPath: [number, number][] = [
  [L.engine.x0 + 0.2, 0.3],
  [L.engine.x1 - 0.1, 0.3],
  [L.engine.x1 - 0.1, 2.1],
  [L.conv.xc - 1.02, 2.05],
  [L.conv.xc - 0.95, 1.4],
  [L.conv.xc - 0.66, 0.55],
  [L.conv.xc - 0.66, shaftR],
  [L.inDrum.plateX, shaftR],
  [L.inDrum.plateX, 1.45],
];

const k1ToPF: [number, number][] = [
  [L.inDrum.plateX, 1.45],
  [L.k1.x0 + 0.2, 1.45],
  [L.k1.x0 + 0.2, 1.03],
  [L.rfPlateX, 1.03],
  [L.rfPlateX, 1.55],
  [PF.x - 0.05, 1.5],
  [PF.x - 0.05, PF.centerR],
];

const k2ToShell: [number, number][] = [
  [L.inDrum.plateX, 1.45],
  [L.inDrum.x0 + 0.05, 1.52],
  [L.k2.x0 + 0.15, 1.74],
  [L.k2.x0 + 0.15, 1.97],
  [L.sDrum.plateX, 1.97],
  [L.sDrum.plateX, 0.75],
];

const pfToM: [number, number][] = [
  [PF.x - 0.05, PF.centerR],
  [L.cfFrontX, PF.centerR],
  [L.cfFrontX, shaftR],
];

const mToOD_locked: [number, number][] = [
  [L.cfFrontX, shaftR],
  [L.coRearX, shaftR],
  [L.coRearX, PO.centerR],
  [PO.x, PO.centerR],
  [PO.x, 1.6],
  [L.roPlateX, 1.6],
  [L.roPlateX, shaftR + 0.05],
  [L.out.x1, shaftR + 0.05],
];

const pfSunToPR: [number, number][] = [
  [PF.x + 0.05, PF.centerR],
  [PF.x + 0.05, sunR],
  [PR.x - 0.05, sunR],
  [PR.x - 0.05, PR.centerR],
];

const prRingToM: [number, number][] = [
  [PR.x + 0.05, PR.centerR],
  [PR.x + 0.05, 1.58],
  [L.rrPlateX, 1.58],
  [L.rrPlateX, shaftR],
];

const prReactionTo = (x: number): [number, number][] => [
  [PR.x, PR.centerR],
  [PR.x - 0.29, PR.centerR],
  [PR.x - 0.29, 1.9],
  [x, 1.9],
  [x, 2.48],
];

const sunToB1: [number, number][] = [
  [PF.x + 0.05, PF.centerR],
  [PF.x + 0.05, sunR],
  [L.sDrum.plateX, sunR + 0.1],
  [L.sDrum.plateX, 1.97],
  [(L.b1.x0 + L.b1.x1) / 2, 1.97],
  [(L.b1.x0 + L.b1.x1) / 2, 2.48],
];

const shellToSunPF: [number, number][] = [
  [L.sDrum.plateX, 0.75],
  [PF.x + 0.05, sunR],
  [PF.x + 0.05, PF.centerR],
];

const shellToSunPR: [number, number][] = [
  [L.sDrum.plateX, 0.75],
  [PR.x - 0.05, sunR],
  [PR.x - 0.05, PR.centerR],
];

const mToODcarrier: [number, number][] = [
  [L.cfFrontX, shaftR],
  [L.coRearX, shaftR],
  [L.coRearX, PO.centerR],
  [PO.x, PO.centerR],
];

const odRingToOut: [number, number][] = [
  [PO.x, PO.centerR],
  [PO.x, 1.6],
  [L.roPlateX, 1.6],
  [L.roPlateX, shaftR + 0.05],
  [L.out.x1, shaftR + 0.05],
];

const odReaction: [number, number][] = [
  [PO.x - 0.05, PO.centerR],
  [PO.x - 0.05, sunR],
  [L.soCup.front + 0.03, 0.5],
  [L.soCup.front + 0.03, 1.93],
  [(L.b3.x0 + L.b3.x1) / 2, 1.93],
  [(L.b3.x0 + L.b3.x1) / 2, 2.48],
];

const parkReaction: [number, number][] = [
  [L.park.x, 0.35],
  [L.park.x, 0.9],
  [L.park.x + 0.05, 1.6],
];

export function flowPathsFor(gear: GearId, lockup: boolean): FlowPath[] {
  const input: FlowPath = { kind: 'input', pts: lockup ? lockupPath : converterPath, label: 'Motor' };
  switch (gear) {
    case 'N':
      return [input];
    case 'P':
      return [input, { kind: 'reaction', pts: parkReaction, label: 'Parksperre' }];
    case '1':
    case '1M':
      return [
        input,
        { kind: 'driven', pts: k1ToPF, label: 'K1' },
        { kind: 'output', pts: pfToM },
        { kind: 'driven', pts: pfSunToPR },
        { kind: 'output', pts: prRingToM },
        { kind: 'reaction', pts: prReactionTo(gear === '1' ? (L.f1.x0 + L.f1.x1) / 2 : (L.b2.x0 + L.b2.x1) / 2), label: gear === '1' ? 'F1' : 'B2' },
        { kind: 'output', pts: mToOD_locked },
      ];
    case '2':
      return [
        input,
        { kind: 'driven', pts: k1ToPF, label: 'K1' },
        { kind: 'output', pts: pfToM },
        { kind: 'reaction', pts: sunToB1, label: 'B1' },
        { kind: 'output', pts: mToOD_locked },
      ];
    case '3':
      return [
        input,
        { kind: 'driven', pts: k1ToPF, label: 'K1' },
        { kind: 'driven', pts: k2ToShell, label: 'K2' },
        { kind: 'driven', pts: shellToSunPF },
        { kind: 'output', pts: pfToM },
        { kind: 'output', pts: mToOD_locked },
      ];
    case '4':
      return [
        input,
        { kind: 'driven', pts: k1ToPF, label: 'K1' },
        { kind: 'driven', pts: k2ToShell, label: 'K2' },
        { kind: 'driven', pts: shellToSunPF },
        { kind: 'driven', pts: pfToM },
        { kind: 'driven', pts: mToODcarrier },
        { kind: 'output', pts: odRingToOut },
        { kind: 'reaction', pts: odReaction, label: 'B3' },
      ];
    case 'R':
      return [
        input,
        { kind: 'driven', pts: k2ToShell, label: 'K2' },
        { kind: 'driven', pts: shellToSunPR },
        { kind: 'output', pts: prRingToM },
        { kind: 'reaction', pts: prReactionTo((L.b2.x0 + L.b2.x1) / 2), label: 'B2' },
        { kind: 'output', pts: [[L.rrPlateX, shaftR], ...mToOD_locked.slice(1)] },
      ];
    default:
      return [input];
  }
}
