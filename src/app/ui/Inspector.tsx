import { useCallback, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Search } from 'lucide-react';
import type { LagerDaten, Lagerort, Lagerplatz } from '../../shared/types';
import { alleArtikel, artikelLagerplätze, filterArtikel, type ArtikelPlatz } from '../article';
import { setSelectedArticle, useSelectedArticle, useSelection } from '../store';
import { fmtKg, ortGewicht, ortMaxGewicht, platzGewicht, platzMaxGewicht } from '../gew';

const WIDTH_KEY = 'wm-inspector-width';
const WIDTH_MIN = 240;

function clampWidth(w: number): number {
  return Math.min(Math.max(w, WIDTH_MIN), Math.max(window.innerWidth - 80, WIDTH_MIN));
}

export default function Inspector({ data }: { data: LagerDaten | null }) {
  const { selection, setSelection } = useSelection();
  const artikel = useSelectedArticle();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
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

  const artikelListe = useMemo(() => (data ? alleArtikel(data) : []), [data]);
  const vorschlaege = useMemo(() => filterArtikel(artikelListe, query), [artikelListe, query]);
  const plätze = useMemo(() => (data && artikel ? artikelLagerplätze(data, artikel) : []), [data, artikel]);
  const artikelRef = useMemo(() => artikelListe.find((a) => a.artikelnummer === artikel) ?? null, [artikelListe, artikel]);

  const waehlen = useCallback((nr: string) => {
    setSelectedArticle(nr);
    setQuery(nr);
    setOpen(false);
    searchRef.current?.blur();
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHl((h) => Math.min(h + 1, Math.max(0, vorschlaege.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHl((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      const v = vorschlaege[hl];
      if (v) waehlen(v.artikelnummer);
    } else if (e.key === 'Escape') {
      setOpen(false);
      searchRef.current?.blur();
    }
  };

  return (
    <div className="inspector glass" style={{ width }}>
      <div className="inspector-resize" onPointerDown={onResizeDown} title="Breite ändern" />
      <div className="inspector-search">
        <Search size={14} className="inspector-search-icon" />
        <input
          ref={searchRef}
          className="inspector-search-input"
          value={query}
          placeholder="Artikelnummer suchen…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHl(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          spellCheck={false}
        />
        {open && vorschlaege.length > 0 && (
          <ul className="article-suggestions" onMouseDown={(e) => e.preventDefault()}>
            {vorschlaege.map((v, i) => (
              <li
                key={v.artikelnummer}
                className={i === hl ? 'sel' : ''}
                onMouseEnter={() => setHl(i)}
                onClick={() => waehlen(v.artikelnummer)}
              >
                <span className="as-nr">{v.artikelnummer}</span>
                <span className="as-bez">{v.bezeichnung1}</span>
                <span className="as-men">{fmt(v.gesamt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {artikel ? (
        <>
          <div className="inspector-title-row">
            <span className="inspector-title">Artikel {artikel}</span>
            <button
              className="hud-btn inspector-close"
              onClick={() => {
                setSelectedArticle(null);
                setQuery('');
              }}
              title="Suche zurücksetzen"
            >
              ✕
            </button>
          </div>
          <div className="inspector-subtitle">
            {artikelRef?.bezeichnung1 || 'Unbekannter Artikel'} · {plätze.length} Lagerplätze
          </div>
          <ArticlePanel plätze={plätze} />
        </>
      ) : selection ? (
        <>
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
        </>
      ) : (
        <div className="inspector-body">
          <div className="inspector-muted">Artikelnummer suchen oder ein Lager anklicken.</div>
        </div>
      )}
    </div>
  );
}

function ArticlePanel({ plätze }: { plätze: ArtikelPlatz[] }) {
  const { setSelection } = useSelection();
  return (
    <div className="inspector-body">
      <div className="inspector-table-header">
        <span className="inspector-col-platz">Lager</span>
        <span className="inspector-col-platz">Platz</span>
        <span className="inspector-col-bez">Bezeichnung</span>
        <span className="inspector-col-bestand">Bestand</span>
      </div>
      <div className="inspector-table">
        {plätze.length === 0 && <div className="inspector-muted">Keine Plätze gefunden.</div>}
        {plätze.map((p) => (
          <button
            key={`${p.ort.lagerkennung}-${p.platz.platzId}`}
            className="inspector-table-row article-row"
            onClick={() => setSelection({ ort: p.ort, platz: p.platz })}
            title="In der 3D-Welt hervorheben"
          >
            <span className="inspector-col-platz inspector-col-platz-val">{p.ort.lagerkennung}</span>
            <span className="inspector-col-platz inspector-col-platz-val">{p.platz.kurz || `#${p.platz.platzId}`}</span>
            <span className="inspector-col-bez inspector-col-bez-val">{p.platz.platzbezeichnung}</span>
            <span className="inspector-col-bestand" style={{ color: bestandColor(p.bestand) }}>
              {fmt(p.bestand)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlatzPanel({ platz }: { platz: Lagerplatz }) {
  const total = platz.bestaende.reduce((s, b) => s + b.bestand, 0);
  const gewicht = platzGewicht(platz);
  const max = platzMaxGewicht(platz);
  const überlastet = max > 0 && gewicht > max;
  return (
    <div className="inspector-body">
      <div className="inspector-row">
        <span className="inspector-platz">Platz {platz.kurz || `#${platz.platzId}`}</span>
        <span className="inspector-total">Σ {fmt(total)}</span>
      </div>
      <div className="inspector-row">
        <span className="inspector-muted">Last</span>
        <span className="inspector-value" style={{ color: überlastet ? '#e74c3c' : '#e8ecf1' }}>
          {fmtKg(gewicht)}{max > 0 ? ` / ${fmtKg(max)}` : ''}
        </span>
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
            <div className="inspector-col" style={{ alignItems: 'flex-end' }}>
              <span className="inspector-value" style={{ color: bestandColor(b.bestand) }}>
                {fmt(b.bestand)}
              </span>
              {b.gewicht > 0 && <span className="inspector-muted">{fmtKg(b.bestand * b.gewicht)}</span>}
            </div>
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
  const gewicht = ortGewicht(ort);
  const max = ortMaxGewicht(ort);
  const überlastet = max > 0 && gewicht > max;
  return (
    <div className="inspector-body">
      <div className="inspector-row">
        <span className="inspector-muted">
          {ort.plaetze.length} Plätze · {belegt} belegt
        </span>
        <span className="inspector-total">Σ {fmt(gesamt)}</span>
      </div>
      <div className="inspector-row">
        <span className="inspector-muted">Gesamtlast</span>
        <span className="inspector-value" style={{ color: überlastet ? '#e74c3c' : '#e8ecf1' }}>
          {fmtKg(gewicht)}{max > 0 ? ` / ${fmtKg(max)}` : ''}
        </span>
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
