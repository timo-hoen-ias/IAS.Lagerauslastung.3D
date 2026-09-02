import { describe, expect, it } from 'vitest';
import type { BuchungEvent } from '../shared/types';
import { heatmapBuchungen, insertBuchung, openDb, type HeatmapErgebnis } from './buchungenDb';

const evt = (over: Partial<BuchungEvent>): BuchungEvent => ({
  mandant: 1,
  artikelnummer: 'A1',
  menge: 2,
  bewegung: 'Umlagerung',
  herkunftPlatzId: 10,
  zielPlatzId: null,
  herkunftCarrierId: null,
  zielCarrierId: null,
  typ: 1,
  benutzer: 'sim',
  herkunftLager: 'PERF-001',
  zielLager: null,
  quelle: 'sim',
  ts: 1_000_000,
  ...over,
});

function seed(): ReturnType<typeof openDb> {
  const db = openDb(':memory:');
  insertBuchung(db, evt({ ts: 1000, herkunftPlatzId: 1, zielPlatzId: 2 }));
  insertBuchung(db, evt({ ts: 2000, herkunftPlatzId: 2, zielPlatzId: 3, artikelnummer: 'B2' }));
  insertBuchung(db, evt({ ts: 3000, herkunftPlatzId: 3, zielPlatzId: 1 }));
  insertBuchung(db, evt({ ts: 5000, herkunftPlatzId: 99, zielPlatzId: null, mandant: 2 }));
  return db;
}

describe('insertBuchung', () => {
  it('persistiert alle relevanten Felder inkl. ts und lager', () => {
    const db = openDb(':memory:');
    insertBuchung(db, evt({ ts: 42, herkunftLager: 'PERF-001', zielLager: 'PERF-002' }));
    const row = db.query('SELECT * FROM buchungen').get() as Record<string, unknown>;
    expect(row.ts).toBe(42);
    expect(row.herkunftLager).toBe('PERF-001');
    expect(row.zielLager).toBe('PERF-002');
    expect(row.herkunftPlatzId).toBe(10);
    expect(row.quelle).toBe('sim');
    expect(row.artikelnummer).toBe('A1');
  });
});

describe('heatmapBuchungen', () => {
  const run = (from: number, to: number, mandant?: number): HeatmapErgebnis => heatmapBuchungen(seed(), from, to, mandant);

  it('zählt Herkunft und Ziel je Platz (UNION)', () => {
    const r = run(0, 10_000);
    const by = new Map(r.points.map((p) => [p.platzId, p.n]));
    expect(by.get(1)).toBe(2); // 2× Ziel (aus 1->2, 3->1) + 1× Herkunft (3->1)
    expect(by.get(2)).toBe(2);
    expect(by.get(3)).toBe(2);
    expect(by.has(99)).toBe(true);
  });

  it('begrenzt auf den Zeitraum (inklusive Grenzen)', () => {
    const r = run(1000, 3000);
    const ids = r.points.map((p) => p.platzId).sort();
    expect(ids).toEqual([1, 2, 3]);
  });

  it('filtert nach Mandant', () => {
    const r = run(0, 10_000, 1);
    expect(r.points.some((p) => p.platzId === 99)).toBe(false);
    const r2 = run(0, 10_000, 2);
    expect(r2.points.map((p) => p.platzId)).toEqual([99]);
  });

  it('liefert die Top-Artikel des Zeitraums', () => {
    const r = run(0, 10_000, 1);
    const a1 = r.byArtikel.find((a) => a.artikelnummer === 'A1');
    expect(a1?.n).toBe(2);
  });
});
