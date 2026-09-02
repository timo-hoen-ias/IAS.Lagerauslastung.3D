import { describe, expect, it } from 'vitest';
import { gangGuides, layoutEditorGaenge, polygonCenter, wallSegments, wandKandidaten } from './editorLayout';
import type { EditorGang } from '../../shared/editor';

// `hoehe` bleibt als Parameter erhalten, damit bestehende Aufrufe unverändert lesbar bleiben
// (Regalhöhe kommt jetzt ausschließlich aus `ebenenHoehen`, s. shared/editor.ts).
function regal(id: string, breite: number, _hoehe: number, tiefe: number, ebenen = 3) {
  return { id, ebenen, plaetzeProEbene: 4, breite, tiefe };
}

describe('layoutEditorGaenge', () => {
  it('stellt Regale einer Reihe fortlaufend ohne Überlappung nebeneinander', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 2, 1), regal('b', 3, 2, 1)] }],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const a = placements.find((p) => p.regalId === 'a')!;
    const b = placements.find((p) => p.regalId === 'b')!;
    expect(a.position[0]).toBe(1); // Mitte von [0,2]
    expect(b.position[0]).toBe(3.5); // Mitte von [2,5]
  });

  it('setzt rotationY aus der Reihen-Drehung (Grad → Radiant), ohne die Position zu verändern', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 2, 1)], rotation: 90 }],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const ohneRotation = layoutEditorGaenge([{ ...gaenge[0]!, reihen: [{ ...gaenge[0]!.reihen[0]!, rotation: undefined }] }]);
    expect(placements[0]!.rotationY).toBeCloseTo(Math.PI / 2);
    expect(placements[0]!.position).toEqual(ohneRotation[0]!.position);
    expect(ohneRotation[0]!.rotationY).toBe(0);
  });

  it('reicht spiegelX/spiegelZ der Reihe durch (Default false)', () => {
    const gaenge: EditorGang[] = [
      { id: 'g1', nummer: 1, breite: 3, reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 2, 1)], spiegelX: true }] },
      { id: 'g2', nummer: 2, breite: 3, reihen: [{ id: 'r2', seite: 'links', regale: [regal('b', 2, 2, 1)] }] },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const a = placements.find((p) => p.regalId === 'a')!;
    const b = placements.find((p) => p.regalId === 'b')!;
    expect(a.spiegelX).toBe(true);
    expect(a.spiegelZ).toBe(false);
    expect(b.spiegelX).toBe(false);
    expect(b.spiegelZ).toBe(false);
  });

  it('reicht individuelle Ebenenhöhen durch, sonst die Default-Höhe je Ebene', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [
          { id: 'r1', seite: 'links', regale: [{ ...regal('a', 2, 3, 1, 3), ebenenHoehen: [1.5, 0.8, 0.7] }, regal('b', 2, 0, 1, 2)] },
        ],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    expect(placements.find((p) => p.regalId === 'a')!.ebenenHoehen).toEqual([1.5, 0.8, 0.7]);
    expect(placements.find((p) => p.regalId === 'b')!.ebenenHoehen).toEqual([0.6, 0.6]);
  });

  it('reicht die Gang-Nummer (für die Ebenen-Anzeige im Inspector) an jedes Regal der Placements durch', () => {
    const gaenge: EditorGang[] = [
      { id: 'g1', nummer: 3, breite: 3, reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 2, 1)] }] },
    ];
    const placements = layoutEditorGaenge(gaenge);
    expect(placements[0]!.gangNummer).toBe(3);
  });

  it('spiegelt Reihe "links" und "rechts" symmetrisch um die Gangmitte, je nach Regaltiefe', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 4,
        reihen: [
          { id: 'links', seite: 'links', regale: [regal('a', 2, 2, 1)] },
          { id: 'rechts', seite: 'rechts', regale: [regal('b', 2, 2, 1.5)] },
        ],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const links = placements.find((p) => p.regalId === 'a')!;
    const rechts = placements.find((p) => p.regalId === 'b')!;
    expect(links.position[2]).toBe(-(4 / 2 + 1 / 2));
    expect(rechts.position[2]).toBe(4 / 2 + 1.5 / 2);
  });

  it('setzt den zweiten Gang erst nach Breite + Abstand des ersten Gangs fort', () => {
    const gaenge: EditorGang[] = [
      { id: 'g1', nummer: 1, breite: 3, reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 5, 2, 1)] }] },
      { id: 'g2', nummer: 2, breite: 3, reihen: [{ id: 'r2', seite: 'links', regale: [regal('b', 5, 2, 1)] }] },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const b = placements.find((p) => p.regalId === 'b')!;
    expect(b.position[0]).toBe(5 + 3 + 5 / 2); // erster Gang (Breite 5) + Abstand (3) + halbe Breite von b
  });

  it('kommt ohne Absturz aus, wenn eine Reihe leer ist', () => {
    const gaenge: EditorGang[] = [{ id: 'g1', nummer: 1, breite: 3, reihen: [{ id: 'r1', seite: 'links', regale: [] }] }];
    expect(layoutEditorGaenge(gaenge)).toEqual([]);
  });

  it('verschiebt alle Regale einer Reihe gemeinsam um deren Versatz', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 2, 1), regal('b', 3, 2, 1)], versatz: { x: 1, z: 0.5 } }],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const ohneVersatz = layoutEditorGaenge([{ ...gaenge[0]!, reihen: [{ ...gaenge[0]!.reihen[0]!, versatz: undefined }] }]);
    const a = placements.find((p) => p.regalId === 'a')!;
    const aOhne = ohneVersatz.find((p) => p.regalId === 'a')!;
    const b = placements.find((p) => p.regalId === 'b')!;
    const bOhne = ohneVersatz.find((p) => p.regalId === 'b')!;
    expect(a.position[0]).toBe(aOhne.position[0] + 1);
    expect(a.position[2]).toBe(aOhne.position[2] + 0.5);
    expect(b.position[0]).toBe(bOhne.position[0] + 1);
    expect(b.position[2]).toBe(bOhne.position[2] + 0.5);
  });

  it('addiert Reihen- und Regal-Versatz statt sich gegenseitig zu überschreiben', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [
          { id: 'r1', seite: 'links', regale: [{ ...regal('a', 2, 2, 1), versatz: { x: 0.3, z: 0 } }], versatz: { x: 1, z: 0 } },
        ],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const ohneVersatz = layoutEditorGaenge([
      { id: 'g1', nummer: 1, breite: 3, reihen: [{ id: 'r1', seite: 'links', regale: [regal('a', 2, 2, 1)] }] },
    ]);
    const a = placements.find((p) => p.regalId === 'a')!;
    const aOhne = ohneVersatz.find((p) => p.regalId === 'a')!;
    expect(a.position[0]).toBe(aOhne.position[0] + 1.3);
  });

  it('startet eine Reihe standardmäßig linksbündig am Gang-Anfang, unabhängig von der Länge der Gegenreihe', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [
          { id: 'kurz', seite: 'links', regale: [regal('a', 2, 2, 1)] },
          { id: 'lang', seite: 'rechts', regale: [regal('b', 2, 2, 1), regal('c', 3, 2, 1)] },
        ],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const a = placements.find((p) => p.regalId === 'a')!;
    const b = placements.find((p) => p.regalId === 'b')!;
    // Beide Reihen beginnen bei x=0 (Regal-Mitte = halbe Breite) — die kürzere Reihe endet mitten im Gang.
    expect(a.position[0]).toBe(1);
    expect(b.position[0]).toBe(1);
  });

  it('richtet eine rechtsbündige Reihe am Ende der längsten Reihe des Gangs aus, statt am Gang-Anfang', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [
          { id: 'kurz', seite: 'links', regale: [regal('a', 2, 2, 1)], buendig: 'rechts' },
          { id: 'lang', seite: 'rechts', regale: [regal('b', 2, 2, 1), regal('c', 3, 2, 1)] },
        ],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const a = placements.find((p) => p.regalId === 'a')!;
    const c = placements.find((p) => p.regalId === 'c')!;
    // Rechte Kante der kurzen Reihe (a: Mitte + halbe Breite) trifft exakt die rechte Kante der langen Reihe (c: Mitte + halbe Breite).
    expect(a.position[0] + 1).toBeCloseTo(c.position[0] + 1.5, 10);
  });

  it('rechtsbündige Ausrichtung verschiebt nur die X-Position, nicht die Gangbreite/Z-Position', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 4,
        reihen: [
          { id: 'links', seite: 'links', regale: [regal('a', 2, 2, 1)], buendig: 'rechts' },
          { id: 'rechts', seite: 'rechts', regale: [regal('b', 2, 2, 1), regal('c', 3, 2, 1)] },
        ],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const ohneBuendig = layoutEditorGaenge([
      { ...gaenge[0]!, reihen: [{ ...gaenge[0]!.reihen[0]!, buendig: undefined }, gaenge[0]!.reihen[1]!] },
    ]);
    const a = placements.find((p) => p.regalId === 'a')!;
    const aOhne = ohneBuendig.find((p) => p.regalId === 'a')!;
    expect(a.position[2]).toBe(aOhne.position[2]);
  });

  it('löst einen Z-Anker so auf, dass die Reihe an der (fremden) Ziel-Reihe ausgerichtet bleibt', () => {
    const gaenge: EditorGang[] = [
      { id: 'gA', nummer: 1, breite: 3, reihen: [{ id: 'a-rechts', seite: 'rechts', regale: [regal('a', 2, 2, 1)] }] },
      {
        id: 'gB',
        nummer: 2,
        breite: 5,
        reihen: [{ id: 'b-rechts', seite: 'rechts', regale: [regal('b', 2, 2, 1)], anker: { reiheId: 'a-rechts', offset: 0 } }],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const a = placements.find((p) => p.regalId === 'a')!;
    const b = placements.find((p) => p.regalId === 'b')!;
    expect(b.position[2]).toBeCloseTo(a.position[2], 10);
  });

  it('folgt einer Änderung der Ziel-Gangbreite automatisch — ein fixer `versatz` würde das nicht', () => {
    const basis = (breiteA: number): EditorGang[] => [
      { id: 'gA', nummer: 1, breite: breiteA, reihen: [{ id: 'a-rechts', seite: 'rechts', regale: [regal('a', 2, 2, 1)] }] },
      {
        id: 'gB',
        nummer: 2,
        breite: 5,
        reihen: [{ id: 'b-rechts', seite: 'rechts', regale: [regal('b', 2, 2, 1)], anker: { reiheId: 'a-rechts', offset: 0 } }],
      },
    ];
    const bVorher = layoutEditorGaenge(basis(3)).find((p) => p.regalId === 'b')!;
    const nachher = layoutEditorGaenge(basis(6));
    const bNachher = nachher.find((p) => p.regalId === 'b')!;
    const aNachher = nachher.find((p) => p.regalId === 'a')!;
    expect(bNachher.position[2]).toBeCloseTo(aNachher.position[2], 10); // weiterhin exakt an a ausgerichtet
    expect(Math.abs(bNachher.position[2] - bVorher.position[2])).toBeGreaterThan(0.5); // hat sich tatsächlich mitbewegt
  });

  it('bewahrt einen von 0 abweichenden Andock-Offset (z. B. Kante-an-Kante statt Mitte-an-Mitte)', () => {
    const gaenge: EditorGang[] = [
      { id: 'gA', nummer: 1, breite: 3, reihen: [{ id: 'a-rechts', seite: 'rechts', regale: [regal('a', 2, 2, 1)] }] },
      {
        id: 'gB',
        nummer: 2,
        breite: 5,
        reihen: [{ id: 'b-rechts', seite: 'rechts', regale: [regal('b', 2, 2, 1)], anker: { reiheId: 'a-rechts', offset: 1.5 } }],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const a = placements.find((p) => p.regalId === 'a')!;
    const b = placements.find((p) => p.regalId === 'b')!;
    expect(b.position[2] - a.position[2]).toBeCloseTo(1.5, 10);
  });

  it('bricht bei einem zirkulären Anker nicht ab, sondern fällt auf den fixen Versatz zurück', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [
          { id: 'r1', seite: 'links', regale: [regal('a', 2, 2, 1)], anker: { reiheId: 'r2', offset: 0 } },
          { id: 'r2', seite: 'rechts', regale: [regal('b', 2, 2, 1)], anker: { reiheId: 'r1', offset: 0 } },
        ],
      },
    ];
    expect(() => layoutEditorGaenge(gaenge)).not.toThrow();
  });
});

describe('gangGuides', () => {
  it('leitet Ist-Mittellinie und Ist-Breite aus den tatsächlichen Regal-Placements ab, nicht aus einer theoretischen Position', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 4,
        reihen: [
          { id: 'links', seite: 'links', regale: [regal('a', 2, 2, 1)] },
          { id: 'rechts', seite: 'rechts', regale: [regal('b', 2, 2, 1.5)] },
        ],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const [guide] = gangGuides(gaenge, placements);
    const links = placements.find((p) => p.regalId === 'a')!;
    const rechts = placements.find((p) => p.regalId === 'b')!;
    // Innenkante "links" (Mitte + halbe Tiefe) und "rechts" (Mitte − halbe Tiefe) treffen exakt die Guide-Grenzen.
    expect(links.position[2] + links.size.d / 2).toBeCloseTo(guide!.z - guide!.breiteIst / 2, 10);
    expect(rechts.position[2] - rechts.size.d / 2).toBeCloseTo(guide!.z + guide!.breiteIst / 2, 10);
    expect(guide!.breiteSoll).toBe(4);
    expect(guide!.breiteIst).toBeCloseTo(4, 10); // ohne manuellen Versatz entspricht Ist der Soll-Breite
  });

  it('folgt einem manuellen Reihen-Versatz — Ist-Mittellinie/-Breite weichen dann von der Soll-Position ab', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 4,
        reihen: [
          { id: 'links', seite: 'links', regale: [regal('a', 2, 2, 1)] },
          { id: 'rechts', seite: 'rechts', regale: [regal('b', 2, 2, 1)], versatz: { x: 0, z: 1 } },
        ],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const [guide] = gangGuides(gaenge, placements);
    expect(guide!.breiteSoll).toBe(4);
    expect(guide!.breiteIst).toBeCloseTo(5, 10); // rechte Reihe um 1m weiter weg verschoben
  });

  it('spannt die X-Ausdehnung über beide Reihen und rückt nachfolgende Gänge um Breite + Abstand weiter', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [
          { id: 'r1l', seite: 'links', regale: [regal('a', 5, 2, 1)] },
          { id: 'r1r', seite: 'rechts', regale: [regal('c', 5, 2, 1)] },
        ],
      },
      {
        id: 'g2',
        nummer: 2,
        breite: 3,
        reihen: [
          { id: 'r2l', seite: 'links', regale: [regal('b', 5, 2, 1)] },
          { id: 'r2r', seite: 'rechts', regale: [regal('d', 5, 2, 1)] },
        ],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    const [g1, g2] = gangGuides(gaenge, placements);
    expect(g1!.xVon).toBe(0);
    expect(g1!.xBis).toBe(5);
    expect(g2!.xVon).toBe(5 + 3);
    expect(g2!.xBis).toBe(5 + 3 + 5);
  });

  it('überspringt Gänge, denen eine der beiden Reihen fehlt (keine sinnvolle Gangbreite ohne Gegenseite)', () => {
    const gaenge: EditorGang[] = [
      {
        id: 'g1',
        nummer: 1,
        breite: 3,
        reihen: [
          { id: 'links', seite: 'links', regale: [regal('a', 2, 2, 1)] },
          { id: 'rechts', seite: 'rechts', regale: [] },
        ],
      },
    ];
    const placements = layoutEditorGaenge(gaenge);
    expect(gangGuides(gaenge, placements)).toEqual([]);
  });
});

describe('wallSegments', () => {
  it('erzeugt ein Segment je Kante eines geschlossenen Polygons', () => {
    const segs = wallSegments([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 6 }, { x: 0, z: 6 }], 3);
    expect(segs).toHaveLength(4);
    expect(segs[0]!.length).toBe(10);
    expect(segs[0]!.position).toEqual([5, 1.5, 0]);
  });

  it('überspringt entartete (doppelte) Punkte statt eines Nulllängen-Segments', () => {
    const segs = wallSegments([{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 10, z: 0 }], 3);
    expect(segs.every((s) => s.length > 0)).toBe(true);
  });
});

describe('polygonCenter', () => {
  it('berechnet den Mittelpunkt aus dem Durchschnitt der Eckpunkte', () => {
    expect(polygonCenter([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }])).toEqual({ x: 5, z: 5 });
  });

  it('liefert {0,0} für ein leeres Polygon', () => {
    expect(polygonCenter([])).toEqual({ x: 0, z: 0 });
  });
});

describe('wandKandidaten', () => {
  const rechteck = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 6 }, { x: 0, z: 6 }];

  it('liefert je achsparalleler Wand einen Kandidaten, um die halbe Wanddicke Richtung Innenraum versetzt', () => {
    const k = wandKandidaten(rechteck, 0.2);
    expect(k.z.sort((a, b) => a - b)).toEqual([0.1, 5.9]);
    expect(k.x.sort((a, b) => a - b)).toEqual([0.1, 9.9]);
  });

  it('liefert keine Kandidaten für ein zu kleines Polygon', () => {
    expect(wandKandidaten([{ x: 0, z: 0 }, { x: 1, z: 1 }], 0.2)).toEqual({ x: [], z: [] });
  });

  it('überspringt schräge Wände, statt einen irreführenden Achsenwert zu liefern', () => {
    const schraeg = [{ x: 0, z: 0 }, { x: 10, z: 3 }, { x: 3, z: 10 }];
    const k = wandKandidaten(schraeg, 0.2);
    expect(k.x).toEqual([]);
    expect(k.z).toEqual([]);
  });
});
