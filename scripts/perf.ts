import { groupLagerorte, attachBestaende } from '../src/server/query';
import { layoutRacks, gangPlätze, cellLocalPosition } from '../src/app/scene/layout';
import { generateLager } from '../src/server/perf/generate';

const ORTE = Number(process.env.PERF_ORTE ?? 100);
const SEED = Number(process.env.PERF_SEED ?? 42);
const seed = SEED;

const { platzRows, bestandRows } = generateLager(ORTE, seed);

const times: Record<string, number> = {};

let t = performance.now();
const daten = groupLagerorte(platzRows, 1);
times.groupLagerorte = performance.now() - t;

t = performance.now();
attachBestaende(daten, bestandRows, 1);
times.attachBestaende = performance.now() - t;

t = performance.now();
const racks = layoutRacks(daten.lagerorte);
times.layoutRacks = performance.now() - t;

t = performance.now();
let zellen = 0;
for (const rack of racks) {
  const plätze = gangPlätze(rack.ort, rack.kind, rack.gang);
  zellen += plätze.length;
  for (const p of plätze) cellLocalPosition(p, rack);
}
times.zellenEnum = performance.now() - t;

const plaetze = daten.lagerorte.reduce((n, o) => n + o.plaetze.length, 0);
console.log(`\nGroßlager-Perftest  orte=${daten.lagerorte.length}  plaetze=${plaetze}  platzRows=${platzRows.length}  bestandRows=${bestandRows.length}  racks=${racks.length}  zellen=${zellen}`);
console.table(times);
console.log(`gesamt: ${Object.values(times).reduce((a, b) => a + b, 0).toFixed(1)} ms\n`);
