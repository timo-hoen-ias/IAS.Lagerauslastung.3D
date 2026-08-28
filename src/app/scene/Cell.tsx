import { useMemo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Lagerbestand, Lagerort, Lagerplatz } from '../../shared/types';
import { stockColor } from '../colors';
import { useSelection } from '../store';
import { cellLocalPosition, cellSize, type RackKind } from './layout';

export type KistenAnteil = { artikel: string; matchcode: string; bestand: number; anteil: number };

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
  }));
  if (anteile.length <= maxKisten) return anteile;
  const top = anteile.slice(0, maxKisten - 1);
  const rest = anteile.slice(maxKisten - 1);
  const restSumme = rest.reduce((s, a) => s + a.anteil, 0);
  return [...top, { artikel: '…', matchcode: '', bestand: rest.reduce((s, a) => s + a.bestand, 0), anteil: restSumme }];
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

/** Label auf einer x-Seite der Schachtel (Richtung Gang), ggf. um 90° gedreht. */
function BoxLabel({
  label,
  faceW,
  faceH,
  x,
  side,
}: {
  label: string;
  faceW: number;
  faceH: number;
  x: number;
  side: 1 | -1;
}) {
  const vertical = labelVertical(faceW, faceH);
  const lineW = Math.max(...label.split('\n').map((l) => l.length));
  const fontSize = labelFontSize(lineW, vertical ? faceH : faceW);
  return (
    <Text
      position={[x, 0, 0]}
      rotation-y={side * (Math.PI / 2)}
      rotation-z={vertical ? -Math.PI / 2 : 0}
      fontSize={fontSize}
      lineHeight={0.85}
      color="#ffffff"
      outlineWidth={fontSize * 0.15}
      outlineColor="#0a0c10"
      anchorX="center"
      anchorY="middle"
    >
      {label}
    </Text>
  );
}

export default function Cell({
  platz,
  rack,
  interactive,
  rackKey,
  ort,
}: {
  platz: Lagerplatz;
  rack: { cols: number; levels: number; depth: number; flat: boolean; cellH: number; kind: RackKind; gang: number };
  interactive: boolean;
  rackKey: string;
  ort: Lagerort;
}) {
  const { setSelection, selection } = useSelection();
  const [hovered, setHovered] = useState(false);
  const total = useMemo(() => platz.bestaende.reduce((s, b) => s + b.bestand, 0), [platz]);
  const leer = platz.bestaende.length === 0;
  const box = cellSize(platz);
  const anteile = useMemo(() => bestandAnteile(platz.bestaende), [platz]);
  const mehrfach = anteile.length > 1;

  const isSelectedPlatz = selection?.ort.lagerkennung === rackKey && selection?.platz?.platzId === platz.platzId;
  const active = (hovered && interactive) || isSelectedPlatz;

  const edgeGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(box.w + 0.12, box.h + 0.12, box.d + 0.12)),
    [box.w, box.h, box.d],
  );

  const handlers = interactive
    ? {
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setSelection({ ort, platz });
        },
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
        },
        onPointerOut: () => setHovered(false),
      }
    : {};

  // Basisposition der Zelle; Kisten-Segmente entlang x aufteilen.
  const [cx, cy, cz] = cellLocalPosition(platz, rack);

  return (
    <group position={[cx, cy, cz]} {...handlers}>
      {mehrfach ? (
        (() => {
          const GAP = 0.05;
          const gesamtW = box.w - GAP * (anteile.length - 1);
          let laufX = -box.w / 2;
          return anteile.map((a, i) => {
            const segW = Math.max(0.02, a.anteil * gesamtW);
            const segX = laufX + segW / 2;
            laufX += segW + GAP;
            const farbe = a.artikel === '…' ? '#8b95a3' : kistenFarbe(i);
            return (
              <>
                <mesh
                  key={a.artikel + i}
                  position={[segX, 0, 0]}
                  userData={{ rackKey, platzId: platz.platzId }}
                  castShadow
                >
                  <boxGeometry args={[segW, box.h, box.d]} />
                  <meshStandardMaterial
                    polygonOffset
                    polygonOffsetFactor={-1}
                    polygonOffsetUnits={-1}
                    color={hovered ? '#7ec8ff' : farbe}
                    emissive={hovered ? '#1e4d6e' : '#000000'}
                    emissiveIntensity={0.4}
                    roughness={0.6}
                    metalness={0.1}
                  />
                </mesh>
                <BoxLabel
                  label={boxLabel(a.artikel, a.matchcode, a.bestand)}
                  faceW={box.d}
                  faceH={box.h}
                  x={segX + segW / 2 + 0.02}
                  side={1}
                />
              </>
            );
          });
        })()
      ) : (
        <mesh userData={{ rackKey, platzId: platz.platzId }} castShadow>
          <boxGeometry args={[box.w, box.h, box.d]} />
          <meshStandardMaterial
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
            color={hovered ? '#7ec8ff' : stockColor(total, !leer)}
            emissive={hovered ? '#1e4d6e' : '#000000'}
            emissiveIntensity={0.4}
            roughness={0.6}
            metalness={0.1}
            transparent={leer}
            opacity={leer ? 0.3 : 1}
          />
        </mesh>
      )}
      {!leer && !mehrfach && platz.bestaende[0] && (
        <>
          <BoxLabel
            label={boxLabel(platz.bestaende[0].artikelnummer, platz.bestaende[0].matchcode || platz.bestaende[0].bezeichnung1, platz.bestaende[0].bestand)}
            faceW={box.d}
            faceH={box.h}
            x={box.w / 2 + 0.02}
            side={1}
          />
          <BoxLabel
            label={boxLabel(platz.bestaende[0].artikelnummer, platz.bestaende[0].matchcode || platz.bestaende[0].bezeichnung1, platz.bestaende[0].bestand)}
            faceW={box.d}
            faceH={box.h}
            x={-box.w / 2 - 0.02}
            side={-1}
          />
        </>
      )}
      {active && (
        <lineSegments geometry={edgeGeo}>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineSegments>
      )}
    </group>
  );
}
