/**
 * Inhalte des geführten Lernmodus (8 Kapitel).
 * Jedes Kapitel bestimmt Szene, Startzustand und interaktive Aktionen.
 */
import type { GearId } from '../sim/topology';

export type ChapterScene = 'transmission' | 'converter' | 'planetary' | 'shiftmap';

export type ChapterAction =
  | { kind: 'drive'; selector?: 'P' | 'R' | 'N' | 'D'; throttle?: number; brake?: number; hold?: number; label: string }
  | { kind: 'bench'; gear: GearId; rpm?: number; lockup?: boolean; step?: boolean; label: string }
  | { kind: 'converter'; scenario: string; label: string }
  | { kind: 'planetary'; input: 'sun' | 'carrier' | 'ring'; fixed: 'sun' | 'carrier' | 'ring' | 'block' | 'none'; output: 'sun' | 'carrier' | 'ring'; label: string }
  | { kind: 'camera'; preset: string; label: string }
  | { kind: 'focus'; part: string; label: string; isolate?: boolean }
  | { kind: 'explode'; value: number; label: string }
  | { kind: 'continueShift'; label: string }
  | { kind: 'speed'; value: number; label: string };

export interface Chapter {
  id: number;
  title: string;
  question: string;
  scene: ChapterScene;
  /** Startzustand */
  start: ChapterAction[];
  highlight?: string[];
  simple: string[];
  technical: string[];
  actions: ChapterAction[];
  keyPoints: string[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: 1,
    title: 'Grundlagen',
    question: 'Was ist ein Automatikgetriebe und weshalb braucht ein Fahrzeug verschiedene Übersetzungen?',
    scene: 'transmission',
    start: [
      { kind: 'drive', selector: 'D', throttle: 0, brake: 1, hold: 0, label: '' },
      { kind: 'camera', preset: 'iso', label: '' },
      { kind: 'speed', value: 1, label: '' },
    ],
    simple: [
      'Ein Verbrennungsmotor arbeitet nur in einem Drehzahlbereich von etwa 700 bis 6.000 1/min sinnvoll. Die Räder müssen sich dagegen von Stillstand bis zur Höchstgeschwindigkeit drehen.',
      'Beim Anfahren braucht das Fahrzeug viel Drehmoment, bei schneller Fahrt dagegen hohe Raddrehzahl bei niedriger Motordrehzahl. Ein Getriebe passt beides an: Es „übersetzt“ Drehzahl in Drehmoment und umgekehrt.',
      'Das Automatikgetriebe wählt den passenden Gang selbst. Es besteht aus drei Hauptteilen: dem Drehmomentwandler (sanftes Anfahren), den Planetenradsätzen (Gänge) und der Steuerung (Hydraulik + Elektronik), die Kupplungen und Bremsen schaltet.',
    ],
    technical: [
      'Leistung P = M · ω bleibt (abzüglich Verlusten) erhalten. Eine Untersetzung i > 1 senkt die Abtriebsdrehzahl um den Faktor i und erhöht das Moment um denselben Faktor.',
      'Das Lehrmodell LM-4S hat die Übersetzungen 2,515 / 1,455 / 1,000 / 0,706 und R −2,333 (Spreizung 3,56). Mit Achsübersetzung 3,7 entspricht 1.000 1/min Motordrehzahl im 4. Gang ≈ 46 km/h.',
    ],
    actions: [
      { kind: 'drive', selector: 'D', throttle: 0.4, brake: 0, label: 'Anfahren mit 40 % Gas' },
      { kind: 'drive', selector: 'D', throttle: 1, brake: 0, label: 'Vollgas (Kickdown)' },
      { kind: 'drive', selector: 'D', throttle: 0.2, brake: 0, label: 'Gleichmäßig fahren (20 %)' },
      { kind: 'drive', selector: 'D', throttle: 0, brake: 0.6, label: 'Bremsen' },
      { kind: 'explode', value: 1, label: 'Aufbau zeigen (Explosion)' },
      { kind: 'explode', value: 0, label: 'Zusammenbauen' },
    ],
    keyPoints: [
      'Motor: begrenztes Drehzahlband – Räder: großer Drehzahlbereich.',
      'Untersetzung = mehr Moment, weniger Drehzahl.',
      'Wandler + Planetensätze + Steuerung = Automatikgetriebe.',
    ],
  },
  {
    id: 2,
    title: 'Drehmomentwandler',
    question: 'Wie wird das Drehmoment vom Motor zum Getriebe übertragen?',
    scene: 'converter',
    start: [{ kind: 'converter', scenario: '1', label: '' }],
    simple: [
      'Der Wandler ist eine ölgefüllte „Kupplung ohne Kontakt“. Das Pumpenrad (vom Motor angetrieben) schleudert Öl auf das Turbinenrad (am Getriebe). Das Öl strömt zurück und wird dabei vom Leitrad umgelenkt.',
      'Weil keine feste Verbindung besteht, kann das Fahrzeug mit eingelegtem Gang stehen, obwohl der Motor läuft: Die Pumpe dreht, die Turbine steht – das Öl rutscht durch.',
      'Beim Anfahren verstärkt der Wandler das Moment bis etwa auf das Doppelte. Bei Konstantfahrt verbindet die Überbrückungskupplung Motor und Getriebe direkt, damit kein Schlupf Energie kostet.',
    ],
    technical: [
      'Momentenbilanz: T_Turbine = T_Pumpe + T_Leitrad. Solange sich das Leitrad über den Freilauf am Gehäuse abstützt, ist T_Turbine > T_Pumpe (Wandlung μ > 1).',
      'Oberhalb des Kupplungspunkts (ν ≈ 0,85) wird das Leitrad von hinten angeströmt, der Freilauf löst, μ = 1 (hydrodynamische Kupplung). Wirkungsgrad η = μ·ν.',
      'Die Pumpenaufnahme wächst quadratisch mit der Drehzahl. Daher ist das Kriechmoment im Leerlauf klein und wird von der Bremse gehalten.',
    ],
    actions: [
      { kind: 'converter', scenario: '1', label: '1 · Motor läuft, Fahrzeug steht' },
      { kind: 'converter', scenario: '2', label: '2 · Langsam anfahren' },
      { kind: 'converter', scenario: '3', label: '3 · Drehmomentverstärkung' },
      { kind: 'converter', scenario: '4', label: '4 · Kupplungspunkt' },
      { kind: 'converter', scenario: '5', label: '5 · Überbrückung geschlossen' },
    ],
    keyPoints: ['Pumpe treibt Öl, Öl treibt Turbine.', 'Leitrad + Freilauf ⇒ Momentverstärkung.', 'Überbrückungskupplung ⇒ kein Schlupf.'],
  },
  {
    id: 3,
    title: 'Planetengetriebe',
    question: 'Wie funktionieren Sonnenrad, Planetenräder, Planetenträger und Hohlrad?',
    scene: 'planetary',
    start: [{ kind: 'planetary', input: 'sun', fixed: 'ring', output: 'carrier', label: '' }],
    simple: [
      'Ein Planetensatz besteht aus dem Sonnenrad in der Mitte, mehreren Planetenrädern rundherum, dem Planetenträger (Steg), der die Planeten hält, und dem Hohlrad mit Innenverzahnung außen.',
      'Alle Teile drehen um dieselbe Achse. Hält man eines fest und treibt ein zweites an, ergibt sich die Drehzahl des dritten eindeutig. Je nachdem, welches Teil festgehalten wird, entsteht eine andere Übersetzung.',
      'Werden zwei Teile miteinander verbunden, kann sich nichts mehr gegeneinander bewegen – der Satz dreht als Block (1:1).',
    ],
    technical: [
      'Willis-Gleichung: (Zs + Zr)·ωc = Zs·ωs + Zr·ωr. Zwei Freiheitsgrade – eine zusätzliche Bedingung (Festhalten oder Verbinden) macht den Satz zu einem Getriebe mit einem Freiheitsgrad.',
      'Geometrie: Zr = Zs + 2·Zp (Koaxialbedingung), (Zs + Zr)/N ganzzahlig (Montagebedingung).',
      'Momente: T_s : T_r : T_c = Zs : Zr : −(Zs + Zr). Der Steg trägt immer das größte Moment.',
    ],
    actions: [
      { kind: 'planetary', input: 'sun', fixed: 'ring', output: 'carrier', label: 'Hohlrad fest: Sonne → Steg (starke Untersetzung)' },
      { kind: 'planetary', input: 'ring', fixed: 'sun', output: 'carrier', label: 'Sonne fest: Hohlrad → Steg (2. Gang-Prinzip)' },
      { kind: 'planetary', input: 'carrier', fixed: 'sun', output: 'ring', label: 'Sonne fest: Steg → Hohlrad (Overdrive)' },
      { kind: 'planetary', input: 'sun', fixed: 'carrier', output: 'ring', label: 'Steg fest: Sonne → Hohlrad (Umkehr)' },
      { kind: 'planetary', input: 'sun', fixed: 'block', output: 'carrier', label: 'Zwei Glieder verbunden (Block)' },
    ],
    keyPoints: ['Ein Glied fest + eins angetrieben ⇒ drittes Glied bestimmt.', 'Steg fest ⇒ Drehrichtungsumkehr.', 'Zwei Glieder gekoppelt ⇒ 1:1.'],
  },
  {
    id: 4,
    title: 'Übersetzungen',
    question: 'Wie entstehen unterschiedliche Drehzahl- und Drehmomentverhältnisse?',
    scene: 'transmission',
    start: [
      { kind: 'bench', gear: '1', rpm: 2000, lockup: true, label: '' },
      { kind: 'camera', preset: 'gearsets', label: '' },
    ],
    highlight: ['planeten-vorne', 'planeten-hinten', 'od-planeten'],
    simple: [
      'Das Lehrgetriebe kombiniert drei Planetensätze. Je nachdem, welche Glieder angetrieben und welche festgehalten werden, entsteht ein anderer Gang.',
      'Im 1. Gang arbeiten beide vorderen Sätze zusammen (größte Untersetzung). Im 2. Gang nur der vordere Satz. Im 3. Gang läuft alles als Block (1:1). Im 4. Gang übersetzt der Overdrive-Satz ins Schnelle.',
      'Wähle die Gänge nacheinander und vergleiche Eingangs- und Ausgangsdrehzahl sowie das Abtriebsmoment rechts in den Live-Daten.',
    ],
    technical: [
      'i₁ = 1 + (Zs + Zr,h)/Zr,v = 2,515 · i₂ = 1 + Zs/Zr,v = 1,455 · i₃ = 1 · i₄ = Zr,OD/(Zs,OD + Zr,OD) = 0,706 · i_R = −Zr,h/Zs = −2,333.',
      'Alle Werte werden in der Simulation nicht vorgegeben, sondern aus den Zwangsbedingungen (Willis-Gleichungen + Schaltelemente) gelöst und durch automatisierte Tests geprüft.',
    ],
    actions: [
      { kind: 'bench', gear: '1', label: '1. Gang' },
      { kind: 'bench', gear: '2', label: '2. Gang' },
      { kind: 'bench', gear: '3', label: '3. Gang' },
      { kind: 'bench', gear: '4', label: '4. Gang (Overdrive)' },
      { kind: 'camera', preset: 'od', label: 'Overdrive-Satz ansehen' },
      { kind: 'camera', preset: 'gearsets', label: 'Simpson-Satz ansehen' },
    ],
    keyPoints: ['Übersetzung = Eingangsdrehzahl / Ausgangsdrehzahl.', 'Abtriebsmoment = Eingangsmoment × Übersetzung (ideal).', 'i < 1 heißt Overdrive: Abtrieb schneller als Motor.'],
  },
  {
    id: 5,
    title: 'Kupplungen und Bremsen',
    question: 'Wie wird entschieden, welche Komponenten angetrieben, verbunden oder festgehalten werden?',
    scene: 'transmission',
    start: [
      { kind: 'bench', gear: '2', rpm: 1800, lockup: true, label: '' },
      { kind: 'camera', preset: 'clutches', label: '' },
    ],
    highlight: ['k1', 'k2', 'b1'],
    simple: [
      'Eine Lamellenkupplung verbindet zwei drehende Teile: Stahl- und Reiblamellen greifen abwechselnd in die beiden Teile. Drückt Öl den Kolben an, werden die Lamellen zusammengepresst und die Teile drehen gemeinsam.',
      'Eine Bremse ist dasselbe Prinzip, nur ist ein Teil das Gehäuse: Das Glied wird festgehalten. Das Bremsband umschlingt eine Trommel und wird vom Servokolben gespannt.',
      'Ein Freilauf arbeitet ohne Öl: Er sperrt in einer Richtung und läuft in der anderen frei – wie bei einem Fahrrad-Freilauf.',
    ],
    technical: [
      'Schaltmatrix: P/N: K3 · R: K2+K3+B2 · 1: K1+K3+F1 · 2: K1+K3+B1 · 3: K1+K2+K3 · 4: K1+K2+B3. Pro Gang sind genau drei Bedingungen aktiv – das Getriebe mit 4 Freiheitsgraden (7 Glieder, 3 Willis-Gleichungen) wird zusammen mit der Eingangsdrehzahl eindeutig bestimmt.',
      'Eine zusätzliche geschlossene Bremse würde das Getriebe verspannen (Widerspruch – wird im Löser erkannt und getestet).',
    ],
    actions: [
      { kind: 'bench', gear: '1', label: '1. Gang: F1 hält' },
      { kind: 'bench', gear: '2', label: '2. Gang: B1 hält' },
      { kind: 'bench', gear: '3', label: '3. Gang: K1 + K2' },
      { kind: 'bench', gear: '4', label: '4. Gang: B3 hält' },
      { kind: 'focus', part: 'k1', label: 'K1 isolieren', isolate: true },
      { kind: 'focus', part: 'b1', label: 'Bremsband B1 isolieren', isolate: true },
      { kind: 'explode', value: 1, label: 'Explosion' },
      { kind: 'explode', value: 0, label: 'Zusammenbauen' },
    ],
    keyPoints: ['Kupplung: Teil ↔ Teil.', 'Bremse: Teil ↔ Gehäuse.', 'Freilauf: sperrt nur in einer Richtung.'],
  },
  {
    id: 6,
    title: 'Gangwechsel',
    question: 'Was passiert mechanisch und hydraulisch beim Schalten?',
    scene: 'transmission',
    start: [
      { kind: 'bench', gear: '1', rpm: 2500, lockup: true, step: true, label: '' },
      { kind: 'camera', preset: 'section', label: '' },
      { kind: 'speed', value: 0.6, label: '' },
    ],
    simple: [
      'Beim Hochschalten muss ein Schaltelement öffnen und ein anderes schließen – ohne dass der Kraftfluss abreißt (Lastschaltung).',
      'Zuerst wird der Kolben des neuen Elements mit Öl gefüllt (Befüllphase). Dann übernimmt es schrittweise das Moment, während das alte gelöst wird (Momentenphase). Anschließend rutscht das neue Element kurz und bringt die Eingangsdrehzahl auf den neuen Gang (Drehzahlphase).',
      'Der Schrittmodus ist eingeschaltet: Wähle einen Gang und klicke nach jeder Phase auf „Nächste Phase“.',
    ],
    technical: [
      '1→2 ist eine Freilaufschaltung: Nur B1 wird zugeschaltet; F1 gibt automatisch frei, sobald der hintere Träger vorwärts dreht. Das macht die Schaltung unkritisch im Timing.',
      '2→3 und 3→4 sind Überschneidungsschaltungen (B1→K2, K3→B3): Zu frühes Lösen lässt den Motor hochdrehen, zu spätes Lösen verspannt das Getriebe kurzzeitig.',
      'Hinweis: Die Phasendauern und Druckverläufe sind didaktisch vereinfacht (zeitgesteuert); die Drehzahlen in jeder Phase erfüllen aber stets die Kinematik.',
    ],
    actions: [
      { kind: 'bench', gear: '2', label: 'Hochschalten 1 → 2' },
      { kind: 'bench', gear: '3', label: 'Hochschalten 2 → 3' },
      { kind: 'bench', gear: '4', label: 'Hochschalten 3 → 4' },
      { kind: 'bench', gear: '1', label: 'Zurück in den 1. Gang' },
      { kind: 'continueShift', label: 'Nächste Phase ▶' },
      { kind: 'speed', value: 0.25, label: 'Zeitlupe 0,25×' },
      { kind: 'camera', preset: 'valvebody', label: 'Hydraulik ansehen' },
    ],
    keyPoints: ['Befüllen → Moment übergeben → Drehzahl anpassen.', 'Freilaufschaltung braucht kein Überschneidungs-Timing.', 'Die TCU steuert die Drücke über Magnetventile.'],
  },
  {
    id: 7,
    title: 'Rückwärtsgang',
    question: 'Warum kann sich die Ausgangswelle in die entgegengesetzte Richtung drehen?',
    scene: 'transmission',
    start: [
      { kind: 'bench', gear: 'R', rpm: 1500, lockup: true, step: false, label: '' },
      { kind: 'camera', preset: 'gearsets', label: '' },
      { kind: 'speed', value: 0.6, label: '' },
    ],
    highlight: ['planeten-hinten', 'traeger-hinten', 'b2'],
    simple: [
      'Im Rückwärtsgang hält die Bremse B2 den Planetenträger des hinteren Satzes fest. Die Planetenräder können dann nicht mehr um die Sonne wandern – sie drehen nur noch auf der Stelle.',
      'So wirken sie wie Zwischenräder: Die Sonne dreht vorwärts, die Planeten rückwärts, und das Hohlrad wird von den Planeten rückwärts mitgenommen.',
      'Vergleiche die Drehrichtungen: Wechsle zwischen R und 1 und beobachte das hintere Hohlrad und die Ausgangswelle.',
    ],
    technical: [
      'Fester Steg ⇒ Standübersetzung i₀ = −Zr/Zs = −70/30 = −2,333. Das negative Vorzeichen bedeutet Drehrichtungsumkehr.',
      'Das Abstützmoment an B2 ist im R-Gang besonders groß (T_B2 = T_ein·(1 + Zr/Zs)); deshalb erhöht die Steuerung den Systemdruck im R (siehe Live-Daten).',
    ],
    actions: [
      { kind: 'bench', gear: 'R', label: 'Rückwärtsgang' },
      { kind: 'bench', gear: '1', label: '1. Gang zum Vergleich' },
      { kind: 'focus', part: 'planeten-hinten', label: 'Hintere Planeten isolieren', isolate: true },
      { kind: 'focus', part: 'planeten-hinten', label: 'Alles zeigen', isolate: false },
    ],
    keyPoints: ['Steg fest ⇒ Planeten = Zwischenräder.', 'Zwischenrad ⇒ Drehrichtungsumkehr.', 'i_R = −Zr/Zs.'],
  },
  {
    id: 8,
    title: 'Automatische Steuerung',
    question: 'Wie entscheidet das Getriebesteuergerät, wann geschaltet werden soll?',
    scene: 'shiftmap',
    start: [
      { kind: 'drive', selector: 'D', throttle: 0, brake: 1, hold: 0, label: '' },
      { kind: 'camera', preset: 'valvebody', label: '' },
      { kind: 'speed', value: 1, label: '' },
    ],
    highlight: ['tcu', 'magnetventile', 'sensor-abtrieb', 'sensor-turbine'],
    simple: [
      'Das Steuergerät (TCU) misst die Abtriebsdrehzahl (= Geschwindigkeit) und erhält vom Motorsteuergerät die Gaspedalstellung. Im Schaltkennfeld ist festgelegt, bei welcher Geschwindigkeit bei welcher Last geschaltet wird.',
      'Wenig Gas ⇒ früh hochschalten (sparsam). Viel Gas ⇒ spät hochschalten (sportlich). Tritt man das Pedal ganz durch (Kickdown), schaltet die TCU zurück.',
      'Die Rückschaltlinien liegen unter den Hochschaltlinien. Diese Lücke (Hysterese) verhindert ständiges Hin- und Herschalten.',
    ],
    technical: [
      'Die TCU setzt die Entscheidung über Magnetventile um: MV1/MV2 steuern die Schaltventile (Muster 1: an/aus, 2: an/an, 3: aus/an, 4: aus/aus), das Druckregelventil den Systemdruck abhängig von der Last, MV-WK die Wandlerüberbrückung (3./4. Gang, mäßige Last).',
      'Die Turbinendrehzahl wird während der Schaltung überwacht: Aus n_Turbine/n_Abtrieb erkennt die TCU, ob die Drehzahlphase abgeschlossen ist.',
    ],
    actions: [
      { kind: 'drive', selector: 'D', throttle: 0.2, brake: 0, label: 'Sanft beschleunigen (20 %)' },
      { kind: 'drive', selector: 'D', throttle: 0.6, brake: 0, label: 'Zügig beschleunigen (60 %)' },
      { kind: 'drive', selector: 'D', throttle: 1, brake: 0, label: 'Kickdown (100 %)' },
      { kind: 'drive', selector: 'D', throttle: 0.15, brake: 0, label: 'Konstantfahrt (Überbrückung)' },
      { kind: 'drive', selector: 'D', throttle: 0, brake: 0.5, label: 'Bremsen' },
      { kind: 'camera', preset: 'tcu', label: 'Steuergerät ansehen' },
      { kind: 'camera', preset: 'valvebody', label: 'Ventilkörper ansehen' },
    ],
    keyPoints: ['Eingänge: Abtriebsdrehzahl, Last, Turbinendrehzahl, Temperatur, Wählhebel.', 'Kennfeld mit Hysterese.', 'Ausgänge: Magnetventile ⇒ Hydraulik ⇒ Kupplungen/Bremsen.'],
  },
];
