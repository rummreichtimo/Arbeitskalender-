/**
 * Kleine, abhängigkeitsfreie Lineare-Algebra-Hilfen für die Getriebelöser.
 * Die Systeme haben höchstens ~12 Unbekannte – Gauß-Elimination genügt.
 */

export type Matrix = number[][];

const EPS = 1e-10;

export interface ReducedSystem {
  /** linear unabhängige Zeilen */
  rows: number[][];
  rhs: number[];
  /** true, wenn Gleichungen sich widersprechen (z. B. "verspanntes" Getriebe) */
  inconsistent: boolean;
  rank: number;
}

/** Entfernt linear abhängige Zeilen (Gram-Schmidt) und prüft auf Widersprüche. */
export function reduceRows(A: Matrix, b: number[]): ReducedSystem {
  const basis: number[][] = []; // orthonormalisierte Zeilen
  const rows: number[][] = [];
  const rhs: number[] = [];
  let inconsistent = false;
  // Für die Widerspruchsprüfung führen wir die Zeilen erweitert ([a | b]) mit.
  const basisAug: number[][] = [];
  for (let i = 0; i < A.length; i++) {
    const r = A[i].slice();
    const aug = [...A[i], b[i]];
    for (let k = 0; k < basis.length; k++) {
      const q = basis[k];
      let d = 0;
      for (let j = 0; j < r.length; j++) d += r[j] * q[j];
      for (let j = 0; j < r.length; j++) r[j] -= d * q[j];
      const qa = basisAug[k];
      for (let j = 0; j < aug.length; j++) aug[j] -= d * qa[j];
    }
    let n = 0;
    for (const v of r) n += v * v;
    n = Math.sqrt(n);
    const scale = Math.max(1, Math.sqrt(A[i].reduce((s, v) => s + v * v, 0)));
    if (n > EPS * scale * 1e3) {
      basis.push(r.map((v) => v / n));
      basisAug.push(aug.map((v) => v / n));
      rows.push(A[i].slice());
      rhs.push(b[i]);
    } else if (Math.abs(aug[aug.length - 1]) > 1e-7 * Math.max(1, Math.abs(b[i]))) {
      inconsistent = true;
    }
  }
  return { rows, rhs, inconsistent, rank: rows.length };
}

/** Löst ein quadratisches System per Gauß-Elimination mit Spaltenpivotisierung. */
export function solveSquare(Ain: Matrix, bin: number[]): number[] | null {
  const n = Ain.length;
  const A = Ain.map((r) => r.slice());
  const b = bin.slice();
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < EPS) return null;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      if (f === 0) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

export interface MinNormResult {
  x: number[];
  rank: number;
  /** Anzahl unbestimmter Freiheitsgrade (n - rank) */
  freeDof: number;
  inconsistent: boolean;
}

/**
 * Lösung minimaler Norm von A·x = b (für unterbestimmte Systeme).
 * x = Aᵀ (A Aᵀ)⁻¹ b nach Entfernen abhängiger Zeilen.
 */
export function solveMinNorm(A: Matrix, b: number[], nVars: number): MinNormResult {
  const red = reduceRows(A, b);
  const m = red.rows.length;
  if (m === 0) return { x: new Array(nVars).fill(0), rank: 0, freeDof: nVars, inconsistent: red.inconsistent };
  const G: Matrix = [];
  for (let i = 0; i < m; i++) {
    G.push([]);
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let k = 0; k < nVars; k++) s += red.rows[i][k] * red.rows[j][k];
      G[i].push(s);
    }
  }
  const y = solveSquare(G, red.rhs);
  if (!y) return { x: new Array(nVars).fill(0), rank: m, freeDof: nVars - m, inconsistent: true };
  const x = new Array(nVars).fill(0);
  for (let k = 0; k < nVars; k++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += red.rows[i][k] * y[i];
    x[k] = s;
  }
  return { x, rank: m, freeDof: nVars - m, inconsistent: red.inconsistent };
}
