import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Lagerort } from '../../shared/types';
import type { EditorLagerOverlay } from '../editorOverlay';
import type { PlacedRack } from './transform';
import { LOOK_REACH, pickEditorLookHit, pickLookHit } from './LookTarget';

function ort(id: string): Lagerort {
  return {
    lagerkennung: id,
    bezeichnung: id,
    lagertechnik: 'test',
    dims: { d1: 1, d2: 1, d3: 1 },
    plaetze: [],
  };
}

function falseRack(key = 'x'): PlacedRack {
  return { key, ort: ort(key) } as PlacedRack;
}

function hit(dist: number, ud: { rackKey?: string; platzIds?: number[] }, instanceId: number | null = null): THREE.Intersection {
  return {
    distance: dist,
    object: { userData: ud } as unknown as THREE.Object3D,
    instanceId,
  } as THREE.Intersection;
}

const byKey = new Map<string, PlacedRack>([
  ['A', falseRack('A')],
  ['B', falseRack('B')],
]);

describe('pickLookHit', () => {
  it('wählt den ersten Regal-Treffer in Reichweite', () => {
    const r = pickLookHit(
      [hit(5, { rackKey: 'A', platzIds: [1, 2] }, 1)],
      byKey,
      LOOK_REACH,
    );
    expect(r?.ort.lagerkennung).toBe('A');
  });

  it('liefert die getroffene Regal-Instanz mit (für die Regal-Ebene im Inspector)', () => {
    const r = pickLookHit([hit(5, { rackKey: 'B' })], byKey, LOOK_REACH);
    expect(r?.rack.key).toBe('B');
  });

  it('liefert null bei Treffer außerhalb der Reichweite', () => {
    const r = pickLookHit([hit(40, { rackKey: 'A' })], byKey, LOOK_REACH);
    expect(r).toBeNull();
  });

  it('exakt 30 m ist noch in Reichweite', () => {
    const r = pickLookHit([hit(30, { rackKey: 'A' })], byKey, LOOK_REACH);
    expect(r?.ort.lagerkennung).toBe('A');
  });

  it('überspringt Nicht-Regal-Objekte (ohne rackKey)', () => {
    const r = pickLookHit(
      [hit(3, {}), hit(5, { rackKey: 'B' })],
      byKey,
      LOOK_REACH,
    );
    expect(r?.ort.lagerkennung).toBe('B');
  });

  it('ignoriert unbekannte rackKeys', () => {
    const r = pickLookHit([hit(5, { rackKey: 'UNBEKANNT' }), hit(6, { rackKey: 'A' })], byKey, LOOK_REACH);
    expect(r?.ort.lagerkennung).toBe('A');
  });

  it('mappt instanceId → platzIds → Lagerplatz', () => {
    const base = ort('C');
    const rack = {
      ...falseRack('C'),
      ort: {
        ...base,
        plaetze: [
          {
            platzId: 1,
            dim: { d1: 1, d2: 1, d3: 1 },
            ebene: 1,
            kurz: 'p1',
            platzbezeichnung: 'p1',
            masse: { hoehe: 1, breite: 1, laenge: 1 },
            maxGewicht: 1,
            bestaende: [],
          },
          {
            platzId: 42,
            dim: { d1: 1, d2: 1, d3: 1 },
            ebene: 1,
            kurz: 'p42',
            platzbezeichnung: 'p42',
            masse: { hoehe: 1, breite: 1, laenge: 1 },
            maxGewicht: 1,
            bestaende: [],
          },
          {
            platzId: 7,
            dim: { d1: 1, d2: 1, d3: 1 },
            ebene: 1,
            kurz: 'p7',
            platzbezeichnung: 'p7',
            masse: { hoehe: 1, breite: 1, laenge: 1 },
            maxGewicht: 1,
            bestaende: [],
          },
        ],
      },
    } as unknown as PlacedRack;
    const local = new Map([...byKey, ['C', rack]]);
    const r = pickLookHit([hit(5, { rackKey: 'C', platzIds: [1, 42, 7] }, 2)], local, LOOK_REACH);
    expect(r?.platz?.platzId).toBe(7);
  });

  it('ohne instanceId → platz null', () => {
    const r = pickLookHit([hit(5, { rackKey: 'A', platzIds: [1, 2] })], byKey, LOOK_REACH);
    expect(r?.platz).toBeNull();
  });

  it('leere Trefferliste → null', () => {
    expect(pickLookHit([], byKey, LOOK_REACH)).toBeNull();
  });

  it('Treffer nur aus Nicht-Regalen → null', () => {
    const r = pickLookHit([hit(5, {})], byKey, LOOK_REACH);
    expect(r).toBeNull();
  });
});

function editorHit(
  dist: number,
  ud: { editorOverlayId?: string; editorRegalId?: string; editorZelleKey?: string },
): THREE.Intersection {
  return { distance: dist, object: { userData: ud } as unknown as THREE.Object3D, instanceId: null as number | null } as THREE.Intersection;
}

function editorOverlay(id: string): EditorLagerOverlay {
  return {
    id,
    name: id,
    lagerkennung: id,
    grundriss: [],
    regale: [
      {
        placement: {
          gangId: 'g1',
          gangNummer: 1,
          reiheId: 'r1',
          regalId: 'reg1',
          seite: 'links',
          position: [0, 0, 0],
          size: { w: 1, h: 1, d: 1 },
          ebenen: 1,
          ebenenHoehen: [1],
          rotationY: 0,
          spiegelX: false,
          spiegelZ: false,
        },
        zellen: [{ ebene: 1, spalte: 1 }],
      },
    ],
  };
}

describe('pickEditorLookHit', () => {
  const overlaysById = new Map([['x', editorOverlay('x')]]);

  it('löst eine getroffene Editor-Zelle über overlayId/regalId/zelleKey auf', () => {
    const r = pickEditorLookHit([editorHit(5, { editorOverlayId: 'x', editorRegalId: 'reg1', editorZelleKey: '1:1' })], overlaysById, LOOK_REACH);
    expect(r?.overlay.id).toBe('x');
    expect(r?.regalId).toBe('reg1');
    expect(r?.zelle?.ebene).toBe(1);
    expect(r?.level).toBe('platz');
  });

  it('überspringt Treffer ohne Editor-userData und außerhalb der Reichweite', () => {
    expect(pickEditorLookHit([editorHit(3, {}), editorHit(40, { editorOverlayId: 'x', editorRegalId: 'reg1' })], overlaysById, LOOK_REACH)).toBeNull();
  });

  it('ignoriert unbekannte overlayId/regalId', () => {
    expect(pickEditorLookHit([editorHit(5, { editorOverlayId: 'unbekannt', editorRegalId: 'reg1' })], overlaysById, LOOK_REACH)).toBeNull();
    expect(pickEditorLookHit([editorHit(5, { editorOverlayId: 'x', editorRegalId: 'unbekannt' })], overlaysById, LOOK_REACH)).toBeNull();
  });

  it('leere Trefferliste → null', () => {
    expect(pickEditorLookHit([], overlaysById, LOOK_REACH)).toBeNull();
  });
});
