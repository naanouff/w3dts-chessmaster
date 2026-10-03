// shadow_cutout.vert.wgsl
// Variant of shadow.vert.wgsl that also passes UV to the fragment stage
// for alpha-cutout shadow rendering of non-instanced MASK materials (e.g. tree leaves).

struct FrameUniforms {
    lightViewProjectionMatrix: mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> frame: FrameUniforms;

struct ObjectUniforms {
    modelMatrix: mat4x4<f32>,
};
@group(1) @binding(0) var<uniform> object: ObjectUniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn main(
    @location(0) position: vec3<f32>,
    @location(1) uv: vec2<f32>,
) -> VertexOutput {
    var out: VertexOutput;
    out.position = frame.lightViewProjectionMatrix * object.modelMatrix * vec4<f32>(position, 1.0);
    out.uv = uv;
    return out;
}
