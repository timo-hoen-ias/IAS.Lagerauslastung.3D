import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { Lagerort, Lagerplatz } from '../shared/types';
import {
  applyTransform,
  IDENTITY_TRANSFORM,
  type PlacedRack,
  type RackTransform,
} from './scene/transform';
import type { RackPlacement } from './scene/layout';

export type Selection = { ort: Lagerort; platz: Lagerplatz | null } | null;

const SelectionContext = createContext<{ selection: Selection; setSelection: (s: Selection) => void }>({
  selection: null,
  setSelection: () => {},
});

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>(null);
  return <SelectionContext.Provider value={{ selection, setSelection }}>{children}</SelectionContext.Provider>;
}

export const useSelection = () => useContext(SelectionContext);

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

const TRANSFORM_KEY = 'wm-rack-transforms';

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
        scale: typeof v.scale === 'number' && v.scale >= 0.5 && v.scale <= 2 ? v.scale : 1,
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
    () => placements.map((p) => applyTransform(p, t[p.ort.lagerkennung] ?? IDENTITY_TRANSFORM)),
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
