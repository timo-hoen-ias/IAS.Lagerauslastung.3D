import { ebenenHoehen as regalEbenenHoehen, type EditorGang, type Punkt } from '../../shared/editor';

/** Abstand (m) zwischen zwei aufeinanderfolgenden Gängen. */
const GANG_ABSTAND = 3;
/** Mindestabstand (m) der Gang-Anordnung von der linken Grundriss-Wand. */
const WAND_ABSTAND = 1.5;

export type EditorRegalPlacement = {
  gangId: string;
  gangNummer: number;
  reiheId: string;
  regalId: string;
  seite: 'links' | 'rechts';
  /** Mitte der Bodenfläche (x, 0, z). */
  position: [number, number, number];
  size: { w: number; h: number; d: number };
  ebenen: number;
  /** Höhe (m) je Ebene, s. `ebenenHoehen()` in shared/editor.ts. */
  ebenenHoehen: number[];
  /** Drehung der Reihe um die eigene Achse (Radiant), s. `EditorRegalreihe.rotation`. */
  rotationY: number;
  /** Spiegelung der Reihe, s. `EditorRegalreihe.spiegelX/spiegelZ`. */
  spiegelX: boolean;
  spiegelZ: boolean;
};

/**
 * Startpunkt der Gang-Anordnung: nahe der linken Wand und vertikal auf der Mitte
 * des Grundrisses zentriert, statt immer bei (0,0) zu beginnen — sonst landet die
 * Auto-Anordnung je nach gezeichnetem Grundriss außerhalb des Polygons.
 * Ohne Grundriss (z. B. in Tests) bleibt der Ursprung bei (0,0).
 */
function layoutOrigin(grundriss: Punkt[]): Punkt {
  if (grundriss.length < 3) return { x: 0, z: 0 };
  const xs = grundriss.map((p) => p.x);
  const zs = grundriss.map((p) => p.z);
  return { x: Math.min(...xs) + WAND_ABSTAND, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
}

/**
 * Platziert alle Regale automatisch entlang der Gänge (kein manuelles Positionieren
 * nötig): jeder Gang bekommt zwei Regalreihen ("links"/"rechts") entlang der
 * Gangbreite, Regale einer Reihe stehen fortlaufend nebeneinander — analog zur
 * automatischen Anordnung echter Sage-Lagerorte in `scene/layout.ts`. `grundriss`
 * verschiebt die gesamte Anordnung an den Anfang des gezeichneten Polygons; ein
 * per Drag gesetzter `regal.versatz` wird zusätzlich obendrauf angewendet.
 */
export function layoutEditorGaenge(gaenge: EditorGang[], grundriss: Punkt[] = []): EditorRegalPlacement[] {
  const out: EditorRegalPlacement[] = [];
  const origin = layoutOrigin(grundriss);
  let gangX = origin.x;

  for (const gang of gaenge) {
    const tiefeVon = (seite: 'links' | 'rechts'): number =>
      Math.max(0, ...gang.reihen.filter((r) => r.seite === seite).flatMap((r) => r.regale.map((x) => x.tiefe)));
    const zLinks = origin.z - (gang.breite / 2 + tiefeVon('links') / 2);
    const zRechts = origin.z + (gang.breite / 2 + tiefeVon('rechts') / 2);

    let gangBreiteGenutzt = 0;
    for (const reihe of gang.reihen) {
      const z = reihe.seite === 'links' ? zLinks : zRechts;
      const reiheVersatz = reihe.versatz ?? { x: 0, z: 0 };
      let x = gangX;
      for (const regal of reihe.regale) {
        out.push({
          gangId: gang.id,
          gangNummer: gang.nummer,
          reiheId: reihe.id,
          regalId: regal.id,
          seite: reihe.seite,
          position: [
            x + regal.breite / 2 + (regal.versatz?.x ?? 0) + reiheVersatz.x,
            0,
            z + (regal.versatz?.z ?? 0) + reiheVersatz.z,
          ],
          size: { w: regal.breite, h: regal.hoehe, d: regal.tiefe },
          ebenen: regal.ebenen,
          ebenenHoehen: regalEbenenHoehen(regal),
          rotationY: ((reihe.rotation ?? 0) * Math.PI) / 180,
          spiegelX: reihe.spiegelX ?? false,
          spiegelZ: reihe.spiegelZ ?? false,
        });
        x += regal.breite;
      }
      gangBreiteGenutzt = Math.max(gangBreiteGenutzt, x - gangX);
    }
    gangX += gangBreiteGenutzt + GANG_ABSTAND;
  }
  return out;
}

export type WallSegment = { position: [number, number, number]; rotationY: number; length: number };

/** Ein Wandsegment je Kante des (geschlossenen) Grundriss-Polygons. */
export function wallSegments(points: Punkt[], height: number): WallSegment[] {
  const segs: WallSegment[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    segs.push({
      position: [(a.x + b.x) / 2, height / 2, (a.z + b.z) / 2],
      rotationY: -Math.atan2(dz, dx),
      length,
    });
  }
  return segs;
}

/** Schwerpunkt des Polygons (für Kamera-Ausrichtung); {0,0} wenn leer. */
export function polygonCenter(points: Punkt[]): Punkt {
  if (points.length === 0) return { x: 0, z: 0 };
  const x = points.reduce((s, p) => s + p.x, 0) / points.length;
  const z = points.reduce((s, p) => s + p.z, 0) / points.length;
  return { x, z };
}
