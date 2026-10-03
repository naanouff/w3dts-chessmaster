/**
 * @file decal.wgsl
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-01-16
 * @description Shader for projected decals.
 * Renders unit cubes that sample the depth buffer to reconstruct world position,
 * then project a texture onto the surface with angular fading.
 */

// ============================================================================
// BINDINGS
// ============================================================================

// Group 0: Frame Uniforms
struct FrameUniforms {
    projectionMatrix: mat4x4<f32>,
    viewMatrix: mat4x4<f32>,
    inverseViewProjectionMatrix: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    lightMatrix: mat4x4<f32>,
    lightDirection: vec3<f32>,
    lightColor: vec3<f32>,
    ambientLightIntensity: f32,
    debugViewMode: u32,
    totalTime: f32,
    _padding1: f32,
    cascadeSplits: vec4<f32>,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

// Group 1: Decal textures and samplers
@group(1) @binding(0) var decalSampler: sampler;
@group(1) @binding(1) var decalAlbedo: texture_2d<f32>;
@group(1) @binding(2) var sceneDepth: texture_depth_2d;
@group(1) @binding(3) var sceneNormal: texture_2d<f32>;

// ============================================================================
// VERTEX INPUT/OUTPUT
// ============================================================================

// Per-instance data from DecalSystem buffer
struct DecalInstance {
    // Inverse projection matrix (world -> decal local space)
    @location(1) invProj_r0: vec4<f32>,
    @location(2) invProj_r1: vec4<f32>,
    @location(3) invProj_r2: vec4<f32>,
    @location(4) invProj_r3: vec4<f32>,
    // World matrix (scaled by decal size)
    @location(5) world_r0: vec4<f32>,
    @location(6) world_r1: vec4<f32>,
    @location(7) world_r2: vec4<f32>,
    @location(8) world_r3: vec4<f32>,
    // Parameters: opacity, normalFadeStart (rad), normalFadeEnd (rad), blendMode
    @location(9) params: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) screenUV: vec2<f32>,
    @location(1) invProj_r0: vec4<f32>,
    @location(2) invProj_r1: vec4<f32>,
    @location(3) invProj_r2: vec4<f32>,
    @location(4) invProj_r3: vec4<f32>,
    @location(5) params: vec4<f32>,
    @location(6) decalForward: vec3<f32>,
};

// ============================================================================
// UNIT CUBE VERTICES
// ============================================================================

// Unit cube vertices centered at origin [-0.5, 0.5]
const CUBE_VERTICES: array<vec3<f32>, 36> = array<vec3<f32>, 36>(
    // Front face
    vec3<f32>(-0.5, -0.5,  0.5), vec3<f32>( 0.5, -0.5,  0.5), vec3<f32>( 0.5,  0.5,  0.5),
    vec3<f32>(-0.5, -0.5,  0.5), vec3<f32>( 0.5,  0.5,  0.5), vec3<f32>(-0.5,  0.5,  0.5),
    // Back face
    vec3<f32>( 0.5, -0.5, -0.5), vec3<f32>(-0.5, -0.5, -0.5), vec3<f32>(-0.5,  0.5, -0.5),
    vec3<f32>( 0.5, -0.5, -0.5), vec3<f32>(-0.5,  0.5, -0.5), vec3<f32>( 0.5,  0.5, -0.5),
    // Top face
    vec3<f32>(-0.5,  0.5,  0.5), vec3<f32>( 0.5,  0.5,  0.5), vec3<f32>( 0.5,  0.5, -0.5),
    vec3<f32>(-0.5,  0.5,  0.5), vec3<f32>( 0.5,  0.5, -0.5), vec3<f32>(-0.5,  0.5, -0.5),
    // Bottom face
    vec3<f32>(-0.5, -0.5, -0.5), vec3<f32>( 0.5, -0.5, -0.5), vec3<f32>( 0.5, -0.5,  0.5),
    vec3<f32>(-0.5, -0.5, -0.5), vec3<f32>( 0.5, -0.5,  0.5), vec3<f32>(-0.5, -0.5,  0.5),
    // Right face
    vec3<f32>( 0.5, -0.5,  0.5), vec3<f32>( 0.5, -0.5, -0.5), vec3<f32>( 0.5,  0.5, -0.5),
    vec3<f32>( 0.5, -0.5,  0.5), vec3<f32>( 0.5,  0.5, -0.5), vec3<f32>( 0.5,  0.5,  0.5),
    // Left face
    vec3<f32>(-0.5, -0.5, -0.5), vec3<f32>(-0.5, -0.5,  0.5), vec3<f32>(-0.5,  0.5,  0.5),
    vec3<f32>(-0.5, -0.5, -0.5), vec3<f32>(-0.5,  0.5,  0.5), vec3<f32>(-0.5,  0.5, -0.5),
);

// ============================================================================
// VERTEX SHADER
// ============================================================================

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32, instance: DecalInstance) -> VertexOutput {
    var out: VertexOutput;

    // Reconstruct world matrix from instance data
    let worldMatrix = mat4x4<f32>(
        instance.world_r0,
        instance.world_r1,
        instance.world_r2,
        instance.world_r3
    );

    // Get cube vertex position from procedural array
    let localPos = CUBE_VERTICES[vertexIndex];

    // Transform to world space then clip space
    let worldPos = worldMatrix * vec4<f32>(localPos, 1.0);
    let clipPos = frame.projectionMatrix * frame.viewMatrix * worldPos;

    out.clipPosition = clipPos;

    // Screen UV for depth sampling (will be computed in fragment from position)
    out.screenUV = vec2<f32>(0.0); // Computed in fragment shader

    // Pass inverse projection matrix
    out.invProj_r0 = instance.invProj_r0;
    out.invProj_r1 = instance.invProj_r1;
    out.invProj_r2 = instance.invProj_r2;
    out.invProj_r3 = instance.invProj_r3;

    // Pass decal parameters
    out.params = instance.params;

    // Extract decal forward direction (-Z in local space, transformed to world)
    out.decalForward = normalize(vec3<f32>(worldMatrix[2][0], worldMatrix[2][1], worldMatrix[2][2]));

    return out;
}

// ============================================================================
// FRAGMENT SHADER
// ============================================================================

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // 1. Compute screen UV from fragment position
    let texDims = vec2<f32>(textureDimensions(sceneDepth));
    let screenUV = input.clipPosition.xy / texDims;

    // 2. Sample depth buffer
    let depth = textureLoad(sceneDepth, vec2<i32>(input.clipPosition.xy), 0);

    // 3. Reconstruct world position from depth
    let ndcX = screenUV.x * 2.0 - 1.0;
    let ndcY = (1.0 - screenUV.y) * 2.0 - 1.0; // Flip Y for NDC
    let ndcZ = depth;
    let clipSpacePos = vec4<f32>(ndcX, ndcY, ndcZ, 1.0);

    let worldPosH = frame.inverseViewProjectionMatrix * clipSpacePos;
    let worldPos = worldPosH.xyz / worldPosH.w;

    // 4. Transform world position to decal local space
    let invProjMatrix = mat4x4<f32>(
        input.invProj_r0,
        input.invProj_r1,
        input.invProj_r2,
        input.invProj_r3
    );

    let localPosH = invProjMatrix * vec4<f32>(worldPos, 1.0);
    let localPos = localPosH.xyz / localPosH.w;

    // 5. Check if point is inside decal volume [-0.5, 0.5]
    if (abs(localPos.x) > 0.5 || abs(localPos.y) > 0.5 || abs(localPos.z) > 0.5) {
        discard;
    }

    // 6. Compute decal UVs from local XY (centered at 0, so offset by 0.5)
    let decalUV = vec2<f32>(localPos.x + 0.5, 1.0 - (localPos.y + 0.5));

    // 7. Sample scene normal for angular fade
    let sceneNormalSample = textureLoad(sceneNormal, vec2<i32>(input.clipPosition.xy), 0);
    let surfaceNormal = normalize(sceneNormalSample.xyz * 2.0 - 1.0);

    // 8. Compute angle between surface normal and decal projection direction
    let decalDir = normalize(input.decalForward);
    let dotProduct = abs(dot(surfaceNormal, decalDir));
    let angle = acos(clamp(dotProduct, 0.0, 1.0));

    // 9. Angular fade
    let fadeStart = input.params.y; // normalFadeStart in radians
    let fadeEnd = input.params.z;   // normalFadeEnd in radians
    let angleFade = 1.0 - smoothstep(fadeStart, fadeEnd, angle);

    // Early out if fully faded
    if (angleFade <= 0.0) {
        discard;
    }

    // 10. Sample decal texture
    let decalColor = textureSample(decalAlbedo, decalSampler, decalUV);

    // 11. Apply opacity and angle fade
    let opacity = input.params.x;
    let finalAlpha = decalColor.a * opacity * angleFade;

    // Early out for transparent pixels
    if (finalAlpha < 0.01) {
        discard;
    }

    // 12. Output with premultiplied alpha for proper blending
    return vec4<f32>(decalColor.rgb * finalAlpha, finalAlpha);
}
