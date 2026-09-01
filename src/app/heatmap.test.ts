import { describe, expect, it } from 'vitest';
import type { LagerDaten } from '../shared/types';
import { aggregateByLager, heatColor, heatIntensity, presetRange, type HeatmapPoint } from './heatmap';

const DATEN: LagerDaten = {
  mandant: 1,
  lagerorte: [
    { lagerkennung: 'A', bezeichnung: '', lagertechnik: '', dims: { d1: 1, d2: 1, d3: 1 }, plaetze: [
      { platzId: 1, dim: { d1: 1, d2: 1, d3: 1 }, ebene: 0, kurz: '', platzbezeichnung: '', masse: { hoehe: 1, breite: 1, laenge: 1 }, maxGewicht: 0, bestaende: [] },
      { platzId: 2, dim: { d1: 1, d2: 1, d3: 1 }, ebene: 0, kurz: '', platzbezeichnung: '', masse: { hoehe: 1, breite: 1, laenge: 1 }, maxGewicht: 0, bestaende: [] },
    ] },
    { lagerkennung: 'B', bezeichnung: '', lagertechnik: '', dims: { d1: 1, d2: 1, d3: 1 }, plaetze: [
      { platzId: 3, dim: { d1: 1, d2: 1, d3: 1 }, ebene: 0, kurz: '', platzbezeichnung: '', masse: { hoehe: 1, breite: 1, laenge: 1 }, maxGewicht: 0, bestaende: [] },
    ] },
  ],
};

describe('presetRange', () => {
  it('berechnet Fenster relativ zu now', () => {
    const now = new Date('2026-09-01T14:00:00').getTime();
    const h = presetRange('1h', now);
    expect(h.to).toBe(now);
    expect(h.from).toBe(now - 3600_000);
  });

  it('„Heute" startet um 00:00 Uhr', () => {
    const now = new Date('2026-09-01T14:00:00').getTime();
    const r = presetRange('today', now);
    expect(r.from).toBe(new Date('2026-09-01T00:00:00').getTime());
    expect(r.to).toBe(now);
  });

  it('„Gestern" deckt den Vortag komplett ab', () => {
    const now = new Date('2026-09-01T14:00:00').getTime();
    const r = presetRange('yesterday', now);
    expect(r.from).toBe(new Date('2026-08-31T00:00:00').getTime());
    expect(r.to).toBe(new Date('2026-09-01T00:00:00').getTime());
  });

  it('„Diese Woche" beginnt montags', () => {
    const now = new Date('2026-09-03T10:00:00').getTime(); // Donnerstag
    const r = presetRange('week', now);
    const montag = new Date('2026-08-31T00:00:00').getTime();
    expect(r.from).toBe(montag);
  });
});

describe('heatColor / heatIntensity', () => {
  const rgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];

  it('ist bei max=0 unsichtbar-blau und intensität 0', () => {
    expect(heatColor(5, 0)).toBe('#1e3a5f');
    expect(heatIntensity(5, 0)).toBe(0);
  });

  it('läuft von blau (kalt) nach gelb (heiß)', () => {
    const low = rgb(heatColor(1, 10));
    const high = rgb(heatColor(10, 10));
    expect(low[2]).toBeGreaterThan(low[0]); // blau-dominant
    expect(high[0]).toBeGreaterThanOrEqual(high[2]); // gelb: rot/grün hoch, blau niedrig
    expect(high[1]).toBeGreaterThan(high[2]);
    expect(heatIntensity(5, 10)).toBe(0.5);
    expect(heatIntensity(20, 10)).toBe(1);
  });

  it('farbtöne liegen auf den Rampe-Stopps', () => {
    expect(heatColor(0, 10)).toBe('#0033cc');
    expect(heatColor(10, 10)).toBe('#ffd400');
  });
});

describe('aggregateByLager', () => {
  it('summiert je Lagerort und sortiert absteigend', () => {
    const points: HeatmapPoint[] = [
      { platzId: 1, n: 2 },
      { platzId: 2, n: 3 },
      { platzId: 3, n: 4 },
      { platzId: 999, n: 9 },
    ];
    const r = aggregateByLager(points, DATEN);
    expect(r[0]).toEqual({ lager: 'Platz 999', n: 9 });
    expect(r[1]).toEqual({ lager: 'A', n: 5 });
    expect(r[2]).toEqual({ lager: 'B', n: 4 });
  });
});
