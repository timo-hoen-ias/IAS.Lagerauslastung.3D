import { useCallback, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Search, X } from 'lucide-react';
import type { LagerDaten, Lagerort, Lagerplatz } from '../../shared/types';
import { alleArtikel, artikelLagerplätze, filterArtikel, groupRowsByArtikel, rowsFromPlaetze, type ArtikelGroupRow, type ArtikelPlatz, type OrtRow } from '../article';
import {
  setAllLagerVisible,
  setEditorSelection,
  setSelectedArticle,
  setSelection,
  toggleEditorLagerVisible,
  toggleLagerVisible,
  useEditorSelection,
  useHiddenLagerkennungen,
  useSelectedArticle,
  useSelection,
  useStockAnzeigeConfig,
  useVisibleEditorLagerIds,
  type EditorSelection,
  type Selection,
} from '../store';
import { fmtKg, ortGewicht, ortMaxGewicht, plaetzeGewicht, plaetzeMaxGewicht, platzGewicht, platzMaxGewicht } from '../gew';
import { stockColor } from '../colors';
import {
  editorCounts,
  editorGangNummer,
  editorLevelRows,
  editorPlaetze,
  editorRegalIndex,
  editorReiheSeite,
  type EditorLagerListItem,
  type EditorLevel,
  type EditorZelleOverlay,
} from '../editorOverlay';
import { gangPlätze } from '../scene/layout';
import type { PlacedRack } from '../scene/transform';

const WIDTH_KEY = 'wm-inspector-width';
const WIDTH_MIN = 260;

const TABLE_HEADER = 'flex gap-2.5 border-b border-line-soft px-1 pb-1.5 text-[10.5px] uppercase tracking-wide text-ink-faint';
const TABLE_ROW = 'flex w-full items-center gap-2.5 border-b border-line-soft px-1 py-2 text-left text-[12px]';
const CLOSE_BTN = 'rounded-md p-1.5 text-ink-faint hover:bg-raised hover:text-ink';
const MUTED = 'text-[11px] text-ink-faint';

function clampWidth(w: number): number {
  return Math.min(Math.max(w, WIDTH_MIN), Math.max(window.innerWidth - 80, WIDTH_MIN));
}

export default function Inspector({ data, editorLagerList }: { data: LagerDaten | null; editorLagerList: EditorLagerListItem[] }) {
  const selection = useSelection();
  const editorSelection = useEditorSelection();
  const artikel = useSelectedArticle();
  const visibleEditorLagerIds = useVisibleEditorLagerIds();
  const hiddenLagerkennungen = useHiddenLagerkennungen();
  const sageLagerListe = useMemo(
    () => (data ? [...data.lagerorte].sort((a, b) => a.lagerkennung.localeCompare(b.lagerkennung, 'de')) : []),
    [data],
  );
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
    return 360;
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
    <div
      className="fixed bottom-9 right-0 top-14 z-10 flex flex-col gap-3 border-l border-line bg-panel/95 p-3.5 text-[13px] text-ink backdrop-blur-md"
      style={{ width }}
    >
      <div className="absolute -left-[3px] bottom-0 top-0 w-[7px] cursor-ew-resize touch-none hover:bg-accent/20 active:bg-accent/30" onPointerDown={onResizeDown} title="Breite ändern" />

      <div className="relative shrink-0">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          ref={searchRef}
          className="h-9 w-full rounded-lg border border-line bg-void pl-8 pr-2.5 font-mono text-[13px] text-ink outline-none focus:border-accent"
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
          <ul
            className="no-scrollbar absolute inset-x-0 top-[calc(100%+4px)] z-20 max-h-72 overflow-y-auto rounded-lg border border-accent/25 bg-raised-2/98 p-1 shadow-2xl shadow-black/50"
            onMouseDown={(e) => e.preventDefault()}
          >
            {vorschlaege.map((v, i) => (
              <li
                key={v.artikelnummer}
                className={`flex cursor-pointer items-baseline gap-2 rounded-md px-2 py-1.5 text-[12px] ${i === hl ? 'bg-accent/15' : 'hover:bg-accent/10'}`}
                onMouseEnter={() => setHl(i)}
                onClick={() => waehlen(v.artikelnummer)}
              >
                <span className="shrink-0 font-mono font-semibold text-accent">{v.artikelnummer}</span>
                <span className="min-w-0 flex-1 truncate text-ink-soft">{v.bezeichnung1}</span>
                <span className="shrink-0 text-ink-faint">{fmtMenge(v.gesamt, v.einheit)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {sageLagerListe.length > 0 && <SageLagerListe liste={sageLagerListe} versteckt={hiddenLagerkennungen} />}

      {editorLagerList.length > 0 && <EditorLagerListe liste={editorLagerList} sichtbar={visibleEditorLagerIds} />}

      {artikel ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[16px] font-semibold tracking-tight">Artikel {artikel}</span>
            <button
              className={CLOSE_BTN}
              onClick={() => {
                setSelectedArticle(null);
                setQuery('');
              }}
              title="Suche zurücksetzen"
            >
              <X size={14} />
            </button>
          </div>
          <div className={MUTED}>
            {artikelRef?.bezeichnung1 || 'Unbekannter Artikel'} · {plätze.length} Lagerplätze
          </div>
          <div className="perf-divider" />
          <ArticlePanel plätze={plätze} />
        </>
      ) : editorSelection ? (
        <EditorSelectionView sel={editorSelection} />
      ) : selection ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[16px] font-semibold tracking-tight">
              {selection.platz
                ? selection.platz.kurz || `#${selection.platz.platzId}`
                : selection.rack
                  ? `Regal ${selection.rack.gang + 1}`
                  : selection.ort.lagerkennung}
            </span>
            <button className={CLOSE_BTN} onClick={() => setSelection(null)} title="Schließen">
              <X size={14} />
            </button>
          </div>
          <Breadcrumb selection={selection} />
          <div className={MUTED}>
            {selection.ort.bezeichnung} · Lagertechnik {selection.ort.lagertechnik}
          </div>
          <div className="perf-divider" />
          {selection.platz ? (
            <PlatzPanel platz={selection.platz} />
          ) : selection.rack ? (
            <RackPanel ort={selection.ort} rack={selection.rack} />
          ) : (
            <OrtPanel ort={selection.ort} />
          )}
        </>
      ) : (
        <div className={MUTED}>Artikelnummer suchen oder ein Lager anklicken.</div>
      )}
    </div>
  );
}

/** Multiselekt-Liste im Regal-Manifest: einzelne Sage-Läger aus der Live-Ansicht aus-/einblenden (Filter vor `layoutRacks`, s. `App.tsx`). */
function SageLagerListe({ liste, versteckt }: { liste: Lagerort[]; versteckt: Set<string> }) {
  const sichtbarCount = liste.length - versteckt.size;
  return (
    <div className="shrink-0">
      <div className="mb-1 flex items-center justify-between text-[10.5px] uppercase tracking-wide text-ink-faint">
        <span>Live-Läger</span>
        <span className="flex items-center gap-2">
          <button className="hover:text-accent" onClick={() => setAllLagerVisible(liste.map((o) => o.lagerkennung), true)}>
            Alle
          </button>
          <button className="hover:text-accent" onClick={() => setAllLagerVisible(liste.map((o) => o.lagerkennung), false)}>
            Keine
          </button>
          <span>
            {sichtbarCount}/{liste.length} sichtbar
          </span>
        </span>
      </div>
      <div className="perf-divider" />
      <div className="no-scrollbar max-h-32 overflow-y-auto rounded-md border border-line-soft">
        {liste.map((o) => (
          <label
            key={o.lagerkennung}
            className="flex cursor-pointer items-center gap-2 border-b border-line-soft px-2 py-1.5 text-[11.5px] last:border-b-0 hover:bg-raised"
          >
            <input
              type="checkbox"
              className="shrink-0 accent-accent"
              checked={!versteckt.has(o.lagerkennung)}
              onChange={() => toggleLagerVisible(o.lagerkennung)}
            />
            <span className="min-w-0 flex-1 truncate text-ink">{o.bezeichnung}</span>
            <span className="shrink-0 font-mono text-ink-faint">{o.lagerkennung}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Multiselekt-Liste im Regal-Manifest: entworfene Läger einzeln im Haupt-Viewer ein-/ausblenden (Overlay, s. `App.tsx`). */
function EditorLagerListe({ liste, sichtbar }: { liste: EditorLagerListItem[]; sichtbar: Set<string> }) {
  return (
    <div className="shrink-0">
      <div className="mb-1 flex items-center justify-between text-[10.5px] uppercase tracking-wide text-ink-faint">
        <span>Entworfene Läger</span>
        <span>
          {sichtbar.size}/{liste.length} sichtbar
        </span>
      </div>
      <div className="perf-divider" />
      <div className="no-scrollbar max-h-32 overflow-y-auto rounded-md border border-line-soft">
        {liste.map((l) => (
          <label
            key={l.id}
            className="flex cursor-pointer items-center gap-2 border-b border-line-soft px-2 py-1.5 text-[11.5px] last:border-b-0 hover:bg-raised"
          >
            <input
              type="checkbox"
              className="shrink-0 accent-accent"
              checked={sichtbar.has(l.id)}
              onChange={() => toggleEditorLagerVisible(l.id)}
            />
            <span className="min-w-0 flex-1 truncate text-ink">{l.name}</span>
            <span className="shrink-0 font-mono text-ink-faint">{l.lagerkennung}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Navigations-Pfad Lager › Regal › Platz über der Detailansicht (klickbar außer der aktuellen Ebene). */
function Breadcrumb({ selection }: { selection: NonNullable<Selection> }) {
  const { ort, rack, platz } = selection;
  const crumbs: { label: string; onClick?: () => void }[] = [
    { label: ort.lagerkennung, onClick: rack || platz ? () => setSelection({ ort, platz: null, rack: null }) : undefined },
  ];
  if (rack) crumbs.push({ label: `Regal ${rack.gang + 1}`, onClick: platz ? () => setSelection({ ort, platz: null, rack }) : undefined });
  if (platz) crumbs.push({ label: platz.kurz || `#${platz.platzId}` });

  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px] text-ink-faint">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span>›</span>}
          {c.onClick ? (
            <button className="hover:text-accent" onClick={c.onClick}>
              {c.label}
            </button>
          ) : (
            <span className="text-ink">{c.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ---- Editor-Lager: Ebenen-Navigation (Platz → Regal → Regalreihe → Gang → Lager) --------

/** Menschliche Labels je Ebene, aus den Placement-Daten des Overlays abgeleitet (kein separates Nummerierungsfeld nötig). */
function editorLabels(sel: NonNullable<EditorSelection>) {
  return {
    lager: sel.overlay.name || sel.overlay.lagerkennung,
    gang: `Gang ${editorGangNummer(sel.overlay, sel.gangId) ?? '?'}`,
    reihe: `Reihe ${editorReiheSeite(sel.overlay, sel.reiheId) === 'rechts' ? 'rechts' : 'links'}`,
    regal: `Regal ${editorRegalIndex(sel.overlay, sel.reiheId, sel.regalId) ?? '?'}`,
    platz: sel.zelle ? sel.zelle.platz?.kurz || `Ebene ${sel.zelle.ebene} · Platz ${sel.zelle.spalte}` : '',
  };
}

const EDITOR_LEVEL_DEPTH: Record<EditorLevel, number> = { lager: 0, gang: 1, reihe: 2, regal: 3, platz: 4 };

/** Navigations-Pfad Lager › Gang › Reihe › Regal › Platz, bis zur aktuellen Tiefe (tiefere Ebenen wie bei der Sage-Auswahl nicht vorgreifend angezeigt). */
function EditorBreadcrumb({ sel }: { sel: NonNullable<EditorSelection> }) {
  const labels = editorLabels(sel);
  const go = (level: EditorLevel) => () => setEditorSelection({ ...sel, level, zelle: level === 'platz' ? sel.zelle : null });
  const alleEbenen: { label: string; level: EditorLevel }[] = [
    { label: labels.lager, level: 'lager' },
    { label: labels.gang, level: 'gang' },
    { label: labels.reihe, level: 'reihe' },
    { label: labels.regal, level: 'regal' },
    { label: labels.platz, level: 'platz' },
  ];
  const tiefe = EDITOR_LEVEL_DEPTH[sel.level];
  const crumbs = alleEbenen.filter((c) => EDITOR_LEVEL_DEPTH[c.level] <= tiefe);

  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px] text-ink-faint">
      {crumbs.map((c) => (
        <span key={c.level} className="flex items-center gap-1">
          {c.level !== 'lager' && <span>›</span>}
          {c.level === sel.level ? (
            <span className="text-ink">{c.label}</span>
          ) : (
            <button className="hover:text-accent" onClick={go(c.level)}>
              {c.label}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function toggleBtnClass(active: boolean): string {
  return `flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
    active ? 'border-accent/40 bg-accent/15 text-accent' : 'border-line text-ink-faint hover:bg-raised'
  }`;
}

function EditorLeerePlatzPanel({ zelle }: { zelle: EditorZelleOverlay }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className={MUTED}>
        Ebene {zelle.ebene} · Spalte {zelle.spalte}
      </div>
      <div className={MUTED}>Kein Sage-Bestand für diesen Platz gefunden — nur Layout-Kontrolle.</div>
    </div>
  );
}

function ArtikelTabelle({ rows }: { rows: ArtikelGroupRow[] }) {
  const anzeige = useStockAnzeigeConfig();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={TABLE_HEADER}>
        <span className="w-16 shrink-0">Artikel</span>
        <span className="min-w-0 flex-1">Bezeichnung</span>
        <span className="w-14 shrink-0 text-right">Plätze</span>
        <span className="w-16 shrink-0 text-right">Bestand</span>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 && <div className={`${MUTED} py-2`}>Keine Bestände in dieser Ebene.</div>}
        {rows.map((r) => (
          <div key={r.artikel} className={TABLE_ROW}>
            <span className="w-16 shrink-0 font-mono">{r.artikel}</span>
            <span className="min-w-0 flex-1 truncate text-ink-soft">{r.bezeichnung}</span>
            <span className="w-14 shrink-0 text-right font-mono text-ink-faint">{r.plaetze}</span>
            <span className="w-16 shrink-0 text-right font-mono" style={{ color: stockColor(r.bestand, true, anzeige, r.einheit) }}>
              {fmtMenge(r.bestand, r.einheit)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Aggregierte Ansicht einer Ebene (Regal/Reihe/Gang/Lager) — Umschalter zwischen Je-Platz- und Je-Artikel-Gruppierung. */
function EditorAggregatePanel({ sel, level }: { sel: NonNullable<EditorSelection>; level: Exclude<EditorLevel, 'platz'> }) {
  const [gruppierung, setGruppierung] = useState<'platz' | 'artikel'>('platz');
  const ids = { gangId: sel.gangId, reiheId: sel.reiheId, regalId: sel.regalId };
  const rows = useMemo(() => editorLevelRows(sel.overlay, level, ids), [sel.overlay, level, ids.gangId, ids.reiheId, ids.regalId]);
  const { plaetzeCount, belegt } = useMemo(() => editorCounts(sel.overlay, level, ids), [sel.overlay, level, ids.gangId, ids.reiheId, ids.regalId]);
  const plaetze = useMemo(() => editorPlaetze(sel.overlay, level, ids), [sel.overlay, level, ids.gangId, ids.reiheId, ids.regalId]);
  const gesamt = rows.reduce((s, r) => s + r.bestand, 0);
  const gruppiert = useMemo(() => groupRowsByArtikel(rows), [rows]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <BestandsSummary plaetzeCount={plaetzeCount} belegt={belegt} gesamt={gesamt} gewicht={plaetzeGewicht(plaetze)} max={plaetzeMaxGewicht(plaetze)} />
      <div className="flex shrink-0 gap-1.5">
        <button className={toggleBtnClass(gruppierung === 'platz')} onClick={() => setGruppierung('platz')}>
          Je Platz
        </button>
        <button className={toggleBtnClass(gruppierung === 'artikel')} onClick={() => setGruppierung('artikel')}>
          Je Artikel
        </button>
      </div>
      {gruppierung === 'platz' ? (
        <BestandsTabelle rows={rows} emptyText="Keine Bestände in dieser Ebene." />
      ) : (
        <ArtikelTabelle rows={gruppiert} />
      )}
    </div>
  );
}

/** Detailansicht für die Editor-Lager-Auswahl (Platz/Regal/Reihe/Gang/Lager), Pendant zur Sage-Selection unten. */
function EditorSelectionView({ sel }: { sel: NonNullable<EditorSelection> }) {
  const { level, zelle } = sel;
  const labels = editorLabels(sel);
  const title = level === 'platz' ? labels.platz : level === 'regal' ? labels.regal : level === 'reihe' ? labels.reihe : level === 'gang' ? labels.gang : labels.lager;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[16px] font-semibold tracking-tight">{title}</span>
        <button className={CLOSE_BTN} onClick={() => setEditorSelection(null)} title="Schließen">
          <X size={14} />
        </button>
      </div>
      <EditorBreadcrumb sel={sel} />
      <div className={MUTED}>
        {sel.overlay.name} · {sel.overlay.lagerkennung} · entworfenes Lager
      </div>
      <div className="perf-divider" />
      {level === 'platz' ? (
        zelle ? (
          zelle.platz ? (
            <PlatzPanel platz={zelle.platz} />
          ) : (
            <EditorLeerePlatzPanel zelle={zelle} />
          )
        ) : (
          <div className={MUTED}>Kein Platz ausgewählt.</div>
        )
      ) : (
        <EditorAggregatePanel sel={sel} level={level} />
      )}
    </>
  );
}

function ArticlePanel({ plätze }: { plätze: ArtikelPlatz[] }) {
  const anzeige = useStockAnzeigeConfig();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={TABLE_HEADER}>
        <span className="w-14 shrink-0">Lager</span>
        <span className="w-14 shrink-0">Platz</span>
        <span className="min-w-0 flex-1">Bezeichnung</span>
        <span className="w-16 shrink-0 text-right">Bestand</span>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        {plätze.length === 0 && <div className={`${MUTED} py-2`}>Keine Plätze gefunden.</div>}
        {plätze.map((p) => (
          <button
            key={`${p.ort.lagerkennung}-${p.platz.platzId}`}
            className={`${TABLE_ROW} hover:bg-raised/60`}
            onClick={() => setSelection({ ort: p.ort, platz: p.platz, rack: null })}
            title="In der 3D-Welt hervorheben"
          >
            <span className="w-14 shrink-0 font-mono text-accent">{p.ort.lagerkennung}</span>
            <span className="w-14 shrink-0 font-mono text-accent">{p.platz.kurz || `#${p.platz.platzId}`}</span>
            <span className="min-w-0 flex-1 truncate text-ink-soft">{p.platz.platzbezeichnung}</span>
            <span className="w-16 shrink-0 text-right font-mono" style={{ color: stockColor(p.bestand, true, anzeige, p.einheit) }}>
              {fmtMenge(p.bestand, p.einheit)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlatzPanel({ platz }: { platz: Lagerplatz }) {
  const anzeige = useStockAnzeigeConfig();
  const total = platz.bestaende.reduce((s, b) => s + b.bestand, 0);
  const gewicht = platzGewicht(platz);
  const max = platzMaxGewicht(platz);
  const überlastet = max > 0 && gewicht > max;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono font-semibold text-accent">Platz {platz.kurz || `#${platz.platzId}`}</span>
        <span className="font-mono text-[12px] font-semibold text-stock-mid">Σ {fmt(total)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className={MUTED}>Last</span>
        <span className="font-mono text-[13px] font-semibold" style={{ color: überlastet ? 'var(--color-stock-high)' : 'var(--color-ink)' }}>
          {fmtKg(gewicht)}
          {max > 0 ? ` / ${fmtKg(max)}` : ''}
        </span>
      </div>
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {platz.bestaende.length === 0 ? (
          <div className={MUTED}>Keine Bestände auf diesem Platz</div>
        ) : (
          platz.bestaende.map((b) => (
            <div key={b.artikelnummer} className="border-b border-line-soft pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12px]">{b.artikelnummer}</div>
                  <div className={`truncate ${MUTED}`}>{b.bezeichnung1}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-[13px] font-semibold" style={{ color: stockColor(b.bestand, true, anzeige, b.einheit) }}>
                    {fmtMenge(b.bestand, b.einheit)}
                  </div>
                  {b.gewicht > 0 && <div className={MUTED}>{fmtKg(b.bestand * b.gewicht)}</div>}
                </div>
              </div>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-line-soft">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, b.bestand / 6)}%`, background: stockColor(b.bestand, true, anzeige, b.einheit) }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ortRows(ort: Lagerort): OrtRow[] {
  return rowsFromPlaetze(ort.plaetze);
}

/** Zeilen nur für eine Regal-Instanz (Gang/Reihe) statt des gesamten Lagerorts. */
export function rackRows(ort: Lagerort, rack: Pick<PlacedRack, 'kind' | 'gang'>): OrtRow[] {
  return rowsFromPlaetze(gangPlätze(ort, rack.kind, rack.gang));
}

function BestandsSummary({
  plaetzeCount,
  belegt,
  gesamt,
  gewicht,
  max,
}: {
  plaetzeCount: number;
  belegt: number;
  gesamt: number;
  gewicht: number;
  max: number;
}) {
  const überlastet = max > 0 && gewicht > max;
  return (
    <>
      <div className="flex items-center justify-between">
        <span className={MUTED}>
          {plaetzeCount} Plätze · {belegt} belegt
        </span>
        <span className="font-mono text-[12px] font-semibold text-stock-mid">Σ {fmt(gesamt)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className={MUTED}>Gesamtlast</span>
        <span className="font-mono text-[13px] font-semibold" style={{ color: überlastet ? 'var(--color-stock-high)' : 'var(--color-ink)' }}>
          {fmtKg(gewicht)}
          {max > 0 ? ` / ${fmtKg(max)}` : ''}
        </span>
      </div>
    </>
  );
}

function BestandsTabelle({ rows, emptyText }: { rows: OrtRow[]; emptyText: string }) {
  const anzeige = useStockAnzeigeConfig();
  return (
    <>
      <div className={TABLE_HEADER}>
        <span className="w-14 shrink-0">Platz</span>
        <span className="w-16 shrink-0">Artikel</span>
        <span className="min-w-0 flex-1">Bezeichnung</span>
        <span className="w-16 shrink-0 text-right">Bestand</span>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 && <div className={`${MUTED} py-2`}>{emptyText}</div>}
        {rows.map((r) => (
          <div key={`${r.platzId}-${r.artikel}`} className={TABLE_ROW}>
            <span className="w-14 shrink-0 font-mono text-accent">{r.platz}</span>
            <span className="w-16 shrink-0 font-mono">{r.artikel}</span>
            <span className="min-w-0 flex-1 truncate text-ink-soft">{r.bezeichnung}</span>
            <span className="w-16 shrink-0 text-right font-mono" style={{ color: stockColor(r.bestand, true, anzeige, r.einheit) }}>
              {fmtMenge(r.bestand, r.einheit)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function OrtPanel({ ort }: { ort: Lagerort }) {
  const rows = ortRows(ort);
  const gesamt = rows.reduce((s, r) => s + r.bestand, 0);
  const belegt = new Set(rows.map((r) => r.platzId)).size;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <BestandsSummary plaetzeCount={ort.plaetze.length} belegt={belegt} gesamt={gesamt} gewicht={ortGewicht(ort)} max={ortMaxGewicht(ort)} />
      <BestandsTabelle rows={rows} emptyText="Keine Bestände in diesem Lager." />
    </div>
  );
}

function RackPanel({ ort, rack }: { ort: Lagerort; rack: PlacedRack }) {
  const plaetze = useMemo(() => gangPlätze(ort, rack.kind, rack.gang), [ort, rack.kind, rack.gang]);
  const rows = useMemo(() => rowsFromPlaetze(plaetze), [plaetze]);
  const gesamt = rows.reduce((s, r) => s + r.bestand, 0);
  const belegt = new Set(rows.map((r) => r.platzId)).size;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <BestandsSummary plaetzeCount={plaetze.length} belegt={belegt} gesamt={gesamt} gewicht={plaetzeGewicht(plaetze)} max={plaetzeMaxGewicht(plaetze)} />
      <BestandsTabelle rows={rows} emptyText="Keine Bestände in diesem Regal." />
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('de-DE');
}

function fmtMenge(n: number, einheit: string): string {
  return einheit ? `${fmt(n)} ${einheit}` : fmt(n);
}
