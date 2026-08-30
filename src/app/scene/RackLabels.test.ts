import { describe, expect, it } from 'vitest';
import { LABEL_HIDE, lodNear } from './RackLabels';

describe('lodNear (LOD-Hysterese)', () => {
  it('mountet anfangs fern nichts (startet mit near=false)', () => {
    expect(lodNear(false, LABEL_HIDE + 100, LABEL_HIDE)).toBe(false);
  });

  it('mountet, sobald die Kamera unter showDist kommt', () => {
    // show = hideDist - 8 = 10
    expect(lodNear(false, 9, LABEL_HIDE)).toBe(true);
  });

  it('bleibt near bis hideDist überschritten ist', () => {
    // zwischen show(10) und hide(18) bleibt near=true
    expect(lodNear(true, 15, LABEL_HIDE)).toBe(true);
  });

  it('verlässt near erst oberhalb hideDist', () => {
    expect(lodNear(true, LABEL_HIDE + 0.1, LABEL_HIDE)).toBe(false);
  });

  it('zeigt Hysterese an der Grenze: far bleibt far knapp über showDist', () => {
    // show = 10, d = 10.5 -> noch nicht nah genug zum Mounten
    expect(lodNear(false, 10.5, LABEL_HIDE)).toBe(false);
    // once near, d=10.5 bleibt near
    expect(lodNear(true, 10.5, LABEL_HIDE)).toBe(true);
  });

  it('respektiert explizites showDist', () => {
    expect(lodNear(false, 56, 70, 55)).toBe(false);
    expect(lodNear(false, 54, 70, 55)).toBe(true);
  });
});
