import { describe, expect, it } from 'vitest';
import { camMoved } from './CameraReporter';

describe('camMoved', () => {
  const base = { x: 0, y: 0, z: 0, yaw: 0 };

  it('erkennt identische Position als statisch', () => {
    expect(camMoved(base, base)).toBe(false);
  });

  it('erkennt kleine Drift unter der Epsilon-Schwelle als statisch', () => {
    expect(camMoved(base, { x: 0.004, y: 0, z: 0.004, yaw: 0 })).toBe(false);
  });

  it('erkennt deutliche Bewegung als geändert', () => {
    expect(camMoved(base, { x: 1, y: 0, z: 0, yaw: 0 })).toBe(true);
  });

  it('erkennt Drehung als geändert', () => {
    expect(camMoved(base, { x: 0, y: 0, z: 0, yaw: 1 })).toBe(true);
  });
});
