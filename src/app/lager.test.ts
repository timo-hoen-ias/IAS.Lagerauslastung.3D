import { describe, expect, it } from 'vitest';
import { lagerLaden, OFFLINE_ORTE } from './lager';

const fetchStub =
  (body: unknown, ok = true) =>
  async (): Promise<{ ok: boolean; json: () => Promise<unknown> }> => ({
    ok,
    json: async () => body,
  });

describe('lagerLaden (Offline-/Fehler-Fallback)', () => {
  it('liefert Server-Daten samt Server-Fallback-Flag unverändert', async () => {
    const d = await lagerLaden('/api/lager?db=perf', fetchStub({ mandant: 1, lagerorte: [], fallback: true }));
    expect(d.fallback).toBe(true);
    expect(d.lagerorte).toEqual([]);
  });

  it('liefert echte Server-Daten ohne fallback-Flag', async () => {
    const d = await lagerLaden('/api/lager?db=default', fetchStub({ mandant: 1, lagerorte: [] }));
    expect(d.fallback).toBeUndefined();
  });

  it('fällt auf das Perf-Lager zurück, wenn der Server einen Fehler meldet', async () => {
    const d = await lagerLaden('/api/lager?db=default', fetchStub({ error: 'kaputt' }));
    expect(d.fallback).toBe(true);
    expect(d.lagerorte).toHaveLength(OFFLINE_ORTE);
  });

  it('fällt auf das Perf-Lager zurück, wenn kein Backend erreichbar ist', async () => {
    const d = await lagerLaden('/api/lager?db=default', async () => {
      throw new Error('fetch failed');
    });
    expect(d.fallback).toBe(true);
    expect(d.lagerorte).toHaveLength(OFFLINE_ORTE);
  });
});
