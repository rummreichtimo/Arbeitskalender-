# 43-Stunden-Konto

Arbeitszeit-Tracker für ein monatliches Stundenkontingent (Standard: 43,0 h).
Die ganze App liegt in **`index.html`** – das ist zugleich die Quelle des veröffentlichten Artefakts.

## Funktionen

- **Kalenderansicht** pro Monat (Wochenstart Montag, mit Kalenderwochen). Tag antippen → Von / Bis / Pause / Notiz eintragen.
- **Automatische Berechnung**: `Arbeitszeit = Bis − Von − Pause`, inklusive Schichten über Mitternacht.
  Anzeige dezimal (`3,5 h`) und als Zeit (`3 h 30 min`).
- **Monatslimit** mit Balken aus 43 Blöcken – ein Block = eine Stunde des Kontingents.
  Farbstufen: bis 70 % unkritisch · 70–90 % Warnung · 90–100 % fast voll · darüber Überschreitung.
- **Warnung vor dem Speichern**, wenn ein Eintrag das Limit sprengen würde (Bisher / Neuer Eintrag / Danach / Limit / Überschreitung). Speichern bleibt möglich.
- **Monatsübersicht** als Liste mit Gesamt- und Restsumme, Einträge bearbeiten und löschen (mit Rückgängig).
- **Kopiertext** in zwei Formaten (kurz für WhatsApp/E-Mail, ausführlich als Export) – immer nur der ausgewählte Monat.
- **Einstellungen**: Stundenlimit änderbar, ohne gespeicherte Zeiten zu verändern.

## Speicherung

Zwei Ebenen, damit nichts verloren geht:

1. `localStorage` – sofort, funktioniert auch offline und ohne Anmeldung.
2. `db`-Capability des Artefakts – geräteübergreifend (iPhone und Desktop), sobald verfügbar.

Abgeglichen wird **tagweise**: jeder Eintrag trägt einen eigenen Zeitstempel `t`,
gelöschte Tage hinterlassen eine Löschmarke in `del`. Beim Zusammenführen gewinnt je Tag
der jüngere Stand. Ein veralteter Stand vom Konto kann dadurch weder neuere Einträge
überschreiben noch gelöschte Tage zurückholen. Ist die Capability nicht verfügbar, läuft
alles unverändert rein lokal weiter; das Statusfeld oben rechts zeigt `lokal` bzw. `synchron`.

> **Wichtig:** Vom Konto gelieferte Snapshots sind eingefroren (`Object.freeze`). Alles, was
> in den App-Zustand wandert, muss über `normalizeMonth()` kopiert werden – ein direkt
> übernommenes Snapshot-Objekt lässt sich später nicht beschreiben und bricht das Speichern.
> `ensureMonth()` sichert das zusätzlich vor jedem Schreibzugriff ab.

## Datenmodell

```
settings/app        { limit: 43, updatedAt }
months/2026-09      { days: { "2026-09-04": { from, to, pause, note, t } },
                      del:  { "2026-09-05": t },
                      updatedAt }
```

## Entwicklung

`index.html` wird beim Veröffentlichen in ein `<!doctype>…<head>…<body>`-Gerüst eingebettet
und enthält deshalb selbst keine `html`/`head`/`body`-Tags. Zum lokalen Öffnen im Browser
reicht die Datei trotzdem aus.
