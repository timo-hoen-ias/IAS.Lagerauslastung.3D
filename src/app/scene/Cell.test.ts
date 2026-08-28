import { describe, expect, it } from 'vitest';
import type { Lagerbestand } from '../../shared/types';
import { bestandAnteile, boxLabel, fmtBestand, kistenFarbe, labelFontSize, labelVertical } from './Cell';

const b = (artikelnummer: string, bestand: number, matchcode = ''): Lagerbestand => ({
  artikelnummer,
  bezeichnung1: '',
  matchcode,
  bestand,
  verfuegbarkeit: bestand,
  gewicht: 1,
});

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
