import type { ReactNode } from 'react';
import { usePanelPos, type PanelPos } from './usePanelPos';

export default function DragPanel({
  id,
  defaultPos,
  className = '',
  children,
}: {
  id: string;
  defaultPos: () => PanelPos;
  className?: string;
  children: ReactNode;
}) {
  const { pos, panelRef, onHandleDown } = usePanelPos(id, defaultPos);
  return (
    <div ref={panelRef} className={`fixed ${className}`} style={{ left: pos.x, top: pos.y }}>
      <div
        className="pointer-events-auto absolute top-1 right-1.5 cursor-grab select-none rounded px-1 text-[13px] leading-none text-ink-faint hover:bg-void hover:text-accent active:cursor-grabbing"
        onPointerDown={onHandleDown}
        title="Ziehen zum Verschieben"
      >
        ⠿
      </div>
      {children}
    </div>
  );
}
