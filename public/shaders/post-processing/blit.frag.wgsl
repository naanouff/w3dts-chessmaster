/**
 * @file Fragment shader for a "blit" (texture copy) operation.
 * It samples an input texture and directly returns its value.
 * @author Cyril Tarriet
 */

/**
 * Bind group 0 contains the sampler and the input texture.
 * @group(0) @binding(0)
 */
@group(0) @binding(0) var s: sampler;
/**
 * The 2D texture to be copied.
 * @group(0) @binding(1)
 */
@group(0) @binding(1) var t: texture_2d<f32>;

/**
 * The main entry point for the fragment shader.
 * @param uv The UV coordinates of the fragment.
 * @returns The output color of the fragment.
 */
@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Samples the input texture at the given UV coordinates and returns the result.
    return textureSample(t, s, uv);
}
