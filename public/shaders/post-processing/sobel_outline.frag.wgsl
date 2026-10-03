/**
 * @file sobel_outline.frag.wgsl
 * @description Détection de contours basée sur la Profondeur et les Normales.
 * Version corrigée : Calcul de la profondeur linéaire via matrices (pas de near/far requis).
 */

#include "../shared/structs.wgsl"

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

// --- Ressources Locales ---
@group(1) @binding(0) var s: sampler;
@group(1) @binding(1) var inputTex: texture_2d<f32>;   // L'image couleur actuelle
@group(1) @binding(2) var depthTex: texture_depth_2d; // La profondeur
@group(1) @binding(3) var normalTex: texture_2d<f32>; // Les normales

struct OutlineParams {
    thickness: f32,       
    depthThreshold: f32,  
    normalThreshold: f32, 
    colorR: f32,          
    colorG: f32,
    colorB: f32,
};
@group(1) @binding(4) var<uniform> params: OutlineParams;

// --- CORRECTION ---
// Calcul de la profondeur linéaire (View Space Z) via la matrice inverse.
// Cela évite d'avoir besoin de frame.cameraNear qui n'existe pas.
fn getLinearDepth(uv: vec2<f32>) -> f32 {
    let dim = textureDimensions(depthTex);
    let coords = vec2<i32>(floor(uv * vec2<f32>(dim)));
    let depth = textureLoad(depthTex, coords, 0);
    
    // 1. Reconstruire Clip Space
    let x = uv.x * 2.0 - 1.0;
    let y = (1.0 - uv.y) * 2.0 - 1.0; 
    let clipPos = vec4<f32>(x, y, depth, 1.0);
    
    // 2. Retour au World Space
    let worldPosRaw = frame.inverseViewProjectionMatrix * clipPos;
    let worldPos = worldPosRaw.xyz / worldPosRaw.w;

    // 3. Projection en View Space (par rapport à la caméra)
    // On calcule la distance sur l'axe Z de la vue (Planar Depth)
    // C'est mieux que la distance euclidienne pour les outlines.
    // On projette le vecteur (WorldPos - CameraPos) sur le vecteur Forward de la caméra.
    
    // Astuce : Si on n'a pas accès au vecteur Forward facilement, on peut utiliser la ViewMatrix
    let viewPos = frame.viewMatrix * vec4<f32>(worldPos, 1.0);
    
    // Z est négatif devant la caméra, on prend l'inverse pour avoir une valeur positive croissante
    return -viewPos.z;
}
// ------------------

// Helper: read raw depth buffer value (0..1) without linearization
fn getRawDepth(uv: vec2<f32>) -> f32 {
    let dim = textureDimensions(depthTex);
    let coords = vec2<i32>(floor(uv * vec2<f32>(dim)));
    return textureLoad(depthTex, coords, 0);
}

fn getNormal(uv: vec2<f32>) -> vec3<f32> {
    let dim = textureDimensions(normalTex);
    let coords = vec2<i32>(floor(uv * vec2<f32>(dim)));
    return textureLoad(normalTex, coords, 0).xyz * 2.0 - 1.0;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let sceneColor = textureSample(inputTex, s, uv).rgb;

    // --- SKY GUARD: skip outline for skybox / far-plane pixels ---
    let rawDepthCenter = getRawDepth(uv);
    if (rawDepthCenter >= 0.9999) {
        // Sky pixel — return scene color untouched
        return vec4(sceneColor, 1.0);
    }

    let dim = vec2<f32>(textureDimensions(inputTex));
    let texelSize = vec2<f32>(1.0 / dim.x, 1.0 / dim.y);
    let offset = texelSize * params.thickness;

    // --- Raw depth of 4 neighbors (for sky detection) ---
    let rawTop    = getRawDepth(uv + vec2(0.0, -offset.y));
    let rawBottom = getRawDepth(uv + vec2(0.0, offset.y));
    let rawLeft   = getRawDepth(uv + vec2(-offset.x, 0.0));
    let rawRight  = getRawDepth(uv + vec2(offset.x, 0.0));
    let anySky = max(max(step(0.9999, rawTop), step(0.9999, rawBottom)),
                     max(step(0.9999, rawLeft), step(0.9999, rawRight)));

    // --- SOBEL PROFONDEUR (relative comparison) ---
    // Use relative depth diff so distant terrain doesn't trigger false edges
    let dCenter = getLinearDepth(uv);
    let dTop    = getLinearDepth(uv + vec2(0.0, -offset.y));
    let dBottom = getLinearDepth(uv + vec2(0.0, offset.y));
    let dLeft   = getLinearDepth(uv + vec2(-offset.x, 0.0));
    let dRight  = getLinearDepth(uv + vec2(offset.x, 0.0));

    // Normalize by center depth: a 1-unit diff at 100m distance is negligible,
    // but the same diff at 1m distance is a real silhouette edge.
    let depthDiff = (abs(dTop - dBottom) + abs(dLeft - dRight)) / max(dCenter, 0.1);
    let depthEdge = step(params.depthThreshold, depthDiff);

    var normalEdge = 0.0;
    if (anySky < 0.5) {
        let nCenter = getNormal(uv);
        let nTop    = getNormal(uv + vec2(0.0, -offset.y));
        let nBottom = getNormal(uv + vec2(0.0, offset.y));
        let nLeft   = getNormal(uv + vec2(-offset.x, 0.0));
        let nRight  = getNormal(uv + vec2(offset.x, 0.0));

        let normalDiff = distance(nTop, nBottom) + distance(nLeft, nRight);
        normalEdge = step(params.normalThreshold, normalDiff);
    }

    // --- COMBINAISON ---
    // At sky boundary, only use depth edge (silhouette), skip normal edge
    let edge = select(max(depthEdge, normalEdge), depthEdge, anySky > 0.5);

    let lineColor = vec3(params.colorR, params.colorG, params.colorB);
    let finalColor = mix(sceneColor, lineColor, edge);

    return vec4(finalColor, 1.0);
}