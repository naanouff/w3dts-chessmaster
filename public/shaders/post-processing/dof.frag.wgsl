/**
 * @file dof.frag.wgsl
 * @description Depth of Field (Single Pass Bokeh Approximation).
 * Correction : Utilisation de textureSampleLevel pour supporter le contrôle de flux non-uniforme.
 */

#include "../shared/structs.wgsl"

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

// --- Ressources Locales ---
@group(1) @binding(0) var s: sampler;
@group(1) @binding(1) var inputTex: texture_2d<f32>;
@group(1) @binding(2) var depthTex: texture_depth_2d;

struct DoFParams {
    focusDistance: f32, 
    focusRange: f32,    
    blurRadius: f32,    
};
@group(1) @binding(3) var<uniform> params: DoFParams;

fn getLinearDepth(uv: vec2<f32>) -> f32 {
    let dim = textureDimensions(depthTex);
    let coords = vec2<i32>(floor(uv * vec2<f32>(dim)));
    let depth = textureLoad(depthTex, coords, 0);
    
    let x = uv.x * 2.0 - 1.0;
    let y = (1.0 - uv.y) * 2.0 - 1.0; 
    let clipPos = vec4<f32>(x, y, depth, 1.0);
    let viewPos = frame.viewMatrix * vec4<f32>((frame.inverseViewProjectionMatrix * clipPos).xyz / (frame.inverseViewProjectionMatrix * clipPos).w, 1.0);
    return -viewPos.z;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let dim = vec2<f32>(textureDimensions(inputTex));
    let pixelSize = vec2<f32>(1.0 / dim.x, 1.0 / dim.y);

    let centerDepth = getLinearDepth(uv);
    
    // CORRECTION : textureSample -> textureSampleLevel
    let centerColor = textureSampleLevel(inputTex, s, uv, 0.0).rgb;

    let dist = abs(centerDepth - params.focusDistance);
    let coc = smoothstep(params.focusRange, params.focusRange * 2.0, dist);

    // --- MODE DEBUG ---
    
    // Test 1 : Visualiser la zone de flou (Rouge = Flou, Noir = Net)
    //return vec4<f32>(coc, 0.0, 0.0, 1.0); 

    // Test 2 : Visualiser la profondeur brute (Blanc = Proche, Noir = Loin)
    // Division par 20.0 pour ramener des mètres (ex: 20m) vers 0..1 visible
    //return vec4<f32>(vec3<f32>(centerDepth / 20.0), 1.0);

    // --- FIN MODE DEBUG ---

    // Cette condition causait l'erreur avec textureSample
    // Avec textureSampleLevel, c'est autorisé !
    if (coc < 0.01) {
        return vec4<f32>(centerColor, 1.0);
    }

    var finalColor = vec3<f32>(0.0);
    var totalWeight = 0.0;

    let goldenAngle = 2.39996323;
    let maxRadius = params.blurRadius * coc;
    let iterations = 16.0; 

    for (var i = 0.0; i < iterations; i += 1.0) {
        let theta = i * goldenAngle;
        let r = sqrt(i / iterations) * maxRadius;
        let offset = vec2<f32>(cos(theta), sin(theta)) * r * pixelSize;
        
        let sampleUV = uv + offset;
        
        // CORRECTION : textureSample -> textureSampleLevel
        let sampleColor = textureSampleLevel(inputTex, s, sampleUV, 0.0).rgb;
        
        let weight = 1.0;
        finalColor += sampleColor * weight;
        totalWeight += weight;
    }

    return vec4<f32>(finalColor / totalWeight, 1.0);
}