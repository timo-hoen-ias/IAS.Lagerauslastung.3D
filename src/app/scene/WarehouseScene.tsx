import { useMemo } from 'react';
import { OrbitControls, GizmoHelper, GizmoViewcube } from '@react-three/drei';
import * as THREE from 'three';
import { getTransform, useDragActive } from '../store';
import { FLOOR, FOG, VOID } from '../colors';
import { rackAabb, type PlacedRack } from './transform';
import Rack from './Rack';
import RackControls from './RackControls';
import WalkControls from './WalkControls';
import TopDownControls from './TopDownControls';
import OrbitFly from './OrbitFly';
import Grid from './Grid';
import MeasureTool from './MeasureTool';
import LookTarget from './LookTarget';
import TargetMarker from './TargetMarker';
import ArticleMarkers from './ArticleMarkers';
import BookingFlash from './BookingFlash';
import CameraReporter from './CameraReporter';
import Perimeter from './Perimeter';
import FloorMask from './FloorMask';
import Walls from './Walls';
import CameraHome from './CameraHome';
import type { Mode } from '../App';
import type { PositionedEditorOverlay } from '../editorOverlay';
import EditorLagerOverlayScene from './EditorLagerOverlayScene';

export default function WarehouseScene({
  racks,
  mode,
  speed,
  edit,
  measure,
  lighting,
  walls,
  editorOverlays,
}: {
  racks: PlacedRack[];
  mode: Mode;
  speed: number;
  edit: boolean;
  measure: boolean;
  lighting: boolean;
  walls: boolean;
  editorOverlays: PositionedEditorOverlay[];
}) {
  const dragActive = useDragActive();
  const interactive = (mode === 'orbit' || mode === 'topdown') && !edit && !measure;

  const wallHeight = useMemo(() => {
    if (racks.length === 0) return 0;
    let maxTop = 0;
    for (const r of racks) maxTop = Math.max(maxTop, r.position[1] + r.size.h);
    return Math.min(12, Math.max(3, maxTop + 1));
  }, [racks]);

  const shadow = useMemo(() => {
    if (racks.length === 0) return null;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const r of racks) {
      const b = rackAabb(r);
      minX = Math.min(minX, b.minX);
      maxX = Math.max(maxX, b.maxX);
      minZ = Math.min(minZ, b.minZ);
      maxZ = Math.max(maxZ, b.maxZ);
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const half = Math.max((maxX - minX) / 2, (maxZ - minZ) / 2) + 5;
    return { cx, cz, half };
  }, [racks]);

  const lightTarget = useMemo(() => new THREE.Object3D(), []);

  return (
    <>
      <color attach="background" args={[VOID]} />
      <fog attach="fog" args={[FOG, 70, 220]} />

      <ambientLight intensity={0.65} />
      <directionalLight
        position={shadow ? [shadow.cx + 20, 40, shadow.cz + 15] : [20, 40, 15]}
        target={lightTarget}
        intensity={1.5}
        color="#dfe8f2"
        castShadow={lighting}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={shadow ? -shadow.half : -80}
        shadow-camera-right={shadow ? shadow.half : 80}
        shadow-camera-top={shadow ? shadow.half : 80}
        shadow-camera-bottom={shadow ? -shadow.half : -80}
        shadow-camera-near={0.5}
        shadow-camera-far={300}
      />
      <primitive object={lightTarget} position={shadow ? [shadow.cx, 0, shadow.cz] : [0, 0, 0]} />
      <directionalLight position={[-40, 30, -30]} intensity={0.45} color="#7fa0c8" />
      {lighting && <hemisphereLight args={['#3a4552', '#0d0f13', 0.7]} />}

      <mesh rotation-x={-Math.PI / 2} receiveShadow raycast={() => {}} position={[0, 0, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color={FLOOR} roughness={0.95} metalness={0.05} />
      </mesh>

      <Grid racks={racks} />
      <FloorMask racks={racks} />
      <Perimeter racks={racks} />
      {walls && <Walls racks={racks} height={wallHeight} />}

      {racks.map((r) => (
        <Rack
          key={r.key}
          placed={r}
          transform={getTransform(r.key)}
          edit={edit}
          interactive={interactive}
          cull={mode === 'walk'}
        />
      ))}

      {edit && <RackControls racks={racks} />}

      {editorOverlays.map((p) => (
        <EditorLagerOverlayScene key={p.overlay.id} overlay={p.overlay} offset={p.offset} interactive={interactive} />
      ))}

      {mode === 'orbit' && (
        <OrbitControls
          makeDefault
          enableDamping
          enabled={!dragActive}
          mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        />
      )}
      {mode === 'orbit' && <CameraHome racks={racks} />}
      {mode === 'orbit' && <OrbitFly speed={speed} />}
      {mode === 'orbit' && (
        <GizmoHelper alignment="bottom-left" margin={[80, 90]}>
          <GizmoViewcube />
        </GizmoHelper>
      )}
      {mode === 'walk' && <WalkControls racks={racks} speed={speed} />}
      {mode === 'topdown' && <TopDownControls racks={racks} />}

      {mode === 'walk' && <LookTarget racks={racks} editorOverlays={editorOverlays.map((p) => p.overlay)} />}
      {mode !== 'walk' && <TargetMarker racks={racks} />}
      <ArticleMarkers racks={racks} />
      <BookingFlash racks={racks} />
      {measure && <MeasureTool />}
      <CameraReporter />
    </>
  );
}
