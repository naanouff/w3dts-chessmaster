/**
 * @file solid_color.vert.wgsl
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2025-10-14
 * @description Vertex shader minimaliste pour les passes de rendu de couleur unie.
 * Il transforme simplement les sommets de l'objet dans l'espace de la caméra.
 */

#include "../shared/structs.wgsl"

// @group(0) est lié une fois par passe (contient les matrices de la caméra)
@group(0) @binding(0) var<uniform> frame: FrameUniforms;

// @group(1) sera lié par objet (avec un dynamic offset)
struct ObjectUniforms {
    modelMatrix: mat4x4<f32>,
};
@group(1) @binding(0) var<uniform> object: ObjectUniforms;

@vertex
fn main(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
    // Calcule la position finale du sommet dans l'espace de l'écran (clip space)
    return frame.projectionMatrix * frame.viewMatrix * object.modelMatrix * vec4<f32>(position, 1.0);
}