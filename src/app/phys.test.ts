import { describe, expect, it } from 'vitest';
import { nextVertical } from './phys';

describe('nextVertical', () => {
  it('springt vom Boden mit v0 = jumpSpeed', () => {
    expect(nextVertical(0, true, true, 0.016)).toBe(8);
  });

  it('zieht Gravitation in der Luft an', () => {
    expect(nextVertical(5, false, false, 0.1)).toBe(3);
  });

  it('beginnt zu fallen, sobald nicht mehr auf dem Boden', () => {
    expect(nextVertical(0, false, false, 0.1)).toBe(-2);
  });

  it('lässt den Boden-Sprung nur einmal auslösen', () => {
    const vy = nextVertical(0, true, true, 0.016);
    expect(nextVertical(vy, false, true, 0.016)).toBeCloseTo(8 - 20 * 0.016, 5);
  });
});
