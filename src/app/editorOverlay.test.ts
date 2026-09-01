import { describe, expect, it } from 'vitest';
import {
  buildEditorOverlay,
  editorCounts,
  editorGangNummer,
  editorLevelRows,
  editorRegalIndex,
  editorReiheSeite,
  stageEditorOverlays,
  type EditorLagerOverlay,
} from './editorOverlay';
import type { EditorGang } from '../shared/editor';
import type { Lagerbestand, Lagerort, Lagerplatz } from '../shared/types';

function regal(id: string, ebenen: number, plaetzeProEbene: number) {
  return { id, ebenen, plaetzeProEbene, breite: 1, tiefe: 1 };
}

function bestand(artikelnummer: string, bestand: number): Lagerbestand {
  return { artikelnummer, bezeichnung1: artikelnummer, matchcode: '', bestand, verfuegbarkeit: bestand, gewicht: 0, einheit: '' };
}

function platz(d1: number, d2: number, d3: number, bestaende: Lagerbestand[] = []): Lagerplatz {
  return {
    platzId: d1 * 1000 + d2 * 100 + d3,
    dim: { d1, d2, d3 },
    ebene: d2,
    kurz: `${d1}-${d2}-${d3}`,
    platzbezeichnung: '',
    masse: { hoehe: 0, breite: 0, laenge: 0 },
    maxGewicht: 0,
    bestaende,
  };
}

const gaenge: EditorGang[] = [
  { id: 'g1', nummer: 1, breite: 3, reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 2)] }] },
];

describe('buildEditorOverlay', () => {
  it('ordnet passende Sage-Plätze per Dim1/2/3 der jeweiligen Zelle (Ebene×Spalte) zu', () => {
    const ort: Lagerort = {
      lagerkennung: 'L-F-H',
      bezeichnung: 'Halle 1',
      lagertechnik: 'LTD1UF',
      dims: { d1: 1, d2: 2, d3: 2 },
      plaetze: [platz(1, 1, 1), platz(1, 2, 1), platz(1, 1, 2), platz(9, 9, 9)],
    };
    const overlay = buildEditorOverlay({ id: 'x', name: 'Test', lagerkennung: 'L-F-H', grundriss: [], gaenge }, ort);
    expect(overlay.regale).toHaveLength(1);
    // regal 'a' hat 2 Ebenen × 2 Plätze = 4 Zellen, alle bis auf eine (Ebene 2, Spalte 2) finden einen echten Platz.
    expect(overlay.regale[0]!.zellen).toHaveLength(4);
    const gefunden = overlay.regale[0]!.zellen.filter((z) => z.platz).map((z) => z.platz!.platzId).sort();
    expect(gefunden).toEqual([1101, 1102, 1201]);
    expect(overlay.regale[0]!.zellen.find((z) => z.ebene === 2 && z.spalte === 2)?.platz).toBeUndefined();
  });

  it('liefert alle Zellen ohne `platz`, wenn kein echter Lagerort existiert (nur Layout-Kontrolle)', () => {
    const overlay = buildEditorOverlay({ id: 'x', name: 'Test', lagerkennung: 'L-F-H', grundriss: [], gaenge }, undefined);
    expect(overlay.regale[0]!.zellen).toHaveLength(4);
    expect(overlay.regale[0]!.zellen.every((z) => z.platz === undefined)).toBe(true);
  });
});

describe('stageEditorOverlays', () => {
  function overlay(id: string, breite: number): EditorLagerOverlay {
    return { id, name: id, lagerkennung: id, grundriss: [{ x: 0, z: 0 }, { x: breite, z: 0 }, { x: breite, z: 10 }, { x: 0, z: 10 }], regale: [] };
  }

  it('reiht mehrere Overlays lückenlos nach breite hintereinander auf, ab startX + Puffer', () => {
    const [a, b] = stageEditorOverlays([overlay('a', 20), overlay('b', 10)], 100);
    expect(a!.offset.x).toBe(108); // 100 + 8 Puffer, minX=0
    expect(b!.offset.x).toBe(108 + 20 + 8);
  });

  it('liefert eine leere Liste für keine Overlays', () => {
    expect(stageEditorOverlays([], 0)).toEqual([]);
  });
});

describe('Ebenen-Navigation (Regal/Reihe/Gang/Lager)', () => {
  // Gang 1: Reihe links (Regal a, 2 Plätze) + Reihe rechts (Regal b, 1 Platz).
  // Gang 2: Reihe links (Regal c, 1 Platz).
  const zweiGaenge: EditorGang[] = [
    {
      id: 'g1',
      nummer: 1,
      breite: 3,
      reihen: [
        { id: 'r1-links', seite: 'links', regale: [regal('a', 1, 2)] },
        { id: 'r1-rechts', seite: 'rechts', regale: [regal('b', 1, 1)] },
      ],
    },
    { id: 'g2', nummer: 2, breite: 3, reihen: [{ id: 'r2-links', seite: 'links', regale: [regal('c', 1, 1)] }] },
  ];

  const ort: Lagerort = {
    lagerkennung: 'L-F-H',
    bezeichnung: 'Halle 1',
    lagertechnik: 'LTD1UF',
    dims: { d1: 2, d2: 1, d3: 3 },
    plaetze: [
      platz(1, 1, 1, [bestand('X1', 10)]), // Regal a, Spalte 1
      platz(1, 1, 2, [bestand('X2', 5)]), // Regal a, Spalte 2
      platz(1, 1, 3, [bestand('X1', 2)]), // Regal b (Reihe rechts)
      platz(2, 1, 1, [bestand('X3', 7)]), // Regal c (Gang 2)
    ],
  };
  const overlay = buildEditorOverlay({ id: 'x', name: 'Halle 1', lagerkennung: 'L-F-H', grundriss: [], gaenge: zweiGaenge }, ort);
  const regalA = overlay.regale.find((r) => r.placement.regalId === 'a')!.placement;
  const regalB = overlay.regale.find((r) => r.placement.regalId === 'b')!.placement;
  const regalC = overlay.regale.find((r) => r.placement.regalId === 'c')!.placement;

  it('editorLevelRows: Regal-Ebene enthält nur die Bestände dieses einen Regals', () => {
    const rows = editorLevelRows(overlay, 'regal', { gangId: regalA.gangId, reiheId: regalA.reiheId, regalId: regalA.regalId });
    expect(rows.map((r) => r.artikel).sort()).toEqual(['X1', 'X2']);
  });

  it('editorLevelRows: Reihe-Ebene bündelt nur die Regale derselben Reihe (Seite), nicht die gegenüberliegende', () => {
    const rowsLinks = editorLevelRows(overlay, 'reihe', { gangId: regalA.gangId, reiheId: regalA.reiheId, regalId: regalA.regalId });
    expect(rowsLinks.map((r) => r.artikel).sort()).toEqual(['X1', 'X2']);
    const rowsRechts = editorLevelRows(overlay, 'reihe', { gangId: regalB.gangId, reiheId: regalB.reiheId, regalId: regalB.regalId });
    expect(rowsRechts.map((r) => r.artikel)).toEqual(['X1']);
  });

  it('editorLevelRows: Gang-Ebene bündelt links UND rechts, aber nicht den anderen Gang', () => {
    const rows = editorLevelRows(overlay, 'gang', { gangId: regalA.gangId, reiheId: regalA.reiheId, regalId: regalA.regalId });
    expect(rows.map((r) => r.artikel).sort()).toEqual(['X1', 'X1', 'X2']);
    expect(rows.some((r) => r.artikel === 'X3')).toBe(false);
  });

  it('editorLevelRows: Lager-Ebene bündelt alle Gänge', () => {
    const rows = editorLevelRows(overlay, 'lager', { gangId: regalC.gangId, reiheId: regalC.reiheId, regalId: regalC.regalId });
    expect(rows.map((r) => r.artikel).sort()).toEqual(['X1', 'X1', 'X2', 'X3']);
  });

  it('editorCounts: zählt alle Zellen einer Ebene und die davon mit echtem Sage-Bestand', () => {
    const c = editorCounts(overlay, 'gang', { gangId: regalA.gangId, reiheId: regalA.reiheId, regalId: regalA.regalId });
    expect(c.plaetzeCount).toBe(3); // 2 (Regal a) + 1 (Regal b)
    expect(c.belegt).toBe(3);
  });

  it('editorGangNummer/editorReiheSeite/editorRegalIndex liefern die Breadcrumb-Labels', () => {
    expect(editorGangNummer(overlay, regalA.gangId)).toBe(1);
    expect(editorGangNummer(overlay, regalC.gangId)).toBe(2);
    expect(editorReiheSeite(overlay, regalA.reiheId)).toBe('links');
    expect(editorReiheSeite(overlay, regalB.reiheId)).toBe('rechts');
    expect(editorRegalIndex(overlay, regalA.reiheId, regalA.regalId)).toBe(1);
    expect(editorGangNummer(overlay, 'unbekannt')).toBeNull();
  });
});
