import { useEffect, useRef, useState } from 'react';
import { Maximize2, RotateCcw } from 'lucide-react';
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
  type ViewBox,
} from './grundriss';

const MIN_PUNKTE = 3;
const RASTER_SCHRITTE = [0.1, 0.5, 1] as const;
const NEIGHBOR_SNAP_M = 0.3;
/** Grenzen (m) für den zoombaren Ausschnitt — verhindert, dass das Mausrad ins Unendliche zoomt. */
const MIN_VIEW_M = 3;
const MAX_VIEW_M = 1000;
const ZOOM_FACTOR = 1.15;
/** Ab dieser Pointer-Bewegung (px) gilt ein Hintergrund-Drag als Verschieben statt als Klick zum Punkt-Einfügen. */
const PAN_SCHWELLE_PX = 3;

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}

/** Tatsächlicher Maßstab (px/m) und Letterbox-Versatz, mit dem `viewBox` gemäß `preserveAspectRatio="xMidYMid meet"` in ein Element von `rectW`×`rectH` px eingepasst wird. */
function fitScaleAndOffset(vb: ViewBox, rectW: number, rectH: number) {
  const scale = Math.min(rectW / vb.w, rectH / vb.h);
  return { scale, offsetX: (rectW - vb.w * scale) / 2, offsetY: (rectH - vb.h * scale) / 2 };
}

export default function GrundrissEditor({ points, onChange }: { points: Punkt[]; onChange: (p: Punkt[]) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState(() => computeViewBox(points));
  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;
  const [raster, setRaster] = useState<number>(0.5);
  const [guide, setGuide] = useState<{ axis: 'x' | 'z'; wert: number } | null>(null);
  /** Sobald per Mausrad/Hintergrund-Drag manuell gezoomt/verschoben wurde, überschreibt das automatische Einpassen den Ausschnitt nicht mehr — nur noch der „Einpassen"-Button. */
  const manuellAngepasst = useRef(false);
  const panStart = useRef<{ clientX: number; clientZ: number; vb: ViewBox; scale: number } | null>(null);
  const wurdeGezogen = useRef(false);
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    if (manuellAngepasst.current) return;
    setViewBox(computeViewBox(points));
    // Nur bei Punkt-Anzahl neu einpassen, nicht bei jeder Positionsänderung — sonst
    // verschiebt sich der Ausschnitt unter dem Cursor während des Ziehens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);

  /** Mausrad-Zoom per nativem Listener statt JSX `onWheel` — React markiert Wheel-Handler sonst als passiv, wodurch `preventDefault()` (nötig gegen Seiten-Scroll) wirkungslos bliebe. */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const vb = viewBoxRef.current;
      const rect = svg.getBoundingClientRect();
      const { scale, offsetX, offsetY } = fitScaleAndOffset(vb, rect.width, rect.height);
      const cursorX = vb.minX + (e.clientX - rect.left - offsetX) / scale;
      const cursorZ = vb.minZ + (e.clientY - rect.top - offsetY) / scale;
      const factor = e.deltaY > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const newW = Math.min(MAX_VIEW_M, Math.max(MIN_VIEW_M, vb.w * factor));
      const actualFactor = newW / vb.w;
      manuellAngepasst.current = true;
      setViewBox({
        w: newW,
        h: vb.h * actualFactor,
        minX: cursorX - (cursorX - vb.minX) * actualFactor,
        minZ: cursorZ - (cursorZ - vb.minZ) * actualFactor,
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

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

  const onHintergrundPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const { scale } = fitScaleAndOffset(viewBox, rect.width, rect.height);
    panStart.current = { clientX: e.clientX, clientZ: e.clientY, vb: viewBox, scale };
    wurdeGezogen.current = false;
    svg.setPointerCapture(e.pointerId);
  };
  const onHintergrundPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!panStart.current) return;
    const dx = e.clientX - panStart.current.clientX;
    const dz = e.clientY - panStart.current.clientZ;
    if (!wurdeGezogen.current && Math.hypot(dx, dz) < PAN_SCHWELLE_PX) return;
    wurdeGezogen.current = true;
    setPanning(true);
    manuellAngepasst.current = true;
    setViewBox({
      ...panStart.current.vb,
      minX: panStart.current.vb.minX - dx / panStart.current.scale,
      minZ: panStart.current.vb.minZ - dz / panStart.current.scale,
    });
  };
  const onHintergrundPointerUp = () => {
    panStart.current = null;
    setPanning(false);
  };

  const flaeche = polygonArea(points);
  const polyStr = points.map((p) => `${p.x},${p.z}`).join(' ');
  const n = points.length;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11.5px] text-ink-faint">
        <span>Fläche anklicken: Punkt einfügen · ziehen: verschieben · Doppelklick: löschen · Mausrad: zoomen · Hintergrund ziehen: verschieben</span>
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
            onClick={() => {
              manuellAngepasst.current = false;
              setViewBox(computeViewBox(points));
            }}
            title="Ausschnitt an den Grundriss anpassen"
          >
            <Maximize2 size={12} /> Einpassen
          </button>
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
        className={`h-[420px] w-full rounded-md border border-line bg-void ${panning ? 'cursor-grabbing' : 'cursor-crosshair'}`}
        onPointerDown={onHintergrundPointerDown}
        onPointerMove={onHintergrundPointerMove}
        onPointerUp={onHintergrundPointerUp}
        onPointerCancel={onHintergrundPointerUp}
        onClick={(e) => {
          if (wurdeGezogen.current) {
            wurdeGezogen.current = false;
            return;
          }
          onChange(insertPointOnNearestEdge(points, snapPoint(toPunkt(e.clientX, e.clientY), raster)));
        }}
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
