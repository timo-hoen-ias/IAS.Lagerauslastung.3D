import { describe, expect, it } from 'vitest';
import type { Lagerort } from '../../shared/types';
import { ortRows } from './Inspector';

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
