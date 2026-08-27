import { describe, expect, it } from 'vitest';
import { clampPanelTo } from './usePanelPos';

describe('clampPanelTo', () => {
  it('lässt Positionen im Viewport unverändert', () => {
    expect(clampPanelTo({ x: 20, y: 40 }, 800, 600, 300, 120)).toEqual({ x: 20, y: 40 });
  });

  it('klemmt negative Werte auf 0', () => {
    expect(clampPanelTo({ x: -5, y: -10 }, 800, 600, 300, 120)).toEqual({ x: 0, y: 0 });
  });

  it('hält das ganze Panel im Viewport (rechte/untere Kante)', () => {
    const res = clampPanelTo({ x: 900, y: 700 }, 800, 600, 300, 120);
    expect(res.x).toBe(500); // 800 - 300
    expect(res.y).toBe(480); // 600 - 120
  });

  it('liefert bei Panel größer als Viewport immer 0', () => {
    const res = clampPanelTo({ x: 100, y: 100 }, 20, 10, 300, 120);
    expect(res.x).toBe(0);
    expect(res.y).toBe(0);
  });
});
