/**
 * Bake sizes shipped for HD pieces and the board.
 * Matches `shippedPieceTextureSizes` / `shippedBoardTextureSizes` in texelDensity.ts:
 * non-royal roles use the pawn ladder; queen and king skip 256.
 */

export const PIECE_STEMS = [
  'b_pion',
  'b_tour',
  'b_cavalier',
  'b_fou',
  'b_reine',
  'b_roi',
  'n_pion',
  'n_tour',
  'n_cavalier',
  'n_fou',
  'n_reine',
  'n_roi',
];

/** Stems that ship a 2048 bake (queen and king, both colours). */
export const ROYAL_PIECE_STEMS = ['b_reine', 'b_roi', 'n_reine', 'n_roi'];

const ROYAL = new Set(ROYAL_PIECE_STEMS);

/** Pawn / rook / knight / bishop across Fluide → Qualité. */
export const PAWN_LADDER_SIZES = [256, 512, 1024];

/** Queen / king across Fluide → Qualité (one step above the pawn). */
export const ROYAL_LADDER_SIZES = [512, 1024, 2048];

export const BOARD_BAKE_SIZES = [512, 1024, 2048];

/**
 * Bake sizes for one piece stem.
 * @param {string} stem
 * @returns {number[]}
 */
export function pieceBakeSizes(stem) {
  return ROYAL.has(stem) ? [...ROYAL_LADDER_SIZES] : [...PAWN_LADDER_SIZES];
}
