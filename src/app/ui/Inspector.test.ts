import { describe, expect, it } from 'vitest';
import type { Lagerort } from '../../shared/types';
import { ortRows, platzRows } from './Inspector';

const ort = (plaetze: Lagerort['plaetze']): Lagerort => ({
  lagerkennung: 'L1',
  bezeichnung: 'Lager 1',
  lagertechnik: 'LTD3HR',
  dims: { d1: 2, d2: 1, d3: 2 },
  plaetze,
});

const platz = (platzId: number, kurz: string, bestaende: { artikel: string; bestand: number }[]) => ({
  platzId,
  dim: { d1: 1, d2: 1, d3: 1 },
  ebene: 0,
  kurz,
  platzbezeichnung: kurz,
  masse: { hoehe: 0, breite: 0, laenge: 0 },
  maxGewicht: 0,
  bestaende: bestaende.map((b) => ({ artikelnummer: b.artikel, bezeichnung1: `Art ${b.artikel}`, matchcode: '', bestand: b.bestand, verfuegbarkeit: b.bestand, gewicht: 0 })),
});

describe('ortRows', () => {
  it('flacht belegte Plätze zu Zeilen ab und sortiert nach Platz/Artikel', () => {
    const rows = ortRows(
      ort([
        platz(2, 'B', [{ artikel: '3001', bestand: 5 }]),
        platz(1, 'A', [
          { artikel: '2001', bestand: 10 },
          { artikel: '1001', bestand: 3 },
        ]),
        platz(3, 'C', []),
      ]),
    );
    expect(rows.map((r) => [r.platz, r.artikel, r.bestand])).toEqual([
      ['A', '1001', 3],
      ['A', '2001', 10],
      ['B', '3001', 5],
    ]);
  });

  it('überspringt leere Plätze und nutzt platzId als Fallback-Kennung', () => {
    const rows = ortRows(ort([platz(7, '', [{ artikel: 'X1', bestand: 2 }]), platz(9, 'D', [])]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ platzId: 7, platz: '#7', artikel: 'X1', bestand: 2 });
  });
});

describe('platzRows', () => {
  it('sortiert Bestände alphabetisch nach Artikelnummer und übernimmt alle Felder', () => {
    const rows = platzRows({
      platzId: 1,
      dim: { d1: 1, d2: 1, d3: 1 },
      ebene: 2,
      kurz: 'A-01',
      platzbezeichnung: 'A-01',
      masse: { hoehe: 60, breite: 80, laenge: 120 },
      maxGewicht: 500,
      bestaende: [
        { artikelnummer: '3001', bezeichnung1: 'Art 3001', matchcode: 'M3', bestand: 5, verfuegbarkeit: 2, gewicht: 10 },
        { artikelnummer: '1001', bezeichnung1: 'Art 1001', matchcode: 'M1', bestand: 3, verfuegbarkeit: 3, gewicht: 2 },
      ],
    });
    expect(rows.map((r) => [r.artikelnummer, r.matchcode, r.bestand, r.verfuegbarkeit])).toEqual([
      ['1001', 'M1', 3, 3],
      ['3001', 'M3', 5, 2],
    ]);
  });

  it('liefert leere Liste bei Platz ohne Bestände', () => {
    expect(platzRows({ ...platz(1, 'A', []), bestaende: [] })).toEqual([]);
  });
});
