/**
 * @file Essential mathematical functions for the Physically Based Rendering (PBR) model.
 * This file is intended to be included in shaders for lighting calculations.
 * @author Cyril Tarriet
 */

/**
 * Calculates the GGX distribution for the Normal Distribution Function (NDF) term of the PBR equation.
 * This function describes the alignment of a surface's microfacets.
 * @param N The surface normal.
 * @param H The halfway vector.
 * @param roughness The material's roughness.
 * @returns The distribution value.
 */
fn DistributionGGX(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let NdotH = max(dot(N, H), 0.0);
    let NdotH2 = NdotH * NdotH;
    let nom = a2;
    var denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    return nom / max(denom, 0.0000001); // Add epsilon to prevent division by zero
}

/**
 * Calculates the Geometry visibility term with the Schlick-GGX approximation.
 * This term models the self-shadowing of the microfacets.
 * @param NdotV The dot product between the normal and the view vector.
 * @param roughness The material's roughness.
 * @returns The visibility term.
 */
fn GeometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
    let r = roughness + 1.0;
    let k = (r * r) / 8.0;
    let nom = NdotV;
    let denom = NdotV * (1.0 - k) + k;
    return nom / denom;
}

/**
 * Calculates the Fresnel term using Schlick's approximation.
 * This term describes how much light is reflected versus refracted at a surface,
 * based on the viewing angle.
 * @param cosTheta The dot product between the view vector and the halfway vector.
 * @param F0 The Fresnel term at normal incidence.
 * @returns The Fresnel term.
 */
fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
    return F0 + (vec3<f32>(1.0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

/** Schlick with explicit F90 — KHR_materials_specular (F90 = specularFactor on dielectrics). */
fn fresnelSchlickF90(cosTheta: f32, F0: vec3<f32>, F90: vec3<f32>) -> vec3<f32> {
    return F0 + (F90 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

/**
 * Calculates the Geometry visibility term for PBR by combining two `GeometrySchlickGGX` functions.
 * This is the Smith model, which accounts for shadowing from the light direction and masking from the view direction.
 * @param N The surface normal.
 * @param V The view vector.
 * @param L The light vector.
 * @param roughness The material's roughness.
 * @returns The combined visibility term.
 */
fn GeometrySmith4(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32) -> f32 {
    let NdotV = max(dot(N, V), 0.0);
    let NdotL = max(dot(N, L), 0.0);
    let ggx2 = GeometrySchlickGGX(NdotV, roughness);
    let ggx1 = GeometrySchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
}

fn fresnelSchlickRoughness(cosTheta: f32, F0: vec3<f32>, roughness: f32) -> vec3<f32> {
    return F0 + (max(vec3<f32>(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn fresnelSchlickRoughnessF90(cosTheta: f32, F0: vec3<f32>, F90: vec3<f32>, roughness: f32) -> vec3<f32> {
    let Fr = max(F90 * (1.0 - roughness), F0);
    return F0 + (Fr - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

/**
 * Distribution GGX anisotropic NDF — matches Khronos KHR_materials_anisotropy sample:
 * D = 1 / (π αt αb ((h·t)²/αt² + (h·b)²/αb² + (h·n)²)²)
 * implemented as a2 * w2 * w2 / π with f = (αb T·h, αt B·h, αtαb N·h).
 */
fn D_GGX_Anisotropic(NdotH: f32, H: vec3<f32>, T: vec3<f32>, B: vec3<f32>, at: f32, ab: f32) -> f32 {
    let TdotH = dot(T, H);
    let BdotH = dot(B, H);
    let a2 = at * ab;
    let d = vec3<f32>(ab * TdotH, at * BdotH, a2 * NdotH);
    let d2 = dot(d, d);
    let b2 = a2 / d2;
    return a2 * b2 * b2 * 0.31830988618; // 0.318... = 1/PI
}

/** Height-correlated masking-shadowing for anisotropic GGX (Khronos non-normative sample). */
fn V_SmithGGXCorrelated_Anisotropic(at: f32, ab: f32, TdotV: f32, BdotV: f32, TdotL: f32, BdotL: f32, NdotV: f32, NdotL: f32) -> f32 {
    let GGXV = NdotL * length(vec3<f32>(at * TdotV, ab * BdotV, NdotV));
    let GGXL = NdotV * length(vec3<f32>(at * TdotL, ab * BdotL, NdotL));
    let v = 0.5 / (GGXV + GGXL);
    return clamp(v, 0.0, 1.0);
}

// =============================================================================
// === NOUVELLES FONCTIONS D'ÉCLAIRAGE (Multi-Light) ===
// =============================================================================

/**
 * Helper standard pour clamper entre 0 et 1.
 */
fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

/**
 * KHR_lights_punctual range attenuation (Sample Viewer `getRangeAttenuation`).
 * range <= 0 → unlimited inverse-square. Else: max(min(1-(d/range)^4, 1), 0) / d^2
 * https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_lights_punctual
 */
fn getPointLightAttenuation(dist: f32, range: f32) -> f32 {
    let d = max(dist, 1e-4);
    let invSq = 1.0 / (d * d);
    if (range <= 0.0) {
        return invSq;
    }
    let ratio = d / range;
    let window = max(min(1.0 - ratio * ratio * ratio * ratio, 1.0), 0.0);
    return window * invSq;
}

/**
 * KHR_lights_punctual spot cone (Sample Viewer `getSpotAttenuation`).
 * @param L vector from surface to light (pointToLight).
 * @param lightDir world-space light axis (node local −Z).
 */
fn getSpotLightAttenuation(
    L: vec3<f32>,
    lightDir: vec3<f32>,
    innerCos: f32,
    outerCos: f32
) -> f32 {
    let actualCos = dot(normalize(lightDir), normalize(-L));
    if (actualCos > outerCos) {
        if (actualCos < innerCos) {
            let angularAttenuation = (actualCos - outerCos) / max(innerCos - outerCos, 1e-4);
            return angularAttenuation * angularAttenuation;
        }
        return 1.0;
    }
    return 0.0;
}

/** Sample Viewer `applyIorToRoughness` — scales transmission GGX by IOR. */
fn applyIorToRoughness(roughness: f32, ior: f32) -> f32 {
    return roughness * clamp(ior * 2.0 - 2.0, 0.0, 1.0);
}

/** Height-correlated GGX visibility (Sample Viewer `V_GGX`). */
fn V_GGX(NdotL: f32, NdotV: f32, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let GGXV = NdotL * sqrt(NdotV * NdotV * (1.0 - a2) + a2);
    let GGXL = NdotV * sqrt(NdotL * NdotL * (1.0 - a2) + a2);
    return 0.5 / max(GGXV + GGXL, 1e-5);
}

/**
 * Thin-surface punctual transmission (Sample Viewer `getPunctualRadianceTransmission`).
 * Mirrors L onto the front hemisphere, then GGX × Vis × baseColor.
 */
fn getPunctualRadianceTransmission(
    n: vec3<f32>,
    v: vec3<f32>,
    pointToLight: vec3<f32>,
    roughness: f32,
    baseColor: vec3<f32>,
    ior: f32
) -> vec3<f32> {
    let transmissionRoughness = max(applyIorToRoughness(roughness, ior), 0.04);
    let l = normalize(pointToLight);
    let l_mirror = normalize(l + 2.0 * n * dot(-l, n));
    let h = normalize(l_mirror + v);
    let D = DistributionGGX(n, h, transmissionRoughness);
    let Vis = V_GGX(max(dot(n, l_mirror), 0.0), max(dot(n, v), 0.0), transmissionRoughness);
    return baseColor * D * Vis;
}

/**
 * Détermine l'index de la cascade (0, 1, 2, 3) en fonction de la profondeur.
 */
fn getCascadeIndex(worldPos: vec3<f32>) -> i32 {
    // 1. Convertir la position monde en position vue (View Space)
    let viewPos = frame.viewMatrix * vec4<f32>(worldPos, 1.0);
    
    // En WebGPU/OpenGL, la caméra regarde vers -Z. La distance (profondeur) est donc -z.
    let depth = -viewPos.z;

    // 2. Comparer avec les splits (définis dans LightSystem: 15, 50, 150, 500)
    // frame.cascadeSplits est un vec4<f32>
    if (depth < frame.cascadeSplits.x) { return 0; }
    if (depth < frame.cascadeSplits.y) { return 1; }
    if (depth < frame.cascadeSplits.z) { return 2; }
    return 3;
}

fn pointShadowFace(dir: vec3<f32>) -> i32 {
    let a = abs(dir);
    if (a.x >= a.y && a.x >= a.z) {
        return select(1, 0, dir.x >= 0.0);
    }
    if (a.y >= a.z) {
        return select(3, 2, dir.y >= 0.0);
    }
    return select(5, 4, dir.z >= 0.0);
}

/**
 * Calcule le facteur d'ombre.
 * Gère automatiquement le CSM pour les lumières directionnelles et les 6 faces d'un point.
 *
 * `lightWorldPos` : position de la lampe (ignorée pour directionnelle et spot).
 * `worldNormal` : normale surface (monde), utilisée pour un léger décalage receveur afin de limiter
 * l'auto-ombrage / shadow acne quand la shadow map couvre une très grande plage Z (voir LightSystem
 * marges sur les cascades) ou des surfaces en pente.
 */
fn fetchShadow(
    lightType: u32,
    baseShadowIndex: i32,
    worldPos: vec3<f32>,
    worldNormal: vec3<f32>,
    NdotL: f32,
    lightWorldPos: vec3<f32>
) -> f32 {
    if (baseShadowIndex < 0) { return 1.0; }

    var finalShadowIndex = baseShadowIndex;

    // --- LOGIQUE CSM (Seulement pour Directional Light = Type 0) ---
    if (lightType == 0u) {
        let cascadeIdx = getCascadeIndex(worldPos);
        finalShadowIndex = baseShadowIndex + cascadeIdx;
    } else if (lightType == 1u) {
        // +X -X +Y -Y +Z -Z, same order as computePointShadowMatrix.
        let toFrag = worldPos - lightWorldPos;
        finalShadowIndex = baseShadowIndex + pointShadowFace(toFrag);
    }
    // ---------------------------------------------------------------

    if (finalShadowIndex < 0 || finalShadowIndex >= 8) { return 1.0; }

    // Récupération de la matrice correspondante (soit celle du Spot, soit celle de la Cascade active)
    let lightMatrix = shadowData.matrices[finalShadowIndex];

    // Décalage receveur (world, le long de N) : trop fort → Peter panning (ombre décollée du mesh).
    // Les cascades CSM avaient une plage Z énorme côté CPU ; avec Z resserré on peut réduire ce biais.
    let Nw = normalize(worldNormal);
    let slope = clamp(1.0 - NdotL, 0.0, 1.0);
    let recvOffset = Nw * (0.006 * slope + 0.0015);
    let biasedWorldPos = worldPos + recvOffset;

    let shadowPos = lightMatrix * vec4<f32>(biasedWorldPos, 1.0);
    let shadowNDC = shadowPos.xyz / shadowPos.w;

    let uv = vec2<f32>(
        shadowNDC.x * 0.5 + 0.5,
        -shadowNDC.y * 0.5 + 0.5
    );

    // Check Frustum (Hors map = Lumière)
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || shadowNDC.z < 0.0 || shadowNDC.z > 1.0) {
        return 1.0; 
    }

    // Biais NDC (compare `less`) : trop élevé → sur-éclairage / ombre trop « loin » du contact.
    let depthBias = max(0.00028 * (1.0 - NdotL), 0.0001);
    let currentDepth = shadowNDC.z - depthBias;

    // PCSS: blocker search (textureLoad) then a 5×5 compare whose radius grows with
    // the receiver–blocker gap. Constants match packages/core/src/rendering/pcss.ts.
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
            let blockerDepth = textureLoad(shadowMap, texel, finalShadowIndex, 0);
            if (blockerDepth < currentDepth) {
                blockerSum += blockerDepth;
                blockerCount += 1.0;
            }
        }
    }
    let avgBlocker = blockerSum / max(blockerCount, 1.0);
    let gap = max(currentDepth - avgBlocker, 0.0);
    let rawRadius = select(gap / max(avgBlocker, 1e-4) * 0.015, gap * 0.04, lightType == 0u);
    let widened = clamp(rawRadius, 0.00055, 0.008);
    let radius = select(0.00055, widened, blockerCount >= 1.0);
    let step = radius * 0.5;
    let u0 = clamp(uv.x, 0.0001, 0.9999);
    let v0 = clamp(uv.y, 0.0001, 0.9999);
    var sum = 0.0;
    for (var j: i32 = -2; j <= 2; j = j + 1) {
        for (var i: i32 = -2; i <= 2; i = i + 1) {
            let ou = clamp(u0 + f32(i) * step, 0.0001, 0.9999);
            let ov = clamp(v0 + f32(j) * step, 0.0001, 0.9999);
            sum += textureSampleCompareLevel(shadowMap, shadowSampler, vec2(ou, ov), finalShadowIndex, currentDepth);
        }
    }
    let filtered = sum * (1.0 / 25.0);
    return select(1.0, filtered, blockerCount >= 1.0);
}

/// KHR_texture_transform (packed uniforms): `os = vec4(offset.xy, scale.xy)`, `rs = vec4(cos(rotation), sin(rotation), uvSet, 0)` with uvSet ∈ {0,1} → TEXCOORD_n.
/// Order: scale → rotate → offset. Rotation matches Khronos GLSL (column-major):
/// `u' = c*u + s*v`, `v' = -s*u + c*v` (UV CCW = image CW).
fn w3dts_uv_transform_from_packed(uv0: vec2<f32>, uv1: vec2<f32>, os: vec4<f32>, rs: vec4<f32>) -> vec2<f32> {
    let uv_sel = mix(uv0, uv1, vec2<f32>(rs.z));
    let scaled = uv_sel * os.zw;
    let c = rs.x;
    let s = rs.y;
    let rotated = vec2<f32>(c * scaled.x + s * scaled.y, -s * scaled.x + c * scaled.y);
    return rotated + os.xy;
}

// KHR_materials_iridescence — Belcour/Barla analytic spectral integration (Khronos Sample Viewer).
const XYZ_TO_REC709: mat3x3<f32> = mat3x3<f32>(
    vec3<f32>(3.2404542, -0.9692660, 0.0556434),
    vec3<f32>(-1.5371385, 1.8760108, -0.2040259),
    vec3<f32>(-0.4985314, 0.0415560, 1.0572252)
);

fn fresnel0ToIor(fresnel0: vec3<f32>) -> vec3<f32> {
    let sqrtF0 = sqrt(clamp(fresnel0, vec3<f32>(0.0), vec3<f32>(0.9999)));
    return (vec3<f32>(1.0) + sqrtF0) / (vec3<f32>(1.0) - sqrtF0);
}

fn iorToFresnel0(transmittedIor: f32, incidentIor: f32) -> f32 {
    let t = (transmittedIor - incidentIor) / (transmittedIor + incidentIor);
    return t * t;
}

fn iorToFresnel0Vec(transmittedIor: vec3<f32>, incidentIor: f32) -> vec3<f32> {
    let t = (transmittedIor - vec3<f32>(incidentIor)) / (transmittedIor + vec3<f32>(incidentIor));
    return t * t;
}

fn fresnelSchlickF(cosTheta: f32, F0: f32) -> f32 {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn evalIridescenceSensitivity(OPD: f32, shift: vec3<f32>) -> vec3<f32> {
    let phase = 2.0 * PI * OPD * 1.0e-9;
    let val = vec3<f32>(5.4856e-13, 4.4201e-13, 5.2481e-13);
    let pos = vec3<f32>(1.6810e+06, 1.7953e+06, 2.2084e+06);
    let variance = vec3<f32>(4.3278e+09, 9.3046e+09, 6.6121e+09);
    var xyz = val * sqrt(2.0 * PI * variance) * cos(pos * phase + shift) * exp(-(phase * phase) * variance);
    xyz.x += 9.7470e-14 * sqrt(2.0 * PI * 4.5282e+09) * cos(2.2399e+06 * phase + shift.x) * exp(-4.5282e+09 * (phase * phase));
    xyz = xyz / 1.0685e-7;
    return XYZ_TO_REC709 * xyz;
}

fn evalIridescence(outsideIOR: f32, eta2: f32, cosTheta1: f32, thinFilmThickness: f32, baseF0: vec3<f32>) -> vec3<f32> {
    let iridescenceIor = mix(outsideIOR, eta2, smoothstep(0.0, 0.03, thinFilmThickness));
    let sinTheta2Sq = pow(outsideIOR / max(iridescenceIor, 1e-5), 2.0) * (1.0 - cosTheta1 * cosTheta1);
    let cosTheta2Sq = 1.0 - sinTheta2Sq;
    if (cosTheta2Sq < 0.0) {
        return vec3<f32>(1.0);
    }
    let cosTheta2 = sqrt(cosTheta2Sq);

    let R0 = iorToFresnel0(iridescenceIor, outsideIOR);
    let R12 = fresnelSchlickF(cosTheta1, R0);
    let T121 = 1.0 - R12;
    let phi12 = select(0.0, PI, iridescenceIor < outsideIOR);
    let phi21 = PI - phi12;

    let baseIOR = fresnel0ToIor(baseF0);
    let R1 = iorToFresnel0Vec(baseIOR, iridescenceIor);
    let R23 = fresnelSchlick(cosTheta2, R1);
    let phi23 = select(vec3<f32>(0.0), vec3<f32>(PI), baseIOR < vec3<f32>(iridescenceIor));

    let OPD = 2.0 * iridescenceIor * thinFilmThickness * cosTheta2;
    let phi = vec3<f32>(phi21) + phi23;

    let R123 = clamp(R12 * R23, vec3<f32>(1e-5), vec3<f32>(0.9999));
    let r123 = sqrt(R123);
    let Rs = (T121 * T121) * R23 / (vec3<f32>(1.0) - R123);

    var I = R12 + Rs;
    var Cm = Rs - T121;
    for (var m: i32 = 1; m <= 2; m = m + 1) {
        Cm = Cm * r123;
        let Sm = 2.0 * evalIridescenceSensitivity(f32(m) * OPD, f32(m) * phi);
        I = I + Cm * Sm;
    }
    return max(I, vec3<f32>(0.0));
}

// --- LTC area lights (Heitz et al., same fit as the three.js tables) ---

fn ltcUv(N: vec3<f32>, V: vec3<f32>, roughness: f32) -> vec2<f32> {
    let dotNV = clamp(dot(N, V), 0.0, 1.0);
    let uv = vec2<f32>(roughness, sqrt(1.0 - dotNV));
    return uv * (63.0 / 64.0) + (0.5 / 64.0);
}

fn ltcClippedSphereFormFactor(f: vec3<f32>) -> f32 {
    let l = length(f);
    return max((l * l + f.z) / (l + 1.0), 0.0);
}

fn ltcEdgeVectorFormFactor(v1: vec3<f32>, v2: vec3<f32>) -> vec3<f32> {
    let x = dot(v1, v2);
    let y = abs(x);
    let a = 0.8543985 + (0.4965155 + 0.0145206 * y) * y;
    let b = 3.4175940 + (4.1616724 + y) * y;
    let v = a / b;
    var thetaSinTheta = 0.5 * inverseSqrt(max(1.0 - x * x, 1e-7)) - v;
    if (x > 0.0) {
        thetaSinTheta = v;
    }
    return cross(v1, v2) * thetaSinTheta;
}

fn ltcEvaluate(N: vec3<f32>, V: vec3<f32>, P: vec3<f32>, mInv: mat3x3<f32>, coordsIn: array<vec3<f32>, 8>, count: i32) -> f32 {
    if (count < 3) {
        return 0.0;
    }
    let edgeA = coordsIn[1] - coordsIn[0];
    let edgeB = coordsIn[2] - coordsIn[0];
    let lightNormal = cross(edgeA, edgeB);
    if (dot(lightNormal, P - coordsIn[0]) < 0.0) {
        return 0.0;
    }

    var T1 = V - N * dot(V, N);
    let t1Len = length(T1);
    if (t1Len < 1e-5) {
        T1 = vec3<f32>(1.0, 0.0, 0.0);
    } else {
        T1 = T1 / t1Len;
    }
    let T2 = -cross(N, T1);
    let basis = mat3x3<f32>(T1, T2, N);
    let xform = mInv * transpose(basis);

    var coords: array<vec3<f32>, 8>;
    for (var i: i32 = 0; i < 8; i = i + 1) {
        coords[i] = vec3<f32>(0.0, 0.0, 1.0);
    }
    for (var i: i32 = 0; i < count; i = i + 1) {
        coords[i] = normalize(xform * (coordsIn[i] - P));
    }

    var vectorFormFactor = vec3<f32>(0.0);
    for (var i: i32 = 0; i < count; i = i + 1) {
        let j = (i + 1) % count;
        vectorFormFactor += ltcEdgeVectorFormFactor(coords[i], coords[j]);
    }
    return ltcClippedSphereFormFactor(vectorFormFactor);
}

fn ltcSample(tex: texture_2d<f32>, uv: vec2<f32>) -> vec4<f32> {
    let p = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0)) * 63.0;
    let i = vec2<i32>(floor(p));
    let f = fract(p);
    let i0 = clamp(i, vec2<i32>(0), vec2<i32>(63));
    let i1 = clamp(i + vec2<i32>(1), vec2<i32>(0), vec2<i32>(63));
    let a = textureLoad(tex, i0, 0);
    let b = textureLoad(tex, vec2<i32>(i1.x, i0.y), 0);
    let c = textureLoad(tex, vec2<i32>(i0.x, i1.y), 0);
    let d = textureLoad(tex, i1, 0);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

fn reflectionProbeWeight(worldPos: vec3<f32>, center: vec3<f32>, radius: f32, boxHalf: vec3<f32>) -> f32 {
    let d = abs(worldPos - center);
    var m: f32;
    if (boxHalf.x > 1e-3 && boxHalf.y > 1e-3 && boxHalf.z > 1e-3) {
        let q = d / boxHalf;
        m = max(q.x, max(q.y, q.z));
    } else if (radius > 1e-4) {
        m = length(d) / radius;
    } else {
        return 0.0;
    }
    if (m >= 1.0) {
        return 0.0;
    }
    if (m <= 0.65) {
        return 1.0;
    }
    return 1.0 - smoothstep(0.65, 1.0, m);
}

fn boxParallaxDir(dir: vec3<f32>, worldPos: vec3<f32>, center: vec3<f32>, boxHalf: vec3<f32>) -> vec3<f32> {
    let local = worldPos - center;
    let safeDir = select(dir, vec3<f32>(1e-5), abs(dir) < vec3<f32>(1e-5));
    let tPlanes = (sign(safeDir) * boxHalf - local) / safeDir;
    var dist = 1e5;
    if (tPlanes.x > 0.0) {
        dist = min(dist, tPlanes.x);
    }
    if (tPlanes.y > 0.0) {
        dist = min(dist, tPlanes.y);
    }
    if (tPlanes.z > 0.0) {
        dist = min(dist, tPlanes.z);
    }
    let hit = worldPos + dir * dist;
    return hit - center;
}
