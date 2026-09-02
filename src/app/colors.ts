export const TECHNIK_PALETTE: { technik: string; color: string; label: string }[] = [
  { technik: 'LTD0ST', color: '#7f8c8d', label: 'Einzelplatzlager (0D)' },
  { technik: 'LTD1UF', color: '#2980b9', label: 'Freilager (1D)' },
  { technik: 'LTD1BL', color: '#16a085', label: 'Blocklager (1D)' },
  { technik: 'LTD2SF', color: '#f39c12', label: 'Flächenlager (2D)' },
  { technik: 'LTD3HR', color: '#8e44ad', label: 'Hochregallager (3D)' },
];

const FALLBACK_COLORS = ['#c0392b', '#27ae60', '#d35400', '#16a085', '#e67e22', '#34495e', '#2c3e50'];

export function technikColor(technik: string): string {
  const hit = TECHNIK_PALETTE.find((t) => t.technik === technik);
  if (hit) return hit.color;
  let hash = 0;
  for (const ch of technik) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]!;
}

export function technikLabel(technik: string): string {
  const hit = TECHNIK_PALETTE.find((t) => t.technik === technik);
  if (hit) return hit.label;
  const dim = /LTD(\d)/.exec(technik)?.[1];
  return dim ? `Lagerart (${dim}D)` : technik;
}

/** Bestandsfarbe nach der konfigurierbaren Anzeige (Standard/Schwellenwert, s. `shared/anzeige.ts` und `useStockAnzeigeConfig()`). */
export { resolveStockColor as stockColor } from '../shared/anzeige';

export const RACK_GREY = '#8f8f8f';
/** Hallenwände (Sage- und Editor-Lager gemeinsam, s. Walls.tsx/EditorLagerOverlayScene.tsx). */
export const WALL_COLOR = '#4d5766';
export const WALL_GLASS_COLOR = '#5a6d82';
/** Spiegelt `--color-accent` (index.css) für 3D-Materialien, die keine CSS-Variablen lesen können. */
export const ACCENT = '#45d8c8';
/** Neutrales Grau statt der bisherigen dunklen Blau-Töne — besserer Kontrast zu Regalen/Wänden. */
export const FLOOR = '#3c3c3c';
export const GRID_CELL = '#333a44';
export const GRID_SECTION = '#e8e8e8';
export const LINE_WHITE = '#f2f2f2';

// Halleninnenraum statt Freiluft-Szene (Lager-Cockpit-Theme, siehe CLAUDE.md).
export const VOID = '#0a0d12';
export const FOG = '#0c1016';
