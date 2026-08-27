export type KeyState = Record<string, boolean>;

/**
 * Godmode-ähnliche Flugbewegung: kamera-relativ auf der XZ-Ebene (W/S vor/zurück,
 * A/D strafe), vertikal via Space/Shift. Der Rückgabewert ist die Positionsänderung
 * für diesen Frame. Diagonale wird normalisiert, damit Diagonal-Laufen nicht schneller ist.
 */
export function flyDelta(
  keys: KeyState,
  forward: { x: number; z: number },
  right: { x: number; z: number },
  speed: number,
  dt: number,
): { x: number; y: number; z: number } {
  let dx = 0;
  let dz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) {
    dx += forward.x;
    dz += forward.z;
  }
  if (keys['KeyS'] || keys['ArrowDown']) {
    dx -= forward.x;
    dz -= forward.z;
  }
  if (keys['KeyD'] || keys['ArrowRight']) {
    dx += right.x;
    dz += right.z;
  }
  if (keys['KeyA'] || keys['ArrowLeft']) {
    dx -= right.x;
    dz -= right.z;
  }

  const len = Math.hypot(dx, dz);
  if (len > 0) {
    dx /= len;
    dz /= len;
  }

  let dy = 0;
  if (keys['Space']) dy += 1;
  if (keys['ShiftLeft'] || keys['ShiftRight']) dy -= 1;

  return { x: dx * speed * dt, y: dy * speed * dt, z: dz * speed * dt };
}
