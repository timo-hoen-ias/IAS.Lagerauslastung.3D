import { useMemo, useSyncExternalStore } from 'react';
import type { BuchungEvent, Lagerort, Lagerplatz } from '../shared/types';
import {
  applyTransform,
  clampScale,
  IDENTITY_TRANSFORM,
  type PlacedRack,
  type RackScale,
  type RackTransform,
} from './scene/transform';
import type { RackPlacement } from './scene/layout';

export type Selection = { ort: Lagerort; platz: Lagerplatz | null } | null;

let selection: Selection = null;
const selectionListeners = new Set<() => void>();

export function setSelection(s: Selection): void {
  selection = s;
  for (const l of selectionListeners) l();
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

export type CamState = { x: number; z: number; yaw: number };

let camSnapshot: CamState = { x: 0, z: 0, yaw: 0 };
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
