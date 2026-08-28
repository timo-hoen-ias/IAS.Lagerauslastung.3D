import { describe, expect, it } from 'vitest';
import { parseLiveMessage } from './live';
import type { BuchungEvent } from '../shared/types';

const evt: BuchungEvent = {
  mandant: 1,
  artikelnummer: 'A1',
  menge: 2,
  bewegung: 'Zugang',
  herkunftPlatzId: 10,
  zielPlatzId: null,
  herkunftCarrierId: null,
  zielCarrierId: null,
  typ: null,
  benutzer: 'M',
  ts: 123,
};

describe('parseLiveMessage', () => {
  it('liest ein Event', () => {
    const m = parseLiveMessage(JSON.stringify({ type: 'event', event: evt }));
    expect(m).toEqual({ type: 'event', event: evt });
  });

  it('liest ein Replay', () => {
    const m = parseLiveMessage(JSON.stringify({ type: 'replay', events: [evt, evt] }));
    expect(m).toEqual({ type: 'replay', events: [evt, evt] });
  });

  it('liefert null bei kaputtem JSON', () => {
    expect(parseLiveMessage('kein json')).toBeNull();
  });

  it('liefert null bei unbekanntem Typ oder fehlendem Inhalt', () => {
    expect(parseLiveMessage(JSON.stringify({ type: 'nope' }))).toBeNull();
    expect(parseLiveMessage(JSON.stringify({ type: 'event' }))).toBeNull();
    expect(parseLiveMessage(JSON.stringify({ type: 'replay' }))).toBeNull();
  });
});
