import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { StockAnzeigeConfig, StockSchwelleRegel, StockStufe } from '../../shared/anzeige';
import { loadStockAnzeigeConfig, saveStockAnzeigeConfig, useStockAnzeigeConfig } from '../store';

const textInputClass =
  'h-8 rounded-md border border-line bg-void px-2 font-mono text-[12.5px] text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent/40';
const iconBtnClass =
  'flex h-7 w-7 items-center justify-center rounded-md border border-line bg-raised text-ink-faint hover:border-accent/40 hover:text-accent';
const primaryBtnClass =
  'rounded-lg border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-[12.5px] font-semibold text-accent hover:bg-accent/20 disabled:opacity-40';
const secondaryBtnClass =
  'rounded-lg border border-line bg-raised px-3.5 py-1.5 text-[12.5px] text-ink-soft hover:border-accent/40 hover:text-accent disabled:opacity-40';
const modusBtnClass = (active: boolean) =>
  `flex-1 rounded-md border px-3 py-2 text-[12.5px] font-medium transition-colors ${
    active ? 'border-accent/40 bg-accent/15 text-accent' : 'border-line text-ink-faint hover:bg-raised'
  }`;

function newStufe(min: number): StockStufe {
  return { min, farbe: '#f1c40f' };
}
function newRegel(): StockSchwelleRegel {
  return { einheit: '', stufen: [newStufe(0)] };
}

function withStufen(regeln: StockSchwelleRegel[], i: number, fn: (r: StockSchwelleRegel) => StockSchwelleRegel): StockSchwelleRegel[] {
  return regeln.map((r, idx) => (idx === i ? fn(r) : r));
}

/**
 * Einstellungen für die Bestands-Einfärbung im 3D-Viewer (Standard vs. Schwellenwert je
 * Mengeneinheit), pro Mandant serverseitig gespeichert — s. `shared/anzeige.ts`.
 */
export default function StockAnzeigeSettings({
  open,
  onClose,
  db,
  mandant,
}: {
  open: boolean;
  onClose: () => void;
  db: string;
  mandant: number;
}) {
  const aktuell = useStockAnzeigeConfig();
  const [config, setConfig] = useState<StockAnzeigeConfig>(aktuell);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus(null);
    loadStockAnzeigeConfig(db, mandant).catch(() => undefined);
  }, [open, db, mandant]);

  useEffect(() => {
    if (open) setConfig(aktuell);
  }, [open, aktuell]);

  if (!open) return null;

  const speichern = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await saveStockAnzeigeConfig(db, mandant, config);
      setStatus('Gespeichert.');
    } catch (e) {
      setStatus(`Fehler: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-void/70 p-6 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-line bg-panel shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <div className="text-[13.5px] font-bold text-ink">Bestands-Anzeige</div>
            <div className="text-[10.5px] uppercase tracking-wider text-ink-faint">Mandant {mandant}</div>
          </div>
          <button className={iconBtnClass} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex gap-2">
            <button className={modusBtnClass(config.modus === 'standard')} onClick={() => setConfig((c) => ({ ...c, modus: 'standard' }))}>
              Standard
            </button>
            <button className={modusBtnClass(config.modus === 'schwelle')} onClick={() => setConfig((c) => ({ ...c, modus: 'schwelle' }))}>
              Schwellenwert
            </button>
          </div>

          <div className="mb-4 flex flex-col gap-2.5 rounded-lg border border-line bg-raised p-3">
            <label className="flex items-center justify-between text-[12.5px] text-ink-soft">
              Leer (kein Bestand)
              <input
                type="color"
                className="h-7 w-12 cursor-pointer rounded border border-line bg-void"
                value={config.leerFarbe}
                onChange={(e) => setConfig((c) => ({ ...c, leerFarbe: e.target.value }))}
              />
            </label>
            {config.modus === 'standard' && (
              <label className="flex items-center justify-between text-[12.5px] text-ink-soft">
                Bestand vorhanden
                <input
                  type="color"
                  className="h-7 w-12 cursor-pointer rounded border border-line bg-void"
                  value={config.standardFarbe}
                  onChange={(e) => setConfig((c) => ({ ...c, standardFarbe: e.target.value }))}
                />
              </label>
            )}
            {config.modus === 'schwelle' && (
              <label className="flex items-center justify-between text-[12.5px] text-ink-soft" title="Wird verwendet, wenn die Mengeneinheit eines Bestands keine eigene Regel hat">
                Fallback (Einheit ohne Regel)
                <input
                  type="color"
                  className="h-7 w-12 cursor-pointer rounded border border-line bg-void"
                  value={config.standardFarbe}
                  onChange={(e) => setConfig((c) => ({ ...c, standardFarbe: e.target.value }))}
                />
              </label>
            )}
          </div>

          {config.modus === 'schwelle' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Schwellenwerte je Mengeneinheit</div>
                <button className={secondaryBtnClass} onClick={() => setConfig((c) => ({ ...c, schwellen: [...c.schwellen, newRegel()] }))}>
                  <span className="inline-flex items-center gap-1">
                    <Plus size={13} /> Einheit hinzufügen
                  </span>
                </button>
              </div>

              {config.schwellen.length === 0 && (
                <div className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-ink-faint">
                  Noch keine Einheit — „Einheit hinzufügen" klicken.
                </div>
              )}

              {config.schwellen.map((regel, i) => (
                <div key={i} className="rounded-lg border border-line bg-raised p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      className={`${textInputClass} w-24`}
                      value={regel.einheit}
                      placeholder="z. B. KG"
                      onChange={(e) => setConfig((c) => ({ ...c, schwellen: withStufen(c.schwellen, i, (r) => ({ ...r, einheit: e.target.value })) }))}
                    />
                    <span className="text-[11.5px] text-ink-faint">Sage-Lagermengeneinheit</span>
                    <button
                      className={`${iconBtnClass} ml-auto`}
                      title="Einheit entfernen"
                      onClick={() => setConfig((c) => ({ ...c, schwellen: c.schwellen.filter((_, idx) => idx !== i) }))}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {regel.stufen.map((stufe, si) => (
                      <div key={si} className="flex items-center gap-1.5 text-[11.5px] text-ink-faint">
                        <span>ab</span>
                        <input
                          className={`${textInputClass} w-20 text-right`}
                          type="number"
                          value={stufe.min}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setConfig((c) => ({
                              ...c,
                              schwellen: withStufen(c.schwellen, i, (r) => ({
                                ...r,
                                stufen: r.stufen.map((s, idx) => (idx === si ? { ...s, min: v } : s)),
                              })),
                            }));
                          }}
                        />
                        <input
                          type="color"
                          className="h-7 w-12 cursor-pointer rounded border border-line bg-void"
                          value={stufe.farbe}
                          onChange={(e) => {
                            const v = e.target.value;
                            setConfig((c) => ({
                              ...c,
                              schwellen: withStufen(c.schwellen, i, (r) => ({
                                ...r,
                                stufen: r.stufen.map((s, idx) => (idx === si ? { ...s, farbe: v } : s)),
                              })),
                            }));
                          }}
                        />
                        <button
                          className={iconBtnClass}
                          title="Stufe entfernen"
                          onClick={() =>
                            setConfig((c) => ({
                              ...c,
                              schwellen: withStufen(c.schwellen, i, (r) => ({ ...r, stufen: r.stufen.filter((_, idx) => idx !== si) })),
                            }))
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      className={`${secondaryBtnClass} self-start`}
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          schwellen: withStufen(c.schwellen, i, (r) => {
                            const maxMin = r.stufen.reduce((m, s) => Math.max(m, s.min), 0);
                            return { ...r, stufen: [...r.stufen, newStufe(maxMin + 100)] };
                          }),
                        }))
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        <Plus size={12} /> Stufe
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {status && <div className="mt-3 text-[12.5px] text-accent">{status}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          <button className={secondaryBtnClass} onClick={onClose}>
            Schließen
          </button>
          <button className={primaryBtnClass} disabled={busy} onClick={speichern}>
            {busy ? 'Speichere…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
