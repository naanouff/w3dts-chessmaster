/**
 * @file Vertex shader for rendering GPU-skinned meshes into the shadow map.
 * Applies linear blend skinning to the vertex position using the joint palette,
 * then projects from the light's point of view (depth-only output).
 */

struct FrameUniforms {
    lightViewProjectionMatrix: mat4x4<f32>,
};

struct ObjectUniforms {
    modelMatrix: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(1) @binding(0) var<uniform> object: ObjectUniforms;
@group(2) @binding(0) var<storage, read> jointPalette: array<mat4x4<f32>>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
};

@vertex
fn main(
    @location(0) position:  vec3<f32>,  // VB0 offset 0
    @location(2) joints:    vec4<u32>,  // VB2 offset 0  (uint32x4)
    @location(5) weights:   vec4<f32>,  // VB2 offset 16 (float32x4)
) -> VertexOutput {
    let skinMat =
        weights.x * jointPalette[joints.x] +
        weights.y * jointPalette[joints.y] +
        weights.z * jointPalette[joints.z] +
        weights.w * jointPalette[joints.w];

    let skinnedPos = skinMat * vec4<f32>(position, 1.0);

    var output: VertexOutput;
    output.position = frame.lightViewProjectionMatrix * object.modelMatrix * skinnedPos;
    return output;
}
