import { describe, expect, it } from 'vitest';
import type { LagerDaten, Lagerbestand, Lagerort, Lagerplatz } from '../shared/types';
import {
  alleArtikel,
  artikelLagerplätze,
  bookingFlashes,
  filterArtikel,
  fmtMenge,
  FLASH_HERKUNFT_COLOR,
  FLASH_ZIEL_COLOR,
  platzIdsMitArtikel,
  plätzeMitArtikel,
  platzIndex,
  platzMitId,
  platzWorld,
} from './article';
import type { PlacedRack, RackTransform } from './scene/transform';

const bestand = (artikelnummer: string, bezeichnung1: string, bestand: number): Lagerbestand => ({
  artikelnummer,
  bezeichnung1,
  matchcode: bezeichnung1,
  bestand,
  verfuegbarkeit: bestand,
  gewicht: 0,
});

const platz = (id: number, bestaende: Lagerbestand[]): Lagerplatz => ({
  platzId: id,
  dim: { d1: 0, d2: 0, d3: 0 },
  ebene: 0,
  kurz: `P${id}`,
  platzbezeichnung: `Platz ${id}`,
  masse: { hoehe: 60, breite: 100, laenge: 100 },
  maxGewicht: 0,
  bestaende,
});

const ort = (lagerkennung: string, plaetze: Lagerplatz[]): Lagerort => ({
  lagerkennung,
  bezeichnung: `Lager ${lagerkennung}`,
  lagertechnik: 'LTD0ST',
  dims: { d1: 0, d2: 0, d3: 0 },
  plaetze,
});

const data: LagerDaten = {
  mandant: 1,
  lagerorte: [
    ort('LAG', [
      platz(1, [bestand('A1', 'Artikel Eins', 10), bestand('B2', 'B Zwei', 3)]),
      platz(2, [bestand('A1', 'Artikel Eins', 5)]),
    ]),
    ort('KUEHL', [platz(10, [bestand('A1', 'Artikel Eins', 7), bestand('C3', 'C Drei', 2)])]),
  ],
};

describe('alleArtikel', () => {
  it('sammelt Artikel dedupliziert, summiert Bestand, sortiert nach Nummer', () => {
    const liste = alleArtikel(data);
    expect(liste.map((a) => a.artikelnummer)).toEqual(['A1', 'B2', 'C3']);
    expect(liste.find((a) => a.artikelnummer === 'A1')).toMatchObject({ bezeichnung1: 'Artikel Eins', gesamt: 22 });
  });
});

describe('filterArtikel', () => {
  const liste = alleArtikel(data);

  it('liefert bei leerer Query nichts', () => {
    expect(filterArtikel(liste, '')).toEqual([]);
    expect(filterArtikel(liste, '   ')).toEqual([]);
  });

  it('präfix-Treffer der Nummer zuerst', () => {
    const t = filterArtikel(liste, 'a');
    expect(t[0]!.artikelnummer).toBe('A1');
  });

  it('findet auch enthaltene Nummern case-insensitiv', () => {
    expect(filterArtikel(liste, '1').map((a) => a.artikelnummer)).toEqual(['A1']);
  });

  it('findet Treffer über die Bezeichnung', () => {
    expect(filterArtikel(liste, 'eins').map((a) => a.artikelnummer)).toEqual(['A1']);
  });

  it('liefert nichts bei keiner Übereinstimmung', () => {
    expect(filterArtikel(liste, 'xyz')).toEqual([]);
  });

  it('kappt bei limit', () => {
    const viele = ['A1', 'B2', 'C3', 'D4', 'E5'].map((artikelnummer) => ({
      artikelnummer,
      bezeichnung1: 'Artikel X',
      gesamt: 1,
    }));
    expect(filterArtikel(viele, '', 3)).toEqual([]);
    expect(filterArtikel(viele, 'artikel', 2).length).toBe(2);
  });
});

describe('artikelLagerplätze', () => {
  it('findet alle Plätze eines Artikels, sortiert nach Lagerort und Platz', () => {
    const plätze = artikelLagerplätze(data, 'A1');
    expect(plätze.map((p) => `${p.ort.lagerkennung}/${p.platz.platzId}`)).toEqual(['KUEHL/10', 'LAG/1', 'LAG/2']);
    expect(plätze[0]).toMatchObject({ bestand: 7 });
  });

  it('liefert nichts für unbekannte Artikel', () => {
    expect(artikelLagerplätze(data, 'NIX')).toEqual([]);
  });
});

describe('platzIdsMitArtikel', () => {
  it('liefert die platzIds der Plätze mit dem Artikel', () => {
    const plaetze = data.lagerorte[0]!.plaetze;
    expect(platzIdsMitArtikel(plaetze, 'A1')).toEqual(new Set([1, 2]));
    expect(platzIdsMitArtikel(plaetze, 'B2')).toEqual(new Set([1]));
  });

  it('liefert leeres Set bei unbekanntem oder leerem Artikel', () => {
    const plaetze = data.lagerorte[0]!.plaetze;
    expect(platzIdsMitArtikel(plaetze, 'NIX')).toEqual(new Set());
    expect(platzIdsMitArtikel(plaetze, null)).toEqual(new Set());
  });
});

const rack: PlacedRack = {
  key: 'LAG',
  ort: data.lagerorte[1]!,
  kind: 'single',
  gang: 0,
  cols: 1,
  levels: 1,
  depth: 1,
  flat: true,
  cellH: 0.6,
  position: [0,0,0],
  rotY: 0,
  size: { w: 0.95, h: 0.6, d: 0.95 },
};

describe('plätzeMitArtikel', () => {
  it('filtert die Plätze der Regal-Instanz auf den Artikel', () => {
    const mitArtikel = plätzeMitArtikel(rack, 'C3');
    expect(mitArtikel).toHaveLength(1);
    expect(mitArtikel[0]).toMatchObject({ bestand: 2 });
    expect(plätzeMitArtikel(rack, 'A1')).toHaveLength(1);
  });
});

describe('platzWorld', () => {
  it('berechnet die Zellenposition ohne Rotation/Skalierung', () => {
    const rack: PlacedRack = {
      key: 'LAG',
      ort: data.lagerorte[1]!,
      kind: 'single',
      gang: 0,
      cols: 1,
      levels: 1,
      depth: 1,
      flat: true,
      cellH: 0.6,
      position: [10, 0, 20],
      rotY: 0,
      size: { w: 0.95, h: 0.6, d: 0.95 },
    };
    const t: RackTransform = { x: 0, z: 0, rotY: 0, scale: { x: 1, y: 1, z: 1 } };
    const w = platzWorld(rack, t, data.lagerorte[1]!.plaetze[0]!);
    expect(w).toEqual({ x: 10, y: 0.3, z: 20, w: 0.95, d: 0.95, h: 0.6 });
  });

  it('berücksichtigt Rotation (90°) und Skalierung', () => {
    const zelle = platz(5, [bestand('A1', 'A', 1)]);
    const zelleRack = { ...zelle, dim: { d1: 0, d2: 0, d3: 3 } };
    const rack: PlacedRack = {
      key: 'KUEHL#0',
      ort: data.lagerorte[0]!,
      kind: 'rack',
      gang: 0,
      cols: 1,
      levels: 2,
      depth: 3,
      flat: false,
      cellH: 0.6,
      position: [10, 0, 20],
      rotY: Math.PI / 2,
      size: { w: 1, h: 1.55, d: 3 },
    };
    const t: RackTransform = { x: 0, z: 0, rotY: 0, scale: { x: 2, y: 1, z: 2 } };
    const w = platzWorld(rack, t, zelleRack);
    expect(w.x).toBeCloseTo(8, 5);
    expect(w.z).toBeCloseTo(20, 5);
    expect(w.y).toBeCloseTo(0.55, 5);
    expect(w.w).toBeCloseTo(1.9, 5);
    expect(w.d).toBeCloseTo(1.9, 5);
    expect(w.h).toBeCloseTo(0.6, 5);
  });
});

describe('platzIndex', () => {
  it('baut einen platzId→{rack, platz}-Index über alle Regal-Instanzen', () => {
    const index = platzIndex([rack]);
    expect(index.get(10)).toMatchObject({ rack: { key: 'LAG' }, platz: { platzId: 10 } });
  });

  it('liefert eine leere Map bei leeren Racks', () => {
    expect(platzIndex([]).size).toBe(0);
  });
});

describe('platzMitId', () => {
  it('findet die Regal-Instanz zu einer PlatzId über den Index', () => {
    const index = platzIndex([rack]);
    const hit = platzMitId(index, 10);
    expect(hit).not.toBeNull();
    expect(hit!.platz.platzId).toBe(10);
    expect(hit!.rack.key).toBe('LAG');
  });

  it('liefert null für unbekannte PlatzId oder leeren Index', () => {
    const index = platzIndex([rack]);
    expect(platzMitId(index, 999)).toBeNull();
    expect(platzMitId(platzIndex([]), 10)).toBeNull();
  });
});

describe('fmtMenge', () => {
  it('formatiert Ganzzahlen ohne Nachkommastellen', () => {
    expect(fmtMenge(5)).toBe('5');
    expect(fmtMenge(5.5)).toBe('5.5');
    expect(fmtMenge(0.333)).toBe('0.33');
  });
});

describe('bookingFlashes', () => {
  const t: RackTransform = { x: 0, z: 0, rotY: 0, scale: { x: 1, y: 1, z: 1 } };
  const index = platzIndex([rack]);

  it('erzeugt je Buchung zwei Blitze (Herkunft + Ziel)', () => {
    const flashes = bookingFlashes(
      index,
      [{ id: 1, artikelnummer: 'A1', menge: 2, herkunftPlatzId: 10, zielPlatzId: 10, receivedAt: 0 }],
      () => t,
    );
    expect(flashes).toHaveLength(2);
    expect(flashes[0]).toMatchObject({ key: '1-h', color: FLASH_HERKUNFT_COLOR, label: 'A1 -2' });
    expect(flashes[1]).toMatchObject({ key: '1-z', color: FLASH_ZIEL_COLOR, label: 'A1 +2' });
  });

  it('überspringt PlatzIds, die in keinem Regal liegen', () => {
    const flashes = bookingFlashes(
      index,
      [{ id: 1, artikelnummer: 'A1', menge: 1, herkunftPlatzId: 999, zielPlatzId: 10, receivedAt: 0 }],
      () => t,
    );
    expect(flashes).toHaveLength(1);
    expect(flashes[0]!.key).toBe('1-z');
  });

  it('liefert nichts, wenn kein Platz getroffen wird', () => {
    const flashes = bookingFlashes(
      index,
      [{ id: 1, artikelnummer: 'A1', menge: 1, herkunftPlatzId: 999, zielPlatzId: 998, receivedAt: 0 }],
      () => t,
    );
    expect(flashes).toEqual([]);
  });

  it('berechnet die Weltposition der Zelle', () => {
    const flashes = bookingFlashes(
      index,
      [{ id: 7, artikelnummer: 'A1', menge: 1, herkunftPlatzId: 10, zielPlatzId: null, receivedAt: 5 }],
      () => t,
    );
    expect(flashes[0]!.w.x).toBe(0);
    expect(flashes[0]!.w.z).toBe(0);
    expect(flashes[0]!.start).toBe(5);
  });

  it('verbindet Herkunft und Ziel über ein to (Spline), wenn beide Plätze liegen', () => {
    const zielRack: PlacedRack = {
      ...rack,
      key: 'ZIEL',
      ort: ort('ZIEL', [platz(20, [bestand('A1', 'Artikel Eins', 1)])]),
      position: [5, 0, 8],
    };
    const flashes = bookingFlashes(
      platzIndex([rack, zielRack]),
      [{ id: 2, artikelnummer: 'A1', menge: 1, herkunftPlatzId: 10, zielPlatzId: 20, receivedAt: 0 }],
      () => t,
    );
    expect(flashes).toHaveLength(2);
    expect(flashes[0]!.key).toBe('2-h');
    expect(flashes[0]!.to).toBeDefined();
    expect(flashes[0]!.to!.x).toBe(5);
    expect(flashes[0]!.to!.z).toBe(8);
    expect(flashes[1]!.to).toBeUndefined();
  });

  it('setzt kein to, wenn nur eine Seite der Buchung liegt', () => {
    const flashes = bookingFlashes(
      index,
      [{ id: 3, artikelnummer: 'A1', menge: 1, herkunftPlatzId: 10, zielPlatzId: 999, receivedAt: 0 }],
      () => t,
    );
    expect(flashes).toHaveLength(1);
    expect(flashes[0]!.to).toBeUndefined();
  });
});

