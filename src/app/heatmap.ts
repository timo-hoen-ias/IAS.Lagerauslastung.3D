import type { LagerDaten } from '../shared/types';

export type HeatmapPoint = { platzId: number; n: number };
export type HeatmapArtikel = { artikelnummer: string; n: number };
export type HeatmapDaten = { points: HeatmapPoint[]; byArtikel: HeatmapArtikel[] };

export type HeatmapPresetId =
  | '15min'
  | '1h'
  | '2h'
  | 'today'
  | 'yesterday'
  | '24h'
  | '7d'
  | 'week'
  | 'month'
  | 'custom';

export const HEATMAP_PRESETS: { id: HeatmapPresetId; label: string }[] = [
  { id: '15min', label: 'Letzte 15 Minuten' },
  { id: '1h', label: 'Letzte Stunde' },
  { id: '2h', label: 'Letzte 2 Stunden' },
  { id: 'today', label: 'Heute' },
  { id: 'yesterday', label: 'Gestern' },
  { id: '24h', label: 'Letzte 24 Stunden' },
  { id: '7d', label: 'Letzte 7 Tage' },
  { id: 'week', label: 'Diese Woche' },
  { id: 'month', label: 'Dieser Monat' },
  { id: 'custom', label: 'Frei wählen' },
];

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Zeitfenster [from, to] in epoch-ms für einen Preset (custom: voreingestellt auf „letzte Stunde“). */
export function presetRange(id: HeatmapPresetId, now = Date.now()): { from: number; to: number } {
  const d = new Date(now);
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  switch (id) {
    case '15min':
      return { from: now - 15 * MIN, to: now };
    case '1h':
      return { from: now - HOUR, to: now };
    case '2h':
      return { from: now - 2 * HOUR, to: now };
    case 'today':
      return { from: startOfDay, to: now };
    case 'yesterday':
      return { from: startOfDay - DAY, to: startOfDay };
    case '24h':
      return { from: now - DAY, to: now };
    case '7d':
      return { from: now - 7 * DAY, to: now };
    case 'week': {
      const dow = (d.getDay() + 6) % 7; // Montag = 0
      return { from: startOfDay - dow * DAY, to: now };
    }
    case 'month':
      return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: now };
    case 'custom':
      return { from: now - HOUR, to: now };
  }
}

/** Farbstopps der Heatmap-Rampe: kalt (blau) → heiß (gelb). */
const HEAT_STOPS: { t: number; c: [number, number, number] }[] = [
  { t: 0, c: [0x00, 0x33, 0xcc] },
  { t: 1 / 3, c: [0x00, 0xb8, 0xff] },
  { t: 2 / 3, c: [0x66, 0xe6, 0x4a] },
  { t: 1, c: [0xff, 0xd4, 0x00] },
];

/** CSS-Verlauf der Rampe (für die Legende). */
export const HEAT_GRADIENT_CSS =
  'linear-gradient(90deg, #0033cc, #00b8ff, #66e64a, #ffd400)';

/** Linearer Übergang zwischen den Farbstopps für t ∈ [0,1]. */
function ramp(t: number): [number, number, number] {
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const a = HEAT_STOPS[i - 1]!;
    const b = HEAT_STOPS[i]!;
    if (t <= b.t) {
      const k = (t - a.t) / (b.t - a.t);
      return [
        Math.round(a.c[0] + (b.c[0] - a.c[0]) * k),
        Math.round(a.c[1] + (b.c[1] - a.c[1]) * k),
        Math.round(a.c[2] + (b.c[2] - a.c[2]) * k),
      ];
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1]!.c;
}

const toHex = (v: number): string => v.toString(16).padStart(2, '0');

/**
 * Wärmefarbskala Blau → Gelb (klassische Heatmap-Rampe).
 * t=0 (niedrigste Intensität) ist Blau, t=1 (Maximum) ist Gelb.
 */
export function heatColor(n: number, max: number): string {
  if (max <= 0) return '#1e3a5f';
  const t = Math.min(1, n / max);
  const [r, g, b] = ramp(t);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Normierte Intensität 0..1 für Größe/Opazität der Wolkenpunkte. */
export function heatIntensity(n: number, max: number): number {
  return max <= 0 ? 0 : Math.min(1, n / max);
}

/** Summiert Buchungszahlen pro Lagerort (platzId → lagerkennung), absteigend sortiert. */
export function aggregateByLager(points: HeatmapPoint[], data: LagerDaten): { lager: string; n: number }[] {
  const platzOrt = new Map<number, string>();
  for (const ort of data.lagerorte) {
    for (const p of ort.plaetze) platzOrt.set(p.platzId, ort.lagerkennung);
  }
  const by = new Map<string, number>();
  for (const pt of points) {
    const key = platzOrt.get(pt.platzId) ?? `Platz ${pt.platzId}`;
    by.set(key, (by.get(key) ?? 0) + pt.n);
  }
  return [...by.entries()]
    .map(([lager, n]) => ({ lager, n }))
    .sort((a, b) => b.n - a.n);
}
