import type { BuchungEvent } from '../shared/types';
import { pushBuchung, setWsConnected } from './store';

export type LiveMessage =
  | { type: 'event'; event: BuchungEvent }
  | { type: 'replay'; events: BuchungEvent[] };

const RETRY_BASE_MS = 1500;
const RETRY_MAX_MS = 15000;

/** WebSocket-URL zum Bun-Server (gleicher Host, /api wird per Vite-Proxy weitergeleitet). */
export function buchungWsUrl(base = window.location): string {
  const proto = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${base.host}/api/buchung/ws`;
}

/** Validiert eine eingehende WS-Nachricht; null bei unbrauchbarem Format. */
export function parseLiveMessage(data: string): LiveMessage | null {
  try {
    const msg = JSON.parse(data) as { type?: string; event?: unknown; events?: unknown };
    if (msg.type === 'event' && msg.event && typeof msg.event === 'object') {
      return { type: 'event', event: msg.event as BuchungEvent };
    }
    if (msg.type === 'replay' && Array.isArray(msg.events)) {
      return { type: 'replay', events: msg.events as BuchungEvent[] };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verbindet sich zum Live-Buchungs-WebSocket, pusht Events in den Store
 * und verbindet sich mit exponentiellem Backoff neu. Gibt eine Cleanup-Funktion zurück.
 */
export function startLiveBuchungen(): () => void {
  let closed = false;
  let ws: WebSocket | null = null;
  let retry = RETRY_BASE_MS;
  let timer: number | null = null;

  const scheduleRetry = (): void => {
    if (closed) return;
    timer = window.setTimeout(connect, retry);
    retry = Math.min(retry * 2, RETRY_MAX_MS);
  };

  const connect = (): void => {
    if (closed) return;
    try {
      ws = new WebSocket(buchungWsUrl());
    } catch {
      scheduleRetry();
      return;
    }
    ws.onopen = () => {
      retry = RETRY_BASE_MS;
      setWsConnected(true);
    };
    ws.onmessage = (ev) => {
      const msg = parseLiveMessage(String(ev.data));
      if (!msg) return;
      if (msg.type === 'event') {
        pushBuchung(msg.event);
      } else {
        for (const e of msg.events) pushBuchung(e);
      }
    };
    ws.onerror = () => {
      ws?.close();
    };
    ws.onclose = () => {
      ws = null;
      setWsConnected(false);
      scheduleRetry();
    };
  };

  connect();

  return () => {
    closed = true;
    setWsConnected(false);
    if (timer != null) window.clearTimeout(timer);
    ws?.close();
  };
}
