/**
 * @file OpeningTrainer.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-27
 * @description Walk an ECO SAN line on top of ChessMatch (CHESS-B3). Grab stays in the viewer.
 */

import { ChessMatch } from '../rules/ChessMatch';
import type { ChessSquareName } from '../rules/chessTypes';
import { ECO_OPENINGS, findEcoOpeningIndex, type EcoOpening } from './ecoOpenings';

export interface BookPly {
  from: ChessSquareName;
  to: ChessSquareName;
  san: string;
}

export function resolveEcoLine(opening: EcoOpening): BookPly[] {
  const match = ChessMatch.starting();
  const plies: BookPly[] = [];
  for (const san of opening.sans) {
    const move = match.moveFromSan(san);
    if (!move) {
      throw new Error(`OpeningTrainer: cannot play ${san} in ${opening.eco} ${opening.name}`);
    }
    const result = match.tryMove(move.from, move.to);
    if (!result.ok) {
      throw new Error(`OpeningTrainer: illegal ${san} in ${opening.eco} ${opening.name}`);
    }
    plies.push({ from: move.from, to: move.to, san: result.san });
  }
  return plies;
}

/** Sequential book quiz: accept only the next SAN ply. */
export class OpeningTrainer {
  private readonly catalog: readonly EcoOpening[];
  private index: number;
  private plies: BookPly[] = [];
  private ply = 0;

  constructor(ecoOrName?: string, catalog: readonly EcoOpening[] = ECO_OPENINGS) {
    this.catalog = catalog;
    this.index = findEcoOpeningIndex(catalog, ecoOrName);
    this.reload();
  }

  public opening(): EcoOpening {
    return this.catalog[this.index] ?? this.catalog[0]!;
  }

  public plyIndex(): number {
    return this.ply;
  }

  public plyCount(): number {
    return this.plies.length;
  }

  public isComplete(): boolean {
    return this.ply >= this.plies.length;
  }

  public expected(): BookPly | null {
    return this.plies[this.ply] ?? null;
  }

  public isBookMove(from: ChessSquareName, to: ChessSquareName): boolean {
    const next = this.expected();
    return Boolean(next && next.from === from && next.to === to);
  }

  /** Advance if `from`/`to` is the next book ply. */
  public accept(from: ChessSquareName, to: ChessSquareName): boolean {
    if (!this.isBookMove(from, to)) return false;
    this.ply += 1;
    return true;
  }

  public restart(): void {
    this.ply = 0;
  }

  public nextOpening(): EcoOpening {
    this.index = (this.index + 1) % this.catalog.length;
    this.reload();
    return this.opening();
  }

  private reload(): void {
    const opening = this.opening();
    this.plies = resolveEcoLine(opening);
    this.ply = 0;
  }
}
