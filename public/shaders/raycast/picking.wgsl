// /shaders/editor/picking.wgsl

#include "../shared/structs.wgsl"

// @group(0) est lié par la passe (FrameUniforms)
@group(0) @binding(0) var<uniform> frame: FrameUniforms;

// @group(1) sera lié par objet (avec dynamic offset)
struct ObjectUniforms {
    modelMatrix: mat4x4<f32>,
    entityID_vec: vec4<u32>, // On utilise un vec4u pour l'alignement mémoire (16 bytes)
};
@group(1) @binding(0) var<uniform> object: ObjectUniforms;

@vertex
fn vs_main(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
    return frame.projectionMatrix * frame.viewMatrix * object.modelMatrix * vec4<f32>(position, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4<u32> {
    // On retourne l'ID sur tous les canaux pour être sûr, mais seul le premier (R) nous intéressera.
    return object.entityID_vec;
}