import { useEffect, useMemo, useRef } from 'react';
import { getTransform, useBuchungen, usePlayer } from '../store';
import { bookingFlashes, platzIndex } from '../article';
import type { PlacedRack } from '../scene/transform';
import DragPanel from './DragPanel';

const MIN_REDRAW_MS = 100;
const MOVE_EPS = 0.05;
const CANVAS_SIZE = 176;
const RADAR_PING_MS = 1600;

/**
 * Einmalige Migration beim Laden: die alte Radar-Standardposition (oben links) räumt die neue
 * (unten links, s. `defaultPos` unten) sonst nicht auf, weil eine gespeicherte Position immer
 * Vorrang vor `defaultPos` hat — nur eine nie manuell verschobene Position wird zurückgesetzt.
 */
try {
  const raw = localStorage.getItem('wm-panel-minimap');
  if (raw) {
    const p = JSON.parse(raw) as { x?: number; y?: number };
    if (p.x === 70 && p.y === 66) localStorage.removeItem('wm-panel-minimap');
  }
} catch {
  /* Speicher nicht verfügbar – ignorieren */
}

/** Throttle: nur neu zeichnen, wenn sich Spieler/Regal genug bewegt haben ODER das Intervall abgelaufen ist. */
export function minimapRedrawDue(last: { x: number; z: number; yaw: number; t: number } | null, x: number, z: number, yaw: number, now: number): boolean {
  if (!last) return true;
  const moved = Math.hypot(x - last.x, z - last.z) + Math.abs(yaw - last.yaw);
  return moved > MOVE_EPS || now - last.t >= MIN_REDRAW_MS;
}

/** Skalierung, mit der alle Regale ins Radar-Quadrat der Kantenlänge `size` passen. */
export function computeMinimapScale(racks: PlacedRack[], size: number): number {
  if (racks.length === 0) return 1;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const r of racks) {
    minX = Math.min(minX, r.position[0] - r.size.w / 2);
    maxX = Math.max(maxX, r.position[0] + r.size.w / 2);
    minZ = Math.min(minZ, r.position[2] - r.size.d / 2);
    maxZ = Math.max(maxZ, r.position[2] + r.size.d / 2);
  }
  return Math.min(size / Math.max(maxX - minX, 1), size / Math.max(maxZ - minZ, 1)) * 0.85;
}

/** Wandelt eine Weltposition in Radar-Pixel um (gleiche Kamera-relative Drehung/Skalierung wie beim Canvas-Zeichnen). */
export function worldToMinimap(wx: number, wz: number, player: { x: number; z: number; yaw: number }, scale: number, size: number): { x: number; y: number } {
  const a = player.yaw + Math.PI;
  const dx = (wx - player.x) * scale;
  const dz = (wz - player.z) * scale;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return {
    x: size / 2 + cos * dx - sin * dz,
    y: size / 2 + sin * dx + cos * dz,
  };
}

export default function Minimap({ racks, visible }: { racks: PlacedRack[]; visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const player = usePlayer();
  const buchungen = useBuchungen();
  const last = useRef<{ x: number; z: number; yaw: number; t: number } | null>(null);

  const scale = useMemo(() => computeMinimapScale(racks, CANVAS_SIZE), [racks]);
  const platzIdx = useMemo(() => platzIndex(racks), [racks]);
  const pings = useMemo(() => {
    const now = Date.now();
    return bookingFlashes(platzIdx, buchungen, (key) => getTransform(key)).filter((f) => now - f.start < RADAR_PING_MS);
  }, [platzIdx, buchungen]);

  useEffect(() => {
    const now = performance.now();
    if (!minimapRedrawDue(last.current, player.x, player.z, player.yaw, now)) return;
    last.current = { x: player.x, z: player.z, yaw: player.yaw, t: now };

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (racks.length === 0) return;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(player.yaw + Math.PI);
    ctx.scale(scale, scale);
    ctx.translate(-player.x, -player.z);

    for (const rack of racks) {
      ctx.save();
      ctx.translate(rack.position[0], rack.position[2]);
      ctx.rotate(rack.rotY);
      ctx.fillStyle = '#a6b0bf';
      ctx.globalAlpha = 0.75;
      ctx.fillRect(-rack.size.w / 2, -rack.size.d / 2, rack.size.w, rack.size.d);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    ctx.restore();

    ctx.fillStyle = '#45d8c8';
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2 - 6);
    ctx.lineTo(W / 2 - 4, H / 2 + 4);
    ctx.lineTo(W / 2 + 4, H / 2 + 4);
    ctx.closePath();
    ctx.fill();
  }, [player, racks, scale]);

  if (!visible) return null;

  return (
    <DragPanel
      id="minimap"
      className="pointer-events-none z-[15] h-[200px] w-[200px] rounded-full border border-line bg-panel/95 shadow-2xl shadow-black/50 backdrop-blur"
      defaultPos={() => ({ x: 70, y: Math.max(70, window.innerHeight - 252) })}
    >
      <div className="pointer-events-none absolute inset-2 rounded-full border border-white/5" />
      <div className="pointer-events-none absolute inset-5 rounded-full border border-white/5" />
      <div className="pointer-events-none absolute inset-3 overflow-hidden rounded-full">
        <div className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(from_0deg,rgba(69,216,200,0.28),transparent_28%)] [animation-duration:4s]" />
        <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className="relative" />
        {pings.map((p) => {
          const pos = worldToMinimap(p.w.x, p.w.z, player, scale, CANVAS_SIZE);
          return (
            <div
              key={p.key}
              className="animate-radar-ping absolute h-2.5 w-2.5 rounded-full border-[1.5px]"
              style={{ left: pos.x, top: pos.y, borderColor: p.color }}
            />
          );
        })}
      </div>
      <div className="absolute bottom-2.5 left-0 right-0 text-center font-mono text-[9px] uppercase tracking-widest text-ink-faint">Radar</div>
    </DragPanel>
  );
}
