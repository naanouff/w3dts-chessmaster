/**
 * @file ChessPieceComponent.ts
 * @description Scene-authored chess piece identity (square / color / role).
 */

import type { IComponent } from '@naanouff/w3dts-core';
import type { ChessColor, ChessPieceRole } from '../rules/chessTypes';

/**
 * Marks an entity as a chess piece for SceneDD / future ChessMatchSystem.
 */
export class ChessPieceComponent implements IComponent {
  public static readonly componentName = 'ChessPieceComponent';

  public color: ChessColor;
  public role: ChessPieceRole;
  /** Algebraic square e.g. `e2`, or empty when off-board / cemetery. */
  public square: string;

  constructor(color: ChessColor = 'white', role: ChessPieceRole = 'pawn', square = '') {
    this.color = color;
    this.role = role;
    this.square = square;
  }
}
