// Zugriff auf die Laufzeit-Fähigkeiten des Artefakts (Konto-Speicher, Claude, Downloads).
// Alles ist optional: Fehlt eine Fähigkeit, läuft die App lokal weiter.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Use = (name: string) => Promise<any>;

function use(name: string): Promise<any> {
  try {
    const c = (window as any).claude;
    if (!c || typeof c.use !== 'function') return Promise.resolve(null);
    return (c.use as Use)(name).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

let samplePromise: Promise<any> | null = null;
let downloadsPromise: Promise<any> | null = null;

export const getDb = () => use('db');
export const getUser = () => use('user');
export function getSample(): Promise<any> {
  if (!samplePromise) samplePromise = use('sample');
  return samplePromise;
}
export function getDownloads(): Promise<any> {
  if (!downloadsPromise) downloadsPromise = use('downloads');
  return downloadsPromise;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export type SaveOutcome = 'saved' | 'declined' | 'unavailable' | 'error';

export async function saveFile(filename: string, data: string): Promise<SaveOutcome> {
  const dl = await getDownloads();
  if (!dl) return 'unavailable';
  try {
    await dl.save({ filename, data });
    return 'saved';
  } catch (e: any) {
    const code = e?.code;
    if (code === 'declined') return 'declined';
    if (code === 'unavailable' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') return 'unavailable';
    return 'error';
  }
}

export function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function lsSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function lsRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignorieren */
  }
}
