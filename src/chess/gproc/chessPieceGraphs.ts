/**
 * @file chessPieceGraphs.ts
 * @project w3dts
 * @description GPROC Staunton graphs: lathe pieces (B4b) + knight extrusion (B4c).
 */

import type { GProcGraph, GProcLink, GProcNodeData } from '@naanouff/w3dts-gproc';
import type { ChessPieceRole } from '../rules/chessTypes';
import {
  knightSilhouettePoints,
  latheCurvePoints,
  STAUNTON_BISHOP_PROFILE,
  STAUNTON_KING_PROFILE,
  STAUNTON_KNIGHT_PEDESTAL,
  STAUNTON_LATHE_SEGMENTS,
  STAUNTON_PAWN_PROFILE,
  STAUNTON_QUEEN_PROFILE,
  STAUNTON_ROOK_PROFILE,
} from '../geometry/stauntonProfiles';

/** Full X thickness of the horse head (matches TS `addExtrudedYz` halfThickness 0.011). */
export const CHESS_KNIGHT_HEAD_THICKNESS = 0.022;

export type ChessLatheRole = Exclude<ChessPieceRole, 'knight'>;

type CubeSpec = { size: [number, number, number]; center: [number, number, number] };

function node(
  id: string,
  type: string,
  x: number,
  y: number,
  rest: Pick<GProcNodeData, 'inputs' | 'outputs' | 'properties'>
): GProcNodeData {
  return { id, type, position: { x, y }, ...rest };
}

function link(id: string, from: string, fs: string, to: string, ts: string): GProcLink {
  return { id, fromNodeId: from, fromSocketId: fs, toNodeId: to, toSocketId: ts };
}

function geoOut(): GProcNodeData['outputs'] {
  return [{ id: 'geometry', name: 'geometry', type: 'geometry' }];
}

function profileFor(role: ChessLatheRole): Array<[number, number]> {
  switch (role) {
    case 'pawn':
      return STAUNTON_PAWN_PROFILE;
    case 'rook':
      return STAUNTON_ROOK_PROFILE;
    case 'bishop':
      return STAUNTON_BISHOP_PROFILE;
    case 'queen':
      return STAUNTON_QUEEN_PROFILE;
    case 'king':
      return STAUNTON_KING_PROFILE;
  }
}

function detailCubes(role: ChessLatheRole): CubeSpec[] {
  switch (role) {
    case 'pawn':
      return [];
    case 'rook': {
      const merlon = 0.012;
      const merlonH = 0.012;
      const r = 0.015;
      return [
        { size: [merlon, merlonH, merlon], center: [r, 0.054, 0] },
        { size: [merlon, merlonH, merlon], center: [-r, 0.054, 0] },
        { size: [merlon, merlonH, merlon], center: [0, 0.054, r] },
        { size: [merlon, merlonH, merlon], center: [0, 0.054, -r] },
      ];
    }
    case 'bishop':
      return [{ size: [0.003, 0.02, 0.02], center: [0, 0.05, 0] }];
    case 'queen': {
      const n = 8;
      const beads: CubeSpec[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        beads.push({
          size: [0.004, 0.012, 0.004],
          center: [Math.cos(a) * 0.011, 0.072, Math.sin(a) * 0.011],
        });
      }
      return beads;
    }
    case 'king':
      return [
        { size: [0.004, 0.02, 0.004], center: [0, 0.082, 0] },
        { size: [0.016, 0.004, 0.004], center: [0, 0.086, 0] },
      ];
  }
}

export function isChessLatheRole(role: ChessPieceRole): role is ChessLatheRole {
  return role !== 'knight';
}

/** Parametric Staunton lathe piece. GroupInput `Scale` (default 1). */
export function createChessPieceGraph(role: ChessLatheRole): GProcGraph {
  const cubes = detailCubes(role);
  const nodes: GProcNodeData[] = [
    node('in', 'GroupInput', 40, 80, {
      inputs: [],
      outputs: [{ id: 'scale', name: 'Scale', type: 'float' }],
      properties: { Scale: 1 },
    }),
    node('poly', 'PrimitivePolyline', 280, 80, {
      inputs: [],
      outputs: geoOut(),
      properties: { points: latheCurvePoints(profileFor(role)) },
    }),
    node('lathe', 'Lathe', 520, 80, {
      inputs: [{ id: 'curve', name: 'curve', type: 'geometry' }],
      outputs: geoOut(),
      properties: {
        segments: STAUNTON_LATHE_SEGMENTS,
        axis: [0, 1, 0],
        origin: [0, 0, 0],
        startAngle: 0,
        endAngle: Math.PI * 2,
        fillCaps: true,
      },
    }),
  ];
  const links: GProcLink[] = [link('l_poly', 'poly', 'geometry', 'lathe', 'curve')];

  cubes.forEach((cube, i) => {
    const id = `cube${i}`;
    nodes.push(
      node(id, 'PrimitiveCube', 520, 200 + i * 80, {
        inputs: [],
        outputs: geoOut(),
        properties: { size: cube.size, center: cube.center },
      })
    );
  });

  let bodyId = 'lathe';
  if (cubes.length > 0) {
    const joinInputs = [
      { id: 'g0', name: 'g0', type: 'geometry' as const },
      ...cubes.map((_, i) => ({
        id: `g${i + 1}`,
        name: `g${i + 1}`,
        type: 'geometry' as const,
      })),
    ];
    nodes.push(
      node('join', 'JoinGeometry', 760, 80, {
        inputs: joinInputs,
        outputs: geoOut(),
        properties: {},
      })
    );
    links.push(link('l_join0', 'lathe', 'geometry', 'join', 'g0'));
    cubes.forEach((_, i) => {
      links.push(link(`l_join${i + 1}`, `cube${i}`, 'geometry', 'join', `g${i + 1}`));
    });
    bodyId = 'join';
  }

  nodes.push(
    node('shade', 'SetShadeSmooth', 1000, 80, {
      inputs: [
        { id: 'geo', name: 'geometry', type: 'geometry' },
        { id: 'angle', name: 'angle', type: 'float' },
      ],
      outputs: geoOut(),
      properties: { angle: 60 },
    }),
    node('bake', 'BakeMeshMaps', 1120, 80, {
      inputs: [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
      outputs: geoOut(),
      properties: {
        bakeCurvature: true,
        bakeAO: true,
        bakeHeight: true,
        curvatureContrast: 3.2,
        aoRadius: 0.012,
        aoSamples: 8,
        heightScale: 1,
      },
    }),
    node('scale3', 'CombineVector', 280, 240, {
      inputs: [
        { id: 'x', name: 'x', type: 'float' },
        { id: 'y', name: 'y', type: 'float' },
        { id: 'z', name: 'z', type: 'float' },
      ],
      outputs: [{ id: 'vector', name: 'vector', type: 'vec3' }],
      properties: { x: 1, y: 1, z: 1 },
    }),
    node('xform', 'TransformGeometry', 1360, 80, {
      inputs: [
        { id: 'geo', name: 'geometry', type: 'geometry' },
        { id: 't', name: 'translation', type: 'vec3' },
        { id: 'r', name: 'rotation', type: 'vec3' },
        { id: 's', name: 'scale', type: 'vec3' },
      ],
      outputs: geoOut(),
      properties: { translation: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    }),
    node('out', 'GroupOutput', 1600, 80, {
      inputs: [{ id: 'geo_in', name: 'geometry', type: 'geometry' }],
      outputs: [],
    })
  );

  links.push(
    link('l_shade', bodyId, 'geometry', 'shade', 'geo'),
    link('l_bake', 'shade', 'geometry', 'bake', 'geometry'),
    link('l_sx', 'in', 'scale', 'scale3', 'x'),
    link('l_sy', 'in', 'scale', 'scale3', 'y'),
    link('l_sz', 'in', 'scale', 'scale3', 'z'),
    link('l_xf_geo', 'bake', 'geometry', 'xform', 'geo'),
    link('l_xf_s', 'scale3', 'vector', 'xform', 's'),
    link('l_out', 'xform', 'geometry', 'out', 'geo_in')
  );

  return {
    id: `chess_${role}`,
    version: 1,
    metadata: { category: 'prop', subcategory: 'chess' },
    parameters: { Scale: { type: 'float', value: 1 } },
    nodes,
    links,
  };
}

const KNIGHT_EAR_SIZE: [number, number, number] = [0.007, 0.014, 0.007];
const KNIGHT_EARS: Array<[number, number, number]> = [
  [0.005, 0.058, 0],
  [-0.005, 0.058, 0],
];

/** Pedestal lathe + filled YZ silhouette → ExtrudeMesh + ear cubes (CHESS-B4c). */
export function createChessKnightGraph(): GProcGraph {
  const half = CHESS_KNIGHT_HEAD_THICKNESS / 2;
  const nodes: GProcNodeData[] = [
    node('in', 'GroupInput', 40, 80, {
      inputs: [],
      outputs: [{ id: 'scale', name: 'Scale', type: 'float' }],
      properties: { Scale: 1 },
    }),
    node('pedestal', 'PrimitivePolyline', 280, 40, {
      inputs: [],
      outputs: geoOut(),
      properties: { points: latheCurvePoints(STAUNTON_KNIGHT_PEDESTAL) },
    }),
    node('lathe', 'Lathe', 520, 40, {
      inputs: [{ id: 'curve', name: 'curve', type: 'geometry' }],
      outputs: geoOut(),
      properties: {
        segments: STAUNTON_LATHE_SEGMENTS,
        axis: [0, 1, 0],
        origin: [0, 0, 0],
        startAngle: 0,
        endAngle: Math.PI * 2,
        fillCaps: true,
      },
    }),
    node('silhouette', 'PrimitivePolyline', 280, 220, {
      inputs: [],
      outputs: geoOut(),
      properties: { points: knightSilhouettePoints(), fill: true },
    }),
    node('extrude', 'ExtrudeMesh', 520, 220, {
      inputs: [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
      outputs: geoOut(),
      properties: { offset: CHESS_KNIGHT_HEAD_THICKNESS, scale: 1 },
    }),
    node('center', 'TransformGeometry', 760, 220, {
      inputs: [
        { id: 'geo', name: 'geometry', type: 'geometry' },
        { id: 't', name: 'translation', type: 'vec3' },
        { id: 'r', name: 'rotation', type: 'vec3' },
        { id: 's', name: 'scale', type: 'vec3' },
      ],
      outputs: geoOut(),
      properties: { translation: [-half, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    }),
  ];
  const links: GProcLink[] = [
    link('l_ped', 'pedestal', 'geometry', 'lathe', 'curve'),
    link('l_sil', 'silhouette', 'geometry', 'extrude', 'geometry'),
    link('l_ctr', 'extrude', 'geometry', 'center', 'geo'),
  ];

  KNIGHT_EARS.forEach((center, i) => {
    const id = `ear${i}`;
    nodes.push(
      node(id, 'PrimitiveCube', 520, 360 + i * 80, {
        inputs: [],
        outputs: geoOut(),
        properties: { size: KNIGHT_EAR_SIZE, center },
      })
    );
  });

  nodes.push(
    node('join', 'JoinGeometry', 1000, 80, {
      inputs: [
        { id: 'g0', name: 'g0', type: 'geometry' },
        { id: 'g1', name: 'g1', type: 'geometry' },
        { id: 'g2', name: 'g2', type: 'geometry' },
        { id: 'g3', name: 'g3', type: 'geometry' },
      ],
      outputs: geoOut(),
      properties: {},
    }),
    node('shade', 'SetShadeSmooth', 1240, 80, {
      inputs: [
        { id: 'geo', name: 'geometry', type: 'geometry' },
        { id: 'angle', name: 'angle', type: 'float' },
      ],
      outputs: geoOut(),
      properties: { angle: 60 },
    }),
    node('bake', 'BakeMeshMaps', 1360, 80, {
      inputs: [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
      outputs: geoOut(),
      properties: {
        bakeCurvature: true,
        bakeAO: true,
        bakeHeight: true,
        curvatureContrast: 3.2,
        aoRadius: 0.012,
        aoSamples: 8,
        heightScale: 1,
      },
    }),
    node('scale3', 'CombineVector', 280, 400, {
      inputs: [
        { id: 'x', name: 'x', type: 'float' },
        { id: 'y', name: 'y', type: 'float' },
        { id: 'z', name: 'z', type: 'float' },
      ],
      outputs: [{ id: 'vector', name: 'vector', type: 'vec3' }],
      properties: { x: 1, y: 1, z: 1 },
    }),
    node('xform', 'TransformGeometry', 1600, 80, {
      inputs: [
        { id: 'geo', name: 'geometry', type: 'geometry' },
        { id: 't', name: 'translation', type: 'vec3' },
        { id: 'r', name: 'rotation', type: 'vec3' },
        { id: 's', name: 'scale', type: 'vec3' },
      ],
      outputs: geoOut(),
      properties: { translation: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    }),
    node('out', 'GroupOutput', 1840, 80, {
      inputs: [{ id: 'geo_in', name: 'geometry', type: 'geometry' }],
      outputs: [],
    })
  );

  links.push(
    link('l_join0', 'lathe', 'geometry', 'join', 'g0'),
    link('l_join1', 'center', 'geometry', 'join', 'g1'),
    link('l_join2', 'ear0', 'geometry', 'join', 'g2'),
    link('l_join3', 'ear1', 'geometry', 'join', 'g3'),
    link('l_shade', 'join', 'geometry', 'shade', 'geo'),
    link('l_bake', 'shade', 'geometry', 'bake', 'geometry'),
    link('l_sx', 'in', 'scale', 'scale3', 'x'),
    link('l_sy', 'in', 'scale', 'scale3', 'y'),
    link('l_sz', 'in', 'scale', 'scale3', 'z'),
    link('l_xf_geo', 'bake', 'geometry', 'xform', 'geo'),
    link('l_xf_s', 'scale3', 'vector', 'xform', 's'),
    link('l_out', 'xform', 'geometry', 'out', 'geo_in')
  );

  return {
    id: 'chess_knight',
    version: 1,
    metadata: { category: 'prop', subcategory: 'chess' },
    parameters: { Scale: { type: 'float', value: 1 } },
    nodes,
    links,
  };
}
