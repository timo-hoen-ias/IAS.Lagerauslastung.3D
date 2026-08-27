import { OrbitControls } from '@react-three/drei';
import { getTransform, useDragActive } from '../store';
import { FLOOR } from '../colors';
import type { PlacedRack } from './transform';
import Rack from './Rack';
import WalkControls from './WalkControls';
import TopDownControls from './TopDownControls';
import Grid from './Grid';
import MeasureTool from './MeasureTool';
import LookTarget from './LookTarget';
import TargetMarker from './TargetMarker';
import CameraReporter from './CameraReporter';
import Perimeter from './Perimeter';
import Inspector from '../ui/Inspector';
import type { Mode } from '../App';

export default function WarehouseScene({
  racks,
  mode,
  speed,
  edit,
  measure,
}: {
  racks: PlacedRack[];
  mode: Mode;
  speed: number;
  edit: boolean;
  measure: boolean;
}) {
  const dragActive = useDragActive();
  const interactive = (mode === 'orbit' || mode === 'topdown') && !edit && !measure;

  return (
    <>
      <color attach="background" args={[FLOOR]} />
      <fog attach="fog" args={[FLOOR, 70, 220]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[30, 50, 20]} intensity={1.1} castShadow />
      <directionalLight position={[-40, 40, -30]} intensity={0.35} />

      <Grid racks={racks} />
      <Perimeter racks={racks} />

      {racks.map((r) => (
        <Rack key={r.key} placed={r} transform={getTransform(r.key)} edit={edit} interactive={interactive} />
      ))}

      {mode === 'orbit' && <OrbitControls makeDefault enableDamping enabled={!dragActive} />}
      {mode === 'walk' && <WalkControls racks={racks} speed={speed} />}
      {mode === 'topdown' && <TopDownControls racks={racks} />}

      {mode === 'walk' && <LookTarget racks={racks} />}
      {mode !== 'walk' && <TargetMarker racks={racks} />}
      {measure && <MeasureTool />}
      <CameraReporter />
      <Inspector />
    </>
  );
}
