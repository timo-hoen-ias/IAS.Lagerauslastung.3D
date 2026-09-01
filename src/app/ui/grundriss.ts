import type { Punkt } from '../../shared/editor';

export type ViewBox = { minX: number; minZ: number; w: number; h: number };

const PAD_M = 3;
const MIN_SIZE_M = 4;

/** Rechteck-Startform für ein neues Lager (30 × 20 m). */
export const RECHTECK_START: Punkt[] = [
  { x: 0, z: 0 },
  { x: 30, z: 0 },
  { x: 30, z: 20 },
  { x: 0, z: 20 },
];

/** Passender ViewBox (m) für das aktuelle Polygon, mit Rand. Leer → fester Startausschnitt. */
export function computeViewBox(points: Punkt[]): ViewBox {
  if (points.length === 0) return { minX: -2, minZ: -2, w: 34, h: 24 };
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return {
    minX: minX - PAD_M,
    minZ: minZ - PAD_M,
    w: Math.max(maxX - minX, MIN_SIZE_M) + 2 * PAD_M,
    h: Math.max(maxZ - minZ, MIN_SIZE_M) + 2 * PAD_M,
  };
}

/** Rasterlinien (m) im sichtbaren Ausschnitt, im Abstand von `step` Metern. */
export function gridLines(vb: ViewBox, step = 5): { x1: number; y1: number; x2: number; y2: number }[] {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const xStart = Math.ceil(vb.minX / step) * step || 0; // -0 vermeiden (Math.ceil(-0.6)*5 = -0)
  for (let x = xStart; x <= vb.minX + vb.w; x += step) {
    lines.push({ x1: x, y1: vb.minZ, x2: x, y2: vb.minZ + vb.h });
  }
  const zStart = Math.ceil(vb.minZ / step) * step || 0;
  for (let z = zStart; z <= vb.minZ + vb.h; z += step) {
    lines.push({ x1: vb.minX, y1: z, x2: vb.minX + vb.w, y2: z });
  }
  return lines;
}

/** Fläche eines (auch nicht-konvexen) Polygons via Gaußsche Trapezformel. */
export function polygonArea(points: Punkt[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) / 2;
}

/** Kürzester Abstand von `p` zur Strecke `a`–`b`. */
export function distanceToSegment(p: Punkt, a: Punkt, b: Punkt): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.z - a.z);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
}

/**
 * Fügt `punkt` an der Kante ein, die ihm am nächsten liegt (statt immer ans Ende
 * anzuhängen) — hält das Polygon beim Verfeinern der Form "einfach" (nicht
 * selbstüberschneidend).
 */
export function insertPointOnNearestEdge(points: Punkt[], punkt: Punkt): Punkt[] {
  if (points.length < 2) return [...points, punkt];
  let bestIndex = points.length - 1;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const d = distanceToSegment(punkt, a, b);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }
  const insertAt = bestIndex + 1;
  return [...points.slice(0, insertAt), punkt, ...points.slice(insertAt)];
}

/** Rundet auf Vielfache von `step` (m), ohne Fließkomma-Rauschen (z. B. 0,1 + 0,2). */
export function snapToGrid(v: number, step: number): number {
  return Math.round((Math.round(v / step) * step) * 1000) / 1000;
}

export function snapPoint(p: Punkt, step: number): Punkt {
  return { x: snapToGrid(p.x, step), z: snapToGrid(p.z, step) };
}

export type EdgeLabel = { x: number; z: number; length: number };

/** Mittelpunkt jeder Kante, leicht nach außen (vom Schwerpunkt weg) versetzt, für lesbare Maßangaben ohne Überlappung mit der Kante selbst. */
export function edgeLabels(points: Punkt[], offset = 0.6): EdgeLabel[] {
  if (points.length < 2) return [];
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cz = points.reduce((s, p) => s + p.z, 0) / points.length;
  const out: EdgeLabel[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const midX = (a.x + b.x) / 2;
    const midZ = (a.z + b.z) / 2;
    if (length === 0) {
      out.push({ x: midX, z: midZ, length: 0 });
      continue;
    }
    let nx = -dz / length;
    let nz = dx / length;
    if ((midX - cx) * nx + (midZ - cz) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    out.push({ x: midX + nx * offset, z: midZ + nz * offset, length });
  }
  return out;
}

export type NeighborSnap = { point: Punkt; snappedX: boolean; snappedZ: boolean };

/**
 * Rastet `candidate` auf die X- bzw. Z-Koordinate eines Nachbarpunkts ein, wenn
 * er innerhalb von `threshold` liegt — macht rechte Winkel/glatte Wände beim
 * Ziehen erreichbar, ohne Pixel-genau treffen zu müssen.
 */
export function snapToNeighbors(points: Punkt[], index: number, candidate: Punkt, threshold = 0.3): NeighborSnap {
  const n = points.length;
  if (n < 2) return { point: candidate, snappedX: false, snappedZ: false };
  const prev = points[(index - 1 + n) % n]!;
  const next = points[(index + 1) % n]!;
  let { x, z } = candidate;
  let snappedX = false;
  let snappedZ = false;
  for (const nb of [prev, next]) {
    if (Math.abs(nb.x - x) < threshold) {
      x = nb.x;
      snappedX = true;
    }
    if (Math.abs(nb.z - z) < threshold) {
      z = nb.z;
      snappedZ = true;
    }
  }
  return { point: { x, z }, snappedX, snappedZ };
}
