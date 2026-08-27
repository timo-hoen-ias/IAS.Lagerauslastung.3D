import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { rackAabb, type PlacedRack } from './transform';

const MARGIN = 4;

export default function Perimeter({ racks }: { racks: PlacedRack[] }) {
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
    return { minX: minX - MARGIN, maxX: maxX + MARGIN, minZ: minZ - MARGIN, maxZ: maxZ + MARGIN };
  }, [racks]);

  if (!bounds) return null;
  const { minX, maxX, minZ, maxZ } = bounds;

  const rect: [number, number, number][] = [
    [minX, 0.03, minZ],
    [maxX, 0.03, minZ],
    [maxX, 0.03, maxZ],
    [minX, 0.03, maxZ],
    [minX, 0.03, minZ],
  ];

  const corners: { p: [number, number, number]; v: [number, number, number]; h: [number, number, number] }[] = [
    { p: [minX, 0.03, minZ], v: [minX, 0.03, minZ + 0.5], h: [minX + 0.5, 0.03, minZ] },
    { p: [maxX, 0.03, minZ], v: [maxX, 0.03, minZ + 0.5], h: [maxX - 0.5, 0.03, minZ] },
    { p: [minX, 0.03, maxZ], v: [minX, 0.03, maxZ - 0.5], h: [minX + 0.5, 0.03, maxZ] },
    { p: [maxX, 0.03, maxZ], v: [maxX, 0.03, maxZ - 0.5], h: [maxX - 0.5, 0.03, maxZ] },
  ];

  return (
    <group>
      <Line points={rect} color="#ffffff" lineWidth={1.5} transparent opacity={0.35} />
      {corners.map((c, i) => (
        <group key={i}>
          <Line points={[c.v, c.p]} color="#7ec8ff" lineWidth={2} transparent opacity={0.6} />
          <Line points={[c.h, c.p]} color="#7ec8ff" lineWidth={2} transparent opacity={0.6} />
        </group>
      ))}
    </group>
  );
}
