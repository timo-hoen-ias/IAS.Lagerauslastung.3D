import type { Lagerort, Lagerplatz } from '../shared/types';
import type { EditorGang, EditorLager, Punkt } from '../shared/editor';
import { deriveEditorPlaetze } from '../shared/editor';
import { layoutEditorGaenge, type EditorRegalPlacement } from './scene/editorLayout';

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
