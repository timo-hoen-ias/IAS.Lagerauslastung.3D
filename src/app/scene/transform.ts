import type { Lagerort } from '../../shared/types';
import type { RackPlacement } from './layout';

export type RackTransform = { x: number; z: number; rotY: number; scale: number };

export const IDENTITY_TRANSFORM: RackTransform = { x: 0, z: 0, rotY: 0, scale: 1 };
export const SCALE_MIN = 0.5;
export const SCALE_MAX = 2;

export type PlacedRack = {
  key: string;
  ort: Lagerort;
  cols: number;
  levels: number;
  depth: number;
  position: [number, number, number];
  rotY: number;
  size: { w: number; h: number; d: number };
};
/** Rundet auf den nächsten ganzen Meter (1x1-Raster). */
export function snap1(n: number): number {
  return Math.round(n);
}

/** Rundet auf das nächste 45°-Vielfache (Grad). */
export function snap45(deg: number): number {
  return Math.round(deg / 45) * 45;
}

export function round05(n: number): number {
  return Math.round(n * 2) / 2;
}

export function clampScale(s: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, s));
}

export function rotateRack(t: RackTransform, deltaDeg: number): RackTransform {
  return { ...t, rotY: (snap45((t.rotY * 180) / Math.PI + deltaDeg) * Math.PI) / 180 };
}

export function moveRack(t: RackTransform, dx: number, dz: number): RackTransform {
  return { ...t, x: snap1(t.x + dx), z: snap1(t.z + dz) };
}

export function scaleRack(t: RackTransform, factor: number): RackTransform {
  return { ...t, scale: clampScale(round05(factor)) };
}

export function applyTransform(base: RackPlacement, t: RackTransform): PlacedRack {
  return {
    key: base.ort.lagerkennung,
    ort: base.ort,
    cols: base.cols,
    levels: base.levels,
    depth: base.depth,
    position: [base.origin[0] + t.x, 0, base.origin[2] + t.z],
    rotY: t.rotY,
    size: { w: base.size.w * t.scale, h: base.size.h * t.scale, d: base.size.d * t.scale },
  };
}

export function rackAabb(placed: PlacedRack): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const hx = Math.abs(Math.cos(placed.rotY)) * (placed.size.w / 2) + Math.abs(Math.sin(placed.rotY)) * (placed.size.d / 2);
  const hz = Math.abs(Math.sin(placed.rotY)) * (placed.size.w / 2) + Math.abs(Math.cos(placed.rotY)) * (placed.size.d / 2);
  return {
    minX: placed.position[0] - hx,
    maxX: placed.position[0] + hx,
    minZ: placed.position[2] - hz,
    maxZ: placed.position[2] + hz,
  };
}

export function dist2d(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}
