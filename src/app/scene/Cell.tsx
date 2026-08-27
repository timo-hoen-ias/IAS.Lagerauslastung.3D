import { useMemo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Lagerort, Lagerplatz } from '../../shared/types';
import { stockColor } from '../colors';
import { useSelection } from '../store';
import { CELL_D, CELL_H, CELL_W, cellLocalPosition } from './layout';

export default function Cell({
  platz,
  rack,
  interactive,
  rackKey,
  ort,
}: {
  platz: Lagerplatz;
  rack: { cols: number; levels: number; depth: number };
  interactive: boolean;
  rackKey: string;
  ort: Lagerort;
}) {
  const { setSelection, selection } = useSelection();
  const [hovered, setHovered] = useState(false);
  const total = useMemo(() => platz.bestaende.reduce((s, b) => s + b.bestand, 0), [platz]);
  const color = stockColor(total, platz.bestaende.length > 0);

  const isSelectedPlatz = selection?.ort.lagerkennung === rackKey && selection?.platz?.platzId === platz.platzId;
  const active = (hovered && interactive) || isSelectedPlatz;

  const edgeGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(CELL_W + 0.12, CELL_H + 0.12, CELL_D + 0.12)),
    [],
  );

  const handlers = interactive
    ? {
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setSelection({ ort, platz });
        },
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
        },
        onPointerOut: () => setHovered(false),
      }
    : {};

  return (
    <group position={cellLocalPosition(platz, rack)} {...handlers}>
      <mesh userData={{ rackKey, platzId: platz.platzId }}>
        <boxGeometry args={[CELL_W, CELL_H, CELL_D]} />
        <meshStandardMaterial
          color={hovered ? '#7ec8ff' : color}
          emissive={hovered ? '#1e4d6e' : '#000000'}
          emissiveIntensity={0.4}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>
      {active && (
        <lineSegments geometry={edgeGeo}>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineSegments>
      )}
    </group>
  );
}
