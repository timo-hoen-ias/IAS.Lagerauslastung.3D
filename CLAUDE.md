# CLAUDE.md — ias.warehouse-map

Siehe auch `AGENTS.md` für die verbindlichen Projektregeln (Tests, Konventionen).
Dieses Dokument ergänzt Architektur-/Design-Kontext, den `AGENTS.md` nicht abdeckt.

## Projekt

3D-Lagerbestands-Viewer (React + `@react-three/fiber`/three.js, Bun-Backend, MSSQL).
Details zu Datenmodell, Server-Queries und Ordnerstruktur: siehe `README.md`.

## Design: Lager-Cockpit

Die HUD-Oberfläche (alles außerhalb der drei.js-`Canvas`) folgt seit 2026-08 einem
einheitlichen Design namens **„Lager-Cockpit"**: ein dunkles, instrumentenhaftes
Interface, das an ein Leitstand-/Scanner-Display erinnert — passend zu einer
Anwendung, die reale Lagerbestände in Echtzeit überwacht. Es ersetzt das frühere
Ad-hoc-„Glass"-CSS (`hud-*`-Klassen) vollständig.

**Stack:** Tailwind CSS v4 (`@tailwindcss/vite`-Plugin), Design-Tokens über das
`@theme`-Directive in `src/app/index.css`. Kein `tailwind.config.js` nötig (v4-Default).
Handgeschriebenes CSS ist auf wenige Stellen beschränkt, die Utilities nicht abbilden
können (Lochrand-Trenner, Radar-Ping-Keyframe, Scrollbar-Hiding) — siehe
`@layer utilities` in `index.css`.

### Tokens (`@theme` in `src/app/index.css`)

| Rolle | Token | Wert |
| --- | --- | --- |
| Hintergrund (Canvas/Body) | `--color-void` | `#0a0d12` |
| Panel-Flächen (Leisten, Docks) | `--color-panel` | `#11161d` |
| Erhöhte Flächen (Popover, Karten) | `--color-raised` / `--color-raised-2` | `#1a212b` / `#212a35` |
| Linien/Borders | `--color-line` / `--color-line-soft` | `#242e3a` / `#181f28` |
| Text | `--color-ink` / `--color-ink-soft` / `--color-ink-faint` | hell → gedämpft |
| Systemakzent (Auswahl, Live-Status) | `--color-accent` | `#45d8c8` (Cyan-Teal) |
| Bestands-Ampel | `--color-stock-empty/low/mid/high` | grau/grün/gelb/rot — **fachliche Bedeutung, nicht als Akzent verwenden** |
| Lagertechnik-Palette | `--color-tech-st/uf/bl/sf/hr` | siehe `src/app/colors.ts` (`TECHNIK_PALETTE`) — dieselben Werte, als Tailwind-Utilities gespiegelt |

Der Akzent (`accent`) ist bewusst von den Bestands-/Technik-Farben getrennt: Er markiert
Auswahl, Fokus und Live-Zustand, nie einen fachlichen Wert. `stockColor()` /
`technikColor()` in `src/app/colors.ts` bleiben die einzige Quelle für Bestands-/
Technik-Farbentscheidungen — HUD-Komponenten importieren sie, statt Farben zu duplizieren.

**Schrift bewusst ohne Web-Font-CDN:** `--font-sans` (Segoe UI/System) und `--font-mono`
(Consolas/Cascadia Mono) sind Systemschriften. Die Anwendung läuft im Lager-LAN, oft ohne
Internetzugriff — ein Google-Fonts-`<link>` würde dort lautlos auf Fallback-Schriften
zurückfallen. Mono wird für alle Daten/Codes verwendet (Koordinaten, Lagerkennungen,
Artikelnummern, Bestände), Sans für UI-Chrome (Labels, Buttons, Fließtext).

### Layout

Feste Overlay-Struktur über der vollflächigen `Canvas` (kein Grid-Shell — die 3D-Szene
füllt immer den ganzen Viewport, Panels sind `fixed`/`absolute` Overlays):

- **Kopfleiste** (`h-14`, oben, volle Breite): Marke, DB-/Mandant-Auswahl, Regale/Plätze-
  Zähler, LIVE-Pill (echter WebSocket-Status aus `useWsConnected()`).
- **Icon-Leiste** (`w-14`, links, zwischen Kopf- und Statusleiste): Kamera-Modi
  (Orbit/Ego/Top-Down) als Segmentgruppe, Werkzeuge (Bearbeiten/Messen/Beleuchtung/Wände),
  Hilfe-&-Legende-Popover. Icon-only mit Hover-Tooltip (`Tip`-Komponente in `HUD.tsx`).
- **Statusleiste** (`h-9`, unten, volle Breite): aktueller Modus, Kamera-Koordinaten
  (ersetzt das frühere separate `Readout`-Panel), Tempo-Regler (nur Ego-Modus),
  Mess-Status.
- **Regal-Manifest** (`Inspector.tsx`, rechts angedockt, volle Höhe, resizable): Such-
  /Auswahl-Panel im Packschein-Stil — Mono-Codes, Lochrand-Trenner (`.perf-divider`)
  zwischen Kopf und Tabelle, Bestands-Balken je Zeile.
- **Radar** (`Minimap.tsx`, nur im Ego-/Walk-Modus sichtbar, frei verschiebbar, Standardposition
  unten links neben der Icon-Leiste — verdeckt so nicht das rechts angedockte Regal-Manifest):
  kreisförmige Variante der bisherigen Top-Down-Minimap, inkl. rotierendem
  Sweep (`animate-spin` + `[animation-duration:4s]`) und **Live-Buchungs-Pings** — echte
  Ereignisse aus `useBuchungen()`, per `bookingFlashes()`/`platzIndex()` (aus `article.ts`,
  bereits von `BookingFlash.tsx` genutzt) auf Radar-Koordinaten projiziert
  (`worldToMinimap()`). Keine Fake-Animation — wenn keine Buchung eintrifft, pingt nichts.
- **Bearbeiten-Panel** (`DragPanel`, erscheint nur bei `edit && selectedRack`): frei
  verschiebbare Karte mit Transform-Werkzeugen.

Frei verschiebbare Panels (Radar, Bearbeiten-Panel) nutzen weiterhin `DragPanel`/
`usePanelPos` (Position in `localStorage` unter `wm-panel-<id>` persistiert) — beim Ändern
von Standardpositionen beachten, dass eine bereits gespeicherte Position Vorrang hat
(zum Test: `localStorage` für `wm-panel-*`-Keys leeren).

### Komponenten-Konventionen

- Wiederkehrende Button-Stile sind als kleine Funktionen am Dateikopf definiert, nicht als
  eigene Komponenten (`railBtnClass(active)` und `btnClass(active)` in `HUD.tsx`) — direkt
  Tailwind-Strings zurückgeben, damit Utility-Klassen an einer Stelle bleiben.
- Nur die Standard-Tailwind-Skala verwenden (`0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, …`);
  Werte außerhalb (z. B. `w-5.5`, `z-15`) erzeugen **keine** Klasse und scheitern lautlos —
  stattdessen Klammer-Syntax (`w-[22px]`, `z-[15]`) verwenden.
- Deutsch für Nutzertexte, wie in `AGENTS.md` festgelegt — gilt auch für Tooltips,
  Platzhalter und Leerzustände in den neuen Komponenten.
- Theme ist bewusst einfarbig-dunkel (kein Light-Mode): Die Anwendung läuft auf
  Lagerhallen-Terminals/Monitoren, ein Light-Theme wurde nicht angefragt und passt nicht
  zum Cockpit-Charakter. Farben werden trotzdem ausschließlich über die Tokens referenziert
  (nie Hex-Literale in Komponenten, außer beim Spiegeln von `colors.ts`-Werten).

## Domänenwissen: Lager-Editor (Gang/Regalreihe/Regal/Platz)

Der Lager-Editor (`shared/editor.ts`, `scene/editorLayout.ts`, `EditorLagerOverlayScene.tsx`)
hat ein eigenes, von den Sage-Tabellen unabhängiges Struktur-Modell, das die reale
Aufbaulogik eines Lagers abbildet:

```
EditorLager → EditorGang (nummer)
            → EditorRegalreihe (seite: 'links' | 'rechts')
              → EditorRegal (ebenen, plaetzeProEbene)
                → Zelle (Ebene × Spalte) → echter Sage-Lagerplatz (per Dim1/2/3-Abgleich)
```

**Ein Gang besteht aus genau zwei Regalreihen, „links" und „rechts"** — das ist die
fachliche Definition eines Gangs (nicht nur eine einzelne Regalreihe). Dim1 = Gang-Nummer,
Dim2 = Ebene, Dim3 = laufende Spaltenposition über den ganzen Gang hinweg (Reihe „links"
dann „rechts", Reset nur bei neuem Gang) — siehe Kommentar in `shared/editor.ts`.

Die Ebenen-Hierarchie im Viewer ist entsprechend **Platz → Regal → Regalreihe → Gang →
Lager** (5 Stufen), nicht nur Platz → Lager. Das ist zu unterscheiden von der Sage-
Live-Ansicht (`scene/layout.ts`), wo eine `PlacedRack`-Instanz bereits 1:1 einem Gang
(Hochregallager) bzw. einer Reihe (Flächenlager) entspricht — dort gibt es historisch
keine eigene Regalreihen-/Gang-Zwischenebene, weil das Sage-Datenmodell sie nicht liefert.

**Interaktionskonzept für Editor-Lager im 3D-Viewer:**
- Angeklickt wird immer nur der **Platz** (einzelne Zelle) — sowohl im Orbit-/TopDown-Modus
  (normaler `onClick`) als auch im Ego-/Walk-Modus (Crosshair-Raycast über `LookTarget.tsx`,
  analog zu Sage-Regalen, per `userData.editorOverlayId/editorRegalId/editorZelleKey`).
- Die höheren Ebenen (Regal/Regalreihe/Gang/Lager) haben **keine eigene 3D-Klickfläche** —
  sie werden über einen Ebenen-Breadcrumb im Inspector erreicht (Lager › Gang › Reihe ›
  Regal › Platz, trunkiert auf die aktuelle Tiefe, wie beim bestehenden Sage-Breadcrumb).
- Aggregierte Ansichten (Regal/Reihe/Gang/Lager) bieten einen Umschalter „Je Platz" /
  „Je Artikel" (`groupRowsByArtikel` in `article.ts`), um Bestände wahlweise pro Lagerplatz
  oder aufsummiert pro Artikelnummer zu sehen.
- Auswahl-State: `EditorSelection` in `store.tsx`, getrennt von der Sage-`Selection` und mit
  ihr gegenseitig exklusiv (Klick auf das eine löscht das andere) — der Inspector zeigt immer
  nur eine der beiden Detailansichten gleichzeitig.

**Regal-Maße:** Breite/Tiefe werden pro Regal erfasst, die Höhe ausschließlich pro Ebene
(`EditorRegal.ebenenHoehen`, s. `ebenenHoehen()`/`regalHoehe()` in `shared/editor.ts`) — kein
separates Gesamthöhen-Feld. Damit beim Einrichten im Lager-Editor erkennbar ist, welcher reale
Sage-Lagerplatz (Dim1;Dim2;Dim3) an welchem Ende eines Regals/einer Reihe liegt (wichtig für
Drehung/Spiegelung), zeigt `regalDim3Bereiche()` je Regal die Dim3-Spannbreite (erste/letzte
Spalte) — im Lager-Editor sowohl in der Regal-/Reihen-Liste als auch als Label in der
3D-Vorschau.

## Bestands-Anzeige (konfigurierbare Einfärbung)

Die Bestandsfarbe je Platz/Zelle ist **nicht mehr fest verdrahtet**, sondern über
`StockAnzeigeConfig` (`shared/anzeige.ts`) konfigurierbar, pro Mandant serverseitig
gespeichert (`IAS_BestandsAnzeige`-Tabelle, `server/anzeigeStore.ts`,
`/api/anzeige?db=…&mandant=…`) und im Client per `useStockAnzeigeConfig()`
(`store.tsx`) global verfügbar. Zwei Modi:

- **Standard** (Default): binär — kein Bestand → `leerFarbe` (grau), Bestand vorhanden →
  `standardFarbe` (hellblau), unabhängig von der Menge.
- **Schwellenwert**: Farbe nach Menge, gestaffelt je Sage-Lagermengeneinheit (`Lagerbestand.einheit`,
  aus `Lagermengeneinheit`) — z. B. KG < 100 gelb, 100–500 orange, ≥ 500 rot. Fehlt für die
  Einheit eines Bestands eine Regel, greift `standardFarbe` als Fallback.

`resolveStockColor()`/`stockLegend()` (`shared/anzeige.ts`, re-exportiert als `stockColor` aus
`colors.ts`) sind die einzige Quelle für Bestandsfarben — Aufrufer übergeben immer die aktuelle
`StockAnzeigeConfig` und (wo bekannt) die Mengeneinheit des jeweiligen Bestands. Einstellbar über
das Palette-Icon in der Icon-Leiste (`StockAnzeigeSettings.tsx`).
