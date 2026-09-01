import type { Lagerbestand, Lagerplatz } from '../../shared/types';
import type { StockAnzeigeConfig } from '../../shared/anzeige';
import { stockColor } from '../colors';
import { cellLocalPosition, cellSize, type RackPlacement } from './layout';

export type KistenAnteil = { artikel: string; matchcode: string; bestand: number; anteil: number; einheit: string };

/** Farben für Artikel-Kisten; pro Kiste indexbasiert, immer unterschiedlich. */
const KISTEN_FARBEN = [
  '#2ecc71', '#e74c3c', '#e6b93c', '#3498db', '#9b59b6', '#e67e22',
  '#1abc9c', '#ecf0f1', '#f39c12', '#00bcd4', '#c0392b', '#27ae60',
];

export function kistenFarbe(i: number): string {
  return KISTEN_FARBEN[i % KISTEN_FARBEN.length]!;
}

/**
 * Teilt die Bestände eines Platzes in Kisten-Anteile auf (nach Menge).
 * Überspringt Artikel mit bestand <= 0, kappt bei maxKisten (Rest als „…").
 */
export function bestandAnteile(bestaende: Lagerbestand[], maxKisten = 6): KistenAnteil[] {
  const aktiv = bestaende.filter((b) => b.bestand > 0);
  if (aktiv.length === 0) return [];
  const gesamt = aktiv.reduce((s, b) => s + b.bestand, 0);
  if (gesamt <= 0) return [];
  const anteile = aktiv.map((b) => ({
    artikel: b.artikelnummer,
    matchcode: b.matchcode || b.bezeichnung1,
    bestand: b.bestand,
    anteil: b.bestand / gesamt,
    einheit: b.einheit,
  }));
  if (anteile.length <= maxKisten) return anteile;
  const top = anteile.slice(0, maxKisten - 1);
  const rest = anteile.slice(maxKisten - 1);
  const restSumme = rest.reduce((s, a) => s + a.anteil, 0);
  return [...top, { artikel: '…', matchcode: '', bestand: rest.reduce((s, a) => s + a.bestand, 0), anteil: restSumme, einheit: top[0]?.einheit ?? '' }];
}

/** Bestand kompakt gerundet: 42.333 → '42.33', 42.9 → '42.9', 250 → '250'. */
export function fmtBestand(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Label-Text einer Artikelschachtel: Artikelnummer / Name / Bestand je Zeile. */
export function boxLabel(artikelnummer: string, name: string, bestand: number): string {
  return `${artikelnummer}\n${name}\n${fmtBestand(bestand)}`;
}

/** Text um 90° drehen, wenn die Box hochkant ist oder die Gesichtsbreite zu schmal ist. */
export function labelVertical(faceW: number, faceH: number, minW = 0.4): boolean {
  return faceH > faceW || faceW < minW;
}

const MIN_FONT = 0.035;
const MAX_FONT = 0.09;

/** Schriftgröße passend zur Gesichtsbreite, geklemmt auf einen lesbaren Bereich. */
export function labelFontSize(textLen: number, faceW: number): number {
  if (textLen <= 0 || faceW <= 0) return MAX_FONT;
  return Math.min(Math.max(faceW / (textLen * 0.55), MIN_FONT), MAX_FONT);
}

/** Label-Bauplan in Regal-Koordinaten (position + Rotation + Text). */
export type CellLabel = {
  key: string;
  pos: [number, number, number];
  text: string;
  side: 1 | -1;
  vertical: boolean;
  fontSize: number;
};

/** Instanz-Bauplan für eine Kiste (Segmente eines Platzes). */
export type CellSeg = {
  index: number; // globaler Index in cellSegments()-Ergebnis
  platzId: number;
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  empty: boolean; // leerer Platz → transparente Instanz
};

export type CellSegments = { segs: CellSeg[]; labels: CellLabel[] };

export const HOVER_COLOR = '#7ec8ff';

/**
 * Zerlegt die Plätze eines Regals in Instanz-Segmente + Labels (pure).
 * Einzelbox: 1 Segment (Bestandsfarbe), Mehrfach-Kisten: Segment je Anteil.
 * Labels auf den x-Seiten (Richtung Gang), 2 bei Einzelbox, je 1 bei Mehrfach.
 */
export function cellSegments(
  plaetze: Lagerplatz[],
  rack: Pick<RackPlacement, 'cols' | 'levels' | 'depth' | 'flat' | 'cellH' | 'kind' | 'gang'>,
  anzeige: StockAnzeigeConfig,
): CellSegments {
  const segs: CellSeg[] = [];
  const labels: CellLabel[] = [];
  let index = 0;
  const addLabel = (
    platzId: number,
    box: { w: number; h: number; d: number },
    [cx, cy, cz]: [number, number, number],
    x: number,
    side: 1 | -1,
    text: string,
  ) => {
    const vertical = labelVertical(box.d, box.h);
    const lineW = Math.max(...text.split('\n').map((l) => l.length));
    labels.push({
      key: `${platzId}:${x}:${side}`,
      pos: [cx + x, cy, cz],
      text,
      side,
      vertical,
      fontSize: labelFontSize(lineW, vertical ? box.h : box.d),
    });
  };

  for (const platz of plaetze) {
    const box = cellSize(platz);
    const [cx, cy, cz] = cellLocalPosition(platz, rack);
    const anteile = bestandAnteile(platz.bestaende);
    const leer = platz.bestaende.length === 0;

    if (leer) {
      segs.push({ index: index++, platzId: platz.platzId, pos: [cx, cy, cz], size: [box.w, box.h, box.d], color: stockColor(0, false, anzeige), empty: true });
      continue;
    }
    if (anteile.length <= 1) {
      const a = anteile[0];
      const total = a?.bestand ?? 0;
      segs.push({
        index: index++,
        platzId: platz.platzId,
        pos: [cx, cy, cz],
        size: [box.w, box.h, box.d],
        color: stockColor(total, true, anzeige, a?.einheit),
        empty: false,
      });
      const label = boxLabel(a?.artikel ?? '', a?.matchcode ?? '', total);
      addLabel(platz.platzId, box, [cx, cy, cz], box.w / 2 + 0.02, 1, label);
      addLabel(platz.platzId, box, [cx, cy, cz], -box.w / 2 - 0.02, -1, label);
      continue;
    }
    // Mehrfach-Kisten: Segmente entlang x, 1 Label je Segment auf der +x-Seite.
    const GAP = 0.05;
    const gesamtW = box.w - GAP * (anteile.length - 1);
    let laufX = -box.w / 2;
    for (let i = 0; i < anteile.length; i++) {
      const a = anteile[i]!;
      const segW = Math.max(0.02, a.anteil * gesamtW);
      const segX = laufX + segW / 2;
      laufX += segW + GAP;
      segs.push({ index: index++, platzId: platz.platzId, pos: [cx + segX, cy, cz], size: [segW, box.h, box.d], color: a.artikel === '…' ? '#8b95a3' : kistenFarbe(i), empty: false });
      addLabel(platz.platzId, box, [cx, cy, cz], segX + segW / 2 + 0.02, 1, boxLabel(a.artikel, a.matchcode, a.bestand));
    }
  }
  return { segs, labels };
}
