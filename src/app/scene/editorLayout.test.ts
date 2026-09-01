import { describe, expect, it } from 'vitest';
import { layoutEditorGaenge, polygonCenter, wallSegments } from './editorLayout';
import type { EditorGang } from '../../shared/editor';

function regal(id: string, breite: number, hoehe: number, tiefe: number, ebenen = 3) {
  return { id, ebenen, plaetzeProEbene: 4, breite, hoehe, tiefe };
}

describe('layoutEditorGaenge', () => {
  it('stellt Regale einer Reihe fortlaufend ohne Überlappung nebeneinander', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 2, 1), regal('b', 3, 2, 1)] }],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const a = placements.find((p) => p.regalId === 'a')!;
    const b = placements.find((p) => p.regalId === 'b')!;
    expect(a.position[0]).toBe(1); // Mitte von [0,2]
    expect(b.position[0]).toBe(3.5); // Mitte von [2,5]
  });

  it('setzt rotationY aus der Reihen-Drehung (Grad → Radiant), ohne die Position zu verändern', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 2, 1)], rotation: 90 }],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const ohneRotation = layoutEditorGaenge([{ ...gaenge[0]!, reihen: [{ ...gaenge[0]!.reihen[0]!, rotation: undefined }] }]);
    expect(placements[0]!.rotationY).toBeCloseTo(Math.PI / 2);
    expect(placements[0]!.position).toEqual(ohneRotation[0]!.position);
    expect(ohneRotation[0]!.rotationY).toBe(0);
  });

  it('reicht die Gang-Nummer (für die Ebenen-Anzeige im Inspector) an jedes Regal der Placements durch', () => {
    const gaenge: EditorGang[] = [
      { id: 'g1', nummer: 3, breite: 3, reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 2, 1)] }] },
    ];
    const placements = layoutEditorGaenge(gaenge);
    expect(placements[0]!.gangNummer).toBe(3);
  });

  it('spiegelt Reihe "links" und "rechts" symmetrisch um die Gangmitte, je nach Regaltiefe', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 4,
        reihen: [
          { id: 'links', seite: 'links', regale: [regal('a', 2, 2, 1)] },
          { id: 'rechts', seite: 'rechts', regale: [regal('b', 2, 2, 1.5)] },
        ],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const links = placements.find((p) => p.regalId === 'a')!;
    const rechts = placements.find((p) => p.regalId === 'b')!;
    expect(links.position[2]).toBe(-(4 / 2 + 1 / 2));
    expect(rechts.position[2]).toBe(4 / 2 + 1.5 / 2);
  });

  it('setzt den zweiten Gang erst nach Breite + Abstand des ersten Gangs fort', () => {
    const gaenge: EditorGang[] = [
      { id: 'g1', nummer: 1, breite: 3, reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 5, 2, 1)] }] },
      { id: 'g2', nummer: 2, breite: 3, reihen: [{ id: 'r2', seite: 'links', regale: [regal('b', 5, 2, 1)] }] },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const b = placements.find((p) => p.regalId === 'b')!;
    expect(b.position[0]).toBe(5 + 3 + 5 / 2); // erster Gang (Breite 5) + Abstand (3) + halbe Breite von b
  });

  it('kommt ohne Absturz aus, wenn eine Reihe leer ist', () => {
    const gaenge: EditorGang[] = [{ id: 'g1', nummer: 1, breite: 3, reihen: [{ id: 'r1', seite: 'links', regale: [] }] }];
    expect(layoutEditorGaenge(gaenge)).toEqual([]);
  });

  it('verschiebt alle Regale einer Reihe gemeinsam um deren Versatz', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 2, 1), regal('b', 3, 2, 1)], versatz: { x: 1, z: 0.5 } }],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const ohneVersatz = layoutEditorGaenge([{ ...gaenge[0]!, reihen: [{ ...gaenge[0]!.reihen[0]!, versatz: undefined }] }]);
    const a = placements.find((p) => p.regalId === 'a')!;
    const aOhne = ohneVersatz.find((p) => p.regalId === 'a')!;
    const b = placements.find((p) => p.regalId === 'b')!;
    const bOhne = ohneVersatz.find((p) => p.regalId === 'b')!;
    expect(a.position[0]).toBe(aOhne.position[0] + 1);
    expect(a.position[2]).toBe(aOhne.position[2] + 0.5);
    expect(b.position[0]).toBe(bOhne.position[0] + 1);
    expect(b.position[2]).toBe(bOhne.position[2] + 0.5);
  });

  it('addiert Reihen- und Regal-Versatz statt sich gegenseitig zu überschreiben', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [
          { id: 'r1', seite: 'links', regale: [{ ...regal('a', 2, 2, 1), versatz: { x: 0.3, z: 0 } }], versatz: { x: 1, z: 0 } },
        ],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const ohneVersatz = layoutEditorGaenge([
      { id: 'g1', nummer: 1, breite: 3, reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 2, 1)] }] },
    ]);
    const a = placements.find((p) => p.regalId === 'a')!;
    const aOhne = ohneVersatz.find((p) => p.regalId === 'a')!;
    expect(a.position[0]).toBe(aOhne.position[0] + 1.3);
  });
});

describe('wallSegments', () => {
  it('erzeugt ein Segment je Kante eines geschlossenen Polygons', () => {
    const segs = wallSegments([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 6 }, { x: 0, z: 6 }], 3);
    expect(segs).toHaveLength(4);
    expect(segs[0]!.length).toBe(10);
    expect(segs[0]!.position).toEqual([5, 1.5, 0]);
  });

  it('überspringt entartete (doppelte) Punkte statt eines Nulllängen-Segments', () => {
    const segs = wallSegments([{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 10, z: 0 }], 3);
    expect(segs.every((s) => s.length > 0)).toBe(true);
  });
});

describe('polygonCenter', () => {
  it('berechnet den Mittelpunkt aus dem Durchschnitt der Eckpunkte', () => {
    expect(polygonCenter([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }])).toEqual({ x: 5, z: 5 });
  });

  it('liefert {0,0} für ein leeres Polygon', () => {
    expect(polygonCenter([])).toEqual({ x: 0, z: 0 });
  });
});
