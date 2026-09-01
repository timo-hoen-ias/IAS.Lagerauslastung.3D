import { useEffect, useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { EditorLagerOverlay } from '../editorOverlay';
import { polygonCenter, wallSegments } from './editorLayout';
import { FLOOR, stockColor } from '../colors';

const WALL_HOEHE = 3;
const WALL_DICKE = 0.15;

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

function Waende({ points, offset }: { points: EditorLagerOverlay['grundriss']; offset: { x: number; z: number } }) {
  const segs = useMemo(() => wallSegments(points, WALL_HOEHE), [points]);
  return (
    <group position={[offset.x, 0, offset.z]}>
      {segs.map((s, i) => (
        <mesh key={i} position={s.position} rotation-y={s.rotationY} receiveShadow castShadow>
          <boxGeometry args={[s.length, WALL_HOEHE, WALL_DICKE]} />
          <meshStandardMaterial color="#333840" roughness={0.6} metalness={0.1} />
        </mesh>
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
function RegalOverlayBox({ regal, offset }: { regal: EditorLagerOverlay['regale'][number]; offset: { x: number; z: number } }) {
  const { position, size, ebenen } = regal.placement;
  const spalten = Math.max(1, ...regal.zellen.map((z) => z.spalte));
  const zellW = size.w / spalten;
  const zellH = size.h / Math.max(1, ebenen);
  const originX = position[0] + offset.x - size.w / 2;
  const originZ = position[2] + offset.z;
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(size.w, size.h, size.d)), [size.w, size.h, size.d]);
  useEffect(() => () => edgeGeo.dispose(), [edgeGeo]);
  return (
    <group>
      {regal.zellen.map((zelle) => {
        const gesamt = zelle.platz?.bestaende.reduce((s, b) => s + b.bestand, 0) ?? 0;
        const color = stockColor(gesamt, zelle.platz !== undefined);
        return (
          <mesh
            key={`${zelle.ebene}:${zelle.spalte}`}
            position={[originX + (zelle.spalte - 0.5) * zellW, (zelle.ebene - 0.5) * zellH, originZ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[zellW * 0.92, zellH * 0.82, size.d * 0.94]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
        );
      })}
      <lineSegments geometry={edgeGeo} position={[position[0] + offset.x, size.h / 2, position[2] + offset.z]}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}

/**
 * Zeigt ein im Lager-Editor entworfenes Lager als eigenständiges Overlay im Haupt-Viewer, mit
 * echten Sage-Beständen eingefärbt (`buildEditorOverlay`) — an einer eigenen Position, damit es
 * sich nicht mit der automatischen Regal-Anordnung der Live-Ansicht überschneidet.
 */
export default function EditorLagerOverlayScene({ overlay, offset }: { overlay: EditorLagerOverlay; offset: { x: number; z: number } }) {
  const center = useMemo(() => polygonCenter(overlay.grundriss), [overlay.grundriss]);
  return (
    <group>
      <Grundflaeche points={overlay.grundriss} offset={offset} />
      <Waende points={overlay.grundriss} offset={offset} />
      {overlay.regale.map((r) => (
        <RegalOverlayBox key={r.placement.regalId} regal={r} offset={offset} />
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
