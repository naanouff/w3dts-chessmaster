// Ultra Terrain — Dedicated Vertex Shader
//
// Vertex layout (buffer 0, stride = 80 bytes = 20 × f32):
//   loc 0  position  : vec3f  — local-space XYZ
//   loc 1  uv0       : vec2f  — splat / terrain UVs
//   loc 2  uv1       : vec2f  — secondary UVs
//   loc 3  normal    : vec3f
//   loc 4  tangent   : vec3f
//   loc 5  bitangent : vec3f
//   loc 6  color     : vec4f  — r=textureId  g=random  b=biomeId  a=blendFactor
//
// CoarseY buffer (group(1) binding(8), storage read-only):
//   coarseYBuffer[vertexIndex] — bilinear-interpolated height of the coarser LOD
//   (replaces the former vertex buffer at location 16 which exceeded the 0-15 limit)
//
// Instance buffer (buffer 1, stride = 144 bytes = 36 × f32, stepMode = instance):
//   loc  7 –10  model matrix rows (mat4x4)
//   loc 11 –14  inverse-model matrix rows (for normal transform)
//   loc 15      instance colour / data
//
// Binding groups:
//   group(0) binding(0)  FrameUniforms   — camera matrices, time, light direction
//   group(1) binding(0)  TerrainMorph    — per-chunk lodMorph uniform
//
// Wire-up note: this shader is wired into a dedicated GPURenderPipeline in
// Phase 3 (terrain.frag.wgsl + TerrainPipelineService). Until then it exists
// as a compile-ready artefact.

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

struct FrameUniforms {
    projectionMatrix           : mat4x4<f32>,
    viewMatrix                 : mat4x4<f32>,
    inverseViewProjectionMatrix: mat4x4<f32>,
    cameraPosition             : vec3<f32>,
    @size(64) lightMatrix      : mat4x4<f32>,
    lightDirection             : vec3<f32>,
    lightColor                 : vec3<f32>,
    ambientLightIntensity      : f32,
    debugViewMode              : u32,
    totalTime                  : f32,
};

struct TerrainMorphUniforms {
    /// LOD morph factor in [0, 1].
    /// 0 = fine vertex positions unchanged; 1 = fully morphed to coarse LOD positions.
    lodMorph : f32,
    _pad0    : f32,
    _pad1    : f32,
    _pad2    : f32,
};

struct VertexInput {
    @location(0) position  : vec3<f32>,
    @location(1) uv0       : vec2<f32>,
    @location(2) uv1       : vec2<f32>,
    @location(3) normal    : vec3<f32>,
    @location(4) tangent   : vec3<f32>,
    @location(5) bitangent : vec3<f32>,
    @location(6) color     : vec4<f32>,  // r=textureId  g=random  b=biomeId  a=blendFactor
};

struct InstanceInput {
    @location(7)  modelMatrix_r1 : vec4<f32>,
    @location(8)  modelMatrix_r2 : vec4<f32>,
    @location(9)  modelMatrix_r3 : vec4<f32>,
    @location(10) modelMatrix_r4 : vec4<f32>,
    @location(11) inverseModel_r1: vec4<f32>,
    @location(12) inverseModel_r2: vec4<f32>,
    @location(13) inverseModel_r3: vec4<f32>,
    @location(14) inverseModel_r4: vec4<f32>,
    @location(15) instanceColor  : vec4<f32>,
};

struct VertexOutput {
    @builtin(position)  clipPosition : vec4<f32>,
    @location(0)        worldPos     : vec3<f32>,
    @location(1)        uv0          : vec2<f32>,
    @location(2)        uv1          : vec2<f32>,
    @location(3)        normal       : vec3<f32>,   // world-space
    @location(4)        tangent      : vec3<f32>,   // world-space
    @location(5)        bitangent    : vec3<f32>,   // world-space
    @location(6)        color        : vec4<f32>,   // r=textureId  g=random  b=biomeId  a=blendFactor
    @location(7)        shadowPos    : vec4<f32>,   // light-space clip position (for shadow map)
};

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

@group(0) @binding(0) var<uniform> frame : FrameUniforms;
@group(1) @binding(0) var<uniform> morph : TerrainMorphUniforms;
/// Per-vertex coarseY heights for LOD geomorphing, indexed by vertex_index.
@group(1) @binding(8) var<storage, read> coarseYBuffer: array<f32>;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

@vertex
fn main(
    @builtin(vertex_index) vertexIndex: u32,
    vertex  : VertexInput,
    instance: InstanceInput,
) -> VertexOutput {
    // Reconstruct model matrix and inverse-model matrix from per-instance data.
    let modelMatrix = mat4x4<f32>(
        instance.modelMatrix_r1,
        instance.modelMatrix_r2,
        instance.modelMatrix_r3,
        instance.modelMatrix_r4,
    );
    let normalMatrix = mat4x4<f32>(
        instance.inverseModel_r1,
        instance.inverseModel_r2,
        instance.inverseModel_r3,
        instance.inverseModel_r4,
    );

    // LOD Geomorphing — smoothly blend the fine vertex Y towards the coarse Y.
    // When morph.lodMorph == 0: position unchanged (fine LOD).
    // When morph.lodMorph == 1: position snapped to coarse LOD (matches the
    // coarser mesh exactly, so the transition is seam-free).
    var localPos = vertex.position;
    localPos.y = mix(vertex.position.y, coarseYBuffer[vertexIndex], morph.lodMorph);

    // Transform to world space.
    let worldPos4    = modelMatrix * vec4<f32>(localPos, 1.0);
    let worldPos     = worldPos4.xyz;
    let clipPosition = frame.projectionMatrix * frame.viewMatrix * worldPos4;

    // Transform normal / tangent / bitangent to world space.
    // normalMatrix = transpose(inverse(model)) — already transposed by the CPU.
    let N = normalize((normalMatrix * vec4<f32>(vertex.normal,    0.0)).xyz);
    let T = normalize((normalMatrix * vec4<f32>(vertex.tangent,   0.0)).xyz);
    let B = normalize((normalMatrix * vec4<f32>(vertex.bitangent, 0.0)).xyz);

    // Shadow map position (light-space clip coordinates).
    let shadowPos = frame.lightMatrix * worldPos4;

    var out: VertexOutput;
    out.clipPosition = clipPosition;
    out.worldPos     = worldPos;
    out.uv0          = vertex.uv0;
    out.uv1          = vertex.uv1;
    out.normal       = N;
    out.tangent      = T;
    out.bitangent    = B;
    out.color        = vertex.color;
    out.shadowPos    = shadowPos;
    return out;
}
