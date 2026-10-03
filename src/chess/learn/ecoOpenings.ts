/**
 * @file ecoOpenings.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-27
 * @description Curated ECO teaching lines for CHESS-B3 (not a full opening book).
 */

export interface EcoOpening {
  eco: string;
  name: string;
  /** SAN plies from the start position, both colours. */
  sans: string[];
}

/** Short, well-known lines for the Game-view quiz. */
export const ECO_OPENINGS: readonly EcoOpening[] = [
  { eco: 'C50', name: 'Italian Game', sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'] },
  { eco: 'C60', name: 'Ruy Lopez', sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'] },
  { eco: 'C44', name: 'Scotch Game', sans: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4'] },
  { eco: 'B20', name: 'Sicilian Defence', sans: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4'] },
  { eco: 'C00', name: 'French Defence', sans: ['e4', 'e6', 'd4', 'd5'] },
  { eco: 'B10', name: 'Caro-Kann Defence', sans: ['e4', 'c6', 'd4', 'd5'] },
  { eco: 'D06', name: "Queen's Gambit", sans: ['d4', 'd5', 'c4', 'e6'] },
  { eco: 'E60', name: "King's Indian Defence", sans: ['d4', 'Nf6', 'c4', 'g6'] },
];

export function openingSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function findEcoOpeningIndex(catalog: readonly EcoOpening[], ecoOrName?: string): number {
  if (!ecoOrName) return 0;
  const key = ecoOrName.trim().toLowerCase();
  if (!key) return 0;
  const byEco = catalog.findIndex((o) => o.eco.toLowerCase() === key);
  if (byEco >= 0) return byEco;
  const bySlug = catalog.findIndex((o) => openingSlug(o.name) === openingSlug(key));
  if (bySlug >= 0) return bySlug;
  const byName = catalog.findIndex((o) => o.name.toLowerCase().includes(key));
  return byName >= 0 ? byName : 0;
}
