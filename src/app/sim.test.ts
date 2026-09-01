import { describe, expect, it } from 'vitest';
import type { LagerDaten } from '../shared/types';
import { nextIntervalMs, randomBuchung, SIM_MAX_MS, SIM_MIN_MS, SIM_TS_SPREAD_MS } from './sim';

const DATEN: LagerDaten = {
  mandant: 7,
  lagerorte: [
    {
      lagerkennung: 'A',
      bezeichnung: 'Lager A',
      lagertechnik: 'LTD',
      dims: { d1: 1, d2: 1, d3: 1 },
      plaetze: [
        { platzId: 101, dim: { d1: 1, d2: 1, d3: 1 }, ebene: 0, kurz: 'A-01', platzbezeichnung: '', masse: { hoehe: 1, breite: 1, laenge: 1 }, maxGewicht: 0, bestaende: [{ artikelnummer: 'ART-1', bezeichnung1: '', matchcode: '', bestand: 5, verfuegbarkeit: 5, gewicht: 0 }] },
        { platzId: 102, dim: { d1: 1, d2: 1, d3: 1 }, ebene: 0, kurz: 'A-02', platzbezeichnung: '', masse: { hoehe: 1, breite: 1, laenge: 1 }, maxGewicht: 0, bestaende: [] },
      ],
    },
    {
      lagerkennung: 'B',
      bezeichnung: 'Lager B',
      lagertechnik: 'LTD',
      dims: { d1: 1, d2: 1, d3: 1 },
      plaetze: [{ platzId: 201, dim: { d1: 1, d2: 1, d3: 1 }, ebene: 0, kurz: 'B-01', platzbezeichnung: '', masse: { hoehe: 1, breite: 1, laenge: 1 }, maxGewicht: 0, bestaende: [] }],
    },
  ],
};

describe('randomBuchung', () => {
  it('liefert Plätze, die im Lager existieren, und eine positive Menge', () => {
    for (let i = 0; i < 100; i++) {
      const b = randomBuchung(DATEN);
      const ids = new Set([101, 102, 201]);
      expect(ids.has(b.herkunftPlatzId!)).toBe(true);
      expect(ids.has(b.zielPlatzId!)).toBe(true);
      expect(b.herkunftPlatzId).not.toBe(b.zielPlatzId);
      expect(b.menge).toBeGreaterThan(0);
    }
  });

  it('übernimmt Mandant, Bewegung, Quelle und Artikelnummer aus dem Bestand', () => {
    const b = randomBuchung(DATEN);
    expect(b.mandant).toBe(7);
    expect(b.bewegung).toBe('SIM-UMLAGERUNG');
    expect(b.quelle).toBe('sim');
    expect(['ART-1', 'SIM-ARTIKEL']).toContain(b.artikelnummer);
  });

  it('setzt die lagerkennung passend zu den gewählten platzIds', () => {
    for (let i = 0; i < 100; i++) {
      const b = randomBuchung(DATEN);
      const herkunftOrt = DATEN.lagerorte.find((o) => o.plaetze.some((p) => p.platzId === b.herkunftPlatzId));
      const zielOrt = DATEN.lagerorte.find((o) => o.plaetze.some((p) => p.platzId === b.zielPlatzId));
      expect(b.herkunftLager).toBe(herkunftOrt!.lagerkennung);
      expect(b.zielLager).toBe(zielOrt!.lagerkennung);
    }
  });

  it('setzt den Zeitpunkt auf jetzt ± 60 Minuten', () => {
    const now = 1_000_000;
    for (let i = 0; i < 100; i++) {
      const b = randomBuchung(DATEN, now);
      expect(b.ts).toBeGreaterThanOrEqual(now - SIM_TS_SPREAD_MS);
      expect(b.ts).toBeLessThanOrEqual(now + SIM_TS_SPREAD_MS);
    }
  });
});

describe('nextIntervalMs', () => {
  it('liefert Werte zwischen min und max', () => {
    for (let i = 0; i < 100; i++) {
      const v = nextIntervalMs();
      expect(v).toBeGreaterThanOrEqual(SIM_MIN_MS);
      expect(v).toBeLessThan(SIM_MAX_MS);
    }
  });
});
