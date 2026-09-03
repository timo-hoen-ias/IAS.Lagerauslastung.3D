import { describe, expect, it } from 'vitest';
import { degDiff, fmtHeading, knotsFromMs, mod360, tapeItems, yawToHeading } from './flirHudMath';

describe('yawToHeading', () => {
  it('nord = 0', () => {
    expect(yawToHeading(0)).toBe(0);
  });

  it('+90° (rad) = 90', () => {
    expect(yawToHeading(Math.PI / 2)).toBeCloseTo(90, 6);
  });

  it('negative Winkel bleiben in [0,360)', () => {
    expect(yawToHeading(-Math.PI / 2)).toBeCloseTo(270, 6);
  });
});

describe('mod360', () => {
  it('negative & >360 Werte', () => {
    expect(mod360(-10)).toBe(350);
    expect(mod360(370)).toBe(10);
  });
});

describe('degDiff', () => {
  it('kurzer Weg über den Nord-Sprung', () => {
    expect(degDiff(355, 5)).toBe(-10);
    expect(degDiff(5, 355)).toBe(10);
  });
});

describe('tapeItems', () => {
  it('ist zentriert um den gerundeten Kurs', () => {
    const items = tapeItems(35, 6, 60, 5);
    const zero = items.find((i) => i.x === 0);
    expect(zero).toBeDefined();
    expect(zero!.deg).toBe(35);
  });

  it('legt Mehrfachdes nur alle 10° als major an', () => {
    const items = tapeItems(350, 6, 60, 5);
    const majors = items.filter((i) => i.major);
    for (const m of majors) expect(m.deg % 10).toBe(0);
  });

  it('verläuft kontinuierlich über 0°/360°', () => {
    const items = tapeItems(358, 6, 30, 5); // 330..385 → enthält 0/360
    const degs = items.map((i) => i.deg);
    expect(degs).toContain(0);
    expect(degs).toContain(355);
  });
});

describe('fmtHeading', () => {
  it('pad auf 3 Stellen', () => {
    expect(fmtHeading(7)).toBe('007');
    expect(fmtHeading(358)).toBe('358');
  });
});

describe('knotsFromMs', () => {
  it('rechnet m/s → kn', () => {
    expect(knotsFromMs(10)).toBeCloseTo(19.4, 1);
  });

  it('keine negativen Geschwindigkeiten', () => {
    expect(knotsFromMs(-5)).toBe(0);
  });
});
