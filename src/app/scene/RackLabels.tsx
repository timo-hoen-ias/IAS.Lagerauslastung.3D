import { useMemo, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type { Lagerplatz } from '../../shared/types';
import { cellSegments } from './Cell';
import type { PlacedRack } from './transform';
import { useStockAnzeigeConfig } from '../store';

export const LABEL_HIDE = 18;

/**
 * Entscheidet mit Hysterese, ob ein Objekt in der Nähe der Kamera liegt (Distanz `d` zum Ziel).
 * Ist es bereits `near`, bleibt es bis `hideDist` sichtbar; ist es fern, wird es erst ab `showDist`
 * wieder gezeigt. Verhindert Flackern beim Pendeln um eine Grenze. Pure Funktion (testbar).
 */
export function lodNear(near: boolean, d: number, hideDist: number, showDist?: number): boolean {
  const show = showDist ?? hideDist - 8;
  if (near && d > hideDist) return false;
  if (!near && d < show) return true;
  return near;
}

/**
 * Mountet Kinder erst, wenn die Kamera nahe genug ist (Hysterese, Distanz-Messung pro Frame).
 *
 * Perf: Im Gegensatz zum bloßen Ausblenden (visible=false) werden entfernte Kinder GAR NICHT
 * gerendert bzw. gemountet. Troika-<Text> legt pro Instanz Geometrie + Glyph-Atlas (Canvas/Textur) an;
 * bei tausenden Zellen eines Perf-Lagers (x viele Regale) würde das sonst den JS-Heap füllen und
 * heftige GC-Drops auslösen. Hierdurch sind nur die wenigen Regale in Reichweite tatsächlich
 * instanziiert.
 */
export function LodGroup({
  origin,
  hideDist,
  showDist,
  children,
  active = true,
}: {
  origin: [number, number, number];
  hideDist: number;
  showDist?: number;
  children: ReactNode;
  active?: boolean;
}) {
  const [near, setNear] = useState(false);
  useFrame(({ camera }) => {
    const d = Math.hypot(
      camera.position.x - origin[0],
      camera.position.y - origin[1],
      camera.position.z - origin[2],
    );
    const v = active ? lodNear(near, d, hideDist, showDist) : true;
    if (v !== near) setNear(v);
  });
  return <>{near ? children : null}</>;
}

/** Artikel-Labels aller Zellen eines Regals, nur in der Nähe sichtbar. */
export default function RackLabels({ placed, plaetze }: { placed: PlacedRack; plaetze: Lagerplatz[] }) {
  const anzeige = useStockAnzeigeConfig();
  const { labels } = useMemo(() => cellSegments(plaetze, placed, anzeige), [plaetze, placed, anzeige]);
  return (
    <LodGroup origin={placed.position} hideDist={LABEL_HIDE}>
      {labels.map((l) => (
        <Text
          key={l.key}
          position={l.pos}
          rotation-y={l.side * (Math.PI / 2)}
          rotation-z={l.vertical ? -Math.PI / 2 : 0}
          fontSize={l.fontSize}
          lineHeight={0.85}
          color="#ffffff"
          outlineWidth={l.fontSize * 0.15}
          outlineColor="#0a0c10"
          anchorX="center"
          anchorY="middle"
        >
          {l.text}
        </Text>
      ))}
    </LodGroup>
  );
}
