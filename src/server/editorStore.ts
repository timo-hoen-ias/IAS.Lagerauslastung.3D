import sql from 'mssql';
import type { EditorLager } from '../shared/editor';

const TABLE = 'IAS_Lager';
let schemaReady: Promise<void> | null = null;

/** Legt die Editor-Tabelle einmalig an (eigenes Schema, unabhängig von den KHK*-Sage-Tabellen). */
function ensureSchema(pool: sql.ConnectionPool): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.request().query(`
      IF OBJECT_ID('dbo.${TABLE}', 'U') IS NULL
      CREATE TABLE dbo.${TABLE} (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        Mandant INT NOT NULL,
        Lagerkennung NVARCHAR(50) NOT NULL,
        Grundriss NVARCHAR(MAX) NOT NULL,
        Gaenge NVARCHAR(MAX) NOT NULL,
        ErstelltAm DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        GeaendertAm DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      )
    `).then(() => undefined);
  }
  return schemaReady;
}

export type LagerListItem = { id: string; name: string; mandant: number; lagerkennung: string };

export async function listLager(pool: sql.ConnectionPool): Promise<LagerListItem[]> {
  await ensureSchema(pool);
  const r = await pool
    .request()
    .query<{ Id: number; Name: string; Mandant: number; Lagerkennung: string }>(
      `SELECT Id, Name, Mandant, Lagerkennung FROM dbo.${TABLE} ORDER BY Name`,
    );
  return r.recordset.map((row) => ({ id: String(row.Id), name: row.Name, mandant: row.Mandant, lagerkennung: row.Lagerkennung }));
}

export async function getLager(pool: sql.ConnectionPool, id: string, connectionId: string): Promise<EditorLager | null> {
  await ensureSchema(pool);
  const r = await pool
    .request()
    .input('id', sql.Int, Number(id))
    .query<{ Id: number; Name: string; Mandant: number; Lagerkennung: string; Grundriss: string; Gaenge: string }>(
      `SELECT Id, Name, Mandant, Lagerkennung, Grundriss, Gaenge FROM dbo.${TABLE} WHERE Id = @id`,
    );
  const row = r.recordset[0];
  if (!row) return null;
  return {
    id: String(row.Id),
    name: row.Name,
    mandant: row.Mandant,
    lagerkennung: row.Lagerkennung,
    connectionId,
    grundriss: JSON.parse(row.Grundriss),
    gaenge: JSON.parse(row.Gaenge),
  };
}

type LagerInput = Omit<EditorLager, 'id' | 'connectionId'>;

export async function createLager(pool: sql.ConnectionPool, lager: LagerInput): Promise<string> {
  await ensureSchema(pool);
  const r = await pool
    .request()
    .input('name', sql.NVarChar, lager.name)
    .input('mandant', sql.Int, lager.mandant)
    .input('kennung', sql.NVarChar, lager.lagerkennung)
    .input('grundriss', sql.NVarChar(sql.MAX), JSON.stringify(lager.grundriss))
    .input('gaenge', sql.NVarChar(sql.MAX), JSON.stringify(lager.gaenge))
    .query<{ Id: number }>(
      `INSERT INTO dbo.${TABLE} (Name, Mandant, Lagerkennung, Grundriss, Gaenge) OUTPUT INSERTED.Id VALUES (@name, @mandant, @kennung, @grundriss, @gaenge)`,
    );
  return String(r.recordset[0]!.Id);
}

export async function updateLager(pool: sql.ConnectionPool, id: string, lager: LagerInput): Promise<void> {
  await ensureSchema(pool);
  await pool
    .request()
    .input('id', sql.Int, Number(id))
    .input('name', sql.NVarChar, lager.name)
    .input('mandant', sql.Int, lager.mandant)
    .input('kennung', sql.NVarChar, lager.lagerkennung)
    .input('grundriss', sql.NVarChar(sql.MAX), JSON.stringify(lager.grundriss))
    .input('gaenge', sql.NVarChar(sql.MAX), JSON.stringify(lager.gaenge))
    .query(
      `UPDATE dbo.${TABLE} SET Name = @name, Mandant = @mandant, Lagerkennung = @kennung, Grundriss = @grundriss, Gaenge = @gaenge, GeaendertAm = SYSUTCDATETIME() WHERE Id = @id`,
    );
}

/** Menge der in Sage tatsächlich vorhandenen Dim1;Dim2;Dim3-Kombinationen für diese Lagerkennung. */
export async function matchSage(pool: sql.ConnectionPool, mandant: number, lagerkennung: string): Promise<Set<string>> {
  const r = await pool
    .request()
    .input('mandant', sql.Int, mandant)
    .input('kennung', sql.NVarChar, lagerkennung)
    .query<{ Dimension1: number; Dimension2: number; Dimension3: number }>(
      `SELECT Dimension1, Dimension2, Dimension3 FROM KHKLagerplaetze WHERE Mandant = @mandant AND Lagerkennung = @kennung`,
    );
  return new Set(r.recordset.map((row) => `${row.Dimension1};${row.Dimension2};${row.Dimension3}`));
}
