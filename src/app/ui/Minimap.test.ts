import { describe, expect, it } from 'vitest';
import { minimapRedrawDue } from './Minimap';

describe('minimapRedrawDue', () => {
  it('zeichnet beim ersten Mal immer', () => {
    expect(minimapRedrawDue(null, 0, 0, 0, 100)).toBe(true);
  });

  it('zeichnet bei ausreichender Bewegung neu', () => {
    expect(minimapRedrawDue({ x: 0, z: 0, yaw: 0, t: 0 }, 2, 0, 0, 16)).toBe(true);
  });

  it('zeichnet bei abgelaufenem Intervall neu, auch ohne Bewegung', () => {
    expect(minimapRedrawDue({ x: 0, z: 0, yaw: 0, t: 0 }, 0, 0, 0, 101)).toBe(true);
  });

  it('überspringt bei kleiner Bewegung innerhalb des Intervalls', () => {
    expect(minimapRedrawDue({ x: 0, z: 0, yaw: 0, t: 0 }, 0.01, 0, 0, 50)).toBe(false);
  });
});
