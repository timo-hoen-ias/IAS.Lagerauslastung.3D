import type { ReactNode } from 'react';
import { usePanelPos, type PanelPos } from './usePanelPos';

export default function DragPanel({
  id,
  defaultPos,
  className,
  children,
}: {
  id: string;
  defaultPos: () => PanelPos;
  className: string;
  children: ReactNode;
}) {
  const { pos, onHandleDown } = usePanelPos(id, defaultPos);
  return (
    <div className={className} style={{ left: pos.x, top: pos.y }}>
      <div className="panel-handle" onPointerDown={onHandleDown} title="Ziehen zum Verschieben">
        <span className="panel-handle-glyph">⠿</span>
      </div>
      {children}
    </div>
  );
}
