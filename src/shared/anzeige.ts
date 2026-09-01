/**
 * Konfiguration der Bestands-Einfärbung im 3D-Viewer, pro Mandant serverseitig
 * gespeichert (`src/server/anzeigeStore.ts`). Zwei Modi:
 *
 *   'standard' — binär: kein Bestand → `leerFarbe`, Bestand vorhanden → `standardFarbe`
 *                (z. B. das bestehende grau/hellblau).
 *   'schwelle' — Bestand wird je nach Mengeneinheit (KG, Stück, …) gegen konfigurierbare
 *                Stufen geprüft (z. B. < 100 kg gelb, 100–500 kg orange, ≥ 500 kg rot).
 *                Fehlt für die Mengeneinheit eines Bestands eine Regel, wird auf
 *                `standardFarbe` zurückgefallen.
 */

/** Eine Farbstufe: ab `min` (inklusive) gilt `farbe`, bis zur nächsthöheren Stufe. */
export type StockStufe = { min: number; farbe: string };

/** Stufen-Set für eine Sage-Mengeneinheit (z. B. "KG"), aufsteigend nach `min` sortiert. */
export type StockSchwelleRegel = { einheit: string; stufen: StockStufe[] };

export type StockAnzeigeModus = 'standard' | 'schwelle';

export type StockAnzeigeConfig = {
  modus: StockAnzeigeModus;
  leerFarbe: string;
  standardFarbe: string;
  schwellen: StockSchwelleRegel[];
};

export const DEFAULT_STOCK_ANZEIGE: StockAnzeigeConfig = {
  modus: 'standard',
  leerFarbe: '#5d6673',
  standardFarbe: '#5ab9e8',
  schwellen: [
    {
      einheit: 'KG',
      stufen: [
        { min: 0, farbe: '#f1c40f' },
        { min: 100, farbe: '#e67e22' },
        { min: 500, farbe: '#e74c3c' },
      ],
    },
  ],
};

function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v);
}

function normalizeStufen(raw: unknown): StockStufe[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is { min: unknown; farbe: unknown } => typeof s === 'object' && s !== null)
    .map((s) => ({ min: Number((s as { min: unknown }).min) || 0, farbe: isHexColor((s as { farbe: unknown }).farbe) ? (s as { farbe: string }).farbe : DEFAULT_STOCK_ANZEIGE.standardFarbe }))
    .sort((a, b) => a.min - b.min);
}

/**
 * Bereinigt eine aus JSON (DB oder Request-Body) gelesene Konfiguration: fehlende/kaputte
 * Felder fallen auf die Defaults zurück, statt dass fehlerhafte Nutzereingaben oder ältere
 * Datensätze die App zum Absturz bringen.
 */
export function normalizeStockAnzeige(raw: unknown): StockAnzeigeConfig {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_STOCK_ANZEIGE;
  const r = raw as Partial<StockAnzeigeConfig>;
  return {
    modus: r.modus === 'schwelle' ? 'schwelle' : 'standard',
    leerFarbe: isHexColor(r.leerFarbe) ? r.leerFarbe : DEFAULT_STOCK_ANZEIGE.leerFarbe,
    standardFarbe: isHexColor(r.standardFarbe) ? r.standardFarbe : DEFAULT_STOCK_ANZEIGE.standardFarbe,
    schwellen: Array.isArray(r.schwellen)
      ? r.schwellen
          .filter((s): s is StockSchwelleRegel => typeof s === 'object' && s !== null && typeof (s as StockSchwelleRegel).einheit === 'string')
          .map((s) => ({ einheit: s.einheit, stufen: normalizeStufen(s.stufen) }))
      : [],
  };
}

export type StockLegendRow = { label: string; color: string };

/** Legenden-Zeilen für die aktuelle Konfiguration (HUD-Hilfe-Popover) — spiegelt exakt, was `resolveStockColor` liefert. */
export function stockLegend(config: StockAnzeigeConfig): StockLegendRow[] {
  const rows: StockLegendRow[] = [{ label: 'leer', color: config.leerFarbe }];
  if (config.modus === 'standard') {
    rows.push({ label: 'Bestand vorhanden', color: config.standardFarbe });
    return rows;
  }
  for (const regel of config.schwellen) {
    regel.stufen.forEach((stufe, i) => {
      const next = regel.stufen[i + 1];
      const bereich = next ? `${stufe.min}–${next.min}` : `≥ ${stufe.min}`;
      rows.push({ label: `${regel.einheit} ${bereich}`, color: stufe.farbe });
    });
  }
  return rows;
}

/** Farbe für einen Bestandswert nach der aktuellen Konfiguration. `einheit` bestimmt im Schwellen-Modus die Regel. */
export function resolveStockColor(total: number, hasStock: boolean, config: StockAnzeigeConfig, einheit?: string): string {
  if (!hasStock || total <= 0) return config.leerFarbe;
  if (config.modus === 'standard') return config.standardFarbe;
  const regel = config.schwellen.find((s) => s.einheit === einheit);
  if (!regel || regel.stufen.length === 0) return config.standardFarbe;
  let farbe = regel.stufen[0]!.farbe;
  for (const stufe of regel.stufen) {
    if (total >= stufe.min) farbe = stufe.farbe;
    else break;
  }
  return farbe;
}
