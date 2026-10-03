/**
 * @file Fragment shader for rendering debug lines.
 * This shader receives the color of each vertex and outputs it directly,
 * without lighting calculations or other complex effects.
 * @author Cyril Tarriet
 */

/**
 * The input structure for the fragment shader,
 * containing the interpolated color for the current fragment.
 */
struct FragmentInput {
    /** The interpolated color from the vertex shader. */
    @location(0) frag_color: vec4<f32>,
};

/**
 * The main entry point for the fragment shader.
 * @param input The interpolated input structure.
 * @returns The final color of the fragment.
 */
@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    // Simply return the interpolated color received from the vertex shader.
    return input.frag_color;
}
