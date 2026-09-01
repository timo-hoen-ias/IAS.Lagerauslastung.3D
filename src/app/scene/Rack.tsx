import { memo, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { RACK_GREY } from '../colors';
import { setSelection, setSelectedRack, useDragActive, useIsRackOrtSelected, useSelectedRack } from '../store';
import { gangPlätze } from './layout';
import { platzÜberlastet } from '../gew';
import type { PlacedRack, RackTransform } from './transform';
import CellLayer from './CellLayer';
import RackLabels, { LodGroup } from './RackLabels';
import { floorFrameBoxes, mergeBoxes, rackParts } from './boxes';

/** Distanz, ab der ein entferntes Regal (Rahmen + Zellen) im Ego-Modus ausgeblendet wird. */
const RACK_HIDE = 55;
/** Distanz, bei der das Regal wieder erscheint (Hysterese gegen Flackern). */
const RACK_SHOW = 45;

function Rack({
  placed,
  transform,
  edit,
  interactive,
  cull = false,
}: {
  placed: PlacedRack;
  transform: RackTransform;
  edit: boolean;
  interactive: boolean;
  cull?: boolean;
}) {
  const selected = useSelectedRack() === placed.key;
  const [hovered, setHovered] = useState(false);

  const color = RACK_GREY;
  const dragActive = useDragActive();
  const selectedOrt = useIsRackOrtSelected(placed.ort.lagerkennung);
  const rackActive = hovered || selectedOrt;
  const dragging = edit && dragActive && selected;
  const rackEdgeGeo = useMemo(
    () =>
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(placed.size.w + 0.2, placed.size.h + 0.2, placed.size.d + 0.2),
      ),
    [placed.size.w, placed.size.h, placed.size.d],
  );

  const uW = placed.size.w / transform.scale.x;
  const uH = placed.size.h / transform.scale.y;
  const uD = placed.size.d / transform.scale.z;

  const plaetze = useMemo(() => gangPlätze(placed.ort, placed.kind, placed.gang), [placed.ort, placed.kind, placed.gang]);
  const überlastet = useMemo(() => plaetze.some((p) => platzÜberlastet(p)), [plaetze]);

  const parts = useMemo(() => rackParts({ w: uW, h: uH, d: uD }, placed.levels, placed.cellH), [uW, uH, uD, placed.levels, placed.cellH]);
  const darkGeo = useMemo(() => mergeBoxes(parts.dark), [parts]);
  const greyGeo = useMemo(() => mergeBoxes(parts.grey), [parts]);
  const topGeo = useMemo(() => mergeBoxes(parts.top), [parts]);
  useEffect(
    () => () => {
      darkGeo?.dispose();
      greyGeo?.dispose();
      topGeo?.dispose();
    },
    [darkGeo, greyGeo, topGeo],
  );

  const groupHandlers = edit
    ? {
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setSelectedRack(placed.key);
        },
      }
    : interactive
      ? {
          onClick: (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            setSelection({ ort: placed.ort, platz: null, rack: placed });
          },
          onPointerOver: (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setHovered(true);
          },
          onPointerOut: () => setHovered(false),
        }
      : {};

  return (
    <group position={placed.position} rotation-y={placed.rotY} userData={{ rackKey: placed.key }} {...groupHandlers}>
      <LodGroup origin={placed.position} hideDist={RACK_HIDE} showDist={RACK_SHOW} active={cull}>
        <group scale={[transform.scale.x, transform.scale.y, transform.scale.z]}>
          {!placed.flat && (
            <>
              <mesh geometry={darkGeo!} castShadow receiveShadow userData={{ rackKey: placed.key }}>
                <meshStandardMaterial color="#262c36" roughness={0.9} />
              </mesh>
              <mesh geometry={greyGeo!} castShadow receiveShadow userData={{ rackKey: placed.key }}>
                <meshStandardMaterial color={color} roughness={0.5} />
              </mesh>
              <mesh geometry={topGeo!} castShadow userData={{ rackKey: placed.key }}>
                <meshStandardMaterial color={color} roughness={0.5} transparent opacity={0.45} depthWrite={false} />
              </mesh>
            </>
          )}

          <CellLayer placed={placed} plaetze={plaetze} interactive={interactive} rackKey={placed.key} ort={placed.ort} />
          <RackLabels placed={placed} plaetze={plaetze} />
        </group>
      </LodGroup>

      {rackActive && (
        <lineSegments geometry={rackEdgeGeo} position={[0, placed.size.h / 2, 0]}>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineSegments>
      )}

      <LodGroup origin={placed.position} hideDist={70} showDist={55}>
        <Billboard position={[0, placed.size.h + 0.9, 0]}>
          <Text
            fontSize={0.55}
            color="#ffffff"
            outlineWidth={0.06}
            outlineColor="#0a0c10"
            anchorX="center"
            anchorY="middle"
            textAlign="center"
            lineHeight={1.35}
          >
            {placed.ort.lagerkennung}
          </Text>
        </Billboard>

        <group position={[0, 0, placed.size.d / 2 + 1.2]}>
          <Text
            position={[0,0.08,0]}
            rotation-x={-Math.PI / 2}
            fontSize={0.35}
            color="#ffffff"
            outlineWidth={0.03}
            outlineColor="#0a0c10"
            anchorX="center"
            anchorY="middle"
          >
            {fmtDim(placed.size.w)} × {fmtDim(placed.size.d)} × {fmtDim(placed.size.h)} m
          </Text>
        </group>

        {überlastet && (
          <group position={[0, placed.size.h + 2.2, 0]}>
            <Billboard>
              <mesh>
                <cylinderGeometry args={[0.28,0.28,0.24,3]} />
                <meshBasicMaterial color="#e74c3c" />
              </mesh>
              <Text position={[0,0.01,0.01]} fontSize={0.22} color="#ffffff" anchorX="center" anchorY="middle" fontWeight="bold">
                !
              </Text>
            </Billboard>
          </group>
        )}
      </LodGroup>

      <FloorFrame w={placed.size.w} d={placed.size.d} boost={dragging} warn={überlastet} />

      {dragging && (
        <mesh position={[0,0.035,0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[placed.size.w + 0.6, placed.size.d + 0.6]} />
          <meshBasicMaterial color="#11151c" transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  );
}

export default memo(Rack);

function fmtDim(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}

function FloorFrame({ w, d, boost = false, warn = false }: { w: number; d: number; boost?: boolean; warn?: boolean }) {
  const core = useMemo(
    () => new THREE.MeshBasicMaterial({ color: warn ? '#e74c3c' : '#ffffff', transparent: true, opacity: 0.9 }),
    [warn],
  );
  const halo = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: warn ? '#e74c3c' : '#ffffff',
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [warn],
  );
  const coreGeo = useMemo(() => mergeBoxes(floorFrameBoxes(w, d).core), [w, d]);
  const haloGeo = useMemo(() => mergeBoxes(floorFrameBoxes(w, d).halo), [w, d]);
  useEffect(
    () => () => {
      coreGeo?.dispose();
      haloGeo?.dispose();
    },
    [coreGeo, haloGeo],
  );
  useFrame(({ clock }) => {
    if (!boost && !warn) return;
    const p = 0.5 + 0.5 * Math.sin(clock.elapsedTime * Math.PI);
    if (boost) {
      core.opacity = 0.9 + 0.1 * p;
      halo.opacity = 0.26 + 0.12 * p;
    } else if (warn) {
      core.opacity = 0.9 + 0.1 * p;
      halo.opacity = 0.3 + 0.15 * p;
    }
  });

  return (
    <group position={[0, 0.04, 0]}>
      {coreGeo && <mesh geometry={coreGeo} material={core} raycast={() => {}} />}
      {haloGeo && <mesh geometry={haloGeo} material={halo} raycast={() => {}} />}
    </group>
  );
}
