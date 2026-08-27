# IAS Warehouse Map — 3D-Lagerbestands-Viewer (Studie)

Proof-of-Concept: Die **Lagerplaner/Level-Editor**-Idee aus *warehouse.ops* (three.js-Szene,
Orbit/Zoom-Kamera, Raycast-Picking) als Business-Anwendung. Ein Bun-Backend liest echte
Lagerbestände aus MSSQL und rendert daraus ein begehbares 3D-Lager in React + three.js.

## Funktionen

- **Automatischer 3D-Aufbau:** Jeder `Lagerort` wird ein Regalblock, aufgebaut aus
  `AnzahlDimension1/2/3` (Spalten × Ebenen × Tiefe). Jeder `Lagerplatz` ist eine klickbare Zelle.
- **Lagerkennung-Labels:** Schwebt per Billboard über jedem Regal.
- **Farbcodierung:**
  - Regalgestell → nach `Lagertechnik` (`LTD0ST`/`LTD1UF`/`LTD1BL`/`LTD2SF`/`LTD3HR`),
    Legende unten links.
  - Zellen → nach Bestand: leer (grau), < 100 (grün), 100–499 (gelb), ≥ 500 (rot).
- **Klick-Interaktion** (`@react-three/uikit`-Panel, Needle-Inspector-Stil):
  - **Platz** anklicken → Artikelnummer + Bezeichnung + Bestand dieses Platzes.
  - **Regal** anklicken → Übersicht aller belegten Plätze des Lagerorts.
- **Zwei Kamera-Modi** (`Tab` oder Button):
  - **Orbit** — wie im Level-Editor zoomen/panen.
  - **Ego** — PointerLock + WASD, mit AABB-Kollision gegen alle Regale.

## Start

Voraussetzungen: Bun ≥ 1.4, laufender MSSQL-Server mit der Datenbank `oldemoreweabfd`.

```bash
cp .env.example .env   # ggf. Zugangsdaten anpassen
bun install
bun run dev            # Server :3001 + Vite :5173 (Proxy /api)
```

Öffne http://localhost:5173.

## Architektur

```
src/
├─ server/          # Bun.serve + mssql-Pool
│  ├─ index.ts      # GET /api/lager (2 Queries, gecacht im Pool)
│  ├─ query.ts      # SQL-Abfragen + Gruppierung Ort→Platz→Bestände
│  └─ query.test.ts
├─ shared/types.ts  # gemeinsame Typen (Server + Client)
└─ app/
   ├─ scene/        # WarehouseScene, Rack, Cell, WalkControls, layout
   ├─ ui/           # Inspector (@react-three/uikit), HUD (HTML-Legende)
   ├─ colors.ts     # Lagertechnik- & Bestands-Farben
   └─ App.tsx       # Daten-Loading, Modus-Umschaltung
```

Die beiden SQL-Queries: `LAGER_SQL` (die ursprüngliche 4-Tabellen-Abfrage mit
`KHKLagerplatzbestaende`) für die Bestände, `PLAETZE_SQL` (`KHKLagerorte` × `KHKLagerplaetze`)
für das **vollständige** Platz-Inventar inkl. leerer Plätze. `select *` ist dabei durch
explizite, aliasierte Spalten ersetzt, weil die Spaltennamen (`Lagerkennung`, `Mandant`, …)
in allen vier Tabellen vorkommen und der Treiber sonst Arrays statt Skalare liefert.

## Skripte

| Skript | Zweck |
| --- | --- |
| `bun run dev` | Server (:3001) + Vite (:5173) parallel |
| `bun run dev:server` / `dev:client` | getrennt |
| `bun run test` | Vitest (Gruppierung + Regal-Layout) |
| `bun run build` | `tsc -b && vite build` |

## Bewusst weggelassen (Studie)

- Lagertechnik-spezifische Regalgeometrie (nur generische Racks aus Dimensionen).
- Schreibender DB-Zugriff / Umbuchungen.
- InstancedMesh (bei < 1.000 Zellen unnötig).
- Die drei.js-`Text`-Labels laden ihre Schrift zur Laufzeit (troika, Netz nötig);
  das uikit-Inspector-Panel ist offline-fähig (Inter ist gebundelt).
