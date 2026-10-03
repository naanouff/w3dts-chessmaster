/**
 * @file Fragment shader for pre-calculating the BRDF LUT.
 * Based on Google Filament implementation (DFG term).
 * Numerically stable using V_SmithGGXCorrelated.
 */

const PI: f32 = 3.14159265359;
const SAMPLE_COUNT: u32 = 1024u;

// --- Inversion de bits manuelle (Van Der Corput) ---
// Compatible avec tous les backends (Vulkan/DX12/Metal)
fn RadicalInverse_VdC(bits_in: u32) -> f32 {
    var bits = bits_in;
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return f32(bits) * 2.3283064365386963e-10;
}

fn Hammersley(i: u32, N: u32) -> vec2<f32> {
    return vec2<f32>(f32(i) / f32(N), RadicalInverse_VdC(i));
}

fn ImportanceSampleGGX(Xi: vec2<f32>, roughness: f32, N: vec3<f32>) -> vec3<f32> {
    let a = roughness * roughness;
    let phi = 2.0 * PI * Xi.x;
    let cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a * a - 1.0) * Xi.y));
    let sinTheta = sqrt(1.0 - cosTheta * cosTheta);

    let H = vec3<f32>(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
    
    // Tangent space (Z-up)
    let up = select(vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 1.0, 0.0), abs(N.z) < 0.999);
    let tangent = normalize(cross(up, N));
    let bitangent = cross(N, tangent);

    return normalize(tangent * H.x + bitangent * H.y + N * H.z);
}

// Visibility term (Smith Correlated)
// Heuristic stable: V = 0.5 / (NdotL * sqrt(...) + NdotV * sqrt(...))
fn V_SmithGGXCorrelated(NdotV: f32, NdotL: f32, roughness: f32) -> f32 {
    let a2 = roughness * roughness * roughness * roughness; // alpha^2 = roughness^4 dans certaines impl, mais ici restons sur a = roughness^2
    let alpha = roughness * roughness;
    let lambdaV = NdotL * sqrt((NdotV - alpha * NdotV) * NdotV + alpha);
    let lambdaL = NdotV * sqrt((NdotL - alpha * NdotL) * NdotL + alpha);
    return 0.5 / (lambdaV + lambdaL + 0.00001);
}

@fragment
fn main(@location(0) uv_in: vec2<f32>) -> @location(0) vec2<f32> {
    // Clamp pour éviter les bords exacts (0.0 ou 1.0)
    // Karis / Filament: U = NdotV, V = perceptual roughness (sample with vec2(NdotV, roughness)).
    // Do not invert V: fullscreen.vert already flips Y for the top-left texture origin.
    // The old `1.0 - uv.y` made roughness=0 read the rough texel → SpecularTest rows 1–6 went black.
    let NdotV = clamp(uv_in.x, 0.001, 0.999);
    let roughness = clamp(uv_in.y, 0.001, 0.999); 

    let V = vec3<f32>(sqrt(1.0 - NdotV * NdotV), 0.0, NdotV);
    let N = vec3<f32>(0.0, 0.0, 1.0);

    var A: f32 = 0.0;
    var B: f32 = 0.0;

    for (var i: u32 = 0u; i < SAMPLE_COUNT; i = i + 1u) {
        let Xi = Hammersley(i, SAMPLE_COUNT);
        let H = ImportanceSampleGGX(Xi, roughness, N);
        let L = normalize(2.0 * dot(V, H) * H - V);

        let NdotL = max(L.z, 0.0);
        let NdotH = max(H.z, 0.0);
        let VdotH = max(dot(V, H), 0.0);

        if (NdotL > 0.0) {
            // Terme de Visibilité Correlé (Plus stable que G / (4*...))
            let Vis = V_SmithGGXCorrelated(NdotV, NdotL, roughness);
            
            // PDF implicite dans l'importance sampling: D * NdotH / (4 * VdotH)
            // Le poids final du split sum devient : (F * G_Vis * VdotH) / NdotH
            // Avec G_Vis = Vis * 4 * NdotL * NdotV, on simplifie :
            
            let NdotL_Vis_PDF = NdotL * Vis * (4.0 * VdotH / NdotH);
            
            let Fc = pow(1.0 - VdotH, 5.0);
            A += (1.0 - Fc) * NdotL_Vis_PDF;
            B += Fc * NdotL_Vis_PDF;
        }
    }

    return vec2<f32>(A / f32(SAMPLE_COUNT), B / f32(SAMPLE_COUNT));
}