/**
 * @file Vertex shader for rendering debug lines.
 * It transforms the position and color of each line vertex
 * into clip space, using the camera's matrices.
 * @author Cyril Tarriet
 */

#include "../shared/structs.wgsl"

/**
 * Bind group 0 contains the frame uniforms, shared
 * across all render passes.
 * @group(0) @binding(0)
 */
@group(0) @binding(0) var<uniform> frame: FrameUniforms;

/**
 * The input structure for the vertex shader.
 * @location(0) position The vertex position in local (world) space.
 * @location(1) color The vertex color.
 */
struct LineVertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec4<f32>,
};

/**
 * The output structure of the vertex shader.
 * @builtin(position) clip_position The vertex position in clip space.
 * @location(0) frag_color The vertex color to be interpolated.
 */
struct LineVertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) frag_color: vec4<f32>,
};

/**
 * The main entry point for the vertex shader.
 * @param input The input vertex data.
 * @returns The output structure.
 */
@vertex
fn main(input: LineVertexInput) -> LineVertexOutput {
    var output: LineVertexOutput;
    
    // Calculate the clip space position by applying the view and projection matrices.
    output.clip_position = frame.projectionMatrix * frame.viewMatrix * vec4<f32>(input.position, 1.0);
    // Pass the color through to the fragment stage.
    output.frag_color = input.color;
    return output;
}
