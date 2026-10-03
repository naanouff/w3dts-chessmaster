/**
 * @file Vertex shader for rendering a screen-covering triangle, commonly used
 * in post-processing passes.
 * @author Cyril Tarriet
 */

/**
 * The output structure of the vertex shader.
 */
struct VertexOutput {
    /** The vertex position in clip space. */
    @builtin(position) position: vec4<f32>,
    /** The UV coordinates of the vertex. */
    @location(0) uv: vec2<f32>,
};

/**
 * The main entry point for the vertex shader.
 * It requires no vertex buffer input, as the coordinates are
 * hard-coded to create a fullscreen triangle.
 * @param vertexIndex The index of the current vertex (`0`, `1`, or `2`).
 * @returns The output structure.
 */
@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    // Vertex position coordinates to create a screen-covering triangle.
    let pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0)
    );
    // Corresponding UV coordinates. The Y-axis is flipped to match
    // the WebGPU convention where the texture origin is at the top-left.
    let uv = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 1.0),
        vec2<f32>(2.0, 1.0),
        vec2<f32>(0.0, -1.0)
    );

    var output: VertexOutput;
    output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
    output.uv = uv[vertexIndex];
    return output;
}
