import { describe, expect, it } from 'vitest';
import { groupLagerorte, attachBestaende } from '../query';
import { layoutRacks, gangPlätze, cellLocalPosition } from '../../app/scene/layout';
import { generateLager, generateLagerDaten } from './generate';

const ORTE = 100;
const SEED = 42;
const BUDGET_MS = 2000;

describe('Performance-Testsuite: generiertes Großlager', () => {
  it('erzeugt deterministisch 100 Lagerorte mit >40.000 Plätzen', () => {
    const { platzRows, orte } = generateLager(ORTE, SEED);
    const wiederholt = generateLager(ORTE, SEED);
    expect(orte).toHaveLength(100);
    expect(platzRows.length).toBeGreaterThan(40_000);
    expect(platzRows.length).toBe(wiederholt.platzRows.length);
    expect(JSON.stringify(platzRows.slice(0, 5))).toBe(JSON.stringify(wiederholt.platzRows.slice(0, 5)));
  });

  it('liefert die Browser-Struktur (generateLagerDaten) über den DB-Pfad', () => {
    const daten = generateLagerDaten(ORTE, SEED);
    expect(daten.lagerorte).toHaveLength(100);
    expect(daten.lagerorte.reduce((n, o) => n + o.plaetze.length, 0)).toBeGreaterThan(40_000);
    const belegte = daten.lagerorte.flatMap((o) => o.plaetze).filter((p) => p.bestaende.length > 0).length;
    expect(belegte).toBeGreaterThan(10_000);
  });

  it('durchläuft die volle Pipeline (Gruppierung → Bestände → Layout) im Zeitbudget', () => {
    const { platzRows, bestandRows } = generateLager(ORTE, SEED);

    let t = performance.now();
    const daten = groupLagerorte(platzRows, 1);
    const tGroup = performance.now() - t;
    expect(daten.lagerorte).toHaveLength(100);
    expect(daten.lagerorte.reduce((n, o) => n + o.plaetze.length, 0)).toBeGreaterThan(40_000);

    t = performance.now();
    attachBestaende(daten, bestandRows, 1);
    const tAttach = performance.now() - t;

    t = performance.now();
    const racks = layoutRacks(daten.lagerorte);
    const tLayout = performance.now() - t;
    expect(racks.length).toBeGreaterThan(100);

    t = performance.now();
    let zellen = 0;
    for (const rack of racks) {
      const plätze = gangPlätze(rack.ort, rack.kind, rack.gang);
      zellen += plätze.length;
      for (const p of plätze) cellLocalPosition(p, rack);
    }
    const tCells = performance.now() - t;
    expect(zellen).toBeGreaterThan(40_000);

    console.log(`[perf] platzRows=${platzRows.length} bestandRows=${bestandRows.length} racks=${racks.length} zellen=${zellen}`);
    console.table({ groupLagerorte: tGroup, attachBestaende: tAttach, layoutRacks: tLayout, zellenEnum: tCells });

    expect(tGroup).toBeLessThan(BUDGET_MS);
    expect(tAttach).toBeLessThan(BUDGET_MS);
    expect(tLayout).toBeLessThan(BUDGET_MS);
    expect(tCells).toBeLessThan(BUDGET_MS);
  });
});
