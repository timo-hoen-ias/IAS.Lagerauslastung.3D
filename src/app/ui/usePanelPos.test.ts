import { describe, expect, it } from 'vitest';
import { clampPanel } from './usePanelPos';

describe('clampPanel', () => {
  it('lässt Positionen im Viewport unverändert', () => {
    expect(clampPanel({ x: 20, y: 40 }, 800, 600)).toEqual({ x: 20, y: 40 });
  });

  it('klemmt negative Werte auf 0', () => {
    expect(clampPanel({ x: -5, y: -10 }, 800, 600)).toEqual({ x: 0, y: 0 });
  });

  it('klemmt Werte am rechten/unteren Rand (Griff bleibt erreichbar)', () => {
    const res = clampPanel({ x: 900, y: 700 }, 800, 600);
    expect(res.x).toBe(760); // 800 - 40
    expect(res.y).toBe(570); // 600 - 30
  });

  it('liefert bei kleinem Viewport immer gültige Werte', () => {
    const res = clampPanel({ x: 100, y: 100 }, 20, 10);
    expect(res.x).toBe(0);
    expect(res.y).toBe(0);
  });
});
