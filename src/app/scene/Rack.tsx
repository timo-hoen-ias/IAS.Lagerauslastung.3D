import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { RACK_GREY } from '../colors';
import { setDragActive, setSelectedRack, setTransform, useDragActive, useSelectedRack, useSelection } from '../store';
import { POST, rackFrame } from './layout';
import {
  resizeFactor,
  resizeHeight,
  resizeRack,
  snap45,
  snappedMove,
  type PlacedRack,
  type RackTransform,
} from './transform';
import { useGroundPoint, useVerticalPlanePoint } from './ground';
import Cell from './Cell';

const HANDLE_OFF = 0.35;

type DragState =
  | {
      mode: 'move';
      startX: number;
      startY: number;
      moved: boolean;
      last: RackTransform;
      grab: { dx: number; dz: number };
      baseX: number;
      baseZ: number;
    }
  | { mode: 'rotate'; startX: number; startY: number; moved: boolean; last: RackTransform; cx: number; cz: number }
  | {
      mode: 'resize';
      axis: 'x' | 'y' | 'z';
      startX: number;
      startY: number;
      moved: boolean;
      last: RackTransform;
      baseHalf: number;
      baseH: number;
      cx: number;
      cz: number;
      cos: number;
      sin: number;
    };

export default function Rack({
  placed,
  transform,
  edit,
  interactive,
}: {
  placed: PlacedRack;
  transform: RackTransform;
  edit: boolean;
  interactive: boolean;
}) {
  const { setSelection, selection } = useSelection();
  const selected = useSelectedRack() === placed.key;
  const groundPoint = useGroundPoint();
  const vertPoint = useVerticalPlanePoint();
  const dragRef = useRef<DragState | null>(null);
  const [hovered, setHovered] = useState(false);

  const color = RACK_GREY;
  const dragActive = useDragActive();
  const selectedOrt = selection?.ort.lagerkennung === placed.key && !selection?.platz;
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

  const frame = useMemo(() => rackFrame({ w: uW, h: uH, d: uD }), [uW, uH, uD]);

  useEffect(() => {
    if (!edit) return;
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) > 4) d.moved = true;
      if (!d.moved) return;
      if (d.mode === 'resize') {
        if (d.axis === 'y') {
          const vp = vertPoint(ev.clientX, ev.clientY, { x: d.cx, z: d.cz });
          if (!vp) return;
          setTransform(placed.key, resizeRack(d.last, 'y', resizeHeight(d.baseH, vp.y, HANDLE_OFF)));
        } else {
          const wp = groundPoint(ev.clientX, ev.clientY);
          if (!wp) return;
          const dx = wp.x - d.cx;
          const dz = wp.z - d.cz;
          const local = d.axis === 'x' ? dx * d.cos + dz * d.sin : -dx * d.sin + dz * d.cos;
          setTransform(placed.key, resizeRack(d.last, d.axis, resizeFactor(d.baseHalf, local, HANDLE_OFF)));
        }
        return;
      }
      const wp = groundPoint(ev.clientX, ev.clientY);
      if (!wp) return;
      if (d.mode === 'move') {
        setTransform(placed.key, snappedMove(d.last, d.baseX, d.baseZ, wp.x, wp.z, d.grab.dx, d.grab.dz));
      } else {
        const deg = (Math.atan2(wp.z - d.cz, wp.x - d.cx) * 180) / Math.PI;
        setTransform(placed.key, { ...d.last, rotY: (snap45(deg) * Math.PI) / 180 });
      }
    };
    const up = () => {
      dragRef.current = null;
      setDragActive(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [edit, groundPoint, vertPoint, placed.key]);

  const startMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setSelectedRack(placed.key);
    const wp = groundPoint(e.nativeEvent.clientX, e.nativeEvent.clientY);
    if (!wp) return;
    setDragActive(true);
    dragRef.current = {
      mode: 'move',
      startX: e.nativeEvent.clientX,
      startY: e.nativeEvent.clientY,
      moved: false,
      last: transform,
      baseX: placed.position[0] - transform.x,
      baseZ: placed.position[2] - transform.z,
      grab: { dx: wp.x - placed.position[0], dz: wp.z - placed.position[2] },
    };
  };

  const startRotate = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setDragActive(true);
    dragRef.current = {
      mode: 'rotate',
      startX: e.nativeEvent.clientX,
      startY: e.nativeEvent.clientY,
      moved: false,
      last: transform,
      cx: placed.position[0],
      cz: placed.position[2],
    };
  };

  const startResize = (e: ThreeEvent<PointerEvent>, axis: 'x' | 'y' | 'z') => {
    e.stopPropagation();
    setSelectedRack(placed.key);
    setDragActive(true);
    const s = transform.scale;
    dragRef.current = {
      mode: 'resize',
      axis,
      startX: e.nativeEvent.clientX,
      startY: e.nativeEvent.clientY,
      moved: false,
      last: transform,
      baseHalf: axis === 'x' ? placed.size.w / s.x / 2 : placed.size.d / s.z / 2,
      baseH: placed.size.h / s.y,
      cx: placed.position[0],
      cz: placed.position[2],
      cos: Math.cos(placed.rotY),
      sin: Math.sin(placed.rotY),
    };
  };

  const groupHandlers = edit
    ? { onPointerDown: startMove }
    : interactive
      ? {
          onClick: (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            setSelection({ ort: placed.ort, platz: null });
          },
          onPointerOver: (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setHovered(true);
          },
          onPointerOut: () => setHovered(false),
        }
      : {};

  const posts: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];

  return (
    <group position={placed.position} rotation-y={placed.rotY} userData={{ rackKey: placed.key }} {...groupHandlers}>
      <group scale={[transform.scale.x, transform.scale.y, transform.scale.z]}>
        <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[uW + 0.3, 0.08, uD + 0.3]} />
          <meshStandardMaterial color="#262c36" roughness={0.9} />
        </mesh>

        {posts.map(([sx, sz], i) => (
          <mesh key={i} position={[sx * (uW / 2 - POST / 2), frame.post.pos[1], sz * (uD / 2 - POST / 2)]} castShadow>
            <boxGeometry args={frame.post.size} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
        ))}

        <mesh position={[0, frame.top.pos[1], 0]}>
          <boxGeometry args={frame.top.size} />
          <meshStandardMaterial color={color} roughness={0.5} transparent opacity={0.45} depthWrite={false} />
        </mesh>

        {placed.ort.plaetze.map((platz) => (
          <Cell key={platz.platzId} platz={platz} rack={placed} interactive={interactive} rackKey={placed.key} ort={placed.ort} />
        ))}
      </group>

      {rackActive && (
        <lineSegments geometry={rackEdgeGeo} position={[0, placed.size.h / 2, 0]}>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineSegments>
      )}

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

      <FloorFrame w={placed.size.w} d={placed.size.d} boost={dragging} />

      {dragging && (
        <mesh position={[0,0.035,0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[placed.size.w + 0.6, placed.size.d + 0.6]} />
          <meshBasicMaterial color="#11151c" transparent opacity={0.55} />
        </mesh>
      )}

      <group position={[0, 0, placed.size.d / 2 + 1.2]}>
        <Text
          position={[0, 0.08, 0]}
          rotation-x={-Math.PI / 2}
          fontSize={0.5}
          color="#ffffff"
          outlineWidth={0.04}
          outlineColor="#0a0c10"
          anchorX="center"
          anchorY="middle"
        >
          {fmtDim(placed.size.w)} × {fmtDim(placed.size.d)} × {fmtDim(placed.size.h)} m
        </Text>
      </group>

      {edit && selected && (
        <>
          <mesh position={[0, placed.size.h + 1.7, 0]} onPointerDown={startRotate} rotation-x={-Math.PI / 2}>
            <torusGeometry args={[0.45,0.06,8,24]} />
            <meshStandardMaterial color="#e67e22" emissive="#e67e22" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[placed.size.w / 2 + HANDLE_OFF, placed.size.h / 2, 0]} onPointerDown={(e) => startResize(e, 'x')}>
            <boxGeometry args={[0.14, 0.14, 0.14]} />
            <meshStandardMaterial color="#e67e22" emissive="#e67e22" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, placed.size.h / 2, placed.size.d / 2 + HANDLE_OFF]} onPointerDown={(e) => startResize(e, 'z')}>
            <boxGeometry args={[0.14, 0.14, 0.14]} />
            <meshStandardMaterial color="#e67e22" emissive="#e67e22" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, placed.size.h + HANDLE_OFF, 0]} onPointerDown={(e) => startResize(e, 'y')}>
            <boxGeometry args={[0.14, 0.14, 0.14]} />
            <meshStandardMaterial color="#e67e22" emissive="#e67e22" emissiveIntensity={0.5} />
          </mesh>
        </>
      )}
    </group>
  );
}

function fmtDim(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}

const LINE = 0.06;
const LINE_H = 0.02;
const FRAME_GAP = 0.25;
const CORNER_OFF = 0.02;
const CORNER_LEN = 0.22;
const CORNER_LINE = 0.04;
const HALO_EXTRA = 0.12;

function LineGlow({
  material,
  halo,
  position,
  len,
  axis,
  thick = LINE,
}: {
  material: THREE.Material;
  halo: THREE.Material;
  position: [number, number, number];
  len: number;
  axis: 'x' | 'z';
  thick?: number;
}) {
  const core: [number, number, number] = axis === 'x' ? [len, LINE_H, thick] : [thick, LINE_H, len];
  const soft: [number, number, number] = axis === 'x' ? [len, LINE_H, thick + HALO_EXTRA] : [thick + HALO_EXTRA, LINE_H, len];
  return (
    <>
      <mesh material={halo} position={position}>
        <boxGeometry args={soft} />
      </mesh>
      <mesh material={material} position={position}>
        <boxGeometry args={core} />
      </mesh>
    </>
  );
}

function FloorFrame({ w, d, boost = false }: { w: number; d: number; boost?: boolean }) {
  const core = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }), []);
  const halo = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  useFrame(({ clock }) => {
    const p = 0.5 + 0.5 * Math.sin(clock.elapsedTime * Math.PI);
    if (boost) {
      core.opacity = 0.9 + 0.1 * p;
      halo.opacity = 0.26 + 0.12 * p;
    } else {
      core.opacity = 0.75 + 0.2 * p;
      halo.opacity = 0.14 + 0.16 * p;
    }
  });

  const fw = w + FRAME_GAP * 2;
  const fd = d + FRAME_GAP * 2;
  const halfW = fw / 2;
  const halfD = fd / 2;
  const corners: [number, number][] = [
    [-1,-1],
    [1,-1],
    [-1,1],
    [1,1],
  ];

  return (
    <group position={[0,0.04,0]}>
      <LineGlow material={core} halo={halo} position={[0, 0, -halfD]} len={fw} axis="x" />
      <LineGlow material={core} halo={halo} position={[0, 0, halfD]} len={fw} axis="x" />
      <LineGlow material={core} halo={halo} position={[-halfW, 0, 0]} len={fd} axis="z" />
      <LineGlow material={core} halo={halo} position={[halfW, 0, 0]} len={fd} axis="z" />

      {corners.map(([sx, sz], i) => {
        const cx = sx * (halfW + CORNER_OFF);
        const cz = sz * (halfD + CORNER_OFF);
        return (
          <group key={i} position={[cx, 0, cz]}>
            <LineGlow material={core} halo={halo} position={[-sx * CORNER_LEN / 2, 0, 0]} len={CORNER_LEN} axis="x" thick={CORNER_LINE} />
            <LineGlow material={core} halo={halo} position={[0, 0, -sz * CORNER_LEN / 2]} len={CORNER_LEN} axis="z" thick={CORNER_LINE} />
          </group>
        );
      })}
    </group>
  );
}
