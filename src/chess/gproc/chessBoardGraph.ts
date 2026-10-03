/**
 * @file chessBoardGraph.ts
 * @project w3dts
 * @description GPROC graph for the chamfered chess board slab (CHESS-B4a).
 */

import type { GProcGraph } from '@naanouff/w3dts-gproc';
import {
  CHESS_BOARD_BEVEL_M,
  CHESS_BOARD_BODY_HEIGHT,
  CHESS_BOARD_MESH_EXTENT,
} from '../board/chessBoard';

/** Parametric Staunton board body: ExtentXz + Height + Bevel → PrimitiveChamferedBox. */
export function createChessBoardGraph(): GProcGraph {
  return {
    id: 'chess_board',
    version: 1,
    metadata: {
      category: 'prop',
      subcategory: 'chess',
    },
    parameters: {
      ExtentXz: { type: 'float', value: CHESS_BOARD_MESH_EXTENT },
      Height: { type: 'float', value: CHESS_BOARD_BODY_HEIGHT },
      Bevel: { type: 'float', value: CHESS_BOARD_BEVEL_M },
    },
    nodes: [
      {
        id: 'in',
        type: 'GroupInput',
        position: { x: 40, y: 80 },
        inputs: [],
        outputs: [
          { id: 'extentXz', name: 'ExtentXz', type: 'float' },
          { id: 'height', name: 'Height', type: 'float' },
          { id: 'bevel', name: 'Bevel', type: 'float' },
        ],
        properties: {
          ExtentXz: CHESS_BOARD_MESH_EXTENT,
          Height: CHESS_BOARD_BODY_HEIGHT,
          Bevel: CHESS_BOARD_BEVEL_M,
        },
      },
      {
        id: 'bevel2',
        type: 'Math',
        position: { x: 280, y: 200 },
        inputs: [
          { id: 'a', name: 'a', type: 'float' },
          { id: 'b', name: 'b', type: 'float' },
        ],
        outputs: [{ id: 'value', name: 'value', type: 'float' }],
        properties: { operation: 'MUL', a: 0, b: 2 },
      },
      {
        id: 'outer',
        type: 'Math',
        position: { x: 480, y: 80 },
        inputs: [
          { id: 'a', name: 'a', type: 'float' },
          { id: 'b', name: 'b', type: 'float' },
        ],
        outputs: [{ id: 'value', name: 'value', type: 'float' }],
        properties: { operation: 'ADD', a: 0, b: 0 },
      },
      {
        id: 'size',
        type: 'CombineVector',
        position: { x: 680, y: 80 },
        inputs: [
          { id: 'x', name: 'x', type: 'float' },
          { id: 'y', name: 'y', type: 'float' },
          { id: 'z', name: 'z', type: 'float' },
        ],
        outputs: [{ id: 'vector', name: 'vector', type: 'vec3' }],
        properties: { x: 0, y: 0, z: 0 },
      },
      {
        id: 'box',
        type: 'PrimitiveChamferedBox',
        position: { x: 900, y: 80 },
        inputs: [
          { id: 'size', name: 'size', type: 'vec3' },
          { id: 'center', name: 'center', type: 'vec3' },
          { id: 'bevel', name: 'bevel', type: 'float' },
        ],
        outputs: [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
        properties: {
          size: [
            CHESS_BOARD_MESH_EXTENT + 2 * CHESS_BOARD_BEVEL_M,
            CHESS_BOARD_BODY_HEIGHT,
            CHESS_BOARD_MESH_EXTENT + 2 * CHESS_BOARD_BEVEL_M,
          ],
          center: [0, 0, 0],
          bevel: CHESS_BOARD_BEVEL_M,
        },
      },
      {
        id: 'bake',
        type: 'BakeMeshMaps',
        position: { x: 1140, y: 80 },
        inputs: [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
        outputs: [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
        properties: {
          bakeCurvature: true,
          bakeAO: true,
          bakeHeight: true,
          curvatureContrast: 2.8,
          aoRadius: 0.04,
          aoSamples: 8,
          heightScale: 1,
        },
      },
      {
        id: 'out',
        type: 'GroupOutput',
        position: { x: 1380, y: 80 },
        inputs: [{ id: 'geo_in', name: 'geometry', type: 'geometry' }],
        outputs: [],
      },
    ],
    links: [
      {
        id: 'l_bevel',
        fromNodeId: 'in',
        fromSocketId: 'bevel',
        toNodeId: 'bevel2',
        toSocketId: 'a',
      },
      {
        id: 'l_extent',
        fromNodeId: 'in',
        fromSocketId: 'extentXz',
        toNodeId: 'outer',
        toSocketId: 'a',
      },
      {
        id: 'l_bevel2',
        fromNodeId: 'bevel2',
        fromSocketId: 'value',
        toNodeId: 'outer',
        toSocketId: 'b',
      },
      {
        id: 'l_outer_x',
        fromNodeId: 'outer',
        fromSocketId: 'value',
        toNodeId: 'size',
        toSocketId: 'x',
      },
      {
        id: 'l_height',
        fromNodeId: 'in',
        fromSocketId: 'height',
        toNodeId: 'size',
        toSocketId: 'y',
      },
      {
        id: 'l_outer_z',
        fromNodeId: 'outer',
        fromSocketId: 'value',
        toNodeId: 'size',
        toSocketId: 'z',
      },
      {
        id: 'l_size',
        fromNodeId: 'size',
        fromSocketId: 'vector',
        toNodeId: 'box',
        toSocketId: 'size',
      },
      {
        id: 'l_box_bevel',
        fromNodeId: 'in',
        fromSocketId: 'bevel',
        toNodeId: 'box',
        toSocketId: 'bevel',
      },
      {
        id: 'l_bake',
        fromNodeId: 'box',
        fromSocketId: 'geometry',
        toNodeId: 'bake',
        toSocketId: 'geometry',
      },
      {
        id: 'l_out',
        fromNodeId: 'bake',
        fromSocketId: 'geometry',
        toNodeId: 'out',
        toSocketId: 'geo_in',
      },
    ],
  };
}
