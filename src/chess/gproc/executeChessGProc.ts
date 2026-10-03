/**
 * @file executeChessGProc.ts
 * @project w3dts
 * @description Bake a GPROC graph to an engine Mesh (stride 20).
 */

import { Mesh } from '@naanouff/w3dts-core';
import {
  bakeMeshMapsOnGeometrySet,
  bootstrapGProcRuntime,
  engineMeshToPreviewBuffers,
  geometrySetToEngineMesh,
  GProcExecutor,
  meshToGeometrySet,
  type GProcGraph,
} from '@naanouff/w3dts-gproc';

let bootstrapped = false;

function ensureGProcRuntime(): void {
  if (bootstrapped) return;
  bootstrapGProcRuntime({ initCsg: false });
  bootstrapped = true;
}

/** Execute `graph` and convert the first sub-mesh to a CPU `Mesh`. */
export function executeChessGProcToMesh(
  graph: GProcGraph,
  parameters: Record<string, unknown>,
  name: string
): Mesh {
  ensureGProcRuntime();
  const result = GProcExecutor.executeDetailed(graph, parameters);
  if (!result.ok || !result.geometry) {
    const detail = result.errors.map((err) => err.message).join('; ') || 'no geometry';
    throw new Error(`GPROC ${graph.id}: ${detail}`);
  }
  const engine = geometrySetToEngineMesh(result.geometry, 1);
  const buffers = engine ? engineMeshToPreviewBuffers(engine) : null;
  if (!buffers) {
    throw new Error(`GPROC ${graph.id}: empty engine mesh`);
  }
  return new Mesh(buffers.vertices, buffers.indices, name);
}

/** Bake concavity / AO / height into vertex color (CPU path; graphs use BakeMeshMaps). */
export function bakeChessMeshMaps(mesh: Mesh, aoRadius = 0.012): Mesh {
  ensureGProcRuntime();
  const geo = meshToGeometrySet(mesh);
  if (!geo) return mesh;
  const baked = bakeMeshMapsOnGeometrySet(geo, {
    aoRadius,
    aoSamples: 8,
    curvatureContrast: 3.2,
    bakeCurvature: true,
    bakeAO: true,
    bakeHeight: true,
  });
  const engine = geometrySetToEngineMesh(baked, 1);
  const buffers = engine ? engineMeshToPreviewBuffers(engine) : null;
  if (!buffers) return mesh;
  return new Mesh(buffers.vertices, buffers.indices, mesh.name);
}
