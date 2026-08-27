import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Lagerort, Lagerplatz } from '../../shared/types';
import { useSelection } from '../store';
import type { PlacedRack } from './transform';

/**
 * Ego-Modus: erkennt per Zentral-Raycast, welches Regal/Fach der Spieler
 * anvisiert, und schreibt es in die Auswahl. Der Inspector zeigt die Info
 * dann als normal fixiertes UI-Panel (kein schwebendes 3D-Panel).
 */
export default function LookTarget({ racks }: { racks: PlacedRack[] }) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const raycaster = useRef(new THREE.Raycaster());
  const { setSelection } = useSelection();
  const lastKey = useRef('');

  useFrame(() => {
    const byKey = new Map(racks.map((r) => [r.key, r]));
    raycaster.current.setFromCamera(new THREE.Vector2(0, -0.06), camera);
    const intersects = raycaster.current.intersectObjects(scene.children, true);

    let found: { ort: Lagerort; platz: Lagerplatz | null } | null = null;
    for (const i of intersects) {
      const ud = i.object.userData as { rackKey?: string; platzId?: number };
      if (!ud.rackKey) continue;
      const rack = byKey.get(ud.rackKey);
      if (rack) {
        const platz = ud.platzId != null ? (rack.ort.plaetze.find((p) => p.platzId === ud.platzId) ?? null) : null;
        found = { ort: rack.ort, platz };
      }
      break;
    }

    const key = found ? `${found.ort.lagerkennung}|${found.platz?.platzId ?? ''}` : '';
    if (key !== lastKey.current) {
      lastKey.current = key;
      setSelection(found);
    }
  });

  return null;
}
