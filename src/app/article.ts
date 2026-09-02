import type { LagerDaten, Lagerplatz, Lagerort } from '../shared/types';
import { cellLocalPosition, cellSize, gangPlätze } from './scene/layout';
import type { PlacedRack, RackTransform } from './scene/transform';

export type ArtikelRef = { artikelnummer: string; bezeichnung1: string; gesamt: number; einheit: string };

/** Alle im geladenen Bestand vorkommenden Artikel, dedupliziert und sortiert. */
export function alleArtikel(data: LagerDaten): ArtikelRef[] {
  const map = new Map<string, { bezeichnung1: string; gesamt: number; einheit: string }>();
  for (const ort of data.lagerorte) {
    for (const p of ort.plaetze) {
      for (const b of p.bestaende) {
        const e = map.get(b.artikelnummer);
        if (e) {
          e.gesamt += b.bestand;
          if (!e.bezeichnung1) e.bezeichnung1 = b.bezeichnung1;
          if (!e.einheit) e.einheit = b.einheit;
        } else {
          map.set(b.artikelnummer, { bezeichnung1: b.bezeichnung1, gesamt: b.bestand, einheit: b.einheit });
        }
      }
    }
  }
  return [...map.entries()]
    .map(([artikelnummer, v]) => ({ artikelnummer, ...v }))
    .sort((a, b) => a.artikelnummer.localeCompare(b.artikelnummer, 'de'));
}

/**
 * Autocomplete-Filter: Präfix-Treffer der Artikelnummer zuerst, dann
 * enthaltende Treffer (Nummer oder Bezeichnung). Case-insensitive.
 */
export function filterArtikel(liste: ArtikelRef[], query: string, limit = 20): ArtikelRef[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const treffer: { r: ArtikelRef; prefix: boolean }[] = [];
  for (const r of liste) {
    const art = r.artikelnummer.toLowerCase();
    if (art.includes(q) || r.bezeichnung1.toLowerCase().includes(q)) {
      treffer.push({ r, prefix: art.startsWith(q) });
    }
  }
  treffer.sort(
    (a, b) =>
      Number(b.prefix) - Number(a.prefix) ||
      a.r.artikelnummer.localeCompare(b.r.artikelnummer, 'de') ||
      a.r.bezeichnung1.localeCompare(b.r.bezeichnung1, 'de'),
  );
  return treffer.slice(0, limit).map((t) => t.r);
}

export type ArtikelPlatz = { ort: Lagerort; platz: Lagerplatz; bestand: number; einheit: string };

/** Alle Lagerplätze, auf denen ein Artikel liegt, sortiert nach Lagerort und Platz. */
export function artikelLagerplätze(data: LagerDaten, artikelnummer: string): ArtikelPlatz[] {
  const out: ArtikelPlatz[] = [];
  for (const ort of data.lagerorte) {
    for (const p of ort.plaetze) {
      const b = p.bestaende.find((b) => b.artikelnummer === artikelnummer);
      if (b) out.push({ ort, platz: p, bestand: b.bestand, einheit: b.einheit });
    }
  }
  out.sort((a, b) => a.ort.lagerkennung.localeCompare(b.ort.lagerkennung, 'de') || a.platz.platzId - b.platz.platzId);
  return out;
}

export type PlatzRef = { platz: Lagerplatz; bestand: number };

/** platzIds der übergebenen Plätze, auf denen der Artikel liegt (für die 3D-Hervorhebung). */
export function platzIdsMitArtikel(plaetze: Lagerplatz[], artikelnummer: string | null): Set<number> {
  const set = new Set<number>();
  if (!artikelnummer) return set;
  for (const p of plaetze) {
    if (p.bestaende.some((b) => b.artikelnummer === artikelnummer)) set.add(p.platzId);
  }
  return set;
}

/** Plätze einer Regal-Instanz, die den Artikel enthalten. */
export function plätzeMitArtikel(rack: PlacedRack, artikelnummer: string): PlatzRef[] {
  const out: PlatzRef[] = [];
  for (const p of gangPlätze(rack.ort, rack.kind, rack.gang)) {
    const b = p.bestaende.find((b) => b.artikelnummer === artikelnummer);
    if (b) out.push({ platz: p, bestand: b.bestand });
  }
  return out;
}

export type CellWorld = { x: number; y: number; z: number; w: number; d: number; h: number };

/** Weltposition einer Zelle inkl. Rotation (rotY) und Skalierung des Regals. */
export function platzWorld(placed: PlacedRack, t: RackTransform, platz: Lagerplatz): CellWorld {
  const box = cellSize(platz);
  const [lx, ly, lz] = cellLocalPosition(platz, placed);
  const c = Math.cos(placed.rotY);
  const s = Math.sin(placed.rotY);
  return {
    x: placed.position[0] + c * lx * t.scale.x - s * lz * t.scale.z,
    y: ly * t.scale.y,
    z: placed.position[2] + s * lx * t.scale.x + c * lz * t.scale.z,
    w: box.w * t.scale.x,
    d: box.d * t.scale.z,
    h: box.h * t.scale.y,
  };
}

// ---- Live-Buchungen → Blitz-Effekt -----------------------------------------

export type PlacedPlatz = { rack: PlacedRack; platz: Lagerplatz };

/**
 * Baut einmalig einen platzId→{rack, platz}-Index über alle Regal-Instanzen auf.
 * Ersetzt die linearen Scans (Racks × Plätze) von platzMitId durch O(1)-Lookups
 * für Live-Buchungen. Bei invaliden platzIds liefert Map.get() undefined → null.
 */
export function platzIndex(racks: PlacedRack[]): Map<number, PlacedPlatz> {
  const index = new Map<number, PlacedPlatz>();
  for (const r of racks) {
    for (const p of gangPlätze(r.ort, r.kind, r.gang)) {
      index.set(p.platzId, { rack: r, platz: p });
    }
  }
  return index;
}

export type PlatzIndex = Map<number, PlacedPlatz>;

/** Findet die Regal-Instanz zu einer PlatzId über den Index. */
export function platzMitId(index: PlatzIndex, platzId: number): PlacedPlatz | null {
  return index.get(platzId) ?? null;
}

export const FLASH_HERKUNFT_COLOR = '#ff9f43';
export const FLASH_ZIEL_COLOR = '#2ecc71';
export const FLASH_DURATION_MS = 1500;

export type FlashDef = {
  key: string;
  w: CellWorld;
  start: number;
  color: string;
  label: string;
};

/** Menge kompakt formatieren (Ganzzahl ohne Nachkommastellen). */
export function fmtMenge(menge: number): string {
  return Number.isInteger(menge) ? String(menge) : String(Math.round(menge * 100) / 100);
}

// ---- Bestandszeilen (Platz × Artikel) für Inspector-Tabellen ---------------

export type OrtRow = { platzId: number; platz: string; artikel: string; bezeichnung: string; bestand: number; einheit: string };

/** Zerlegt eine beliebige Platzmenge (Regal/Reihe/Gang/Lager) in Platz×Artikel-Zeilen für die Bestandstabelle. */
export function rowsFromPlaetze(plaetze: Lagerplatz[]): OrtRow[] {
  const rows: OrtRow[] = [];
  for (const p of plaetze) {
    if (p.bestaende.length === 0) continue;
    for (const b of p.bestaende) {
      rows.push({
        platzId: p.platzId,
        platz: p.kurz || `#${p.platzId}`,
        artikel: b.artikelnummer,
        bezeichnung: b.bezeichnung1,
        bestand: b.bestand,
        einheit: b.einheit,
      });
    }
  }
  rows.sort((a, b) => a.platzId - b.platzId || a.artikel.localeCompare(b.artikel, 'de'));
  return rows;
}

export type ArtikelGroupRow = { artikel: string; bezeichnung: string; bestand: number; plaetze: number; einheit: string };

/** Gruppiert Bestandszeilen nach Artikelnummer (Gesamtbestand + Anzahl Plätze) statt nach Platz. */
export function groupRowsByArtikel(rows: OrtRow[]): ArtikelGroupRow[] {
  const map = new Map<string, ArtikelGroupRow>();
  for (const r of rows) {
    const e = map.get(r.artikel);
    if (e) {
      e.bestand += r.bestand;
      e.plaetze += 1;
    } else {
      map.set(r.artikel, { artikel: r.artikel, bezeichnung: r.bezeichnung, bestand: r.bestand, plaetze: 1, einheit: r.einheit });
    }
  }
  return [...map.values()].sort((a, b) => a.artikel.localeCompare(b.artikel, 'de'));
}

type FlashBuchung = {
  id: number;
  artikelnummer: string;
  menge: number;
  herkunftPlatzId: number | null;
  zielPlatzId: number | null;
  ts: number;
};

/** Erzeugt pro Buchung bis zu zwei Blitze: Herkunft (warm, „-Menge") und Ziel (grün, „+Menge"). */
export function bookingFlashes(
  index: PlatzIndex,
  buchungen: FlashBuchung[],
  transformOf: (key: string) => RackTransform,
): FlashDef[] {
  const out: FlashDef[] = [];
  for (const b of buchungen) {
    const menge = fmtMenge(b.menge);
    if (b.herkunftPlatzId != null) {
      const hit = platzMitId(index, b.herkunftPlatzId);
      if (hit) {
        out.push({
          key: `${b.id}-h`,
          w: platzWorld(hit.rack, transformOf(hit.rack.key), hit.platz),
          start: b.ts,
          color: FLASH_HERKUNFT_COLOR,
          label: `${b.artikelnummer} -${menge}`,
        });
      }
    }
    if (b.zielPlatzId != null) {
      const hit = platzMitId(index, b.zielPlatzId);
      if (hit) {
        out.push({
          key: `${b.id}-z`,
          w: platzWorld(hit.rack, transformOf(hit.rack.key), hit.platz),
          start: b.ts,
          color: FLASH_ZIEL_COLOR,
          label: `${b.artikelnummer} +${menge}`,
        });
      }
    }
  }
  return out;
}
