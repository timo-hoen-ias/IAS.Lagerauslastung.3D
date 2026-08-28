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
export function floorFrameBoxes(w: number, d: number): { core: BoxDesc[]; halo: BoxDesc[] } {
  const fw = w + FRAME_GAP * 2;
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
