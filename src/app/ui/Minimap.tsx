import { useEffect, useRef } from 'react';
import { usePlayer } from '../store';
import type { PlacedRack } from '../scene/transform';
import DragPanel from './DragPanel';

const MIN_REDRAW_MS = 100;
const MOVE_EPS = 0.05;

/** Throttle: nur neu zeichnen, wenn sich Spieler/Regal genug bewegt haben ODER das Intervall abgelaufen ist. */
export function minimapRedrawDue(last: { x: number; z: number; yaw: number; t: number } | null, x: number, z: number, yaw: number, now: number): boolean {
  if (!last) return true;
  const moved = Math.hypot(x - last.x, z - last.z) + Math.abs(yaw - last.yaw);
  return moved > MOVE_EPS || now - last.t >= MIN_REDRAW_MS;
}

export default function Minimap({ racks, visible }: { racks: PlacedRack[]; visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const player = usePlayer();
  const last = useRef<{ x: number; z: number; yaw: number; t: number } | null>(null);

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
    const scale = Math.min(W / Math.max(maxX - minX, 1), H / Math.max(maxZ - minZ, 1)) * 0.85;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(player.yaw + Math.PI);
    ctx.scale(scale, scale);
    ctx.translate(-player.x, -player.z);

    for (const rack of racks) {
      ctx.save();
      ctx.translate(rack.position[0], rack.position[2]);
      ctx.rotate(rack.rotY);
      ctx.fillStyle = '#9a9a9a';
      ctx.globalAlpha = 0.75;
      ctx.fillRect(-rack.size.w / 2, -rack.size.d / 2, rack.size.w, rack.size.d);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    ctx.restore();

    ctx.fillStyle = '#7ec8ff';
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2 - 7);
    ctx.lineTo(W / 2 - 4, H / 2 + 5);
    ctx.lineTo(W / 2 + 4, H / 2 + 5);
    ctx.closePath();
    ctx.fill();
  }, [player, racks]);

  if (!visible) return null;

  return (
    <DragPanel id="minimap" className="minimap glass" defaultPos={() => ({ x: Math.max(10, window.innerWidth - 236), y: 56 })}>
      <canvas ref={canvasRef} width={220} height={220} />
      <div className="minimap-label">Minimap</div>
    </DragPanel>
  );
}
