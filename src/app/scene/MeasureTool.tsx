import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Text } from '@react-three/drei';
import { addMeasurePoint, useMeasurePoints } from '../store';
import { dist2d } from './transform';

export default function MeasureTool() {
  const points = useMeasurePoints();
  const p0 = points[0];
  const p1 = points[1];
  const dist = p0 && p1 ? dist2d(p0, p1) : null;

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} onClick={(e) => addMeasurePoint({ x: e.point.x, z: e.point.z })}>
        <planeGeometry args={[600, 600]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {p0 && (
        <mesh position={[p0.x, 0.12, p0.z]}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshBasicMaterial color="#7ec8ff" />
        </mesh>
      )}
      {p1 && (
        <mesh position={[p1.x, 0.12, p1.z]}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshBasicMaterial color="#7ec8ff" />
        </mesh>
      )}

      {p0 && p1 && dist !== null && (
        <>
          <LaserLine a={[p0.x, 0.08, p0.z]} b={[p1.x, 0.08, p1.z]} />
          <Text
            position={[(p0.x + p1.x) / 2, 0.9, (p0.z + p1.z) / 2]}
            fontSize={0.8}
            color="#ffffff"
            outlineWidth={0.06}
            outlineColor="#0a0c10"
            anchorX="center"
            anchorY="middle"
          >
            {dist.toFixed(1)} m
          </Text>
        </>
      )}
    </>
  );
}

function LaserLine({ a, b }: { a: [number, number, number]; b: [number, number, number] }) {
  const lineRef = useRef<any>(null);
  useFrame(({ clock }) => {
    const m = lineRef.current?.material;
    if (m) m.dashOffset = -clock.elapsedTime * 0.6;
  });
  return (
    <Line
      ref={lineRef}
      points={[a, b]}
      color="#7ec8ff"
      lineWidth={2}
      dashed
      dashSize={0.3}
      gapSize={0.2}
      transparent
      opacity={0.9}
    />
  );
}
