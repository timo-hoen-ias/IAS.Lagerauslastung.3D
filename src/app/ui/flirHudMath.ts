/** Pure HUD-Mathematik (getrennt für Vitest). */

export const HUD_PX_PER_DEG = 6;
export const HUD_TAPE_SPREAD = 60; // Grad links/rechts vom Mittelpunkt
export const HUD_TAPE_STEP = 5;
export const HUD_TAPE_CONTENT_PX = HUD_TAPE_SPREAD * 2 * HUD_PX_PER_DEG; // 720

export function mod360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Kamera-Yaw (rad, drei.js) → Kurs in Grad [0,360). */
export function yawToHeading(yaw: number): number {
  return mod360((yaw * 180) / Math.PI);
}

/** Kürzester (signierter) Winkelunterschied a - b in Grad, Bereich [-180,180]. */
export function degDiff(a: number, b: number): number {
  const d = mod360(a - b);
  return d > 180 ? d - 360 : d;
}

export type TapeItem = { deg: number; x: number; major: boolean };

/** Kompass-Band um `headingDeg` herum; x in px relativ zur Bandmitte (HUD_PX_PER_DEG). */
export function tapeItems(
  headingDeg: number,
  pxPerDeg = HUD_PX_PER_DEG,
  spreadDeg = HUD_TAPE_SPREAD,
  stepDeg = HUD_TAPE_STEP,
): TapeItem[] {
  const center = Math.round(headingDeg);
  const first = Math.ceil((center - spreadDeg) / stepDeg) * stepDeg;
  const items: TapeItem[] = [];
  for (let d = first; d <= center + spreadDeg; d += stepDeg) {
    items.push({ deg: mod360(d), x: degDiff(d, center) * pxPerDeg, major: mod360(d) % 10 === 0 });
  }
  return items;
}

/** 3-stelliges Kursformat, z. B. 7 → "007". */
export function fmtHeading(deg: number): string {
  return String(Math.round(mod360(deg)) % 360).padStart(3, '0');
}

/** Knoten (aus m/s) auf HUD-Größe trimmen. */
export function knotsFromMs(ms: number): number {
  return Math.max(0, ms * 1.943844);
}

export function fmtInt(n: number): string {
  return String(Math.max(0, Math.round(n)));
}
