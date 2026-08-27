import { describe, expect, it } from 'vitest';
import { parseDecimal } from './DecimalInput';

describe('parseDecimal', () => {
  it('akzeptiert Punkt und Komma', () => {
    expect(parseDecimal('8.5')).toBe(8.5);
    expect(parseDecimal('8,5')).toBe(8.5);
    expect(parseDecimal(' 12 ')).toBe(12);
  });

  it('liefert null bei ungültigen Eingaben', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('8.5.3')).toBeNull();
  });
});
