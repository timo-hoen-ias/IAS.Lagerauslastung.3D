import sql from 'mssql';
import { LAGER_SQL, PLAETZE_SQL, attachBestaende, groupLagerorte } from './query';
import type { LagerDaten } from '../shared/types';

const config: sql.config = {
  server: process.env.MSSQL_SERVER ?? 'localhost',
  database: process.env.MSSQL_DATABASE ?? 'oldemoreweabfd',
  user: process.env.MSSQL_USER ?? 'sa',
  password: process.env.MSSQL_PASSWORD ?? 'Start11!',
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 10_000,
  requestTimeout: 30_000,
  pool: { max: 5, min: 1, idleTimeoutMillis: 60_000 },
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;
function pool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect();
  }
  return poolPromise;
}

async function loadLager(): Promise<LagerDaten> {
  const p = await pool();
  const [plaetze, bestaende] = await Promise.all([
    p.request().query<Record<string, unknown>>(PLAETZE_SQL),
    p.request().query<Record<string, unknown>>(LAGER_SQL),
  ]);
  const data = groupLagerorte(plaetze.recordset as Record<string, unknown>[]);
  attachBestaende(data, bestaende.recordset as Record<string, unknown>[]);
  return data;
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3001),
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/api/lager') {
      try {
        return Response.json(await loadLager());
      } catch (err) {
        console.error('[api/lager]', err);
        return Response.json({ error: String((err as Error).message) }, { status: 500 });
      }
    }
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`[server] lager-api auf http://localhost:${server.port}`);
