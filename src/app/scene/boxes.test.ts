import { describe, expect, it } from 'vitest';
import { floorFrameBoxes, mergeBoxes, rackParts, wallBoxes, wallGlassBoxes } from './boxes';
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

describe('wallBoxes', () => {
  const bounds = { minX: 0, maxX: 12, minZ: 0, maxZ: 12 };
  const height = 4;

  it('Brüstung + Dachbalken je Seite, Pfeiler im 3-m-Raster', () => {
    const boxes = wallBoxes(bounds, height);
    const piers = boxes.filter((b) => b.size[1] === height);
    const strips = boxes.filter((b) => b.size[1] !== height);
    expect(strips.length).toBe(8); // 4 Seiten × (Brüstung + Dach)
    expect(piers.length).toBe(20); // 4 Seiten × 5 Pfeiler (0,3,6,9,12)
  });

  it('Brüstung liegt auf dem Boden, Dach endet an der Wandhöhe', () => {
    const boxes = wallBoxes(bounds, height);
    const sill = boxes.find((b) => b.pos[1] === 0.5)!;
    const header = boxes.find((b) => b.pos[1] === height - 0.3)!;
    expect(sill).toBeDefined();
    expect(header).toBeDefined();
    expect(sill.pos[0]).toBe(6);
    expect(header.pos[0]).toBe(6);
  });

  it('Fensteröffnung zwischen Brüstung und Dach bleibt frei', () => {
    const boxes = wallBoxes(bounds, height);
    const sill = boxes.find((b) => b.pos[1] === 0.5)!;
    const header = boxes.find((b) => b.pos[1] === height - 0.3)!;
    const windowH = header.pos[1] - header.size[1] / 2 - (sill.pos[1] + sill.size[1] / 2);
    expect(windowH).toBeGreaterThan(0);
    expect(windowH).toBeCloseTo(height - 1 - 0.6, 6);
  });

  it('setzt einen Abschluss-Pfeiler bei nicht ganzzahliger Rasterlänge', () => {
    const b = { minX: 0, maxX: 8.5, minZ: 0, maxZ: 3 };
    const boxes = wallBoxes(b, height);
    const endPier = boxes.some((bb) => bb.size[1] === height && Math.abs(bb.pos[0] - 8.5) < 1e-6);
    expect(endPier).toBe(true);
  });
});

describe('wallGlassBoxes', () => {
  const bounds = { minX: 0, maxX: 12, minZ: 0, maxZ: 12 };
  const height = 4;

  it('füllt jede Fensteröffnung zwischen zwei Pfeilern (4 Bays je Seite)', () => {
    const boxes = wallGlassBoxes(bounds, height);
    expect(boxes.length).toBe(16); // 4 Seiten × 4 Bays (Pfeiler bei 0,3,6,9,12)
  });

  it('sitzt vertikal zwischen Brüstung und Dachbalken', () => {
    const [glass] = wallGlassBoxes(bounds, height);
    expect(glass!.size[1]).toBeCloseTo(height - 1 - 0.6, 6); // height - sill - header
    expect(glass!.pos[1]).toBeCloseTo(1 + (height - 1 - 0.6) / 2, 6); // sill + windowH/2
  });

  it('bleibt innerhalb der Pfeilerbreite (keine Überlappung)', () => {
    const boxes = wallGlassBoxes(bounds, height);
    // erste Scheibe liegt zwischen Pfeiler bei 0 und 3, exklusive halber Pfeilerbreite (0.4/2) je Seite
    const first = boxes.find((b) => b.pos[2] === 0 && b.pos[0] === 1.5)!;
    expect(first).toBeDefined();
    expect(first.size[0]).toBeCloseTo(3 - 0.4, 6);
  });

  it('liefert nichts, wenn kein Fensterband Platz hat (Wand niedriger als Brüstung+Dach)', () => {
    expect(wallGlassBoxes(bounds, 1)).toEqual([]);
  });
});
