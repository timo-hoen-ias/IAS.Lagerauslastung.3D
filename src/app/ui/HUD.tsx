import { useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Flame,
  LayoutGrid,
  Lightbulb,
  LightbulbOff,
  Map,
  Orbit,
  Pencil,
  PersonStanding,
  RotateCcw,
  RotateCw,
  Ruler,
  Warehouse,
  X,
} from 'lucide-react';
import type { LagerDaten } from '../../shared/types';
import { stockColor } from '../colors';
import type { DbInfo, Mode } from '../App';
import {
  clearMeasure,
  getTransform,
  resetTransform,
  setTransform,
  setTransformMode,
  useCam,
  useMeasurePoints,
  useRackTransforms,
  useSelectedRack,
  useTransformMode,
  useWsConnected,
} from '../store';
import { dist2d, IDENTITY_TRANSFORM, moveRack, resizeRackExact, rotateRack } from '../scene/transform';
import { rackMetrics } from '../scene/layout';
import DragPanel from './DragPanel';
import DecimalInput from './DecimalInput';
import LagerWizard from './LagerWizard';

const MODES: { id: Mode; label: string; icon: LucideIcon }[] = [
  { id: 'orbit', label: 'Orbit', icon: Orbit },
  { id: 'walk', label: 'Ego', icon: PersonStanding },
  { id: 'topdown', label: 'Top-Down', icon: Map },
];

const HELP_LINES = [
  'Orbit: WASD fliegen · Leertaste/Shift hoch/runter',
  'Ego: WASD · Shift Sprint · Leertaste Springen',
  'Bearbeiten: Regal ziehen · Ring drehen · Q/E · Pfeile · []',
  'Tab: Modus · Platz/Regal anklicken: Bestände',
];

const LEGEND_ROWS: [string, string][] = [
  ['leer', stockColor(0, false)],
  ['< 100', stockColor(50, true)],
  ['100–499', stockColor(200, true)],
  ['≥ 500', stockColor(500, true)],
];

const SELECT_CLASS =
  'h-8 rounded-lg border border-line bg-raised px-2.5 font-mono text-[12.5px] text-ink-soft outline-none focus:border-accent';

function railBtnClass(active: boolean): string {
  return `group relative flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
    active ? 'border-accent/40 bg-accent/10 text-accent' : 'border-transparent text-ink-soft hover:bg-raised hover:text-ink'
  }`;
}

function btnClass(active = false): string {
  return `inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors ${
    active ? 'border-accent/40 bg-accent/10 text-accent' : 'border-line bg-raised text-ink-soft hover:border-accent/40 hover:text-accent'
  }`;
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-30 -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-raised-2 px-2 py-1 text-[11.5px] text-ink opacity-0 shadow-lg shadow-black/40 transition-opacity group-hover:opacity-100">
      {children}
    </span>
  );
}

export default function HUD({
  data,
  dbs,
  db,
  setDb,
  mandant,
  setMandant,
  error,
  fallback,
  mode,
  setMode,
  speed,
  setSpeed,
  edit,
  setEdit,
  measure,
  setMeasure,
  lighting,
  setLighting,
  walls,
  setWalls,
  sim,
  setSim,
  simMinMs,
  setSimMinMs,
  simMaxMs,
  setSimMaxMs,
  heatmap,
  setHeatmap,
  onFlirToggle,
}: {
  data: LagerDaten | null;
  dbs: DbInfo[];
  db: string;
  setDb: (v: string) => void;
  mandant: number | null;
  setMandant: (v: number | null) => void;
  error: string | null;
  fallback: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  speed: number;
  setSpeed: (s: number) => void;
  edit: boolean;
  setEdit: (v: boolean) => void;
  measure: boolean;
  setMeasure: (v: boolean) => void;
  lighting: boolean;
  setLighting: (v: boolean) => void;
  walls: boolean;
  setWalls: (v: boolean) => void;
  sim: boolean;
  setSim: (v: boolean) => void;
  simMinMs: number;
  setSimMinMs: (v: number) => void;
  simMaxMs: number;
  setSimMaxMs: (v: number) => void;
  heatmap: boolean;
  setHeatmap: (v: boolean) => void;
  onFlirToggle: () => void;
}) {
  const measurePoints = useMeasurePoints();
  const selectedRack = useSelectedRack();
  const transforms = useRackTransforms();
  const tcMode = useTransformMode();
  const cam = useCam();
  const wsConnected = useWsConnected();
  const [helpOpen, setHelpOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const toggleEdit = () => {
    setEdit(!edit);
    if (measure) setMeasure(false);
  };
  const toggleMeasure = () => {
    setMeasure(!measure);
    if (edit) setEdit(false);
  };

  const t = selectedRack ? getTransform(selectedRack) : IDENTITY_TRANSFORM;
  const measDist = measurePoints.length === 2 ? dist2d(measurePoints[0]!, measurePoints[1]!) : null;

  // Easter Egg: dreimal schnell auf „Heatmap“ klicken toggelt die FLIR-Ansicht.
  // Der Panel-Toggle wird um 500 ms verzögert, damit Mehrfachklicks nicht stören.
  const heatClicks = useRef(0);
  const heatTimer = useRef<number | null>(null);
  const onHeatmapClick = () => {
    heatClicks.current += 1;
    if (heatTimer.current != null) window.clearTimeout(heatTimer.current);
    heatTimer.current = window.setTimeout(() => {
      const n = heatClicks.current;
      heatClicks.current = 0;
      if (n >= 3) {
        onFlirToggle();
        return;
      }
      setHeatmap(!heatmap);
    }, 500);
  };

  const baseOrt = data?.lagerorte.find((o) => o.lagerkennung === selectedRack?.split('#')[0]);
  const baseSize = baseOrt ? rackMetrics(baseOrt).size : null;
  const DIM_AXES: { axis: 'x' | 'y' | 'z'; label: string; dim: 'w' | 'h' | 'd' }[] = [
    { axis: 'x', label: 'Breite', dim: 'w' },
    { axis: 'y', label: 'Höhe', dim: 'h' },
    { axis: 'z', label: 'Tiefe', dim: 'd' },
  ];

  const cur = dbs.find((d) => d.id === db);
  const modeLabel = MODES.find((m) => m.id === mode)?.label ?? mode;

  return (
    <>
      {/* Kopfleiste */}
      <div className="fixed inset-x-0 top-0 z-20 flex h-14 items-center gap-4 border-b border-line bg-panel/95 px-4 backdrop-blur-md">
        <div className="flex shrink-0 items-center gap-2.5 border-r border-line pr-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-accent to-teal-800 font-mono text-[11px] font-bold text-void">
            IAS
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-bold tracking-wide text-ink">Lager-Cockpit</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-faint">3D-Bestandsansicht</div>
          </div>
        </div>

        {dbs.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            <select
              className={SELECT_CLASS}
              value={db}
              onChange={(e) => {
                setDb(e.target.value);
                setMandant(null);
              }}
            >
              {dbs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {cur && cur.mandanten.length > 1 && (
              <select className={SELECT_CLASS} value={mandant ?? ''} onChange={(e) => setMandant(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Alle Mandanten</option>
                {cur.mandanten.map((m) => (
                  <option key={m} value={m}>
                    Mandant {m}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <select
            className={SELECT_CLASS}
            title="Simulierte Beispiel-Buchungen (Debug)"
            value={sim ? 'on' : 'off'}
            onChange={(e) => setSim(e.target.value === 'on')}
          >
            <option value="off">Buchungen: Aus</option>
            <option value="on">Buchungen: Sim</option>
          </select>
          <label className="flex items-center gap-1 font-mono text-[11px] text-ink-faint" title="Intervall der simulierten Buchungen in Millisekunden">
            <input type="number" className={SELECT_CLASS} min={0} step={100} value={simMinMs} onChange={(e) => setSimMinMs(Number(e.target.value) || 0)} />
            –
            <input type="number" className={SELECT_CLASS} min={0} step={100} value={simMaxMs} onChange={(e) => setSimMaxMs(Number(e.target.value) || 0)} />
            ms
          </label>
          <button className={btnClass(heatmap)} onClick={onHeatmapClick} title="Heatmap über einen Zeitraum">
            <Flame size={14} />
            Heatmap
          </button>
          {data && (
            <span className="hidden font-mono text-[11.5px] text-ink-faint md:inline">
              <span className="text-ink-soft">{data.lagerorte.length}</span> Regale ·{' '}
              <span className="text-ink-soft">{data.lagerorte.reduce((s, o) => s + o.plaetze.length, 0)}</span> Plätze
            </span>
          )}
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] tracking-wide ${
              wsConnected ? 'border-accent/35 bg-accent/10 text-accent' : 'border-line bg-raised text-ink-faint'
            }`}
            title={wsConnected ? 'Live-Buchungen verbunden' : 'Live-Buchungen getrennt'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? 'animate-pulse bg-accent' : 'bg-ink-faint'}`} />
            {wsConnected ? 'LIVE' : 'GETRENNT'}
          </div>
        </div>
      </div>

      {/* Icon-Leiste */}
      <div className="fixed bottom-9 left-0 top-14 z-20 flex w-14 flex-col items-center gap-1.5 border-r border-line bg-panel/95 py-3 backdrop-blur-md">
        <div className="flex flex-col gap-1.5">
          {MODES.map((m) => (
            <button key={m.id} className={`${railBtnClass(mode === m.id)}`} onClick={() => setMode(m.id)}>
              <m.icon size={18} />
              <Tip>{m.label}</Tip>
            </button>
          ))}
        </div>

        <div className="my-2 h-px w-7 bg-line" />

        <div className="flex flex-col gap-1.5">
          <button className={railBtnClass(edit)} onClick={toggleEdit}>
            <Pencil size={18} />
            <Tip>Regal bearbeiten</Tip>
          </button>
          <button className={railBtnClass(measure)} onClick={toggleMeasure}>
            <Ruler size={18} />
            <Tip>Messen</Tip>
          </button>
          <button className={railBtnClass(lighting)} onClick={() => setLighting(!lighting)}>
            {lighting ? <Lightbulb size={18} /> : <LightbulbOff size={18} />}
            <Tip>Beleuchtung</Tip>
          </button>
          <button className={railBtnClass(walls)} onClick={() => setWalls(!walls)}>
            <Warehouse size={18} />
            <Tip>Wände</Tip>
          </button>
          <button className={railBtnClass(editorOpen)} onClick={() => setEditorOpen(!editorOpen)}>
            <LayoutGrid size={18} />
            <Tip>Lager-Editor</Tip>
          </button>
        </div>

        <div className="my-2 h-px w-7 bg-line" />

        <button className={railBtnClass(helpOpen)} onClick={() => setHelpOpen(!helpOpen)}>
          <CircleHelp size={18} />
          <Tip>Hilfe &amp; Legende</Tip>
        </button>
      </div>

      <LagerWizard open={editorOpen} onClose={() => setEditorOpen(false)} db={db} />

      {helpOpen && (
        <div className="fixed bottom-12 left-16 z-30 w-72 rounded-xl border border-line bg-raised-2/98 p-4 text-[12.5px] shadow-2xl shadow-black/50 backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">Steuerung</span>
            <button className="rounded p-1 text-ink-faint hover:bg-void hover:text-ink" onClick={() => setHelpOpen(false)}>
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-1.5 text-ink-soft">
            {HELP_LINES.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
          {data && (
            <>
              <div className="my-3 h-px bg-line" />
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">Bestand je Platz</div>
              <div className="flex flex-col gap-1.5">
                {LEGEND_ROWS.map(([label, color]) => (
                  <div key={label} className="flex items-center gap-2 text-ink-soft">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                    {label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="fixed left-[68px] top-[68px] z-20 flex flex-col gap-2">
        {error && (
          <div className="rounded-lg border border-stock-high/60 bg-stock-high/15 px-3.5 py-2.5 text-[13px] text-ink">Fehler: {error}</div>
        )}
        {!data && !error && <div className="font-mono text-[13px] text-ink-faint">Lade Bestände…</div>}
        {fallback && data && (
          <div className="flex items-center gap-3 rounded-lg border border-stock-mid/50 bg-stock-mid/10 px-3.5 py-2.5 text-[13px] text-ink">
            Keine DB-Verbindung — Perf-Lager geladen
            <button className={btnClass()} onClick={() => window.location.reload()}>
              Erneut versuchen
            </button>
          </div>
        )}
      </div>

      {/* Statusleiste */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex h-9 items-center gap-4 border-t border-line bg-panel/95 px-4 font-mono text-[11.5px] text-ink-faint backdrop-blur-md">
        <span className="text-ink-soft">{modeLabel}-Modus</span>
        <div className="h-3.5 w-px bg-line" />
        <span>
          X <span className="text-ink-soft">{cam.x.toFixed(1)}</span>
          {'  '}Z <span className="text-ink-soft">{cam.z.toFixed(1)}</span>
        </span>

        {mode === 'walk' && (
          <>
            <div className="h-3.5 w-px bg-line" />
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-wide">Tempo</span>
              <input
                type="range"
                min={1}
                max={30}
                step={0.5}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-24 accent-accent"
              />
              <span className="text-ink-soft">{speed.toFixed(1)} m/s</span>
            </div>
          </>
        )}

        {measure && (
          <>
            <div className="h-3.5 w-px bg-line" />
            <div className="flex items-center gap-2 text-ink-soft">
              <span>
                {measDist !== null
                  ? `Strecke: ${measDist.toFixed(1)} m`
                  : measurePoints.length === 1
                    ? 'Ersten Punkt gesetzt — zweiten Punkt wählen'
                    : 'Zwei Punkte anklicken, um eine Strecke zu messen'}
              </span>
              <button className={btnClass()} onClick={clearMeasure}>
                Zurücksetzen
              </button>
            </div>
          </>
        )}

        <span className="ml-auto">Tab: Modus wechseln</span>
      </div>

      {edit && selectedRack && (
        <DragPanel
          id="editpanel"
          className="z-20 w-72 rounded-xl border border-line bg-raised-2/95 p-4 pt-7 text-[13px] shadow-2xl shadow-black/50 backdrop-blur"
          defaultPos={() => ({ x: Math.max(70, window.innerWidth - 300), y: Math.max(70, window.innerHeight / 2 - 160) })}
        >
          <div className="mb-3 font-mono text-[14px] font-semibold text-accent">{selectedRack.split('#')[0]}</div>
          <div className="flex flex-col gap-2.5">
            <div className="flex gap-1.5">
              {(['translate', 'rotate', 'scale'] as const).map((m) => (
                <button key={m} className={btnClass(tcMode === m)} onClick={() => setTransformMode(m)}>
                  {m === 'translate' ? 'Verschieben' : m === 'rotate' ? 'Drehen' : 'Skalieren'}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button className={btnClass()} onClick={() => setTransform(selectedRack, moveRack(t, 0, -1))}>
                <ChevronUp size={14} />
              </button>
              <button className={btnClass()} onClick={() => setTransform(selectedRack, moveRack(t, -1, 0))}>
                <ChevronLeft size={14} />
              </button>
              <button className={btnClass()} onClick={() => setTransform(selectedRack, moveRack(t, 1, 0))}>
                <ChevronRight size={14} />
              </button>
              <button className={btnClass()} onClick={() => setTransform(selectedRack, moveRack(t, 0, 1))}>
                <ChevronDown size={14} />
              </button>
            </div>
            <div className="flex gap-1.5">
              <button className={btnClass()} onClick={() => setTransform(selectedRack, rotateRack(t, -45))}>
                <RotateCcw size={14} />
                −45°
              </button>
              <button className={btnClass()} onClick={() => setTransform(selectedRack, rotateRack(t, 45))}>
                +45°
                <RotateCw size={14} />
              </button>
            </div>
            {DIM_AXES.map(({ axis, label, dim }) => {
              const base = baseSize?.[dim] ?? 1;
              return (
                <div className="flex items-center gap-2" key={axis}>
                  <span className="w-14 shrink-0 text-[11px] uppercase tracking-wide text-ink-faint">{label}</span>
                  <DecimalInput value={t.scale[axis] * base} onCommit={(v) => setTransform(selectedRack, resizeRackExact(t, axis, v / base))} />
                  <span className="text-[11px] uppercase tracking-wide text-ink-faint">m</span>
                </div>
              );
            })}
            <button className={btnClass()} onClick={() => resetTransform(selectedRack)}>
              <RotateCcw size={14} />
              Reset
            </button>
            <span className="text-[11px] text-ink-faint">Ziehen = Bewegen · Ring = Drehen · Würfel = Größe</span>
          </div>
        </DragPanel>
      )}
    </>
  );
}
