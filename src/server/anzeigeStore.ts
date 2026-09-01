import sql from 'mssql';
import { DEFAULT_STOCK_ANZEIGE, normalizeStockAnzeige, type StockAnzeigeConfig } from '../shared/anzeige';

const TABLE = 'IAS_BestandsAnzeige';
let schemaReady: Promise<void> | null = null;

/** Legt die Anzeige-Konfigurations-Tabelle einmalig an (eigenes Schema, wie `editorStore.ts`). */
function ensureSchema(pool: sql.ConnectionPool): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool
      .request()
      .query(
        `
      IF OBJECT_ID('dbo.${TABLE}', 'U') IS NULL
      CREATE TABLE dbo.${TABLE} (
        Mandant INT NOT NULL PRIMARY KEY,
        ConfigJson NVARCHAR(MAX) NOT NULL,
        GeaendertAm DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      )
    `,
      )
      .then(() => undefined);
  }
  return schemaReady;
}

export async function getAnzeigeConfig(pool: sql.ConnectionPool, mandant: number): Promise<StockAnzeigeConfig> {
  await ensureSchema(pool);
  const r = await pool
    .request()
    .input('mandant', sql.Int, mandant)
    .query<{ ConfigJson: string }>(`SELECT ConfigJson FROM dbo.${TABLE} WHERE Mandant = @mandant`);
  const row = r.recordset[0];
  if (!row) return DEFAULT_STOCK_ANZEIGE;
  try {
    return normalizeStockAnzeige(JSON.parse(row.ConfigJson));
  } catch {
    return DEFAULT_STOCK_ANZEIGE;
  }
}

export async function saveAnzeigeConfig(pool: sql.ConnectionPool, mandant: number, config: StockAnzeigeConfig): Promise<void> {
  await ensureSchema(pool);
  await pool
    .request()
    .input('mandant', sql.Int, mandant)
    .input('config', sql.NVarChar(sql.MAX), JSON.stringify(config))
    .query(
      `
      MERGE dbo.${TABLE} AS target
      USING (SELECT @mandant AS Mandant) AS src ON target.Mandant = src.Mandant
      WHEN MATCHED THEN UPDATE SET ConfigJson = @config, GeaendertAm = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (Mandant, ConfigJson) VALUES (@mandant, @config);
    `,
    );
}
