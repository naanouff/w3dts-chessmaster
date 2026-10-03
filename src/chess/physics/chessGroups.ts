/**
 * @file chessGroups.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description Collision groups for the chess table and pieces.
 */

export const CHESS_GROUP_BOARD = 0x0001;
export const CHESS_GROUP_PIECE = 0x0002;
export const CHESS_MASK_BOARD = CHESS_GROUP_PIECE;
export const CHESS_MASK_PIECE = CHESS_GROUP_BOARD | CHESS_GROUP_PIECE;
/** No contacts while held — a 40 g dynamic weld vs the board ejects the piece. */
export const CHESS_MASK_PIECE_GRABBED = 0;
