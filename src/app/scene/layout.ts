import type { Lagerort, Lagerplatz } from '../../shared/types';

export const CELL_W = 1.2;
export const CELL_H = 0.6;
export const CELL_D = 1.0;
export const GAP = 0.15;
export const BASE_H = 0.25;
export const TOP_H = 0.25;
export const MAX_ROW_WIDTH = 55;
export const AISLE_X = 2.5;
export const AISLE_Z = 6;
export const POST = 0.08;
export const FRAME_CLEAR = 0.03;
export const TOP_OVERHANG = 0.1;

const pitch = (n: number, step: number) => n * step - GAP;

export type RackPlacement = {
  ort: Lagerort;
  cols: number;
  levels: number;
  depth: number;
  size: { w: number; h: number; d: number };
  origin: [number, number, number];
};

export function rackMetrics(ort: Lagerort) {
  const { d1, d2, d3 } = ort.dims;
  const cols = Math.max(1, d1);
  let levels: number;
  let depth: number;
  if (d3 > 0) {
    levels = Math.max(1, d2);
    depth = d3;
  } else if (d2 > 0) {
    levels = 1;
    depth = d2;
  } else {
    levels = 1;
    depth = 1;
  }
  const w = pitch(cols, CELL_W + GAP);
  const d = pitch(depth, CELL_D + GAP);
  const h = BASE_H + pitch(levels, CELL_H + GAP) + TOP_H;
  return { cols, levels, depth, size: { w, h, d } as const };
}

export type RackFrame = {
  post: { size: [number, number, number]; pos: [number, number, number] };
  top: { size: [number, number, number]; pos: [number, number, number] };
};

/** Rahmenbauteile mit klarem Abstand zu den Zellen und zueinander (kein Z-Fighting). */
export function rackFrame(size: { w: number; h: number; d: number }): RackFrame {
  const postH = size.h - TOP_H - FRAME_CLEAR;
  return {
    post: { size: [POST, postH, POST], pos: [0, FRAME_CLEAR + postH / 2, 0] },
    top: {
      size: [size.w + 2 * TOP_OVERHANG, TOP_H, size.d + 2 * TOP_OVERHANG],
      pos: [0, size.h - TOP_H / 2 + FRAME_CLEAR, 0],
    },
  };
}

export function layoutRacks(orte: Lagerort[]): RackPlacement[] {
  const out: RackPlacement[] = [];
  let x = 0;
  let rowZ = 0;
  let rowMaxD = 0;
  for (const ort of orte) {
    const m = rackMetrics(ort);
    if (x > 0 && x + m.size.w > MAX_ROW_WIDTH) {
      x = 0;
      rowZ += rowMaxD + AISLE_Z;
      rowMaxD = 0;
    }
    out.push({ ort, ...m, origin: [x + m.size.w / 2, 0, rowZ + m.size.d / 2] });
    x += m.size.w + AISLE_X;
    rowMaxD = Math.max(rowMaxD, m.size.d);
  }
  return centerRacks(out);
}

/** Verschiebt alle Racks, sodass der Schwerpunkt der Bounding-Box bei (0,0) liegt. */
export function centerRacks(placements: RackPlacement[]): RackPlacement[] {
  const b = rackBounds(placements);
  if (!b) return placements;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  if (cx === 0 && cz === 0) return placements;
  return placements.map((p) => ({ ...p, origin: [p.origin[0] - cx, 0, p.origin[2] - cz] }));
}

export function rackBounds(placements: RackPlacement[]): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  if (placements.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of placements) {
    minX = Math.min(minX, p.origin[0] - p.size.w / 2);
    maxX = Math.max(maxX, p.origin[0] + p.size.w / 2);
    minZ = Math.min(minZ, p.origin[2] - p.size.d / 2);
    maxZ = Math.max(maxZ, p.origin[2] + p.size.d / 2);
  }
  return { minX, maxX, minZ, maxZ };
}

export function cellLocalPosition(platz: Lagerplatz, rack: Pick<RackPlacement, 'cols' | 'levels' | 'depth'>): [number, number, number] {
  const px = CELL_W + GAP;
  const py = CELL_H + GAP;
  const pz = CELL_D + GAP;
  const { dim } = platz;
  const isCatchAll = dim.d1 === 0 && dim.d2 === 0 && dim.d3 === 0;

  let ix: number;
  let iy: number;
  let iz: number;
  if (isCatchAll) {
    ix = 0;
    iy = 0;
    iz = 0;
  } else if (rack.levels > 1) {
    ix = Math.max(0, dim.d1 - 1);
    iy = Math.max(1, dim.d2) - 1;
    iz = Math.max(0, dim.d3 - 1);
  } else if (rack.depth > 1) {
    ix = Math.max(0, dim.d1 - 1);
    iy = 0;
    iz = Math.max(1, dim.d2 > 0 ? dim.d2 : dim.d3) - 1;
  } else {
    ix = Math.max(0, dim.d1 - 1);
    iy = 0;
    iz = 0;
  }

  const lx = (ix - (rack.cols - 1) / 2) * px;
  const lz = (iz - (rack.depth - 1) / 2) * pz;
  const ly = BASE_H + iy * py + CELL_H / 2;

  if (isCatchAll && rack.depth > 1) {
    return [lx, ly, -(rack.depth / 2) * pz - CELL_D - 0.25];
  }
  return [lx, ly, lz];
}
