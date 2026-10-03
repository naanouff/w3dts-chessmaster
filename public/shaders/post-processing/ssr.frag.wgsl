/**
 * @file ssr.frag.wgsl
 * @description Screen Space Reflections.
 * Correction finale : Utilisation EXCLUSIVE de textureSampleLevel pour éviter tout problème de contrôle de flux.
 */

#include "../shared/structs.wgsl"

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

// --- Ressources Locales ---
@group(1) @binding(0) var s: sampler;
@group(1) @binding(1) var sceneTex: texture_2d<f32>;   
@group(1) @binding(2) var depthTex: texture_depth_2d; 
@group(1) @binding(3) var normalTex: texture_2d<f32>; 

struct SSRParams {
    stepSize: f32,      
    maxSteps: f32,      
    thickness: f32,     
    intensity: f32,     
};
@group(1) @binding(4) var<uniform> params: SSRParams;

fn getViewPos(uv: vec2<f32>) -> vec3<f32> {
    let dim = textureDimensions(depthTex);
    let coords = vec2<i32>(floor(uv * vec2<f32>(dim)));
    let depth = textureLoad(depthTex, coords, 0);
    
    let x = uv.x * 2.0 - 1.0;
    let y = (1.0 - uv.y) * 2.0 - 1.0; 
    let clipPos = vec4<f32>(x, y, depth, 1.0);
    
    let worldPosRaw = frame.inverseViewProjectionMatrix * clipPos;
    let worldPos = worldPosRaw.xyz / worldPosRaw.w;

    let viewPos = frame.viewMatrix * vec4<f32>(worldPos, 1.0);
    
    return viewPos.xyz;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let viewPos = getViewPos(uv);
    
    // Divergence possible ici
    if (viewPos.z < -500.0) { return vec4<f32>(0.0); }

    // CORRECTION : textureSampleLevel
    let normalRaw = textureSampleLevel(normalTex, s, uv, 0.0).xyz;
    let viewNormal = normalize(normalRaw * 2.0 - 1.0); 

    let viewDir = normalize(viewPos);
    let reflectDir = normalize(reflect(viewDir, viewNormal));

    if (reflectDir.z > 0.0) { return vec4<f32>(0.0); }

    var currentPos = viewPos;
    let step = reflectDir * params.stepSize;
    
    var hit = false;
    var hitUV = vec2<f32>(0.0);
    
    for (var i = 0; i < i32(params.maxSteps); i++) {
        currentPos += step;

        var clipPos = frame.projectionMatrix * vec4<f32>(currentPos, 1.0);
        clipPos.x /= clipPos.w;
        clipPos.y /= clipPos.w;
        
        if (clipPos.x < -1.0 || clipPos.x > 1.0 || clipPos.y < -1.0 || clipPos.y > 1.0) {
            break;
        }

        let sampleUV = vec2<f32>(clipPos.x * 0.5 + 0.5, clipPos.y * -0.5 + 0.5);
        let sampleZ = getViewPos(sampleUV).z;
        
        if (currentPos.z < sampleZ && abs(currentPos.z - sampleZ) < params.thickness) {
            
            var binaryStep = step * 0.5;
            currentPos -= binaryStep; 
            
            for (var j = 0; j < 4; j++) {
                var bClip = frame.projectionMatrix * vec4<f32>(currentPos, 1.0);
                bClip.x /= bClip.w; bClip.y /= bClip.w;
                let bUV = vec2<f32>(bClip.x * 0.5 + 0.5, bClip.y * -0.5 + 0.5);
                let bZ = getViewPos(bUV).z;
                
                binaryStep *= 0.5;
                if (currentPos.z < bZ) {
                    currentPos += binaryStep; 
                } else {
                    currentPos -= binaryStep; 
                }
                hitUV = bUV;
            }
            
            hit = true;
            break;
        }
    }

    if (!hit) { return vec4<f32>(0.0); }

    let dX = smoothstep(0.0, 0.1, hitUV.x) * smoothstep(1.0, 0.9, hitUV.x);
    let dY = smoothstep(0.0, 0.1, hitUV.y) * smoothstep(1.0, 0.9, hitUV.y);
    let screenEdgeFactor = dX * dY;
    
    // CORRECTION : textureSampleLevel
    let reflectionColor = textureSampleLevel(sceneTex, s, hitUV, 0.0).rgb;

    return vec4<f32>(reflectionColor * screenEdgeFactor * params.intensity, 1.0);
}