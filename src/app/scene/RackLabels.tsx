import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type * as THREE from 'three';
import type { Lagerplatz } from '../../shared/types';
import { cellSegments } from './Cell';
import type { PlacedRack } from './transform';

export const LABEL_HIDE = 18;

/** Blendet Kinder per Kamera-Distanz aus (verhindert troika-Text-Draw-Calls in der Ferne). */
export function LodGroup({
  origin,
  hideDist,
  showDist,
  children,
}: {
  origin: [number, number, number];
  hideDist: number;
  showDist?: number;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const shown = useRef(true);
  const show = showDist ?? hideDist - 8;
  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    const d = Math.hypot(
      camera.position.x - origin[0],
      camera.position.y - origin[1],
      camera.position.z - origin[2],
    );
    let v = shown.current;
    if (v && d > hideDist) v = false;
    else if (!v && d < show) v = true;
    if (v !== shown.current) {
      shown.current = v;
      g.visible = v;
    }
  });
  return <group ref={ref}>{children}</group>;
}

/** Artikel-Labels aller Zellen eines Regals, nur in der Nähe sichtbar. */
export default function RackLabels({ placed, plaetze }: { placed: PlacedRack; plaetze: Lagerplatz[] }) {
  const { labels } = useMemo(() => cellSegments(plaetze, placed), [plaetze, placed]);
  return (
    <LodGroup origin={placed.position} hideDist={LABEL_HIDE}>
      {labels.map((l) => (
        <Text
          key={l.key}
          position={l.pos}
          rotation-y={l.side * (Math.PI / 2)}
          rotation-z={l.vertical ? -Math.PI / 2 : 0}
          fontSize={l.fontSize}
          lineHeight={0.85}
          color="#ffffff"
          outlineWidth={l.fontSize * 0.15}
          outlineColor="#0a0c10"
          anchorX="center"
          anchorY="middle"
        >
          {l.text}
        </Text>
      ))}
    </LodGroup>
  );
}
