import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BASE_H, LEVEL_GAP, POST, rackFrame } from './layout';

/** Eine positionierte und skalierte Einheitsbox (Bauplan für merged Geometrie). */
export type BoxDesc = { pos: [number, number, number]; size: [number, number, number] };

/**
 * Merged mehrere positionierte Boxen zu EINER Geometrie (wenige Draw-Calls).
 * Normals werden nach der nicht-uniformen Skalierung neu berechnet.
 */
export function mergeBoxes(boxes: BoxDesc[]): THREE.BufferGeometry | null {
  if (boxes.length === 0) return null;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const geos = boxes.map(({ pos, size }) => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    m.compose(p.set(pos[0], pos[1], pos[2]), q, s.set(size[0], size[1], size[2]));
    g.applyMatrix4(m);
    g.computeVertexNormals();
    return g;
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return merged;
}

export type RackParts = {
  dark: BoxDesc[]; // Sockel + Regalböden
  grey: BoxDesc[]; // 4 Eckpfosten
  top: BoxDesc[]; // Abdeckplatte (transparent)
};

/** Regalrahmen als Box-Baupläne; ersetzt pro-Teil-Meshes durch 3 merged Draw-Calls. */
export function rackParts(size: { w: number; h: number; d: number }, levels: number, cellH: number): RackParts {
  const dark: BoxDesc[] = [{ pos: [0, 0.04, 0], size: [size.w + 0.3, 0.08, size.d + 0.3] }];
  for (let iy = 0; iy < levels; iy++) {
    dark.push({
      pos: [0, BASE_H + iy * (cellH + LEVEL_GAP) - 0.02, 0],
      size: [size.w + 0.1, 0.04, size.d + 0.1],
    });
  }
  const frame = rackFrame(size);
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  const grey: BoxDesc[] = corners.map(([sx, sz]) => ({
    pos: [sx * (size.w / 2 - POST / 2), frame.post.pos[1], sz * (size.d / 2 - POST / 2)],
    size: frame.post.size,
  }));
  return { dark, grey, top: [{ pos: frame.top.pos, size: frame.top.size }] };
}

const LINE = 0.06;
const LINE_H = 0.02;
const FRAME_GAP = 0.25;
const CORNER_OFF = 0.02;
const CORNER_LEN = 0.22;
const CORNER_LINE = 0.04;
const HALO_EXTRA = 0.12;

/** Bodenrahmen-Glühlinien als merged Box-Baupläne (core + halo). */
export function floorFrameBoxes(w: number, d: number): { core: BoxDesc[]; halo: BoxDesc[] } {  const fw = w + FRAME_GAP * 2;
  const fd = d + FRAME_GAP * 2;
  const halfW = fw / 2;
  const halfD = fd / 2;
  const core: BoxDesc[] = [];
  const halo: BoxDesc[] = [];
  const add = (c: BoxDesc, h: BoxDesc) => {
    core.push(c);
    halo.push(h);
  };
  add({ pos: [0, 0, -halfD], size: [fw, LINE_H, LINE] }, { pos: [0, 0, -halfD], size: [fw, LINE_H, LINE + HALO_EXTRA] });
  add({ pos: [0, 0, halfD], size: [fw, LINE_H, LINE] }, { pos: [0, 0, halfD], size: [fw, LINE_H, LINE + HALO_EXTRA] });
  add({ pos: [-halfW, 0, 0], size: [LINE, LINE_H, fd] }, { pos: [-halfW, 0, 0], size: [LINE + HALO_EXTRA, LINE_H, fd] });
  add({ pos: [halfW, 0, 0], size: [LINE, LINE_H, fd] }, { pos: [halfW, 0, 0], size: [LINE + HALO_EXTRA, LINE_H, fd] });
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  for (const [sx, sz] of corners) {
    const cx = sx * (halfW + CORNER_OFF);
    const cz = sz * (halfD + CORNER_OFF);
    add(
      { pos: [cx - (sx * CORNER_LEN) / 2, 0, cz], size: [CORNER_LEN, LINE_H, CORNER_LINE] },
      { pos: [cx - (sx * CORNER_LEN) / 2, 0, cz], size: [CORNER_LEN, LINE_H, CORNER_LINE + HALO_EXTRA] },
    );
    add(
      { pos: [cx, 0, cz - (sz * CORNER_LEN) / 2], size: [CORNER_LINE, LINE_H, CORNER_LEN] },
      { pos: [cx, 0, cz - (sz * CORNER_LEN) / 2], size: [CORNER_LINE + HALO_EXTRA, LINE_H, CORNER_LEN] },
    );
  }
  return { core, halo };
}

const WALL_THICK = 0.25;
const WALL_PIER = 0.4;
const WALL_SILL = 1.0;
const WALL_HEADER = 0.6;
const WALL_BAY = 3.0;

export type WallBounds = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Pfeiler-Positionen im Bay-Raster entlang einer Wandkante (inkl. Start + Ende). */
function wallPiers(from: number, to: number, bay: number): number[] {
  const out: number[] = [];
  for (let x = from; x <= to - 1e-6; x += bay) out.push(x);
  if (out[out.length - 1]! < to - 1e-6) out.push(to);
  return out;
}

/** Fensteröffnungen (Lücken) zwischen aufeinanderfolgenden Pfeilern eines Rasters. */
function wallBays(positions: number[], pier: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < positions.length - 1; i++) {
    const a = positions[i]! + pier / 2;
    const b = positions[i + 1]! - pier / 2;
    if (b > a) out.push([a, b]);
  }
  return out;
}

/** Lager-Umfassungswand als Box-Baupläne: Brüstung + Dachbalken + Pfeiler im Raster, dazwischen Fensteröffnungen. */
export function wallBoxes(
  bounds: WallBounds,
  height: number,
  opts: { thick?: number; pier?: number; sill?: number; header?: number; bay?: number } = {},
): BoxDesc[] {
  const { minX, maxX, minZ, maxZ } = bounds;
  const thick = opts.thick ?? WALL_THICK;
  const pier = opts.pier ?? WALL_PIER;
  const sill = opts.sill ?? WALL_SILL;
  const header = opts.header ?? WALL_HEADER;
  const bay = opts.bay ?? WALL_BAY;
  const boxes: BoxDesc[] = [];

  const zWall = (z: number) => {
    const len = maxX - minX;
    const mid = (minX + maxX) / 2;
    boxes.push({ pos: [mid, sill / 2, z], size: [len, sill, thick] });
    boxes.push({ pos: [mid, height - header / 2, z], size: [len, header, thick] });
    for (const px of wallPiers(minX, maxX, bay)) boxes.push({ pos: [px, height / 2, z], size: [pier, height, thick] });
  };
  const xWall = (x: number) => {
    const len = maxZ - minZ;
    const mid = (minZ + maxZ) / 2;
    boxes.push({ pos: [x, sill / 2, mid], size: [thick, sill, len] });
    boxes.push({ pos: [x, height - header / 2, mid], size: [thick, header, len] });
    for (const pz of wallPiers(minZ, maxZ, bay)) boxes.push({ pos: [x, height / 2, pz], size: [thick, height, pier] });
  };

  zWall(minZ);
  zWall(maxZ);
  xWall(minX);
  xWall(maxX);
  return boxes;
}

const WALL_GLASS_INSET = 0.08;

/**
 * Verglasung der Fensteröffnungen zwischen den Pfeilern (s. `wallBoxes`): sonst
 * scheint dort der dunkle Szenenhintergrund durch und die Halle wirkt „löchrig"/
 * schwarz statt umschlossen. Eigene, transparente Geometrie statt Teil von
 * `wallBoxes`, damit die Wand ihre eigene (opake) Material-Instanz behält.
 */
export function wallGlassBoxes(
  bounds: WallBounds,
  height: number,
  opts: { thick?: number; pier?: number; sill?: number; header?: number; bay?: number } = {},
): BoxDesc[] {
  const { minX, maxX, minZ, maxZ } = bounds;
  const thick = opts.thick ?? WALL_THICK;
  const pier = opts.pier ?? WALL_PIER;
  const sill = opts.sill ?? WALL_SILL;
  const header = opts.header ?? WALL_HEADER;
  const bay = opts.bay ?? WALL_BAY;
  const boxes: BoxDesc[] = [];

  const windowH = height - sill - header;
  if (windowH <= 0) return boxes;
  const midY = sill + windowH / 2;
  const glassThick = Math.max(0.02, thick - WALL_GLASS_INSET * 2);

  const zWall = (z: number) => {
    for (const [a, b] of wallBays(wallPiers(minX, maxX, bay), pier)) {
      boxes.push({ pos: [(a + b) / 2, midY, z], size: [b - a, windowH, glassThick] });
    }
  };
  const xWall = (x: number) => {
    for (const [a, b] of wallBays(wallPiers(minZ, maxZ, bay), pier)) {
      boxes.push({ pos: [x, midY, (a + b) / 2], size: [glassThick, windowH, b - a] });
    }
  };

  zWall(minZ);
  zWall(maxZ);
  xWall(minX);
  xWall(maxX);
  return boxes;
}

export type WallSegmentBoxOpts = { thick?: number; pier?: number; sill?: number; header?: number; bay?: number };

/**
 * Wandsegment-Baupläne (Brüstung + Dachbalken + Pfeiler, s. `wallBoxes`) entlang der lokalen
 * X-Achse, zentriert um 0 (Wanddicke entlang Z) — für beliebig gedrehte Wandkanten (Editor-
 * Grundriss-Polygon), die anders als `wallBoxes` nicht achsenparallel sein müssen. Wird je
 * Kante per `<mesh position rotation-y>` platziert, da `mergeBoxes` keine Rotation je Box kennt.
 */
export function wallSegmentBoxes(length: number, height: number, opts: WallSegmentBoxOpts = {}): BoxDesc[] {
  const thick = opts.thick ?? WALL_THICK;
  const pier = opts.pier ?? WALL_PIER;
  const sill = opts.sill ?? WALL_SILL;
  const header = opts.header ?? WALL_HEADER;
  const bay = opts.bay ?? WALL_BAY;
  const boxes: BoxDesc[] = [];
  boxes.push({ pos: [0, sill / 2, 0], size: [length, sill, thick] });
  boxes.push({ pos: [0, height - header / 2, 0], size: [length, header, thick] });
  for (const px of wallPiers(-length / 2, length / 2, bay)) boxes.push({ pos: [px, height / 2, 0], size: [pier, height, thick] });
  return boxes;
}

/** Verglasung eines Wandsegments, s. `wallSegmentBoxes`/`wallGlassBoxes` (gleiches lokales Koordinatensystem). */
export function wallSegmentGlassBoxes(length: number, height: number, opts: WallSegmentBoxOpts = {}): BoxDesc[] {
  const thick = opts.thick ?? WALL_THICK;
  const pier = opts.pier ?? WALL_PIER;
  const sill = opts.sill ?? WALL_SILL;
  const header = opts.header ?? WALL_HEADER;
  const bay = opts.bay ?? WALL_BAY;
  const windowH = height - sill - header;
  if (windowH <= 0) return [];
  const midY = sill + windowH / 2;
  const glassThick = Math.max(0.02, thick - WALL_GLASS_INSET * 2);
  return wallBays(wallPiers(-length / 2, length / 2, bay), pier).map(([a, b]) => ({
    pos: [(a + b) / 2, midY, 0],
    size: [b - a, windowH, glassThick],
  }));
}
