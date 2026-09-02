/**
 * Datenmodell für den Lager-Editor/Wizard (eigene Struktur, unabhängig von den
 * Sage-Tabellen KHKLagerorte/KHKLagerplaetze). Ein Lager entspricht genau einer
 * Sage-Lagerkennung; die drei Sage-Dimensionen werden ausschließlich abgeleitet:
 *
 *   Dim1 = Gang-Nummer
 *   Dim2 = Ebene
 *   Dim3 = laufende Spaltenposition über den gesamten Gang (Reihe "links" dann
 *          "rechts" ohne Reset dazwischen), Reset nur bei einem neuen Gang.
 */

/** Standardhöhe (m) einer neuen bzw. neu hinzukommenden Ebene. */
export const DEFAULT_EBENE_HOEHE = 0.6;

export type EditorRegal = {
  id: string;
  ebenen: number;
  plaetzeProEbene: number;
  breite: number;
  tiefe: number;
  /** Manueller Versatz (m) ab der automatischen Gang-Position — per Drag in der 3D-Vorschau gesetzt. */
  versatz?: Punkt;
  /**
   * Höhe (m) je Ebene, Index 0 = unterste Ebene — einzige Quelle für die Regalhöhe (kein
   * separates Gesamthöhen-Feld mehr, s. `regalHoehe()`). Fehlt oder passt die Länge nicht zu
   * `ebenen`, wird mit dem letzten vorhandenen Wert bzw. `DEFAULT_EBENE_HOEHE` aufgefüllt/gekappt.
   */
  ebenenHoehen?: number[];
};

/** Höhe je Ebene, immer mit Länge `ebenen`: vorhandene Werte bleiben, fehlende werden mit dem letzten Wert (oder Default) aufgefüllt, überzählige gekappt. */
export function ebenenHoehen(regal: Pick<EditorRegal, 'ebenen' | 'ebenenHoehen'>): number[] {
  const hoehen = regal.ebenenHoehen ?? [];
  if (hoehen.length === regal.ebenen) return hoehen;
  if (hoehen.length > regal.ebenen) return hoehen.slice(0, regal.ebenen);
  const fill = hoehen[hoehen.length - 1] ?? DEFAULT_EBENE_HOEHE;
  return [...hoehen, ...Array(regal.ebenen - hoehen.length).fill(fill)];
}

/** Gesamthöhe (m) eines Regals — Summe der Ebenenhöhen. */
export function regalHoehe(regal: Pick<EditorRegal, 'ebenen' | 'ebenenHoehen'>): number {
  return ebenenHoehen(regal).reduce((s, h) => s + h, 0);
}

export type EditorRegalreihe = {
  id: string;
  seite: 'links' | 'rechts';
  regale: EditorRegal[];
  /** Manueller Versatz (m) der ganzen Reihe ab der automatischen Gang-Position — per Drag in der 3D-Vorschau gesetzt, wirkt zusätzlich zum Versatz einzelner Regale. */
  versatz?: Punkt;
  /** Drehung der ganzen Reihe um die eigene Achse (Grad, 90°-Raster) — gleicht die Auto-Anordnung an die reale Ausrichtung der Regale an. */
  rotation?: number;
  /** Spiegelung der ganzen Reihe an der lokalen X-Achse (Spaltenrichtung) bzw. Z-Achse (Regaltiefe) — für Aufbauten, die per 90°-Drehung allein nicht auf die reale Ausrichtung passen. */
  spiegelX?: boolean;
  spiegelZ?: boolean;
  /**
   * Bündig-Kante entlang der Gang-Längsachse (Dim3-Richtung), Default „links": bei Reihen
   * unterschiedlicher Länge (z. B. 11 vs. 10 Regale) startet die Anordnung sonst immer am
   * gemeinsamen linken Gang-Anfang, wodurch die kürzere Reihe rechts mitten im Raum endet statt an
   * der Wand. „rechts" richtet die Reihe stattdessen am rechten Ende des Gangs aus — ohne Drag
   * und ohne die Sage-Zuordnung zu berühren (Dim3 hängt nur von der Reihenfolge in `gang.reihen`
   * ab, nicht von der X-Position, s. `regalDim3Bereiche()`/`deriveEditorPlaetze()`).
   */
  buendig?: 'links' | 'rechts';
  /**
   * Persistenter Andock-Anker an eine andere Reihe (Z-Achse, i. d. R. eine Reihe eines Nachbar-
   * Gangs) — Alternative zu `versatz.z`, die beim Ziehen in der 3D-Vorschau automatisch gesetzt
   * wird, wenn die Reihe an einer Nachbar-Reihe einrastet (s. `resolveAnkerVersatzZ()` in
   * scene/editorLayout.ts). Anders als `versatz.z` ist das kein fixer Wert: `offset` (der Z-
   * Abstand der beiden Reihen-Mittellinien zum Zeitpunkt des Andockens) bleibt konstant, die
   * tatsächliche Position wird bei jeder Neuberechnung aus der AKTUELLEN Position der Ziel-Reihe
   * neu abgeleitet — bleibt die Reihe so z. B. beim Ändern der eigenen oder der Ziel-Gangbreite
   * weiterhin an der Ziel-Reihe „angehackt", statt wie ein fixer Versatz auseinanderzudriften.
   * `versatz.z` wird bei aktivem Anker ignoriert; `versatz.x` bleibt unabhängig davon wirksam.
   */
  anker?: { reiheId: string; offset: number };
};

/** Dreht eine Reihe um `deltaDeg` (90°-Raster), auf [0,360) normalisiert. */
export function rotateReihe(rotation: number | undefined, deltaDeg: number): number {
  return (((rotation ?? 0) + deltaDeg) % 360 + 360) % 360;
}

export type EditorGang = {
  id: string;
  nummer: number;
  breite: number;
  reihen: EditorRegalreihe[];
};

export type Punkt = { x: number; z: number };

export type EditorLager = {
  id: string;
  name: string;
  connectionId: string;
  mandant: number;
  lagerkennung: string;
  grundriss: Punkt[];
  gaenge: EditorGang[];
};

export type EditorPlatz = {
  gangId: string;
  reiheId: string;
  regalId: string;
  seite: 'links' | 'rechts';
  ebene: number;
  spalte: number;
  dim1: number;
  dim2: number;
  dim3: number;
  code: string;
};

export type RegalDim3Bereich = { regalId: string; von: number; bis: number };

/**
 * Dim3-Spannbreite (erste/letzte Spalte) jedes Regals eines Gangs — dieselbe fortlaufende
 * Zählung wie `deriveEditorPlaetze()` (Reihe "links" dann "rechts", kein Reset dazwischen),
 * aber ohne die vollen Plätze zu materialisieren. Hilft beim Einrichten im Lager-Editor zu
 * erkennen, welcher Sage-Lagerplatz (Dim1;Dim2;Dim3) an welchem Ende eines Regals/einer Reihe
 * liegt, um Drehung/Spiegelung richtig an die reale Ausrichtung anzupassen.
 */
export function regalDim3Bereiche(gang: Pick<EditorGang, 'reihen'>): RegalDim3Bereich[] {
  const out: RegalDim3Bereich[] = [];
  let spaltenOffset = 0;
  for (const reihe of gang.reihen) {
    for (const regal of reihe.regale) {
      out.push({ regalId: regal.id, von: spaltenOffset + 1, bis: spaltenOffset + regal.plaetzeProEbene });
      spaltenOffset += regal.plaetzeProEbene;
    }
  }
  return out;
}

/** Leitet alle Plätze eines Lagers rein aus der Gang/Reihe/Regal-Struktur ab. */
export function deriveEditorPlaetze(lager: Pick<EditorLager, 'lagerkennung' | 'gaenge'>): EditorPlatz[] {
  const out: EditorPlatz[] = [];
  for (const gang of lager.gaenge) {
    let spaltenOffset = 0;
    for (const reihe of gang.reihen) {
      for (const regal of reihe.regale) {
        for (let spalte = 1; spalte <= regal.plaetzeProEbene; spalte++) {
          const dim3 = spaltenOffset + spalte;
          for (let ebene = 1; ebene <= regal.ebenen; ebene++) {
            out.push({
              gangId: gang.id,
              reiheId: reihe.id,
              regalId: regal.id,
              seite: reihe.seite,
              ebene,
              spalte,
              dim1: gang.nummer,
              dim2: ebene,
              dim3,
              code: `${lager.lagerkennung};${gang.nummer};${ebene};${dim3}`,
            });
          }
        }
        spaltenOffset += regal.plaetzeProEbene;
      }
    }
  }
  return out;
}
