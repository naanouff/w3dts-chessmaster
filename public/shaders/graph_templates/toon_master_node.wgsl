// =============================================================================
// === TOON MASTER NODE (Hatched Cel-Shading — "A New Life" Style) ===
// =============================================================================
//
// Produces a cel-shaded look with:
//   1. Quantised diffuse lighting (2-4 discrete bands)
//   2. Procedural hatching pattern in shadowed regions
//   3. Warm/cool colour shift between lit and shadow areas
//   4. Fresnel rim highlight
//
// Inputs (injected from ShaderGraph via {{...}} placeholders):
//   {{albedo}}                 – vec4<f32> base colour + alpha
//   {{opacity_factor}}         – f32
//   {{roughness_factor}}       – f32 (unused for toon, kept for graph compat)
//   {{shadow_quantization}}    – f32 number of discrete light bands (2–4)
//   {{hatching_intensity}}     – f32 0.0 = no hatching, 1.0 = full hatching
//   {{hatching_scale}}         – f32 tiling frequency of hatch pattern
//   {{rim_power}}              – f32 Fresnel exponent for rim light
//   {{rim_intensity}}          – f32 brightness of the rim highlight

// --- 1. Input Extraction ---

let albedo_sample = {{albedo}};
let albedo = albedo_sample.rgb;
let opacity_factor = {{opacity_factor}};
let alpha = albedo_sample.a * opacity_factor;

let shadow_quantization = {{shadow_quantization}};   // e.g. 3.0
let hatching_intensity  = {{hatching_intensity}};     // e.g. 0.6
let hatching_scale      = {{hatching_scale}};         // e.g. 1.0
let rim_power           = {{rim_power}};              // e.g. 3.0
let rim_intensity       = {{rim_intensity}};          // e.g. 0.4

// --- 2. View & Light Vectors ---

let V = normalize(frame.cameraPosition - input.world_position);
let N = normalize(input.world_normal);

// --- 3. Multi-Light Cel-Shaded Diffuse ---

var totalNdotL: f32 = 0.0;
var totalContrib: f32 = 0.0;
var minShadowFactor: f32 = 1.0;
var lightColor_acc = vec3<f32>(0.0);

let clTilesX = max(lightClusters[0u], 1u);
let clTilesY = max(lightClusters[1u], 1u);
let clTileSize = max(lightClusters[2u], 1u);
let clMaxPer = lightClusters[3u];
let clPx = vec2<u32>(input.clip_position.xy);
let clTx = min(clPx.x / clTileSize, clTilesX - 1u);
let clTy = min(clPx.y / clTileSize, clTilesY - 1u);
let clTile = clTy * clTilesX + clTx;
let clBase = 4u + clTile * (1u + clMaxPer);
let clCount = lightClusters[clBase];
for (var clSlot: u32 = 0u; clSlot < clCount; clSlot = clSlot + 1u) {
    let i = lightClusters[clBase + 1u + clSlot];
    let rawLight = sceneLights.lights[i];

    let position  = rawLight.positionAndRange.xyz;
    let range     = rawLight.positionAndRange.w;
    let direction = rawLight.dirAndIntensity.xyz;
    let intensity = rawLight.dirAndIntensity.w;
    let color     = rawLight.colorAndType.rgb;
    let lightType = u32(rawLight.colorAndType.w + 0.1);

    let innerConeCos = rawLight.params.x;
    let outerConeCos = rawLight.params.y;

    var dirToLight: vec3<f32>;
    var attenuation: f32 = 1.0;

    if (lightType == 0u) {
        dirToLight = normalize(-direction);
        attenuation = 1.0;
    } else if (lightType == 1u) {
        let off = position - input.world_position;
        let dist = length(off);
        dirToLight = normalize(off);
        attenuation = getPointLightAttenuation(dist, range);
    } else if (lightType == 2u) {
        let off = position - input.world_position;
        let dist = length(off);
        dirToLight = normalize(off);
        let dAtt = getPointLightAttenuation(dist, range);
        let cAtt = getSpotLightAttenuation(dirToLight, direction, innerConeCos, outerConeCos);
        attenuation = dAtt * cAtt;
    } else {
        dirToLight = vec3<f32>(0.0, 1.0, 0.0);
        attenuation = 0.0;
    }

    if (attenuation > 0.0001) {
        let NdotL = max(dot(N, dirToLight), 0.0);

        // Shadow
        var shadow: f32 = 1.0;
        if (rawLight.params.z > -0.5) {
            let shadowIdx = i32(rawLight.params.z + 0.1);
            shadow = fetchShadow(lightType, shadowIdx, input.world_position, N, NdotL, position);
            minShadowFactor = min(minShadowFactor, shadow);
        }

        let geoFactor = NdotL * attenuation * shadow;
        totalNdotL += geoFactor;
        let scaledContrib = geoFactor * intensity;
        totalContrib += scaledContrib;
        lightColor_acc += color * scaledContrib;
    }
}

// Normalise accumulated light colour (use intensity-scaled contrib for proper color)
let lightColorNorm = select(
    lightColor_acc / max(totalContrib, 0.001),
    vec3<f32>(1.0),
    totalContrib < 0.001
);

// --- 4. Quantise Diffuse into Discrete Bands ---
// totalNdotL is the geometric factor only (no intensity), stays in [0,1]
let rawLighting = clamp(totalNdotL, 0.0, 1.0);
let bands = max(shadow_quantization, 1.0);
let quantised = floor(rawLighting * bands) / bands;

// --- 5. Warm/Cool Colour Shift + Brightness ---
// Lit areas get a warm tint, shadow areas get a cool desaturated tint.
// toonBrightness maps the quantised band to an actual luminance level
// so that shadow regions are visibly darker than lit regions.
let warmShift = vec3<f32>(1.05, 1.0, 0.92);   // yellowish warmth
let coolShift = vec3<f32>(0.75, 0.78, 0.88);   // blueish cool
let toonBrightness = mix(0.35, 1.0, quantised);

let toonColor = albedo * toonBrightness * mix(coolShift, warmShift, quantised) * lightColorNorm;

// --- 6. Procedural Hatching (anti-aliased) ---
// World-space line pattern whose stroke width adapts to screen-space pixel size
// via fwidth(), eliminating moiré at distance.

let hatchUV = input.world_position.xz * hatching_scale * 3.0
            + input.world_position.xy * hatching_scale * 1.5;

// Phase of each hatch layer (different angles for cross-hatch)
let phase1 = hatchUV.x * 40.0 + hatchUV.y * 10.0;
let phase2 = hatchUV.x * 10.0 - hatchUV.y * 40.0;
let phase3 = (hatchUV.x + hatchUV.y) * 30.0;

// fwidth gives the screen-space rate of change — the wider the derivative
// relative to the sin period, the more the pattern aliases → use it to
// widen the smoothstep transition ("analytic anti-aliasing").
let fw1 = fwidth(phase1);
let fw2 = fwidth(phase2);
let fw3 = fwidth(phase3);

let h1 = sin(phase1);
let h2 = sin(phase2);
let h3 = sin(phase3);

// smoothstep edge scaled by derivative: when fw ≈ period the line
// dissolves to a uniform grey instead of flickering.
let aa1 = smoothstep(-fw1, fw1, h1);
let aa2 = smoothstep(-fw2, fw2, h2);
let aa3 = smoothstep(-fw3, fw3, h3);

// Distance fade — beyond a threshold the hatching intensity gently ramps
// to zero so that very distant surfaces stay clean.
let camDist = length(frame.cameraPosition - input.world_position);
let distFade = 1.0 - smoothstep(60.0, 150.0, camDist);

// Combine layers based on shadow depth
let shadowDepth = 1.0 - quantised;  // 0 = fully lit, 1 = fully dark

// Layer thresholds: deeper shadow → more layers
let layer1 = select(0.0, aa1 * 0.35, shadowDepth > 0.15);
let layer2 = select(0.0, aa2 * 0.30, shadowDepth > 0.45);
let layer3 = select(0.0, aa3 * 0.25, shadowDepth > 0.70);

let hatchMask = clamp((layer1 + layer2 + layer3) * distFade, 0.0, 1.0);
let hatchDarken = 1.0 - hatchMask * hatching_intensity;

// --- 7. Fresnel Rim Light ---
let NdotV = max(dot(N, V), 0.0);
let rimFactor = pow(1.0 - NdotV, rim_power) * rim_intensity;
let rimColor = vec3<f32>(1.0, 0.98, 0.9) * rimFactor;

// --- 8. Ambient ---
let ambient = albedo * 0.12;

// --- 9. Final Composite ---
var final_color = toonColor * hatchDarken + ambient + rimColor;
var final_alpha = alpha;
var shadow_factor_out = minShadowFactor;
