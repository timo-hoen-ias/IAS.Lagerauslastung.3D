import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export type PanelPos = { x: number; y: number };

const HANDLE_MARGIN = 40;

export function clampPanel(pos: PanelPos, vw: number, vh: number): PanelPos {
  return {
    x: Math.min(Math.max(pos.x, 0), Math.max(vw - HANDLE_MARGIN, 0)),
    y: Math.min(Math.max(pos.y, 0), Math.max(vh - 30, 0)),
  };
}

export function usePanelPos(
  id: string,
  defaultPos: () => PanelPos,
  onEnd?: () => void,
): {
  pos: PanelPos;
  startDrag: (sx: number, sy: number) => void;
  onHandleDown: (e: ReactPointerEvent<HTMLElement>) => void;
} {
  const [pos, setPos] = useState<PanelPos>(() => {
    try {
      const raw = localStorage.getItem(`wm-panel-${id}`);
      if (raw) {
        const p = JSON.parse(raw) as PanelPos;
        if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
      }
    } catch {
      /* ungültig – Standard */
    }
    return defaultPos();
  });
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    try {
      localStorage.setItem(`wm-panel-${id}`, JSON.stringify(pos));
    } catch {
      /* Speicher nicht verfügbar – ignorieren */
    }
  }, [id, pos]);

  const listeners = useRef<{ move: (ev: PointerEvent) => void; up: () => void } | null>(null);
  if (!listeners.current) {
    listeners.current = {
      move: (ev) => {
        const d = dragRef.current;
        if (!d) return;
        setPos(clampPanel({ x: d.ox + ev.clientX - d.sx, y: d.oy + ev.clientY - d.sy }, window.innerWidth, window.innerHeight));
      },
      up: () => {
        dragRef.current = null;
        window.removeEventListener('pointermove', listeners.current!.move);
        window.removeEventListener('pointerup', listeners.current!.up);
        onEndRef.current?.();
      },
    };
  }

  const startDrag = useCallback(
    (sx: number, sy: number) => {
      dragRef.current = { sx, sy, ox: pos.x, oy: pos.y };
      window.addEventListener('pointermove', listeners.current!.move);
      window.addEventListener('pointerup', listeners.current!.up);
    },
    [pos],
  );

  const onHandleDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* Capture nicht verfügbar – Window-Listener greifen trotzdem */
      }
      startDrag(e.clientX, e.clientY);
    },
    [startDrag],
  );

  return { pos, startDrag, onHandleDown };
}
