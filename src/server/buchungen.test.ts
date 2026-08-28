import { describe, expect, it } from 'vitest';
import { BuchungsRing, parseBuchung } from './buchungen';
import type { BuchungEvent } from '../shared/types';

const event = (over: Partial<BuchungEvent> = {}): BuchungEvent => ({
  mandant: 1,
  artikelnummer: 'A1',
  menge: 2,
  bewegung: null,
  herkunftPlatzId: 10,
  zielPlatzId: null,
  herkunftCarrierId: null,
  zielCarrierId: null,
  typ: null,
  benutzer: '',
  ts: 1,
  ...over,
});

describe('parseBuchung', () => {
  it('akzeptiert eine gültige Buchung mit Herkunft', () => {
    const e = parseBuchung({ mandant: 1, artikelnummer: 'A1', menge: 2, herkunftPlatzId: 10, zielPlatzId: null });
    expect(e).not.toBeNull();
    expect(e!.artikelnummer).toBe('A1');
    expect(e!.herkunftPlatzId).toBe(10);
    expect(e!.zielPlatzId).toBeNull();
    expect(e!.menge).toBe(2);
    expect(e!.ts).toBeGreaterThan(0);
  });

  it('akzeptiert Ziel ohne Herkunft', () => {
    const e = parseBuchung({ mandant: 1, artikelnummer: 'B', zielPlatzId: 7 });
    expect(e).not.toBeNull();
    expect(e!.herkunftPlatzId).toBeNull();
    expect(e!.zielPlatzId).toBe(7);
  });

  it('normalisiert Strings (Zahlen, Trim, leere Werte)', () => {
    const e = parseBuchung({
      mandant: '1',
      artikelnummer: ' A1 ',
      menge: '2.5',
      herkunftPlatzId: '10',
      zielPlatzId: null,
      bewegung: ' Zugang ',
      benutzer: ' M',
    });
    expect(e).not.toBeNull();
    expect(e!.mandant).toBe(1);
    expect(e!.artikelnummer).toBe('A1');
    expect(e!.menge).toBe(2.5);
    expect(e!.herkunftPlatzId).toBe(10);
    expect(e!.bewegung).toBe('Zugang');
    expect(e!.benutzer).toBe('M');
  });

  it('verwirft ohne Mandant, Artikelnummer oder Platz', () => {
    expect(parseBuchung(null)).toBeNull();
    expect(parseBuchung({ mandant: 0, artikelnummer: 'A', herkunftPlatzId: 1 })).toBeNull();
    expect(parseBuchung({ mandant: 1, artikelnummer: '', herkunftPlatzId: 1 })).toBeNull();
    expect(parseBuchung({ mandant: 1, artikelnummer: 'A', herkunftPlatzId: null, zielPlatzId: null })).toBeNull();
    expect(parseBuchung('text')).toBeNull();
  });
});

describe('BuchungsRing', () => {
  it('hält nur die letzten N Ereignisse', () => {
    const ring = new BuchungsRing(3);
    for (let i = 1; i <= 5; i++) ring.push(event({ artikelnummer: `A${i}`, menge: i }));
    expect(ring.snapshot().map((e) => e.menge)).toEqual([3, 4, 5]);
  });

  it('übernimmt initiale Ereignisse, gekappt auf die Kapazität', () => {
    const ring = new BuchungsRing(2, [event({ artikelnummer: 'X' }), event({ artikelnummer: 'Y' }), event({ artikelnummer: 'Z' })]);
    expect(ring.snapshot().map((e) => e.artikelnummer)).toEqual(['Y', 'Z']);
  });

  it('snapshot liefert eine Kopie', () => {
    const ring = new BuchungsRing(5);
    ring.push(event());
    const snap = ring.snapshot();
    snap.pop();
    expect(ring.snapshot()).toHaveLength(1);
  });
});
