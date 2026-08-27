import { Container, Fullscreen, Text, withOpacity } from '@react-three/uikit';
import type { ThreeEvent } from '@react-three/fiber';
import type { Lagerort, Lagerplatz } from '../../shared/types';
import { setDragActive, useSelection } from '../store';
import { usePanelPos } from './usePanelPos';

export default function Inspector() {
  const { selection, setSelection } = useSelection();
  const { pos, startDrag } = usePanelPos('inspector', () => ({ x: Math.max(16, window.innerWidth - 440), y: Math.max(16, window.innerHeight - 340) }), () => setDragActive(false));

  if (!selection) return null;

  return (
    <Fullscreen>
      <Container
        positionType="absolute"
        positionLeft={pos.x}
        positionTop={pos.y}
        width={420}
        backgroundColor={withOpacity('#11151c', 0.72)}
        padding={16}
        borderRadius={6}
        borderTopWidth={1}
        borderLeftWidth={1}
        borderRightWidth={1}
        borderBottomWidth={1}
        borderColor={withOpacity('#ffffff', 0.35)}
        flexDirection="column"
        gap={10}
      >
        <Container
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          cursor="move"
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            setDragActive(true);
            startDrag(e.nativeEvent.clientX, e.nativeEvent.clientY);
          }}
        >
          <Text fontSize={22} fontWeight="bold" color="#ffffff">
            {selection.ort.lagerkennung}
          </Text>
          <Container cursor="pointer" onClick={() => setSelection(null)} padding={4}>
            <Text fontSize={16} color="#8b95a3">
              ✕
            </Text>
          </Container>
        </Container>
        <Text fontSize={12} color="#8b95a3">
          {selection.ort.bezeichnung} · Lagertechnik {selection.ort.lagertechnik}
        </Text>
        {selection.platz ? <PlatzPanel platz={selection.platz} /> : <OrtPanel ort={selection.ort} />}
      </Container>
    </Fullscreen>
  );
}

function PlatzPanel({ platz }: { platz: Lagerplatz }) {
  const total = platz.bestaende.reduce((s, b) => s + b.bestand, 0);
  return (
    <Container flexDirection="column" gap={8}>
      <Container flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text fontSize={15} fontWeight="bold" color="#7ec8ff">
          Platz {platz.kurz || `#${platz.platzId}`}
        </Text>
        <Text fontSize={14} color="#e6b93c">
          Σ {fmt(total)}
        </Text>
      </Container>
      {platz.bestaende.length === 0 ? (
        <Text fontSize={12} color="#5d6673">
          Keine Bestände auf diesem Platz
        </Text>
      ) : (
        platz.bestaende.map((b) => (
          <Container key={b.artikelnummer} flexDirection="row" justifyContent="space-between" alignItems="center" gap={8}>
            <Container flexDirection="column" flexGrow={1}>
              <Text fontSize={13} color="#e8ecf1">
                {b.artikelnummer}
              </Text>
              <Text fontSize={11} color="#8b95a3">
                {b.bezeichnung1}
              </Text>
            </Container>
            <Text fontSize={14} color={bestandColor(b.bestand)}>
              {fmt(b.bestand)}
            </Text>
          </Container>
        ))
      )}
    </Container>
  );
}

function OrtPanel({ ort }: { ort: Lagerort }) {
  const belegt = ort.plaetze.filter((p) => p.bestaende.length > 0);
  const gesamt = belegt.reduce((s, p) => s + p.bestaende.reduce((x, b) => x + b.bestand, 0), 0);
  return (
    <Container flexDirection="column" gap={8}>
      <Container flexDirection="row" justifyContent="space-between">
        <Text fontSize={12} color="#8b95a3">
          {ort.plaetze.length} Plätze · {belegt.length} belegt
        </Text>
        <Text fontSize={12} color="#e6b93c">
          Σ {fmt(gesamt)}
        </Text>
      </Container>
      <Container flexDirection="column" maxHeight={280} overflow="scroll" scrollbarWidth={4} scrollbarColor="#4a5563" gap={6}>
        {belegt
          .slice()
          .sort((a, b) => b.bestaende.reduce((s, x) => s + x.bestand, 0) - a.bestaende.reduce((s, x) => s + x.bestand, 0))
          .map((p) => {
            const total = p.bestaende.reduce((s, b) => s + b.bestand, 0);
            return (
              <Container key={p.platzId} flexDirection="column" gap={2} padding={6} backgroundColor="#1a212c" borderRadius={6}>
                <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                  <Text fontSize={12} fontWeight="bold" color="#7ec8ff">
                    {p.kurz || `#${p.platzId}`}
                  </Text>
                  <Text fontSize={12} color={bestandColor(total)}>
                    {fmt(total)}
                  </Text>
                </Container>
                {p.bestaende.map((b) => (
                  <Text key={b.artikelnummer} fontSize={11} color="#aab4c0">
                    {b.artikelnummer}:{fmt(b.bestand)} {b.bezeichnung1}
                  </Text>
                ))}
              </Container>
            );
          })}
      </Container>
    </Container>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('de-DE');
}

function bestandColor(bestand: number): string {
  if (bestand < 100) return '#2ecc71';
  if (bestand < 500) return '#e6b93c';
  return '#e74c3c';
}
