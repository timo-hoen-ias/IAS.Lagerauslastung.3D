import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { updateCam } from '../store';

export default function CameraReporter() {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const f = new THREE.Vector3();
    camera.getWorldDirection(f);
    updateCam({ x: camera.position.x, z: camera.position.z, yaw: Math.atan2(f.x, f.z) });
  });
  return null;
}
