import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
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
  useMeasurePoints,
  useRackTransforms,
  useSelectedRack,
  useTransformMode,
} from '../store';
import { dist2d, IDENTITY_TRANSFORM, moveRack, resizeRackExact, rotateRack } from '../scene/transform';
import { rackMetrics } from '../scene/layout';
import DragPanel from './DragPanel';
import DecimalInput from './DecimalInput';

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
}) {
  const measurePoints = useMeasurePoints();
  const selectedRack = useSelectedRack();
  const transforms = useRackTransforms();
  const tcMode = useTransformMode();
  const [helpOpen, setHelpOpen] = useState(false);

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

  const baseOrt = data?.lagerorte.find((o) => o.lagerkennung === selectedRack?.split('#')[0]);
  const baseSize = baseOrt ? rackMetrics(baseOrt).size : null;
  const DIM_AXES: { axis: 'x' | 'y' | 'z'; label: string; dim: 'w' | 'h' | 'd' }[] = [
    { axis: 'x', label: 'Breite', dim: 'w' },
    { axis: 'y', label: 'Höhe', dim: 'h' },
    { axis: 'z', label: 'Tiefe', dim: 'd' },
  ];

  return (
    <>
      <div className="hud-top glass">
        <span className="hud-title">Lagerbestands-Viewer</span>
        <div className="hud-top-actions">
          {dbs.length > 0 && (
            <>
              <select
                className="wm-input"
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
              {(() => {
                const cur = dbs.find((d) => d.id === db);
                return cur && cur.mandanten.length > 1 ? (
                  <select className="wm-input" value={mandant ?? ''} onChange={(e) => setMandant(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Alle Mandanten</option>
                    {cur.mandanten.map((m) => (
                      <option key={m} value={m}>
                        Mandant {m}
                      </option>
                    ))}
                  </select>
                ) : null;
              })()}
            </>
          )}
          <div className="hud-modes">
            {MODES.map((m) => (
              <button key={m.id} className={`hud-btn${mode === m.id ? ' active' : ''}`} onClick={() => setMode(m.id)}>
                <m.icon size={14} />
                {m.label}
              </button>
            ))}
          </div>
          <div className="hud-modes">
            <button className={`hud-btn${edit ? ' active' : ''}`} onClick={toggleEdit}>
              <Pencil size={14} />
              Bearbeiten
            </button>
            <button className={`hud-btn${measure ? ' active' : ''}`} onClick={toggleMeasure}>
              <Ruler size={14} />
              Messen
            </button>
            <button className={`hud-btn${lighting ? ' active' : ''}`} onClick={() => setLighting(!lighting)}>
              {lighting ? <Lightbulb size={14} /> : <LightbulbOff size={14} />}
              Beleuchtung
            </button>
            <button className={`hud-btn${walls ? ' active' : ''}`} onClick={() => setWalls(!walls)}>
              <Warehouse size={14} />
              Wände
            </button>
            <button className={`hud-btn${helpOpen ? ' active' : ''}`} onClick={() => setHelpOpen(!helpOpen)}>
              <CircleHelp size={14} />
              Hilfe
            </button>
          </div>
          {data && (
            <span className="hud-status">
              {data.lagerorte.length} Lagerorte · {data.lagerorte.reduce((s, o) => s + o.plaetze.length, 0)} Plätze
            </span>
          )}
        </div>
      </div>

      {helpOpen && (
        <div className="hud-help glass">
          <div className="hud-help-title">
            Steuerung
            <button className="hud-btn" onClick={() => setHelpOpen(false)}>
              <X size={14} />
            </button>
          </div>
          {HELP_LINES.map((line) => (
            <div key={line} className="hud-help-item">
              {line}
            </div>
          ))}
        </div>
      )}

      {error && <div className="hud-error">Fehler: {error}</div>}
      {!data && !error && <div className="hud-loading">Lade Bestände…</div>}
      {fallback && data && (
        <div className="hud-warning">
          Keine DB-Verbindung — Perf-Lager geladen
          <button className="hud-btn" onClick={() => window.location.reload()}>
            Erneut versuchen
          </button>
        </div>
      )}

      <div className="hud-bottom glass">
        <div className="hud-speed">
          <span className="hud-speed-label">Geschwindigkeit</span>
          <input type="range" min={1} max={30} step={0.5} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          <span className="hud-speed-value">{speed.toFixed(1)} m/s</span>
        </div>

        {measure && (
          <div className="hud-measure">
            {measDist !== null
              ? `Strecke: ${measDist.toFixed(1)} m`
              : measurePoints.length === 1
                ? 'Ersten Punkt gesetzt — zweiten Punkt wählen'
                : 'Zwei Punkte anklicken, um eine Strecke zu messen'}
            <button className="hud-btn" onClick={clearMeasure}>
              Zurücksetzen
            </button>
          </div>
        )}

        {data && (
          <div className="hud-legend">
            <span className="hud-legend-title">Bestand je Platz</span>
            {LEGEND_ROWS.map(([label, color]) => (
              <div key={label} className="hud-legend-item">
                <span className="swatch" style={{ background: color }} />
                <span className="legend-label">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {edit && selectedRack && (
        <DragPanel
          id="editpanel"
          className="edit-panel glass"
          defaultPos={() => ({ x: Math.max(10, window.innerWidth - 250), y: Math.max(10, window.innerHeight / 2 - 140) })}
        >
          <div className="edit-panel-title">{selectedRack.split('#')[0]}</div>
          <div className="edit-panel-row">
            {(['translate', 'rotate', 'scale'] as const).map((m) => (
              <button
                key={m}
                className={`hud-btn${tcMode === m ? ' active' : ''}`}
                onClick={() => setTransformMode(m)}
              >
                {m === 'translate' ? 'Verschieben' : m === 'rotate' ? 'Drehen' : 'Skalieren'}
              </button>
            ))}
          </div>
          <div className="edit-panel-row">
            <button className="hud-btn" onClick={() => setTransform(selectedRack, moveRack(t, 0, -1))}>
              <ChevronUp size={14} />
            </button>
            <button className="hud-btn" onClick={() => setTransform(selectedRack, moveRack(t, -1, 0))}>
              <ChevronLeft size={14} />
            </button>
            <button className="hud-btn" onClick={() => setTransform(selectedRack, moveRack(t, 1, 0))}>
              <ChevronRight size={14} />
            </button>
            <button className="hud-btn" onClick={() => setTransform(selectedRack, moveRack(t, 0, 1))}>
              <ChevronDown size={14} />
            </button>
          </div>
          <div className="edit-panel-row">
            <button className="hud-btn" onClick={() => setTransform(selectedRack, rotateRack(t, -45))}>
              <RotateCcw size={14} />
              −45°
            </button>
            <button className="hud-btn" onClick={() => setTransform(selectedRack, rotateRack(t, 45))}>
              +45°
              <RotateCw size={14} />
            </button>
          </div>
            {DIM_AXES.map(({ axis, label, dim }) => {
              const base = baseSize?.[dim] ?? 1;
              return (
                <div className="edit-panel-row" key={axis}>
                  <span className="wm-label">{label}</span>
                  <DecimalInput
                    value={t.scale[axis] * base}
                    onCommit={(v) => setTransform(selectedRack, resizeRackExact(t, axis, v / base))}
                  />
                  <span className="wm-unit">m</span>
                </div>
              );
            })}
            <div className="edit-panel-row">
              <button className="hud-btn" onClick={() => resetTransform(selectedRack)}>
                <RotateCcw size={14} />
                Reset
              </button>
            </div>
            <span className="edit-panel-hint">Ziehen = Bewegen · Ring = Drehen · Würfel = Größe</span>
        </DragPanel>
      )}
    </>
  );
}
