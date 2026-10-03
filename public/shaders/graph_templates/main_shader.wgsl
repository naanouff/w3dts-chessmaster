// packages/public/shaders/graph_templates/main_shader.wgsl

// SHADER GÉNÉRÉ POUR: {{graph_id}}

// [[DEFINES]]

#include "../shared/math_common.wgsl"

// [[UTILITY_FUNCTIONS]]

// --- NOUVELLES STRUCTURES LUMIÈRES ---
struct LightData {
    // x,y,z = position, w = range
    positionAndRange: vec4<f32>, 
    
    // x,y,z = direction, w = intensity
    dirAndIntensity: vec4<f32>,  
    
    // x,y,z = color, w = type (casté en f32)
    colorAndType: vec4<f32>,     
    
    // x=innerCos or area width, y=outerCos or area height, z=shadowIndex, w=padding
    params: vec4<f32>,
};

struct LightBuffer {
    ambientColor: vec4<f32>, // vec4 pour alignement (w inutilisé)
    lightCount: u32,
    _pad1: u32,
    _pad2: u32,
    _pad3: u32,
    lights: array<LightData>,
};

// --- Frame Uniforms ---
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
    cascadeSplits: vec4<f32>, 
};

struct ShadowUniforms {
    // Engine 0.0.36 packs 8 shadow matrices (512 bytes). A 16-wide array
    // makes the uniform 1024 bytes and the opaque pass is rejected.
    matrices: array<mat4x4<f32>, 8>,
};

// --- BINDINGS GLOBAUX ---
@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var<storage, read> sceneLights: LightBuffer; 

@group(1) @binding(0) var textureSampler: sampler;

// Group 2 (Shadows)
@group(2) @binding(0) var shadowMap: texture_depth_2d_array;
@group(2) @binding(1) var shadowSampler: sampler_comparison;
@group(2) @binding(2) var<uniform> shadowData: ShadowUniforms;

// [[MATERIAL_UNIFORMS_STRUCT]]

// [[TEXTURE_BINDINGS]]

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) tangent_space_light_dir: vec3<f32>,
    @location(2) tangent_space_view_dir: vec3<f32>,
    @location(3) shadowPos: vec4<f32>,
    @location(4) color: vec4<f32>,
    @location(5) world_position: vec3<f32>,
    @location(6) world_normal: vec3<f32>,
    @location(7) inverseModel_r1: vec4<f32>,
    @location(8) inverseModel_r2: vec4<f32>,
    @location(9) inverseModel_r3: vec4<f32>,
    @location(10) inverseModel_r4: vec4<f32>,
    @location(11) world_tangent: vec3<f32>,
    @location(12) world_bitangent: vec3<f32>,
    @location(13) uv1: vec2<f32>,
    @location(14) world_scale: f32,
};

struct FragmentOutput {
    @location(0) color: vec4<f32>,
    @location(1) view_normal: vec4<f32>,
};


@fragment
fn fs_main(input: VertexOutput, @builtin(front_facing) is_front: bool) -> FragmentOutput {
    var output: FragmentOutput;

    // [[FUNCTION_BODY]]

    var final_alpha_out = final_alpha;
    if (ALPHA_MODE == 1u) { // OPAQUE
        final_alpha_out = 1.0;
    }

    let world_normal = normalize(input.world_normal);
    let view_normal_vec3 = (frame.viewMatrix * vec4<f32>(world_normal, 0.0)).xyz;
    // Store shadow factor in alpha channel for hatching post-process
    output.view_normal = vec4<f32>(view_normal_vec3 * 0.5 + 0.5, shadow_factor_out);
    // .a: PBR writes roughness (SSR gloss); toon/NPR still write shadow for hatch.

    output.color = vec4(final_color, final_alpha_out);
    
    return output;
}