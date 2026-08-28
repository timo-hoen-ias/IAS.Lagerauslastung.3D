import type { BuchungEvent } from '../shared/types';

export const BUCHUNGEN_TOPIC = 'buchungen';
export const RING_CAPACITY = 50;

/** Optionaler Ganzzahl-Wert aus number|string|null -> null bei ungültig. */
function toIntOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
  }
  return null;
}

function optStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Validiert und normalisiert eine eingehende Buchung; null, wenn unbrauchbar. */
export function parseBuchung(raw: unknown): BuchungEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const mandant = Number(o.mandant);
  const artikelnummer = typeof o.artikelnummer === 'string' ? o.artikelnummer.trim() : '';
  if (!Number.isInteger(mandant) || mandant <= 0) return null;
  if (!artikelnummer) return null;

  const herkunftPlatzId = toIntOrNull(o.herkunftPlatzId);
  const zielPlatzId = toIntOrNull(o.zielPlatzId);
  if (herkunftPlatzId == null && zielPlatzId == null) return null;

  const menge = typeof o.menge === 'number' ? o.menge : Number(o.menge ?? 0);
  return {
    mandant,
    artikelnummer,
    menge: Number.isFinite(menge) ? menge : 0,
    bewegung: optStr(o.bewegung),
    herkunftPlatzId,
    zielPlatzId,
    herkunftCarrierId: toIntOrNull(o.herkunftCarrierId),
    zielCarrierId: toIntOrNull(o.zielCarrierId),
    typ: toIntOrNull(o.typ),
    benutzer: optStr(o.benutzer) ?? '',
    ts: Date.now(),
  };
}

/** Ringpuffer der letzten Buchungen (für Replay beim WS-Verbinden). */
export class BuchungsRing {
  private events: BuchungEvent[] = [];

  constructor(
    readonly capacity = RING_CAPACITY,
    initial: BuchungEvent[] = [],
  ) {
    this.events = initial.slice(-capacity);
  }

  push(e: BuchungEvent): void {
    this.events.push(e);
    if (this.events.length > this.capacity) {
      this.events.splice(0, this.events.length - this.capacity);
    }
  }

  snapshot(): BuchungEvent[] {
    return this.events.slice();
  }
}

/** Verteilt ein Event an alle auf BUCHUNGEN_TOPIC abonnierten WebSocket-Clients. */
export function publishBuchung(
  server: { publish(topic: string, data: string): number },
  event: BuchungEvent,
): void {
  server.publish(BUCHUNGEN_TOPIC, JSON.stringify({ type: 'event', event }));
}
