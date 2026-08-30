import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { bookingFlashes, FLASH_DURATION_MS, platzIndex, type FlashDef } from '../article';
import { getTransform, useBuchungen } from '../store';
import type { PlacedRack } from './transform';

/** Zeigt eingehende Live-Buchungen als kurz aufblitzenden Effekt an Herkunft (warm) und Ziel (grün). */
export default function BookingFlash({ racks }: { racks: PlacedRack[] }) {
  const buchungen = useBuchungen();

  const index = useMemo(() => platzIndex(racks), [racks]);

  const defs = useMemo(
    () => bookingFlashes(index, buchungen, (key) => getTransform(key)),
    [index, buchungen],
  );

  return (
    <>
      {defs.map((d) => (
        <Flash key={d.key} def={d} />
      ))}
    </>
  );
}

function Flash({ def }: { def: FlashDef }) {
  const [gone, setGone] = useState(false);
  const ring = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const labelGroup = useRef<THREE.Group>(null);
  const textRef = useRef<{ fillOpacity: number } | null>(null);

  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [def.color],
  );
  const shellMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [def.color],
  );
  const beamMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [def.color],
  );

  useEffect(
    () => () => {
      ringMat.dispose();
      shellMat.dispose();
      beamMat.dispose();
    },
    [ringMat, shellMat, beamMat],
  );

  const beamH = def.w.h * 1.2 + 0.6;
  const baseY = def.w.y + def.w.h + beamH + 0.4;

  useFrame(() => {
    if (gone) return;
    const p = Math.min((Date.now() - def.start) / FLASH_DURATION_MS, 1);
    if (p >= 1) {
      setGone(true);
      return;
    }
    const ramp = Math.min(1, p * 6);
    const fade = 1 - p;
    ringMat.opacity = 0.9 * fade * ramp;
    shellMat.opacity = 0.4 * fade * ramp;
    beamMat.opacity = 0.35 * fade * ramp;
    if (ring.current) ring.current.scale.setScalar(0.35 + p * 2.4);
    if (shell.current) shell.current.scale.set(1 + p * 0.5, 1 + p * 0.5, 1 + p * 0.5);
    if (textRef.current) textRef.current.fillOpacity = fade * ramp;
    if (labelGroup.current) labelGroup.current.position.y = baseY + p * 0.9;
  });

  if (gone) return null;

  return (
    <group position={[def.w.x, 0, def.w.z]}>
      <mesh ref={ring} position={[0, 0.04, 0]} rotation-x={-Math.PI / 2} raycast={() => {}}>
        <torusGeometry args={[0.5, 0.045, 8, 36]} />
        <primitive object={ringMat} attach="material" />
      </mesh>
      <mesh ref={shell} position={[0, def.w.y + def.w.h / 2, 0]} raycast={() => {}}>
        <boxGeometry args={[def.w.w + 0.1, def.w.h + 0.1, def.w.d + 0.1]} />
        <primitive object={shellMat} attach="material" />
      </mesh>
      <mesh position={[0, def.w.y + def.w.h + beamH / 2, 0]} raycast={() => {}}>
        <boxGeometry args={[0.07, beamH, 0.07]} />
        <primitive object={beamMat} attach="material" />
      </mesh>
      <group ref={labelGroup} position={[0, baseY, 0]}>
        <Text
          ref={textRef}
          position={[0, 0, 0]}
          fontSize={0.26}
          color={def.color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
          raycast={() => {}}
        >
          {def.label}
        </Text>
      </group>
    </group>
  );
}
