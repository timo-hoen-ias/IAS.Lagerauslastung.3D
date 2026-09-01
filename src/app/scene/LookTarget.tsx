import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Lagerort, Lagerplatz } from '../../shared/types';
import { clearSelections, setEditorSelection, setSelection, type EditorSelection } from '../store';
import type { EditorLagerOverlay } from '../editorOverlay';
import type { PlacedRack } from './transform';

/**
 * Reichweite der Ego-/Walk-Selektion in Metern. Regale jenseits dieser
 * Distanz werden nicht selektiert; man muss näher heranlaufen, damit die
 * Inhalte im Inspector-Panel live laden.
 */
export const LOOK_REACH = 30;

export type LookHit = { ort: Lagerort; platz: Lagerplatz | null; rack: PlacedRack };

/**
 * Pure Funktion: extrahiert aus der (nach Distanz aufsteigend sortierten)
 * Trefferliste den ersten Regal-Treffer innerhalb von maxDist. Überspringt
 * Nicht-Regal-Objekte (ohne userData.rackKey) und mappt instanceId →
 * userData.platzIds → Lagerplatz (ohne instanceId → platz null). Unbekannte
 * rackKeys werden ignoriert.
 */
export function pickLookHit(
  intersects: THREE.Intersection[],
  byKey: Map<string, PlacedRack>,
  maxDist: number,
): LookHit | null {
  for (const i of intersects) {
    if (i.distance > maxDist) return null;
    const ud = (i.object.userData ?? {}) as { rackKey?: string; platzIds?: number[] };
    if (!ud.rackKey) continue;
    const rack = byKey.get(ud.rackKey);
    if (!rack) continue;
    const platzId = i.instanceId != null ? ud.platzIds?.[i.instanceId] : undefined;
    const platz = platzId != null ? (rack.ort.plaetze.find((p) => p.platzId === platzId) ?? null) : null;
    return { ort: rack.ort, platz, rack };
  }
  return null;
}

/**
 * Wie `pickLookHit`, aber für Zellen eines Editor-Lager-Overlays (s.
 * `EditorLagerOverlayScene.tsx`): erkennt `userData.editorOverlayId`/
 * `editorRegalId`/`editorZelleKey` statt `rackKey`/`platzIds`. Läuft nach
 * `pickLookHit` über dieselbe Trefferliste (nur wenn kein Sage-Regal
 * getroffen wurde), da echte Läger und Editor-Overlays sich im Raum nicht
 * überschneiden (s. `stageEditorOverlays`).
 */
export function pickEditorLookHit(
  intersects: THREE.Intersection[],
  overlaysById: Map<string, EditorLagerOverlay>,
  maxDist: number,
): NonNullable<EditorSelection> | null {
  for (const i of intersects) {
    if (i.distance > maxDist) return null;
    const ud = (i.object.userData ?? {}) as { editorOverlayId?: string; editorRegalId?: string; editorZelleKey?: string };
    if (!ud.editorOverlayId || !ud.editorRegalId) continue;
    const overlay = overlaysById.get(ud.editorOverlayId);
    if (!overlay) continue;
    const regal = overlay.regale.find((r) => r.placement.regalId === ud.editorRegalId);
    if (!regal) continue;
    const zelle = ud.editorZelleKey ? (regal.zellen.find((z) => `${z.ebene}:${z.spalte}` === ud.editorZelleKey) ?? null) : null;
    return {
      overlay,
      level: 'platz',
      gangId: regal.placement.gangId,
      reiheId: regal.placement.reiheId,
      regalId: regal.placement.regalId,
      zelle,
    };
  }
  return null;
}

/**
 * Ego-Modus: erkennt per Zentral-Raycast (auf LOOK_REACH begrenzt), welches
 * Regal/Fach bzw. welche Editor-Lager-Zelle der Spieler anvisiert, und
 * schreibt es in die jeweilige Auswahl. Der Inspector zeigt die Info dann
 * als normal fixiertes UI-Panel (kein schwebendes 3D-Panel).
 */
export default function LookTarget({ racks, editorOverlays = [] }: { racks: PlacedRack[]; editorOverlays?: EditorLagerOverlay[] }) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const raycaster = useRef(new THREE.Raycaster());
  const ndc = useRef(new THREE.Vector2(0, -0.06));
  const lastKey = useRef('');

  const byKey = useMemo(() => new Map(racks.map((r) => [r.key, r])), [racks]);
  const overlaysById = useMemo(() => new Map(editorOverlays.map((o) => [o.id, o])), [editorOverlays]);

  useFrame(() => {
    raycaster.current.far = LOOK_REACH;
    raycaster.current.setFromCamera(ndc.current, camera);
    const intersects = raycaster.current.intersectObjects(scene.children, true);

    const sageHit = pickLookHit(intersects, byKey, LOOK_REACH);
    const editorHit = sageHit ? null : pickEditorLookHit(intersects, overlaysById, LOOK_REACH);

    const key = sageHit
      ? `sage|${sageHit.ort.lagerkennung}|${sageHit.platz?.platzId ?? ''}`
      : editorHit
        ? `editor|${editorHit.overlay.id}|${editorHit.regalId}|${editorHit.zelle?.ebene ?? ''}:${editorHit.zelle?.spalte ?? ''}`
        : '';
    if (key !== lastKey.current) {
      lastKey.current = key;
      if (sageHit) setSelection(sageHit);
      else if (editorHit) setEditorSelection(editorHit);
      else clearSelections();
    }
  });

  return null;
}
