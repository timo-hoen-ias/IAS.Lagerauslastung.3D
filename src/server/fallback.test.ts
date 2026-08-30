import { describe, expect, it } from 'vitest';
import type { LagerDaten } from '../shared/types';
import { lagerMitPerfFallback } from './fallback';

const lager = (kennung: string): LagerDaten => ({
  mandant: 1,
  lagerorte: [{ lagerkennung: kennung, bezeichnung: '', lagertechnik: '', dims: { d1: 0, d2: 0, d3: 0 }, plaetze: [] }],
});

describe('lagerMitPerfFallback', () => {
  it('liefert die echten Daten ohne fallback-Flag, wenn die Verbindung funktioniert', async () => {
    const result = await lagerMitPerfFallback(() => Promise.resolve(lager('DB')), () => lager('PERF'));
    expect(result.fallback).toBeUndefined();
    expect(result.lagerorte[0]!.lagerkennung).toBe('DB');
  });

  it('fällt auf das Perf-Lager zurück, wenn die DB-Verbindung fehlschlägt', async () => {
    const result = await lagerMitPerfFallback(() => Promise.reject(new Error('Connection refused')), () => lager('PERF'));
    expect(result.fallback).toBe(true);
    expect(result.lagerorte[0]!.lagerkennung).toBe('PERF');
  });

  it('loggt den Verbindungsfehler beim Rückfall', async () => {
    const logs: unknown[] = [];
    await lagerMitPerfFallback(() => Promise.reject(new Error('Timeout')), () => lager('PERF'), (err) => logs.push(err));
    expect(logs).toHaveLength(1);
    expect((logs[0] as Error).message).toBe('Timeout');
  });
});
