import type { LagerDaten } from '../shared/types';

/** Antwort von /api/lager: `fallback: true` signalisiert, dass das Perf-Lager statt der DB geladen wurde. */
export type LagerAntwort = LagerDaten & { fallback?: boolean };

const DEFAULT_LOG = (err: unknown): void => {
  console.error('[api/lager] DB-Verbindung fehlgeschlagen — lade Perf-Lager statt dessen.', err);
};

/**
 * Lädt Lagerdaten und fällt bei Verbindungsfehlern auf die Perf-Daten zurück.
 * Loader und Fallback sind injiziert, damit die Logik ohne echte MSSQL-Verbindung testbar bleibt.
 */
export function lagerMitPerfFallback(
  load: () => Promise<LagerDaten>,
  fallbackDaten: () => LagerDaten,
  log: (err: unknown) => void = DEFAULT_LOG,
): Promise<LagerAntwort> {
  return load().then(
    (daten) => daten,
    (err) => {
      log(err);
      return { ...fallbackDaten(), fallback: true };
    },
  );
}
