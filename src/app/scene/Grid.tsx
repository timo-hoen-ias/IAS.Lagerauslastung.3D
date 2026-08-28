import { useMemo } from 'react';
import { Grid as R3Grid } from '@react-three/drei';
import { GRID_CELL } from '../colors';
import { rackAabb, type PlacedRack } from './transform';

const STEP = 5;
const MARGIN = 4;

export default function Grid({ racks }: { racks: PlacedRack[] }) {
  const bounds = useMemo(() => {
    if (racks.length === 0) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const r of racks) {
      const b = rackAabb(r);
      minX = Math.min(minX, b.minX);
      maxX = Math.max(maxX, b.maxX);
      minZ = Math.min(minZ, b.minZ);
      maxZ = Math.max(maxZ, b.maxZ);
    }
    return {
      w: maxX - minX + 2 * MARGIN,
      d: maxZ - minZ + 2 * MARGIN,
      cx: (minX + maxX) / 2,
      cz: (minZ + maxZ) / 2,
    };
  }, [racks]);

  if (!bounds) return null;

  return (
    <R3Grid
      args={[bounds.w, bounds.d]}
      cellSize={1}
      sectionSize={STEP}
      cellColor={GRID_CELL}
      sectionColor={GRID_CELL}
      fadeDistance={120}
      position={[bounds.cx, 0.01, bounds.cz]}
    />
  );
}
