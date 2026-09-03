import { describe, expect, it } from 'vitest';
import { DEFAULT_VOLUME, nextGapMs, pickIndex, RADIO_CLIPS } from './radio';

describe('pickIndex', () => {
  it('liefert den oberen Rand bei rng ~ 1', () => {
    expect(pickIndex(() => 0.9999, RADIO_CLIPS.length)).toBe(RADIO_CLIPS.length - 1);
  });

  it('liefert 0 bei rng = 0', () => {
    expect(pickIndex(() => 0, 4)).toBe(0);
  });

  it('bleibt bei leeren Clips in Grenzen (n=0 → 0)', () => {
    expect(pickIndex(() => 0.5, 0)).toBe(0);
  });

  it('deckt alle Indizes ab', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) seen.add(pickIndex(Math.random, 7));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('nextGapMs', () => {
  it('liefert min bei rng = 0', () => {
    expect(nextGapMs(() => 0)).toBe(6000);
  });

  it('liefert max bei rng ≈ 1', () => {
    expect(nextGapMs(() => 0.99999)).toBe(16000);
  });

  it('respektiert eigene Grenzen', () => {
    const v = nextGapMs(() => 0.5, 1000, 2000);
    expect(v).toBeGreaterThanOrEqual(1000);
    expect(v).toBeLessThanOrEqual(2000);
  });
});

describe('RADIO_CLIPS', () => {
  it('verweist auf eingebettete CC0-Materialien', () => {
    expect(RADIO_CLIPS.length).toBeGreaterThan(0);
    for (const c of RADIO_CLIPS) expect(c).toMatch(/^\/audio\/radio\/.+\.mp3$/);
  });
});

describe('DEFAULT_VOLUME', () => {
  it('ist bewusst leise (Hintergrund)', () => {
    expect(DEFAULT_VOLUME).toBeLessThanOrEqual(0.2);
    expect(DEFAULT_VOLUME).toBeGreaterThan(0);
  });
});
