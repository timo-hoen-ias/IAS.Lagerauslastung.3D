import { describe, expect, it } from 'vitest';
import { floorFrameBoxes, mergeBoxes, rackParts } from './boxes';
import { BASE_H, FRAME_CLEAR, LEVEL_GAP, POST, TOP_H, TOP_OVERHANG } from './layout';

describe('mergeBoxes', () => {
  it('verbindet zwei Boxen zu einer Geometrie', () => {
    const geo = mergeBoxes([
      { pos: [0, 0, 0], size: [1, 1, 1] },
      { pos: [2, 0, 0], size: [1, 1, 1] },
    ])!;
    expect(geo).not.toBeNull();
    expect(geo.attributes.position.count).toBe(48); // 2 × 24 Eckpunkte
    expect(geo.index?.count).toBe(72); // 2 × 36 Indizes
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    expect(bb.min.x).toBeCloseTo(-0.5, 3);
    expect(bb.max.x).toBeCloseTo(2.5, 3);
    geo.dispose();
  });

  it('liefert null für leere Eingabe', () => {
    expect(mergeBoxes([])).toBeNull();
  });
});

describe('rackParts', () => {
  const parts = rackParts({ w: 1, h: 3.5, d: 5 }, 3, 0.6);

  it('Sockel + ein Boden je Ebene', () => {
    expect(parts.dark.length).toBe(4); // 1 Sockel + 3 Böden
    expect(parts.dark[0]!.size).toEqual([1.3, 0.08, 5.3]);
  });

  it('vier Eckpfosten', () => {
    expect(parts.grey.length).toBe(4);
    const postH = 3.5 - TOP_H - FRAME_CLEAR;
    expect(parts.grey[0]!.size).toEqual([POST, postH, POST]);
    expect(parts.grey[0]!.pos[1]).toBeCloseTo(FRAME_CLEAR + postH / 2, 6);
  });

  it('eine Abdeckplatte mit Überstand', () => {
    expect(parts.top.length).toBe(1);
    expect(parts.top[0]!.size).toEqual([1 + 2 * TOP_OVERHANG, TOP_H, 5 + 2 * TOP_OVERHANG]);
  });

  it('Böden liegen auf den Ebenen-Höhen', () => {
    for (let iy = 0; iy < 3; iy++) {
      expect(parts.dark[iy + 1]!.pos[1]).toBeCloseTo(BASE_H + iy * (0.6 + LEVEL_GAP) - 0.02, 6);
    }
  });
});

describe('floorFrameBoxes', () => {
  it('4 Linien + 8 Eckstücke je core und halo', () => {
    const { core, halo } = floorFrameBoxes(4, 2);
    expect(core.length).toBe(12);
    expect(halo.length).toBe(12);
  });

  it('äußere Randlinie reicht über die Regalkante hinaus', () => {
    const { core } = floorFrameBoxes(4, 2);
    const first = core[0]!;
    expect(first.size[2]).toBeCloseTo(0.06, 6); // LINE
    expect(first.pos[2]).toBeCloseTo(-(2 + 0.5) / 2, 6); // -halfD inkl. FRAME_GAP
  });

  it('Halo ist dicker als der Kern', () => {
    const { core, halo } = floorFrameBoxes(4, 2);
    expect(halo[0]!.size[2]).toBeGreaterThan(core[0]!.size[2]);
  });
});
