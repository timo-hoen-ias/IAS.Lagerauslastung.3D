import type { Lagerort, Lagerplatz } from '../shared/types';
import type { EditorGang, EditorLager, Punkt } from '../shared/editor';
import { deriveEditorPlaetze } from '../shared/editor';
import { layoutEditorGaenge, type EditorRegalPlacement } from './scene/editorLayout';
import { rowsFromPlaetze, type OrtRow } from './article';

/** Eine Zelle (Ebene×Spalte) eines Regals — `platz` fehlt, wenn kein passender Sage-Lagerplatz gefunden wurde. */
export type EditorZelleOverlay = { ebene: number; spalte: number; platz?: Lagerplatz };
export type EditorRegalOverlay = { placement: EditorRegalPlacement; zellen: EditorZelleOverlay[] };

export type EditorLagerOverlay = {
  id: string;
  name: string;
  lagerkennung: string;
  grundriss: Punkt[];
  regale: EditorRegalOverlay[];
};

export type EditorLagerLike = Pick<EditorLager, 'id' | 'name' | 'lagerkennung' | 'grundriss'> & { gaenge: EditorGang[] };

/** Eintrag aus `GET /api/editor/lager` (Metadaten ohne Grundriss/Gänge). */
export type EditorLagerListItem = { id: string; name: string; mandant: number; lagerkennung: string };

/** Ein Overlay plus Weltposition (Staging-Bereich neben der Live-Ansicht, s. `stageEditorOverlays`). */
export type PositionedEditorOverlay = { overlay: EditorLagerOverlay; offset: Punkt };

/**
 * Reiht sichtbare Editor-Overlays entlang der X-Achse rechts neben der Live-Ansicht auf
 * (`startX` = deren rechter Rand + Puffer), damit sie sich nicht mit der automatischen
 * Regal-Anordnung oder untereinander überschneiden.
 */
export function stageEditorOverlays(overlays: EditorLagerOverlay[], startX: number): PositionedEditorOverlay[] {
  const GAP = 8;
  let x = startX + GAP;
  const out: PositionedEditorOverlay[] = [];
  for (const overlay of overlays) {
    const xs = overlay.grundriss.map((p) => p.x);
    const width = xs.length > 0 ? Math.max(...xs) - Math.min(...xs) : 20;
    const minX = xs.length > 0 ? Math.min(...xs) : 0;
    out.push({ overlay, offset: { x: x - minX, z: 0 } });
    x += width + GAP;
  }
  return out;
}

/**
 * Verknüpft ein im Lager-Editor entworfenes Lager mit den echten Sage-Beständen: Für jeden
 * abgeleiteten Editor-Platz (Dim1/2/3) wird der passende echte `Lagerplatz` aus `ort`
 * gesucht (per Dim1/2/3-Abgleich, wie `matchSage` serverseitig) und seinem Regal als Zelle
 * (Ebene×Spalte) zugeordnet. Ohne passenden `ort` (Lagerkennung im aktuellen Mandanten nicht
 * vorhanden) bleiben alle Zellen ohne `platz` — das Raster (inkl. Ebenen) bleibt trotzdem
 * sichtbar, nur ohne Bestandsfarbe, dient dann nur der Layout-Kontrolle.
 */
export function buildEditorOverlay(lager: EditorLagerLike, ort: Lagerort | undefined): EditorLagerOverlay {
  const placements = layoutEditorGaenge(lager.gaenge, lager.grundriss);
  const editorPlaetze = deriveEditorPlaetze(lager);

  const platzByDim = new Map<string, Lagerplatz>();
  if (ort) {
    for (const p of ort.plaetze) platzByDim.set(`${p.dim.d1};${p.dim.d2};${p.dim.d3}`, p);
  }

  const zellenByRegal = new Map<string, EditorZelleOverlay[]>();
  for (const ep of editorPlaetze) {
    const zelle: EditorZelleOverlay = { ebene: ep.ebene, spalte: ep.spalte, platz: platzByDim.get(`${ep.dim1};${ep.dim2};${ep.dim3}`) };
    const list = zellenByRegal.get(ep.regalId);
    if (list) list.push(zelle);
    else zellenByRegal.set(ep.regalId, [zelle]);
  }

  return {
    id: lager.id,
    name: lager.name,
    lagerkennung: lager.lagerkennung,
    grundriss: lager.grundriss,
    regale: placements.map((placement) => ({ placement, zellen: zellenByRegal.get(placement.regalId) ?? [] })),
  };
}

// ---- Ebenen-Navigation (Platz → Regal → Regalreihe → Gang → Lager) im Inspector ---------

export type EditorLevel = 'platz' | 'regal' | 'reihe' | 'gang' | 'lager';

export type EditorLevelIds = { gangId: string; reiheId: string; regalId: string };

/** Alle Zellen (inkl. ohne echten Sage-Platz) der Regale, die zur gewählten Ebene gehören. */
export function editorZellen(overlay: EditorLagerOverlay, level: EditorLevel, ids: EditorLevelIds): EditorZelleOverlay[] {
  const regale = overlay.regale.filter((r) => {
    const p = r.placement;
    if (level === 'lager') return true;
    if (level === 'gang') return p.gangId === ids.gangId;
    if (level === 'reihe') return p.reiheId === ids.reiheId;
    return p.regalId === ids.regalId; // 'regal' | 'platz'
  });
  return regale.flatMap((r) => r.zellen);
}

/** Nur die Zellen mit echtem Sage-Bestand einer Ebene (für Bestands-/Gewichtssummen). */
export function editorPlaetze(overlay: EditorLagerOverlay, level: EditorLevel, ids: EditorLevelIds): Lagerplatz[] {
  return editorZellen(overlay, level, ids)
    .map((z) => z.platz)
    .filter((p): p is Lagerplatz => p != null);
}

/** Bestandszeilen (Platz × Artikel) einer Ebene — dieselbe Form wie `ortRows`/`rackRows` der Live-Ansicht. */
export function editorLevelRows(overlay: EditorLagerOverlay, level: EditorLevel, ids: EditorLevelIds): OrtRow[] {
  return rowsFromPlaetze(editorPlaetze(overlay, level, ids));
}

/** Platzanzahl (alle Zellen) und belegte Plätze (mit Sage-Bestand) einer Ebene, für die Summenzeile. */
export function editorCounts(overlay: EditorLagerOverlay, level: EditorLevel, ids: EditorLevelIds): { plaetzeCount: number; belegt: number } {
  const zellen = editorZellen(overlay, level, ids);
  const belegt = zellen.filter((z) => z.platz && z.platz.bestaende.length > 0).length;
  return { plaetzeCount: zellen.length, belegt };
}

/** Gang-Nummer eines beliebigen Regals dieses Gangs, für das Breadcrumb-Label ("Gang 3"). */
export function editorGangNummer(overlay: EditorLagerOverlay, gangId: string): number | null {
  return overlay.regale.find((r) => r.placement.gangId === gangId)?.placement.gangNummer ?? null;
}

/** Seite (links/rechts) einer Regalreihe, für das Breadcrumb-Label. */
export function editorReiheSeite(overlay: EditorLagerOverlay, reiheId: string): 'links' | 'rechts' | null {
  return overlay.regale.find((r) => r.placement.reiheId === reiheId)?.placement.seite ?? null;
}

/** 1-basierter Platz eines Regals innerhalb seiner Reihe (Anordnungsreihenfolge), für das Breadcrumb-Label. */
export function editorRegalIndex(overlay: EditorLagerOverlay, reiheId: string, regalId: string): number | null {
  const inReihe = overlay.regale.filter((r) => r.placement.reiheId === reiheId);
  const idx = inReihe.findIndex((r) => r.placement.regalId === regalId);
  return idx === -1 ? null : idx + 1;
}
