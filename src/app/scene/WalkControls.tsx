import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { nextVertical } from '../phys';
import { updatePlayer } from '../store';
import { rackAabb, type PlacedRack } from './transform';

const EYE_HEIGHT = 1.7;
const SPRINT = 8;
const RADIUS = 0.35;
const GRAVITY = 20;
const JUMP_SPEED = 8;

export default function WalkControls({ racks, speed }: { racks: PlacedRack[]; speed: number }) {
  const controls = useRef<PointerLockControlsImpl | null>(null);
  const camera = useThree((s) => s.camera);
  const keys = useRef<Record<string, boolean>>({});
  const motion = useRef({ vy: 0, grounded: true });

  useEffect(() => {
    camera.position.y = EYE_HEIGHT;
  }, [camera]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
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
    const pos = camera.position;
    const locked = controls.current?.isLocked ?? false;

    motion.current.vy = nextVertical(motion.current.vy, motion.current.grounded, locked && !!keys.current['Space'], dt, GRAVITY, JUMP_SPEED);
    pos.y += motion.current.vy * dt;
    if (pos.y <= EYE_HEIGHT) {
      pos.y = EYE_HEIGHT;
      motion.current.vy = 0;
      motion.current.grounded = true;
    } else {
      motion.current.grounded = false;
    }

    if (locked) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.y = 0;
      dir.normalize();
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
      const move = new THREE.Vector3();
      if (keys.current['KeyW'] || keys.current['ArrowUp']) move.add(dir);
      if (keys.current['KeyS'] || keys.current['ArrowDown']) move.sub(dir);
      if (keys.current['KeyD'] || keys.current['ArrowRight']) move.add(right);
      if (keys.current['KeyA'] || keys.current['ArrowLeft']) move.sub(right);
      if (move.lengthSq() > 0) {
        const isSprint = keys.current['ShiftLeft'] || keys.current['ShiftRight'];
        move.normalize().multiplyScalar((isSprint ? SPRINT : speed) * dt);
        pos.x += move.x;
        resolveCollisions(racks, pos, RADIUS);
        pos.z += move.z;
        resolveCollisions(racks, pos, RADIUS);
      }
    }

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    updatePlayer({ x: pos.x, z: pos.z, yaw: Math.atan2(forward.x, forward.z) });
  });

  return <PointerLockControls ref={controls} makeDefault selector="#wm-root" />;
}

function resolveCollisions(racks: PlacedRack[], pos: THREE.Vector3, r: number) {
  for (const rack of racks) {
    const b = rackAabb(rack);
    const minX = b.minX - r;
    const maxX = b.maxX + r;
    const minZ = b.minZ - r;
    const maxZ = b.maxZ + r;
    if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
      const dl = pos.x - minX;
      const dr = maxX - pos.x;
      const dt = pos.z - minZ;
      const db = maxZ - pos.z;
      const min = Math.min(dl, dr, dt, db);
      if (min === dl) pos.x = minX;
      else if (min === dr) pos.x = maxX;
      else if (min === dt) pos.z = minZ;
      else pos.z = maxZ;
    }
  }
}
