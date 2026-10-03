@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var ssaoInput: texture_2d<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let texSize = vec2<f32>(textureDimensions(ssaoInput));
    let texelSize = 1.0 / texSize;
    var result: f32 = 0.0;
    
    // Blur 4x4
    for (var x = -2; x < 2; x++) {
        for (var y = -2; y < 2; y++) {
            let offset = vec2<f32>(f32(x), f32(y)) * texelSize;
            result += textureSample(ssaoInput, s, uv + offset).r;
        }
    }
    
    let finalAO = result / 16.0;
    return vec4<f32>(finalAO, finalAO, finalAO, 1.0);
}