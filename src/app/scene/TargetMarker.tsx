import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSelection } from '../store';
import type { PlacedRack } from './transform';

export default function TargetMarker({ racks }: { racks: PlacedRack[] }) {
  const { selection } = useSelection();
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const p = 0.5 + 0.5 * Math.sin(clock.elapsedTime * Math.PI);
    if (beamMat.current) beamMat.current.opacity = 0.2 + 0.12 * p;
    if (ringRef.current) {
      const s = 1 + 0.12 * p;
      ringRef.current.scale.set(s, s, s);
    }
  });

  if (!selection) return null;
  const rack = racks.find((r) => r.key === selection.ort.lagerkennung);
  if (!rack) return null;

  return (
    <group position={[rack.position[0], 0, rack.position[2]]}>
      <mesh position={[0, rack.size.h + 1.4, 0]}>
        <boxGeometry args={[0.05, 2.8, 0.05]} />
        <meshBasicMaterial ref={beamMat} color="#ffffff" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} position={[0, rack.size.h + 3.1, 0]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[0.5, 0.035, 8, 32]} />
        <meshBasicMaterial color="#7ec8ff" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}
