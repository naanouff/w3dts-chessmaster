/**
 * @file Fragment shader to convert an equirectangular texture into a cubemap.
 * It uses the interpolated fragment position to calculate the UV coordinates
 * of the equirectangular image and sample the color.
 * @author Cyril Tarriet
 */

/**
 * The source equirectangular texture.
 * @group(0) @binding(1)
 */
@group(0) @binding(1) var equirectMap: texture_2d<f32>;
/**
 * The sampler for the equirectangular texture.
 * @group(0) @binding(2)
 */
@group(0) @binding(2) var mapSampler: sampler;

/**
 * The input structure for the fragment shader.
 */
struct FragmentInput {
  /** The fragment's position in local space, used as a direction vector from the cube's center. */
  @location(0) local_pos: vec3<f32>,
};

/** The value of PI. */
const PI = 3.14159265359;
/** The inverse of PI. */
const INV_PI = 1.0 / PI;
/** The inverse of 2 * PI. */
const INV_2PI = 1.0 / (2.0 * PI);

/**
 * The main entry point for the fragment shader.
 * @param input The interpolated input structure from the vertex shader.
 * @returns The output color of the fragment.
 */
@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let dir = normalize(input.local_pos);
    
    // Convert 3D direction to 2D spherical coordinates
    let u = 0.5 + atan2(dir.z, dir.x) * INV_2PI;
    let v = acos(dir.y) * INV_PI;
    
    // --- CORRECTION : Inversion de l'axe V ---
    // Pour corriger l'orientation (Sol en bas, Ciel en haut)
    let final_uv = vec2<f32>(u, v); 
    // ----------------------------------------
    
    // Sample the equirectangular texture
    return textureSampleLevel(equirectMap, mapSampler, final_uv, 0.0);
}
