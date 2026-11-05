/**
 * Getriebetopologie des Lehrmodells "LM-4S":
 * 4-Gang-Wandlerautomat aus einem Simpson-Radsatz (zwei einfache Planetensätze
 * mit gemeinsamem Sonnenrad) und einem nachgeschalteten Overdrive-Planetensatz.
 *
 * Das Prinzip (Simpson-Radsatz + Overdrive-Satz, Bremsband, Lamellenbremse,
 * Freilauf) ist in vielen klassischen 4-Gang-Automaten verbreitet. Zähnezahlen,
 * Abmessungen, Lamellenzahlen und Hydraulik dieses Modells sind jedoch FREI
 * GEWÄHLT bzw. vereinfacht und bilden kein bestimmtes Seriengetriebe ab.
 */
import type { PlanetaryGeometry } from './planetary';

/** Drehende Glieder (starr verbundene Baugruppen) */
export type MemberId = 'IN' | 'S' | 'RF' | 'M' | 'CR' | 'SO' | 'OUT';
export const MEMBER_IDS: MemberId[] = ['IN', 'S', 'RF', 'M', 'CR', 'SO', 'OUT'];

export interface MemberInfo {
  id: MemberId;
  name: string;
  short: string;
  parts: string;
}

export const MEMBERS: Record<MemberId, MemberInfo> = {
  IN: {
    id: 'IN',
    name: 'Eingangswelle / Turbinenwelle',
    short: 'Eingang',
    parts: 'Turbinenrad, Eingangswelle, Eingangstrommel (Außenlamellen K1, Innenlamellen K2)',
  },
  S: {
    id: 'S',
    name: 'Gemeinsames Sonnenrad mit Sonnenradtrommel',
    short: 'Sonne',
    parts: 'Kupplungstrommel K2 (Bremsbandtrommel B1), Sonnenradmantel, langes Sonnenrad',
  },
  RF: {
    id: 'RF',
    name: 'Hohlrad vorderer Satz',
    short: 'Hohlrad v.',
    parts: 'Hohlrad des vorderen Satzes mit Nabe (Innenlamellen K1)',
  },
  M: {
    id: 'M',
    name: 'Zwischenwelle (Simpson-Abtrieb = Overdrive-Antrieb)',
    short: 'Zwischenwelle',
    parts: 'Planetenträger vorne, Hohlrad hinten, Zwischenwelle, Overdrive-Planetenträger (Innenlamellen K3)',
  },
  CR: {
    id: 'CR',
    name: 'Planetenträger hinterer Satz',
    short: 'Träger h.',
    parts: 'Planetenträger des hinteren Satzes mit Bremstrommel (B2, F1)',
  },
  SO: {
    id: 'SO',
    name: 'Overdrive-Sonnenrad',
    short: 'OD-Sonne',
    parts: 'Overdrive-Sonnenrad mit Trommel (Außenlamellen K3, Innenlamellen B3)',
  },
  OUT: {
    id: 'OUT',
    name: 'Ausgangswelle',
    short: 'Ausgang',
    parts: 'Overdrive-Hohlrad, Ausgangswelle, Parksperrenrad, Geberrad Abtriebsdrehzahl',
  },
};

export type SetId = 'PF' | 'PR' | 'PO';
export const SET_IDS: SetId[] = ['PF', 'PR', 'PO'];

export interface SetSpec extends PlanetaryGeometry {
  id: SetId;
  name: string;
  sun: MemberId;
  carrier: MemberId;
  ring: MemberId;
}

/** Gemeinsamer Modul aller Verzahnungen (Szeneneinheiten; 1 Einheit ≈ 100 mm) */
export const MODULE = 0.045;

export const SETS: Record<SetId, SetSpec> = {
  PF: { id: 'PF', name: 'Vorderer Planetensatz (Simpson)', zs: 30, zp: 18, zr: 66, planets: 4, module: MODULE, sun: 'S', carrier: 'M', ring: 'RF' },
  PR: { id: 'PR', name: 'Hinterer Planetensatz (Simpson)', zs: 30, zp: 20, zr: 70, planets: 4, module: MODULE, sun: 'S', carrier: 'CR', ring: 'M' },
  PO: { id: 'PO', name: 'Overdrive-Planetensatz', zs: 30, zp: 21, zr: 72, planets: 3, module: MODULE, sun: 'SO', carrier: 'M', ring: 'OUT' },
};

export type ElementId = 'K1' | 'K2' | 'K3' | 'B1' | 'B2' | 'B3' | 'F1';
export const ELEMENT_IDS: ElementId[] = ['K1', 'K2', 'K3', 'B1', 'B2', 'B3', 'F1'];

export type ElementKind = 'kupplung' | 'lamellenbremse' | 'bremsband' | 'freilauf';

export interface ElementSpec {
  id: ElementId;
  kind: ElementKind;
  name: string;
  /** Glied a (bei Bremsen: das gehaltene Glied) */
  a: MemberId;
  /** Glied b – fehlt bei Bremsen (dann Gehäuse) */
  b?: MemberId;
  function: string;
}

export const ELEMENTS: Record<ElementId, ElementSpec> = {
  K1: {
    id: 'K1',
    kind: 'kupplung',
    name: 'K1 – Vorwärtskupplung',
    a: 'IN',
    b: 'RF',
    function: 'Verbindet die Eingangswelle mit dem Hohlrad des vorderen Satzes. Geschlossen in allen Vorwärtsgängen.',
  },
  K2: {
    id: 'K2',
    kind: 'kupplung',
    name: 'K2 – Direkt-/Rückwärtskupplung',
    a: 'IN',
    b: 'S',
    function: 'Verbindet die Eingangswelle mit dem gemeinsamen Sonnenrad. Geschlossen im 3., 4. und Rückwärtsgang.',
  },
  K3: {
    id: 'K3',
    kind: 'kupplung',
    name: 'K3 – Overdrive-Direktkupplung',
    a: 'M',
    b: 'SO',
    function: 'Verblockt Overdrive-Sonnenrad und -Planetenträger: Der Overdrive-Satz läuft als Block (1:1). Geschlossen außer im 4. Gang.',
  },
  B1: {
    id: 'B1',
    kind: 'bremsband',
    name: 'B1 – Bremsband 2. Gang',
    a: 'S',
    function: 'Bremsband um die Sonnenradtrommel. Hält das gemeinsame Sonnenrad im 2. Gang fest.',
  },
  B2: {
    id: 'B2',
    kind: 'lamellenbremse',
    name: 'B2 – Lamellenbremse 1./R-Gang',
    a: 'CR',
    function: 'Hält den hinteren Planetenträger im Rückwärtsgang und im manuell gewählten 1. Gang (Motorbremse) fest.',
  },
  B3: {
    id: 'B3',
    kind: 'lamellenbremse',
    name: 'B3 – Overdrive-Bremse',
    a: 'SO',
    function: 'Hält das Overdrive-Sonnenrad im 4. Gang fest – der Overdrive-Satz übersetzt ins Schnelle.',
  },
  F1: {
    id: 'F1',
    kind: 'freilauf',
    name: 'F1 – Freilauf 1. Gang',
    a: 'CR',
    function:
      'Rollenfreilauf am hinteren Planetenträger. Sperrt gegen Rückwärtsdrehung (Zugbetrieb im 1. Gang) und überholt in allen anderen Gängen automatisch.',
  },
};

export type GearId = 'P' | 'R' | 'N' | '1' | '1M' | '2' | '3' | '4';
export const DRIVE_GEARS: GearId[] = ['1', '2', '3', '4'];
export const ALL_GEARS: GearId[] = ['P', 'R', 'N', '1', '1M', '2', '3', '4'];

/** Farbrollen der Kraftflussdarstellung */
export type Role = 'input' | 'driven' | 'held' | 'output' | 'idle';

export const ROLE_LABEL: Record<Role, string> = {
  input: 'Eingangsdrehmoment (Motor)',
  driven: 'aktiv angetrieben / überträgt Moment',
  held: 'festgehalten (Abstützung)',
  output: 'Momentübertragung zum Abtrieb',
  idle: 'momentan ohne Moment (inaktiv)',
};

export type RoleKey = MemberId | 'P_PF' | 'P_PR' | 'P_PO';

export interface GearSpec {
  id: GearId;
  label: string;
  title: string;
  /** geschlossene / tragende Schaltelemente */
  elements: ElementId[];
  /** zusätzlich parallel geschlossene Elemente ohne eigene Funktion für die Kinematik */
  parallel?: ElementId[];
  parkLock?: boolean;
  /** Formel der Übersetzung (aus der Kinematik hergeleitet) */
  formula: string;
  roles: Record<RoleKey, Role>;
  /** kurze, leicht verständliche Erklärung */
  simple: string;
  /** technische Erklärung des Kraftflusses */
  technical: string;
}

const allIdle = (): Record<RoleKey, Role> => ({
  IN: 'input', S: 'idle', RF: 'idle', M: 'idle', CR: 'idle', SO: 'idle', OUT: 'idle', P_PF: 'idle', P_PR: 'idle', P_PO: 'idle',
});

export const GEARS: Record<GearId, GearSpec> = {
  P: {
    id: 'P',
    label: 'P',
    title: 'Parken',
    elements: ['K3'],
    parkLock: true,
    formula: 'kein Kraftfluss – Ausgangswelle mechanisch gesperrt',
    roles: { ...allIdle(), OUT: 'held' },
    simple:
      'Keine Kupplung zum Radsatz ist geschlossen – der Motor treibt nur die Eingangswelle. Zusätzlich greift die Parksperrenklinke in das Parksperrenrad der Ausgangswelle und blockiert die Räder mechanisch.',
    technical:
      'K1 und K2 offen ⇒ Simpson-Radsatz hat zwei unbestimmte Freiheitsgrade und überträgt kein Moment. Die Parksperre ist eine formschlüssige Verriegelung der Ausgangswelle mit dem Gehäuse (keine Reibbremse) und darf nur im Stillstand eingelegt werden. K3 bleibt geschlossen (Overdrive-Satz als Block) – ohne Wirkung, da kein Moment anliegt.',
  },
  R: {
    id: 'R',
    label: 'R',
    title: 'Rückwärtsgang',
    elements: ['K2', 'K3', 'B2'],
    formula: 'i_R = −Zr,h / Zs = −70 / 30',
    roles: { ...allIdle(), S: 'driven', P_PR: 'driven', CR: 'held', M: 'output', SO: 'output', P_PO: 'output', OUT: 'output' },
    simple:
      'Die Kupplung K2 treibt das Sonnenrad an, die Bremse B2 hält den hinteren Planetenträger fest. Die Planetenräder drehen dann nur noch um ihre eigene Achse – wie ein Zwischenrad – und drehen das Hohlrad in die Gegenrichtung.',
    technical:
      'Hinterer Satz mit festem Steg (ωc = 0) ⇒ Standübersetzung i₀ = −Zr/Zs. Das Hohlrad hinten ist mit der Zwischenwelle verbunden und dreht entgegengesetzt und langsamer (i = −2,333). Der vordere Satz läuft lastfrei mit (Hohlrad vorne frei). Overdrive-Satz durch K3 verblockt (1:1).',
  },
  N: {
    id: 'N',
    label: 'N',
    title: 'Neutral',
    elements: ['K3'],
    formula: 'kein Kraftfluss',
    roles: { ...allIdle() },
    simple:
      'Weder K1 noch K2 ist geschlossen. Die Eingangswelle dreht frei, aber nichts stützt sich ab – es entsteht kein Drehmoment am Ausgang. Das Fahrzeug kann frei rollen.',
    technical:
      'Ohne Antriebskupplung ist der Simpson-Radsatz kinematisch unterbestimmt (zwei Freiheitsgrade, nur ein Glied über die Ausgangswelle festgelegt). In der Realität bestimmen Schleppmomente die Drehzahl der freien Glieder; die Simulation zeigt die Lösung minimaler Drehzahl (didaktische Vereinfachung).',
  },
  '1': {
    id: '1',
    label: '1',
    title: '1. Gang',
    elements: ['K1', 'K3', 'F1'],
    formula: 'i₁ = 1 + (Zs + Zr,h) / Zr,v = 1 + (30 + 70) / 66',
    roles: {
      ...allIdle(),
      RF: 'driven',
      P_PF: 'driven',
      S: 'driven',
      P_PR: 'driven',
      CR: 'held',
      M: 'output',
      SO: 'output',
      P_PO: 'output',
      OUT: 'output',
    },
    simple:
      'K1 treibt das vordere Hohlrad an. Der Freilauf F1 hält den hinteren Planetenträger fest. Beide Planetensätze arbeiten zusammen: Das Sonnenrad dreht rückwärts und überträgt einen Teil des Moments über den hinteren Satz. Ergebnis: größte Untersetzung, größtes Drehmoment.',
    technical:
      'Zwei gekoppelte Sätze: vorne Hohlrad = Antrieb, Steg = Abtrieb; hinten Steg fest (F1), Hohlrad = Abtrieb, Sonne verbindet beide Sätze. Aus beiden Willis-Gleichungen folgt ω_S = −(Zr,h/Zs)·ω_ab und i₁ = 1 + (Zs + Zr,h)/Zr,v = 2,515. Der Freilauf sperrt nur im Zug; im Schub überholt er (keine Motorbremse im 1. Gang in D).',
  },
  '1M': {
    id: '1M',
    label: '1 (M)',
    title: '1. Gang mit Motorbremse',
    elements: ['K1', 'K3', 'B2'],
    parallel: ['F1'],
    formula: 'i₁ = 1 + (Zs + Zr,h) / Zr,v = 1 + (30 + 70) / 66',
    roles: {
      ...allIdle(),
      RF: 'driven',
      P_PF: 'driven',
      S: 'driven',
      P_PR: 'driven',
      CR: 'held',
      M: 'output',
      SO: 'output',
      P_PO: 'output',
      OUT: 'output',
    },
    simple:
      'Wie der 1. Gang, aber zusätzlich hält die Lamellenbremse B2 den hinteren Planetenträger in beide Drehrichtungen fest. So bremst der Motor das Fahrzeug auch im Schubbetrieb (z. B. bergab).',
    technical:
      'B2 ist parallel zum Freilauf F1 geschaltet und stützt auch negative Reaktionsmomente ab. Kinematik und Übersetzung sind identisch mit dem 1. Gang (i₁ = 2,515).',
  },
  '2': {
    id: '2',
    label: '2',
    title: '2. Gang',
    elements: ['K1', 'K3', 'B1'],
    formula: 'i₂ = 1 + Zs / Zr,v = 1 + 30 / 66',
    roles: { ...allIdle(), RF: 'driven', P_PF: 'driven', S: 'held', M: 'output', SO: 'output', P_PO: 'output', OUT: 'output' },
    simple:
      'K1 treibt weiterhin das vordere Hohlrad. Jetzt hält das Bremsband B1 das Sonnenrad fest. Nur der vordere Planetensatz arbeitet: Die Planeten wälzen auf dem stehenden Sonnenrad ab und nehmen den Planetenträger langsamer mit.',
    technical:
      'Vorderer Satz: Hohlrad Antrieb, Sonne fest, Steg Abtrieb ⇒ i₂ = (Zs + Zr,v)/Zr,v = 1,455. Der hintere Satz dreht lastfrei mit; sein Träger dreht vorwärts (ω = 0,48·ω_ein), daher überholt F1 automatisch. Die 1→2-Schaltung braucht deshalb nur das Zuschalten von B1.',
  },
  '3': {
    id: '3',
    label: '3',
    title: '3. Gang (Direktgang)',
    elements: ['K1', 'K2', 'K3'],
    formula: 'i₃ = 1 (zwei Glieder verbunden ⇒ Satz läuft als Block)',
    roles: { ...allIdle(), RF: 'driven', S: 'driven', P_PF: 'driven', M: 'output', SO: 'output', P_PO: 'output', OUT: 'output' },
    simple:
      'K1 und K2 sind geschlossen: Hohlrad und Sonnenrad des vorderen Satzes drehen gleich schnell. Dann können sich die Planeten nicht mehr abwälzen – der ganze Satz dreht als starrer Block. Eingangs- und Ausgangsdrehzahl sind gleich.',
    technical:
      'Mit ω_S = ω_RF folgt aus der Willis-Gleichung ω_c = ω_S = ω_RF ⇒ i₃ = 1. Das Eingangsmoment teilt sich auf K1 (Zr/(Zs+Zr) = 69 %) und K2 (31 %) auf. Der hintere Satz läuft lastfrei als Block mit.',
  },
  '4': {
    id: '4',
    label: '4',
    title: '4. Gang (Overdrive)',
    elements: ['K1', 'K2', 'B3'],
    formula: 'i₄ = Zr,OD / (Zs,OD + Zr,OD) = 72 / (30 + 72)',
    roles: {
      ...allIdle(),
      RF: 'driven',
      S: 'driven',
      P_PF: 'driven',
      M: 'driven',
      P_PO: 'driven',
      SO: 'held',
      OUT: 'output',
    },
    simple:
      'Der Simpson-Satz läuft wie im 3. Gang als Block. Im Overdrive-Satz wird jetzt aber das Sonnenrad durch B3 festgehalten. Der Planetenträger treibt, die Planeten wälzen auf der stehenden Sonne ab und treiben das Hohlrad schneller an: Die Ausgangswelle dreht schneller als der Motor.',
    technical:
      'Overdrive-Satz: Steg Antrieb, Sonne fest, Hohlrad Abtrieb ⇒ i₄ = Zr/(Zs+Zr) = 0,706 (Übersetzung ins Schnelle). Das Abtriebsmoment ist kleiner als das Eingangsmoment. K3 ist offen, sonst wäre der Satz verspannt.',
  },
};

/** Liste der Gänge in Anzeige-Reihenfolge des Wählhebels */
export const SELECTOR_ORDER: GearId[] = ['P', 'R', 'N', '1', '2', '3', '4'];

export function isDriveGear(g: GearId): boolean {
  return g === '1' || g === '1M' || g === '2' || g === '3' || g === '4';
}

export function gearNumber(g: GearId): number {
  if (g === '1' || g === '1M') return 1;
  if (g === '2') return 2;
  if (g === '3') return 3;
  if (g === '4') return 4;
  return 0;
}

export function gearForNumber(n: number, engineBrake1 = false): GearId {
  if (n <= 1) return engineBrake1 ? '1M' : '1';
  if (n === 2) return '2';
  if (n === 3) return '3';
  return '4';
}
