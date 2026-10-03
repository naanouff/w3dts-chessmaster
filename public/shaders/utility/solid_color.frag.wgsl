/**
 * @file solid_color.frag.wgsl
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2025-10-14
 * @description Un fragment shader minimaliste qui retourne une couleur blanche opaque.
 * Utilisé pour générer des masques de rendu.
 */

@fragment
fn main() -> @location(0) vec4<f32> {
    // Retourne simplement la couleur blanche.
    return vec4<f32>(1.0, 1.0, 1.0, 1.0);
}