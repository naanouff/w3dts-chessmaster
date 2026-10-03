// Test compute shader for RenderGraph Compute Pass Infrastructure validation
// This shader simply fills an output texture with a gradient pattern

@group(0) @binding(0) var outputTex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dims = textureDimensions(outputTex);
    
    // Check bounds
    if (global_id.x >= dims.x || global_id.y >= dims.y) {
        return;
    }
    
    // Compute normalized UV coordinates
    let uv = vec2<f32>(
        f32(global_id.x) / f32(dims.x),
        f32(global_id.y) / f32(dims.y)
    );
    
    // Create a simple gradient pattern
    let color = vec4<f32>(uv.x, uv.y, 0.5, 1.0);
    
    textureStore(outputTex, vec2<i32>(global_id.xy), color);
}
