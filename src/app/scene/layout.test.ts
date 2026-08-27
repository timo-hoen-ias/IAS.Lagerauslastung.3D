import { describe, expect, it } from 'vitest';
import type { Lagerort, Lagerplatz } from '../../shared/types';
import { FRAME_CLEAR, TOP_H, TOP_OVERHANG, cellLocalPosition, layoutRacks, rackBounds, rackFrame, rackMetrics } from './layout';

const ort = (dims: { d1: number; d2: number; d3: number }, plaetze: Lagerplatz[] = []): Lagerort => ({
  lagerkennung: 'X',
  bezeichnung: '',
  lagertechnik: 'LTD3HR',
  dims,
  plaetze,
});

const platz = (platzId: number, dim: { d1: number; d2: number; d3: number }): Lagerplatz => ({
  platzId,
  dim,
  ebene: 0,
  kurz: '',
  platzbezeichnung: '',
  masse: { hoehe: 0, breite: 0, laenge: 0 },
  bestaende: [],
});

describe('rackMetrics', () => {
  it('3D-Hochregal: Spalten/Ebenen/Tiefe aus AnzahlDimension', () => {
    const m = rackMetrics(ort({ d1: 4, d2: 2, d3: 5 }));
    expect(m.cols).toBe(4);
    expect(m.levels).toBe(2);
    expect(m.depth).toBe(5);
    expect(m.size.w).toBeCloseTo(4 * 1.35 - 0.15, 5);
    expect(m.size.d).toBeCloseTo(5 * 1.15 - 0.15, 5);
    expect(m.size.h).toBeGreaterThan(2 * 0.6);
  });

  it('2D-Flächenlager: Tiefe aus Dimension2, eine Ebene', () => {
    const m = rackMetrics(ort({ d1: 5, d2: 10, d3: 0 }));
    expect(m.cols).toBe(5);
    expect(m.levels).toBe(1);
    expect(m.depth).toBe(10);
  });

  it('1D/0D: einzelne Reihe bzw. Einzelblock', () => {
    expect(rackMetrics(ort({ d1: 100, d2: 0, d3: 0 }))).toMatchObject({ cols: 100, levels: 1, depth: 1 });
    expect(rackMetrics(ort({ d1: 0, d2: 0, d3: 0 }))).toMatchObject({ cols: 1, levels: 1, depth: 1 });
  });

describe('rackFrame', () => {
  it('Top-Box liegt mit Abstand über den obersten Zellen und den Pfosten (kein Z-Fighting)', () => {
    for (const dims of [{ d1: 4, d2: 2, d3: 5 }, { d1: 2, d2: 1, d3: 0 }, { d1: 1, d2: 1, d3: 1 }]) {
      const m = rackMetrics(ort(dims));
      const f = rackFrame(m.size);
      const cellTop = m.size.h - TOP_H;
      const postTop = f.post.pos[1] + f.post.size[1] / 2;
      const topBottom = f.top.pos[1] - f.top.size[1] / 2;
      expect(topBottom - cellTop).toBeCloseTo(FRAME_CLEAR, 5);
      expect(topBottom - postTop).toBeCloseTo(FRAME_CLEAR, 5);
    }
  });

  it('Top-Box überragt die Regalaußenkanten, Pfosten enden unter der Top-Box', () => {
    const m = rackMetrics(ort({ d1: 3, d2: 2, d3: 2 }));
    const f = rackFrame(m.size);
    expect(f.top.size[0]).toBe(m.size.w + 2 * TOP_OVERHANG);
    expect(f.top.size[2]).toBe(m.size.d + 2 * TOP_OVERHANG);
    expect(f.post.size[1]).toBe(m.size.h - TOP_H - FRAME_CLEAR);
    expect(f.post.pos[1] - f.post.size[1] / 2).toBeCloseTo(FRAME_CLEAR, 5);
  });
});
});

describe('cellLocalPosition', () => {
  const rack = { ...rackMetrics(ort({ d1: 4, d2: 2, d3: 5 })), origin: [0, 0, 0] as [number, number, number] };

  it('platziert 3D-Zellen zentriert nach Dimension', () => {
    const [x, y, z] = cellLocalPosition(platz(2, { d1: 1, d2: 1, d3: 1 }), rack);
    expect(x).toBeCloseTo(-(3 / 2) * 1.35, 5);
    expect(z).toBeCloseTo(-(4 / 2) * 1.15, 5);
    expect(y).toBeCloseTo(0.25 + 0.6 / 2, 5);
  });

  it('setzt den 0/0/0-Auffangplatz vor das Regal', () => {
    const [x, y, z] = cellLocalPosition(platz(1, { d1: 0, d2: 0, d3: 0 }), rack);
    expect(z).toBeLessThan(0);
    expect(y).toBeGreaterThan(0);
  });
});

describe('rackBounds', () => {
  it('liefert null für leere Platzierungen', () => {
    expect(rackBounds([])).toBeNull();
  });

  it('berechnet Bounding-Box über alle Rack-Fußabdrücke', () => {
    const placed = layoutRacks([ort({ d1: 2, d2: 1, d3: 1 }, []), ort({ d1: 4, d2: 2, d3: 2 }, [])]);
    const b = rackBounds(placed)!;
    expect(b.minX).toBeLessThan(b.maxX);
    expect(b.minZ).toBeLessThanOrEqual(b.maxZ);
    expect(b.maxX).toBeGreaterThan(b.minX);
  });
});

describe('layoutRacks', () => {
  it('platziert mehrere Racks im Raster und bricht Zeilen an MAX_ROW_WIDTH', () => {
    const big = ort({ d1: 40, d2: 1, d3: 0 }, []);
    const small = ort({ d1: 2, d2: 2, d3: 2 }, []);
    const placed = layoutRacks([big, small, small, small, small]);
    expect(placed.length).toBe(5);
    expect(placed[1]!.origin[2]).toBe(placed[2]!.origin[2]);
    expect(placed[1]!.origin[2]).toBeGreaterThan(placed[0]!.origin[2]);
  });

  it('zentriert das Layout um den Ursprung', () => {
    const placed = layoutRacks([ort({ d1: 2, d2: 2, d3: 2 }, []), ort({ d1: 3, d2: 2, d3: 4 }, [])]);
    const b = rackBounds(placed)!;
    expect((b.minX + b.maxX) / 2).toBeCloseTo(0, 5);
    expect((b.minZ + b.maxZ) / 2).toBeCloseTo(0, 5);
  });
});
