import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BuchungEvent } from '../shared/types';

const require = createRequire(import.meta.url);

type Stmt = {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
};

export type SqliteDb = {
  exec(sql: string): void;
  query(sql: string): Stmt;
};

export type HeatmapPoint = { platzId: number; n: number };
export type ArtikelCount = { artikelnummer: string; n: number };
export type HeatmapErgebnis = { points: HeatmapPoint[]; byArtikel: ArtikelCount[] };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS buchungen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mandant INTEGER NOT NULL,
  artikelnummer TEXT NOT NULL,
  menge REAL NOT NULL,
  bewegung TEXT,
  herkunftPlatzId INTEGER,
  zielPlatzId INTEGER,
  herkunftLager TEXT,
  zielLager TEXT,
  herkunftCarrierId INTEGER,
  zielCarrierId INTEGER,
  typ INTEGER,
  benutzer TEXT,
  quelle TEXT,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_buchungen_ts ON buchungen(ts);
CREATE INDEX IF NOT EXISTS idx_buchungen_platz ON buchungen(herkunftPlatzId, zielPlatzId);
`;

/** Lädt bun:sqlite unter Bun, sonst node:sqlite (Vitest läuft unter Node). */
function openDbImpl(path: string): SqliteDb {
  try {
    const { Database } = require('bun:sqlite') as {
      Database: new (p: string) => { exec(s: string): void; query(s: string): Stmt; close(): void };
    };
    const db = new Database(path);
    return { exec: (s) => db.exec(s), query: (s) => db.query(s) };
  } catch {
    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (p: string) => { exec(s: string): void; prepare(s: string): Stmt; close(): void };
    };
    const db = new DatabaseSync(path);
    return { exec: (s) => db.exec(s), query: (s) => db.prepare(s) };
  }
}

/** Öffnet die SQLite-Buchungsdatenbank und legt Schema + Indizes an. */
export function openDb(path: string): SqliteDb {
  mkdirSync(dirname(path), { recursive: true });
  const db = openDbImpl(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

let _db: SqliteDb | null = null;

/** Singleton der Buchungsdatenbank (lazy, damit Tests ohne Datei-Seiteneffekt importieren). */
export function getDb(): SqliteDb {
  return (_db ??= openDb(process.env.WM_BUCHUNG_DB ?? 'data/buchungen.sqlite'));
}

/** Legt eine Buchung in der lokalen SQLite ab (inkl. Zeitstempel + Lagerzuordnung). */
export function insertBuchung(db: SqliteDb, e: BuchungEvent): void {
  db.query(
    `INSERT INTO buchungen
      (mandant, artikelnummer, menge, bewegung, herkunftPlatzId, zielPlatzId,
       herkunftLager, zielLager, herkunftCarrierId, zielCarrierId, typ, benutzer, quelle, ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    e.mandant,
    e.artikelnummer,
    e.menge,
    e.bewegung,
    e.herkunftPlatzId,
    e.zielPlatzId,
    e.herkunftLager ?? null,
    e.zielLager ?? null,
    e.herkunftCarrierId,
    e.zielCarrierId,
    e.typ,
    e.benutzer ?? '',
    e.quelle ?? null,
    e.ts,
  );
}

const MANDANT_FILTER = (mandant?: number): { sql: string; params: number[] } =>
  mandant != null ? { sql: 'AND mandant = ?', params: [mandant] } : { sql: '', params: [] };

/**
 * Aggregiert Buchungen eines Zeitraums pro Platz (Herkunft + Ziel) und pro Artikel.
 * Punkte absteigend nach Anzahl, Artikel auf die Top 5 begrenzt.
 */
export function heatmapBuchungen(db: SqliteDb, from: number, to: number, mandant?: number): HeatmapErgebnis {
  const f = MANDANT_FILTER(mandant);
  const points = db
    .query(
      `SELECT platzId, COUNT(*) AS n FROM (
         SELECT herkunftPlatzId AS platzId, mandant FROM buchungen WHERE ts BETWEEN ? AND ?
         UNION ALL
         SELECT zielPlatzId AS platzId, mandant FROM buchungen WHERE ts BETWEEN ? AND ?
       )
       WHERE platzId IS NOT NULL ${f.sql}
       GROUP BY platzId ORDER BY n DESC`,
    )
    .all(from, to, from, to, ...f.params) as HeatmapPoint[];
  const byArtikel = db
    .query(
      `SELECT artikelnummer, COUNT(*) AS n FROM buchungen
       WHERE ts BETWEEN ? AND ? ${f.sql}
       GROUP BY artikelnummer ORDER BY n DESC LIMIT 5`,
    )
    .all(from, to, ...f.params) as ArtikelCount[];
  return { points, byArtikel };
}
