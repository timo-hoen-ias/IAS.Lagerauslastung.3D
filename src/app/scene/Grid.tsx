import { useMemo } from 'react';
import { Grid as R3Grid, Text } from '@react-three/drei';
import { GRID_CELL, GRID_SECTION, LINE_WHITE } from '../colors';
import type { PlacedRack } from './transform';

const STEP = 5;

export default function Grid({ racks }: { racks: PlacedRack[] }) {
  const labels = useMemo(() => {
    if (racks.length === 0) return null;
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
    const xs: number[] = [];
    for (let x = Math.ceil(minX / STEP) * STEP; x <= maxX + 1e-6; x += STEP) xs.push(x);
    const zs: number[] = [];
    for (let z = Math.ceil(minZ / STEP) * STEP; z <= maxZ + 1e-6; z += STEP) zs.push(z);
    return { b: { minX, maxX, minZ, maxZ }, xs, zs };
  }, [racks]);

  return (
    <>
      <R3Grid
        cellSize={1}
        sectionSize={STEP}
        cellColor={GRID_CELL}
        sectionColor={GRID_SECTION}
        fadeDistance={220}
        infiniteGrid
        position={[0, 0.01, 0]}
      />
      {labels && (
        <>
          {labels.xs.map((x) => (
            <Text
              key={`x${x}`}
              position={[x, 0.06, labels.b.maxZ + 1.5]}
              rotation-x={-Math.PI / 2}
              fontSize={0.9}
              color={LINE_WHITE}
              outlineWidth={0.05}
              outlineColor="#0a0c10"
              anchorX="center"
              anchorY="middle"
            >
              {Math.round(x)}
            </Text>
          ))}
          {labels.zs.map((z) => (
            <Text
              key={`z${z}`}
              position={[labels.b.minX - 1.5, 0.06, z]}
              rotation-x={-Math.PI / 2}
              fontSize={0.9}
              color={LINE_WHITE}
              outlineWidth={0.05}
              outlineColor="#0a0c10"
              anchorX="center"
              anchorY="middle"
            >
              {Math.round(z)}
            </Text>
          ))}
        </>
      )}
    </>
  );
}
