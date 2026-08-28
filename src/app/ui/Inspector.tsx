import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Lagerort, Lagerplatz } from '../../shared/types';
import { useSelection } from '../store';

const WIDTH_KEY = 'wm-inspector-width';
const WIDTH_MIN = 240;

function clampWidth(w: number): number {
  return Math.min(Math.max(w, WIDTH_MIN), Math.max(window.innerWidth - 80, WIDTH_MIN));
}

export default function Inspector() {
  const { selection, setSelection } = useSelection();
  const [width, setWidth] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(WIDTH_KEY);
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= WIDTH_MIN) return clampWidth(n);
      }
    } catch {
      /* ungültig – Standard */
    }
    return 420;
  });
  const widthRef = useRef(width);
  widthRef.current = width;
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onResizeDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: widthRef.current };
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setWidth(clampWidth(d.startW + (d.startX - ev.clientX)));
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try {
        localStorage.setItem(WIDTH_KEY, String(widthRef.current));
      } catch {
        /* Speicher nicht verfügbar – ignorieren */
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  if (!selection) return null;

  return (
    <div className="inspector glass" style={{ width }}>
      <div className="inspector-resize" onPointerDown={onResizeDown} title="Breite ändern" />
      <div className="inspector-title-row">
        <span className="inspector-title">{selection.ort.lagerkennung}</span>
        <button className="hud-btn inspector-close" onClick={() => setSelection(null)} title="Schließen">
          ✕
        </button>
      </div>
      <div className="inspector-subtitle">
        {selection.ort.bezeichnung} · Lagertechnik {selection.ort.lagertechnik}
      </div>
      {selection.platz ? <PlatzPanel platz={selection.platz} /> : <OrtPanel ort={selection.ort} />}
    </div>
  );
}

function PlatzPanel({ platz }: { platz: Lagerplatz }) {
  const total = platz.bestaende.reduce((s, b) => s + b.bestand, 0);
  return (
    <div className="inspector-body">
      <div className="inspector-row">
        <span className="inspector-platz">Platz {platz.kurz || `#${platz.platzId}`}</span>
        <span className="inspector-total">Σ {fmt(total)}</span>
      </div>
      {platz.bestaende.length === 0 ? (
        <div className="inspector-muted">Keine Bestände auf diesem Platz</div>
      ) : (
        platz.bestaende.map((b) => (
          <div key={b.artikelnummer} className="inspector-row">
            <div className="inspector-col">
              <div className="inspector-artikel">{b.artikelnummer}</div>
              <div className="inspector-muted">{b.bezeichnung1}</div>
            </div>
            <span className="inspector-value" style={{ color: bestandColor(b.bestand) }}>
              {fmt(b.bestand)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

export type OrtRow = { platzId: number; platz: string; artikel: string; bezeichnung: string; bestand: number };

export function ortRows(ort: Lagerort): OrtRow[] {
  const rows: OrtRow[] = [];
  for (const p of ort.plaetze) {
    if (p.bestaende.length === 0) continue;
    for (const b of p.bestaende) {
      rows.push({ platzId: p.platzId, platz: p.kurz || `#${p.platzId}`, artikel: b.artikelnummer, bezeichnung: b.bezeichnung1, bestand: b.bestand });
    }
  }
  rows.sort((a, b) => a.platzId - b.platzId || a.artikel.localeCompare(b.artikel, 'de'));
  return rows;
}

function OrtPanel({ ort }: { ort: Lagerort }) {
  const rows = ortRows(ort);
  const gesamt = rows.reduce((s, r) => s + r.bestand, 0);
  const belegt = new Set(rows.map((r) => r.platzId)).size;
  return (
    <div className="inspector-body">
      <div className="inspector-row">
        <span className="inspector-muted">
          {ort.plaetze.length} Plätze · {belegt} belegt
        </span>
        <span className="inspector-total">Σ {fmt(gesamt)}</span>
      </div>
      <div className="inspector-table-header">
        <span className="inspector-col-platz">Platz</span>
        <span className="inspector-col-artikel">Artikel</span>
        <span className="inspector-col-bez">Bezeichnung</span>
        <span className="inspector-col-bestand">Bestand</span>
      </div>
      <div className="inspector-table">
        {rows.map((r) => (
          <div key={`${r.platzId}-${r.artikel}`} className="inspector-table-row">
            <span className="inspector-col-platz inspector-col-platz-val">{r.platz}</span>
            <span className="inspector-col-artikel">{r.artikel}</span>
            <span className="inspector-col-bez inspector-col-bez-val">{r.bezeichnung}</span>
            <span className="inspector-col-bestand" style={{ color: bestandColor(r.bestand) }}>
              {fmt(r.bestand)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('de-DE');
}

function bestandColor(bestand: number): string {
  if (bestand < 100) return '#2ecc71';
  if (bestand < 500) return '#e6b93c';
  return '#e74c3c';
}
