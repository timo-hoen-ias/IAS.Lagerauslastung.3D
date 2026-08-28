import { groupLagerorte, attachBestaende } from '../query';
import type { LagerDaten } from '../../shared/types';

export type OrtMeta = {
  mandant: number;
  kennung: string;
  bezeichnung: string;
  technik: string;
  dims: { d1: number; d2: number; d3: number };
  platzIds: number[];
};

/** Deterministischer PRNG (mulberry32) — gleicher Seed → identische Daten. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARTIKEL = ['Tischplatte', 'Schublade', 'Regalboden', 'Seitenwand', 'Rückwand', 'Gleitbrett', 'Scharnier', 'Griff', 'Sockel', 'Fachboden'];
const EINHEITEN = ['Stück', 'kg', 'm', 'm²', 'l'];

type Spec = { technik: string; d1: number; d2: number; d3: number; masse: { hoehe: number; breite: number; laenge: number } };

// Mischung: 60% Hochregal (60×336), 20% Flächenlager (20×200), 20% Freilager (20×800) → 40.160 Plätze
function specFor(i: number): Spec {
  switch (i % 5) {
    case 3:
      return { technik: 'LTD2SF', d1: 4, d2: 50, d3: 0, masse: { hoehe: 20, breite: 120, laenge: 120 } };
    case 4:
      return { technik: 'LTD1UF', d1: 800, d2: 0, d3: 0, masse: { hoehe: 20, breite: 100, laenge: 200 } };
    default:
      return { technik: 'LTD3HR', d1: 4, d2: 7, d3: 12, masse: { hoehe: 60, breite: 110, laenge: 160 } };
  }
}

/** Erzeugt PLATZ-Inventar-Zeilen (Shape von PLAETZE_SQL) inkl. Catch-all je Ort. */
export function generatePlatzRows(orte: number, seed = 1): { rows: Record<string, unknown>[]; orte: OrtMeta[] } {
  const rows: Record<string, unknown>[] = [];
  const metas: OrtMeta[] = [];
  let platzId = 1;
  for (let i = 0; i < orte; i++) {
    const { technik, d1, d2, d3, masse } = specFor(i);
    const mandant = 1;
    const kennung = `PERF-${String(i + 1).padStart(3, '0')}`;
    const dims = { d1, d2, d3 };
    const platzIds: number[] = [];
    const push = (dd1: number, dd2: number, dd3: number) => {
      platzIds.push(platzId);
      rows.push({
        Mandant: mandant,
        Lagerkennung: kennung,
        Bezeichnung: `Perf-Lager ${i + 1}`,
        Lagertechnik: technik,
        AnzahlDimension1: d1,
        AnzahlDimension2: d2,
        AnzahlDimension3: d3,
        PlatzID: platzId,
        Dimension1: dd1,
        Dimension2: dd2,
        Dimension3: dd3,
        Dimensionsebene: 0,
        Kurzbezeichnung: `${kennung};${dd1};${dd2};${dd3}`,
        Platzbezeichnung: '',
        Hoehe: masse.hoehe,
        Breite: masse.breite,
        Laenge: masse.laenge,
        Tragkraft: 500,
      });
      platzId++;
    };
    push(0, 0, 0);
    if (d3 > 0) {
      for (let g = 1; g <= d1; g++) for (let e = 1; e <= d2; e++) for (let f = 1; f <= d3; f++) push(g, e, f);
    } else if (d2 > 0) {
      for (let g = 1; g <= d1; g++) for (let p = 1; p <= d2; p++) push(g, p, 0);
    } else {
      for (let b = 1; b <= d1; b++) push(b, 0, 0);
    }
    metas.push({ mandant, kennung, bezeichnung: `Perf-Lager ${i + 1}`, technik, dims, platzIds });
  }
  return { rows, orte: metas };
}

/** Erzeugt Bestands-Zeilen (Shape von LAGER_SQL): ~70% der Plätze mit 1–2 Artikeln. */
export function generateBestandRows(orte: OrtMeta[], seed = 2): Record<string, unknown>[] {
  const rnd = mulberry32(seed);
  const rows: Record<string, unknown>[] = [];
  for (const ort of orte) {
    for (const platzId of ort.platzIds) {
      if (rnd() < 0.3) continue;
      const n = 1 + Math.floor(rnd() * 2);
      for (let k = 0; k < n; k++) {
        rows.push({
          Mandant: ort.mandant,
          Lagerkennung: ort.kennung,
          PlatzID: platzId,
          Artikelnummer: String(100000 + Math.floor(rnd() * 900000)),
          Bezeichnung1: ARTIKEL[Math.floor(rnd() * ARTIKEL.length)],
          Matchcode: '',
          AuspraegungID: 0,
          Eigenmasse: 1 + Math.floor(rnd() * 50),
          Lagermengeneinheit: EINHEITEN[Math.floor(rnd() * EINHEITEN.length)],
          Gewicht: 0,
          GewichtLME: 0,
          Bestand: 1 + Math.floor(rnd() * 999),
          Verfuegbarkeit: 0,
        });
      }
    }
  }
  return rows;
}

/** Komplette generierte Pipeline-Eingabe. */
export function generateLager(orte = 100, seed = 1): {
  platzRows: Record<string, unknown>[];
  bestandRows: Record<string, unknown>[];
  orte: OrtMeta[];
} {
  const { rows: platzRows, orte: metas } = generatePlatzRows(orte, seed);
  const bestandRows = generateBestandRows(metas, seed + 1);
  return { platzRows, bestandRows, orte: metas };
}

/** LagerDaten über denselben Pfad wie die DB-Queries (groupLagerorte + attachBestaende). */
export function generateLagerDaten(orte = 100, seed = 1): LagerDaten {
  const { platzRows, bestandRows } = generateLager(orte, seed);
  const daten = groupLagerorte(platzRows, 1);
  attachBestaende(daten, bestandRows, 1);
  return daten;
}

let cache: LagerDaten | null = null;
// ponytail: Modul-Cache, Daten sind deterministisch — einmal reicht. Env-Wechsel braucht Server-Neustart.
export function perfLagerDaten(orte = 100, seed = 1): LagerDaten {
  if (!cache) cache = generateLagerDaten(orte, seed);
  return cache;
}
