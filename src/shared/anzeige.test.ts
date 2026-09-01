import { describe, expect, it } from 'vitest';
import { DEFAULT_STOCK_ANZEIGE, normalizeStockAnzeige, resolveStockColor, stockLegend, type StockAnzeigeConfig } from './anzeige';

describe('resolveStockColor', () => {
  it('liefert leerFarbe ohne Bestand, unabhängig vom Modus', () => {
    expect(resolveStockColor(0, false, DEFAULT_STOCK_ANZEIGE)).toBe(DEFAULT_STOCK_ANZEIGE.leerFarbe);
    expect(resolveStockColor(5, false, DEFAULT_STOCK_ANZEIGE)).toBe(DEFAULT_STOCK_ANZEIGE.leerFarbe);
    expect(resolveStockColor(0, true, DEFAULT_STOCK_ANZEIGE)).toBe(DEFAULT_STOCK_ANZEIGE.leerFarbe);
  });

  it('Standard-Modus: einheitliche Farbe sobald Bestand vorhanden ist, unabhängig von der Menge', () => {
    const cfg: StockAnzeigeConfig = { ...DEFAULT_STOCK_ANZEIGE, modus: 'standard' };
    expect(resolveStockColor(1, true, cfg)).toBe(cfg.standardFarbe);
    expect(resolveStockColor(10_000, true, cfg)).toBe(cfg.standardFarbe);
  });

  it('Schwellen-Modus: wählt die höchste erreichte Stufe der passenden Mengeneinheit', () => {
    const cfg: StockAnzeigeConfig = {
      ...DEFAULT_STOCK_ANZEIGE,
      modus: 'schwelle',
      schwellen: [{ einheit: 'KG', stufen: [{ min: 0, farbe: 'gelb' }, { min: 100, farbe: 'orange' }, { min: 500, farbe: 'rot' }] }],
    };
    expect(resolveStockColor(50, true, cfg, 'KG')).toBe('gelb');
    expect(resolveStockColor(100, true, cfg, 'KG')).toBe('orange');
    expect(resolveStockColor(499, true, cfg, 'KG')).toBe('orange');
    expect(resolveStockColor(500, true, cfg, 'KG')).toBe('rot');
    expect(resolveStockColor(9000, true, cfg, 'KG')).toBe('rot');
  });

  it('Schwellen-Modus: fällt auf standardFarbe zurück, wenn die Mengeneinheit keine Regel hat', () => {
    const cfg: StockAnzeigeConfig = { ...DEFAULT_STOCK_ANZEIGE, modus: 'schwelle' };
    expect(resolveStockColor(10, true, cfg, 'STK')).toBe(cfg.standardFarbe);
    expect(resolveStockColor(10, true, cfg, undefined)).toBe(cfg.standardFarbe);
  });
});

describe('stockLegend', () => {
  it('Standard-Modus: leer + eine Bestand-Zeile', () => {
    const cfg: StockAnzeigeConfig = { ...DEFAULT_STOCK_ANZEIGE, modus: 'standard' };
    expect(stockLegend(cfg)).toEqual([
      { label: 'leer', color: cfg.leerFarbe },
      { label: 'Bestand vorhanden', color: cfg.standardFarbe },
    ]);
  });

  it('Schwellen-Modus: eine Zeile je Stufe, mit Bereich zur nächsten Stufe bzw. "≥" bei der letzten', () => {
    const cfg: StockAnzeigeConfig = {
      ...DEFAULT_STOCK_ANZEIGE,
      modus: 'schwelle',
      schwellen: [{ einheit: 'KG', stufen: [{ min: 0, farbe: 'gelb' }, { min: 100, farbe: 'orange' }, { min: 500, farbe: 'rot' }] }],
    };
    expect(stockLegend(cfg)).toEqual([
      { label: 'leer', color: cfg.leerFarbe },
      { label: 'KG 0–100', color: 'gelb' },
      { label: 'KG 100–500', color: 'orange' },
      { label: 'KG ≥ 500', color: 'rot' },
    ]);
  });
});

describe('normalizeStockAnzeige', () => {
  it('übernimmt eine vollständige, gültige Konfiguration unverändert', () => {
    const cfg: StockAnzeigeConfig = {
      modus: 'schwelle',
      leerFarbe: '#111111',
      standardFarbe: '#222222',
      schwellen: [{ einheit: 'KG', stufen: [{ min: 0, farbe: '#333333' }] }],
    };
    expect(normalizeStockAnzeige(cfg)).toEqual(cfg);
  });

  it('fällt bei fehlenden/kaputten Feldern auf Defaults zurück', () => {
    expect(normalizeStockAnzeige(null)).toEqual(DEFAULT_STOCK_ANZEIGE);
    expect(normalizeStockAnzeige({})).toEqual({ ...DEFAULT_STOCK_ANZEIGE, schwellen: [] });
    expect(normalizeStockAnzeige({ modus: 'kaputt', leerFarbe: 'not-a-color' }).modus).toBe('standard');
    expect(normalizeStockAnzeige({ leerFarbe: 'not-a-color' }).leerFarbe).toBe(DEFAULT_STOCK_ANZEIGE.leerFarbe);
  });

  it('sortiert Stufen aufsteigend nach min und verwirft ungültige Einträge', () => {
    const raw = { modus: 'schwelle', schwellen: [{ einheit: 'KG', stufen: [{ min: 500, farbe: '#e74c3c' }, { min: 0, farbe: '#f1c40f' }, 'kaputt'] }] };
    const out = normalizeStockAnzeige(raw);
    expect(out.schwellen[0]!.stufen.map((s) => s.min)).toEqual([0, 500]);
  });
});
