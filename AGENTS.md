# Projektregeln — ias.warehouse-map

## Unit-Tests (verpflichtend)

- **Jede neue oder geänderte Logik benötigt Unit-Tests** (Vitest). Das gilt für:
  - Server-Logik (SQL-Gruppierung in `src/server/query.ts`)
  - Geometrie-/Layout-Berechnungen (`src/app/scene/layout.ts`)
  - Physik-/Utility-Funktionen (`src/app/phys.ts`)
  - jede weitere reine Funktion, die nicht trivial ist (eine Verzweigung, eine Schleife, ein Parser, Geld-/Sicherheitslogik)
- Tests liegen neben der Quelle als `*.test.ts` (z. B. `layout.test.ts` neben `layout.ts`).
- Vor Abschluss einer Aufgabe läuft `bun run test` — alle Tests müssen grün sein, zusätzlich `bun run typecheck` und `bun run build`.

## Konventionen

- Stack: Bun, TypeScript, Vite, React, three.js (@react-three/fiber/drei, @react-three/uikit).
- Deutsch für Nutzertexte und Kommentare, englische Bezeichner.
- Keine neuen Abhängigkeiten für Dinge, die wenige Zeilen Standardlösung sind (ponytail-Prinzip).
