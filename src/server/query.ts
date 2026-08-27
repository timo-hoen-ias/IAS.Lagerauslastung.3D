import type { Lagerbestand, LagerDaten, Lagerort, Lagerplatz } from '../shared/types';

export const LAGER_SQL = `
select
  kh2.Mandant as Mandant,
  kh2.Lagerkennung as Lagerkennung,
  kh2.Bezeichnung as Bezeichnung,
  kh2.Lagertechnik as Lagertechnik,
  kh2.AnzahlDimension1, kh2.AnzahlDimension2, kh2.AnzahlDimension3,
  kh.PlatzID, kh.Dimension1, kh.Dimension2, kh.Dimension3, kh.Dimensionsebene,
  kh.Kurzbezeichnung, kh.Platzbezeichnung, kh.Hoehe, kh.Breite, kh.Laenge,
  a.Artikelnummer, a.Bezeichnung1,
  kh3.Bestand, kh3.Verfuegbarkeit
from KHKLagerplatzbestaende AS kh3
inner join KHKLagerplaetze AS kh
on kh3.PlatzID = kh.PlatzID and kh3.Mandant = kh.Mandant
inner join KHKLagerorte AS kh2
on kh.Mandant = kh2.Mandant AND kh.Lagerkennung = kh2.Lagerkennung
inner join khkartikel as a on a.Artikelnummer = kh3.Artikelnummer and a.Mandant = kh3.Mandant
`;

export const PLAETZE_SQL = `
select
  kh2.Mandant as Mandant,
  kh2.Lagerkennung as Lagerkennung,
  kh2.Bezeichnung as Bezeichnung,
  kh2.Lagertechnik as Lagertechnik,
  kh2.AnzahlDimension1, kh2.AnzahlDimension2, kh2.AnzahlDimension3,
  kh.PlatzID, kh.Dimension1, kh.Dimension2, kh.Dimension3, kh.Dimensionsebene,
  kh.Kurzbezeichnung, kh.Platzbezeichnung, kh.Hoehe, kh.Breite, kh.Laenge
from KHKLagerorte AS kh2
inner join KHKLagerplaetze AS kh
on kh.Mandant = kh2.Mandant AND kh.Lagerkennung = kh2.Lagerkennung
`;

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

export function groupLagerorte(rows: Record<string, unknown>[]): LagerDaten {
  const lagerorte = new Map<string, Lagerort>();
  for (const r of rows) {
    const ortKey = `${str(r.Mandant)}|${str(r.Lagerkennung)}`;
    let ort = lagerorte.get(ortKey);
    if (!ort) {
      ort = {
        lagerkennung: str(r.Lagerkennung),
        bezeichnung: str(r.Bezeichnung),
        lagertechnik: str(r.Lagertechnik),
        dims: { d1: num(r.AnzahlDimension1), d2: num(r.AnzahlDimension2), d3: num(r.AnzahlDimension3) },
        plaetze: [],
      };
      lagerorte.set(ortKey, ort);
    }
    ort.plaetze.push({
      platzId: num(r.PlatzID),
      dim: { d1: num(r.Dimension1), d2: num(r.Dimension2), d3: num(r.Dimension3) },
      ebene: num(r.Dimensionsebene),
      kurz: str(r.Kurzbezeichnung),
      platzbezeichnung: str(r.Platzbezeichnung),
      masse: { hoehe: num(r.Hoehe), breite: num(r.Breite), laenge: num(r.Laenge) },
      bestaende: [],
    });
  }
  return {
    mandant: rows.length ? num(rows[0]!.Mandant) : 0,
    lagerorte: [...lagerorte.values()].sort((a, b) => a.lagerkennung.localeCompare(b.lagerkennung)),
  };
}

export function attachBestaende(data: LagerDaten, rows: Record<string, unknown>[]): void {
  const byPlatz = new Map<string, Lagerplatz>();
  for (const ort of data.lagerorte) {
    for (const platz of ort.plaetze) {
      byPlatz.set(`${ort.lagerkennung}|${platz.platzId}`, platz);
    }
  }
  const jeArtikel = new Map<string, Map<string, Lagerbestand>>();
  for (const r of rows) {
    const platz = byPlatz.get(`${str(r.Lagerkennung)}|${num(r.PlatzID)}`);
    if (!platz) continue;
    let artikel = jeArtikel.get(`${platz.platzId}`);
    if (!artikel) {
      artikel = new Map();
      jeArtikel.set(`${platz.platzId}`, artikel);
    }
    const artNr = str(r.Artikelnummer);
    let eintrag = artikel.get(artNr);
    if (!eintrag) {
      eintrag = {
        artikelnummer: artNr,
        bezeichnung1: str(r.Bezeichnung1),
        bestand: 0,
        verfuegbarkeit: num(r.Verfuegbarkeit),
      };
      artikel.set(artNr, eintrag);
      platz.bestaende.push(eintrag);
    }
    eintrag.bestand += num(r.Bestand);
  }
}
