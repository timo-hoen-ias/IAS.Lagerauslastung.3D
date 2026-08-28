import { useEffect, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { getTransform, setDragActive, setTransform, useSelectedRack, useTransformMode } from '../store';
import type { PlacedRack } from './transform';

/**
 * TransformControls für das ausgewählte Regal (Bearbeiten-Modus).
 * Ein unsichtbares Gizmo-Group trägt die Manipulation; beim Drag-Start wird die
 * Basis (Orts-Origin) eingefroren, Änderungen werden relativ dazu in den Store
 * geschrieben. Das Rack selbst bleibt vollständig store-getrieben.
 */
export default function RackControls({ racks }: { racks: PlacedRack[] }) {
  const mode = useTransformMode();
  const selectedKey = useSelectedRack();
  const ref = useRef<THREE.Group>(null);
  const [target, setTarget] = useState<THREE.Group | null>(null);
  const rack = racks.find((r) => r.key === selectedKey);

  useEffect(() => {
    const g = ref.current;
    if (!g || !rack) return;
    g.position.set(rack.position[0], 0, rack.position[2]);
    g.rotation.set(0, rack.rotY, 0);
    g.scale.set(1, 1, 1);
    setTarget(g);
  }, [rack?.key]);

  if (!rack || !target) return null;

  const sync = () => {
    const g = ref.current;
    if (!g) return;
    const t = getTransform(rack.key);
    const baseX = rack.position[0] - t.x;
    const baseZ = rack.position[2] - t.z;
    setTransform(rack.key, {
      ...t,
      x: g.position.x - baseX,
      z: g.position.z - baseZ,
      rotY: g.rotation.y,
      scale: { x: g.scale.x, y: g.scale.y, z: g.scale.z },
    });
  };

  return (
    <group>
      <group ref={ref} />
      <TransformControls
        object={target}
        mode={mode}
        size={0.9}
        onMouseDown={() => setDragActive(true)}
        onMouseUp={() => setDragActive(false)}
        onChange={sync}
      />
    </group>
  );
}
