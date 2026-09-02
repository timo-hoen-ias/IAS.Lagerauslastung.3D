import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { regalDim3Bereiche, type EditorGang, type Punkt } from '../../shared/editor';
import {
  gangGuides,
  gedrehteAusdehnung,
  layoutEditorGaenge,
  polygonCenter,
  wallSegments,
  wandKandidaten,
  type EditorRegalPlacement,
  type GangGuide,
} from '../scene/editorLayout';
import { RACK_GREY, VOID, ACCENT } from '../colors';

/** Meterangabe auf 2 Nachkommastellen, ohne Fließkomma-Rauschen. */
function fmtM(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export type PreviewMode = 'regal' | 'reihe' | 'gang';

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
/** Rundet einen Versatz-Wert (m) auf 5cm — feines Ziehen bleibt möglich, ohne krumme Werte zu speichern. */
function snap5cm(v: number): number {
  return Math.round(v * 20) / 20;
}

/** Fangradius (m) fürs Andocken an Kanten/Mitten benachbarter Regale beim Ziehen. */
const SNAP_ABSTAND = 0.15;

/** Ein Andock-Kandidat (Kante/Mitte eines Nachbar-Placements) mitsamt der Reihe, aus der er stammt — Grundlage fürs automatische Setzen eines Z-Ankers (s. `ReiheGroup`). */
type SnapKandidat = { value: number; reiheId: string };

/**
 * Platzhalter-`reiheId` für Wand-Andock-Kandidaten (s. `wandKandidaten()` in scene/editorLayout.ts)
 * — existiert absichtlich in keiner echten Reihe, damit `endDrag` in `ReiheGroup` beim Andocken an
 * eine Wand KEINEN Z-Anker setzt (Wände bewegen sich nicht, ein fixer `versatz` reicht).
 */
const WAND_KANDIDAT_ID = '__wand__';

/** Wand-Andock-Werte (nur X oder nur Z, je Wand) in dasselbe Kandidaten-Format wie `snapKandidaten()` gebracht. */
function wandAlsKandidaten(wand: { x: number[]; z: number[] }): { x: SnapKandidat[]; z: SnapKandidat[] } {
  return {
    x: wand.x.map((value) => ({ value, reiheId: WAND_KANDIDAT_ID })),
    z: wand.z.map((value) => ({ value, reiheId: WAND_KANDIDAT_ID })),
  };
}

/**
 * Rastet `pos` (Mittelpunkt, halbe Ausdehnung `half`) auf die nächstgelegene Kante/Mitte aus
 * `candidates` ein, sofern sie näher als `SNAP_ABSTAND` liegt — lässt Regale beim Ziehen
 * aneinander andocken, statt dass exakt positioniert werden muss.
 */
function snapAxis(pos: number, half: number, candidates: SnapKandidat[]): { value: number; snapped: boolean; reiheId?: string } {
  let best = pos;
  let bestAbs = SNAP_ABSTAND;
  let snapped = false;
  let reiheId: string | undefined;
  for (const c of candidates) {
    for (const offset of [-half, 0, half]) {
      const delta = c.value - (pos + offset);
      if (Math.abs(delta) < bestAbs) {
        bestAbs = Math.abs(delta);
        best = pos + delta;
        snapped = true;
        reiheId = c.reiheId;
      }
    }
  }
  return { value: best, snapped, reiheId };
}

/** Kandidaten-Kanten/Mitten (x und z) benachbarter Regal-Placements zum Andocken. */
function snapKandidaten(nachbarn: EditorRegalPlacement[]): { x: SnapKandidat[]; z: SnapKandidat[] } {
  const x: SnapKandidat[] = [];
  const z: SnapKandidat[] = [];
  for (const n of nachbarn) {
    const { w, d } = gedrehteAusdehnung(n);
    x.push(
      { value: n.position[0] - w / 2, reiheId: n.reiheId },
      { value: n.position[0], reiheId: n.reiheId },
      { value: n.position[0] + w / 2, reiheId: n.reiheId },
    );
    z.push(
      { value: n.position[2] - d / 2, reiheId: n.reiheId },
      { value: n.position[2], reiheId: n.reiheId },
      { value: n.position[2] + d / 2, reiheId: n.reiheId },
    );
  }
  return { x, z };
}

const WALL_DICKE = 0.2;
/** Etwas heller als das Haupt-`FLOOR` (`../colors`) — im kleinen Vorschau-Canvas sonst kaum vom Void-Hintergrund zu unterscheiden. */
const PREVIEW_FLOOR = '#484848';

function Grundflaeche({ points }: { points: Punkt[] }) {
  const geo = useMemo(() => {
    if (points.length < 3) return null;
    const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.z)));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [points]);
  useEffect(() => () => geo?.dispose(), [geo]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color={PREVIEW_FLOOR} roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

function Waende({ points, hoehe }: { points: Punkt[]; hoehe: number }) {
  const segs = useMemo(() => wallSegments(points, hoehe), [points, hoehe]);
  return (
    <>
      {segs.map((s, i) => (
        <mesh key={i} position={s.position} rotation-y={s.rotationY} receiveShadow castShadow>
          <boxGeometry args={[s.length, hoehe, WALL_DICKE]} />
          <meshStandardMaterial color="#333840" roughness={0.6} metalness={0.1} />
        </mesh>
      ))}
    </>
  );
}

/**
 * Bodenmarkierung der konfigurierten (lichten) Gangbreite — zwei Linien an der Mittellinie
 * ± `breite/2` plus Maßangabe, unabhängig vom aktuellen `versatz` der Regale/Reihen. Bleibt beim
 * manuellen Ziehen fix stehen, damit man erkennt, wie weit man von der Ziel-Breite abweicht.
 */
function GangGuideOverlay({ guide }: { guide: GangGuide }) {
  const laenge = guide.xBis - guide.xVon;
  if (laenge <= 0 || guide.breiteIst <= 0) return null;
  const mitteX = (guide.xVon + guide.xBis) / 2;
  const zVon = guide.z - guide.breiteIst / 2;
  const zBis = guide.z + guide.breiteIst / 2;
  const weichtAb = Math.abs(guide.breiteIst - guide.breiteSoll) > 0.02;
  return (
    <group>
      <mesh position={[mitteX, 0.008, guide.z]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[laenge, guide.breiteIst]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.05} depthWrite={false} />
      </mesh>
      <mesh position={[mitteX, 0.012, zVon]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[laenge, 0.04]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh position={[mitteX, 0.012, zBis]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[laenge, 0.04]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <Text
        position={[mitteX, 0.02, guide.z]}
        rotation-x={-Math.PI / 2}
        fontSize={0.3}
        color={ACCENT}
        outlineWidth={0.02}
        outlineColor="#0a0c10"
        anchorX="center"
        anchorY="middle"
      >
        {weichtAb
          ? `Gang ${guide.gangNummer} · ${fmtM(guide.breiteIst)} m (Soll ${fmtM(guide.breiteSoll)} m)`
          : `Gang ${guide.gangNummer} · ${fmtM(guide.breiteIst)} m`}
      </Text>
    </group>
  );
}

/**
 * Ebenen als einzelne, sichtbar getrennte Quader statt eines Quaders mit dünnen Trennlinien
 * im Inneren — letztere verschwinden komplett innerhalb des opaken Außenquaders und sind
 * nie sichtbar.
 */
function RegalMesh({
  size,
  ebenen,
  ebenenHoehen,
  color,
}: {
  size: { w: number; h: number; d: number };
  ebenen: number;
  ebenenHoehen: number[];
  color: string;
}) {
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(size.w, size.h, size.d)), [size.w, size.h, size.d]);
  useEffect(() => () => edgeGeo.dispose(), [edgeGeo]);
  const levels = useMemo(() => {
    let y = 0;
    return Array.from({ length: Math.max(1, ebenen) }, (_, i) => {
      const h = ebenenHoehen[i] ?? size.h / Math.max(1, ebenen);
      const cy = y + h / 2;
      y += h;
      return { cy, h };
    });
  }, [ebenen, ebenenHoehen, size.h]);
  return (
    <>
      {levels.map((lvl, i) => (
        <mesh key={i} position={[0, lvl.cy, 0]} castShadow receiveShadow>
          <boxGeometry args={[size.w * 0.98, lvl.h * 0.8, size.d * 0.98]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      ))}
      <lineSegments geometry={edgeGeo} position={[0, size.h / 2, 0]}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.45} />
      </lineSegments>
    </>
  );
}

/** Nummern-Label über einem Regal (z. B. „1L·2" = Gang 1, links, 2. Regal) — zur Unterscheidung beim Ziehen in der 3D-Vorschau. */
function RegalLabel({ size, label }: { size: { h: number }; label: string }) {
  return (
    <Text position={[0, size.h + 0.25, 0]} fontSize={0.26} color={ACCENT} anchorX="center" anchorY="bottom">
      {label}
    </Text>
  );
}

function RegalBox({
  placement,
  label,
  bisherigerVersatz,
  alle,
  wand,
  onMove,
  setOrbitEnabled,
}: {
  placement: EditorRegalPlacement;
  label: string;
  /** Bereits gespeicherter Versatz dieses Regals (in `placement.position` schon enthalten) — nötig, um beim Loslassen den neuen Gesamt-Versatz relativ zur Auto-Position zu berechnen. */
  bisherigerVersatz: Punkt;
  /** Alle Regal-Placements des Lagers — Kandidaten fürs Andocken beim Ziehen (s. `snapKandidaten`). */
  alle: EditorRegalPlacement[];
  /** Wand-Andock-Kandidaten des Grundrisses, s. `wandKandidaten()` in scene/editorLayout.ts. */
  wand: { x: number[]; z: number[] };
  onMove: (regalId: string, versatz: Punkt) => void;
  setOrbitEnabled: (enabled: boolean) => void;
}) {
  const { rotationY, spiegelX, spiegelZ } = placement;
  const { position, size, ebenen, ebenenHoehen } = placement;
  const basePosition = { x: position[0] - bisherigerVersatz.x, z: position[2] - bisherigerVersatz.z };
  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const dragOffset = useRef<{ x: number; z: number } | null>(null);
  const snappedAchsen = useRef({ x: false, z: false });
  const [dragging, setDragging] = useState(false);
  const kandidaten = useMemo(() => {
    const nachbarn = snapKandidaten(alle.filter((p) => p.regalId !== placement.regalId));
    const wandK = wandAlsKandidaten(wand);
    return { x: [...nachbarn.x, ...wandK.x], z: [...nachbarn.z, ...wandK.z] };
  }, [alle, placement.regalId, wand]);
  const { w: eigeneBreite, d: eigeneTiefe } = gedrehteAusdehnung(placement);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(GROUND_PLANE, hit)) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragOffset.current = { x: position[0] - hit.x, z: position[2] - hit.z };
    setOrbitEnabled(false);
    setDragging(true);
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragOffset.current || !groupRef.current) return;
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(GROUND_PLANE, hit)) return;
    const x = snapAxis(hit.x + dragOffset.current.x, eigeneBreite / 2, kandidaten.x);
    const z = snapAxis(hit.z + dragOffset.current.z, eigeneTiefe / 2, kandidaten.z);
    snappedAchsen.current = { x: x.snapped, z: z.snapped };
    groupRef.current.position.set(x.value, 0, z.value);
  };
  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragOffset.current || !groupRef.current) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    dragOffset.current = null;
    setOrbitEnabled(true);
    setDragging(false);
    const versatz = {
      x: snappedAchsen.current.x
        ? groupRef.current.position.x - basePosition.x
        : snap5cm(groupRef.current.position.x - basePosition.x),
      z: snappedAchsen.current.z
        ? groupRef.current.position.z - basePosition.z
        : snap5cm(groupRef.current.position.z - basePosition.z),
    };
    // react-three-fiber wendet den `position`-Prop nur bei einer Werte-Änderung erneut an (Diff
    // gegen den zuletzt gesetzten Prop, nicht gegen den echten Objekt-Zustand) — ohne diesen
    // direkten Reset bliebe die per Ref gesetzte Zieh-Position "kleben", falls der neue Prop-Wert
    // zufällig mit dem alten übereinstimmt, und würde beim nächsten Zug zusätzlich aufaddiert.
    groupRef.current.position.set(position[0], 0, position[2]);
    onMove(placement.regalId, versatz);
  };

  return (
    <group
      ref={groupRef}
      position={[position[0], 0, position[2]]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerOver={() => (gl.domElement.style.cursor = 'grab')}
      onPointerOut={() => (gl.domElement.style.cursor = 'auto')}
    >
      <group rotation-y={rotationY} scale={[spiegelX ? -1 : 1, 1, spiegelZ ? -1 : 1]}>
        <RegalMesh size={size} ebenen={ebenen} ebenenHoehen={ebenenHoehen} color={dragging ? ACCENT : RACK_GREY} />
      </group>
      <RegalLabel size={size} label={label} />
    </group>
  );
}

/**
 * Bewegt alle Regale einer Reihe gemeinsam als starre Gruppe — Gegenstück zu `RegalBox` im
 * Modus „Reihe verschieben": einzelne Regale sind dabei nicht separat ziehbar, nur die ganze
 * Reihe, damit die Anordnung untereinander nicht durcheinanderkommt.
 */
function ReiheGroup({
  reiheId,
  placements,
  labelById,
  bisherigerVersatz,
  alle,
  wand,
  onMove,
  setOrbitEnabled,
}: {
  reiheId: string;
  placements: EditorRegalPlacement[];
  labelById: Map<string, string>;
  /** Bereits gespeicherter Versatz dieser Reihe (in `placement.position` der Regale schon enthalten). */
  bisherigerVersatz: Punkt;
  /** Alle Regal-Placements des Lagers — Kandidaten fürs Andocken beim Ziehen (s. `snapKandidaten`). */
  alle: EditorRegalPlacement[];
  /** Wand-Andock-Kandidaten des Grundrisses, s. `wandKandidaten()` in scene/editorLayout.ts. */
  wand: { x: number[]; z: number[] };
  /**
   * `anker`: beim Loslassen gesetzt, wenn die Reihe auf der Z-Achse an einer fremden Reihe
   * eingerastet ist (s. `EditorRegalreihe.anker` in shared/editor.ts) — `null`, wenn nicht (löscht
   * einen zuvor gesetzten Anker, die Reihe verhält sich dann wieder wie ein fixer Versatz).
   */
  onMove: (reiheId: string, versatz: Punkt, anker: { reiheId: string; offset: number } | null) => void;
  setOrbitEnabled: (enabled: boolean) => void;
}) {
  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const dragOffset = useRef<{ x: number; z: number } | null>(null);
  const snappedAchsen = useRef({ x: false, z: false });
  const snapZielReiheZ = useRef<string | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const kandidaten = useMemo(() => {
    const nachbarn = snapKandidaten(alle.filter((p) => p.reiheId !== reiheId));
    const wandK = wandAlsKandidaten(wand);
    return { x: [...nachbarn.x, ...wandK.x], z: [...nachbarn.z, ...wandK.z] };
  }, [alle, reiheId, wand]);
  /** Umschließendes Rechteck der eigenen Reihe (Weltkoordinaten, vor dem Ziehen) — Grundlage fürs Andocken der ganzen Reihe. */
  const bbox = useMemo(() => {
    let left = Infinity;
    let right = -Infinity;
    let front = Infinity;
    let back = -Infinity;
    for (const p of placements) {
      const { w, d } = gedrehteAusdehnung(p);
      left = Math.min(left, p.position[0] - w / 2);
      right = Math.max(right, p.position[0] + w / 2);
      front = Math.min(front, p.position[2] - d / 2);
      back = Math.max(back, p.position[2] + d / 2);
    }
    return { w: right - left, d: back - front, lokalX: (left + right) / 2 - bisherigerVersatz.x, lokalZ: (front + back) / 2 - bisherigerVersatz.z };
  }, [placements, bisherigerVersatz.x, bisherigerVersatz.z]);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(GROUND_PLANE, hit)) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragOffset.current = { x: bisherigerVersatz.x - hit.x, z: bisherigerVersatz.z - hit.z };
    setOrbitEnabled(false);
    setDragging(true);
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragOffset.current || !groupRef.current) return;
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(GROUND_PLANE, hit)) return;
    const rawX = hit.x + dragOffset.current.x;
    const rawZ = hit.z + dragOffset.current.z;
    const x = snapAxis(rawX + bbox.lokalX, bbox.w / 2, kandidaten.x);
    const z = snapAxis(rawZ + bbox.lokalZ, bbox.d / 2, kandidaten.z);
    snappedAchsen.current = { x: x.snapped, z: z.snapped };
    snapZielReiheZ.current = z.reiheId;
    groupRef.current.position.set(x.value - bbox.lokalX, 0, z.value - bbox.lokalZ);
  };
  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragOffset.current || !groupRef.current) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    dragOffset.current = null;
    setOrbitEnabled(true);
    setDragging(false);
    const versatz = {
      x: snappedAchsen.current.x ? groupRef.current.position.x : snap5cm(groupRef.current.position.x),
      z: snappedAchsen.current.z ? groupRef.current.position.z : snap5cm(groupRef.current.position.z),
    };
    /**
     * Beim Andocken auf der Z-Achse an einer fremden Reihe wird — statt eines fixen Versatzes —
     * ein Anker gesetzt: `offset` ist der Z-Abstand der beiden Reihen JETZT, wird aber bei jeder
     * Neuberechnung neu auf die dann aktuelle Position der Ziel-Reihe angewendet (s.
     * `resolveAnkerVersatzZ()` in scene/editorLayout.ts) — bleibt die Reihe so z. B. beim Ändern
     * der eigenen oder fremden Gangbreite weiterhin angedockt, statt auseinanderzudriften.
     */
    let anker: { reiheId: string; offset: number } | null = null;
    const zielReiheId = snapZielReiheZ.current;
    const meinAltesRegal = placements[0];
    if (snappedAchsen.current.z && zielReiheId && meinAltesRegal) {
      const zielPlacement = alle.find((p) => p.reiheId === zielReiheId);
      if (zielPlacement) {
        const meinNeuesZ = meinAltesRegal.position[2] + (versatz.z - bisherigerVersatz.z);
        anker = { reiheId: zielReiheId, offset: meinNeuesZ - zielPlacement.position[2] };
      }
    }
    // s. Kommentar in RegalBox.endDrag: ohne diesen direkten Reset bliebe die Zieh-Position am
    // Objekt kleben, falls der neue `bisherigerVersatz`-Prop zufällig dem alten Wert entspricht.
    groupRef.current.position.set(bisherigerVersatz.x, 0, bisherigerVersatz.z);
    onMove(reiheId, versatz, anker);
  };

  return (
    <group
      ref={groupRef}
      position={[bisherigerVersatz.x, 0, bisherigerVersatz.z]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerOver={() => (gl.domElement.style.cursor = 'grab')}
      onPointerOut={() => (gl.domElement.style.cursor = 'auto')}
    >
      {placements.map((p) => (
        <group key={p.regalId} position={[p.position[0] - bisherigerVersatz.x, 0, p.position[2] - bisherigerVersatz.z]}>
          <group rotation-y={p.rotationY} scale={[p.spiegelX ? -1 : 1, 1, p.spiegelZ ? -1 : 1]}>
            <RegalMesh size={p.size} ebenen={p.ebenen} ebenenHoehen={p.ebenenHoehen} color={dragging ? ACCENT : RACK_GREY} />
          </group>
          <RegalLabel size={p.size} label={labelById.get(p.regalId) ?? ''} />
        </group>
      ))}
    </group>
  );
}

/**
 * Bewegt einen kompletten Gang (beide Regalreihen "links" und "rechts" gemeinsam inkl. deren
 * Abstand) als starre Gruppe — Gegenstück zu `ReiheGroup`, aber für den ganzen Gang statt nur
 * eine Seite. Anders als bei Regal/Reihe gibt es keinen einzelnen gespeicherten `versatz` für
 * den ganzen Gang (jede Reihe hat ihren eigenen) — `onMove` liefert deshalb nur das Zieh-Delta,
 * das der Aufrufer additiv auf den bestehenden `versatz` jeder Reihe anwendet. So bleibt eine
 * zuvor einzeln verschobene Reihe relativ zur anderen an ihrem Platz.
 */
function GangGroup({
  gangId,
  placements,
  labelById,
  alle,
  wand,
  onMove,
  setOrbitEnabled,
}: {
  gangId: string;
  placements: EditorRegalPlacement[];
  labelById: Map<string, string>;
  /** Alle Regal-Placements des Lagers — Kandidaten fürs Andocken beim Ziehen (s. `snapKandidaten`). */
  alle: EditorRegalPlacement[];
  /** Wand-Andock-Kandidaten des Grundrisses, s. `wandKandidaten()` in scene/editorLayout.ts. */
  wand: { x: number[]; z: number[] };
  onMove: (gangId: string, delta: Punkt) => void;
  setOrbitEnabled: (enabled: boolean) => void;
}) {
  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const dragOffset = useRef<{ x: number; z: number } | null>(null);
  const snappedAchsen = useRef({ x: false, z: false });
  const [dragging, setDragging] = useState(false);
  const kandidaten = useMemo(() => {
    const nachbarn = snapKandidaten(alle.filter((p) => p.gangId !== gangId));
    const wandK = wandAlsKandidaten(wand);
    return { x: [...nachbarn.x, ...wandK.x], z: [...nachbarn.z, ...wandK.z] };
  }, [alle, gangId, wand]);
  /** Umschließendes Rechteck des ganzen Gangs (beide Reihen, Weltkoordinaten vor dem Ziehen) — Grundlage fürs Andocken. */
  const bbox = useMemo(() => {
    let left = Infinity;
    let right = -Infinity;
    let front = Infinity;
    let back = -Infinity;
    for (const p of placements) {
      const { w, d } = gedrehteAusdehnung(p);
      left = Math.min(left, p.position[0] - w / 2);
      right = Math.max(right, p.position[0] + w / 2);
      front = Math.min(front, p.position[2] - d / 2);
      back = Math.max(back, p.position[2] + d / 2);
    }
    return { w: right - left, d: back - front, lokalX: (left + right) / 2, lokalZ: (front + back) / 2 };
  }, [placements]);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(GROUND_PLANE, hit)) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragOffset.current = { x: -hit.x, z: -hit.z };
    setOrbitEnabled(false);
    setDragging(true);
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragOffset.current || !groupRef.current) return;
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(GROUND_PLANE, hit)) return;
    const rawX = hit.x + dragOffset.current.x;
    const rawZ = hit.z + dragOffset.current.z;
    const x = snapAxis(rawX + bbox.lokalX, bbox.w / 2, kandidaten.x);
    const z = snapAxis(rawZ + bbox.lokalZ, bbox.d / 2, kandidaten.z);
    snappedAchsen.current = { x: x.snapped, z: z.snapped };
    groupRef.current.position.set(x.value - bbox.lokalX, 0, z.value - bbox.lokalZ);
  };
  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragOffset.current || !groupRef.current) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    dragOffset.current = null;
    setOrbitEnabled(true);
    setDragging(false);
    const delta = {
      x: snappedAchsen.current.x ? groupRef.current.position.x : snap5cm(groupRef.current.position.x),
      z: snappedAchsen.current.z ? groupRef.current.position.z : snap5cm(groupRef.current.position.z),
    };
    // Der `position`-Prop dieser Gruppe ist konstant `[0,0,0]` (s. u.) — react-three-fiber wendet
    // ihn deshalb NIE erneut an (Diff gegen den zuletzt gesetzten Prop-Wert erkennt keine
    // Änderung), obwohl die per Ref gesetzte Zieh-Position hier real vom Objekt abweicht. Ohne
    // diesen direkten Reset bliebe das Delta dauerhaft am Objekt kleben und würde sich mit jedem
    // weiteren Zug zusätzlich zum bereits im `versatz` gespeicherten Delta aufaddieren.
    groupRef.current.position.set(0, 0, 0);
    onMove(gangId, delta);
  };

  return (
    <group
      ref={groupRef}
      position={[0, 0, 0]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerOver={() => (gl.domElement.style.cursor = 'grab')}
      onPointerOut={() => (gl.domElement.style.cursor = 'auto')}
    >
      {placements.map((p) => (
        <group key={p.regalId} position={[p.position[0], 0, p.position[2]]}>
          <group rotation-y={p.rotationY} scale={[p.spiegelX ? -1 : 1, 1, p.spiegelZ ? -1 : 1]}>
            <RegalMesh size={p.size} ebenen={p.ebenen} ebenenHoehen={p.ebenenHoehen} color={dragging ? ACCENT : RACK_GREY} />
          </group>
          <RegalLabel size={p.size} label={labelById.get(p.regalId) ?? ''} />
        </group>
      ))}
    </group>
  );
}

/** Eigenständige, live aktualisierende 3D-Vorschau des im Wizard bearbeiteten Lagers. */
export default function EditorPreview3D({
  grundriss,
  gaenge,
  mode,
  onRegalMove,
  onReiheMove,
  onGangMove,
}: {
  grundriss: Punkt[];
  gaenge: EditorGang[];
  /** „regal": jedes Regal einzeln ziehbar (wie bisher). „reihe": ganze Regalreihen als starre Gruppe ziehbar. „gang": beide Reihen eines Gangs gemeinsam ziehbar. */
  mode: PreviewMode;
  onRegalMove: (regalId: string, versatz: Punkt) => void;
  onReiheMove: (reiheId: string, versatz: Punkt, anker: { reiheId: string; offset: number } | null) => void;
  onGangMove: (gangId: string, delta: Punkt) => void;
}) {
  const placements = useMemo(() => layoutEditorGaenge(gaenge, grundriss), [gaenge, grundriss]);
  const guides = useMemo(() => gangGuides(gaenge, placements), [gaenge, placements]);
  const wand = useMemo(() => wandKandidaten(grundriss, WALL_DICKE), [grundriss]);
  const versatzById = useMemo(() => {
    const m = new Map<string, Punkt>();
    for (const gang of gaenge) for (const reihe of gang.reihen) for (const regal of reihe.regale) m.set(regal.id, regal.versatz ?? { x: 0, z: 0 });
    return m;
  }, [gaenge]);
  const reiheVersatzById = useMemo(() => {
    const m = new Map<string, Punkt>();
    for (const gang of gaenge) for (const reihe of gang.reihen) m.set(reihe.id, reihe.versatz ?? { x: 0, z: 0 });
    return m;
  }, [gaenge]);
  /**
   * „1L·2 (Dim3 5–8)" = Gang 1, Reihe links, 2. Regal, Sage-Spaltenbereich 5–8 — zur
   * Unterscheidung in der 3D-Vorschau (analog zur Nummerierung in der Regal-Liste) und um beim
   * Einrichten zu erkennen, welches Ende welchem Sage-Lagerplatz (Gang;Ebene;Dim3) entspricht.
   */
  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const gang of gaenge) {
      const dim3ById = new Map(regalDim3Bereiche(gang).map((b) => [b.regalId, b]));
      for (const reihe of gang.reihen) {
        reihe.regale.forEach((regal, i) => {
          const bereich = dim3ById.get(regal.id);
          const dim3 = bereich ? (bereich.von === bereich.bis ? ` (Dim3 ${bereich.von})` : ` (Dim3 ${bereich.von}–${bereich.bis})`) : '';
          m.set(regal.id, `${gang.nummer}${reihe.seite === 'links' ? 'L' : 'R'}·${i + 1}${dim3}`);
        });
      }
    }
    return m;
  }, [gaenge]);
  const placementsByReihe = useMemo(() => {
    const m = new Map<string, EditorRegalPlacement[]>();
    for (const p of placements) {
      const list = m.get(p.reiheId);
      if (list) list.push(p);
      else m.set(p.reiheId, [p]);
    }
    return m;
  }, [placements]);
  const placementsByGang = useMemo(() => {
    const m = new Map<string, EditorRegalPlacement[]>();
    for (const p of placements) {
      const list = m.get(p.gangId);
      if (list) list.push(p);
      else m.set(p.gangId, [p]);
    }
    return m;
  }, [placements]);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const setOrbitEnabled = (enabled: boolean) => {
    if (controlsRef.current) controlsRef.current.enabled = enabled;
  };
  const center = useMemo(() => polygonCenter(grundriss), [grundriss]);
  const wandHoehe = useMemo(() => {
    const maxRegalHoehe = placements.reduce((m, p) => Math.max(m, p.size.h), 0);
    return Math.min(8, Math.max(3, maxRegalHoehe + 1));
  }, [placements]);
  const kameraAbstand = useMemo(() => {
    if (grundriss.length === 0) return 20;
    const xs = grundriss.map((p) => p.x);
    const zs = grundriss.map((p) => p.z);
    return Math.max(10, Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) * 0.75;
  }, [grundriss]);

  return (
    <div className="h-72 w-full overflow-hidden rounded-md border border-line bg-void">
      <Canvas
        shadows
        camera={{ position: [center.x + kameraAbstand, kameraAbstand * 0.75, center.z + kameraAbstand], fov: 50, near: 0.1, far: 500 }}
      >
        <color attach="background" args={[VOID]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[center.x + 20, 30, center.z + 15]} intensity={1.1} color="#dfe8f2" castShadow />
        <hemisphereLight args={['#5a6572', '#0d0f13', 0.7]} />
        <Grundflaeche points={grundriss} />
        <Waende points={grundriss} hoehe={wandHoehe} />
        {guides.map((guide) => (
          <GangGuideOverlay key={guide.gangId} guide={guide} />
        ))}
        {mode === 'regal'
          ? placements.map((p) => (
              <RegalBox
                key={p.regalId}
                placement={p}
                label={labelById.get(p.regalId) ?? ''}
                bisherigerVersatz={versatzById.get(p.regalId) ?? { x: 0, z: 0 }}
                alle={placements}
                wand={wand}
                onMove={onRegalMove}
                setOrbitEnabled={setOrbitEnabled}
              />
            ))
          : mode === 'reihe'
            ? [...placementsByReihe.entries()].map(([reiheId, reihenPlacements]) => (
                <ReiheGroup
                  key={reiheId}
                  reiheId={reiheId}
                  placements={reihenPlacements}
                  labelById={labelById}
                  bisherigerVersatz={reiheVersatzById.get(reiheId) ?? { x: 0, z: 0 }}
                  alle={placements}
                  wand={wand}
                  onMove={onReiheMove}
                  setOrbitEnabled={setOrbitEnabled}
                />
              ))
            : [...placementsByGang.entries()].map(([gangId, gangPlacements]) => (
                <GangGroup
                  key={gangId}
                  gangId={gangId}
                  placements={gangPlacements}
                  labelById={labelById}
                  alle={placements}
                  wand={wand}
                  onMove={onGangMove}
                  setOrbitEnabled={setOrbitEnabled}
                />
              ))}
        <OrbitControls ref={controlsRef} target={[center.x, 1, center.z]} makeDefault />
      </Canvas>
    </div>
  );
}
