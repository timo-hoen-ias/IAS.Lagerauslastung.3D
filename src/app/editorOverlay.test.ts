import { describe, expect, it } from 'vitest';
import { buildEditorOverlay, stageEditorOverlays, type EditorLagerOverlay } from './editorOverlay';
import type { EditorGang } from '../shared/editor';
import type { Lagerort, Lagerplatz } from '../shared/types';

function regal(id: string, ebenen: number, plaetzeProEbene: number) {
  return { id, ebenen, plaetzeProEbene, breite: 1, hoehe: 1, tiefe: 1 };
}

function platz(d1: number, d2: number, d3: number): Lagerplatz {
  return {
    platzId: d1 * 1000 + d2 * 100 + d3,
    dim: { d1, d2, d3 },
    ebene: d2,
    kurz: `${d1}-${d2}-${d3}`,
    platzbezeichnung: '',
    masse: { hoehe: 0, breite: 0, laenge: 0 },
    maxGewicht: 0,
    bestaende: [],
  };
}

const gaenge: EditorGang[] = [
  { id: 'g1', nummer: 1, breite: 3, reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 2)] }] },
];

describe('buildEditorOverlay', () => {
  it('ordnet passende Sage-Plätze per Dim1/2/3 der jeweiligen Zelle (Ebene×Spalte) zu', () => {
    const ort: Lagerort = {
      lagerkennung: 'L-F-H',
      bezeichnung: 'Halle 1',
      lagertechnik: 'LTD1UF',
      dims: { d1: 1, d2: 2, d3: 2 },
      plaetze: [platz(1, 1, 1), platz(1, 2, 1), platz(1, 1, 2), platz(9, 9, 9)],
    };
    const overlay = buildEditorOverlay({ id: 'x', name: 'Test', lagerkennung: 'L-F-H', grundriss: [], gaenge }, ort);
    expect(overlay.regale).toHaveLength(1);
    // regal 'a' hat 2 Ebenen × 2 Plätze = 4 Zellen, alle bis auf eine (Ebene 2, Spalte 2) finden einen echten Platz.
    expect(overlay.regale[0]!.zellen).toHaveLength(4);
    const gefunden = overlay.regale[0]!.zellen.filter((z) => z.platz).map((z) => z.platz!.platzId).sort();
    expect(gefunden).toEqual([1101, 1102, 1201]);
    expect(overlay.regale[0]!.zellen.find((z) => z.ebene === 2 && z.spalte === 2)?.platz).toBeUndefined();
  });

  it('liefert alle Zellen ohne `platz`, wenn kein echter Lagerort existiert (nur Layout-Kontrolle)', () => {
    const overlay = buildEditorOverlay({ id: 'x', name: 'Test', lagerkennung: 'L-F-H', grundriss: [], gaenge }, undefined);
    expect(overlay.regale[0]!.zellen).toHaveLength(4);
    expect(overlay.regale[0]!.zellen.every((z) => z.platz === undefined)).toBe(true);
  });
});

describe('stageEditorOverlays', () => {
  function overlay(id: string, breite: number): EditorLagerOverlay {
    return { id, name: id, lagerkennung: id, grundriss: [{ x: 0, z: 0 }, { x: breite, z: 0 }, { x: breite, z: 10 }, { x: 0, z: 10 }], regale: [] };
  }

  it('reiht mehrere Overlays lückenlos nach breite hintereinander auf, ab startX + Puffer', () => {
    const [a, b] = stageEditorOverlays([overlay('a', 20), overlay('b', 10)], 100);
    expect(a!.offset.x).toBe(108); // 100 + 8 Puffer, minX=0
    expect(b!.offset.x).toBe(108 + 20 + 8);
  });

  it('liefert eine leere Liste für keine Overlays', () => {
    expect(stageEditorOverlays([], 0)).toEqual([]);
  });
});
