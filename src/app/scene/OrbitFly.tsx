import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { flyDelta } from './fly';

const UP = new THREE.Vector3(0, 1, 0);

export default function OrbitFly({ speed }: { speed: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3 } | null;
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      return el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA');
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping()) return;
      keys.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, UP).normalize();

    const d = flyDelta(keys.current, { x: forward.x, z: forward.z }, { x: right.x, z: right.z }, speed, dt);
    if (d.x === 0 && d.y === 0 && d.z === 0) return;

    camera.position.x += d.x;
    camera.position.y += d.y;
    camera.position.z += d.z;

    if (controls) {
      controls.target.x += d.x;
      controls.target.y += d.y;
      controls.target.z += d.z;
    }
  });

  return null;
}
