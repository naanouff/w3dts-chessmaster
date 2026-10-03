/**
 * @file Vertex shader for rendering a cube's geometry to generate a cubemap.
 * The cube faces are rendered with an inverted winding order (cullMode: 'front')
 * so that the faces are visible from the inside.
 * @author Cyril Tarriet
 */

/**
 * Data structure for uniforms.
 */
struct Uniforms {
  /** The view-projection matrix, used for the final transformation. */
  viewProjectionMatrix: mat4x4<f32>,
};

/**
 * Bind group 0 contains the uniforms.
 * @group(0) @binding(0)
 */
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

/**
 * The output structure of the vertex shader.
 */
struct VertexOutput {
  /** The vertex position in clip space. */
  @builtin(position) position: vec4<f32>,
  /** The vertex position in local space, passed to the fragment shader. */
  @location(0) local_pos: vec3<f32>,
};

/**
 * The main entry point for the vertex shader.
 * It uses hard-coded vertex positions to draw a cube without needing a vertex buffer.
 * @param vertexIndex The index of the vertex.
 * @returns The output structure.
 */
@vertex
fn main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
    // Hard-coded vertex positions for a cube. The order is adjusted for front-face culling.
    let pos = array<vec3<f32>, 36>(
        // +X face
        vec3(1.0, 1.0, -1.0), vec3(1.0, -1.0, -1.0), vec3(1.0, -1.0, 1.0),
        vec3(1.0, 1.0, 1.0), vec3(1.0, 1.0, -1.0), vec3(1.0, -1.0, 1.0),
        // -X face
        vec3(-1.0, 1.0, 1.0), vec3(-1.0, -1.0, 1.0), vec3(-1.0, -1.0, -1.0),
        vec3(-1.0, 1.0, -1.0), vec3(-1.0, 1.0, 1.0), vec3(-1.0, -1.0, -1.0),
        // +Y face
        vec3(1.0, 1.0, 1.0), vec3(1.0, 1.0, -1.0), vec3(-1.0, 1.0, -1.0),
        vec3(-1.0, 1.0, 1.0), vec3(1.0, 1.0, 1.0), vec3(-1.0, 1.0, -1.0),
        // -Y face
        vec3(-1.0, -1.0, 1.0), vec3(-1.0, -1.0, -1.0), vec3(1.0, -1.0, -1.0),
        vec3(1.0, -1.0, 1.0), vec3(-1.0, -1.0, 1.0), vec3(1.0, -1.0, -1.0),
        // +Z face
        vec3(-1.0, 1.0, 1.0), vec3(-1.0, -1.0, 1.0), vec3(1.0, -1.0, 1.0),
        vec3(1.0, 1.0, 1.0), vec3(-1.0, 1.0, 1.0), vec3(1.0, -1.0, 1.0),
        // -Z face
        vec3(1.0, 1.0, -1.0), vec3(1.0, -1.0, -1.0), vec3(-1.0, -1.0, -1.0),
        vec3(-1.0, 1.0, -1.0), vec3(1.0, 1.0, -1.0), vec3(-1.0, -1.0, -1.0)
    );

    let p = pos[vertexIndex];
    var output: VertexOutput;
    // The position is transformed into clip space.
    output.position = uniforms.viewProjectionMatrix * vec4<f32>(p, 1.0);
    // The local position is passed directly to the fragment shader to be used as a direction vector.
    output.local_pos = p;
    return output;
}
