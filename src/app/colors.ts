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
export const FLOOR = '#7a7a7a';
export const GRID_CELL = '#8a8a8a';
export const GRID_SECTION = '#e8e8e8';
export const LINE_WHITE = '#f2f2f2';
