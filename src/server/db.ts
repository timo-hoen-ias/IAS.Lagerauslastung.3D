import sql from 'mssql';
import type { DbConnection } from './connections';

const pools = new Map<string, Promise<sql.ConnectionPool>>();

/** Gemeinsamer Connection-Pool je benannter DB-Verbindung (Sage-Zugriff + Editor-Tabellen). */
export function poolFor(c: DbConnection): Promise<sql.ConnectionPool> {
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
