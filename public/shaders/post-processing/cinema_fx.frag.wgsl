@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var inputTex: texture_2d<f32>;

struct CinemaParams {
    vignetteStrength: f32, // ex: 0.5
    aberrationAmount: f32, // ex: 0.003
};
@group(0) @binding(2) var<uniform> params: CinemaParams;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // 1. Chromatic Aberration
    // On sépare les canaux RGB en les décalant vers le centre
    let center = vec2(0.5, 0.5);
    let dist = uv - center;
    
    // Le rouge s'éloigne, le bleu se rapproche
    let r = textureSample(inputTex, s, uv + dist * params.aberrationAmount).r;
    let g = textureSample(inputTex, s, uv).g;
    let b = textureSample(inputTex, s, uv - dist * params.aberrationAmount).b;
    
    var color = vec3(r, g, b);

    // 2. Vignette
    // Distance au centre (0 au centre, 0.7 dans les coins)
    let d = distance(uv, center);
    // Assombrissement progressif sur les bords
    let vignette = smoothstep(0.8, 0.2, d * (1.0 + params.vignetteStrength));
    
    color = color * vignette;

    return vec4(color, 1.0);
}