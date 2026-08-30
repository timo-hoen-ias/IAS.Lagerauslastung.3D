# IAS Lagerauslastung 3D — Godot-Client

3D-Lagerbestands-Viewer als **Godot 4.7**-Client (GDScript). Port der Web-App
(`IAS.Lagerauslastung.3D`, three.js/React) mit dem Ziel der Funktionsparität.

## Funktionen

- **Prozedurales 3D-Lager** aus `LagerDaten`: Regale aus `AnzahlDimension1/2/3`,
  Zellen als Segment-Boxen — leer transparent, Einzelartikel in Bestandsfarbe,
  mehrere Artikel prozentual entlang x aufgeteilt mit Kisten-Farbpalette.
- **Artikel-Labels** an jeder Kiste (`Artikelnummer/Name/Bestand`), LOD-basiert
  (Regale in Kamera-Nähe).
- **Pulsierende weiße Kanten** um jedes Regal (MGS-VR-Look).
- **3 Kamera-Modi** (Button oder `Tab`):
  - **Orbit** — rechts ziehen rotieren, Mausrad zoomt, WASD fliegen.
  - **Ego** — PointerLock, WASD, Shift Sprint, Leertaste Springen, AABB-Kollision,
    Fadenkreuz + LookTarget (zentraler Raycast → Inspector), Minimap.
  - **Top-Down** — orthografische Ansicht, rechts ziehen pannt, Mausrad zoomt.
- **Klick-Interaktion:** Platz anklicken → Inspector (Bestände, Last/Überlastung);
  Regal anklicken → Ort-Übersicht.
- **Artikelsuche** mit Autocomplete (20 Treffer, Tastatur), 3D-Hervorhebung (cyan Puls).
- **Bearbeiten:** Regal anklicken und ziehen (Verschieben), Panel/Tasten für
  Drehen (Q/E), Skalieren (`[`/`]`), Reset; Persistenz in `user://`.
- **Messen:** zwei Bodenpunkte klicken → Strecke.
- **Live-Buchungen:** WebSocket mit Backoff (1,5 s → 15 s); Flash an Herkunft (warm)
  und Ziel (grün) mit Menge-Label.
- **Szenen-Extras:** Gitternetz, Perimeter, FloorMask, Wände-Toggle,
  Lagerkennung-Billboards, Beleuchtungs-Toggle.

## Datenquelle

**Standardmäßig das deterministische Perf-Lager** — keine Datenbank und kein Server nötig.
Der Client versucht den Bun-Server (`http://127.0.0.1:3001/api/lager?db=perf`);
ist er nicht erreichbar, wird das identische Perf-Lager offline generiert
(Seed 42; `PERF_ORTE`/`PERF_SEED` per Env, Default 100 Orte = 40.260 Plätze).
Die Offline-Daten sind per Checksumme byte-identisch zum Server.

- `PERF_ORTE=250` → ≈100 k Plätze (MultiMesh skaliert; Kollider pro Regal).
- `WM_API_URL` / `WM_WS_URL` überschreiben die Server-URLs.

## Starten

```bash
godot --path .          # Editor
godot --path . --export-release "Linux" build/lager.x86_64   # Desktop-Build
```

Export-Templates sind installiert (`~/.local/share/godot/export_templates/4.7.2.stable/`).
Presets für Linux und Windows in `export_presets.cfg`.

## Steuerung

| Eingabe | Aktion |
| --- | --- |
| Tab | Kamera-Modus wechseln |
| Links ziehen | Orbit: (nur Edit) Regal verschieben · Messen: Punkt setzen |
| Rechts ziehen | Orbit/Top-Down: rotieren/panen |
| Mausrad | Zoom |
| WASD | fliegen / laufen / panen |
| Leertaste / Shift | hoch / runter (Orbit) · springen / sprinten (Ego) |
| Q/E · Pfeile · [ ] | Edit: drehen · verschieben · skalieren |

## Tests

```bash
godot --headless --path . --import
godot --headless --path . -s res://tests/run_tests.gd
```

Ports mit Tests: `perf_gen` (PRNG, Zählungen, Determinismus), `query` (Gruppierung,
Bestand-Aggregation, Gewichtsvorrang inkl. TS-Original-Quirk), `layout` (Regalstruktur,
Zellpositionen, Zentrierung, Farben), `transform` (Raster/Snap, AABB, Drag-Stabilität),
`boxes` (Regalteile, Wände, Bodenrahmen), `gew` (Gewichte/Überlastung, de-Format),
`article` (Suche, Platz-Lookups, platzWorld, bookingFlashes), `phys`/`fly` (Physik).

Vergleich Offline vs. Server:

```bash
curl -s 'http://127.0.0.1:3001/api/lager?db=perf' -o /tmp/lager.json
godot --headless --path . -s res://tests/compare_server.gd -- /tmp/lager.json
```

## Struktur

```
src/
├─ core/     # query, perf_gen, layout, transform, boxes, gew, article, phys, fly (TS-Ports)
│            # store.gd (Autoload: Auswahl, Transforms+Persistenz, Buchungen-Ring)
│            # data_provider.gd (HTTP ?db=perf + Offline-Fallback), live.gd (WS+Backoff), prefs.gd
├─ scene/    # warehouse.gd (MultiMesh-Aufbau, Kollider, Grid/Perimeter/Walls/Labels)
│            # orbit_camera, walk_controller, topdown_controller, highlight_box, target_marker,
│            # measure, booking_flash
├─ ui/       # hud.gd (Modi/Werkzeuge/Readout/Edit-Panel), inspector.gd (Suche/Panels), minimap, crosshair
├─ main.gd/.tscn
tests/       # Headless-Tests + Runner + Server-Vergleich
```

Bekannte Abweichungen zur Web-App (bewusst vereinfacht): Edit-Gizmo = Drag-Translate +
Panel/Tasten (kein 3D-Ring/Würfel-Gizmo); Zell-Artikel-Labels nur für selektierte/nah
gelegene Regale (LOD statt aller Zellen); kein Viewcube.
