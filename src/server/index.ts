import sql from 'mssql';
import { LAGER_SQL, PLAETZE_SQL, attachBestaende, groupLagerorte } from './query';
import { findConnection, listConnections, type DbConnection } from './connections';
import type { LagerDaten } from '../shared/types';

const pools = new Map<string, Promise<sql.ConnectionPool>>();

function poolFor(c: DbConnection): Promise<sql.ConnectionPool> {
  let p = pools.get(c.id);
  if (!p) {
    p = new sql.ConnectionPool({
      server: c.server,
      database: c.database,
      user: c.user,
      password: c.password,
      options: { encrypt: false, trustServerCertificate: true },
      connectionTimeout: 10_000,
      requestTimeout: 30_000,
      pool: { max: 5, min: 1, idleTimeoutMillis: 60_000 },
    }).connect();
    pools.set(c.id, p);
  }
  return p;
}

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

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3001),
  async fetch(req) {
    const url = new URL(req.url);
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
      const c = findConnection(db);
      if (!c) return Response.json({ error: `Unbekannte Datenbank '${db}'` }, { status: 400 });
      try {
        return Response.json(await loadLager(c, mandant));
      } catch (err) {
        console.error('[api/lager]', err);
        return Response.json({ error: String((err as Error).message) }, { status: 500 });
      }
    }
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`[server] lager-api auf http://localhost:${server.port}`);
