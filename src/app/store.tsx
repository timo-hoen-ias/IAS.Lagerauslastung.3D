import { useMemo, useSyncExternalStore } from 'react';
import type { BuchungEvent, Lagerort, Lagerplatz } from '../shared/types';
import { DEFAULT_STOCK_ANZEIGE, type StockAnzeigeConfig } from '../shared/anzeige';
import {
  applyTransform,
  clampScale,
  IDENTITY_TRANSFORM,
  type PlacedRack,
  type RackScale,
  type RackTransform,
} from './scene/transform';
import type { RackPlacement } from './scene/layout';
import type { EditorLagerOverlay, EditorLevel, EditorZelleOverlay } from './editorOverlay';

/**
 * `rack` verankert die Auswahl auf einer konkreten Regal-Instanz (Gang/Reihe,
 * s. `RackPlacement.gang` in `layout.ts`) statt auf dem gesamten Lagerort –
 * ermöglicht die Regal-Ebene im Inspector zwischen Platz- und Lager-Ansicht.
 * `null`, wenn die Auswahl nicht auf ein bestimmtes Regal zurückgeht (z. B.
 * Artikelsuche-Treffer ohne 3D-Kontext).
 */
export type Selection = { ort: Lagerort; platz: Lagerplatz | null; rack: PlacedRack | null } | null;

let selection: Selection = null;
const selectionListeners = new Set<() => void>();

export function setSelection(s: Selection): void {
  selection = s;
  if (s) editorSelection = null;
  for (const l of selectionListeners) l();
  for (const l of editorSelectionListeners) l();
}

function subscribeSelection(cb: () => void): () => void {
  selectionListeners.add(cb);
  return () => selectionListeners.delete(cb);
}

export function useSelection(): Selection {
  return useSyncExternalStore(subscribeSelection, () => selection, () => selection);
}

/**
 * Selector-Hook: true, wenn genau dieses Lager (ohne Platz) ausgewählt ist.
 * Re-rendert nur das betroffene Regal statt aller Regale der Szene bei jedem
 * Selektionswechsel (useSyncExternalStore bailt aus, wenn sich der aus der
 * Selektion abgeleitete Wert für dieses Regal nicht ändert).
 */
export function useIsRackOrtSelected(lagerkennung: string): boolean {
  const getSnapshot = () => selection?.ort.lagerkennung === lagerkennung && !selection?.platz;
  return useSyncExternalStore(subscribeSelection, getSnapshot, getSnapshot);
}

/**
 * Selector-Hook: platzId des selektierten Platzes in diesem Regal, sonst -1.
 * Wie useIsRackOrtSelected re-rendert das nur das betroffene Regal.
 */
export function useSelectedPlatzId(rackKey: string): number {
  const getSnapshot = () => (selection?.ort.lagerkennung === rackKey ? (selection?.platz?.platzId ?? -1) : -1);
  return useSyncExternalStore(subscribeSelection, getSnapshot, getSnapshot);
}

// ---- Auswahl im Lager-Editor-Overlay (Platz → Regal → Regalreihe → Gang → Lager) -------

/**
 * Auswahl innerhalb eines im Editor entworfenen Lagers, unabhängig von `Selection` (Sage-
 * Live-Ansicht) – beide Auswahl-Arten schließen sich gegenseitig aus (s. `setSelection`/
 * `setEditorSelection`), der Inspector zeigt immer nur eine davon. `zelle` ist nur bei
 * `level === 'platz'` gesetzt; die IDs (`gangId`/`reiheId`/`regalId`) bleiben beim
 * Hochnavigieren über den Breadcrumb erhalten und grenzen die jeweilige Ebene ein
 * (s. `editorZellen` in `editorOverlay.ts`).
 */
export type EditorSelection = {
  overlay: EditorLagerOverlay;
  level: EditorLevel;
  gangId: string;
  reiheId: string;
  regalId: string;
  zelle: EditorZelleOverlay | null;
} | null;

let editorSelection: EditorSelection = null;
const editorSelectionListeners = new Set<() => void>();

export function setEditorSelection(s: EditorSelection): void {
  editorSelection = s;
  if (s) selection = null;
  for (const l of editorSelectionListeners) l();
  for (const l of selectionListeners) l();
}

function subscribeEditorSelection(cb: () => void): () => void {
  editorSelectionListeners.add(cb);
  return () => editorSelectionListeners.delete(cb);
}

export function useEditorSelection(): EditorSelection {
  return useSyncExternalStore(subscribeEditorSelection, () => editorSelection, () => editorSelection);
}

/** Leert beide Auswahl-Arten zugleich (z. B. Ego-Modus: Blick trifft weder Sage-Regal noch Editor-Zelle). */
export function clearSelections(): void {
  selection = null;
  editorSelection = null;
  for (const l of selectionListeners) l();
  for (const l of editorSelectionListeners) l();
}

// ---- Spieler (für Minimap) -------------------------------------------------

export type PlayerState = { x: number; z: number; yaw: number };

let playerSnapshot: PlayerState = { x: 0, z: 0, yaw: 0 };
const playerListeners = new Set<() => void>();

export function updatePlayer(state: PlayerState): void {
  playerSnapshot = state;
  for (const l of playerListeners) l();
}

export function getPlayer(): PlayerState {
  return playerSnapshot;
}

export function usePlayer(): PlayerState {
  return useSyncExternalStore(
    (cb) => {
      playerListeners.add(cb);
      return () => playerListeners.delete(cb);
    },
    getPlayer,
    getPlayer,
  );
}

// ---- Kamera (für Koordinaten-Readout) --------------------------------------

export type CamState = { x: number; y: number; z: number; yaw: number };

let camSnapshot: CamState = { x: 0, y: 0, z: 0, yaw: 0 };
const camListeners = new Set<() => void>();

export function updateCam(state: CamState): void {
  camSnapshot = state;
  for (const l of camListeners) l();
}

export function useCam(): CamState {
  return useSyncExternalStore(
    (cb) => {
      camListeners.add(cb);
      return () => camListeners.delete(cb);
    },
    () => camSnapshot,
    () => camSnapshot,
  );
}

// ---- Regal-Transformationen (verschieben/rotieren/skalieren, persistiert) ---

const TRANSFORM_KEY = 'wm-rack-transforms-v2';

function normalizeScale(scale: unknown): RackScale {
  if (typeof scale === 'number') {
    return { x: clampScale(scale), y: clampScale(scale), z: clampScale(scale) };
  }
  if (scale && typeof scale === 'object') {
    const s = scale as Partial<RackScale>;
    return { x: clampScale(s.x ?? 1), y: clampScale(s.y ?? 1), z: clampScale(s.z ?? 1) };
  }
  return { x: 1, y: 1, z: 1 };
}

function loadTransforms(): Record<string, RackTransform> {
  try {
    const raw = localStorage.getItem(TRANSFORM_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, RackTransform>;
    const out: Record<string, RackTransform> = {};
    for (const [k, v] of Object.entries(parsed)) {
      out[k] = {
        x: Number(v.x) || 0,
        z: Number(v.z) || 0,
        rotY: Number(v.rotY) || 0,
        scale: normalizeScale(v.scale),
      };
    }
    return out;
  } catch {
    return {};
  }
}

let transforms: Record<string, RackTransform> = loadTransforms();
const transformListeners = new Set<() => void>();

function notifyTransforms(): void {
  try {
    localStorage.setItem(TRANSFORM_KEY, JSON.stringify(transforms));
  } catch {
    /* Speicher voll/nicht verfügbar – ignorieren */
  }
  for (const l of transformListeners) l();
}

export function getTransform(key: string): RackTransform {
  return transforms[key] ?? IDENTITY_TRANSFORM;
}

export function setTransform(key: string, t: RackTransform): void {
  transforms = { ...transforms, [key]: t };
  notifyTransforms();
}

export function resetTransform(key: string): void {
  const next = { ...transforms };
  delete next[key];
  transforms = next;
  notifyTransforms();
}

export function useRackTransforms(): Record<string, RackTransform> {
  return useSyncExternalStore(
    (cb) => {
      transformListeners.add(cb);
      return () => transformListeners.delete(cb);
    },
    () => transforms,
    () => transforms,
  );
}

export function useEffectiveRacks(placements: RackPlacement[]): PlacedRack[] {
  const t = useRackTransforms();
  return useMemo(
    () => placements.map((p) => applyTransform(p, t[p.key] ?? IDENTITY_TRANSFORM)),
    [placements, t],
  );
}

// ---- Ausgewähltes Regal (Bearbeiten-Modus) ---------------------------------

let selectedRack: string | null = null;
const selectedListeners = new Set<() => void>();

export function setSelectedRack(key: string | null): void {
  selectedRack = key;
  for (const l of selectedListeners) l();
}

export function useSelectedRack(): string | null {
  return useSyncExternalStore(
    (cb) => {
      selectedListeners.add(cb);
      return () => selectedListeners.delete(cb);
    },
    () => selectedRack,
    () => selectedRack,
  );
}

// ---- Ausgewählter Artikel (Suche + Hervorhebung) ----------------------------

let selectedArticle: string | null = null;
const articleListeners = new Set<() => void>();

export function setSelectedArticle(artikel: string | null): void {
  selectedArticle = artikel;
  for (const l of articleListeners) l();
}

export function useSelectedArticle(): string | null {
  return useSyncExternalStore(
    (cb) => {
      articleListeners.add(cb);
      return () => articleListeners.delete(cb);
    },
    () => selectedArticle,
    () => selectedArticle,
  );
}

// ---- Live-Buchungen (Live-Ansicht) -----------------------------------------

export type LiveBuchung = BuchungEvent & { id: number; receivedAt: number };

/** Wie lange ein Buchungs-Event im Store vorgehalten wird (Animation + Puffer). */
export const BUCHUNG_STORE_MS = 10_000;

let liveBuchungen: LiveBuchung[] = [];
let buchungSeq = 0;
const buchungListeners = new Set<() => void>();

export function pushBuchung(e: BuchungEvent): void {
  const receivedAt = Date.now();
  liveBuchungen = [...liveBuchungen, { ...e, id: ++buchungSeq, receivedAt }];
  const cut = receivedAt - BUCHUNG_STORE_MS;
  if (liveBuchungen.length > 0 && liveBuchungen[0]!.receivedAt < cut) {
    liveBuchungen = liveBuchungen.filter((b) => b.receivedAt >= cut);
  }
  for (const l of buchungListeners) l();
}

export function useBuchungen(): LiveBuchung[] {
  return useSyncExternalStore(
    (cb) => {
      buchungListeners.add(cb);
      return () => buchungListeners.delete(cb);
    },
    () => liveBuchungen,
    () => liveBuchungen,
  );
}

// ---- TransformControls-Modus (Bearbeiten) -----------------------------------

export type TransformMode = 'translate' | 'rotate' | 'scale';

let transformMode: TransformMode = 'translate';
const transformModeListeners = new Set<() => void>();

export function setTransformMode(m: TransformMode): void {
  transformMode = m;
  for (const l of transformModeListeners) l();
}

export function useTransformMode(): TransformMode {
  return useSyncExternalStore(
    (cb) => {
      transformModeListeners.add(cb);
      return () => transformModeListeners.delete(cb);
    },
    () => transformMode,
    () => transformMode,
  );
}

// ---- Aktiver Drag (deaktiviert OrbitControls während des Ziehens) -----------

let dragActive = false;
const dragListeners = new Set<() => void>();

export function setDragActive(v: boolean): void {
  dragActive = v;
  for (const l of dragListeners) l();
}

export function useDragActive(): boolean {
  return useSyncExternalStore(
    (cb) => {
      dragListeners.add(cb);
      return () => dragListeners.delete(cb);
    },
    () => dragActive,
    () => dragActive,
  );
}

// ---- Live-Buchungs-Verbindung (WebSocket-Status fürs HUD) -------------------

let wsConnected = false;
const wsListeners = new Set<() => void>();

export function setWsConnected(v: boolean): void {
  wsConnected = v;
  for (const l of wsListeners) l();
}

export function useWsConnected(): boolean {
  return useSyncExternalStore(
    (cb) => {
      wsListeners.add(cb);
      return () => wsListeners.delete(cb);
    },
    () => wsConnected,
    () => wsConnected,
  );
}

// ---- Messpunkte (Messwerkzeug) ---------------------------------------------

export type Point2D = { x: number; z: number };

let measurePoints: Point2D[] = [];
const measureListeners = new Set<() => void>();

function notifyMeasure(): void {
  for (const l of measureListeners) l();
}

export function addMeasurePoint(p: Point2D): void {
  measurePoints = measurePoints.length >= 2 ? [p] : [...measurePoints, p];
  notifyMeasure();
}

// ---- Sichtbarkeit entworfener Läger (Lager-Editor-Overlay im Viewer) -------

const EDITOR_LAGER_VISIBLE_KEY = 'wm-editor-lager-visible';

function loadVisibleEditorLager(): Set<string> {
  try {
    const raw = localStorage.getItem(EDITOR_LAGER_VISIBLE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

let visibleEditorLager: Set<string> = loadVisibleEditorLager();
const visibleEditorLagerListeners = new Set<() => void>();

function notifyVisibleEditorLager(): void {
  try {
    localStorage.setItem(EDITOR_LAGER_VISIBLE_KEY, JSON.stringify([...visibleEditorLager]));
  } catch {
    /* Speicher voll/nicht verfügbar – ignorieren */
  }
  for (const l of visibleEditorLagerListeners) l();
}

export function toggleEditorLagerVisible(id: string): void {
  const next = new Set(visibleEditorLager);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  visibleEditorLager = next;
  notifyVisibleEditorLager();
}

export function useVisibleEditorLagerIds(): Set<string> {
  return useSyncExternalStore(
    (cb) => {
      visibleEditorLagerListeners.add(cb);
      return () => visibleEditorLagerListeners.delete(cb);
    },
    () => visibleEditorLager,
    () => visibleEditorLager,
  );
}

export function clearMeasure(): void {
  measurePoints = [];
  notifyMeasure();
}

export function useMeasurePoints(): Point2D[] {
  return useSyncExternalStore(
    (cb) => {
      measureListeners.add(cb);
      return () => measureListeners.delete(cb);
    },
    () => measurePoints,
    () => measurePoints,
  );
}

// ---- Sichtbarkeit echter Sage-Läger (einzelne Lagerkennungen ausblenden) ---

const HIDDEN_LAGER_KEY = 'wm-hidden-lager';

function loadHiddenLager(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_LAGER_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

let hiddenLager: Set<string> = loadHiddenLager();
const hiddenLagerListeners = new Set<() => void>();

function notifyHiddenLager(): void {
  try {
    localStorage.setItem(HIDDEN_LAGER_KEY, JSON.stringify([...hiddenLager]));
  } catch {
    /* Speicher voll/nicht verfügbar – ignorieren */
  }
  for (const l of hiddenLagerListeners) l();
}

export function toggleLagerVisible(lagerkennung: string): void {
  const next = new Set(hiddenLager);
  if (next.has(lagerkennung)) next.delete(lagerkennung);
  else next.add(lagerkennung);
  hiddenLager = next;
  notifyHiddenLager();
}

/** Blendet alle übergebenen Lagerkennungen auf einmal ein oder aus ("Alle"/"Keine" in der Seitenleiste). */
export function setAllLagerVisible(lagerkennungen: string[], visible: boolean): void {
  hiddenLager = visible ? new Set() : new Set(lagerkennungen);
  notifyHiddenLager();
}

export function useHiddenLagerkennungen(): Set<string> {
  return useSyncExternalStore(
    (cb) => {
      hiddenLagerListeners.add(cb);
      return () => hiddenLagerListeners.delete(cb);
    },
    () => hiddenLager,
    () => hiddenLager,
  );
}

// ---- Bestands-Anzeige-Konfiguration (server-persistiert je Mandant, s. anzeigeStore.ts) ---

let stockAnzeige: StockAnzeigeConfig = DEFAULT_STOCK_ANZEIGE;
const stockAnzeigeListeners = new Set<() => void>();

function setStockAnzeigeConfig(config: StockAnzeigeConfig): void {
  stockAnzeige = config;
  for (const l of stockAnzeigeListeners) l();
}

export function useStockAnzeigeConfig(): StockAnzeigeConfig {
  return useSyncExternalStore(
    (cb) => {
      stockAnzeigeListeners.add(cb);
      return () => stockAnzeigeListeners.delete(cb);
    },
    () => stockAnzeige,
    () => stockAnzeige,
  );
}

/** Lädt die Anzeige-Konfiguration für Mandant/DB vom Server; bei Fehlern bleibt der bisherige Stand (Default beim ersten Laden). */
export async function loadStockAnzeigeConfig(db: string, mandant: number): Promise<void> {
  try {
    const r = await fetch(`/api/anzeige?db=${db}&mandant=${mandant}`);
    if (!r.ok) return;
    setStockAnzeigeConfig((await r.json()) as StockAnzeigeConfig);
  } catch {
    /* Backend nicht erreichbar – letzter Stand/Default bleibt aktiv */
  }
}

/** Speichert die Anzeige-Konfiguration serverseitig und übernimmt sie sofort lokal. */
export async function saveStockAnzeigeConfig(db: string, mandant: number, config: StockAnzeigeConfig): Promise<void> {
  setStockAnzeigeConfig(config);
  await fetch(`/api/anzeige?db=${db}&mandant=${mandant}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}
