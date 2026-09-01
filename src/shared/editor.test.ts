import { describe, expect, it } from 'vitest';
import { deriveEditorPlaetze, type EditorGang } from './editor';

/** Baut ein Regal-Kurzform-Objekt für die Tests. */
function regal(id: string, ebenen: number, plaetzeProEbene: number) {
  return { id, ebenen, plaetzeProEbene, breite: 1, hoehe: 1, tiefe: 1 };
}

describe('deriveEditorPlaetze', () => {
  it('zählt Dim3 fortlaufend über mehrere Regale mit unterschiedlicher Ebenenzahl in einer Reihe', () => {
    // 4 Regale mit 3 Ebenen × 4 Plätze, danach 3 Regale mit 4 Ebenen × 4 Plätze → 28 Spalten, 96 Plätze.
    const gang: EditorGang = {
      id: 'g1',
      nummer: 1,
      breite: 3,
      reihen: [
        {
          id: 'r1',
          seite: 'links',
          regale: [
            regal('a', 3, 4),
            regal('b', 3, 4),
            regal('c', 3, 4),
            regal('d', 3, 4),
            regal('e', 4, 4),
            regal('f', 4, 4),
            regal('g', 4, 4),
          ],
        },
      ],
    };
    const plaetze = deriveEditorPlaetze({ lagerkennung: 'L-F-H', gaenge: [gang] });

    expect(plaetze).toHaveLength(48 + 48);
    expect(Math.max(...plaetze.map((p) => p.dim3))).toBe(28);

    const ersterPlatz = plaetze.find((p) => p.regalId === 'a' && p.spalte === 1 && p.ebene === 1)!;
    expect(ersterPlatz.code).toBe('L-F-H;1;1;1');

    const letzteSpalteAlleEbenen = plaetze.filter((p) => p.dim3 === 28);
    expect(letzteSpalteAlleEbenen.map((p) => p.dim2).sort()).toEqual([1, 2, 3, 4]);
  });

  it('setzt Dim3 zwischen den beiden Regalreihen eines Gangs nicht zurück', () => {
    const gang: EditorGang = {
      id: 'g1',
      nummer: 1,
      breite: 3,
      reihen: [
        { id: 'links', seite: 'links', regale: [regal('a', 4, 4), regal('b', 4, 4), regal('c', 4, 4), regal('d', 4, 4), regal('e', 4, 4), regal('f', 4, 4), regal('g', 4, 4)] },
        { id: 'rechts', seite: 'rechts', regale: [regal('h', 4, 4), regal('i', 4, 4), regal('j', 4, 4), regal('k', 4, 4), regal('l', 4, 4), regal('m', 4, 4), regal('n', 4, 4)] },
      ],
    };
    const plaetze = deriveEditorPlaetze({ lagerkennung: 'L-F-H', gaenge: [gang] });

    const letzterLinks = plaetze.find((p) => p.reiheId === 'links' && p.dim3 === 28);
    expect(letzterLinks).toBeDefined();
    const ersterRechts = plaetze.find((p) => p.reiheId === 'rechts' && p.spalte === 1 && p.ebene === 1)!;
    expect(ersterRechts.dim3).toBe(29);
    expect(ersterRechts.code).toBe('L-F-H;1;1;29');
    const letzterRechts = plaetze.filter((p) => p.reiheId === 'rechts').reduce((max, p) => Math.max(max, p.dim3), 0);
    expect(letzterRechts).toBe(56);
  });

  it('setzt Dim3 bei einem neuen Gang wieder auf 1 zurück', () => {
    const gaenge: EditorGang[] = [
      { id: 'g1', nummer: 1, breite: 3, reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 4)] }] },
      { id: 'g2', nummer: 2, breite: 3, reihen: [{ id: 'r2', seite: 'links', regale: [regal('b', 2, 4)] }] },
    ];
    const plaetze = deriveEditorPlaetze({ lagerkennung: 'L-F-H', gaenge });

    const ersterGang2 = plaetze.find((p) => p.gangId === 'g2' && p.spalte === 1 && p.ebene === 1)!;
    expect(ersterGang2.dim1).toBe(2);
    expect(ersterGang2.dim3).toBe(1);
    expect(ersterGang2.code).toBe('L-F-H;2;1;1');
  });
});
