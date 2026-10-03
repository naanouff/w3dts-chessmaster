/**
 * @file Defines shared data structures (uniforms, inputs/outputs) for shaders.
 * This file is intended to be included by other shaders to ensure data layout
 * consistency between the CPU and GPU.
 */

/**
 * Global per-frame uniforms, shared by shaders that need them.
 */
struct FrameUniforms {
    projectionMatrix: mat4x4<f32>,
    viewMatrix: mat4x4<f32>,
    inverseViewProjectionMatrix: mat4x4<f32>, 
    cameraPosition: vec3<f32>,
    
    // Matrice d'ombre Legacy (utilisée si pas de CSM)
    lightMatrix: mat4x4<f32>, 
    
    lightDirection: vec3<f32>,
    lightColor: vec3<f32>,
    ambientLightIntensity: f32,
    debugViewMode: u32,
    totalTime: f32,
    _padding1: f32,
    cascadeSplits: vec4<f32>, 
};

/**
 * Material uniforms, used for PBR shaders.
 */
struct MaterialUniforms {
    diffuseColor: vec3<f32>,
    alphaCutoff: f32,
    emissiveColor: vec3<f32>,
    // padding implicite
    roughness: f32,
    metallic: f32,
    useDiffuseTexture: f32,
    useNormalMap: f32,
    uvScale: vec2<f32>,
    uvOffset: vec2<f32>,
};

/**
 * Output structure for the vertex shader and input for the fragment shader.
 */
struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) tangent_space_light_dir: vec3<f32>,
    @location(2) tangent_space_view_dir: vec3<f32>,
    @location(3) shadowPos: vec4<f32>,
    @location(4) color: vec4<f32>,
    @location(5) world_position: vec3<f32>,
    @location(6) world_normal: vec3<f32>,

    // --- For inverse model matrix (used for normal mapping) ---
    @location(7) inverseModel_r1: vec4<f32>,
    @location(8) inverseModel_r2: vec4<f32>,
    @location(9) inverseModel_r3: vec4<f32>,
    @location(10) inverseModel_r4: vec4<f32>,
    @location(11) world_tangent: vec3<f32>,
    @location(12) world_bitangent: vec3<f32>,
    @location(13) uv1: vec2<f32>,
    @location(14) world_scale: f32,
};

/**
 * Input structure for the vertex shader.
 */
struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) uv1: vec2<f32>,
    @location(3) normal: vec3<f32>,
    @location(4) tangent: vec3<f32>,
    @location(5) bitangent: vec3<f32>,
    @location(6) color: vec4<f32>,
};

/**
 * Per-instance input structure for the vertex shader.
 */
struct InstanceInput {
    @location(7) modelMatrix_r1: vec4<f32>,
    @location(8) modelMatrix_r2: vec4<f32>,
    @location(9) modelMatrix_r3: vec4<f32>,
    @location(10) modelMatrix_r4: vec4<f32>,
    @location(11) inverseModel_r1: vec4<f32>,
    @location(12) inverseModel_r2: vec4<f32>,
    @location(13) inverseModel_r3: vec4<f32>,
    @location(14) inverseModel_r4: vec4<f32>,
    @location(15) color: vec4<f32>,
};

// --- Structures Light System V2 ---

struct LightData {
    positionAndRange: vec4<f32>, 
    dirAndIntensity: vec4<f32>,  
    colorAndType: vec4<f32>,
    params: vec4<f32>,
    tangentAndShape: vec4<f32>,
};

struct SceneLights {
    ambientColor: vec4<f32>, 
    lightCount: u32,
    _pad1: u32,
    _pad2: u32,
    _pad3: u32,
    lights: array<LightData>,
};

// --- Structure Shadow Matrices (V2) ---
// Buffer "ShadowUniforms" (Binding 2)
struct ShadowUniforms {
    matrices: array<mat4x4<f32>, 16>, // CSM (4) + point faces (6) + spots
};