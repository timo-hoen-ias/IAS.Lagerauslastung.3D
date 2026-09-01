import { describe, expect, it } from 'vitest';
import { computeMinimapScale, minimapRedrawDue, worldToMinimap } from './Minimap';
import type { PlacedRack } from '../scene/transform';

function fakeRack(x: number, z: number, w: number, d: number): PlacedRack {
  return { position: [x, 0, z], size: { w, h: 1, d } } as PlacedRack;
}

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

describe('computeMinimapScale', () => {
  it('liefert eine neutrale Skalierung ohne Regale', () => {
    expect(computeMinimapScale([], 176)).toBe(1);
  });

  it('skaliert die Regal-Ausdehnung auf die Radar-Kantenlänge', () => {
    const racks = [fakeRack(0, 0, 10, 10), fakeRack(20, 0, 10, 10)];
    // Ausdehnung X: -5..25 = 30, Z: -5..5 = 10 → engpass ist X.
    expect(computeMinimapScale(racks, 176)).toBeCloseTo((176 / 30) * 0.85, 5);
  });
});

describe('worldToMinimap', () => {
  it('bildet die Spielerposition auf die Radar-Mitte ab', () => {
    const player = { x: 5, z: -3, yaw: 0 };
    expect(worldToMinimap(5, -3, player, 4, 176)).toEqual({ x: 88, y: 88 });
  });

  it('folgt derselben Dreh-/Skalierungsreihenfolge wie das Canvas-Zeichnen (rotate(yaw+PI) → scale → translate)', () => {
    const player = { x: 0, z: 0, yaw: 0 };
    const p = worldToMinimap(0, -10, player, 1, 176);
    expect(p.x).toBeCloseTo(88, 5);
    expect(p.y).toBeCloseTo(98, 5);
  });

  it('dreht Punkte mit, wenn der Spieler sich dreht', () => {
    const player = { x: 0, z: 0, yaw: Math.PI / 2 };
    const p = worldToMinimap(10, 0, player, 1, 176);
    expect(p.x).toBeCloseTo(88, 5);
    expect(p.y).toBeCloseTo(78, 5);
  });
});
