import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { regalDim3Bereiche, type EditorGang, type Punkt } from '../../shared/editor';
import { layoutEditorGaenge, polygonCenter, wallSegments, type EditorRegalPlacement } from '../scene/editorLayout';
import { RACK_GREY, VOID, ACCENT } from '../colors';

export type PreviewMode = 'regal' | 'reihe';

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
/** Rundet einen Versatz-Wert (m) auf 5cm — feines Ziehen bleibt möglich, ohne krumme Werte zu speichern. */
function snap5cm(v: number): number {
  return Math.round(v * 20) / 20;
}

const WALL_DICKE = 0.2;
/** Etwas heller als das Haupt-`FLOOR` (`../colors`) — im kleinen Vorschau-Canvas sonst kaum vom Void-Hintergrund zu unterscheiden. */
const PREVIEW_FLOOR = '#2a313b';

function Grundflaeche({ points }: { points: Punkt[] }) {
  const geo = useMemo(() => {
    if (points.length < 3) return null;
    const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.z)));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [points]);
  useEffect(() => () => geo?.dispose(), [geo]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color={PREVIEW_FLOOR} roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

function Waende({ points, hoehe }: { points: Punkt[]; hoehe: number }) {
  const segs = useMemo(() => wallSegments(points, hoehe), [points, hoehe]);
  return (
    <>
      {segs.map((s, i) => (
        <mesh key={i} position={s.position} rotation-y={s.rotationY} receiveShadow castShadow>
          <boxGeometry args={[s.length, hoehe, WALL_DICKE]} />
          <meshStandardMaterial color="#333840" roughness={0.6} metalness={0.1} />
        </mesh>
      ))}
    </>
  );
}

/**
 * Ebenen als einzelne, sichtbar getrennte Quader statt eines Quaders mit dünnen Trennlinien
 * im Inneren — letztere verschwinden komplett innerhalb des opaken Außenquaders und sind
 * nie sichtbar.
 */
function RegalMesh({
  size,
  ebenen,
  ebenenHoehen,
  color,
}: {
  size: { w: number; h: number; d: number };
  ebenen: number;
  ebenenHoehen: number[];
  color: string;
}) {
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(size.w, size.h, size.d)), [size.w, size.h, size.d]);
  useEffect(() => () => edgeGeo.dispose(), [edgeGeo]);
  const levels = useMemo(() => {
    let y = 0;
    return Array.from({ length: Math.max(1, ebenen) }, (_, i) => {
      const h = ebenenHoehen[i] ?? size.h / Math.max(1, ebenen);
      const cy = y + h / 2;
      y += h;
      return { cy, h };
    });
  }, [ebenen, ebenenHoehen, size.h]);
  return (
    <>
      {levels.map((lvl, i) => (
        <mesh key={i} position={[0, lvl.cy, 0]} castShadow receiveShadow>
          <boxGeometry args={[size.w * 0.98, lvl.h * 0.8, size.d * 0.98]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      ))}
      <lineSegments geometry={edgeGeo} position={[0, size.h / 2, 0]}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.45} />
      </lineSegments>
    </>
  );
}

/** Nummern-Label über einem Regal (z. B. „1L·2" = Gang 1, links, 2. Regal) — zur Unterscheidung beim Ziehen in der 3D-Vorschau. */
function RegalLabel({ size, label }: { size: { h: number }; label: string }) {
  return (
    <Text position={[0, size.h + 0.25, 0]} fontSize={0.26} color={ACCENT} anchorX="center" anchorY="bottom">
      {label}
    </Text>
  );
}

function RegalBox({
  placement,
  label,
  bisherigerVersatz,
  onMove,
  setOrbitEnabled,
}: {
  placement: EditorRegalPlacement;
  label: string;
  /** Bereits gespeicherter Versatz dieses Regals (in `placement.position` schon enthalten) — nötig, um beim Loslassen den neuen Gesamt-Versatz relativ zur Auto-Position zu berechnen. */
  bisherigerVersatz: Punkt;
  onMove: (regalId: string, versatz: Punkt) => void;
  setOrbitEnabled: (enabled: boolean) => void;
}) {
  const { rotationY, spiegelX, spiegelZ } = placement;
  const { position, size, ebenen, ebenenHoehen } = placement;
  const basePosition = { x: position[0] - bisherigerVersatz.x, z: position[2] - bisherigerVersatz.z };
  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const dragOffset = useRef<{ x: number; z: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(GROUND_PLANE, hit)) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragOffset.current = { x: position[0] - hit.x, z: position[2] - hit.z };
    setOrbitEnabled(false);
    setDragging(true);
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragOffset.current || !groupRef.current) return;
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(GROUND_PLANE, hit)) return;
    groupRef.current.position.set(hit.x + dragOffset.current.x, 0, hit.z + dragOffset.current.z);
  };
  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragOffset.current || !groupRef.current) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    dragOffset.current = null;
    setOrbitEnabled(true);
    setDragging(false);
    onMove(placement.regalId, {
      x: snap5cm(groupRef.current.position.x - basePosition.x),
      z: snap5cm(groupRef.current.position.z - basePosition.z),
    });
  };

  return (
    <group
      ref={groupRef}
      position={[position[0], 0, position[2]]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerOver={() => (gl.domElement.style.cursor = 'grab')}
      onPointerOut={() => (gl.domElement.style.cursor = 'auto')}
    >
      <group rotation-y={rotationY} scale={[spiegelX ? -1 : 1, 1, spiegelZ ? -1 : 1]}>
        <RegalMesh size={size} ebenen={ebenen} ebenenHoehen={ebenenHoehen} color={dragging ? ACCENT : RACK_GREY} />
      </group>
      <RegalLabel size={size} label={label} />
    </group>
  );
}

/**
 * Bewegt alle Regale einer Reihe gemeinsam als starre Gruppe — Gegenstück zu `RegalBox` im
 * Modus „Reihe verschieben": einzelne Regale sind dabei nicht separat ziehbar, nur die ganze
 * Reihe, damit die Anordnung untereinander nicht durcheinanderkommt.
 */
function ReiheGroup({
  reiheId,
  placements,
  labelById,
  bisherigerVersatz,
  onMove,
  setOrbitEnabled,
}: {
  reiheId: string;
  placements: EditorRegalPlacement[];
  labelById: Map<string, string>;
  /** Bereits gespeicherter Versatz dieser Reihe (in `placement.position` der Regale schon enthalten). */
  bisherigerVersatz: Punkt;
  onMove: (reiheId: string, versatz: Punkt) => void;
  setOrbitEnabled: (enabled: boolean) => void;
}) {
  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const dragOffset = useRef<{ x: number; z: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(GROUND_PLANE, hit)) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragOffset.current = { x: bisherigerVersatz.x - hit.x, z: bisherigerVersatz.z - hit.z };
    setOrbitEnabled(false);
    setDragging(true);
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragOffset.current || !groupRef.current) return;
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(GROUND_PLANE, hit)) return;
    groupRef.current.position.set(hit.x + dragOffset.current.x, 0, hit.z + dragOffset.current.z);
  };
  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragOffset.current || !groupRef.current) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    dragOffset.current = null;
    setOrbitEnabled(true);
    setDragging(false);
    onMove(reiheId, { x: snap5cm(groupRef.current.position.x), z: snap5cm(groupRef.current.position.z) });
  };

  return (
    <group
      ref={groupRef}
      position={[bisherigerVersatz.x, 0, bisherigerVersatz.z]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerOver={() => (gl.domElement.style.cursor = 'grab')}
      onPointerOut={() => (gl.domElement.style.cursor = 'auto')}
    >
      {placements.map((p) => (
        <group key={p.regalId} position={[p.position[0] - bisherigerVersatz.x, 0, p.position[2] - bisherigerVersatz.z]}>
          <group rotation-y={p.rotationY} scale={[p.spiegelX ? -1 : 1, 1, p.spiegelZ ? -1 : 1]}>
            <RegalMesh size={p.size} ebenen={p.ebenen} ebenenHoehen={p.ebenenHoehen} color={dragging ? ACCENT : RACK_GREY} />
          </group>
          <RegalLabel size={p.size} label={labelById.get(p.regalId) ?? ''} />
        </group>
      ))}
    </group>
  );
}

/** Eigenständige, live aktualisierende 3D-Vorschau des im Wizard bearbeiteten Lagers. */
export default function EditorPreview3D({
  grundriss,
  gaenge,
  mode,
  onRegalMove,
  onReiheMove,
}: {
  grundriss: Punkt[];
  gaenge: EditorGang[];
  /** „regal": jedes Regal einzeln ziehbar (wie bisher). „reihe": ganze Regalreihen als starre Gruppe ziehbar. */
  mode: PreviewMode;
  onRegalMove: (regalId: string, versatz: Punkt) => void;
  onReiheMove: (reiheId: string, versatz: Punkt) => void;
}) {
  const placements = useMemo(() => layoutEditorGaenge(gaenge, grundriss), [gaenge, grundriss]);
  const versatzById = useMemo(() => {
    const m = new Map<string, Punkt>();
    for (const gang of gaenge) for (const reihe of gang.reihen) for (const regal of reihe.regale) m.set(regal.id, regal.versatz ?? { x: 0, z: 0 });
    return m;
  }, [gaenge]);
  const reiheVersatzById = useMemo(() => {
    const m = new Map<string, Punkt>();
    for (const gang of gaenge) for (const reihe of gang.reihen) m.set(reihe.id, reihe.versatz ?? { x: 0, z: 0 });
    return m;
  }, [gaenge]);
  /**
   * „1L·2 (Dim3 5–8)" = Gang 1, Reihe links, 2. Regal, Sage-Spaltenbereich 5–8 — zur
   * Unterscheidung in der 3D-Vorschau (analog zur Nummerierung in der Regal-Liste) und um beim
   * Einrichten zu erkennen, welches Ende welchem Sage-Lagerplatz (Gang;Ebene;Dim3) entspricht.
   */
  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const gang of gaenge) {
      const dim3ById = new Map(regalDim3Bereiche(gang).map((b) => [b.regalId, b]));
      for (const reihe of gang.reihen) {
        reihe.regale.forEach((regal, i) => {
          const bereich = dim3ById.get(regal.id);
          const dim3 = bereich ? (bereich.von === bereich.bis ? ` (Dim3 ${bereich.von})` : ` (Dim3 ${bereich.von}–${bereich.bis})`) : '';
          m.set(regal.id, `${gang.nummer}${reihe.seite === 'links' ? 'L' : 'R'}·${i + 1}${dim3}`);
        });
      }
    }
    return m;
  }, [gaenge]);
  const placementsByReihe = useMemo(() => {
    const m = new Map<string, EditorRegalPlacement[]>();
    for (const p of placements) {
      const list = m.get(p.reiheId);
      if (list) list.push(p);
      else m.set(p.reiheId, [p]);
    }
    return m;
  }, [placements]);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const setOrbitEnabled = (enabled: boolean) => {
    if (controlsRef.current) controlsRef.current.enabled = enabled;
  };
  const center = useMemo(() => polygonCenter(grundriss), [grundriss]);
  const wandHoehe = useMemo(() => {
    const maxRegalHoehe = placements.reduce((m, p) => Math.max(m, p.size.h), 0);
    return Math.min(8, Math.max(3, maxRegalHoehe + 1));
  }, [placements]);
  const kameraAbstand = useMemo(() => {
    if (grundriss.length === 0) return 20;
    const xs = grundriss.map((p) => p.x);
    const zs = grundriss.map((p) => p.z);
    return Math.max(10, Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) * 0.75;
  }, [grundriss]);

  return (
    <div className="h-72 w-full overflow-hidden rounded-md border border-line bg-void">
      <Canvas
        shadows
        camera={{ position: [center.x + kameraAbstand, kameraAbstand * 0.75, center.z + kameraAbstand], fov: 50, near: 0.1, far: 500 }}
      >
        <color attach="background" args={[VOID]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[center.x + 20, 30, center.z + 15]} intensity={1.1} color="#dfe8f2" castShadow />
        <hemisphereLight args={['#5a6572', '#0d0f13', 0.7]} />
        <Grundflaeche points={grundriss} />
        <Waende points={grundriss} hoehe={wandHoehe} />
        {mode === 'regal'
          ? placements.map((p) => (
              <RegalBox
                key={p.regalId}
                placement={p}
                label={labelById.get(p.regalId) ?? ''}
                bisherigerVersatz={versatzById.get(p.regalId) ?? { x: 0, z: 0 }}
                onMove={onRegalMove}
                setOrbitEnabled={setOrbitEnabled}
              />
            ))
          : [...placementsByReihe.entries()].map(([reiheId, reihenPlacements]) => (
              <ReiheGroup
                key={reiheId}
                reiheId={reiheId}
                placements={reihenPlacements}
                labelById={labelById}
                bisherigerVersatz={reiheVersatzById.get(reiheId) ?? { x: 0, z: 0 }}
                onMove={onReiheMove}
                setOrbitEnabled={setOrbitEnabled}
              />
            ))}
        <OrbitControls ref={controlsRef} target={[center.x, 1, center.z]} makeDefault />
      </Canvas>
    </div>
  );
}
