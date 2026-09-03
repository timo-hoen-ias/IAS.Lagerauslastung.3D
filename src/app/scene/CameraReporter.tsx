import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { updateCam } from '../store';

export const CAM_EPS = 0.01;

/** Prüft, ob sich die Kamera messbar bewegt hat (verhindert Store-Notifies + React-Re-Renders pro Frame). */
export function camMoved(a: { x: number; y: number; z: number; yaw: number }, b: { x: number; y: number; z: number; yaw: number }, eps = CAM_EPS): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) + Math.abs(a.yaw - b.yaw) > eps;
}

export default function CameraReporter() {
  const camera = useThree((s) => s.camera);
  const last = useRef({ x: 0, y: 0, z: 0, yaw: 0 });
  const dir = useRef(new THREE.Vector3());

  useFrame(() => {
    camera.getWorldDirection(dir.current);
    const next = { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: Math.atan2(dir.current.x, dir.current.z) };
    if (camMoved(next, last.current)) {
      last.current = next;
      updateCam({ x: next.x, y: next.y, z: next.z, yaw: next.yaw });
    }
  });
  return null;
}
