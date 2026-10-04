/**
 * @file index.ts
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-26
 * @description Public exports for @naanouff/w3dts-chess.
 */

export { ChessMatch } from './rules/ChessMatch';
export type { IChessEngine, ChessEngineMove } from './rules/IChessEngine';
export { HeuristicChessEngine } from './rules/HeuristicChessEngine';
export type { HeuristicChessEngineOptions } from './rules/HeuristicChessEngine';
export {
  encodeChessWire,
  decodeChessWire,
  chessPlyFromFen,
  decideChessFenSync,
} from './net/chessWire';
export type { ChessWireMessage, ChessFenSyncDecision } from './net/chessWire';
export {
  parseChessDemoQuery,
  cpuSearchDepth,
  formatChessClock,
  parseChessDemoSession,
  mergeChessDemoQueryIntoSearch,
  chessDemoQueryToParams,
  replaceChessDemoQueryInLocation,
} from './play/parseChessDemoQuery';
export { CHESS_CLOCK_START_S, clocksFromWire, stepChessClock } from './play/chessClock';
export type { ChessClocks, ClockGate } from './play/chessClock';
export {
  VOLUNTARY_SAVE_LIMIT,
  acceptSavedGame,
  emptySaveCabinet,
  parseSaveCabinet,
  putInterrupt,
  putVoluntary,
} from './play/savedGames';
export type { SaveCabinet, SavedGame, SavedShellMode } from './play/savedGames';
export type { ChessPlayMode, ChessDemoQuery } from './play/parseChessDemoQuery';
export {
  CHESS_HUD_STATE_EVENT,
  CHESS_HUD_COMMAND_EVENT,
  buildChessHudLearnPlies,
  chessPlayP2pHint,
  normalizeChessHudP2pStatus,
  parseChessHudState,
  parseChessHudCommand,
  stripChessSanSuffix,
} from './play/chessHudState';
export type {
  ChessHudCommand,
  ChessHudLearnState,
  ChessHudPlayMode,
  ChessHudPlayState,
  ChessHudP2pStatus,
  ChessHudSanPly,
  ChessHudSanStatus,
  ChessHudState,
} from './play/chessHudState';
export { ECO_OPENINGS, findEcoOpeningIndex, openingSlug } from './learn/ecoOpenings';
export type { EcoOpening } from './learn/ecoOpenings';
export { OpeningTrainer, resolveEcoLine } from './learn/OpeningTrainer';
export type { BookPly } from './learn/OpeningTrainer';
export type {
  ChessCastleDelta,
  ChessColor,
  ChessFile,
  ChessMoveFailReason,
  ChessMoveFailure,
  ChessMoveResult,
  ChessMoveSuccess,
  ChessPieceOnSquare,
  ChessPieceRole,
  ChessRank,
  ChessSquareName,
} from './rules/chessTypes';
export {
  CHESS_BOARD_BEVEL_M,
  CHESS_BOARD_BODY_HEIGHT,
  CHESS_BOARD_BORDER_FRAC,
  CHESS_BOARD_EXTENT,
  CHESS_BOARD_INNER_FRAC,
  CHESS_BOARD_MESH_EXTENT,
  CHESS_BOARD_SURFACE_Y,
  CHESS_SQUARE_SIZE,
  snapWorldToSquareCenter,
  squareToWorld,
  worldToSquare,
} from './board/chessBoard';
export {
  chessBoardLabelPoses,
  chessBoardLabelQuat,
  chessBoardLabelSize,
  chessBoardRimRadius,
  chessBoardLabelPoseVec,
} from './board/fileRankLabels';
export type { ChessBoardLabelKind, ChessBoardLabelPose } from './board/fileRankLabels';
export { fillChessGlyphAlbedo, CHESS_GLYPH_TEXTURE_SIZE } from './board/fileRankGlyph';
export {
  sampleBookMoveSpline,
  bookMoveSplineLength,
  knightElbowIndices,
} from './board/bookMoveSpline';
export type { BookMoveSplinePoint, SampleBookMoveSplineOptions } from './board/bookMoveSpline';
export {
  samplePieceTravel,
  samplePieceTravelWorld,
  easeSmoothstep,
  CHESS_PIECE_TRAVEL_LIFT_Y,
} from './board/pieceTravel';
export { assignCemeterySlot, cemeterySlotIsOffBoard } from './board/cemeterySlots';
export type { CemeterySlotPose } from './board/cemeterySlots';
export { chessTableSfxForPly } from './play/chessTableSfx';
export type { ChessTableSfxId, ChessTableSfxCue } from './play/chessTableSfx';
export {
  CHESS_GROUP_BOARD,
  CHESS_GROUP_PIECE,
  CHESS_MASK_BOARD,
  CHESS_MASK_PIECE,
  CHESS_MASK_PIECE_GRABBED,
} from './physics/chessGroups';
export {
  buildStauntonPieceMesh,
  buildStauntonPawnUvMesh,
  stauntonPieceHeight,
} from './geometry/stauntonPieces';
export { applyCylindricalPieceUvs } from './geometry/cylindricalPieceUv';
export {
  CHESS_KNIGHT_HEAD_THICKNESS,
  createChessKnightGraph,
  createChessPieceGraph,
  isChessLatheRole,
} from './gproc/chessPieceGraphs';
export type { ChessLatheRole } from './gproc/chessPieceGraphs';
export { buildChessBoardBodyMesh, applyChessBoardWorldUvs } from './geometry/boardBody';
export { createChessBoardGraph } from './gproc/chessBoardGraph';
export { executeChessGProcToMesh, bakeChessMeshMaps } from './gproc/executeChessGProc';
export {
  createMarbleProceduralPBRGraph,
  createBrushedSteelProceduralPBRGraph,
  MARBLE_PBR_SHADER_ID,
  STEEL_PBR_SHADER_ID,
} from './look/chessProceduralShaderGraphs';
export { boardColliderShape, stauntonPieceColliderShapes } from './geometry/pieceColliders';
export { MeshBuilder } from './geometry/meshBuilder';
export {
  fillBoardAlbedo,
  fillEbonyAlbedo,
  fillIvoryAlbedo,
  boardAlbedoCell,
} from './look/chessAlbedo';
export type { BoardAlbedoCell } from './look/chessAlbedo';
export {
  CHESS_GRAB_DAMPING_RATIO,
  CHESS_GRAB_FREQUENCY_HZ,
  CHESS_GRAB_LIFT_M,
  clientPointToNdc,
  intersectRayHorizontalPlane,
  stepChessGrabSpring,
} from './grab/grabMath';
export {
  pickRayFromViewProjection,
  viewProjectionFromWorldTransform,
  viewProjectionLookAt,
} from './grab/pickRay';
export { MouseGrabController, type ChessGrabState } from './grab/MouseGrabController';
export { lockChessPieceTilt, seatChessPieceUpright, setChessPieceHeld } from './physics/piecePose';
export { ChessPieceComponent } from './ecs/ChessPieceComponent';
export {
  createChessSceneExtensionHandler,
  W3DTS_CHESS_EXTENSION_ID,
  type ChessSceneExtensionPayload,
  type ChessSceneExtensionHandler,
} from './scene/chessSceneExtension';
