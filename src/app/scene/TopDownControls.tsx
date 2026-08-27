import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useDragActive } from '../store';
import type { PlacedRack } from './transform';

export default function TopDownControls({ racks }: { racks: PlacedRack[] }) {
  const camera = useThree((s) => s.camera);
  const dragActive = useDragActive();
  const initialized = useRef(false);

  const view = useMemo(() => {
    if (racks.length === 0) return { center: [0, 0, 0] as [number, number, number], height: 30 };
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const r of racks) {
      minX = Math.min(minX, r.position[0] - r.size.w / 2);
      maxX = Math.max(maxX, r.position[0] + r.size.w / 2);
      minZ = Math.min(minZ, r.position[2] - r.size.d / 2);
      maxZ = Math.max(maxZ, r.position[2] + r.size.d / 2);
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const extent = Math.max(maxX - minX, maxZ - minZ, 1);
    const height = Math.min(240, Math.max(20, extent / 1.2 + 10));
    return { center: [cx, 0, cz] as [number, number, number], height };
  }, [racks]);

  useEffect(() => {
    if (racks.length === 0 || initialized.current) return;
    initialized.current = true;
    camera.position.set(view.center[0], view.height, view.center[2]);
    camera.lookAt(view.center[0], 0, view.center[2]);
    // nur beim ersten Eintritt positionieren – nicht bei jedem Rack-Drag
  }, [racks, camera, view]);

  return (
    <OrbitControls
      makeDefault
      target={[view.center[0], 0, view.center[2]]}
      enableRotate={false}
      enabled={!dragActive}
      maxPolarAngle={Math.PI / 2 - 0.05}
      zoomSpeed={1.2}
      enableDamping
    />
  );
}
