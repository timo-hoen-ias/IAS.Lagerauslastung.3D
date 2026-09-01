import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Lagerort, Lagerplatz } from '../../shared/types';
import { platzIdsMitArtikel } from '../article';
import { setSelection, useSelectedArticle, useSelectedPlatzId } from '../store';
import { cellSegments, HOVER_COLOR, type CellSeg } from './Cell';
import { cellLocalPosition, cellSize } from './layout';
import type { PlacedRack } from './transform';

/**
 * Rendert alle Zellen eines Regals als InstancedMesh (1 Draw-Call statt pro Box).
 * Hover/Selektion: Instanz-Farbe + ein einzelnes Drahtgitter um die aktive Zelle.
 *
 * Perf: Die Zellen werfen KEINE Schatten (kein castShadow auf den InstancedMeshes).
 * Bei vielen Regalen (Perf-Lager) würde jeder Bestandsplatz in den Schattenpass
 * gerastert → hunderte extra Draw-Calls + große Dreieckszahl. Der Regalrahmen
 * (Rack.tsx) wirft weiter Schatten für die Grundsilhouette.
 */
function CellLayer({
  placed,
  plaetze,
  interactive,
  rackKey,
  ort,
}: {
  placed: PlacedRack;
  plaetze: Lagerplatz[];
  interactive: boolean;
  rackKey: string;
  ort: Lagerort;
}) {
  const artikel = useSelectedArticle();
  const { segs } = useMemo(() => cellSegments(plaetze, placed), [plaetze, placed]);
  const filled = useMemo(() => segs.filter((s) => !s.empty), [segs]);
  const empty = useMemo(() => segs.filter((s) => s.empty), [segs]);
  const filledRef = useRef<THREE.InstancedMesh>(null);
  const emptyRef = useRef<THREE.InstancedMesh>(null);
  const [hoverPlatz, setHoverPlatz] = useState<number>(-1);

  // platzIds, auf denen der gesuchte Artikel liegt -> Kiste cyan hervorheben.
  const artikelPlatzIds = useMemo(() => platzIdsMitArtikel(plaetze, artikel), [plaetze, artikel]);
  const artikelSegIdx = useMemo(() => {
    if (artikelPlatzIds.size === 0) return [];
    const out: number[] = [];
    for (let i = 0; i < filled.length; i++) {
      if (artikelPlatzIds.has(filled[i]!.platzId)) out.push(i);
    }
    return out;
  }, [artikelPlatzIds, filled]);

  const selectedPlatzId = useSelectedPlatzId(rackKey);

  const matrices = useMemo(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    return segs.map((seg) =>
      m.clone().compose(p.set(seg.pos[0], seg.pos[1], seg.pos[2]), q, s.set(seg.size[0], seg.size[1], seg.size[2])),
    );
  }, [segs]);

  useLayoutEffect(() => {
    const set = (mesh: THREE.InstancedMesh | null, list: CellSeg[]) => {
      if (!mesh) return;
      for (let i = 0; i < list.length; i++) mesh.setMatrixAt(i, matrices[list[i]!.index]);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.platzIds = list.map((s) => s.platzId);
    };
    set(filledRef.current, filled);
    set(emptyRef.current, empty);
  }, [matrices, filled, empty]);

  useEffect(() => {
    const color = new THREE.Color();
    const set = (mesh: THREE.InstancedMesh | null, list: CellSeg[]) => {
      if (!mesh) return;
      for (let i = 0; i < list.length; i++) {
        const s = list[i]!;
        const hl = s.platzId === hoverPlatz || artikelPlatzIds.has(s.platzId);
        mesh.setColorAt(i, color.set(hl ? HOVER_COLOR : s.color));
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    set(filledRef.current, filled);
    set(emptyRef.current, empty);
  }, [hoverPlatz, artikelPlatzIds, filled, empty]);

  // Pulsierendes Leuchten der Artikel-Kisten (cyan -> weiß, nur die wenigen Treffer).
  const pulseC = useMemo(() => new THREE.Color(HOVER_COLOR), []);
  const whiteC = useMemo(() => new THREE.Color('#ffffff'), []);
  const tmpC = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const mesh = filledRef.current;
    if (!mesh || artikelSegIdx.length === 0) return;
    const k = 0.5 + 0.5 * Math.sin(clock.elapsedTime * Math.PI * 2);
    tmpC.copy(pulseC).lerp(whiteC, k * 0.6);
    for (const i of artikelSegIdx) mesh.setColorAt(i, tmpC);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  // Drahtgitter um die gehoverte oder gewählte Zelle (ein einziges lineSegments).
  const targetPlatzId = hoverPlatz !== -1 ? hoverPlatz : selectedPlatzId;
  const targetPlatz = useMemo(
    () => (targetPlatzId === -1 ? null : (plaetze.find((p) => p.platzId === targetPlatzId) ?? null)),
    [targetPlatzId, plaetze],
  );
  const targetPos = useMemo(
    () => (targetPlatz ? cellLocalPosition(targetPlatz, placed) : null),
    [targetPlatz, placed],
  );
  const edgeGeo = useMemo(() => {
    if (!targetPlatz) return null;
    const b = cellSize(targetPlatz);
    return new THREE.EdgesGeometry(new THREE.BoxGeometry(b.w + 0.12, b.h + 0.12, b.d + 0.12));
  }, [targetPlatz]);
  useEffect(() => () => edgeGeo?.dispose(), [edgeGeo]);

  const platzById = useMemo(() => new Map(plaetze.map((p) => [p.platzId, p])), [plaetze]);

  const segFor = (e: ThreeEvent<PointerEvent | MouseEvent>): CellSeg | undefined => {
    if (e.instanceId == null) return undefined;
    return e.object === filledRef.current ? filled[e.instanceId] : empty[e.instanceId];
  };

  const handlers = interactive
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          const s = segFor(e);
          if (s) setHoverPlatz(s.platzId);
        },
        onPointerOut: () => setHoverPlatz(-1),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          const s = segFor(e);
          const p = s && platzById.get(s.platzId);
          if (p) setSelection({ ort, platz: p, rack: placed });
        },
      }
    : {};

  return (
    <>
      {filled.length > 0 && (
        <instancedMesh ref={filledRef} args={[undefined, undefined, filled.length]} userData={{ rackKey }} {...handlers}>
          <boxGeometry />
          <meshStandardMaterial polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} roughness={0.6} metalness={0.1} />
        </instancedMesh>
      )}
      {empty.length > 0 && (
        <instancedMesh ref={emptyRef} args={[undefined, undefined, empty.length]} userData={{ rackKey }} {...handlers}>
          <boxGeometry />
          <meshStandardMaterial transparent opacity={0.3} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} roughness={0.6} metalness={0.1} />
        </instancedMesh>
      )}
      {targetPos && edgeGeo && (
        <group position={targetPos}>
          <lineSegments geometry={edgeGeo}>
            <lineBasicMaterial color="#ffffff" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
          </lineSegments>
        </group>
      )}
    </>
  );
}

export default memo(CellLayer);
