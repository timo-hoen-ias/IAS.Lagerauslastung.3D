export type Lagerbestand = {
  artikelnummer: string;
  bezeichnung1: string;
  matchcode: string;
  bestand: number;
  verfuegbarkeit: number;
  gewicht: number;
};

export type Lagerplatz = {
  platzId: number;
  dim: { d1: number; d2: number; d3: number };
  ebene: number;
  kurz: string;
  platzbezeichnung: string;
  masse: { hoehe: number; breite: number; laenge: number };
  maxGewicht: number;
  bestaende: Lagerbestand[];
};

export type Lagerort = {
  lagerkennung: string;
  bezeichnung: string;
  lagertechnik: string;
  dims: { d1: number; d2: number; d3: number };
  plaetze: Lagerplatz[];
};

export type LagerDaten = {
  mandant: number;
  lagerorte: Lagerort[];
};
