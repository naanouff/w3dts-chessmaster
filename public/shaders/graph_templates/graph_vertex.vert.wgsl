// packages/public/shaders/graph_templates/graph_vertex.vert.wgsl

#include "../shared/math_common.wgsl"

// [[UTILITY_FUNCTIONS]]

struct FrameUniforms {
    projectionMatrix: mat4x4<f32>,
    viewMatrix: mat4x4<f32>,
    inverseViewProjectionMatrix: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    @size(64) lightMatrix: mat4x4<f32>,
    lightDirection: vec3<f32>,
    lightColor: vec3<f32>,
    ambientLightIntensity: f32,
    debugViewMode: u32,
    totalTime: f32,
};

// [[VERTEX_INPUT_STRUCT]]

// --- STRUCTURE MISE À JOUR (Identique à structs.wgsl) ---
struct InstanceInput {
    @location(7) modelMatrix_r1: vec4<f32>,
    @location(8) modelMatrix_r2: vec4<f32>,
    @location(9) modelMatrix_r3: vec4<f32>,
    @location(10) modelMatrix_r4: vec4<f32>,
    
    // Inverse Model remplace Normal Matrix
    @location(11) inverseModel_r1: vec4<f32>,
    @location(12) inverseModel_r2: vec4<f32>,
    @location(13) inverseModel_r3: vec4<f32>,
    @location(14) inverseModel_r4: vec4<f32>,
    
    @location(15) color: vec4<f32>,
};

// [[SKIN_VERTEX_STRUCT]]

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) tangent_space_light_dir: vec3<f32>,
    @location(2) tangent_space_view_dir: vec3<f32>,
    @location(3) shadowPos: vec4<f32>,
    @location(4) color: vec4<f32>,
    @location(5) world_position: vec3<f32>,
    @location(6) world_normal: vec3<f32>,
    // Inverse model matrix rows (for normal transformation)
    @location(7) inverseModel_r1: vec4<f32>,
    @location(8) inverseModel_r2: vec4<f32>,
    @location(9) inverseModel_r3: vec4<f32>,
    @location(10) inverseModel_r4: vec4<f32>,
    @location(11) world_tangent: vec3<f32>,
    @location(12) world_bitangent: vec3<f32>,
    @location(13) uv1: vec2<f32>,
    @location(14) world_scale: f32,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
// [[MATERIAL_UNIFORMS_STRUCT]]
// [[TEXTURE_BINDINGS]]

// [[VERTEX_ENTRY]]
// [[GPU_SKIN_VERTEX_UNPACK]]
    let modelMatrix = mat4x4<f32>(
        instance.modelMatrix_r1, instance.modelMatrix_r2, instance.modelMatrix_r3, instance.modelMatrix_r4
    );
    
    // Locations 10–13 : le CPU envoie déjà transpose(inverse(worldMatrix)), la matrice normale
    // standard pour les directions (normales, tangentes). Ne pas re-transposer : sinon on applique
    // inverse(world) aux normales → erreur (ex. R^T au lieu de R en rotation pure) et l'IBL / les
    // reflets semblent « tourner avec » la mesh de façon incorrecte.
    let normalMatrix = mat4x4<f32>(
        instance.inverseModel_r1, instance.inverseModel_r2, instance.inverseModel_r3, instance.inverseModel_r4
    );
    
    var local_position = vertex.position;
    var local_normal = vertex.normal;
    var output: VertexOutput;
    // [[VERTEX_UV_OUTPUT]]
    output.color = vertex.color * instance.color;

    // [[VERTEX_FUNCTION_BODY]]
    // [[VERTEX_MASTER_NODE_LOGIC]]

    // [[MORPH_SKIN_LOCAL]]

    // [[WORLD_TRANSFORM_AFTER_MASTER]]

    // Tangent Space (pour Normal Mapping classique)
    // On continue de calculer la TBN pour l'éclairage tangent space si besoin
    let tbn = mat3x3<f32>(world_tangent, world_bitangent, world_normal);
    
    output.tangent_space_light_dir = normalize(-frame.lightDirection) * tbn;
    output.tangent_space_view_dir = normalize(frame.cameraPosition - output.world_position) * tbn;

    output.clip_position = frame.projectionMatrix * frame.viewMatrix * world_pos_4d;
    output.shadowPos = frame.lightMatrix * world_pos_4d;

    return output;
}