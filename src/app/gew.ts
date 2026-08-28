import type { Lagerort, Lagerplatz } from '../shared/types';

/** Gewicht eines Platzes = Σ (Bestand × Gewicht je Lagermengeneinheit). */
export function platzGewicht(platz: Lagerplatz): number {
  return platz.bestaende.reduce((s, b) => s + b.bestand * b.gewicht, 0);
}

/** Maximalgewicht eines Platzes (Tragkraft, 0 = keine Angabe). */
export function platzMaxGewicht(platz: Lagerplatz): number {
  return platz.maxGewicht;
}

export function platzÜberlastet(platz: Lagerplatz): boolean {
  return platzMaxGewicht(platz) > 0 && platzGewicht(platz) > platzMaxGewicht(platz);
}

/** Gesamtgewicht eines Lagerorts über alle Plätze. */
export function ortGewicht(ort: Lagerort): number {
  return ort.plaetze.reduce((s, p) => s + platzGewicht(p), 0);
}

/** Summe der Maximalgewichte aller Plätze eines Lagerorts. */
export function ortMaxGewicht(ort: Lagerort): number {
  return ort.plaetze.reduce((s, p) => s + platzMaxGewicht(p), 0);
}

export function ortÜberlastet(ort: Lagerort): boolean {
  const max = ortMaxGewicht(ort);
  return max > 0 && ortGewicht(ort) > max;
}

/** Formatiert Kilogramm mit einer Dezimalstelle. */
export function fmtKg(n: number): string {
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kg`;
}
