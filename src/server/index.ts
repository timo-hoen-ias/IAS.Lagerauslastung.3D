import { LAGER_SQL, PLAETZE_SQL, attachBestaende, groupLagerorte } from './query';
import { findConnection, listConnections, type DbConnection } from './connections';
import { perfLagerDaten } from './perf/generate';
import { lagerMitPerfFallback } from './fallback';
import { BUCHUNGEN_TOPIC, BuchungsRing, parseBuchung, publishBuchung } from './buchungen';
import { poolFor } from './db';
import { createLager, getLager, listLager, matchSage, updateLager } from './editorStore';
import { getAnzeigeConfig, saveAnzeigeConfig } from './anzeigeStore';
import type { LagerDaten } from '../shared/types';
import { deriveEditorPlaetze, type EditorLager } from '../shared/editor';
import { DEFAULT_STOCK_ANZEIGE, normalizeStockAnzeige, type StockAnzeigeConfig } from '../shared/anzeige';

const PERF_ID = 'perf';
const perfOrte = () => Number(process.env.PERF_ORTE ?? 100);
const perfSeed = () => Number(process.env.PERF_SEED ?? 42);
const ring = new BuchungsRing();
/** Anzeige-Konfiguration für das generierte Perf-Lager (keine echte DB zum Persistieren). */
const perfAnzeige = new Map<number, StockAnzeigeConfig>();

async function mandanten(c: DbConnection): Promise<number[]> {
  const p = await poolFor(c);
  const r = await p.request().query<{ Mandant: number }>('SELECT DISTINCT Mandant FROM KHKLagerorte');
  return r.recordset.map((x) => x.Mandant).sort((a, b) => a - b);
}

async function loadLager(c: DbConnection, mandant?: number): Promise<LagerDaten> {
  const p = await poolFor(c);
  const [plaetze, bestaende] = await Promise.all([
    p.request().query<Record<string, unknown>>(PLAETZE_SQL),
    p.request().query<Record<string, unknown>>(LAGER_SQL),
  ]);
  const data = groupLagerorte(plaetze.recordset as Record<string, unknown>[], mandant);
  attachBestaende(data, bestaende.recordset as Record<string, unknown>[], mandant);
  const probe = data.lagerorte.flatMap((o) => o.plaetze).find((x) => x.masse.breite > 0 || x.masse.hoehe > 0 || x.masse.laenge > 0);
  if (probe) console.log(`[lager] ${c.id}/${data.mandant}: Beispiel-Maße (Rohwerte, cm):`, probe.masse);
  return data;
}

function connectionFromQuery(url: URL): DbConnection | Response {
  const db = url.searchParams.get('db') ?? '';
  const c = findConnection(db);
  if (!c) return Response.json({ error: `Unbekannte Datenbank '${db}'` }, { status: 400 });
  return c;
}

async function handleEditorLager(req: Request, url: URL): Promise<Response> {
  const c = connectionFromQuery(url);
  if (c instanceof Response) return c;
  const idMatch = /^\/api\/editor\/lager\/(\d+)$/.exec(url.pathname);
  try {
    const pool = await poolFor(c);
    if (req.method === 'GET' && !idMatch) {
      return Response.json({ lager: await listLager(pool) });
    }
    if (req.method === 'GET' && idMatch) {
      const lager = await getLager(pool, idMatch[1]!, c.id);
      if (!lager) return Response.json({ error: 'Lager nicht gefunden' }, { status: 404 });
      return Response.json(lager);
    }
    if (req.method === 'POST' && !idMatch) {
      const body = (await req.json()) as Omit<EditorLager, 'id' | 'connectionId'>;
      const id = await createLager(pool, body);
      return Response.json({ id }, { status: 201 });
    }
    if (req.method === 'PUT' && idMatch) {
      const body = (await req.json()) as Omit<EditorLager, 'id' | 'connectionId'>;
      await updateLager(pool, idMatch[1]!, body);
      return new Response(null, { status: 204 });
    }
    return new Response('Not Found', { status: 404 });
  } catch (err) {
    console.error('[api/editor/lager]', err);
    return Response.json({ error: String((err as Error).message) }, { status: 500 });
  }
}

async function handleEditorVorschau(req: Request, url: URL): Promise<Response> {
  const c = connectionFromQuery(url);
  if (c instanceof Response) return c;
  try {
    const body = (await req.json()) as Pick<EditorLager, 'lagerkennung' | 'mandant' | 'gaenge'>;
    const plaetze = deriveEditorPlaetze(body);
    const pool = await poolFor(c);
    const gefunden = await matchSage(pool, body.mandant, body.lagerkennung);
    return Response.json({
      plaetze: plaetze.map((p) => ({ ...p, gefunden: gefunden.has(`${p.dim1};${p.dim2};${p.dim3}`) })),
    });
  } catch (err) {
    console.error('[api/editor/vorschau]', err);
    return Response.json({ error: String((err as Error).message) }, { status: 500 });
  }
}

async function handleAnzeige(req: Request, url: URL): Promise<Response> {
  const db = url.searchParams.get('db') ?? '';
  const mandantRaw = url.searchParams.get('mandant');
  const mandant = mandantRaw ? Number(mandantRaw) : NaN;
  if (!Number.isFinite(mandant)) return Response.json({ error: 'mandant fehlt' }, { status: 400 });
  try {
    if (db === PERF_ID) {
      if (req.method === 'GET') return Response.json(perfAnzeige.get(mandant) ?? DEFAULT_STOCK_ANZEIGE);
      if (req.method === 'PUT') {
        perfAnzeige.set(mandant, normalizeStockAnzeige(await req.json()));
        return new Response(null, { status: 204 });
      }
      return new Response('Not Found', { status: 404 });
    }
    const c = connectionFromQuery(url);
    if (c instanceof Response) return c;
    const pool = await poolFor(c);
    if (req.method === 'GET') return Response.json(await getAnzeigeConfig(pool, mandant));
    if (req.method === 'PUT') {
      await saveAnzeigeConfig(pool, mandant, normalizeStockAnzeige(await req.json()));
      return new Response(null, { status: 204 });
    }
    return new Response('Not Found', { status: 404 });
  } catch (err) {
    console.error('[api/anzeige]', err);
    return Response.json({ error: String((err as Error).message) }, { status: 500 });
  }
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3001),
  async fetch(req, srv) {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/api/buchung/ws') {
      if (srv.upgrade(req)) return;
      return new Response('WebSocket Upgrade fehlgeschlagen', { status: 400 });
    }
    if (req.method === 'POST' && url.pathname === '/api/buchung') {
      try {
        const body = (await req.json()) as unknown;
        const evt = parseBuchung(body);
        if (!evt) return Response.json({ error: 'Ungültige Buchung' }, { status: 400 });
        ring.push(evt);
        publishBuchung(server, evt);
        return new Response(null, { status: 204 });
      } catch (err) {
        console.error('[api/buchung]', err);
        return Response.json({ error: String((err as Error).message) }, { status: 500 });
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/dbs') {
      try {
        const conns = listConnections();
        const items = await Promise.all(
          conns.map(async (c) => ({
            id: c.id,
            name: c.name,
            mandanten: await mandanten(c).catch(() => []),
          })),
        );
        items.push({ id: PERF_ID, name: 'Perf-Lager (generiert)', mandanten: [1] });
        return Response.json({ dbs: items });
      } catch (err) {
        console.error('[api/dbs]', err);
        return Response.json({ error: String((err as Error).message) }, { status: 500 });
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/lager') {
      const db = url.searchParams.get('db') ?? 'default';
      const mandantRaw = url.searchParams.get('mandant');
      const mandant = mandantRaw ? Number(mandantRaw) : undefined;
      if (db === PERF_ID) {
        return Response.json(perfLagerDaten(perfOrte(), perfSeed()));
      }
      const c = findConnection(db);
      if (!c) return Response.json({ error: `Unbekannte Datenbank '${db}'` }, { status: 400 });
      // Keine erreichbare DB → automatisch das Perf-Lager laden (fallback-Flag für den Client).
      const daten = await lagerMitPerfFallback(
        () => loadLager(c, mandant),
        () => perfLagerDaten(perfOrte(), perfSeed()),
      );
      return Response.json(daten);
    }
    if (url.pathname === '/api/editor/lager' || /^\/api\/editor\/lager\/\d+$/.test(url.pathname)) {
      return handleEditorLager(req, url);
    }
    if (req.method === 'POST' && url.pathname === '/api/editor/vorschau') {
      return handleEditorVorschau(req, url);
    }
    if (url.pathname === '/api/anzeige') {
      return handleAnzeige(req, url);
    }
    return new Response('Not Found', { status: 404 });
  },
  websocket: {
    open(ws) {
      ws.subscribe(BUCHUNGEN_TOPIC);
      ws.send(JSON.stringify({ type: 'replay', events: ring.snapshot() }));
    },
    message() {},
    close(ws) {
      ws.unsubscribe(BUCHUNGEN_TOPIC);
    },
  },
});

console.log(`[server] lager-api auf http://localhost:${server.port}`);
