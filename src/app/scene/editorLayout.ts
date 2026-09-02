import { ebenenHoehen as regalEbenenHoehen, regalHoehe, type EditorGang, type Punkt } from '../../shared/editor';

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
/** Auto-Z-Position (Gang-Mittellinie ± halbe Gangbreite ± halbe Regaltiefe) jeder Reihe über alle Gänge hinweg, ohne jeden `versatz` — Grundlage für `resolveAnkerVersatzZ()`, die auch Reihen fremder Gänge referenzieren kann. */
function zBasisJeReihe(gaenge: EditorGang[], grundriss: Punkt[]): Map<string, number> {
  const origin = layoutOrigin(grundriss);
  const out = new Map<string, number>();
  for (const gang of gaenge) {
    const tiefeVon = (seite: 'links' | 'rechts'): number =>
      Math.max(0, ...gang.reihen.filter((r) => r.seite === seite).flatMap((r) => r.regale.map((x) => x.tiefe)));
    const zLinks = origin.z - (gang.breite / 2 + tiefeVon('links') / 2);
    const zRechts = origin.z + (gang.breite / 2 + tiefeVon('rechts') / 2);
    for (const reihe of gang.reihen) out.set(reihe.id, reihe.seite === 'links' ? zLinks : zRechts);
  }
  return out;
}

/**
 * Löst den effektiven Z-Versatz jeder Reihe auf: normalerweise `reihe.versatz.z`, bei gesetztem
 * `reihe.anker` stattdessen aus der AKTUELLEN Position der Ziel-Reihe abgeleitet (`offset` bleibt
 * konstant, die Ziel-Position wird jedes Mal neu berechnet) — s. Kommentar an `EditorRegalreihe`
 * in shared/editor.ts. Ziel-Reihen können selbst wieder verankert sein, daher rekursiv, mit
 * Zyklen-Schutz (sollte über die UI nicht vorkommen, aber ein Absturz wäre schlimmer als ein
 * ignorierter Zirkelbezug).
 */
function resolveAnkerVersatzZ(gaenge: EditorGang[], zBasis: Map<string, number>): Map<string, number> {
  const reiheById = new Map(gaenge.flatMap((g) => g.reihen).map((r) => [r.id, r] as const));
  const resolved = new Map<string, number>();
  const inArbeit = new Set<string>();

  function resolve(reiheId: string): number {
    const cached = resolved.get(reiheId);
    if (cached !== undefined) return cached;
    const reihe = reiheById.get(reiheId);
    if (!reihe) return 0;
    let v: number;
    if (reihe.anker && !inArbeit.has(reiheId) && reiheById.has(reihe.anker.reiheId) && zBasis.has(reihe.anker.reiheId)) {
      inArbeit.add(reiheId);
      const zielZ = zBasis.get(reihe.anker.reiheId)! + resolve(reihe.anker.reiheId);
      v = zielZ + reihe.anker.offset - (zBasis.get(reiheId) ?? 0);
      inArbeit.delete(reiheId);
    } else {
      v = reihe.versatz?.z ?? 0;
    }
    resolved.set(reiheId, v);
    return v;
  }

  for (const id of reiheById.keys()) resolve(id);
  return resolved;
}

export function layoutEditorGaenge(gaenge: EditorGang[], grundriss: Punkt[] = []): EditorRegalPlacement[] {
  const out: EditorRegalPlacement[] = [];
  const origin = layoutOrigin(grundriss);
  const zBasis = zBasisJeReihe(gaenge, grundriss);
  const versatzZAufgeloest = resolveAnkerVersatzZ(gaenge, zBasis);
  let gangX = origin.x;

  for (const gang of gaenge) {
    /**
     * Erst die Breite jeder Reihe (Summe der Regalbreiten) im Voraus ermitteln, statt sie beim
     * Positionieren mitzuzählen — eine rechtsbündige Reihe (`buendig: 'rechts'`) muss die
     * Gesamtbreite des Gangs schon kennen, um ihren Start-Offset zu berechnen (s. u.).
     */
    const reiheBreite = new Map(gang.reihen.map((r) => [r.id, r.regale.reduce((s, x) => s + x.breite, 0)]));
    const gangBreiteGenutzt = Math.max(0, ...reiheBreite.values());

    for (const reihe of gang.reihen) {
      const z = zBasis.get(reihe.id)!;
      const reiheVersatzX = reihe.versatz?.x ?? 0;
      const reiheVersatzZ = versatzZAufgeloest.get(reihe.id) ?? 0;
      const startOffset = reihe.buendig === 'rechts' ? gangBreiteGenutzt - reiheBreite.get(reihe.id)! : 0;
      let x = gangX + startOffset;
      for (const regal of reihe.regale) {
        out.push({
          gangId: gang.id,
          gangNummer: gang.nummer,
          reiheId: reihe.id,
          regalId: regal.id,
          seite: reihe.seite,
          position: [
            x + regal.breite / 2 + (regal.versatz?.x ?? 0) + reiheVersatzX,
            0,
            z + (regal.versatz?.z ?? 0) + reiheVersatzZ,
          ],
          size: { w: regal.breite, h: regalHoehe(regal), d: regal.tiefe },
          ebenen: regal.ebenen,
          ebenenHoehen: regalEbenenHoehen(regal),
          rotationY: ((reihe.rotation ?? 0) * Math.PI) / 180,
          spiegelX: reihe.spiegelX ?? false,
          spiegelZ: reihe.spiegelZ ?? false,
        });
        x += regal.breite;
      }
    }
    gangX += gangBreiteGenutzt + GANG_ABSTAND;
  }
  return out;
}

/** Grundfläche eines Regal-Placements nach Reihen-Drehung (90°/270° tauschen Breite/Tiefe). */
export function gedrehteAusdehnung(p: Pick<EditorRegalPlacement, 'size' | 'rotationY'>): { w: number; d: number } {
  const grad = Math.round((p.rotationY * 180) / Math.PI);
  const gedreht = ((((grad % 180) + 180) % 180) === 90);
  return gedreht ? { w: p.size.d, d: p.size.w } : { w: p.size.w, d: p.size.d };
}

export type GangGuide = {
  gangId: string;
  gangNummer: number;
  /** Konfigurierte (Soll-)Gangbreite (m), s. `EditorGang.breite`. */
  breiteSoll: number;
  /** Tatsächlicher Abstand (m) zwischen den einander zugewandten Regal-Kanten — inkl. manuellem `versatz`. */
  breiteIst: number;
  /** Mittellinie zwischen den beiden Reihen (Weltkoordinate) — inkl. manuellem `versatz`, folgt also dem Ziehen. */
  z: number;
  /** X-Spanne (Weltkoordinaten) über alle Regale dieses Gangs — inkl. manuellem `versatz`. */
  xVon: number;
  xBis: number;
};

/**
 * Referenz-Rechteck je Gang zwischen den TATSÄCHLICHEN aktuellen Positionen der Reihen "links"
 * und "rechts" (aus `placements`, inkl. manuellem `versatz`) — nicht aus der theoretischen
 * Gang-Definition, damit die Markierung beim Ziehen in der 3D-Vorschau mitwandert und man Ist-
 * mit Soll-Gangbreite (`EditorGang.breite`) vergleichen kann, statt nur an einem fixen
 * Lager-Mittelpunkt zu kleben.
 */
export function gangGuides(gaenge: EditorGang[], placements: EditorRegalPlacement[]): GangGuide[] {
  const breiteSollById = new Map(gaenge.map((g) => [g.id, g.breite]));
  const byGang = new Map<string, EditorRegalPlacement[]>();
  for (const p of placements) {
    const list = byGang.get(p.gangId);
    if (list) list.push(p);
    else byGang.set(p.gangId, [p]);
  }
  const out: GangGuide[] = [];
  for (const [gangId, list] of byGang) {
    const links = list.filter((p) => p.seite === 'links');
    const rechts = list.filter((p) => p.seite === 'rechts');
    if (links.length === 0 || rechts.length === 0) continue;
    const linksInnenkante = Math.max(...links.map((p) => p.position[2] + gedrehteAusdehnung(p).d / 2));
    const rechtsInnenkante = Math.min(...rechts.map((p) => p.position[2] - gedrehteAusdehnung(p).d / 2));
    const xs = list.flatMap((p) => {
      const { w } = gedrehteAusdehnung(p);
      return [p.position[0] - w / 2, p.position[0] + w / 2];
    });
    out.push({
      gangId,
      gangNummer: list[0]!.gangNummer,
      breiteSoll: breiteSollById.get(gangId) ?? 0,
      breiteIst: rechtsInnenkante - linksInnenkante,
      z: (linksInnenkante + rechtsInnenkante) / 2,
      xVon: Math.min(...xs),
      xBis: Math.max(...xs),
    });
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

/** Ab dieser Abweichung (Anteil der Kantenlänge) gilt eine Wand nicht mehr als achsparallel. */
const WAND_ACHS_TOLERANZ = 0.05;

/**
 * Andock-Kandidaten (Innenfläche der Wand, Richtung Polygon-Mitte versetzt) für jede
 * achsparallele Kante des Grundriss-Polygons — Gegenstück zu den Nachbar-Regal-Kandidaten
 * (`snapKandidaten()` in EditorPreview3D.tsx), damit Regale/Reihen/Gänge beim Ziehen zusätzlich
 * an der Wand einrasten ("Andocken") statt versehentlich außerhalb des Grundrisses zu landen.
 * Schräge Wände liefern keinen Kandidaten — ohne exakte X/Z-Ausrichtung gibt es keinen
 * sinnvollen einzelnen Achsenwert zum Einrasten.
 */
export function wandKandidaten(points: Punkt[], wandDicke: number): { x: number[]; z: number[] } {
  if (points.length < 3) return { x: [], z: [] };
  const mitte = polygonCenter(points);
  const x: number[] = [];
  const z: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const laenge = Math.hypot(dx, dz);
    if (laenge < 1e-6) continue;
    if (Math.abs(dz) / laenge < WAND_ACHS_TOLERANZ) {
      const wandZ = (a.z + b.z) / 2;
      z.push(wandZ + Math.sign(mitte.z - wandZ || 1) * (wandDicke / 2));
    } else if (Math.abs(dx) / laenge < WAND_ACHS_TOLERANZ) {
      const wandX = (a.x + b.x) / 2;
      x.push(wandX + Math.sign(mitte.x - wandX || 1) * (wandDicke / 2));
    }
  }
  return { x, z };
}
