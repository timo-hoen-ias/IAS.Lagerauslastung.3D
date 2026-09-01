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

export function stockColor(total: number, hasStock: boolean): string {
  if (!hasStock || total <= 0) return '#5d6673';
  if (total < 100) return '#27ae60';
  if (total < 500) return '#f1c40f';
  return '#e74c3c';
}

export const RACK_GREY = '#8f8f8f';
/** Spiegelt `--color-accent` (index.css) für 3D-Materialien, die keine CSS-Variablen lesen können. */
export const ACCENT = '#45d8c8';
export const FLOOR = '#20242b';
export const GRID_CELL = '#333a44';
export const GRID_SECTION = '#e8e8e8';
export const LINE_WHITE = '#f2f2f2';

// Halleninnenraum statt Freiluft-Szene (Lager-Cockpit-Theme, siehe CLAUDE.md).
export const VOID = '#0a0d12';
export const FOG = '#0c1016';
