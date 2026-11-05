# Automatikgetriebe 3D – interaktive Lernsimulation

Technisch konsistente, interaktive 3D-Webanwendung, die Aufbau und Funktion eines
klassischen hydraulischen Wandlerautomatikgetriebes erklärt: Drehmomentwandler mit
Leitrad und Überbrückungskupplung, gekoppelte Planetenradsätze, Lamellenkupplungen,
Lamellenbremsen, Bremsband, Freiläufe, Hydrauliksteuerung und elektronisches Steuergerät.

Alle Drehzahlen und Momente werden **zur Laufzeit aus den Zwangsbedingungen gelöst**
(Willis-Gleichungen + Schaltelemente) – nichts ist als Animation vorgegeben.

## Starten

```bash
npm install
npm run dev          # Entwicklungsserver, http://localhost:5173
npm test             # automatisierte Tests (Kinematik, Momente, Schaltlogik, Wandler, TCU)
npm run build        # Produktions-Build nach dist/
npm run build:single # eine einzige, eigenständige HTML-Datei nach dist-single/ (offline nutzbar)
```

Benötigt Node.js ≥ 18. Keine externen Dienste, keine APIs, keine Netzwerkzugriffe zur Laufzeit.

## Ansichten

| Ansicht | Inhalt |
|---|---|
| **Getriebe** | Komplettes 3D-Modell. Fahrbetrieb (Gas, Bremse, Wählhebel P/R/N/D, Gang halten) oder Prüfstand (Motordrehzahl + Eingangsmoment direkt, Gang frei wählbar). Kraftflussfarben + animierte Pfeile, Schnitt, Röntgen, Explosion, Isolieren, Fokus, Kamerapresets, Bauteilinfo per Klick, Live-Daten, Schaltablauf, TCU-Protokoll mit Schaltkennfeld. |
| **Drehmomentwandler** | Großer Schnitt durch den Wandler mit Ölströmungspartikeln, fünf Betriebszustände (Stillstand mit Bremse, Anfahren, Momentverstärkung, Kupplungspunkt, Überbrückung), Kennlinien μ(ν) und η(ν) mit Betriebspunkt. |
| **Planetensatz verstehen** | Ein einzelner Satz: Antrieb, festgehaltenes Glied (oder keins = Überlagerung, oder Block) und Abtrieb frei wählbar, Zähnezahlen einstellbar mit Prüfung von Koaxial-, Montage- und Nachbarbedingung, Willis-Gleichung Schritt für Schritt, Momentenverteilung. |
| **Gangvergleich** | Zwei Gänge übereinander mit gleicher Eingangsdrehzahl (zwei unabhängige Simulationen), Vergleichstabelle und Erklärung, warum sich die Übersetzungen unterscheiden. |
| **Lernmodus** | 8 Kapitel (Grundlagen, Wandler, Planetengetriebe, Übersetzungen, Kupplungen/Bremsen, Gangwechsel, Rückwärtsgang, Automatische Steuerung) mit passender Szene, „Probier es aus“-Aktionen und technischer Vertiefung. |

Tastatur: **Leertaste** = Start/Pause, **.** = Einzelbild.

## Gewählte Getriebetopologie: Lehrmodell „LM-4S“

4-Gang-Wandlerautomat aus einem **Simpson-Radsatz** (zwei einfache Planetensätze mit
gemeinsamem Sonnenrad) und einem nachgeschalteten **Overdrive-Planetensatz**.
Dieses Prinzip ist in vielen klassischen 4-Gang-Automaten verbreitet. **Zähnezahlen,
Abmessungen, Lamellenzahlen, Hydraulik und Ventilanordnung dieses Modells sind frei
gewählt bzw. vereinfacht – es bildet kein bestimmtes Seriengetriebe ab.**

```
Motor ─ Wandler ─ IN ─┬─ K1 ──────────────── RF (Hohlrad vorne)
                      └─ K2 ──────────────── S  (gemeinsames Sonnenrad, Bremsband B1)
  Vorderer Satz PF:  Sonne S · Träger M  · Hohlrad RF
  Hinterer Satz PR:  Sonne S · Träger CR · Hohlrad M        CR: Lamellenbremse B2, Freilauf F1
  Overdrive-Satz PO: Sonne SO · Träger M · Hohlrad OUT      SO: K3 (↔ M), Lamellenbremse B3
  M = Zwischenwelle (Träger vorne + Hohlrad hinten + OD-Träger), OUT = Ausgangswelle (+ Parksperre)
```

### Planetensätze (Modul 0,045 Szeneneinheiten)

| Satz | Zs | Zp | Zr | Planeten | Koaxial Zr = Zs+2Zp | Montage (Zs+Zr)/N |
|---|---|---|---|---|---|---|
| vorne (PF) | 30 | 18 | 66 | 4 | ✓ | 24 ✓ |
| hinten (PR) | 30 | 20 | 70 | 4 | ✓ | 25 ✓ |
| Overdrive (PO) | 30 | 21 | 72 | 3 | ✓ | 34 ✓ |

Alle drei Sätze erfüllen zusätzlich die Nachbarbedingung. Die Zahnphasen der Darstellung
werden analytisch aus Sonnen- und Stegwinkel berechnet (Zahn trifft Lücke – per Test geprüft).

### Schaltmatrix und Übersetzungen

| Gang | K1 | K2 | K3 | B1 | B2 | B3 | F1 | Übersetzung |
|---|---|---|---|---|---|---|---|---|
| P | | | ● | | | | | – (Parksperre) |
| R | | ● | ● | | ● | | | i = −Zr,h/Zs = **−2,333** |
| N | | | ● | | | | | – |
| 1 (D) | ● | | ● | | | | ● | i = 1 + (Zs+Zr,h)/Zr,v = **2,515** |
| 1 (M, Motorbremse) | ● | | ● | | ● | | (●) | 2,515 |
| 2 | ● | | ● | ● | | | | i = 1 + Zs/Zr,v = **1,455** |
| 3 | ● | ● | ● | | | | | **1,000** (Block) |
| 4 | ● | ● | | | | ● | | i = Zr,OD/(Zs,OD+Zr,OD) = **0,706** |

K1 Vorwärtskupplung · K2 Direkt-/Rückwärtskupplung · K3 Overdrive-Direktkupplung ·
B1 Bremsband 2. Gang · B2 Lamellenbremse 1./R · B3 Overdrive-Bremse · F1 Rollenfreilauf 1. Gang.

Schaltungen: 1→2 = Freilaufschaltung (nur B1 zu, F1 überholt automatisch) ·
2→3 = Überschneidung B1→K2 · 3→4 = Überschneidung K3→B3.

### Gliederdrehzahlen bei n_ein = 1000 1/min (aus dem Löser)

| Gang | IN | S | RF | M | CR | SO | OUT | Planeten v. (rel.) | Planeten h. (rel.) | Planeten OD (rel.) |
|---|---|---|---|---|---|---|---|---|---|---|
| R | 1000 | 1000 | −1078 | −429 | 0 | −429 | −429 | −2381 | −1500 | 0 |
| N (Fahrzeug steht) | 1000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1 | 1000 | −928 | 1000 | 398 | 0 | 398 | 398 | 2209 | 1392 | 0 |
| 2 | 1000 | 0 | 1000 | 687 | 481 | 687 | 687 | 1146 | 722 | 0 |
| 3 | 1000 | 1000 | 1000 | 1000 | 1000 | 1000 | 1000 | 0 | 0 | 0 |
| 4 | 1000 | 1000 | 1000 | 1000 | 1000 | 0 | 1417 | 0 | 0 | 1429 |

### Momente bei 100 Nm Eingangsmoment (ideal, verlustfrei)

Kupplung: von a nach b übertragenes Moment; Bremse/Freilauf: Abstützmoment des Gehäuses.

| Gang | i | M_ab [Nm] | K1 | K2 | K3 | B1 | B2 | B3 | F1 |
|---|---|---|---|---|---|---|---|---|---|
| R | −2,333 | −233,3 | – | 100,0 | 97,2 | – | −333,3 | – | – |
| 1 | 2,515 | 251,5 | 100,0 | – | −104,8 | – | – | – | 151,5 |
| 2 | 1,455 | 145,5 | 100,0 | – | −60,6 | 45,5 | – | – | – |
| 3 | 1,000 | 100,0 | 68,8 | 31,3 | −41,7 | – | – | – | – |
| 4 | 0,706 | 70,6 | 68,8 | 31,2 | – | – | – | −29,4 | – |

Probe: Summe der Gehäusemomente = M_ab − M_ein (z. B. 1. Gang: F1 = 251,5 − 100 = 151,5 Nm).

### Räumliche Anordnung

Die Bauteile sind so verschachtelt, dass sich keine Verbindungen kreuzen:
Wandler │ Ölpumpe │ Sonnenradtrommel (K2 innen, Bremsband B1 außen) umschließt die
Eingangstrommel (K1) │ Sonnenradmantel führt außen um den vorderen Satz zum Sonnenrad │
vorderer Satz │ hinterer Satz mit Trägertrommel (B2, F1) │ Overdrive-Einheit (K3 innen, B3 außen) │
Ausgangswelle mit Parksperre und Geberrad. Die Zwischenwelle läuft innen durch das hohle Sonnenrad.

## Was ist berechnet, was ist vereinfacht?

| Bereich | Status |
|---|---|
| Drehzahlen aller Glieder und Planeten | **berechnet** – lineares Gleichungssystem (Willis + Schaltelemente), unterbestimmte Fälle (N/P) per Minimum-Norm-Lösung |
| Übersetzungen, Drehrichtungen | **berechnet** und getestet |
| Innere Momente (Kupplungen, Bremsen, Freilauf, Glieder) | **berechnet** – statisches Kräftegleichgewicht, ideal verlustfrei |
| Kraftflussfarben | aus der Schaltmatrix, **per Test gegen die Momentenanalyse geprüft** (inaktiv ⇔ Moment 0, festgehalten ⇔ Drehzahl 0) |
| Freilauf F1 | **berechnet**: sperrt bei positivem Abstützmoment, überholt im Schub und in den Gängen 2–4 |
| Drehmomentwandler | halb-empirisches Kennlinienmodell (T_P = c₀·ω_P²·(1−ν⁴), μ linear 2,1→1 bis ν_K = 0,85) – typische Größenordnung, keine Messdaten |
| Ölströmung (Partikel) | **qualitativ**: Zirkulation ∝ Schlupf, Umfangsgeschwindigkeit = Raddrehzahl |
| Leitraddrehzahl im Kupplungsbereich | qualitativ |
| Motor, Fahrzeug | vereinfachte Modelle (Volllastkurve, Leerlaufregler, Fahrwiderstand) |
| Schaltablauf | Phasen (Befüllen, Moment, Drehzahl, Abschluss) **zeitgesteuert**, Drehzahlen in jeder Phase kinematisch konsistent, Momentenübergang linear überblendet |
| Hydraulik | Lehrmodell: Systemdruck abhängig von Last, Magnetventilmuster, Kolbenhub; Kanalführung schematisch |
| Sensorpositionen | Abtriebsdrehzahl realistisch; Turbinendrehzahlsensor „Lage vereinfacht“ |
| Drehbewegung | wird 60-fach verlangsamt dargestellt (relativ korrekt), zusätzlich Zeitlupe 0,1×–3× |

## Architektur

```
src/
  sim/           reine TypeScript-Logik (ohne Darstellung, vollständig getestet)
    planetary.ts   Willis-Gleichung, Einzelsatz, Geometrieprüfung, Zahnphasen
    topology.ts    Glieder, Sätze, Schaltelemente, Gänge, Rollen, Erklärtexte
    kinematics.ts  Drehzahl- und Momentenlöser (lineare Algebra in linalg.ts)
    converter.ts   Wandlerkennlinie
    engine.ts      Motor- und Fahrzeugmodell
    tcu.ts         Schaltkennfeld mit Hysterese, Überbrückungslogik
    shift.ts       Schaltphasen, Druck-/Hubverläufe, Schrittmodus
    hydraulics.ts  Systemdruck, Magnetventile
    simulation.ts  Gesamtsimulation (Fahrbetrieb + Prüfstand), Snapshot für die UI
  three/         3D-Modell (React Three Fiber): Evolventenverzahnung, Radsätze,
                 Lamellenpakete, Bremsband, Freiläufe, Wandler mit Ölpartikeln,
                 Hydraulik, Kraftflusspfeile, Kamera (GSAP), Schnitt/Röntgen/Explosion
  ui/            Bedienpanel, Infopanels, HUD, Diagramme
  views/         Getriebe, Wandler, Planetenlabor, Gangvergleich, Lernmodus
  content/       Bauteilinformationen, Lernkapitel
tests/           Vitest: Planetensatz, Getriebe, Dynamik
```

Technik: React 19, TypeScript, Three.js, React Three Fiber, Drei, GSAP, Zustand, Vite, Vitest.

## Einschränkungen

- Keine Verluste (Verzahnungs-, Lager-, Pumpen-, Schleppverluste) in der Momentenanalyse.
- Schaltqualität (Ruck, Kupplungsreibarbeit, Temperatur) wird nicht berechnet.
- Kein Kriechschutz/Hill-Hold, keine Schubabschaltung, keine adaptive Schaltlogik.
- Freie Glieder in N/P stehen still bzw. folgen der Minimum-Norm-Lösung (real: Schleppmomente).
- Software-Rendering (ohne GPU) ist sehr langsam; für flüssige Darstellung wird eine GPU empfohlen.
