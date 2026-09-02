import { useState } from 'react';
import { Flame, X } from 'lucide-react';
import type { LagerDaten } from '../../shared/types';
import { aggregateByLager, HEAT_GRADIENT_CSS, HEATMAP_PRESETS, presetRange, type HeatmapDaten, type HeatmapPresetId } from '../heatmap';
import DragPanel from './DragPanel';

const toInputDate = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const toInputTime = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const fmt = (ms: number): string =>
  new Date(ms).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });

export default function HeatmapPanel({
  data,
  onBerechnen,
  onClose,
  loading,
  ergebnis,
  range,
}: {
  data: LagerDaten | null;
  onBerechnen: (from: number, to: number) => void;
  onClose: () => void;
  loading: boolean;
  ergebnis: HeatmapDaten | null;
  range: { from: number; to: number } | null;
}) {
  const [preset, setPreset] = useState<HeatmapPresetId>('1h');
  const [fromDate, setFromDate] = useState(() => toInputDate(Date.now() - 3600_000));
  const [fromTime, setFromTime] = useState(() => toInputTime(Date.now() - 3600_000));
  const [toDate, setToDate] = useState(() => toInputDate(Date.now()));
  const [toTime, setToTime] = useState(() => toInputTime(Date.now()));

  const onPreset = (id: HeatmapPresetId) => {
    setPreset(id);
    const { from, to } = presetRange(id);
    setFromDate(toInputDate(from));
    setFromTime(toInputTime(from));
    setToDate(toInputDate(to));
    setToTime(toInputTime(to));
  };

  const berechnen = () => {
    const from = new Date(`${fromDate}T${fromTime || '00:00'}`).getTime();
    const to = new Date(`${toDate}T${toTime || '23:59'}`).getTime();
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return;
    onBerechnen(from, to);
  };

  const lager = ergebnis && data ? aggregateByLager(ergebnis.points, data) : [];

  return (
    <DragPanel id="wm-heatmap" defaultPos={() => ({ x: 16, y: 72 })} className="heatmap-panel glass">
      <div className="heatmap-head">
        <span className="heatmap-title">
          <Flame size={13} /> Heatmap
        </span>
        <button className="heatmap-close" onClick={onClose} title="Schließen">
          <X size={14} />
        </button>
      </div>

      <select className="wm-input heatmap-preset" value={preset} onChange={(e) => onPreset(e.target.value as HeatmapPresetId)}>
        {HEATMAP_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      <div className="heatmap-row">
        <label>Von</label>
        <input type="date" className="wm-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <input type="time" className="wm-input" value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
      </div>
      <div className="heatmap-row">
        <label>Bis</label>
        <input type="date" className="wm-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <input type="time" className="wm-input" value={toTime} onChange={(e) => setToTime(e.target.value)} />
      </div>

      <button className="hud-btn heatmap-run" onClick={berechnen} disabled={loading}>
        {loading ? 'Lädt…' : 'Berechnen'}
      </button>

      {range && ergebnis && (
        <div className="heatmap-summary">
          <div className="heatmap-range">
            {fmt(range.from)} – {fmt(range.to)} Uhr
          </div>
          <div className="heatmap-line">Primär bebucht:</div>
          {lager.slice(0, 4).map((l) => (
            <div key={l.lager} className="heatmap-line">
              · <b>{l.lager}</b> ({l.n})
            </div>
          ))}
          {ergebnis.byArtikel.length > 0 && (
            <div className="heatmap-line">
              Artikel: {ergebnis.byArtikel.slice(0, 3).map((a) => `${a.artikelnummer} (${a.n})`).join(' · ')}
            </div>
          )}
        </div>
      )}

      <div className="heatmap-legend">
        <span>kalt</span>
        <span className="heatmap-legend-bar" style={{ background: HEAT_GRADIENT_CSS }} />
        <span>heiss</span>
      </div>
    </DragPanel>
  );
}
