# Wochentisch – Ernährungsplaner

Interaktive Web-App (React + TypeScript), die aus persönlichen Angaben automatisch einen
abwechslungsreichen, ausgewogenen Wochenplan mit vollständigen Rezepten, Einkaufsliste und
Vorratsverwaltung erstellt. Läuft als claude.ai-Artefakt oder lokal im Browser.

```bash
npm install
npm test          # Logik-Tests (Anpassung, Einkaufsliste, Planer, Formatierung)
npm run typecheck
npm run build     # dist/artifact.html (Artefakt) und dist/preview.html (lokal öffnen, offline)
```

## Funktionen

| Bereich | Inhalt |
|---|---|
| **Übersicht** | Heutige Mahlzeiten, Wochenbudget, Einkaufsfortschritt, Ausgewogenheit (DGE-Orientierung), Nährwerte pro Tag, bald ablaufende Vorräte mit Rezeptvorschlägen, Favoriten, KI-Wochen-Check |
| **Wochenplan** | 7-Tage-Tafel (mobil Tagesliste) mit Frühstück, Mittag, Abend und Snacks. Gericht antippen: Rezept, Austauschen (bewertete Vorschläge mit Begründung), Neu würfeln, Sperren, Gekocht, Portionen, Tauschen, Entfernen. Drag & Drop am Computer. Woche neu planen behält gesperrte, gekochte und vergangene Mahlzeiten. |
| **Rezepte** | 79 Rezepte plus eigene und KI-Rezepte. Suche nach Name, Zutat, Küche; Filter nach Mahlzeit, Profil, Zeit, Ernährungsweise; Sortierung. Detail mit skalierbaren Mengen, Schritten zum Abhaken, Allergenen, Nährwerten, Alternativen und „Frag Claude“. Editor für eigene Rezepte. |
| **Einkauf** | Alle Zutaten der Woche zusammengefasst, in Packungen gerechnet, nach Supermarkt-Abteilungen sortiert, abzüglich Vorrat. Abhaken, eigene Einträge, eigene Preise, Export als Text/CSV, Gekauftes in den Vorrat übernehmen, Reste-Hinweis. Aktualisiert sich bei jeder Planänderung. |
| **Vorrat** | Mengen oder „ausreichend“, Haltbarkeitsdatum, Grundvorrat, „Was kann ich damit kochen?“ |
| **Profil** | Alter, Geschlecht (optional), Aktivität, Ziele, Ernährungsweise, 14 Allergene, Laktoseintoleranz, Lieblingsküchen und -zutaten, Abneigungen, Personen, Portionsgröße, Mahlzeiten (Mittag: kochen / Reste vom Vorabend / nicht planen), Snacks, Budget, Kochzeit (Woche/Wochenende), Küchengeräte, Design, Nährwertanzeige, Sicherung. |

## Planungsalgorithmus (`src/lib/planner.ts`)

1. Jedes Rezept wird an das Profil angepasst (`src/lib/recipe.ts`): verbotene Zutaten werden
   ersetzt (z. B. Milch → laktosefreie Milch → Haferdrink → Sojadrink, je nach Einschränkung),
   optionale ohne Ersatz entfallen, sonst ist das Rezept ausgeschlossen. Geräte und Kochzeit filtern weiter.
2. 28 randomisierte, gierig aufgebaute Wochen: Jede Mahlzeit wird aus den besten Kandidaten gezogen.
   Bewertet werden Favoriten, Sterne, Lieblingszutaten und -küchen, Ziele, Wiederholungen,
   Abwechslung der Eiweißquelle, Vorrat, bald ablaufende Lebensmittel, **angebrochene Packungen
   früherer Gerichte (Resteverwertung)**, Budgetanteil der Mahlzeit, Zeit und Wochenbilanz
   (Fisch, Hülsenfrüchte, Fleisch in Maßen).
3. Im Modus „Reste vom Vorabend“ wird ein aufwärmbares Abendessen mit Extra-Portionen gekocht und
   als Mittagessen des Folgetags eingeplant.
4. Die beste Woche nach Zielfunktion gewinnt (Budget, verderbliche Reste, Gemüse, Hülsenfrüchte,
   Fisch, Fleischmenge, Vielfalt). Liegt sie über dem Budget, ersetzt ein Reparaturschritt die
   teuersten Gerichte durch günstigere Alternativen.

## Preise und Nährwerte

Alle Preise sind **geschätzte** Durchschnittspreise deutscher Supermärkte (Eigenmarken, Stand 2026)
je Packung, Nährwerte typische Werte je 100 g/ml (`src/data/ingredients.ts`). In der App sind
beide als „geschätzt“ gekennzeichnet; eigene Preise lassen sich je Zutat eintragen.

- **An der Kasse**: ganze Packungen bzw. lose Ware.
- **Wochenkosten** (Budgetvergleich): verderbliche Packungen voll, lange Haltbares (Gewürze,
  Trockenware, Öl, Nüsse) anteilig – der Rest gilt als Vorrat.

Die Energie-Richtwerte (`src/lib/nutrition.ts`) orientieren sich an den D-A-CH-Referenzwerten
der DGE und dienen nur zum Vergleich; der Planer zählt keine Kalorien.

## Speicherung

- `localStorage` sofort, auch offline.
- `db`-Capability des Artefakts: privat je Person unter `data/users/<id>/` in den Dokumenten
  `profile`, `plans`, `prefs`, `pantry`, `shopping`, `recipes` (`{ updatedAt, v }`).
  Je Bereich gewinnt der jüngere Stand. Automatisch erzeugte Inhalte (der erste Beispielplan)
  haben nie Vorrang vor dem Konto; kommt ein Profil aus dem Konto, wird der Beispielplan neu berechnet.

## KI-Funktionen (sample-Capability)

- **KI-Rezept**: Claude entwickelt ein Rezept nur aus Zutaten der Datenbank (gefiltert nach
  Profil), damit Mengen, Preise, Allergene und Einkaufsliste stimmen. Ergebnis wird geprüft und
  normalisiert (`src/lib/ai.ts`).
- **Wochen-Check**: kurze Tipps zum Plan (ohne Kalorienvorgaben).
- **Frag Claude** im Rezept.

Ohne Freigabe oder außerhalb von claude.ai blendet sich alles KI-Bezogene aus.

## Aufbau

```
src/data/        Zutaten (Preise, Nährwerte, Allergene, Ersatz), Rezepte, Beschriftungen
src/lib/         Typen, Formatierung, Rezeptanpassung, Planer, Einkaufsliste, Nährwerte, KI, Plattform
src/state/       Zustand + Speicherung, UI-Zustand, Aktionen, Hooks
src/ui/          Icons, Gericht-Illustrationen (SVG aus den Zutaten), Bedienelemente
src/views/       Übersicht, Wochenplan, Rezepte, Rezeptdetail, Editor, KI-Rezept, Einkauf, Vorrat, Profil, Dialoge
scripts/build.mjs  esbuild-Bundle; React 18 kommt im Artefakt per cdnjs
```

Rezeptbilder sind Illustrationen, die aus Farben und Mengen der Hauptzutaten gezeichnet werden
(Fotos externer Seiten kann ein Artefakt nicht laden).
