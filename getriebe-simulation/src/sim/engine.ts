/**
 * Vereinfachtes Motor- und Fahrzeugmodell (Lehrmodell, typische Pkw-Größenordnungen).
 */

export const RPM = 60 / (2 * Math.PI); // rad/s → 1/min
export const toRpm = (w: number) => w * RPM;
export const toRad = (rpm: number) => rpm / RPM;

export const ENGINE = {
  idleRpm: 750,
  maxRpm: 6200,
  limiterRpm: 6300,
  /** Trägheit Motor + Wandlergehäuse + Pumpenrad [kg·m²] */
  inertia: 0.22,
  /** Volllastkurve [1/min, Nm] */
  fullLoad: [
    [0, 120],
    [600, 150],
    [1000, 200],
    [1500, 245],
    [2000, 275],
    [3000, 300],
    [4000, 305],
    [4800, 295],
    [5500, 270],
    [6200, 230],
    [6600, 0],
  ] as [number, number][],
};

export const VEHICLE = {
  mass: 1550, // kg
  wheelRadius: 0.32, // m
  finalDrive: 3.7, // Achsübersetzung (nicht Teil des Getriebes)
  cdA: 0.68, // m²
  rho: 1.2,
  rollingResistance: 0.012,
  maxBrakeForce: 15000, // N
  /** Trägheit Turbine + Eingangsseite Getriebe [kg·m²] */
  turbineInertia: 0.06,
};

export function interp(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

export function fullLoadTorque(rpm: number): number {
  return interp(ENGINE.fullLoad, Math.max(0, rpm));
}

/** Schleppmoment (Reibung, Ladungswechsel) bei geschlossener Drosselklappe */
export function dragTorque(rpm: number): number {
  if (rpm <= 0) return 0;
  return 12 + 0.0055 * rpm;
}

/** Nettomoment des Motors bei Lastgrad θ (0…1) */
export function engineTorque(rpm: number, throttle: number): number {
  const th = Math.min(1, Math.max(0, throttle));
  if (rpm >= ENGINE.limiterRpm) return -dragTorque(rpm);
  return th * fullLoadTorque(rpm) - (1 - th) * dragTorque(rpm);
}

/** Fahrwiderstand (Roll- und Luftwiderstand) [N], wirkt gegen die Bewegung */
export function drivingResistance(v: number): number {
  const { mass, cdA, rho, rollingResistance } = VEHICLE;
  const sign = Math.sign(v);
  const roll = Math.abs(v) > 0.01 ? rollingResistance * mass * 9.81 : 0;
  return sign * (roll + 0.5 * rho * cdA * v * v);
}

export const kmh = (v: number) => v * 3.6;
/** Ausgangswellendrehzahl [rad/s] aus Fahrgeschwindigkeit [m/s] */
export const outputSpeedFromVehicle = (v: number) => (v * VEHICLE.finalDrive) / VEHICLE.wheelRadius;
export const vehicleFromOutputSpeed = (w: number) => (w * VEHICLE.wheelRadius) / VEHICLE.finalDrive;
