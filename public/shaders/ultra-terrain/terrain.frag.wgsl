// Ultra Terrain — Fragment Shader
//
// Phase 3: 4-layer height-blend + normal maps + path mask overlay
//           + macro noise + distance UV scaling + tri-planar on steep slopes
//
// Binding groups (see TerrainPipelineService for the GPUBindGroupLayout):
//   group(0) binding(0)  FrameUniforms  — camera, lights, time, CSM splits
//   group(1) binding(0)  TerrainMorphUniforms   (shared with vertex shader)
//   group(1) binding(1)  TerrainShadingUniforms — all shading parameters
//   group(1) binding(2)  textureSampler
//   group(1) binding(3)  albedoArray    — texture_2d_array<f32>  (4 layers)
//   group(1) binding(4)  normalArray    — texture_2d_array<f32>  (4 layers, RG encoded)
//   group(1) binding(5)  ormArray       — texture_2d_array<f32>  (4 layers: R=AO G=Rough B=Metal)
//   group(1) binding(6)  pathMaskTex    — texture_2d<f32>  (R = path mask)
//   group(1) binding(7)  macroNoiseTex  — texture_2d<f32>  (R = low-freq world-space noise)
//   group(2) binding(0)  shadowMap      — texture_depth_2d_array  (CSM cascades)
//   group(2) binding(1)  shadowSampler  — sampler_comparison
//   group(2) binding(2)  shadowData     — ShadowUniforms

#include "../shared/math_common.wgsl"
#include "../shared/terrain_functions.wgsl"
#include "../shared/noise_functions.wgsl"

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

struct FrameUniforms {
    projectionMatrix            : mat4x4<f32>,
    viewMatrix                  : mat4x4<f32>,
    inverseViewProjectionMatrix : mat4x4<f32>,
    cameraPosition              : vec3<f32>,
    @size(64) lightMatrix       : mat4x4<f32>,
    lightDirection              : vec3<f32>,
    lightColor                  : vec3<f32>,
    ambientLightIntensity       : f32,
    debugViewMode               : u32,
    totalTime                   : f32,
    cascadeSplits               : vec4<f32>,
};

struct ShadowUniforms {
    matrices: array<mat4x4<f32>, 16>,
};

struct TerrainMorphUniforms {
    lodMorph : f32,
    _pad0    : f32,
    _pad1    : f32,
    _pad2    : f32,
};

/// Per-material shading parameters uploaded once per frame by TerrainSystem.
struct TerrainShadingUniforms {
    /// World-space UV frequency for the near (detail) sample.
    nearUvScale          : f32,
    /// World-space UV frequency for the far (low-res) sample.
    farUvScale           : f32,
    /// Camera distance (world units) where far-UV blending begins.
    distBlendStart       : f32,
    /// Camera distance (world units) where far-UV blending is complete.
    distBlendEnd         : f32,
    /// World-space frequency of the macro noise texture.
    macroNoiseScale      : f32,
    /// Macro noise darkening strength [0, 1].
    macroNoiseStrength   : f32,
    /// Sharpness of height-based layer blending (higher = crisper edges).
    heightBlendSharpness : f32,
    /// World-normal Y threshold for tri-planar blending (e.g. 0.5 ≈ 60° slope).
    slopeThreshold       : f32,
    /// World Y of each layer's centre height (layers 0-3).
    layerHeights         : vec4<f32>,
    /// Half-range of each layer's blend zone (layers 0-3).
    layerRanges          : vec4<f32>,
    /// UV scale for the global path mask (worldPos.xz * pathMaskWorldScale).
    pathMaskWorldScale   : f32,
    /// Overall path mask blend strength [0, 1].
    pathMaskStrength     : f32,
    /// Roughness value applied to path surfaces [0, 1].
    pathRoughness        : f32,
    _pad                 : f32,
    /// Albedo tint to apply on path surfaces (RGB used, A ignored).
    pathTint             : vec4<f32>,
    /// Heightmap origin XZ + world size for debug overlay UVs (TER-A7).
    debugOriginX         : f32,
    debugOriginZ         : f32,
    debugWorldSize       : f32,
    _padDebug            : f32,
};

struct VertexOutput {
    @builtin(position) clipPosition : vec4<f32>,
    @location(0)       worldPos     : vec3<f32>,
    @location(1)       uv0          : vec2<f32>,
    @location(2)       uv1          : vec2<f32>,
    @location(3)       normal       : vec3<f32>,
    @location(4)       tangent      : vec3<f32>,
    @location(5)       bitangent    : vec3<f32>,
    @location(6)       color        : vec4<f32>,
    @location(7)       shadowPos    : vec4<f32>,
};

struct FragmentOutput {
    @location(0) color : vec4<f32>,
};

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

@group(0) @binding(0) var<uniform> frame         : FrameUniforms;
@group(1) @binding(0) var<uniform> morph         : TerrainMorphUniforms;
@group(1) @binding(1) var<uniform> sp            : TerrainShadingUniforms;
@group(1) @binding(2) var          textureSampler : sampler;
@group(1) @binding(3) var          albedoArray   : texture_2d_array<f32>;
@group(1) @binding(4) var          normalArray   : texture_2d_array<f32>;
@group(1) @binding(5) var          ormArray      : texture_2d_array<f32>;
@group(1) @binding(6) var          pathMaskTex   : texture_2d<f32>;
@group(1) @binding(7) var          macroNoiseTex : texture_2d<f32>;
@group(2) @binding(0) var          shadowMap     : texture_depth_2d_array;
@group(2) @binding(1) var          shadowSampler : sampler_comparison;
@group(2) @binding(2) var<uniform> shadowData    : ShadowUniforms;

// ---------------------------------------------------------------------------
// Inline PBR helpers (subset of pbr_functions.wgsl needed for terrain)
// These reference the module-level `frame`, `shadowMap`, `shadowSampler`,
// and `shadowData` bindings above.
// ---------------------------------------------------------------------------

fn terrain_getCascadeIndex(worldPos: vec3<f32>) -> i32 {
    let viewPos = frame.viewMatrix * vec4<f32>(worldPos, 1.0);
    let depth   = -viewPos.z;
    if (depth < frame.cascadeSplits.x) { return 0; }
    if (depth < frame.cascadeSplits.y) { return 1; }
    if (depth < frame.cascadeSplits.z) { return 2; }
    return 3;
}

fn terrain_fetchShadow(worldPos: vec3<f32>, worldNormal: vec3<f32>, NdotL: f32) -> f32 {
    let cascadeIdx       = terrain_getCascadeIndex(worldPos);
    let lightMatrix      = shadowData.matrices[cascadeIdx];
    let slope            = clamp(1.0 - NdotL, 0.0, 1.0);
    let biasedWorldPos   = worldPos + worldNormal * (0.006 * slope + 0.0015);
    let shadowPos        = lightMatrix * vec4<f32>(biasedWorldPos, 1.0);
    let shadowNDC        = shadowPos.xyz / shadowPos.w;
    let uv               = vec2<f32>(shadowNDC.x * 0.5 + 0.5, -shadowNDC.y * 0.5 + 0.5);

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ||
        shadowNDC.z < 0.0 || shadowNDC.z > 1.0) {
        return 1.0;
    }

    let depthBias    = max(0.00028 * (1.0 - NdotL), 0.0001);
    let currentDepth = shadowNDC.z - depthBias;
    // Same PCSS as fetchShadow (directional). Constants: packages/core/src/rendering/pcss.ts.
    let dims = vec2<f32>(textureDimensions(shadowMap));
    let search = 0.006;
    var blockerSum = 0.0;
    var blockerCount = 0.0;
    for (var bj: i32 = 0; bj < 4; bj = bj + 1) {
        for (var bi: i32 = 0; bi < 4; bi = bi + 1) {
            let ox = (f32(bi) - 1.5) / 1.5 * search;
            let oy = (f32(bj) - 1.5) / 1.5 * search;
            let su = clamp(uv.x + ox, 0.0, 0.999);
            let sv = clamp(uv.y + oy, 0.0, 0.999);
            let texel = vec2<i32>(vec2<f32>(su, sv) * dims);
            let blockerDepth = textureLoad(shadowMap, texel, cascadeIdx, 0);
            if (blockerDepth < currentDepth) {
                blockerSum += blockerDepth;
                blockerCount += 1.0;
            }
        }
    }
    let avgBlocker = blockerSum / max(blockerCount, 1.0);
    let gap = max(currentDepth - avgBlocker, 0.0);
    let radius = select(0.00055, clamp(gap * 0.04, 0.00055, 0.008), blockerCount >= 1.0);
    let step = radius * 0.5;
    let u0 = clamp(uv.x, 0.0001, 0.9999);
    let v0 = clamp(uv.y, 0.0001, 0.9999);
    var sum = 0.0;
    for (var j: i32 = -2; j <= 2; j = j + 1) {
        for (var i: i32 = -2; i <= 2; i = i + 1) {
            sum += textureSampleCompareLevel(
                shadowMap, shadowSampler,
                vec2(clamp(u0 + f32(i) * step, 0.0001, 0.9999), clamp(v0 + f32(j) * step, 0.0001, 0.9999)),
                cascadeIdx, currentDepth
            );
        }
    }
    return select(1.0, sum / 25.0, blockerCount >= 1.0);
}

fn terrain_D_GGX(NdotH: f32, roughness: f32) -> f32 {
    let a  = roughness * roughness;
    let a2 = a * a;
    let d  = NdotH * NdotH * (a2 - 1.0) + 1.0;
    return a2 / max(PI * d * d, 0.0000001);
}

fn terrain_G_SchlickGGX(NdotX: f32, roughness: f32) -> f32 {
    let k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
    return NdotX / (NdotX * (1.0 - k) + k);
}

fn terrain_G_Smith(NdotV: f32, NdotL: f32, roughness: f32) -> f32 {
    return terrain_G_SchlickGGX(NdotV, roughness) * terrain_G_SchlickGGX(NdotL, roughness);
}

// ---------------------------------------------------------------------------
// Tri-planar sampling for texture_2d_array
// ---------------------------------------------------------------------------

fn voronoi2(p: vec2f) -> f32 {
    let n = floor(p);
    let f = fract(p);
    var md = 8.0;
    for (var j = -1; j <= 1; j++) {
        for (var i = -1; i <= 1; i++) {
            let g = vec2f(f32(i), f32(j));
            let o = vec2f(random_val(n + g), random_val(n + g + vec2f(3.1, 7.4)));
            md = min(md, length(g + o - f));
        }
    }
    return md;
}

/// Procedural layer looks (TER-A3 option 1). rgb = albedo, a = roughness.
fn procGrass(p: vec3f) -> vec4f {
    let n = fractal_noise(p.xz * 0.22, 4u);
    let n2 = fractal_noise(p.xz * 1.6 + vec2f(11.0, 4.0), 3u);
    let lush = vec3f(0.12, 0.48, 0.14);
    let dry = vec3f(0.42, 0.38, 0.12);
    let shade = vec3f(0.06, 0.24, 0.08);
    var c = mix(lush, dry, smoothstep(0.35, 0.75, n));
    c = mix(c, shade, n2 * 0.35);
    return vec4f(c, 0.78);
}

fn procDirt(p: vec3f) -> vec4f {
    let n = fractal_noise(p.xz * 0.45, 4u);
    let wet = vec3f(0.34, 0.24, 0.14);
    let sand = vec3f(0.68, 0.54, 0.28);
    return vec4f(mix(wet, sand, n), 0.88);
}

fn procRock(p: vec3f) -> vec4f {
    let cells = voronoi2(p.xz * 0.35 + p.y * 0.08);
    let n = fractal_noise_3d(p * 0.4, 3u);
    let dark = vec3f(0.22, 0.22, 0.24);
    let lite = vec3f(0.48, 0.47, 0.46);
    var c = mix(dark, lite, n);
    c *= mix(0.72, 1.0, smoothstep(0.05, 0.35, cells));
    return vec4f(c, 0.62);
}

fn procSnow(p: vec3f) -> vec4f {
    let n = fractal_noise(p.xz * 0.18, 3u);
    let spark = value_noise(p.xz * 6.0);
    let c = mix(vec3f(0.78, 0.82, 0.86), vec3f(0.94, 0.96, 0.98), n);
    return vec4f(c + spark * 0.04, 0.42);
}

fn procLayer(layer: i32, p: vec3f) -> vec4f {
    if (layer == 1) { return procDirt(p); }
    if (layer == 2) { return procRock(p); }
    if (layer == 3) { return procSnow(p); }
    return procGrass(p);
}

/// Procedural heightfield used as a bump / normal source (same frequencies as albedo).
fn terrainBumpHeight(p: vec3f, w: vec4f) -> f32 {
    let macroN = fractal_noise(p.xz * 0.18, 4u);
    let mid   = fractal_noise(p.xz * 0.85 + vec2f(5.1, 2.7), 3u);
    let fine  = value_noise(p.xz * 3.6);
    let cells = voronoi2(p.xz * 0.52 + p.y * 0.07);
    let peb   = voronoi2(p.xz * 2.15);
    let grassH = macroN * 0.38 + mid * 0.34 + fine * 0.18 + (1.0 - peb) * 0.18;
    let dirtH  = mid * 0.5 + (1.0 - peb) * 0.5;
    let rockH  = fractal_noise_3d(p * 0.36, 3u) * 0.32 + smoothstep(0.02, 0.26, cells);
    let snowH  = macroN * 0.62 + fine * 0.22;
    return grassH * w.x + dirtH * w.y + rockH * w.z + snowH * w.w;
}

fn bumpNormalFromHeight(
    p: vec3f,
    nGeo: vec3f,
    w: vec4f,
    eps: f32,
    strength: f32
) -> vec3f {
    let h  = terrainBumpHeight(p, w);
    let hx = terrainBumpHeight(p + vec3f(eps, 0.0, 0.0), w);
    let hz = terrainBumpHeight(p + vec3f(0.0, 0.0, eps), w);
    let hy = terrainBumpHeight(p + vec3f(0.0, eps, 0.0), w);
    let dhx = (hx - h) / eps;
    let dhy = (hy - h) / eps;
    let dhz = (hz - h) / eps;
    // Triplanar: XZ on flats, YZ / XY on cliffs — all perturb the geometric normal.
    var axis = abs(nGeo);
    axis = pow(axis, vec3f(4.0));
    axis /= axis.x + axis.y + axis.z + 0.0001;
    let nXz = vec3f(-dhx, 1.0, -dhz);
    let nYz = vec3f(1.0, -dhy, -dhz);
    let nXy = vec3f(-dhx, -dhy, 1.0);
    let nH  = normalize(nXz * axis.y + nYz * axis.x + nXy * axis.z);
    return normalize(mix(nGeo, normalize(nGeo + nH - vec3f(0.0, 1.0, 0.0)), clamp(strength, 0.0, 1.6)));
}

/// Tri-planar procedural albedo (steep slopes).
fn tpAlbedo(worldPos: vec3<f32>, worldNorm: vec3<f32>, layer: i32, uvScale: f32) -> vec3<f32> {
    var w = pow(abs(worldNorm), vec3f(4.0));
    w /= w.x + w.y + w.z + 0.0001;
    let s  = worldPos * uvScale;
    let cy = procLayer(layer, vec3f(s.x, worldPos.y, s.z)).rgb;
    let cx = procLayer(layer, vec3f(s.z, worldPos.y, s.y)).rgb;
    let cz = procLayer(layer, vec3f(s.x, worldPos.y, s.y)).rgb;
    return cy * w.y + cx * w.x + cz * w.z;
}


/// Tri-planar ORM from procedural roughness (AO=1, metal=0).
fn tpOrm(worldPos: vec3<f32>, worldNorm: vec3<f32>, layer: i32, uvScale: f32) -> vec3<f32> {
    var w = pow(abs(worldNorm), vec3f(4.0));
    w /= w.x + w.y + w.z + 0.0001;
    let s  = worldPos * uvScale;
    let cy = procLayer(layer, vec3f(s.x, worldPos.y, s.z)).a;
    let cx = procLayer(layer, vec3f(s.z, worldPos.y, s.y)).a;
    let cz = procLayer(layer, vec3f(s.x, worldPos.y, s.y)).a;
    let rough = cy * w.y + cx * w.x + cz * w.z;
    return vec3f(1.0, rough, 0.0);
}

// ---------------------------------------------------------------------------
// Layer height weight
// ---------------------------------------------------------------------------

fn layerW(worldY: f32, centre: f32, range: f32) -> f32 {
    return clamp(1.0 - abs(worldY - centre) / max(range, 0.001), 0.0, 1.0);
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// ACES filmic tone mapping (outputs to LDR FINAL_OUTPUT canvas)
// ---------------------------------------------------------------------------
fn aces_tonemap(x: vec3f) -> vec3f {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}

// Fragment entry point
// ---------------------------------------------------------------------------

@fragment
fn main(input: VertexOutput) -> FragmentOutput {
    var output: FragmentOutput;

    // ------------------------------------------------------------------
    // 1. UV coordinates — near/far blend based on camera distance
    // ------------------------------------------------------------------
    let camDist = length(frame.cameraPosition - input.worldPos);
    let distT   = smoothstep(sp.distBlendStart, sp.distBlendEnd, camDist);

    // Stochastic near UVs for anti-tiling; standard far UVs for large-scale detail
    let uvNear  = stochastic_uv(input.worldPos.xz * sp.nearUvScale, 1.0);
    let uvFar   = input.worldPos.xz * sp.farUvScale;
    let terrainUv = mix(uvNear, uvFar, distT);

    // ------------------------------------------------------------------
    // 2. Slope detection — blend in tri-planar on steep surfaces
    // ------------------------------------------------------------------
    let N_geo      = normalize(input.normal);
    let slopeBlend = clamp((sp.slopeThreshold - abs(N_geo.y))
                           / max(sp.slopeThreshold * 0.3, 0.001), 0.0, 1.0);
    // doTriplanar guard removed — textureSample must be in uniform control flow.
    // When slopeBlend == 0, mix(x, tpX, 0.0) == x, so the result is identical.

    // ------------------------------------------------------------------
    // 3. Height-based layer weights (grass / dirt / rock / snow)
    // ------------------------------------------------------------------
    var baseW: vec4<f32>;
    baseW.x = layerW(input.worldPos.y, sp.layerHeights.x, sp.layerRanges.x);
    baseW.y = layerW(input.worldPos.y, sp.layerHeights.y, sp.layerRanges.y);
    baseW.z = layerW(input.worldPos.y, sp.layerHeights.z, sp.layerRanges.z);
    baseW.w = layerW(input.worldPos.y, sp.layerHeights.w, sp.layerRanges.w);

    // Steep slopes prefer rock over grass.
    let steep = clamp((0.72 - abs(N_geo.y)) / 0.32, 0.0, 1.0);
    baseW.z += steep * 0.85;
    baseW.x *= 1.0 - steep * 0.75;
    baseW.w *= 1.0 - steep * 0.55;

    // Soft noise edges so bands are not perfectly horizontal.
    let edge = (fractal_noise(terrainUv * 6.0, 3u) - 0.5) * 0.22;
    let ha = 0.5 + edge;
    let hb = 0.5 + edge * 0.6;
    let hc = 0.5 + (1.0 - edge) * 0.15;
    let hd = 0.5;
    let blendW = compute_height_blend_weights(vec4f(ha, hb, hc, hd), baseW, sp.heightBlendSharpness);

    // ------------------------------------------------------------------
    // 4. Procedural albedo (flat + tri-planar on steep slopes)
    // ------------------------------------------------------------------
    let look0 = procGrass(input.worldPos);
    let look1 = procDirt(input.worldPos);
    let look2 = procRock(input.worldPos);
    let look3 = procSnow(input.worldPos);
    var a0 = look0.rgb;
    var a1 = look1.rgb;
    var a2 = look2.rgb;
    var a3 = look3.rgb;

    a0 = mix(a0, tpAlbedo(input.worldPos, N_geo, 0, sp.nearUvScale), slopeBlend);
    a1 = mix(a1, tpAlbedo(input.worldPos, N_geo, 1, sp.nearUvScale), slopeBlend);
    a2 = mix(a2, tpAlbedo(input.worldPos, N_geo, 2, sp.nearUvScale), slopeBlend);
    a3 = mix(a3, tpAlbedo(input.worldPos, N_geo, 3, sp.nearUvScale), slopeBlend);
    var albedo = a0 * blendW.x + a1 * blendW.y + a2 * blendW.z + a3 * blendW.w;

    // ------------------------------------------------------------------
    // 5. Procedural ORM (AO=1, metal=0)
    // ------------------------------------------------------------------
    var orm0 = vec3f(1.0, look0.a, 0.0);
    var orm1 = vec3f(1.0, look1.a, 0.0);
    var orm2 = vec3f(1.0, look2.a, 0.0);
    var orm3 = vec3f(1.0, look3.a, 0.0);

    orm0 = mix(orm0, tpOrm(input.worldPos, N_geo, 0, sp.nearUvScale), slopeBlend);
    orm1 = mix(orm1, tpOrm(input.worldPos, N_geo, 1, sp.nearUvScale), slopeBlend);
    orm2 = mix(orm2, tpOrm(input.worldPos, N_geo, 2, sp.nearUvScale), slopeBlend);
    orm3 = mix(orm3, tpOrm(input.worldPos, N_geo, 3, sp.nearUvScale), slopeBlend);
    let orm    = orm0 * blendW.x + orm1 * blendW.y + orm2 * blendW.z + orm3 * blendW.w;
    var ao       = orm.r;
    var roughness = clamp(orm.g, 0.04, 1.0);
    let metallic  = clamp(orm.b, 0.0,  1.0);

    // ------------------------------------------------------------------
    // 6. Procedural height bump → world normal (reads as a normal / height map)
    // ------------------------------------------------------------------
    let bumpH = terrainBumpHeight(input.worldPos, blendW);
    let bumpStrength = mix(0.72, 1.25, blendW.z) * mix(1.0, 0.28, distT);
    var N = bumpNormalFromHeight(input.worldPos, N_geo, blendW, 0.16, bumpStrength);
    let micro = (value_noise(input.worldPos.xz * 9.0) - 0.5) * mix(0.28, 0.06, distT);
    N = normalize(N + vec3f(micro, 0.0, micro * 0.7));
    ao *= mix(0.58, 1.0, smoothstep(0.18, 0.72, bumpH));
    roughness = mix(roughness, clamp(roughness + (1.0 - bumpH) * 0.12, 0.04, 1.0), 0.45);

    // ------------------------------------------------------------------
    // 7. Macro noise — low-frequency world-scale variation
    // ------------------------------------------------------------------
    let macroVal = textureSample(macroNoiseTex, textureSampler,
                                 input.worldPos.xz * sp.macroNoiseScale).r;
    // Remap to a darkening/brightening factor centred on 1.0
    let macroMod = 1.0 - sp.macroNoiseStrength * (0.5 - macroVal) * 2.0;
    albedo = albedo * clamp(macroMod, 0.2, 1.8);

    // ------------------------------------------------------------------
    // 8. Path mask overlay (world-space UV, R channel = mask weight)
    // ------------------------------------------------------------------
    let pathMask  = textureSample(pathMaskTex, textureSampler,
                                  input.worldPos.xz * sp.pathMaskWorldScale).r;
    let pathBlend = clamp(pathMask * sp.pathMaskStrength, 0.0, 1.0);
    albedo    = mix(albedo, sp.pathTint.rgb, pathBlend);
    roughness = mix(roughness, sp.pathRoughness, pathBlend);

    // ------------------------------------------------------------------
    // 9. PBR — single directional light + CSM shadows + ambient
    // ------------------------------------------------------------------
    let V     = normalize(frame.cameraPosition - input.worldPos);
    let L     = normalize(-frame.lightDirection);
    let H     = normalize(V + L);
    let NdotL = max(dot(N, L), 0.0);
    let NdotV = max(dot(N, V), 0.001);
    let NdotH = max(dot(N, H), 0.0);

    let F0  = mix(vec3f(0.04), albedo, metallic);
    let F   = F0 + (1.0 - F0) * pow(clamp(1.0 - dot(H, V), 0.0, 1.0), 5.0);
    let NDF = terrain_D_GGX(NdotH, roughness);
    let G   = terrain_G_Smith(NdotV, NdotL, roughness);

    // Specular attenuated for terrain (minimal glossy highlight)
    let specular = (NDF * G * F) / (4.0 * NdotV * NdotL + 0.0001) * 0.25;
    let diffuse  = albedo * (1.0 - metallic) * INV_PI;

    let shadow  = terrain_fetchShadow(input.worldPos, N, NdotL);
    let ambient = albedo * ao * frame.ambientLightIntensity;

    let litColor = (diffuse + specular) * NdotL * frame.lightColor * shadow + ambient;

    // ------------------------------------------------------------------
    // 10. Debug overlays (TER-A2 / TER-A7) — slope / flow / basin / channel / splat
    //     30 slope  31 flow  32 basin  33 channel  34 splat (vertex textureId)
    // ------------------------------------------------------------------
    if (frame.debugViewMode >= 30u && frame.debugViewMode <= 34u) {
        if (frame.debugViewMode == 34u) {
            let tid = input.color.r;
            var splat = vec3f(0.22, 0.55, 0.18);
            if (tid > 0.5 && tid < 1.5) { splat = vec3f(0.48, 0.44, 0.40); }
            else if (tid > 1.5 && tid < 2.5) { splat = vec3f(0.76, 0.66, 0.38); }
            else if (tid > 2.5) { splat = vec3f(0.88, 0.90, 0.92); }
            output.color = vec4f(splat, 1.0);
            return output;
        }
        var t = 0.0;
        if (frame.debugViewMode == 30u) {
            t = clamp(1.0 - abs(N_geo.y), 0.0, 1.0);
        }
        if (sp.debugWorldSize > 0.001) {
            let uv = (input.worldPos.xz - vec2f(sp.debugOriginX, sp.debugOriginZ))
                / max(sp.debugWorldSize, 0.001);
            let sampled = textureSample(pathMaskTex, textureSampler, uv).r;
            if (frame.debugViewMode != 30u) {
                t = sampled;
            } else {
                t = max(t, sampled);
            }
        }
        output.color = vec4f(t, t * 0.55, 1.0 - t, 1.0);
        return output;
    }

    output.color = vec4f(aces_tonemap(litColor), 1.0);
    return output;
}
