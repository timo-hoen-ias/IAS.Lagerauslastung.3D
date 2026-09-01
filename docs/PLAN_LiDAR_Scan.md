# Plan: LiDAR-Lageraufnahme → automatische Lagerreihen

**Ziel:** Eine native iOS-App (`ios/`) erfasst per LiDAR (`sceneDepth`) ein Lager, zeigt erkannte Struktur (vertikale Pfosten, horizontale Träger/Ebenen, Regale) live als AR-Overlay und schickt **Struktur-JSON + Roh-Punktwolke** per `HTTP POST` an den Bun-Server. Dort wird daraus ein `EditorLager` (Gänge/Reihen/Regale) ausgewertet, in einem Review-UI korrigiert und über die bestehende `editorStore`-Logik gespeichert — ohne den manuellen `LagerWizard`.

## 1. Ausgangslage (verifiziert aus dem Code)

| Baustein | Datei | Relevanz |
|---|---|---|
| Ziel-Datenmodell | `src/shared/editor.ts:12-57` | `EditorLager` = `grundriss: Punkt[]` + `gaenge[]` (`breite`, `reihen[]` mit `seite: links|rechts`, `regale[]` mit `ebenen`, `plaetzeProEbene`, `breite`, `hoehe`, `tiefe`) |
| Platz-Ableitung | `src/shared/editor.ts:60-88` | `deriveEditorPlaetze()` leitet Sage-Dims (Dim1=Gang, Dim2=Ebene, Dim3=Spalte) ab |
| Persistenz | `src/server/editorStore.ts` | MSSQL-Tabelle, `createLager/updateLager/getLager/listLager` |
| Sage-Abgleich | `src/server/editorStore.ts:92` | `matchSage()` — echte `KHKLagerplaetze` Dim-Kombinationen |
| API | `src/server/index.ts:44-86` | `GET/POST /api/editor/lager`, `POST /api/editor/vorschau` |
| Wizard (zu ersetzen) | `src/app/ui/LagerWizard.tsx` | manueller Aufbau Gänge→Reihen→Regale |
| Grundriss-Helfer | `src/app/ui/grundriss.ts` | `computeViewBox`, `polygonArea`, `gridLines` |

## 2. Architektur

```
[iOS-App ios/]  --multipart POST-->  [Bun-Server]  -->  [ScanReview-UI]  -->  editorStore/MSSQL
 sceneDepth-Punkte                  import + extract    Korrektur             speichern
 On-Device-Erkennung                → EditorLager
 AR-Overlay + Export

Schnittpunkt: ein **JSON-Vertrag**, der auf beiden Seiten identisch ist.
```

## 3. Datenvertrag — `src/shared/scan/scanResult.ts` (neu)

```ts
export type Vec3 = { x: number; y: number; z: number };   // Meter, y = up

export type PostSegment = {
  id: string;
  bottom: Vec3;        // Fußpunkt
  top: Vec3;           // Kopfpunkt
  confidence: number;  // 0..1
};

export type BeamSegment = {
  id: string;
  start: Vec3;         // horizontales Segment
  end: Vec3;
  height: number;      // absolute Höhe über Boden (y)
  confidence: number;
};

export type RackBox = {
  id: string;
  center: Vec3;
  size: Vec3;             // breite × hoehe × tiefe
  rotationY: number;      // Drehung um Hochachse (rad)
  levelHeights: number[]; // Ebenen-Höhen (m), aufsteigend
  columnCount: number;    // Spalten (plaetzeProEbene)
  confidence: number;
};

export type ScanResult = {
  formatVersion: 1;
  units: 'meters';
  capturedAt: string;       // ISO-8601
  floorPlane: { normal: Vec3; offset: number };
  groundPolygon: Vec3[];    // Grundriss auf Bodenhöhe (→ grundriss)
  posts: PostSegment[];
  beams: BeamSegment[];
  racks: RackBox[];
};
```

Punktwolke (separat, binär): Float32 xyz + optional Intensität.

```ts
export type CloudHeader = {
  version: 1;
  pointCount: number;
  strideBytes: number;   // 12 = xyz, 16 = xyz+intensity
  bounds: { min: Vec3; max: Vec3 };
};
```

**Transport:** `POST /api/editor/scan` als `multipart/form-data`:
- Feld `scan` = `scan.json` (ScanResult)
- Feld `cloud` = `cloud.bin` (gzip, `CloudHeader` + `Float32Array`-Payload)
- Feld `mandant` = Mandant, `lagerkennung` = Ziel-Lagerkennung

Grund: JSON wäre für Punktwolken (>10⁶ Punkte) zu groß; binär + gzip ist realistisch.

## 4. Bun-Server (Web-App) — neue Dateien

**`src/server/scan/import.ts`** (neu)
- `parseScanRequest(req: Request)` → liest Multipart, validiert `ScanResult` (Pflichtfelder, Einheiten, `formatVersion`), entpackt Punktwolke.
- Speichert Entwurf (in-memory/DB) für den Review-Schritt.

**`src/server/scan/extract.ts`** (neu, Kern der Auswertung — pure Funktionen)
- `extractEditorLager(scan: ScanResult, meta): EditorLager` — Pipeline:
  1. `groundPolygon` → `grundriss: Punkt[]` (x/z auf Bodenebene).
  2. `racks` nach `rotationY` gruppieren → parallele Regalreihen.
  3. Reihen entlang Gang-Richtung sortieren → Gänge (`breite` = Abstand gegenüberliegender Reihen), `seite` links/rechts aus Offset zum Gang-Mittelpunkt.
  4. Pro RackBox: `levelHeights.length` → `ebenen`, `columnCount` → `plaetzeProEbene`, `size` → `breite/hoehe/tiefe`.
  5. Fallback über `posts`/`beams`, wenn `racks` leer (Pfostenabstand → Spalten, Beam-Höhen → Ebenen).
- `warnungen(scan, lager)` → Abgleich gegen `matchSage()`-Ergebnis.

**`src/server/index.ts`** (ändern)
- Neue Route `POST /api/editor/scan` (Multipart), `GET /api/editor/scan/:id` (Entwurf laden).

## 5. Review-UI — `src/app/ui/ScanReview.tsx` (neu)

- Zeigt erkanntes Lager (Gänge/Regale) auf Basis des `EditorLager` in der 3D-Szene oder als Grundriss.
- Pro Gang/Regal Korrektur: `ebenen`, `plaetzeProEbene`, `breite/hoehe/tiefe`, Gang-`breite` (analog zu den Eingaben des `LagerWizard`, aber vorausgefüllt).
- Warnliste (nicht in Sage gefundene Dim-Kombinationen).
- „Speichern" → `POST /api/editor/lager` (bestehende Logik).
- Einstieg: neuer Button im `HUD.tsx` neben dem Wizard.

## 6. iOS-App — `ios/` (neu, separater Xcode-Target)

**Stack:** Swift, ARKit (`ARWorldTrackingConfiguration`), SceneKit/RealityKit. Deployment-Target iOS 17, LiDAR-Gerät (iPhone/iPad Pro 2020+).

**Module:**
- `DepthCapture.swift` — `frameSemantics = [.smoothedSceneDepth]`, Tiefenpixel via Kamera-Intrinsics + `camera.transform` in 3D-Punkte zurückprojizieren; akkumulieren in Chunk-/Voxel-Grid (Downsampling, Speicher begrenzen).
- `FloorPlane.swift` — Boden über horizontale `ARPlaneAnchor`.
- `StructureDetector.swift` — On-Device-Erkennung (grob): vertikale Cluster → Pfosten, Höhen-Slices → Träger, Gruppierung → Regal-Boxen.
- `ScanOverlay.swift` — AR-Overlay: Pfosten als Zylinder, Träger als Balken, Regale als Drahtgitter; Toggle zur Ein-/Ausblendung.
- `ScanExporter.swift` — baut `ScanResult` + binäre Punktwolke, `POST` an konfigurierbare URL (`http://<pc-ip>:3001/api/editor/scan`), Fallback Datei-Export.

## 7. Test-Plan (Vitest, Pflicht lt. `AGENTS.md`)

- `extract.test.ts` — Fixture-ScanResult (künstliche Regalreihen) → erwartetes `EditorLager`; Kantenfälle: leere `racks`, nur `posts/beams`, schräge Reihen, ungleiche Regalanzahl.
- `import.test.ts` — Multipart-Parsing, Validierung (fehlende Felder, falsche `formatVersion`), Punktwolken-Decompression.
- Vertrag-Roundtrip: `ScanResult` ↔ JSON.
- `ScanReview`-Logik: Korrekturwerte korrekt in `EditorLager` überführt.

## 8. Umsetzungsreihenfolge

1. `src/shared/scan/scanResult.ts` + Tests (Vertrag fixieren).
2. `src/server/scan/import.ts` + `extract.ts` + Tests (iterierbar ohne iPhone).
3. Route `POST /api/editor/scan` + Entwurf-Endpoint.
4. `ScanReview.tsx` + HUD-Einstieg + Speichern.
5. `ios/`-App: Erfassung → Overlay → Export.
6. End-to-End im echten Lager; Erkennung kalibrieren.

## 9. Risiken & Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Erkennungsqualität (verdeckte Pfosten, Gitterböden, Licht) | On-Device nur grob; Feinarbeit + Review in der Web-Auswertung |
| Punktwolken-Größe (>1000 m²) | Downsampling/Chunking auf iOS, binärer Export |
| Swift/ARKit = zweiter Toolchain-Zweig | klar getrennt in `ios/`, Vertrag über JSON isoliert die Welten |
| iOS-Device im Lager-LAN | LAN-IP im App-Settings-Dialog konfigurierbar |
