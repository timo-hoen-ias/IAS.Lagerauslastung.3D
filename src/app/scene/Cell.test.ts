import { describe, expect, it } from 'vitest';
import type { Lagerbestand, Lagerplatz } from '../../shared/types';
import { DEFAULT_STOCK_ANZEIGE } from '../../shared/anzeige';
import { bestandAnteile, boxLabel, cellSegments, fmtBestand, kistenFarbe, labelFontSize, labelVertical } from './Cell';
import { BASE_H, SLOT } from './layout';

const b = (artikelnummer: string, bestand: number, matchcode = '', einheit = ''): Lagerbestand => ({
  artikelnummer,
  bezeichnung1: '',
  matchcode,
  bestand,
  verfuegbarkeit: bestand,
  gewicht: 1,
  einheit,
});

const p = (platzId: number, dim: { d1: number; d2: number; d3: number }, bestaende: Lagerbestand[]): Lagerplatz => ({
  platzId,
  dim,
  ebene: 0,
  kurz: '',
  platzbezeichnung: '',
  masse: { hoehe: 0, breite: 0, laenge: 0 },
  maxGewicht: 0,
  bestaende,
});

// 3D-Hochregal: 1×2×5 (cols/levels/depth), wie bei KÜHL-HR01 pro Gang.
const rack = { cols: 1, levels: 2, depth: 5, flat: false, cellH: 0.6, kind: 'rack' as const, gang: 0 };

describe('bestandAnteile', () => {
  it('50/50 ergibt zwei gleich große Kisten', () => {
    const a = bestandAnteile([b('HAMMER', 50), b('ZANGE', 50)]);
    expect(a.map((x) => x.anteil)).toEqual([0.5, 0.5]);
  });

  it('summiert Anteile auf 1', () => {
    const a = bestandAnteile([b('A', 10), b('B', 30), b('C', 60)]);
    expect(a.reduce((s, x) => s + x.anteil, 0)).toBeCloseTo(1, 5);
  });

  it('überspringt Artikel mit Bestand 0', () => {
    const a = bestandAnteile([b('A', 0), b('B', 5)]);
    expect(a).toHaveLength(1);
    expect(a[0]!.anteil).toBe(1);
  });

  it('liefert leer für leeren Platz', () => {
    expect(bestandAnteile([])).toEqual([]);
  });

  it('kappt bei mehr als maxKisten und fasst Rest als … zusammen', () => {
    const a = bestandAnteile([b('A', 10), b('B', 10), b('C', 10), b('D', 10), b('E', 10), b('F', 10), b('G', 10)], 6);
    expect(a).toHaveLength(6);
    expect(a[5]!.artikel).toBe('…');
    expect(a[5]!.bestand).toBe(20);
  });
});

describe('kistenFarbe', () => {
  it('liefert für aufeinanderfolgende Indizes unterschiedliche Farben', () => {
    const farben = new Set(Array.from({ length: 8 }, (_, i) => kistenFarbe(i)));
    expect(farben.size).toBe(8);
  });
});

describe('boxLabel', () => {
  it('formatiert Artikelnummer / Name / Anzahl je Zeile', () => {
    expect(boxLabel('00001031', 'Tischplatte (Mengenformel)', 42)).toBe('00001031\nTischplatte (Mengenformel)\n42');
  });

  it('kürzt dezimale Bestände auf 2 Nachkommastellen', () => {
    expect(boxLabel('00250012', 'Antennenkabel', 42.9)).toBe('00250012\nAntennenkabel\n42.9');
    expect(boxLabel('00250012', 'Antennenkabel', 42.333)).toBe('00250012\nAntennenkabel\n42.33');
    expect(boxLabel('00250012', 'Antennenkabel', 0.12)).toBe('00250012\nAntennenkabel\n0.12');
  });
});

describe('fmtBestand', () => {
  it('formatiert ganzzahlig und dezimal kompakt', () => {
    expect(fmtBestand(250)).toBe('250');
    expect(fmtBestand(4726)).toBe('4726');
    expect(fmtBestand(42.333)).toBe('42.33');
  });
});

describe('labelVertical', () => {
  it('dreht hochkante Boxen um 90°', () => {
    expect(labelVertical(0.95, 2.0)).toBe(true);
  });

  it('dreht zu schmale Boxen um 90°', () => {
    expect(labelVertical(0.3, 0.5)).toBe(true);
  });

  it('lässt breite, flache Boxen horizontal', () => {
    expect(labelVertical(0.95, 0.5)).toBe(false);
    expect(labelVertical(0.9, 0.6)).toBe(false);
  });

  it('respektiert eine eigene Mindestbreite', () => {
    expect(labelVertical(0.6, 0.5, 0.65)).toBe(true);
    expect(labelVertical(0.6, 0.5, 0.5)).toBe(false);
  });
});

describe('labelFontSize', () => {
  it('passt Schrift an die Gesichtsbreite an und klemmt auf den lesbaren Bereich', () => {
    expect(labelFontSize(4, 0.9)).toBeCloseTo(0.09, 3);
    expect(labelFontSize(100, 0.9)).toBe(0.035);
    expect(labelFontSize(0, 0.9)).toBe(0.09);
  });
});

describe('cellSegments', () => {
  it('Einzelbox: 1 Segment mit Bestandsfarbe und 2 Labels (±x)', () => {
    const { segs, labels } = cellSegments([p(1, { d1: 1, d2: 1, d3: 1 }, [b('HAMMER', 50)])], rack, DEFAULT_STOCK_ANZEIGE);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ index: 0, platzId: 1, empty: false, color: DEFAULT_STOCK_ANZEIGE.standardFarbe });
    expect(segs[0]!.size).toEqual([0.9, 0.6, 0.9]); // default-Maße geklemmt
    expect(labels).toHaveLength(2);
    expect(labels.map((l) => l.side)).toEqual([1, -1]);
    expect(labels[0]!.text).toBe('HAMMER\n\n50');
  });

  it('setzt die Zellposition aus dem Fachraster (Gang, Ebene 1, Fach 1)', () => {
    const { segs } = cellSegments([p(7, { d1: 1, d2: 1, d3: 1 }, [b('A', 10)])], rack, DEFAULT_STOCK_ANZEIGE);
    const [x, y, z] = segs[0]!.pos;
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(BASE_H + 0.3, 6); // Sockel + halbe Zellhöhe
    expect(z).toBeCloseTo(-2 * SLOT, 6); // 1. Fach der 5 → hinterste Reihe
  });

  it('Mehrfach-Kisten: Segment je Artikel mit Kistenfarbe, Label nur auf +x', () => {
    const { segs, labels } = cellSegments(
      [p(2, { d1: 1, d2: 1, d3: 2 }, [b('HAMMER', 50), b('ZANGE', 50)])],
      rack,
      DEFAULT_STOCK_ANZEIGE,
    );
    expect(segs).toHaveLength(2);
    expect(segs.map((s) => s.color)).toEqual([kistenFarbe(0), kistenFarbe(1)]);
    expect(segs.map((s) => s.index)).toEqual([0, 1]);
    expect(labels).toHaveLength(2);
    expect(labels.every((l) => l.side === 1)).toBe(true);
    // Segmente liegen nebeneinander auf der x-Achse (verschieden, aber mittig um 0)
    expect(segs[0]!.pos[0]).toBeLessThan(segs[1]!.pos[0]);
  });

  it('leerer Platz: transparente Instanz ohne Label', () => {
    const { segs, labels } = cellSegments([p(3, { d1: 1, d2: 1, d3: 3 }, [])], rack, DEFAULT_STOCK_ANZEIGE);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.empty).toBe(true);
    expect(labels).toHaveLength(0);
  });

  it('nutzt im Schwellen-Modus die Mengeneinheit des einzelnen Artikels für die Farbwahl', () => {
    const anzeige = { ...DEFAULT_STOCK_ANZEIGE, modus: 'schwelle' as const };
    const { segs } = cellSegments([p(1, { d1: 1, d2: 1, d3: 1 }, [b('A', 200, '', 'KG')])], rack, anzeige);
    expect(segs[0]!.color).toBe('#e67e22'); // 200 kg liegt in der 100–500-Stufe
  });

  it('indiziert Segmente fortlaufend über mehrere Plätze', () => {
    const { segs } = cellSegments(
      [p(1, { d1: 1, d2: 1, d3: 1 }, [b('A', 1)]), p(2, { d1: 1, d2: 1, d3: 2 }, [b('B', 1), b('C', 1)])],
      rack,
      DEFAULT_STOCK_ANZEIGE,
    );
    expect(segs.map((s) => s.index)).toEqual([0, 1, 2]);
  });
});
