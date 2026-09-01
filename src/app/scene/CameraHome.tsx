import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { frameRacksCamera, type PlacedRack } from './transform';

type OrbitLike = { target: { set: (x: number, y: number, z: number) => void }; update: () => void };

/**
 * Rahmt die Kamera einmalig auf die geladenen Regale ein (statt einer festen
 * Distanz), sobald ein Datensatz zum ersten Mal Regale liefert. Läuft erneut,
 * wenn nach einem DB-/Mandant-Wechsel die Regalliste erst wieder leer und dann
 * neu befüllt wird.
 */
export default function CameraHome({ racks }: { racks: PlacedRack[] }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const framed = useRef(false);

  useEffect(() => {
    if (racks.length === 0) {
      framed.current = false;
      return;
    }
    if (framed.current) return;
    framed.current = true;
    const view = frameRacksCamera(racks);
    if (!view) return;
    camera.position.set(...view.pos);
    camera.lookAt(...view.target);
    if (controls) {
      controls.target.set(...view.target);
      controls.update();
    }
  }, [racks, camera, controls]);

  return null;
}
