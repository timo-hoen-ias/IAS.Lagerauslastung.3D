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

/** Projiziert einen Mauspunkt auf eine vertikale, zur Kamera gerichtete Ebene durch die Regalmitte. */
export function useVerticalPlanePoint(): (
  clientX: number,
  clientY: number,
  origin: { x: number; z: number },
) => { y: number } | null {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  return useCallback(
    (clientX: number, clientY: number, origin: { x: number; z: number }) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const normal = new THREE.Vector3(camera.position.x - origin.x, 0, camera.position.z - origin.z);
      if (normal.lengthSq() === 0) return null;
      normal.normalize();
      const plane = new THREE.Plane(normal, -normal.dot(new THREE.Vector3(origin.x, 0, origin.z)));
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(plane, hit)) return { y: hit.y };
      return null;
    },
    [camera, gl],
  );
}
