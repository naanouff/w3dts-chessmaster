/**
 * @file Utility shader for visualizing the contents of a depth texture.
 * It renders the depth value as a grayscale value, which is
 * particularly useful for debugging passes like the shadow map.
 * @author Cyril Tarriet
 */

/**
 * Bind group 0 contains the depth texture to be visualized.
 * @group(0) @binding(0)
 */
@group(0) @binding(0) var depthTexture: texture_depth_2d;

/**
 * The vertex shader draws a fullscreen triangle to cover the entire canvas.
 * @param i The vertex index.
 * @returns The vertex position in clip space.
 */
@vertex
fn vs_main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 3>(vec2(-1,-1), vec2(3,-1), vec2(-1, 3));
    return vec4<f32>(pos[i], 0.0, 1.0);
}

/**
 * The fragment shader reads the depth value of each pixel and returns it
 * as a grayscale color.
 * @param frag_coord The fragment's coordinates.
 * @returns The output color in RGBA.
 */
@fragment
fn fs_main(@builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4<f32> {
    // We load the depth value directly from the texture without a sampler,
    // using the integer coordinates of the fragment.
    let depth_value = textureLoad(
        depthTexture,
        vec2<i32>(floor(frag_coord.xy)),
        0
    );
    
    // We return the depth value for each color channel to produce a grayscale image.
    return vec4<f32>(depth_value, depth_value, depth_value, 1.0);
}
