import { useEffect, useMemo } from 'react';
import { mergeBoxes, wallBoxes, wallGlassBoxes } from './boxes';
import { rackBounds, type PlacedRack } from './transform';
import { WALL_COLOR, WALL_GLASS_COLOR } from '../colors';

export const WALL_MARGIN = 4;

export default function Walls({ racks, height }: { racks: PlacedRack[]; height: number }) {
  const bounds = useMemo(() => rackBounds(racks, WALL_MARGIN), [racks]);
  const geo = useMemo(() => (bounds ? mergeBoxes(wallBoxes(bounds, height)) : null), [bounds, height]);
  const glassGeo = useMemo(() => (bounds ? mergeBoxes(wallGlassBoxes(bounds, height)) : null), [bounds, height]);
  useEffect(() => () => geo?.dispose(), [geo]);
  useEffect(() => () => glassGeo?.dispose(), [glassGeo]);

  if (!geo) return null;
  return (
    <>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial color={WALL_COLOR} roughness={0.6} metalness={0.1} />
      </mesh>
      {glassGeo && (
        <mesh geometry={glassGeo}>
          <meshStandardMaterial color={WALL_GLASS_COLOR} roughness={0.15} metalness={0.1} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}
