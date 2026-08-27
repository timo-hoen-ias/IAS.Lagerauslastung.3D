import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { getTransform, useDragActive } from '../store';
import { FLOOR } from '../colors';
import type { PlacedRack } from './transform';
import Rack from './Rack';
import WalkControls from './WalkControls';
import TopDownControls from './TopDownControls';
import OrbitFly from './OrbitFly';
import Grid from './Grid';
import MeasureTool from './MeasureTool';
import LookTarget from './LookTarget';
import TargetMarker from './TargetMarker';
import CameraReporter from './CameraReporter';
import Perimeter from './Perimeter';
import FloorMask from './FloorMask';
import type { Mode } from '../App';

export default function WarehouseScene({
  racks,
  mode,
  speed,
  edit,
  measure,
  lighting,
}: {
  racks: PlacedRack[];
  mode: Mode;
  speed: number;
  edit: boolean;
  measure: boolean;
  lighting: boolean;
}) {
  const dragActive = useDragActive();
  const interactive = (mode === 'orbit' || mode === 'topdown') && !edit && !measure;

  return (
    <>
      <color attach="background" args={[FLOOR]} />
      <fog attach="fog" args={[FLOOR, 70, 220]} />

      <ambientLight intensity={0.75} />
      <directionalLight
        position={[30, 50, 20]}
        intensity={1.1}
        castShadow={lighting}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-near={0.5}
        shadow-camera-far={300}
      />
      <directionalLight position={[-40, 40, -30]} intensity={0.35} />
      {lighting && <hemisphereLight args={['#cfe0f0', '#4a4438', 0.35]} />}

      <mesh rotation-x={-Math.PI / 2} receiveShadow raycast={() => {}} position={[0, 0, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color={FLOOR} />
      </mesh>

      <Grid racks={racks} />
      <FloorMask racks={racks} />
      <Perimeter racks={racks} />

      {racks.map((r) => (
        <Rack key={r.key} placed={r} transform={getTransform(r.key)} edit={edit} interactive={interactive} />
      ))}

      {mode === 'orbit' && (
        <OrbitControls
          makeDefault
          enableDamping
          enabled={!dragActive}
          mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        />
      )}
      {mode === 'orbit' && <OrbitFly speed={speed} />}
      {mode === 'walk' && <WalkControls racks={racks} speed={speed} />}
      {mode === 'topdown' && <TopDownControls racks={racks} />}

      {mode === 'walk' && <LookTarget racks={racks} />}
      {mode !== 'walk' && <TargetMarker racks={racks} />}
      {measure && <MeasureTool />}
      <CameraReporter />
    </>
  );
}
