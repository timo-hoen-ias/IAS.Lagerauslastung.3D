import { useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** Projiziert einen Mauspunkt (clientX/clientY) auf den Boden (y=0). */
export function useGroundPoint(): (clientX: number, clientY: number) => { x: number; z: number } | null {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  return useCallback(
    (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(plane, hit)) return { x: hit.x, z: hit.z };
      return null;
    },
    [camera, gl],
  );
}
