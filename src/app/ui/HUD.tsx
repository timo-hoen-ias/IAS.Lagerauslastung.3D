import type { LagerDaten } from '../../shared/types';
import { stockColor } from '../colors';
import type { Mode } from '../App';
import {
  clearMeasure,
  getTransform,
  resetTransform,
  setTransform,
  useMeasurePoints,
  useRackTransforms,
  useSelectedRack,
} from '../store';
import { dist2d, IDENTITY_TRANSFORM, moveRack, rotateRack } from '../scene/transform';
import DragPanel from './DragPanel';

const MODES: { id: Mode; label: string }[] = [
  { id: 'orbit', label: 'Orbit' },
  { id: 'walk', label: 'Ego' },
  { id: 'topdown', label: 'Top-Down' },
];

export default function HUD({
  data,
  error,
  mode,
  setMode,
  speed,
  setSpeed,
  edit,
  setEdit,
  measure,
  setMeasure,
}: {
  data: LagerDaten | null;
  error: string | null;
  mode: Mode;
  setMode: (m: Mode) => void;
  speed: number;
  setSpeed: (s: number) => void;
  edit: boolean;
  setEdit: (v: boolean) => void;
  measure: boolean;
  setMeasure: (v: boolean) => void;
}) {
  const measurePoints = useMeasurePoints();
  const selectedRack = useSelectedRack();
  const transforms = useRackTransforms();

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

  return (
    <>
      <DragPanel id="topbar" className="hud-top glass" defaultPos={() => ({ x: 12, y: 8 })}>
        <span className="hud-title">Lagerbestands-Viewer</span>
        <div className="hud-modes">
          {MODES.map((m) => (
            <button key={m.id} className={`hud-btn${mode === m.id ? ' active' : ''}`} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="hud-modes">
          <button className={`hud-btn${edit ? ' active' : ''}`} onClick={toggleEdit}>
            Bearbeiten
          </button>
          <button className={`hud-btn${measure ? ' active' : ''}`} onClick={toggleMeasure}>
            Messen
          </button>
        </div>
        {data && (
          <span className="hud-status">
            {data.lagerorte.length} Lagerorte · {data.lagerorte.reduce((s, o) => s + o.plaetze.length, 0)} Plätze
          </span>
        )}
      </DragPanel>

      {error && <div className="hud-error">Fehler: {error}</div>}
      {!data && !error && <div className="hud-loading">Lade Bestände…</div>}

      <DragPanel id="leftcol" className="hud-left-col glass" defaultPos={() => ({ x: 14, y: Math.max(10, window.innerHeight - 430) })}>
        <div className="hud-speed">
          <span className="hud-speed-label">Laufgeschwindigkeit</span>
          <input type="range" min={1} max={12} step={0.5} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          <span className="hud-speed-value">{speed.toFixed(1)} m/s</span>
        </div>

        {data && (
          <div className="hud-legend">
            <div className="hud-legend-title">Bestand je Platz</div>
            {[
              ['leer', stockColor(0, false)],
              ['< 100', stockColor(50, true)],
              ['100–499', stockColor(200, true)],
              ['≥ 500', stockColor(500, true)],
            ].map(([label, color]) => (
              <div key={label} className="hud-legend-item">
                <span className="swatch" style={{ background: color }} />
                <span className="legend-label">{label}</span>
              </div>
            ))}
            <div className="hud-legend-title">Steuerung</div>
            <div className="hud-legend-item">
              <span className="legend-label">Ego: WASD · Shift Sprint · Leertaste Springen</span>
            </div>
            <div className="hud-legend-item">
              <span className="legend-label">Bearbeiten: Regal ziehen · Ring drehen · Q/E · Pfeile · [ ]</span>
            </div>
            <div className="hud-legend-item">
              <span className="legend-label">Tab: Modus · Platz/Regal anklicken: Bestände</span>
            </div>
          </div>
        )}
      </DragPanel>

      {measure && (
        <DragPanel
          id="measurebar"
          className="measure-bar glass"
          defaultPos={() => ({ x: Math.max(10, window.innerWidth / 2 - 160), y: Math.max(10, window.innerHeight - 70) })}
        >
          {measDist !== null
            ? `Strecke: ${measDist.toFixed(1)} m`
            : measurePoints.length === 1
              ? 'Ersten Punkt gesetzt — zweiten Punkt wählen'
              : 'Zwei Punkte anklicken, um eine Strecke zu messen'}
          <button className="hud-btn" onClick={clearMeasure}>
            Zurücksetzen
          </button>
        </DragPanel>
      )}

      {edit && selectedRack && (
        <DragPanel
          id="editpanel"
          className="edit-panel glass"
          defaultPos={() => ({ x: Math.max(10, window.innerWidth - 250), y: Math.max(10, window.innerHeight / 2 - 140) })}
        >
          <div className="edit-panel-title">{selectedRack}</div>
          <div className="edit-panel-row">
            <button className="hud-btn" onClick={() => setTransform(selectedRack, moveRack(t, 0, -1))}>
              ▲
            </button>
            <button className="hud-btn" onClick={() => setTransform(selectedRack, moveRack(t, -1, 0))}>
              ◀
            </button>
            <button className="hud-btn" onClick={() => setTransform(selectedRack, moveRack(t, 1, 0))}>
              ▶
            </button>
            <button className="hud-btn" onClick={() => setTransform(selectedRack, moveRack(t, 0, 1))}>
              ▼
            </button>
          </div>
          <div className="edit-panel-row">
            <button className="hud-btn" onClick={() => setTransform(selectedRack, rotateRack(t, -45))}>
              ⟲ −45°
            </button>
            <button className="hud-btn" onClick={() => setTransform(selectedRack, rotateRack(t, 45))}>
              +45° ⟳
            </button>
          </div>
          <div className="edit-panel-row">
            <span className="hud-speed-label">Skala</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.5}
              value={t.scale}
              onChange={(e) => setTransform(selectedRack, { ...t, scale: Math.min(2, Math.max(0.5, Number(e.target.value))) })}
            />
            <span className="hud-speed-value">{t.scale.toFixed(1)}×</span>
          </div>
          <div className="edit-panel-row">
            <button className="hud-btn" onClick={() => resetTransform(selectedRack)}>
              Reset
            </button>
            <span className="edit-panel-hint">Ziehen = Bewegen · Ring = Drehen</span>
          </div>
        </DragPanel>
      )}
    </>
  );
}
