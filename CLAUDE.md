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
- **Radar** (`Minimap.tsx`, frei verschiebbar, Standardposition oben links neben der
  Icon-Leiste): kreisförmige Variante der bisherigen Top-Down-Minimap, inkl. rotierendem
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
