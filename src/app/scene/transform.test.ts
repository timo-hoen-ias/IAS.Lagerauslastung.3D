import { describe, expect, it } from 'vitest';
import type { Lagerort } from '../../shared/types';
import { rackMetrics } from './layout';
import {
  applyTransform,
  clampScale,
  dist2d,
  IDENTITY_TRANSFORM,
  moveRack,
  rackAabb,
  rotateRack,
  round05,
  scaleRack,
  snap1,
  snap45,
} from './transform';

const ort: Lagerort = {
  lagerkennung: 'KUEHL',
  bezeichnung: 'Kühl-HR',
  lagertechnik: 'LTD3HR',
  dims: { d1: 4, d2: 2, d3: 5 },
  plaetze: [],
};

const base = { ...rackMetrics(ort), ort, origin: [10, 0, 20] as [number, number, number] };

describe('snap', () => {
  it('snap1 rundet auf ganze Meter', () => {
    expect(snap1(3.49)).toBe(3);
    expect(snap1(3.5)).toBe(4);
    expect(snap1(-2.6)).toBe(-3);
  });

  it('snap45 rundet auf 45°-Vielfache', () => {
    expect(snap45(89)).toBe(90);
    expect(snap45(46)).toBe(45);
    expect(snap45(-44)).toBe(-45);
  });
});

describe('scale', () => {
  it('round05 liefert 0.5er-Schritte', () => {
    expect(round05(1.3)).toBe(1.5);
    expect(round05(0.24)).toBe(0);
  });

  it('clampScale begrenzt auf 0.5–2', () => {
    expect(clampScale(3)).toBe(2);
    expect(clampScale(0.1)).toBe(0.5);
    expect(clampScale(1)).toBe(1);
  });
});

describe('applyTransform', () => {
  it('verschiebt, skaliert und rotiert das Regal', () => {
    const t = { x: 3, z: -2, rotY: 0, scale: 1.5 };
    const p = applyTransform(base, t);
    expect(p.position).toEqual([13, 0, 18]);
    expect(p.size.w).toBeCloseTo(base.size.w * 1.5, 5);
    expect(p.size.h).toBeCloseTo(base.size.h * 1.5, 5);
    expect(p.key).toBe('KUEHL');
  });

  it('Identität lässt das Basis-Layout unverändert', () => {
    const p = applyTransform(base, IDENTITY_TRANSFORM);
    expect(p.position).toEqual([10, 0, 20]);
    expect(p.size).toEqual(base.size);
  });
});

describe('rackAabb', () => {
  it('0°: AABB = ungedrehte Box', () => {
    const p = applyTransform(base, IDENTITY_TRANSFORM);
    const b = rackAabb(p);
    expect(b.maxX - b.minX).toBeCloseTo(p.size.w, 5);
    expect(b.maxZ - b.minZ).toBeCloseTo(p.size.d, 5);
  });

  it('45°: AABB ist die umhüllende Diagonale', () => {
    const p = applyTransform(base, { x: 0, z: 0, rotY: Math.PI / 4, scale: 1 });
    const b = rackAabb(p);
    const expectHalf = (Math.sqrt(2) / 2) * (p.size.w / 2 + p.size.d / 2);
    expect(b.maxX - b.minX).toBeCloseTo(expectHalf * 2, 5);
  });

  it('90°: Breite und Tiefe vertauschen sich', () => {
    const p = applyTransform(base, { x: 0, z: 0, rotY: Math.PI / 2, scale: 1 });
    const b = rackAabb(p);
    expect(b.maxX - b.minX).toBeCloseTo(p.size.d, 5);
    expect(b.maxZ - b.minZ).toBeCloseTo(p.size.w, 5);
  });
});

describe('rotateRack / scaleRack', () => {
  it('rotateRack snapped auf 45°-Schritte', () => {
    const r1 = rotateRack(IDENTITY_TRANSFORM, 50);
    expect((r1.rotY * 180) / Math.PI).toBe(45);
    const r2 = rotateRack(IDENTITY_TRANSFORM, 95);
    expect((r2.rotY * 180) / Math.PI).toBe(90);
  });

  it('scaleRack rundet und clamp', () => {
    expect(scaleRack(IDENTITY_TRANSFORM, 1.3).scale).toBe(1.5);
    expect(scaleRack(IDENTITY_TRANSFORM, 5).scale).toBe(2);
  });

  it('moveRack verschiebt und snapped auf ganze Meter', () => {
    const m = moveRack({ x: 2.4, z: -1.6, rotY: 0, scale: 1 }, 1, 0);
    expect(m.x).toBe(3);
    expect(m.z).toBe(-2);
  });
});

describe('dist2d', () => {
  it('berechnet die Länge einer Strecke', () => {
    expect(dist2d({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5);
  });
});
