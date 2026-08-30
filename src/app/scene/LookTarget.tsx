import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Lagerort, Lagerplatz } from '../../shared/types';
import { useSelection } from '../store';
import type { PlacedRack } from './transform';

/**
 * Reichweite der Ego-/Walk-Selektion in Metern. Regale jenseits dieser
 * Distanz werden nicht selektiert; man muss näher heranlaufen, damit die
 * Inhalte im Inspector-Panel live laden.
 */
export const LOOK_REACH = 30;

export type LookHit = { ort: Lagerort; platz: Lagerplatz | null };

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
    return { ort: rack.ort, platz };
  }
  return null;
}

/**
 * Ego-Modus: erkennt per Zentral-Raycast (auf LOOK_REACH begrenzt), welches
 * Regal/Fach der Spieler anvisiert, und schreibt es in die Auswahl. Der
 * Inspector zeigt die Info dann als normal fixiertes UI-Panel (kein
 * schwebendes 3D-Panel).
 */
export default function LookTarget({ racks }: { racks: PlacedRack[] }) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const raycaster = useRef(new THREE.Raycaster());
  const ndc = useRef(new THREE.Vector2(0, -0.06));
  const { setSelection } = useSelection();
  const lastKey = useRef('');

  const byKey = useMemo(() => new Map(racks.map((r) => [r.key, r])), [racks]);

  useFrame(() => {
    raycaster.current.far = LOOK_REACH;
    raycaster.current.setFromCamera(ndc.current, camera);
    const intersects = raycaster.current.intersectObjects(scene.children, true);

    const found = pickLookHit(intersects, byKey, LOOK_REACH);

    const key = found ? `${found.ort.lagerkennung}|${found.platz?.platzId ?? ''}` : '';
    if (key !== lastKey.current) {
      lastKey.current = key;
      setSelection(found);
    }
  });

  return null;
}
