import { describe, expect, it } from 'vitest';
import type { Lagerplatz } from '../shared/types';
import { fmtKg, ortGewicht, ortMaxGewicht, ortÜberlastet, plaetzeGewicht, plaetzeMaxGewicht, platzGewicht, platzÜberlastet } from './gew';

const platz = (bestaende: { bestand: number; gewicht: number }[], maxGewicht: number): Lagerplatz => ({
  platzId: 1,
  dim: { d1: 1, d2: 1, d3: 1 },
  ebene: 0,
  kurz: '',
  platzbezeichnung: '',
  masse: { hoehe: 0, breite: 0, laenge: 0 },
  maxGewicht,
  bestaende: bestaende.map((b, i) => ({
    artikelnummer: `A${i}`,
    bezeichnung1: '',
    matchcode: '',
    bestand: b.bestand,
    verfuegbarkeit: b.bestand,
    gewicht: b.gewicht,
    einheit: '',
  })),
});

const ort = (plaetze: Lagerplatz[]) => ({
  lagerkennung: 'X',
  bezeichnung: '',
  lagertechnik: 'LTD3HR',
  dims: { d1: 1, d2: 1, d3: 1 },
  plaetze,
});

describe('Gewicht', () => {
  it('platzGewicht = Σ Bestand × Gewicht', () => {
    expect(platzGewicht(platz([{ bestand: 50, gewicht: 0.5 }, { bestand: 5, gewicht: 3 }], 0))).toBe(40);
  });

  it('platzÜberlastet nur wenn maxGewicht > 0 und überschritten', () => {
    expect(platzÜberlastet(platz([{ bestand: 100, gewicht: 1 }], 50))).toBe(true);
    expect(platzÜberlastet(platz([{ bestand: 100, gewicht: 1 }], 200))).toBe(false);
    expect(platzÜberlastet(platz([{ bestand: 100, gewicht: 1 }], 0))).toBe(false);
  });

  it('ortGewicht/ortMaxGewicht summieren über alle Plätze', () => {
    const o = ort([platz([{ bestand: 10, gewicht: 2 }], 100), platz([{ bestand: 5, gewicht: 4 }], 50)]);
    expect(ortGewicht(o)).toBe(40);
    expect(ortMaxGewicht(o)).toBe(150);
    expect(ortÜberlastet(o)).toBe(false);
  });

  it('plaetzeGewicht/plaetzeMaxGewicht summieren über eine beliebige Teilmenge (z. B. ein Regal)', () => {
    const plaetze = [platz([{ bestand: 10, gewicht: 2 }], 100), platz([{ bestand: 5, gewicht: 4 }], 50)];
    expect(plaetzeGewicht(plaetze)).toBe(40);
    expect(plaetzeMaxGewicht(plaetze)).toBe(150);
    expect(plaetzeGewicht([])).toBe(0);
    expect(plaetzeMaxGewicht([])).toBe(0);
  });

  it('fmtKg mit einer Dezimalstelle', () => {
    expect(fmtKg(12.34)).toBe('12,3 kg');
    expect(fmtKg(1500)).toBe('1.500 kg');
  });
});
