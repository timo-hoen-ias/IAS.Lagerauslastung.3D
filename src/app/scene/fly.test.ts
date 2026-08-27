import { describe, expect, it } from 'vitest';
import { flyDelta } from './fly';

const FWD = { x: 0, z: -1 };
const RIGHT = { x: 1, z: 0 };

describe('flyDelta', () => {
  it('W bewegt nach vorne (Blickrichtung)', () => {
    const d = flyDelta({ KeyW: true }, FWD, RIGHT, 10, 0.1);
    expect(d.x).toBeCloseTo(0, 5);
    expect(d.z).toBeCloseTo(-1, 5);
    expect(d.y).toBe(0);
  });

  it('S bewegt nach hinten', () => {
    const d = flyDelta({ KeyS: true }, FWD, RIGHT, 10, 0.1);
    expect(d.z).toBeCloseTo(1, 5);
  });

  it('A/D strafen seitlich', () => {
    const d = flyDelta({ KeyD: true }, FWD, RIGHT, 10, 0.1);
    expect(d.x).toBeCloseTo(1, 5);
    const a = flyDelta({ KeyA: true }, FWD, RIGHT, 10, 0.1);
    expect(a.x).toBeCloseTo(-1, 5);
  });

  it('Space/Shift bewegen vertikal', () => {
    const up = flyDelta({ Space: true }, FWD, RIGHT, 10, 0.1);
    expect(up.y).toBeCloseTo(1, 5);
    const down = flyDelta({ ShiftLeft: true }, FWD, RIGHT, 10, 0.1);
    expect(down.y).toBeCloseTo(-1, 5);
  });

  it('normalisiert die Diagonale (nicht schneller)', () => {
    const diag = flyDelta({ KeyW: true, KeyD: true }, FWD, RIGHT, 10, 0.1);
    const straight = flyDelta({ KeyW: true }, FWD, RIGHT, 10, 0.1);
    expect(Math.hypot(diag.x, diag.z)).toBeCloseTo(Math.hypot(straight.x, straight.z), 5);
  });

  it('ohne Tasten keine Bewegung', () => {
    expect(flyDelta({}, FWD, RIGHT, 10, 0.1)).toEqual({ x: 0, y: 0, z: 0 });
  });
});
