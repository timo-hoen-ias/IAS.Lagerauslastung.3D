import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { plätzeMitArtikel, platzWorld, type CellWorld } from '../article';
import { getTransform, useSelectedArticle } from '../store';
import type { PlacedRack } from './transform';

export default function ArticleMarkers({ racks }: { racks: PlacedRack[] }) {
  const artikel = useSelectedArticle();

  const markers = useMemo(() => {
    if (!artikel) return [];
    const out: { key: string; w: CellWorld }[] = [];
    for (const r of racks) {
      const t = getTransform(r.key);
      for (const { platz } of plätzeMitArtikel(r, artikel)) {
        out.push({ key: `${r.key}-${platz.platzId}`, w: platzWorld(r, t, platz) });
      }
    }
    return out;
  }, [artikel, racks]);

  if (!artikel || markers.length === 0) return null;
  return (
    <>
      {markers.map((m) => (
        <PlatzMarker key={m.key} m={m.w} />
      ))}
    </>
  );
}

function Edge({
  pos,
  len,
  axis,
  core,
  halo,
}: {
  pos: [number, number, number];
  len: number;
  axis: 'x' | 'z';
  core: THREE.MeshBasicMaterial;
  halo: THREE.MeshBasicMaterial;
}) {
  const coreS: [number, number, number] = axis === 'x' ? [len, 0.02, 0.05] : [0.05, 0.02, len];
  const haloS: [number, number, number] = axis === 'x' ? [len, 0.02, 0.16] : [0.16, 0.02, len];
  return (
    <>
      <mesh material={halo} position={pos} raycast={() => {}}>
        <boxGeometry args={haloS} />
      </mesh>
      <mesh material={core} position={pos} raycast={() => {}}>
        <boxGeometry args={coreS} />
      </mesh>
    </>
  );
}

function PlatzMarker({ m }: { m: CellWorld }) {
  const mats = useMemo(
    () => ({
      core: new THREE.MeshBasicMaterial({ color: '#7ec8ff', transparent: true, opacity: 0.8, depthWrite: false }),
      halo: new THREE.MeshBasicMaterial({
        color: '#7ec8ff',
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      beam: new THREE.MeshBasicMaterial({
        color: '#7ec8ff',
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    }),
    [],
  );
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const p = 0.5 + 0.5 * Math.sin(clock.elapsedTime * Math.PI);
    mats.core.opacity = 0.7 + 0.25 * p;
    mats.halo.opacity = 0.2 + 0.15 * p;
    mats.beam.opacity = 0.3 + 0.22 * p;
    if (ring.current) ring.current.scale.setScalar(1 + 0.15 * p);
  });

  const halfW = m.w / 2 + 0.12;
  const halfD = m.d / 2 + 0.12;
  const baseY = m.y + m.h / 2;
  const beamH = 2.8;

  return (
    <group position={[m.x, 0, m.z]}>
      <group position={[0, 0.05, 0]}>
        <Edge pos={[0, 0, -halfD]} len={m.w + 0.24} axis="x" core={mats.core} halo={mats.halo} />
        <Edge pos={[0, 0, halfD]} len={m.w + 0.24} axis="x" core={mats.core} halo={mats.halo} />
        <Edge pos={[-halfW, 0, 0]} len={m.d + 0.24} axis="z" core={mats.core} halo={mats.halo} />
        <Edge pos={[halfW, 0, 0]} len={m.d + 0.24} axis="z" core={mats.core} halo={mats.halo} />
      </group>
      <mesh position={[0, baseY + beamH / 2, 0]} raycast={() => {}}>
        <boxGeometry args={[0.06, beamH, 0.06]} />
        <meshBasicMaterial {...mats.beam} />
      </mesh>
      <mesh ref={ring} position={[0, baseY + beamH + 0.12, 0]} rotation-x={-Math.PI / 2} raycast={() => {}}>
        <torusGeometry args={[0.4, 0.03, 8, 24]} />
        <meshBasicMaterial color="#7ec8ff" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}
