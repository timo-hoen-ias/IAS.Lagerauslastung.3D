import { useEffect, useMemo } from 'react';
import { mergeBoxes, wallBoxes } from './boxes';
import { rackBounds, type PlacedRack } from './transform';

export const WALL_MARGIN = 4;
const WALL_COLOR = '#333840';

export default function Walls({ racks, height }: { racks: PlacedRack[]; height: number }) {
  const bounds = useMemo(() => rackBounds(racks, WALL_MARGIN), [racks]);
  const geo = useMemo(() => (bounds ? mergeBoxes(wallBoxes(bounds, height)) : null), [bounds, height]);
  useEffect(() => () => geo?.dispose(), [geo]);

  if (!geo) return null;
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color={WALL_COLOR} roughness={0.6} metalness={0.1} />
    </mesh>
  );
}
