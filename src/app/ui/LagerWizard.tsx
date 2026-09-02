import { Fragment, useEffect, useState } from 'react';
import {
  AlignLeft,
  AlignRight,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  FlipHorizontal,
  FlipVertical,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react';
import type { EditorGang, EditorLager, EditorPlatz, EditorRegal, EditorRegalreihe, Punkt } from '../../shared/editor';
import { deriveEditorPlaetze, ebenenHoehen, regalDim3Bereiche, regalHoehe, rotateReihe } from '../../shared/editor';
import DecimalInput from './DecimalInput';
import GrundrissEditor from './GrundrissEditor';
import { RECHTECK_START } from './grundriss';
import EditorPreview3D, { type PreviewMode } from './EditorPreview3D';

let idSeq = 0;
/** Lokale ID ohne Web-Crypto — crypto.randomUUID() verlangt einen Secure Context, die App läuft aber oft per http im Lager-LAN. */
function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;
}

/** Maße, die ein neu erstelltes Regal übernimmt — s. `regalDefaults`-State (immer die zuletzt bearbeiteten Werte). */
type RegalMasse = Pick<EditorRegal, 'ebenen' | 'plaetzeProEbene' | 'breite' | 'tiefe' | 'ebenenHoehen'>;
const INITIALE_REGAL_MASSE: RegalMasse = { ebenen: 3, plaetzeProEbene: 4, breite: 1.2, tiefe: 1.0 };

function newRegal(masse: RegalMasse): EditorRegal {
  return { id: newId('regal'), ...masse, ebenenHoehen: masse.ebenenHoehen ? [...masse.ebenenHoehen] : undefined };
}
function newReihe(seite: 'links' | 'rechts', masse: RegalMasse): EditorRegalreihe {
  return { id: newId('reihe'), seite, regale: [newRegal(masse)] };
}
function newGang(masse: RegalMasse): EditorGang {
  return { id: newId('gang'), nummer: 0, breite: 3, reihen: [newReihe('links', masse), newReihe('rechts', masse)] };
}

function withGang(gaenge: EditorGang[], gangId: string, fn: (g: EditorGang) => EditorGang): EditorGang[] {
  return gaenge.map((g) => (g.id === gangId ? fn(g) : g));
}
function withReihe(gang: EditorGang, reiheId: string, fn: (r: EditorRegalreihe) => EditorRegalreihe): EditorGang {
  return { ...gang, reihen: gang.reihen.map((r) => (r.id === reiheId ? fn(r) : r)) };
}
function withRegal(reihe: EditorRegalreihe, regalId: string, fn: (x: EditorRegal) => EditorRegal): EditorRegalreihe {
  return { ...reihe, regale: reihe.regale.map((x) => (x.id === regalId ? fn(x) : x)) };
}
/** Gang-Nummer = Position in der Liste (Dim1) — nicht separat editierbar. */
function numbered(gaenge: EditorGang[]): EditorGang[] {
  return gaenge.map((g, i) => ({ ...g, nummer: i + 1 }));
}

/**
 * Spiegelt einen Gang: tauscht die Seite ("links"/"rechts") beider Reihen — Alternative zum
 * manuellen Verschieben in der 3D-Vorschau, die die konfigurierte Gangbreite exakt erhält (die
 * Sage-Zuordnung bleibt unverändert, da Dim3 rein aus der Reihenfolge in `gang.reihen`, nicht aus
 * `seite`, abgeleitet wird — s. `regalDim3Bereiche()`/`deriveEditorPlaetze()` in shared/editor.ts).
 */
function spiegleGang(gang: EditorGang): EditorGang {
  return { ...gang, reihen: gang.reihen.map((r) => ({ ...r, seite: r.seite === 'links' ? 'rechts' : 'links' })) };
}

/** Meterangabe auf 2 Nachkommastellen, ohne Fließkomma-Rauschen (z. B. 3 × 0.6 → "1.8" statt "1.7999999..."). */
function fmtM(n: number): string {
  return String(Math.round(n * 100) / 100);
}

const textInputClass =
  'h-8 rounded-md border border-line bg-void px-2 font-mono text-[12.5px] text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent/40';
const iconBtnClass =
  'flex h-7 w-7 items-center justify-center rounded-md border border-line bg-raised text-ink-faint hover:border-accent/40 hover:text-accent';
const primaryBtnClass =
  'rounded-lg border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-[12.5px] font-semibold text-accent hover:bg-accent/20 disabled:opacity-40';
const secondaryBtnClass =
  'rounded-lg border border-line bg-raised px-3.5 py-1.5 text-[12.5px] text-ink-soft hover:border-accent/40 hover:text-accent disabled:opacity-40';

type PreviewPlatz = EditorPlatz & { gefunden: boolean };
type ListItem = { id: string; name: string; mandant: number; lagerkennung: string };

export default function LagerWizard({ open, onClose, db }: { open: boolean; onClose: () => void; db: string }) {
  const [list, setList] = useState<ListItem[]>([]);
  const [lagerId, setLagerId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [lagerkennung, setLagerkennung] = useState('');
  const [mandant, setMandant] = useState(1);
  const [grundriss, setGrundriss] = useState<Punkt[]>(RECHTECK_START);
  const [gaenge, setGaenge] = useState<EditorGang[]>([]);
  const [preview, setPreview] = useState<PreviewPlatz[] | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('regal');
  const [busy, setBusy] = useState<'vorschau' | 'speichern' | 'laden' | null>(null);
  const [status, setStatus] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  /** Regale, deren Ebenenhöhen-Editor gerade aufgeklappt ist (nur UI-Zustand, nicht persistiert). */
  const [ebenenOffen, setEbenenOffen] = useState<Set<string>>(new Set());
  /** Gänge, die in der Liste eingeklappt sind — nur UI-Zustand, nicht persistiert. */
  const [gaengeEingeklappt, setGaengeEingeklappt] = useState<Set<string>>(new Set());
  /** Maße des zuletzt bearbeiteten Regals — Vorbelegung für neu erstellte Regale/Reihen/Gänge. */
  const [regalDefaults, setRegalDefaults] = useState<RegalMasse>(INITIALE_REGAL_MASSE);

  useEffect(() => {
    if (!open || db === 'perf') return;
    fetch(`/api/editor/lager?db=${db}`)
      .then((r) => r.json())
      .then((d: { lager?: ListItem[] }) => setList(d.lager ?? []))
      .catch(() => setList([]));
  }, [open, db]);

  const reset = () => {
    setLagerId(null);
    setName('');
    setLagerkennung('');
    setMandant(1);
    setGrundriss(RECHTECK_START);
    setGaenge([]);
    setPreview(null);
    setStatus(null);
  };

  const laden = async (id: string) => {
    setBusy('laden');
    setStatus(null);
    try {
      const r = await fetch(`/api/editor/lager/${id}?db=${db}`);
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? r.statusText);
      const d = (await r.json()) as EditorLager;
      setLagerId(d.id);
      setName(d.name);
      setLagerkennung(d.lagerkennung);
      setMandant(d.mandant);
      setGrundriss(d.grundriss.length ? d.grundriss : RECHTECK_START);
      setGaenge(d.gaenge);
      setPreview(null);
    } catch (e) {
      setStatus({ art: 'fehler', text: String(e instanceof Error ? e.message : e) });
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  const gangeNummeriert = numbered(gaenge);
  const hatVersatz = gaenge.some((g) => g.reihen.some((r) => r.versatz || r.anker || r.regale.some((x) => x.versatz)));
  const versaetzeZuruecksetzen = () =>
    setGaenge((gs) =>
      gs.map((g) => ({
        ...g,
        reihen: g.reihen.map((r) => ({
          ...r,
          versatz: undefined,
          anker: undefined,
          regale: r.regale.map((x) => ({ ...x, versatz: undefined })),
        })),
      })),
    );

  const vorschau = async () => {
    setBusy('vorschau');
    setStatus(null);
    try {
      const r = await fetch(`/api/editor/vorschau?db=${db}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lagerkennung, mandant, gaenge: gangeNummeriert }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? r.statusText);
      const d = (await r.json()) as { plaetze: PreviewPlatz[] };
      setPreview(d.plaetze);
    } catch (e) {
      setStatus({ art: 'fehler', text: String(e instanceof Error ? e.message : e) });
    } finally {
      setBusy(null);
    }
  };

  const speichern = async () => {
    setBusy('speichern');
    setStatus(null);
    try {
      const body = {
        name,
        mandant,
        lagerkennung,
        grundriss,
        gaenge: gangeNummeriert,
      };
      const r = await fetch(lagerId ? `/api/editor/lager/${lagerId}?db=${db}` : `/api/editor/lager?db=${db}`, {
        method: lagerId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? r.statusText);
      if (!lagerId) {
        const d = (await r.json()) as { id: string };
        setLagerId(d.id);
      }
      setStatus({ art: 'ok', text: 'Gespeichert.' });
    } catch (e) {
      setStatus({ art: 'fehler', text: String(e instanceof Error ? e.message : e) });
    } finally {
      setBusy(null);
    }
  };

  const gefundenCount = preview?.filter((p) => p.gefunden).length ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-void/70 p-6 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-xl border border-line bg-panel shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <div className="text-[13.5px] font-bold text-ink">Lager-Editor</div>
            <div className="text-[10.5px] uppercase tracking-wider text-ink-faint">Gänge · Regalreihen · Regale</div>
          </div>
          <button className={iconBtnClass} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[11.5px] text-ink-faint">
              Gespeicherte Lager
              <select
                className={textInputClass}
                value={lagerId ?? ''}
                onChange={(e) => (e.target.value ? laden(e.target.value) : reset())}
              >
                <option value="">— Neu anlegen —</option>
                {list.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.lagerkennung})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] text-ink-faint">
              Name
              <input className={textInputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Halle 1" />
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] text-ink-faint">
              Sage-Lagerkennung
              <input
                className={`${textInputClass} w-28`}
                value={lagerkennung}
                onChange={(e) => setLagerkennung(e.target.value)}
                placeholder="L-F-H"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] text-ink-faint">
              Mandant
              <input
                className={`${textInputClass} w-16 text-right`}
                type="number"
                value={mandant}
                onChange={(e) => setMandant(Number(e.target.value) || 0)}
              />
            </label>
          </div>

          <div className="mb-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Grundriss</div>
            <GrundrissEditor points={grundriss} onChange={setGrundriss} />
          </div>

          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Gänge</div>
            <button className={secondaryBtnClass} onClick={() => setGaenge((gs) => [...gs, newGang(regalDefaults)])}>
              <span className="inline-flex items-center gap-1">
                <Plus size={13} /> Gang hinzufügen
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {gangeNummeriert.map((gang) => {
              const dim3Bereiche = regalDim3Bereiche(gang);
              const dim3ById = new Map(dim3Bereiche.map((b) => [b.regalId, b]));
              const eingeklappt = gaengeEingeklappt.has(gang.id);
              const regalAnzahl = gang.reihen.reduce((s, r) => s + r.regale.length, 0);
              return (
              <div key={gang.id} className="rounded-lg border border-line bg-raised p-3">
                <div className={`flex items-center justify-between ${eingeklappt ? '' : 'mb-2'}`}>
                  <button
                    className="flex items-center gap-1.5 font-mono text-[12.5px] text-ink"
                    onClick={() =>
                      setGaengeEingeklappt((s) => {
                        const next = new Set(s);
                        if (next.has(gang.id)) next.delete(gang.id);
                        else next.add(gang.id);
                        return next;
                      })
                    }
                    title={eingeklappt ? 'Gang aufklappen' : 'Gang einklappen'}
                  >
                    {eingeklappt ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    Gang {gang.nummer} <span className="text-ink-faint">(Dim1)</span>
                    {eingeklappt && (
                      <span className="text-ink-faint">
                        · {regalAnzahl} {regalAnzahl === 1 ? 'Regal' : 'Regale'}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    {!eingeklappt && (
                      <label className="flex items-center gap-1.5 text-[11.5px] text-ink-faint">
                        Breite (m)
                        <DecimalInput
                          value={gang.breite}
                          onCommit={(v) => setGaenge((gs) => withGang(gs, gang.id, (g) => ({ ...g, breite: v })))}
                        />
                      </label>
                    )}
                    <button
                      className={iconBtnClass}
                      title="Gang spiegeln — tauscht links/rechts, ohne die Sage-Zuordnung zu verändern"
                      onClick={() => setGaenge((gs) => withGang(gs, gang.id, spiegleGang))}
                    >
                      <ArrowLeftRight size={13} />
                    </button>
                    <button
                      className={iconBtnClass}
                      title="Gang entfernen"
                      onClick={() => setGaenge((gs) => gs.filter((g) => g.id !== gang.id))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {!eingeklappt && (
                <div className="grid grid-cols-2 gap-3">
                  {gang.reihen.map((reihe) => {
                    const reiheDim3 = reihe.regale.map((r) => dim3ById.get(r.id)).filter((b) => b !== undefined);
                    const reiheVon = reiheDim3.length ? Math.min(...reiheDim3.map((b) => b.von)) : null;
                    const reiheBis = reiheDim3.length ? Math.max(...reiheDim3.map((b) => b.bis)) : null;
                    return (
                    <div key={reihe.id} className="rounded-md border border-line-soft bg-void/40 p-2.5">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                          Reihe {reihe.seite}
                          {reiheVon !== null && (
                            <span
                              className="ml-1.5 font-mono normal-case tracking-normal text-ink-faint/70"
                              title="Erster/letzter Sage-Lagerplatz dieser Reihe (Gang;Ebene;Dim3)"
                            >
                              · Dim3 {reiheVon}–{reiheBis}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            className={iconBtnClass}
                            title="Reihe um 90° drehen — an die reale Ausrichtung der Regale anpassen"
                            onClick={() =>
                              setGaenge((gs) =>
                                withGang(gs, gang.id, (g) =>
                                  withReihe(g, reihe.id, (r) => ({ ...r, rotation: rotateReihe(r.rotation, 90) })),
                                ),
                              )
                            }
                          >
                            <RotateCw size={13} />
                          </button>
                          <span className="font-mono text-[11px] text-ink-faint" title="Aktuelle Drehung der Reihe">
                            {reihe.rotation ?? 0}°
                          </span>
                          <button
                            className={`${iconBtnClass} ${reihe.spiegelX ? 'border-accent/40 text-accent' : ''}`}
                            title="Reihe an der Spaltenrichtung spiegeln — für Aufbauten, die per Drehung allein nicht passen"
                            onClick={() =>
                              setGaenge((gs) =>
                                withGang(gs, gang.id, (g) =>
                                  withReihe(g, reihe.id, (r) => ({ ...r, spiegelX: !r.spiegelX })),
                                ),
                              )
                            }
                          >
                            <FlipHorizontal size={13} />
                          </button>
                          <button
                            className={`${iconBtnClass} ${reihe.spiegelZ ? 'border-accent/40 text-accent' : ''}`}
                            title="Reihe an der Regaltiefe spiegeln — für Aufbauten, die per Drehung allein nicht passen"
                            onClick={() =>
                              setGaenge((gs) =>
                                withGang(gs, gang.id, (g) =>
                                  withReihe(g, reihe.id, (r) => ({ ...r, spiegelZ: !r.spiegelZ })),
                                ),
                              )
                            }
                          >
                            <FlipVertical size={13} />
                          </button>
                          <button
                            className={`${iconBtnClass} ${reihe.buendig === 'rechts' ? 'border-accent/40 text-accent' : ''}`}
                            title="Reihe rechtsbündig ausrichten — bei unterschiedlich langen Reihen an der rechten statt der linken Gang-Kante andocken, ohne die Sage-Zuordnung zu ändern"
                            onClick={() =>
                              setGaenge((gs) =>
                                withGang(gs, gang.id, (g) =>
                                  withReihe(g, reihe.id, (r) => ({ ...r, buendig: r.buendig === 'rechts' ? undefined : 'rechts' })),
                                ),
                              )
                            }
                          >
                            {reihe.buendig === 'rechts' ? <AlignRight size={13} /> : <AlignLeft size={13} />}
                          </button>
                          <button
                            className={iconBtnClass}
                            title="Regal hinzufügen"
                            onClick={() =>
                              setGaenge((gs) =>
                                withGang(gs, gang.id, (g) =>
                                  withReihe(g, reihe.id, (r) => ({ ...r, regale: [...r.regale, newRegal(regalDefaults)] })),
                                ),
                              )
                            }
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {reihe.regale.map((regal, i) => {
                          const bereich = dim3ById.get(regal.id);
                          return (
                          <Fragment key={regal.id}>
                          <div className="flex flex-col gap-1 text-[11.5px] text-ink-faint">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="w-4 font-mono text-ink-faint">{i + 1}</span>
                            {bereich && (
                              <span
                                className="font-mono text-ink-faint/70"
                                title="Sage-Lagerplatz-Bereich dieses Regals (Gang;Ebene;Dim3, je Ebene)"
                              >
                                {bereich.von === bereich.bis ? `Dim3 ${bereich.von}` : `Dim3 ${bereich.von}–${bereich.bis}`}
                              </span>
                            )}
                            <span title="Ebenen">Eb.</span>
                            <input
                              className={`${textInputClass} w-11 text-right`}
                              type="number"
                              min={1}
                              value={regal.ebenen}
                              onChange={(e) => {
                                const v = Math.max(1, Number(e.target.value) || 1);
                                setGaenge((gs) =>
                                  withGang(gs, gang.id, (g) =>
                                    withReihe(g, reihe.id, (r) => withRegal(r, regal.id, (x) => ({ ...x, ebenen: v }))),
                                  ),
                                );
                                setRegalDefaults((d) => ({ ...d, ebenen: v }));
                              }}
                            />
                            <span title="Plätze pro Ebene">Pl./Eb.</span>
                            <input
                              className={`${textInputClass} w-11 text-right`}
                              type="number"
                              min={1}
                              value={regal.plaetzeProEbene}
                              onChange={(e) => {
                                const v = Math.max(1, Number(e.target.value) || 1);
                                setRegalDefaults((d) => ({ ...d, plaetzeProEbene: v }));
                                setGaenge((gs) =>
                                  withGang(gs, gang.id, (g) =>
                                    withReihe(g, reihe.id, (r) =>
                                      withRegal(r, regal.id, (x) => ({ ...x, plaetzeProEbene: v })),
                                    ),
                                  ),
                                );
                              }}
                            />
                            <div className="ml-auto flex items-center gap-1">
                              <button
                                className={iconBtnClass}
                                title="Höhe je Ebene einzeln festlegen"
                                onClick={() =>
                                  setEbenenOffen((s) => {
                                    const next = new Set(s);
                                    if (next.has(regal.id)) next.delete(regal.id);
                                    else next.add(regal.id);
                                    return next;
                                  })
                                }
                              >
                                {ebenenOffen.has(regal.id) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </button>
                              <button
                                className={iconBtnClass}
                                title="Regal entfernen"
                                onClick={() =>
                                  setGaenge((gs) =>
                                    withGang(gs, gang.id, (g) =>
                                      withReihe(g, reihe.id, (r) => ({
                                        ...r,
                                        regale: r.regale.filter((x) => x.id !== regal.id),
                                      })),
                                    ),
                                  )
                                }
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="ml-5 flex flex-wrap items-center gap-1.5 text-ink-faint/80">
                            <span title="Breite × Tiefe (m)">
                              <DecimalInput
                                className={`${textInputClass} w-14 text-right`}
                                value={regal.breite}
                                onCommit={(v) => {
                                  setGaenge((gs) =>
                                    withGang(gs, gang.id, (g) =>
                                      withReihe(g, reihe.id, (r) => withRegal(r, regal.id, (x) => ({ ...x, breite: v }))),
                                    ),
                                  );
                                  setRegalDefaults((d) => ({ ...d, breite: v }));
                                }}
                              />
                            </span>
                            ×
                            <DecimalInput
                              className={`${textInputClass} w-14 text-right`}
                              value={regal.tiefe}
                              onCommit={(v) => {
                                setGaenge((gs) =>
                                  withGang(gs, gang.id, (g) =>
                                    withReihe(g, reihe.id, (r) => withRegal(r, regal.id, (x) => ({ ...x, tiefe: v }))),
                                  ),
                                );
                                setRegalDefaults((d) => ({ ...d, tiefe: v }));
                              }}
                            />
                            <span className="text-ink-faint">m</span>
                            <span className="font-mono text-ink-faint/70" title="Gesamthöhe = Summe der Ebenenhöhen">
                              Höhe {fmtM(regalHoehe(regal))} m
                            </span>
                          </div>
                          </div>
                          {ebenenOffen.has(regal.id) && (
                            <div className="ml-5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                              <span title="Höhe je Ebene, unten beginnend">Ebenenhöhen:</span>
                              {ebenenHoehen(regal).map((h, ebeneIdx) => (
                                <label key={ebeneIdx} className="flex items-center gap-1">
                                  <span className="font-mono">{ebeneIdx + 1}.</span>
                                  <DecimalInput
                                    className={`${textInputClass} w-14 text-right`}
                                    value={h}
                                    onCommit={(v) => {
                                      const hoehen = [...ebenenHoehen(regal)];
                                      hoehen[ebeneIdx] = v;
                                      setGaenge((gs) =>
                                        withGang(gs, gang.id, (g) =>
                                          withReihe(g, reihe.id, (r) =>
                                            withRegal(r, regal.id, (x) => ({ ...x, ebenenHoehen: hoehen })),
                                          ),
                                        ),
                                      );
                                      setRegalDefaults((d) => ({ ...d, ebenenHoehen: hoehen }));
                                    }}
                                  />
                                </label>
                              ))}
                            </div>
                          )}
                          </Fragment>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>
                )}
              </div>
              );
            })}
            {gangeNummeriert.length === 0 && (
              <div className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-ink-faint">
                Noch keine Gänge — „Gang hinzufügen" klicken.
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              <span>3D-Vorschau</span>
              <div className="flex items-center gap-2">
                <span className="normal-case tracking-normal text-ink-faint/80">
                  {previewMode === 'regal'
                    ? 'Regal ziehen: Position anpassen'
                    : previewMode === 'reihe'
                      ? 'Reihe ziehen: ganze Reihe verschieben'
                      : 'Gang ziehen: beide Reihen gemeinsam verschieben'}
                </span>
                <button
                  className="flex items-center gap-1 normal-case tracking-normal text-ink-faint hover:text-accent disabled:pointer-events-none disabled:opacity-40"
                  onClick={versaetzeZuruecksetzen}
                  disabled={!hatVersatz}
                  title="Alle per Drag gesetzten Positions-Anpassungen zurücksetzen — Regale/Reihen wieder auf die automatische Anordnung (inkl. konfigurierter Gangbreite)"
                >
                  <RotateCcw size={12} /> Positionen zurücksetzen
                </button>
                <div className="flex overflow-hidden rounded-md border border-line">
                  <button
                    className={`px-2 py-1 text-[11px] normal-case tracking-normal ${previewMode === 'regal' ? 'bg-accent/20 text-accent' : 'bg-raised text-ink-faint hover:text-accent'}`}
                    onClick={() => setPreviewMode('regal')}
                  >
                    Regal
                  </button>
                  <button
                    className={`px-2 py-1 text-[11px] normal-case tracking-normal ${previewMode === 'reihe' ? 'bg-accent/20 text-accent' : 'bg-raised text-ink-faint hover:text-accent'}`}
                    onClick={() => setPreviewMode('reihe')}
                  >
                    Reihe
                  </button>
                  <button
                    className={`px-2 py-1 text-[11px] normal-case tracking-normal ${previewMode === 'gang' ? 'bg-accent/20 text-accent' : 'bg-raised text-ink-faint hover:text-accent'}`}
                    onClick={() => setPreviewMode('gang')}
                  >
                    Gang
                  </button>
                </div>
              </div>
            </div>
            <EditorPreview3D
              grundriss={grundriss}
              gaenge={gangeNummeriert}
              mode={previewMode}
              onRegalMove={(regalId, versatz) =>
                setGaenge((gs) =>
                  gs.map((g) => ({
                    ...g,
                    reihen: g.reihen.map((r) => withRegal(r, regalId, (x) => ({ ...x, versatz }))),
                  })),
                )
              }
              onReiheMove={(reiheId, versatz, anker) =>
                setGaenge((gs) =>
                  gs.map((g) => withReihe(g, reiheId, (r) => ({ ...r, versatz, anker: anker ?? undefined }))),
                )
              }
              onGangMove={(gangId, delta) =>
                setGaenge((gs) =>
                  withGang(gs, gangId, (g) => ({
                    ...g,
                    reihen: g.reihen.map((r) => {
                      const v = r.versatz ?? { x: 0, z: 0 };
                      // Ein manueller Gang-Drag ersetzt einen ggf. gesetzten Z-Anker durch einen fixen
                      // Versatz — sonst würde die Z-Verschiebung wirkungslos verpuffen (s. `anker` in shared/editor.ts).
                      return { ...r, versatz: { x: v.x + delta.x, z: v.z + delta.z }, anker: undefined };
                    }),
                  })),
                )
              }
            />
          </div>

          {preview && (
            <div className="mt-4 rounded-lg border border-line bg-raised p-3">
              <div className="mb-2 flex items-center justify-between text-[11.5px]">
                <span className="font-semibold uppercase tracking-wider text-ink-faint">Abgleich mit Sage</span>
                <span className="font-mono text-ink-soft">
                  {gefundenCount} / {preview.length} Plätze gefunden
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto font-mono text-[11.5px]">
                {preview
                  .filter((p) => !p.gefunden)
                  .slice(0, 30)
                  .map((p) => (
                    <div key={p.code} className="flex items-center gap-2 py-0.5 text-stock-high">
                      <span>✗</span>
                      <span>{p.code}</span>
                    </div>
                  ))}
                {gefundenCount === preview.length && <div className="text-accent">✓ Alle Plätze in Sage gefunden.</div>}
              </div>
            </div>
          )}

          {status && (
            <div className={`mt-3 text-[12.5px] ${status.art === 'ok' ? 'text-accent' : 'text-stock-high'}`}>{status.text}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          <button className={secondaryBtnClass} disabled={busy !== null || !lagerkennung} onClick={vorschau}>
            {busy === 'vorschau' ? 'Prüfe…' : 'Vorschau / Abgleich'}
          </button>
          <button className={primaryBtnClass} disabled={busy !== null || !name || !lagerkennung} onClick={speichern}>
            {busy === 'speichern' ? 'Speichere…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
