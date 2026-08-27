import { useMemo } from 'react';
import * as THREE from 'three';
import { rackAabb, type PlacedRack } from './transform';

const MARGIN = 4;
const OUTER = 300;

/** Dunkelt den Boden außerhalb der Hallenfläche (Rack-Bounds + Rand) ab. */
export default function FloorMask({ racks }: { racks: PlacedRack[] }) {
  const geometry = useMemo(() => {
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
    minX -= MARGIN;
    maxX += MARGIN;
    minZ -= MARGIN;
    maxZ += MARGIN;

    const shape = new THREE.Shape();
    shape.moveTo(-OUTER, -OUTER);
    shape.lineTo(OUTER, -OUTER);
    shape.lineTo(OUTER, OUTER);
    shape.lineTo(-OUTER, OUTER);
    shape.closePath();

    const hole = new THREE.Path();
    hole.moveTo(minX, minZ);
    hole.lineTo(minX, maxZ);
    hole.lineTo(maxX, maxZ);
    hole.lineTo(maxX, minZ);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2);
    return geo;
  }, [racks]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, 0.02, 0]} raycast={() => null}>
      <meshBasicMaterial color="#0a0c10" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
