import { useEffect, useMemo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { EditorLagerOverlay, EditorZelleOverlay } from '../editorOverlay';
import { editorGangNummer, editorReiheSeite, editorRegalIndex } from '../editorOverlay';
import { polygonCenter, wallSegments } from './editorLayout';
import { FLOOR, RACK_GREY, WALL_COLOR, WALL_GLASS_COLOR, stockColor } from '../colors';
import { HOVER_COLOR } from './Cell';
import { BASE_H } from './layout';
import { levelFloorY, mergeBoxes, rackParts, wallSegmentBoxes, wallSegmentGlassBoxes } from './boxes';
import { setEditorSelection, useEditorSelection, useStockAnzeigeConfig } from '../store';

const WALL_HOEHE = 3;

function Grundflaeche({ points, offset }: { points: EditorLagerOverlay['grundriss']; offset: { x: number; z: number } }) {
  const geo = useMemo(() => {
    if (points.length < 3) return null;
    const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.z)));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [points]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} position={[offset.x, 0.01, offset.z]} receiveShadow>
      <meshStandardMaterial color={FLOOR} roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

/**
 * Wandsegment im gleichen Stil wie die Sage-Lagerhalle (`Walls.tsx`): Brüstung + Dachbalken +
 * Pfeiler im Raster mit Fensterverglasung dazwischen, statt einer schlichten Box — s. CLAUDE.md
 * „Läger aus dem Lager-Editor sollen die gleichen Wände enthalten wie Sage-Läger".
 */
function WandSegment({ length, position, rotationY }: { length: number; position: [number, number, number]; rotationY: number }) {
  const solidGeo = useMemo(() => mergeBoxes(wallSegmentBoxes(length, WALL_HOEHE)), [length]);
  const glassGeo = useMemo(() => mergeBoxes(wallSegmentGlassBoxes(length, WALL_HOEHE)), [length]);
  useEffect(
    () => () => {
      solidGeo?.dispose();
      glassGeo?.dispose();
    },
    [solidGeo, glassGeo],
  );
  if (!solidGeo) return null;
  return (
    <group position={[position[0], 0, position[2]]} rotation-y={rotationY}>
      <mesh geometry={solidGeo} receiveShadow castShadow>
        <meshStandardMaterial color={WALL_COLOR} roughness={0.6} metalness={0.1} />
      </mesh>
      {glassGeo && (
        <mesh geometry={glassGeo}>
          <meshStandardMaterial color={WALL_GLASS_COLOR} roughness={0.15} metalness={0.1} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function Waende({ points, offset }: { points: EditorLagerOverlay['grundriss']; offset: { x: number; z: number } }) {
  const segs = useMemo(() => wallSegments(points, WALL_HOEHE), [points]);
  return (
    <group position={[offset.x, 0, offset.z]}>
      {segs.map((s, i) => (
        <WandSegment key={i} length={s.length} position={s.position} rotationY={s.rotationY} />
      ))}
    </group>
  );
}

/**
 * Zeigt ein Regal wie die per Sage geladenen Regale in der Live-Ansicht: eine Box je Zelle
 * (Ebene×Spalte) statt eines einzelnen Quaders — sonst verschwinden die Ebenen unsichtbar
 * im Inneren eines einzigen opaken Quaders, und es ist kein Bestand pro Ebene erkennbar.
 * Zellen ohne echten Sage-Platz (`platz` fehlt) erscheinen leer/grau wie in der Haupt-Szene.
 */
function zelleKey(zelle: Pick<EditorZelleOverlay, 'ebene' | 'spalte'>): string {
  return `${zelle.ebene}:${zelle.spalte}`;
}

/** Kurzbezeichnung eines Regals für das Identifikations-Label ("Gang 2 · rechts · Regal 1"). */
function regalLabel(overlay: EditorLagerOverlay, regal: EditorLagerOverlay['regale'][number]): string {
  const { gangId, reiheId, regalId } = regal.placement;
  const gang = editorGangNummer(overlay, gangId) ?? '?';
  const seite = editorReiheSeite(overlay, reiheId) === 'rechts' ? 'rechts' : 'links';
  const index = editorRegalIndex(overlay, reiheId, regalId) ?? '?';
  const mitPlatz = regal.zellen.filter((z) => z.platz);
  const bezeichnungen = mitPlatz.map((z) => z.platz!.platzbezeichnung).sort();
  const platzInfo =
    bezeichnungen.length > 0
      ? bezeichnungen.length === 1
        ? bezeichnungen[0]
        : `${bezeichnungen[0]} … ${bezeichnungen[bezeichnungen.length - 1]}`
      : `Eb. 1–${regal.placement.ebenen} · ohne Sage-Abgleich`;
  return `Gang ${gang} · ${seite} · Regal ${index}\n${platzInfo}`;
}

function RegalOverlayBox({
  overlay,
  regal,
  offset,
  interactive,
}: {
  overlay: EditorLagerOverlay;
  regal: EditorLagerOverlay['regale'][number];
  offset: { x: number; z: number };
  interactive: boolean;
}) {
  const { gangId, reiheId, regalId, position, size, ebenen, ebenenHoehen, rotationY, spiegelX, spiegelZ } = regal.placement;
  const spalten = Math.max(1, ...regal.zellen.map((z) => z.spalte));
  const zellW = size.w / spalten;
  const ebenenN = Math.max(1, ebenen);
  const floorY = useMemo(() => levelFloorY(ebenenHoehen), [ebenenHoehen]);

  const parts = useMemo(() => rackParts(size, ebenenN, ebenenHoehen), [size.w, size.h, size.d, ebenenN, ebenenHoehen]);
  const darkGeo = useMemo(() => mergeBoxes(parts.dark), [parts]);
  const greyGeo = useMemo(() => mergeBoxes(parts.grey), [parts]);
  const topGeo = useMemo(() => mergeBoxes(parts.top), [parts]);
  useEffect(
    () => () => {
      darkGeo?.dispose();
      greyGeo?.dispose();
      topGeo?.dispose();
    },
    [darkGeo, greyGeo, topGeo],
  );

  const rackEdgeGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(size.w + 0.2, size.h + 0.2, size.d + 0.2)),
    [size.w, size.h, size.d],
  );
  useEffect(() => () => rackEdgeGeo.dispose(), [rackEdgeGeo]);

  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const editorSelection = useEditorSelection();
  const anzeige = useStockAnzeigeConfig();
  const selectedZelleKey =
    editorSelection && editorSelection.level === 'platz' && editorSelection.regalId === regalId && editorSelection.zelle
      ? zelleKey(editorSelection.zelle)
      : null;
  const regalAktiv = hoverKey !== null || selectedZelleKey !== null;

  return (
    <group position={[position[0] + offset.x, 0, position[2] + offset.z]} rotation-y={rotationY}>
      {/* Nur die physische Regalgeometrie spiegeln — Kanten-Hervorhebung und Label-Billboard bleiben unverzerrt/lesbar. */}
      <group scale={[spiegelX ? -1 : 1, 1, spiegelZ ? -1 : 1]}>
        <mesh geometry={darkGeo!} castShadow receiveShadow>
          <meshStandardMaterial color="#262c36" roughness={0.9} />
        </mesh>
        <mesh geometry={greyGeo!} castShadow receiveShadow>
          <meshStandardMaterial color={RACK_GREY} roughness={0.5} />
        </mesh>
        <mesh geometry={topGeo!} castShadow>
          <meshStandardMaterial color={RACK_GREY} roughness={0.5} transparent opacity={0.45} depthWrite={false} />
        </mesh>

        {regal.zellen.map((zelle) => {
          const gesamt = zelle.platz?.bestaende.reduce((s, b) => s + b.bestand, 0) ?? 0;
          const key = zelleKey(zelle);
          const aktiv = key === hoverKey || key === selectedZelleKey;
          const color = aktiv ? HOVER_COLOR : stockColor(gesamt, zelle.platz !== undefined, anzeige, zelle.platz?.bestaende[0]?.einheit);
          const ebeneH = ebenenHoehen[zelle.ebene - 1] ?? ebenenHoehen[0] ?? 0.5;
          const cy = (floorY[zelle.ebene - 1] ?? BASE_H) + ebeneH / 2;
          return (
            <mesh
              key={key}
              position={[(zelle.spalte - 0.5) * zellW - size.w / 2, cy, 0]}
              castShadow
              receiveShadow
              userData={{ editorOverlayId: overlay.id, editorRegalId: regalId, editorZelleKey: key }}
              onClick={
                interactive
                  ? (e: ThreeEvent<MouseEvent>) => {
                      e.stopPropagation();
                      setEditorSelection({ overlay, level: 'platz', gangId, reiheId, regalId, zelle });
                    }
                  : undefined
              }
              onPointerOver={
                interactive
                  ? (e: ThreeEvent<PointerEvent>) => {
                      e.stopPropagation();
                      setHoverKey(key);
                    }
                  : undefined
              }
              onPointerOut={interactive ? () => setHoverKey((k) => (k === key ? null : k)) : undefined}
            >
              <boxGeometry args={[zellW * 0.92, ebeneH * 0.82, size.d * 0.94]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
          );
        })}
      </group>

      {regalAktiv && (
        <>
          <lineSegments geometry={rackEdgeGeo} position={[0, size.h / 2, 0]}>
            <lineBasicMaterial color="#ffffff" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
          </lineSegments>
          <Billboard position={[0, size.h + 0.5, 0]}>
            <Text
              fontSize={0.32}
              color="#ffffff"
              outlineWidth={0.04}
              outlineColor="#0a0c10"
              anchorX="center"
              anchorY="bottom"
              textAlign="center"
              lineHeight={1.3}
            >
              {regalLabel(overlay, regal)}
            </Text>
          </Billboard>
        </>
      )}
    </group>
  );
}

/**
 * Zeigt ein im Lager-Editor entworfenes Lager als eigenständiges Overlay im Haupt-Viewer, mit
 * echten Sage-Beständen eingefärbt (`buildEditorOverlay`) — an einer eigenen Position, damit es
 * sich nicht mit der automatischen Regal-Anordnung der Live-Ansicht überschneidet.
 */
export default function EditorLagerOverlayScene({
  overlay,
  offset,
  interactive = true,
}: {
  overlay: EditorLagerOverlay;
  offset: { x: number; z: number };
  interactive?: boolean;
}) {
  const center = useMemo(() => polygonCenter(overlay.grundriss), [overlay.grundriss]);
  return (
    <group>
      <Grundflaeche points={overlay.grundriss} offset={offset} />
      <Waende points={overlay.grundriss} offset={offset} />
      {overlay.regale.map((r) => (
        <RegalOverlayBox key={r.placement.regalId} overlay={overlay} regal={r} offset={offset} interactive={interactive} />
      ))}
      <Text
        position={[center.x + offset.x, WALL_HOEHE + 0.6, center.z + offset.z]}
        fontSize={0.6}
        color="#45d8c8"
        anchorX="center"
        anchorY="bottom"
      >
        {overlay.name} · {overlay.lagerkennung}
      </Text>
    </group>
  );
}
