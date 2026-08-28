export type DbConnection = {
  id: string;
  name: string;
  server: string;
  database: string;
  user: string;
  password: string;
};

function envList(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Benannte Verbindungen, konfigurierbar über Env-Variablen.
 * Fallback: eine Verbindung `default` aus den klassischen MSSQL_*-Variablen.
 *
 * Mehrere DBs:
 *   WM_DBS=produktion,test
 *   WM_DB_produktion_SERVER=...
 *   WM_DB_produktion_DATABASE=...
 *   WM_DB_produktion_USER=...
 *   WM_DB_produktion_PASSWORD=...
 */
export function listConnections(): DbConnection[] {
  const ids = envList('WM_DBS', ['default']);
  return ids.map((id) => {
    const prefix = `WM_DB_${id}_`;
    const server = process.env[`${prefix}SERVER`] ?? process.env.MSSQL_SERVER ?? 'localhost';
    const database = process.env[`${prefix}DATABASE`] ?? process.env.MSSQL_DATABASE ?? 'oldemoreweabfd';
    const user = process.env[`${prefix}USER`] ?? process.env.MSSQL_USER ?? 'sa';
    const password = process.env[`${prefix}PASSWORD`] ?? process.env.MSSQL_PASSWORD ?? 'Start11!';
    return {
      id,
      name: id === 'default' ? process.env.WM_DB_default_NAME ?? database : database,
      server,
      database,
      user,
      password,
    };
  });
}

export function findConnection(id: string): DbConnection | undefined {
  return listConnections().find((c) => c.id === id);
}
