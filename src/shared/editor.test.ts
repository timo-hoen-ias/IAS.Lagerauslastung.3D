import { describe, expect, it } from 'vitest';
import { deriveEditorPlaetze, ebenenHoehen, regalDim3Bereiche, regalHoehe, rotateReihe, type EditorGang } from './editor';

/** Baut ein Regal-Kurzform-Objekt für die Tests. */
function regal(id: string, ebenen: number, plaetzeProEbene: number) {
  return { id, ebenen, plaetzeProEbene, breite: 1, tiefe: 1 };
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

describe('rotateReihe', () => {
  it('dreht undefinierte Ausgangsrotation ausgehend von 0°', () => {
    expect(rotateReihe(undefined, 90)).toBe(90);
  });

  it('normalisiert auf [0,360), auch rückwärts über 0° hinaus', () => {
    expect(rotateReihe(0, -90)).toBe(270);
    expect(rotateReihe(270, 90)).toBe(0);
    expect(rotateReihe(270, 180)).toBe(90);
  });
});

describe('ebenenHoehen', () => {
  it('füllt mit der Default-Höhe auf, wenn keine eigenen Ebenenhöhen gesetzt sind', () => {
    expect(ebenenHoehen({ ebenen: 3, ebenenHoehen: undefined })).toEqual([0.6, 0.6, 0.6]);
  });

  it('nutzt gesetzte Ebenenhöhen, wenn die Länge zu ebenen passt', () => {
    expect(ebenenHoehen({ ebenen: 3, ebenenHoehen: [1.5, 0.8, 0.7] })).toEqual([1.5, 0.8, 0.7]);
  });

  it('kappt überzählige Ebenenhöhen, wenn ebenen verringert wurde', () => {
    expect(ebenenHoehen({ ebenen: 2, ebenenHoehen: [1, 1.2, 1.4] })).toEqual([1, 1.2]);
  });

  it('füllt fehlende Ebenenhöhen mit dem letzten vorhandenen Wert auf, wenn ebenen erhöht wurde', () => {
    expect(ebenenHoehen({ ebenen: 4, ebenenHoehen: [1, 1.2] })).toEqual([1, 1.2, 1.2, 1.2]);
  });
});

describe('regalHoehe', () => {
  it('summiert die Ebenenhöhen', () => {
    expect(regalHoehe({ ebenen: 3, ebenenHoehen: [0.5, 0.6, 0.7] })).toBeCloseTo(1.8, 6);
  });

  it('nutzt die Default-Höhe, wenn keine Ebenenhöhen gesetzt sind', () => {
    expect(regalHoehe({ ebenen: 2, ebenenHoehen: undefined })).toBeCloseTo(1.2, 6);
  });
});

describe('regalDim3Bereiche', () => {
  it('liefert für jedes Regal die Dim3-Spannbreite, fortlaufend über die Reihen eines Gangs', () => {
    const gang: EditorGang = {
      id: 'g1',
      nummer: 1,
      breite: 3,
      reihen: [
        { id: 'links', seite: 'links', regale: [regal('a', 3, 4), regal('b', 3, 4)] },
        { id: 'rechts', seite: 'rechts', regale: [regal('c', 3, 4)] },
      ],
    };
    expect(regalDim3Bereiche(gang)).toEqual([
      { regalId: 'a', von: 1, bis: 4 },
      { regalId: 'b', von: 5, bis: 8 },
      { regalId: 'c', von: 9, bis: 12 },
    ]);
  });

  it('deckt sich mit den Dim3-Werten aus deriveEditorPlaetze', () => {
    const gang: EditorGang = {
      id: 'g1',
      nummer: 1,
      breite: 3,
      reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 4), regal('b', 2, 4)] }],
    };
    const bereiche = regalDim3Bereiche(gang);
    const plaetze = deriveEditorPlaetze({ lagerkennung: 'X', gaenge: [gang] });
    for (const b of bereiche) {
      const dim3Werte = plaetze.filter((p) => p.regalId === b.regalId).map((p) => p.dim3);
      expect(Math.min(...dim3Werte)).toBe(b.von);
      expect(Math.max(...dim3Werte)).toBe(b.bis);
    }
  });
});
