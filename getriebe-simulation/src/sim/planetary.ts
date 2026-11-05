/**
 * Kinematik und Geometrie eines einfachen Planetenradsatzes
 * (Sonnenrad – Planetenräder – Planetenträger/Steg – Hohlrad).
 *
 * Grundlage ist die Willis-Gleichung:
 *     (Zs + Zr) · ωc = Zs · ωs + Zr · ωr
 * Alle Winkelgeschwindigkeiten sind absolut (gegenüber dem Gehäuse) und
 * vorzeichenbehaftet; positiv = Drehrichtung des Motors.
 */

export type SetMember = 'sun' | 'carrier' | 'ring';

export interface PlanetaryGeometry {
  /** Zähnezahl Sonnenrad */
  zs: number;
  /** Zähnezahl Planetenrad */
  zp: number;
  /** Zähnezahl Hohlrad */
  zr: number;
  /** Anzahl Planetenräder */
  planets: number;
  /** Modul in Szeneneinheiten (Teilkreisdurchmesser = z · m) */
  module: number;
}

export interface SetSpeeds {
  sun: number;
  carrier: number;
  ring: number;
}

export const MEMBER_LABEL: Record<SetMember, string> = {
  sun: 'Sonnenrad',
  carrier: 'Planetenträger',
  ring: 'Hohlrad',
};

/** Standübersetzung i0 = −Zr/Zs (Übersetzung Sonne→Hohlrad bei festem Steg). */
export function standingRatio(g: Pick<PlanetaryGeometry, 'zs' | 'zr'>): number {
  return -g.zr / g.zs;
}

/** Willis-Gleichung nach dem Steg aufgelöst. */
export function carrierSpeed(zs: number, zr: number, ws: number, wr: number): number {
  return (zs * ws + zr * wr) / (zs + zr);
}

/** Willis-Gleichung nach dem Sonnenrad aufgelöst. */
export function sunSpeed(zs: number, zr: number, wc: number, wr: number): number {
  return ((zs + zr) * wc - zr * wr) / zs;
}

/** Willis-Gleichung nach dem Hohlrad aufgelöst. */
export function ringSpeed(zs: number, zr: number, wc: number, ws: number): number {
  return ((zs + zr) * wc - zs * ws) / zr;
}

/** Residuum der Willis-Gleichung (0 bei korrekter Kinematik). */
export function willisResidual(g: Pick<PlanetaryGeometry, 'zs' | 'zr'>, s: SetSpeeds): number {
  return (g.zs + g.zr) * s.carrier - g.zs * s.sun - g.zr * s.ring;
}

/** Drehzahl eines Planetenrades relativ zum Steg (um die eigene Achse). */
export function planetSpeedRelative(zs: number, zp: number, ws: number, wc: number): number {
  return (-zs / zp) * (ws - wc);
}

/** Absolute Drehzahl eines Planetenrades um seine eigene Achse. */
export function planetSpeedAbsolute(zs: number, zp: number, ws: number, wc: number): number {
  return wc + planetSpeedRelative(zs, zp, ws, wc);
}

/** Ergänzt die fehlende Drehzahl, wenn zwei der drei Glieder bekannt sind. */
export function completeSpeeds(
  g: Pick<PlanetaryGeometry, 'zs' | 'zr'>,
  known: Partial<SetSpeeds>,
): SetSpeeds {
  const { sun, carrier, ring } = known;
  if (sun !== undefined && ring !== undefined) return { sun, ring, carrier: carrierSpeed(g.zs, g.zr, sun, ring) };
  if (carrier !== undefined && ring !== undefined) return { carrier, ring, sun: sunSpeed(g.zs, g.zr, carrier, ring) };
  if (carrier !== undefined && sun !== undefined) return { carrier, sun, ring: ringSpeed(g.zs, g.zr, carrier, sun) };
  throw new Error('Mindestens zwei Drehzahlen müssen bekannt sein.');
}

export interface SingleSetResult {
  speeds: SetSpeeds;
  /** Übersetzung i = ω_an / ω_ab */
  ratio: number;
  /** Drehrichtung des Abtriebs relativ zum Antrieb */
  direction: 'gleich' | 'umgekehrt' | 'stillstand';
  /** Formel als Text */
  formula: string;
  /** Wertebereich: Untersetzung, Übersetzung ins Schnelle, Direkt, Umkehr */
  kind: 'Untersetzung' | 'Übersetzung ins Schnelle' | 'Direktgang' | 'Umkehr (Rückwärts)' | 'Leerlauf';
}

/**
 * Berechnet einen Planetensatz mit einem angetriebenen und einem festgehaltenen Glied.
 * Liefert Drehzahlen aller Glieder und die Übersetzung zum gewählten Abtrieb.
 */
export function solveSingleSet(
  g: Pick<PlanetaryGeometry, 'zs' | 'zr'>,
  input: SetMember,
  fixed: SetMember,
  output: SetMember,
  inputSpeed = 1,
): SingleSetResult {
  if (input === fixed) throw new Error('Antrieb und festgehaltenes Glied müssen verschieden sein.');
  const known: Partial<SetSpeeds> = { [input]: inputSpeed, [fixed]: 0 };
  const speeds = completeSpeeds(g, known);
  const out = speeds[output];
  const ratio = out === 0 ? Infinity : inputSpeed / out;
  const { zs, zr } = g;
  // Schlüssel: Antrieb-Festgehalten-Abtrieb
  const formulas: Record<string, string> = {
    'sun-ring-carrier': `i = (Zs + Zr) / Zs = (${zs} + ${zr}) / ${zs}`,
    'ring-sun-carrier': `i = (Zs + Zr) / Zr = (${zs} + ${zr}) / ${zr}`,
    'carrier-ring-sun': `i = Zs / (Zs + Zr) = ${zs} / (${zs} + ${zr})`,
    'carrier-sun-ring': `i = Zr / (Zs + Zr) = ${zr} / (${zs} + ${zr})`,
    'sun-carrier-ring': `i = −Zr / Zs = −${zr} / ${zs}`,
    'ring-carrier-sun': `i = −Zs / Zr = −${zs} / ${zr}`,
  };
  const formula = formulas[`${input}-${fixed}-${output}`] ?? 'Abtrieb = Antrieb oder festgehaltenes Glied';
  let kind: SingleSetResult['kind'];
  let direction: SingleSetResult['direction'];
  if (!isFinite(ratio)) {
    kind = 'Leerlauf';
    direction = 'stillstand';
  } else if (ratio < 0) {
    kind = 'Umkehr (Rückwärts)';
    direction = 'umgekehrt';
  } else if (Math.abs(ratio - 1) < 1e-9) {
    kind = 'Direktgang';
    direction = 'gleich';
  } else if (ratio > 1) {
    kind = 'Untersetzung';
    direction = 'gleich';
  } else {
    kind = 'Übersetzung ins Schnelle';
    direction = 'gleich';
  }
  return { speeds, ratio, direction, formula, kind };
}

/**
 * Ideale (verlustfreie) Momentenverteilung im Planetensatz:
 *   T_s : T_r : T_c = Zs : Zr : −(Zs + Zr)
 * Gibt die Momente für eine "Zahnkraftgröße" F zurück (F·m/2 entspricht der Umfangskraft).
 */
export function setTorques(zs: number, zr: number, F: number): SetSpeeds {
  return { sun: zs * F, ring: zr * F, carrier: -(zs + zr) * F };
}

export interface GeometryCheck {
  /** Koaxialbedingung Zr = Zs + 2·Zp */
  coaxial: boolean;
  /** Montagebedingung (Zs + Zr) / N ganzzahlig (gleichmäßig verteilte Planeten) */
  assembly: boolean;
  /** Nachbarbedingung: Kopfkreise benachbarter Planeten berühren sich nicht */
  neighbour: boolean;
  /** Achsabstand Sonne–Planet (in Modul) */
  centerDistance: number;
  messages: string[];
}

export function checkGeometry(g: PlanetaryGeometry): GeometryCheck {
  const messages: string[] = [];
  const coaxial = g.zr === g.zs + 2 * g.zp;
  if (!coaxial) messages.push(`Koaxialbedingung verletzt: Zr = ${g.zr}, aber Zs + 2·Zp = ${g.zs + 2 * g.zp}.`);
  const assembly = (g.zs + g.zr) % g.planets === 0;
  if (!assembly)
    messages.push(
      `Montagebedingung verletzt: (Zs + Zr) / N = ${g.zs + g.zr} / ${g.planets} ist nicht ganzzahlig – Planeten lassen sich nicht gleichmäßig verteilt einbauen.`,
    );
  const a = (g.zs + g.zp) / 2; // in Modul
  const spacing = 2 * a * Math.sin(Math.PI / g.planets);
  const tip = g.zp + 2; // Kopfkreisdurchmesser in Modul
  const neighbour = spacing > tip + 0.5;
  if (!neighbour)
    messages.push(
      `Nachbarbedingung verletzt: Abstand der Planetenachsen ${spacing.toFixed(1)}·m ≤ Kopfkreis ${tip}·m (+Spiel).`,
    );
  if (g.zs < 12 || g.zp < 12) messages.push('Sehr kleine Zähnezahl – Unterschnitt wahrscheinlich (Lehrmodell zeigt sie trotzdem).');
  return { coaxial, assembly, neighbour, centerDistance: a, messages };
}

/**
 * Phasenlage für die Darstellung kämmender Zähne.
 * Konvention: Zahnmitte der Außenräder bei Winkel 0 (lokal), Zahnmitte des
 * Hohlrades bei ringToothOffset(). Liefert den absoluten Drehwinkel eines Planeten.
 *
 * Herleitung: An der Kontaktstelle Richtung ψ muss Zahn auf Lücke treffen:
 *   uₛ + uₚ ≡ ½  mit uₛ = (ψ − θₛ)·Zs/2π,  uₚ = (ψ + π − θₚ)·Zp/2π
 *   ⇒ θₚ = ψ + π − π/Zp + (ψ − θₛ)·Zs/Zp
 * Das Hohlrad kämmt dann automatisch korrekt, wenn die Montagebedingung erfüllt
 * ist und das Hohlrad um π·Zp/Zr (mod Teilung) versetzt gezeichnet wird.
 */
export function planetAngle(zs: number, zp: number, sunAngle: number, carrierAngle: number, slotAngle: number): number {
  const psi = carrierAngle + slotAngle;
  return psi + Math.PI - Math.PI / zp + ((psi - sunAngle) * zs) / zp;
}

/** Zeichnungsversatz des Hohlrades, damit alle Zähne korrekt kämmen. */
export function ringToothOffset(zp: number, zr: number): number {
  const pitch = (2 * Math.PI) / zr;
  const raw = (Math.PI * zp) / zr;
  return raw - Math.floor(raw / pitch) * pitch;
}

/** Phase (0…1) eines Zahnrades an einer Richtung; 0 = Zahnmitte, 0.5 = Lückenmitte. */
export function toothPhase(z: number, gearAngle: number, direction: number, toothOffset = 0): number {
  const u = ((direction - gearAngle - toothOffset) * z) / (2 * Math.PI);
  return u - Math.floor(u);
}
