// packages/public/shaders/core/shadow_instanced.vert.wgsl

// Group 0 : La matrice de vue/projection de la lumière (Uniform dynamique)
@group(0) @binding(0) var<uniform> lightViewProj: mat4x4<f32>;

struct VertexInput {
    @location(0) position: vec3<f32>,
    // UV0 is at location 1 in the standard mesh layout (offset 12, after position vec3)
    @location(1) uv: vec2<f32>,
};

// Layout standard de l'InstancedMeshComponent (voir structs.wgsl)
struct InstanceInput {
    @location(7) modelMatrix_r1: vec4<f32>,
    @location(8) modelMatrix_r2: vec4<f32>,
    @location(9) modelMatrix_r3: vec4<f32>,
    @location(10) modelMatrix_r4: vec4<f32>,
    // On ignore les autres attributs (inverse, color) pour l'ombre
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    // Pass UV to the optional cutout fragment shader
    @location(0) uv: vec2<f32>,
};

@vertex
fn main(input: VertexInput, instance: InstanceInput) -> VertexOutput {
    let model = mat4x4<f32>(
        instance.modelMatrix_r1,
        instance.modelMatrix_r2,
        instance.modelMatrix_r3,
        instance.modelMatrix_r4
    );
    var out: VertexOutput;
    out.position = lightViewProj * model * vec4<f32>(input.position, 1.0);
    out.uv = input.uv;
    return out;
}