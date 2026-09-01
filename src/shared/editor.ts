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

export type EditorRegal = {
  id: string;
  ebenen: number;
  plaetzeProEbene: number;
  breite: number;
  hoehe: number;
  tiefe: number;
  /** Manueller Versatz (m) ab der automatischen Gang-Position — per Drag in der 3D-Vorschau gesetzt. */
  versatz?: Punkt;
  /**
   * Höhe (m) je Ebene, Index 0 = unterste Ebene — überschreibt die gleichmäßige Aufteilung von
   * `hoehe`/`ebenen` (z. B. höheres Bodenfach für Paletten). Fehlt oder passt die Länge nicht
   * zu `ebenen`, wird gleichmäßig aufgeteilt (`ebenenHoehen()`).
   */
  ebenenHoehen?: number[];
};

/** Höhe je Ebene: `regal.ebenenHoehen` wenn vollständig gesetzt, sonst `hoehe` gleichmäßig auf `ebenen` verteilt. */
export function ebenenHoehen(regal: Pick<EditorRegal, 'ebenen' | 'hoehe' | 'ebenenHoehen'>): number[] {
  if (regal.ebenenHoehen && regal.ebenenHoehen.length === regal.ebenen) return regal.ebenenHoehen;
  return Array(regal.ebenen).fill(regal.hoehe / Math.max(1, regal.ebenen));
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
