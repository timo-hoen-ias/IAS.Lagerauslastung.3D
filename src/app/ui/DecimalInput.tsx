import { useEffect, useRef, useState } from 'react';

export function parseDecimal(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const v = Number(t.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

function format(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Kommazahl-Eingabe mit lokalem Text-Status (freies Tippen inkl. "8." oder "8,5"),
 *  committet bei Blur/Enter, synchronisiert von außen nur wenn nicht fokussiert. */
export default function DecimalInput({
  value,
  onCommit,
  className = 'wm-input',
}: {
  value: number;
  onCommit: (v: number) => void;
  className?: string;
}) {
  const [text, setText] = useState(format(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(format(value));
  }, [value]);

  const commit = () => {
    const v = parseDecimal(text);
    if (v !== null && v > 0) onCommit(v);
    else setText(format(value));
  };

  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}
