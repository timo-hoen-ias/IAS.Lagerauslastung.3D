import { perfLagerDaten } from '../server/perf/generate';
import type { LagerDaten } from '../shared/types';

/** Antwort von /api/lager bzw. lokaler Fallback: `fallback: true` = Perf-Lager statt DB. */
export type LagerLadeErgebnis = LagerDaten & { fallback?: boolean };

export const OFFLINE_ORTE = 100;
export const OFFLINE_SEED = 42;

type FetchLike = (input: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/**
 * Lädt Lagerdaten vom Backend. Ist kein Server erreichbar (oder der Server
 * meldet einen Fehler), wird das Perf-Lager direkt im Browser generiert —
 * `fallback: true` signalisiert das der UI.
 */
export async function lagerLaden(url: string, fetchFn: FetchLike = fetch): Promise<LagerLadeErgebnis> {
  try {
    const res = await fetchFn(url);
    const d = (await res.json()) as LagerDaten & { error?: string; fallback?: boolean };
    if (d.error) throw new Error(d.error);
    return d;
  } catch (err) {
    console.warn('[lager] kein Backend erreichbar — Perf-Lager im Browser geladen.', err);
    return { ...perfLagerDaten(OFFLINE_ORTE, OFFLINE_SEED), fallback: true };
  }
}
