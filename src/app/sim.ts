import type { BuchungEvent, LagerDaten } from '../shared/types';

/** Zufällige Pause zwischen zwei simulierten Buchungen (Debug-Modus). */
export const SIM_MIN_MS = 3_000;
export const SIM_MAX_MS = 5_000;

/** Zeitfenster der simulierten Zeitpunkte: jetzt ± 60 Minuten. */
export const SIM_TS_SPREAD_MS = 60 * 60 * 1000;

export function nextIntervalMs(min = SIM_MIN_MS, max = SIM_MAX_MS): number {
  return min + Math.floor(Math.random() * (max - min));
}

/** lagerkennung eines Platzes, falls in den Daten bekannt. */
function lagerVonPlatz(data: LagerDaten, platzId: number): string | null {
  for (const ort of data.lagerorte) {
    if (ort.plaetze.some((p) => p.platzId === platzId)) return ort.lagerkennung;
  }
  return null;
}

/** Erzeugt eine zufällige Beispiel-Buchung mit Zeitpunkt jetzt ± 60 min. */
export function randomBuchung(data: LagerDaten, now = Date.now()): BuchungEvent {
  const plaetze = data.lagerorte.flatMap((o) => o.plaetze);
  const n = plaetze.length;
  const idx = Math.floor(Math.random() * n);
  let zielIdx = Math.floor(Math.random() * n);
  if (n > 1 && zielIdx === idx) zielIdx = (idx + 1) % n;
  const herkunft = n > 0 ? plaetze[idx]!.platzId : 1;
  const ziel = n > 0 ? plaetze[zielIdx]!.platzId : 2;
  const artikel = plaetze.find((p) => p.bestaende.length > 0)?.bestaende[0]?.artikelnummer ?? 'SIM-ARTIKEL';
  const ts = now + Math.floor((Math.random() * 2 - 1) * SIM_TS_SPREAD_MS);
  return {
    mandant: data.mandant > 0 ? data.mandant : 1,
    artikelnummer: artikel,
    menge: 1 + Math.floor(Math.random() * 50),
    bewegung: 'SIM-UMLAGERUNG',
    herkunftPlatzId: herkunft,
    zielPlatzId: ziel,
    herkunftCarrierId: null,
    zielCarrierId: null,
    typ: 1,
    benutzer: 'sim',
    herkunftLager: lagerVonPlatz(data, herkunft),
    zielLager: lagerVonPlatz(data, ziel),
    quelle: 'sim',
    ts,
  };
}
