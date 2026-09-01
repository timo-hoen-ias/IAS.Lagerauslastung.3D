import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Punkt } from '../../shared/editor';
import {
  computeViewBox,
  edgeLabels,
  gridLines,
  insertPointOnNearestEdge,
  polygonArea,
  RECHTECK_START,
  snapPoint,
  snapToNeighbors,
} from './grundriss';

const MIN_PUNKTE = 3;
const RASTER_SCHRITTE = [0.1, 0.5, 1] as const;
const NEIGHBOR_SNAP_M = 0.3;

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}

export default function GrundrissEditor({ points, onChange }: { points: Punkt[]; onChange: (p: Punkt[]) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState(() => computeViewBox(points));
  const [raster, setRaster] = useState<number>(0.5);
  const [guide, setGuide] = useState<{ axis: 'x' | 'z'; wert: number } | null>(null);

  useEffect(() => {
    setViewBox(computeViewBox(points));
    // Nur bei Punkt-Anzahl neu einpassen, nicht bei jeder Positionsänderung — sonst
    // verschiebt sich der Ausschnitt unter dem Cursor während des Ziehens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);

  const toPunkt = (clientX: number, clientY: number): Punkt => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, z: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: Math.round(p.x * 10) / 10, z: Math.round(p.y * 10) / 10 };
  };

  const flaeche = polygonArea(points);
  const polyStr = points.map((p) => `${p.x},${p.z}`).join(' ');
  const n = points.length;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11.5px] text-ink-faint">
        <span>Fläche anklicken: Punkt einfügen · ziehen: verschieben · Doppelklick: löschen</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            Raster
            {RASTER_SCHRITTE.map((r) => (
              <button
                key={r}
                className={`rounded px-1.5 py-0.5 font-mono ${raster === r ? 'bg-accent/15 text-accent' : 'text-ink-faint hover:text-ink'}`}
                onClick={() => setRaster(r)}
              >
                {fmt(r)}
              </button>
            ))}
            m
          </span>
          <span className="font-mono text-ink-soft">{flaeche.toFixed(0)} m²</span>
          <button
            className="flex items-center gap-1 text-ink-faint hover:text-accent"
            onClick={() => onChange(RECHTECK_START)}
            title="Auf Rechteck (30 × 20 m) zurücksetzen"
          >
            <RotateCcw size={12} /> Rechteck
          </button>
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`${viewBox.minX} ${viewBox.minZ} ${viewBox.w} ${viewBox.h}`}
        className="h-64 w-full rounded-md border border-line bg-void"
        onClick={(e) => onChange(insertPointOnNearestEdge(points, snapPoint(toPunkt(e.clientX, e.clientY), raster)))}
      >
        {gridLines(viewBox).map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--color-line-soft)" strokeWidth={0.03} />
        ))}
        {guide && guide.axis === 'x' && (
          <line x1={guide.wert} y1={viewBox.minZ} x2={guide.wert} y2={viewBox.minZ + viewBox.h} stroke="var(--color-accent)" strokeWidth={0.05} strokeDasharray="0.4 0.3" />
        )}
        {guide && guide.axis === 'z' && (
          <line x1={viewBox.minX} y1={guide.wert} x2={viewBox.minX + viewBox.w} y2={guide.wert} stroke="var(--color-accent)" strokeWidth={0.05} strokeDasharray="0.4 0.3" />
        )}
        {points.length >= 2 && (
          <polygon points={polyStr} fill="var(--color-accent)" fillOpacity={0.12} stroke="var(--color-accent)" strokeWidth={0.12} />
        )}
        {n >= 2 &&
          edgeLabels(points).map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={l.z}
              fontSize={0.8}
              fill="var(--color-ink-soft)"
              stroke="var(--color-void)"
              strokeWidth={0.18}
              paintOrder="stroke"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {fmt(l.length)} m
            </text>
          ))}
        {points.map((p, i) => (
          <g key={i} className="group">
            {/* Größere, unsichtbare Klickfläche — der sichtbare Punkt ist zu klein, um Ziehen/Doppelklick zuverlässig zu treffen. */}
            <circle
              cx={p.x}
              cy={p.z}
              r={1.1}
              fill="transparent"
              className="cursor-grab"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (e.buttons !== 1) return;
                const raw = snapPoint(toPunkt(e.clientX, e.clientY), raster);
                const { point, snappedX, snappedZ } = snapToNeighbors(points, i, raw, NEIGHBOR_SNAP_M);
                setGuide(snappedX ? { axis: 'x', wert: point.x } : snappedZ ? { axis: 'z', wert: point.z } : null);
                onChange(points.map((pt, idx) => (idx === i ? point : pt)));
              }}
              onPointerUp={() => setGuide(null)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (points.length > MIN_PUNKTE) onChange(points.filter((_, idx) => idx !== i));
              }}
            />
            <circle cx={p.x} cy={p.z} r={0.55} className="pointer-events-none fill-accent stroke-void group-hover:fill-white" strokeWidth={0.1} />
          </g>
        ))}
      </svg>
    </div>
  );
}
