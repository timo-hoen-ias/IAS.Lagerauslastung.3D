import { describe, expect, it } from 'vitest';
import {
  computeViewBox,
  distanceToSegment,
  edgeLabels,
  gridLines,
  insertPointOnNearestEdge,
  polygonArea,
  snapPoint,
  snapToGrid,
  snapToNeighbors,
} from './grundriss';

describe('computeViewBox', () => {
  it('liefert einen festen Startausschnitt für ein leeres Polygon', () => {
    expect(computeViewBox([])).toEqual({ minX: -2, minZ: -2, w: 34, h: 24 });
  });

  it('passt sich an die Bounding-Box des Polygons an (mit Rand)', () => {
    const vb = computeViewBox([{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 20 }, { x: 0, z: 20 }]);
    expect(vb).toEqual({ minX: -3, minZ: -3, w: 36, h: 26 });
  });

  it('erzwingt eine Mindestgröße für ein entartetes (punktförmiges) Polygon', () => {
    const vb = computeViewBox([{ x: 5, z: 5 }]);
    expect(vb.w).toBe(4 + 6);
    expect(vb.h).toBe(4 + 6);
  });
});

describe('gridLines', () => {
  it('erzeugt vertikale und horizontale Linien im 5m-Raster über den Ausschnitt', () => {
    const lines = gridLines({ minX: -3, minZ: -3, w: 36, h: 26 }, 5);
    const vertikale = lines.filter((l) => l.x1 === l.x2);
    const horizontale = lines.filter((l) => l.y1 === l.y2);
    expect(vertikale.map((l) => l.x1)).toEqual([0, 5, 10, 15, 20, 25, 30]);
    expect(horizontale.map((l) => l.y1)).toEqual([0, 5, 10, 15, 20]);
  });
});

describe('polygonArea', () => {
  it('berechnet die Fläche eines Rechtecks', () => {
    expect(polygonArea([{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 20 }, { x: 0, z: 20 }])).toBe(600);
  });

  it('liefert 0 für weniger als drei Punkte', () => {
    expect(polygonArea([{ x: 0, z: 0 }, { x: 1, z: 1 }])).toBe(0);
  });

  it('ist unabhängig von der Umlaufrichtung (Betrag)', () => {
    const cw = [{ x: 0, z: 0 }, { x: 0, z: 10 }, { x: 10, z: 10 }, { x: 10, z: 0 }];
    const ccw = [...cw].reverse();
    expect(polygonArea(cw)).toBe(polygonArea(ccw));
  });
});

describe('distanceToSegment', () => {
  it('liefert 0 für einen Punkt auf der Strecke', () => {
    expect(distanceToSegment({ x: 5, z: 0 }, { x: 0, z: 0 }, { x: 10, z: 0 })).toBe(0);
  });

  it('liefert den Lotabstand für einen Punkt seitlich der Strecke', () => {
    expect(distanceToSegment({ x: 5, z: 3 }, { x: 0, z: 0 }, { x: 10, z: 0 })).toBe(3);
  });

  it('klemmt auf den nächsten Endpunkt, wenn das Lot außerhalb der Strecke fällt', () => {
    expect(distanceToSegment({ x: -4, z: 0 }, { x: 0, z: 0 }, { x: 10, z: 0 })).toBe(4);
  });

  it('behandelt eine entartete (punktförmige) Strecke ohne Absturz', () => {
    expect(distanceToSegment({ x: 3, z: 4 }, { x: 0, z: 0 }, { x: 0, z: 0 })).toBe(5);
  });
});

describe('insertPointOnNearestEdge', () => {
  const rechteck = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }];

  it('fügt den Punkt zwischen die beiden Ecken der nächstgelegenen Kante ein', () => {
    const result = insertPointOnNearestEdge(rechteck, { x: 5, z: 0 });
    expect(result).toEqual([{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }]);
  });

  it('hängt bei der Umlauf-schließenden Kante (letzter → erster Punkt) korrekt ans Ende an', () => {
    const result = insertPointOnNearestEdge(rechteck, { x: 0, z: 5 });
    expect(result).toEqual([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }, { x: 0, z: 5 }]);
  });

  it('erzeugt kein selbstüberschneidendes Polygon bei einem Klick nahe der Mitte einer Kante', () => {
    // Regression: vorher wurde jeder neue Punkt ans Ende angehängt, unabhängig
    // von der Klickposition — das erzeugte "Bowtie"-Formen beim Verfeinern.
    const result = insertPointOnNearestEdge(rechteck, { x: 10, z: 5 });
    expect(result[2]).toEqual({ x: 10, z: 5 });
  });

  it('hängt bei weniger als zwei Punkten einfach an', () => {
    expect(insertPointOnNearestEdge([{ x: 0, z: 0 }], { x: 1, z: 1 })).toEqual([{ x: 0, z: 0 }, { x: 1, z: 1 }]);
  });
});

describe('snapToGrid / snapPoint', () => {
  it('rundet auf das nächste Vielfache von step', () => {
    expect(snapToGrid(5.3, 0.5)).toBe(5.5);
    expect(snapToGrid(5.2, 0.5)).toBe(5);
    expect(snapToGrid(7, 1)).toBe(7);
  });

  it('vermeidet Fließkomma-Rauschen', () => {
    expect(snapToGrid(0.1 + 0.2, 0.1)).toBe(0.3);
  });

  it('snapPoint wendet das Raster auf x und z an', () => {
    expect(snapPoint({ x: 5.3, z: 2.7 }, 0.5)).toEqual({ x: 5.5, z: 2.5 });
  });
});

describe('snapToNeighbors', () => {
  const punkte = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }];

  it('rastet auf die X-Koordinate eines Nachbarn ein, wenn nahe genug', () => {
    const result = snapToNeighbors(punkte, 2, { x: 10.2, z: 5 }, 0.3);
    expect(result).toEqual({ point: { x: 10, z: 5 }, snappedX: true, snappedZ: false });
  });

  it('rastet nicht ein, wenn außerhalb der Toleranz', () => {
    const result = snapToNeighbors(punkte, 2, { x: 9, z: 5 }, 0.3);
    expect(result.snappedX).toBe(false);
  });

  it('kann über zwei verschiedene Nachbarn auf beiden Achsen gleichzeitig einrasten', () => {
    const dreieck = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }];
    // index 1 wird gezogen; Vorgänger (0,0) liefert die Z-Achse, Nachfolger (10,10) die X-Achse.
    const result = snapToNeighbors(dreieck, 1, { x: 10.05, z: 0.05 }, 0.3);
    expect(result).toEqual({ point: { x: 10, z: 0 }, snappedX: true, snappedZ: true });
  });
});

describe('edgeLabels', () => {
  it('liefert Länge und nach außen versetzten Mittelpunkt je Kante eines Rechtecks', () => {
    const labels = edgeLabels([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }], 1);
    expect(labels.map((l) => l.length)).toEqual([10, 10, 10, 10]);
    const untenKante = labels[0]!; // (0,0)-(10,0), Mittelpunkt (5,0), Schwerpunkt bei (5,5) → nach außen = -z
    expect(untenKante.x).toBeCloseTo(5, 5);
    expect(untenKante.z).toBeCloseTo(-1, 5);
  });

  it('behandelt eine entartete (punktförmige) Kante ohne Absturz', () => {
    const labels = edgeLabels([{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 10, z: 0 }]);
    expect(labels[0]!.length).toBe(0);
  });

  it('liefert ein leeres Array für weniger als zwei Punkte', () => {
    expect(edgeLabels([{ x: 0, z: 0 }])).toEqual([]);
  });
});
