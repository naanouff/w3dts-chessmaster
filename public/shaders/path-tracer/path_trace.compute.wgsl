/**
 * Path trace compute: PBR metallic-roughness (GGX), albedo / ORM / normal / emissive (11 texture slots; WebGPU sampled limit).
 * Optional: BVH acceleration, cubemap IBL (renderer environment), soft sun, GGX reflection sampling,
 * normal map scale (glTF), first-hit guide buffer for denoising.
 *
 * Thin transmission: stochastic ray continuation through the surface (approximation; no BTDF).
 * Bind group 0: FrameUniforms. Bind group 1: scene + textures + BVH + env.
 */

struct FrameUniforms {
    projectionMatrix: mat4x4<f32>,
    viewMatrix: mat4x4<f32>,
    inverseViewProjectionMatrix: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    lightMatrix: mat4x4<f32>,
    lightDirection: vec3<f32>,
    lightColor: vec3<f32>,
    ambientLightIntensity: f32,
    debugViewMode: u32,
    totalTime: f32,
    _padding1: f32,
    cascadeSplits: vec4<f32>,
}

struct BvhNode {
    bmin: vec3<f32>,
    left: u32,
    bmax: vec3<f32>,
    right: u32,
}

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(1) @binding(1) var<storage, read> triangles: array<f32>;
@group(1) @binding(2) var<storage, read> pathTracerParams: array<u32>;
@group(1) @binding(3) var pathTraceOutput: texture_storage_2d<rgba16float, write>;
@group(1) @binding(4) var pathTraceAccumRead: texture_2d<f32>;
@group(1) @binding(5) var pathTraceAccumWrite: texture_storage_2d<rgba16float, write>;
@group(1) @binding(6) var<storage, read> sunDirection: array<f32>;
@group(1) @binding(7) var<storage, read> pathTracerTexSlotFlags: array<u32>;

@group(1) @binding(8) var tAlbedo0: texture_2d<f32>;
@group(1) @binding(9) var tAlbedo1: texture_2d<f32>;
@group(1) @binding(10) var tAlbedo2: texture_2d<f32>;
@group(1) @binding(11) var tAlbedo3: texture_2d<f32>;
@group(1) @binding(12) var tAlbedo4: texture_2d<f32>;
@group(1) @binding(13) var tAlbedo5: texture_2d<f32>;
@group(1) @binding(14) var tAlbedo6: texture_2d<f32>;
@group(1) @binding(15) var tAlbedo7: texture_2d<f32>;
@group(1) @binding(16) var tAlbedo8: texture_2d<f32>;
@group(1) @binding(17) var tAlbedo9: texture_2d<f32>;
@group(1) @binding(18) var tAlbedo10: texture_2d<f32>;
@group(1) @binding(19) var tOrm0: texture_2d<f32>;
@group(1) @binding(20) var tOrm1: texture_2d<f32>;
@group(1) @binding(21) var tOrm2: texture_2d<f32>;
@group(1) @binding(22) var tOrm3: texture_2d<f32>;
@group(1) @binding(23) var tOrm4: texture_2d<f32>;
@group(1) @binding(24) var tOrm5: texture_2d<f32>;
@group(1) @binding(25) var tOrm6: texture_2d<f32>;
@group(1) @binding(26) var tOrm7: texture_2d<f32>;
@group(1) @binding(27) var tOrm8: texture_2d<f32>;
@group(1) @binding(28) var tOrm9: texture_2d<f32>;
@group(1) @binding(29) var tOrm10: texture_2d<f32>;
@group(1) @binding(30) var tNormal0: texture_2d<f32>;
@group(1) @binding(31) var tNormal1: texture_2d<f32>;
@group(1) @binding(32) var tNormal2: texture_2d<f32>;
@group(1) @binding(33) var tNormal3: texture_2d<f32>;
@group(1) @binding(34) var tNormal4: texture_2d<f32>;
@group(1) @binding(35) var tNormal5: texture_2d<f32>;
@group(1) @binding(36) var tNormal6: texture_2d<f32>;
@group(1) @binding(37) var tNormal7: texture_2d<f32>;
@group(1) @binding(38) var tNormal8: texture_2d<f32>;
@group(1) @binding(39) var tNormal9: texture_2d<f32>;
@group(1) @binding(40) var tNormal10: texture_2d<f32>;
@group(1) @binding(41) var tEmissive0: texture_2d<f32>;
@group(1) @binding(42) var tEmissive1: texture_2d<f32>;
@group(1) @binding(43) var tEmissive2: texture_2d<f32>;
@group(1) @binding(44) var tEmissive3: texture_2d<f32>;
@group(1) @binding(45) var tEmissive4: texture_2d<f32>;
@group(1) @binding(46) var tEmissive5: texture_2d<f32>;
@group(1) @binding(47) var tEmissive6: texture_2d<f32>;
@group(1) @binding(48) var tEmissive7: texture_2d<f32>;
@group(1) @binding(49) var tEmissive8: texture_2d<f32>;
@group(1) @binding(50) var tEmissive9: texture_2d<f32>;
@group(1) @binding(51) var tEmissive10: texture_2d<f32>;

@group(1) @binding(52) var<storage, read> pathTracerMatFactors: array<f32, 32>;
@group(1) @binding(54) var<storage, read> pathTracerBvhNodes: array<BvhNode>;
@group(1) @binding(56) var pathTracerSampler: sampler;
@group(1) @binding(57) var<storage, read> pathTracerTileInfo: array<u32>;
@group(1) @binding(58) var envCubemap: texture_cube<f32>;
@group(1) @binding(59) var pathTraceGuide: texture_storage_2d<rgba16float, write>;
@group(1) @binding(60) var pathTraceAlbedo: texture_storage_2d<rgba16float, write>;
@group(1) @binding(61) var<storage, read> pathTracerSpecularParams: array<f32, 64>;
@group(1) @binding(62) var<storage, read> pathTracerTransmissionParams: array<f32, 32>;

const FLOATS_PER_TRIANGLE = 57u;
const MAX_MAT_TEX_SLOTS = 11u;
/** Same value as PATH_TRACER_TEX_FLAG_ORM_UV1 (texture slot flags buffer). */
const TEX_FLAG_ORM_UV1 = 32u;
const MAX_BOUNCES = 4u;
const PI = 3.14159265359;
const AO_RAYS = 8u;
const AO_RADIUS = 0.8;
const AO_STRENGTH = 0.5;
const MAT_SLOT_NONE = 255u;
const BVH_LEAF = 0xffffffffu;
const FLAG_USE_BVH = 1u;
const FLAG_ENV_CUBEMAP = 2u;
const FLAG_SOFT_SUN = 4u;
const FLAG_GUIDED_DENOISE = 8u;
const FLAG_SOFT_SUN_EXTRA = 16u;
const FLAG_GGX_REFLECTION = 32u;
/** Primary miss: no sky/HDRI; accumulate straight-alpha coverage in .a (RGB premultiplied). */
const FLAG_TRANSPARENT_BG = 64u;
/** Total per-path radiance cap after AO; per-bounce clamps do not limit their sum. */
const FIREFLY_MAX_SAMPLE_LUMINANCE = 64.0;
/** Running-average ceiling (catches numerical spikes; keeps composite/denoise stable). */
const FIREFLY_MAX_ACCUM_LUMINANCE = 56.0;

fn get_triangle_count() -> u32 { return pathTracerParams[12]; }

fn get_triangle_positions(i: u32) -> mat3x3<f32> {
    let base = i * FLOATS_PER_TRIANGLE;
    return mat3x3<f32>(
        vec3<f32>(triangles[base], triangles[base+1u], triangles[base+2u]),
        vec3<f32>(triangles[base+3u], triangles[base+4u], triangles[base+5u]),
        vec3<f32>(triangles[base+6u], triangles[base+7u], triangles[base+8u])
    );
}

fn get_triangle_normals(i: u32) -> mat3x3<f32> {
    let base = i * FLOATS_PER_TRIANGLE + 9u;
    return mat3x3<f32>(
        vec3<f32>(triangles[base], triangles[base+1u], triangles[base+2u]),
        vec3<f32>(triangles[base+3u], triangles[base+4u], triangles[base+5u]),
        vec3<f32>(triangles[base+6u], triangles[base+7u], triangles[base+8u])
    );
}

fn get_triangle_tangents(i: u32) -> mat3x3<f32> {
    let base = i * FLOATS_PER_TRIANGLE + 18u;
    return mat3x3<f32>(
        vec3<f32>(triangles[base], triangles[base+1u], triangles[base+2u]),
        vec3<f32>(triangles[base+3u], triangles[base+4u], triangles[base+5u]),
        vec3<f32>(triangles[base+6u], triangles[base+7u], triangles[base+8u])
    );
}

fn get_triangle_bitangents(i: u32) -> mat3x3<f32> {
    let base = i * FLOATS_PER_TRIANGLE + 27u;
    return mat3x3<f32>(
        vec3<f32>(triangles[base], triangles[base+1u], triangles[base+2u]),
        vec3<f32>(triangles[base+3u], triangles[base+4u], triangles[base+5u]),
        vec3<f32>(triangles[base+6u], triangles[base+7u], triangles[base+8u])
    );
}

fn get_triangle_uvs(i: u32) -> mat3x2<f32> {
    let b = i * FLOATS_PER_TRIANGLE + 36u;
    return mat3x2<f32>(
        vec2<f32>(triangles[b], triangles[b+1u]),
        vec2<f32>(triangles[b+2u], triangles[b+3u]),
        vec2<f32>(triangles[b+4u], triangles[b+5u])
    );
}

fn get_triangle_uvs1(i: u32) -> mat3x2<f32> {
    let b = i * FLOATS_PER_TRIANGLE + 42u;
    return mat3x2<f32>(
        vec2<f32>(triangles[b], triangles[b+1u]),
        vec2<f32>(triangles[b+2u], triangles[b+3u]),
        vec2<f32>(triangles[b+4u], triangles[b+5u])
    );
}

fn get_triangle_base_color(i: u32) -> vec3<f32> {
    let base = i * FLOATS_PER_TRIANGLE + 48u;
    return vec3<f32>(triangles[base], triangles[base+1u], triangles[base+2u]);
}

fn get_triangle_metallic(i: u32) -> f32 {
    return triangles[i * FLOATS_PER_TRIANGLE + 51u];
}

fn get_triangle_roughness(i: u32) -> f32 {
    return triangles[i * FLOATS_PER_TRIANGLE + 52u];
}

fn get_triangle_emissive(i: u32) -> vec3<f32> {
    let base = i * FLOATS_PER_TRIANGLE + 53u;
    return vec3<f32>(triangles[base], triangles[base+1u], triangles[base+2u]);
}

fn get_triangle_material_slot(i: u32) -> u32 {
    return u32(triangles[i * FLOATS_PER_TRIANGLE + 56u]);
}

/** Single-winding Möller–Trumbore; `abs(a)` rejects parallel rays only (not backfaces). */
fn ray_triangle_hit_bary_once(ro: vec3<f32>, rd: vec3<f32>, p0: vec3<f32>, p1: vec3<f32>, p2: vec3<f32>) -> vec4<f32> {
    let e1 = p1 - p0;
    let e2 = p2 - p0;
    let h = cross(rd, e2);
    let a = dot(e1, h);
    let eps = 1e-7;
    if (abs(a) < eps) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    let f = 1.0 / a;
    let s = ro - p0;
    let u = f * dot(s, h);
    if (u < 0.0 || u > 1.0) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    let q = cross(s, e1);
    let v = f * dot(rd, q);
    if (v < 0.0 || u + v > 1.0) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    let t = f * dot(e2, q);
    if (t <= 1e-7) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    return vec4<f32>(t, u, v, 0.0);
}

/**
 * Double-sided hit: GLB/CAD meshes often mix winding; single-sided MT misses half the rays → comb / shredded look.
 * Second try (p0, p2, p1): remap MT (u,v) to the same barycentric convention as (p0, p1, p2) for shading (normals/UV).
 */
fn ray_triangle_hit_bary(ro: vec3<f32>, rd: vec3<f32>, p0: vec3<f32>, p1: vec3<f32>, p2: vec3<f32>) -> vec4<f32> {
    let h0 = ray_triangle_hit_bary_once(ro, rd, p0, p1, p2);
    if (h0.x >= 0.0) { return h0; }
    let h1 = ray_triangle_hit_bary_once(ro, rd, p0, p2, p1);
    if (h1.x < 0.0) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    return vec4<f32>(h1.x, h1.z, h1.y, 0.0);
}

fn aabb_ray_interval(ro: vec3<f32>, rd: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>) -> vec2<f32> {
    var t0 = -1e30;
    var t1 = 1e30;
    let ox = ro.x;
    let oy = ro.y;
    let oz = ro.z;
    let dx = rd.x;
    let dy = rd.y;
    let dz = rd.z;
    var invD = 1.0 / dx;
    var tNear = (bmin.x - ox) * invD;
    var tFar = (bmax.x - ox) * invD;
    if (tNear > tFar) { let tmp = tNear; tNear = tFar; tFar = tmp; }
    t0 = max(t0, tNear);
    t1 = min(t1, tFar);
    invD = 1.0 / dy;
    tNear = (bmin.y - oy) * invD;
    tFar = (bmax.y - oy) * invD;
    if (tNear > tFar) { let tmp = tNear; tNear = tFar; tFar = tmp; }
    t0 = max(t0, tNear);
    t1 = min(t1, tFar);
    invD = 1.0 / dz;
    tNear = (bmin.z - oz) * invD;
    tFar = (bmax.z - oz) * invD;
    if (tNear > tFar) { let tmp = tNear; tNear = tFar; tFar = tmp; }
    t0 = max(t0, tNear);
    t1 = min(t1, tFar);
    return vec2<f32>(t0, t1);
}

fn sample_albedo(slot: u32, uv: vec2<f32>) -> vec3<f32> {
    if (slot == 0u) { return textureSampleLevel(tAlbedo0, pathTracerSampler, uv, 0.0).rgb; }
    if (slot == 1u) { return textureSampleLevel(tAlbedo1, pathTracerSampler, uv, 0.0).rgb; }
    if (slot == 2u) { return textureSampleLevel(tAlbedo2, pathTracerSampler, uv, 0.0).rgb; }
    if (slot == 3u) { return textureSampleLevel(tAlbedo3, pathTracerSampler, uv, 0.0).rgb; }
    if (slot == 4u) { return textureSampleLevel(tAlbedo4, pathTracerSampler, uv, 0.0).rgb; }
    if (slot == 5u) { return textureSampleLevel(tAlbedo5, pathTracerSampler, uv, 0.0).rgb; }
    if (slot == 6u) { return textureSampleLevel(tAlbedo6, pathTracerSampler, uv, 0.0).rgb; }
    if (slot == 7u) { return textureSampleLevel(tAlbedo7, pathTracerSampler, uv, 0.0).rgb; }
    if (slot == 8u) { return textureSampleLevel(tAlbedo8, pathTracerSampler, uv, 0.0).rgb; }
    if (slot == 9u) { return textureSampleLevel(tAlbedo9, pathTracerSampler, uv, 0.0).rgb; }
    return textureSampleLevel(tAlbedo10, pathTracerSampler, uv, 0.0).rgb;
}

fn sample_normal_map(slot: u32, uv: vec2<f32>) -> vec3<f32> {
    var c: vec4<f32>;
    if (slot == 0u) { c = textureSampleLevel(tNormal0, pathTracerSampler, uv, 0.0); }
    else if (slot == 1u) { c = textureSampleLevel(tNormal1, pathTracerSampler, uv, 0.0); }
    else if (slot == 2u) { c = textureSampleLevel(tNormal2, pathTracerSampler, uv, 0.0); }
    else if (slot == 3u) { c = textureSampleLevel(tNormal3, pathTracerSampler, uv, 0.0); }
    else if (slot == 4u) { c = textureSampleLevel(tNormal4, pathTracerSampler, uv, 0.0); }
    else if (slot == 5u) { c = textureSampleLevel(tNormal5, pathTracerSampler, uv, 0.0); }
    else if (slot == 6u) { c = textureSampleLevel(tNormal6, pathTracerSampler, uv, 0.0); }
    else if (slot == 7u) { c = textureSampleLevel(tNormal7, pathTracerSampler, uv, 0.0); }
    else if (slot == 8u) { c = textureSampleLevel(tNormal8, pathTracerSampler, uv, 0.0); }
    else if (slot == 9u) { c = textureSampleLevel(tNormal9, pathTracerSampler, uv, 0.0); }
    else { c = textureSampleLevel(tNormal10, pathTracerSampler, uv, 0.0); }
    return c.rgb;
}

fn sample_emissive_tex(slot: u32, uv: vec2<f32>) -> vec3<f32> {
    var c: vec4<f32>;
    if (slot == 0u) { c = textureSampleLevel(tEmissive0, pathTracerSampler, uv, 0.0); }
    else if (slot == 1u) { c = textureSampleLevel(tEmissive1, pathTracerSampler, uv, 0.0); }
    else if (slot == 2u) { c = textureSampleLevel(tEmissive2, pathTracerSampler, uv, 0.0); }
    else if (slot == 3u) { c = textureSampleLevel(tEmissive3, pathTracerSampler, uv, 0.0); }
    else if (slot == 4u) { c = textureSampleLevel(tEmissive4, pathTracerSampler, uv, 0.0); }
    else if (slot == 5u) { c = textureSampleLevel(tEmissive5, pathTracerSampler, uv, 0.0); }
    else if (slot == 6u) { c = textureSampleLevel(tEmissive6, pathTracerSampler, uv, 0.0); }
    else if (slot == 7u) { c = textureSampleLevel(tEmissive7, pathTracerSampler, uv, 0.0); }
    else if (slot == 8u) { c = textureSampleLevel(tEmissive8, pathTracerSampler, uv, 0.0); }
    else if (slot == 9u) { c = textureSampleLevel(tEmissive9, pathTracerSampler, uv, 0.0); }
    else { c = textureSampleLevel(tEmissive10, pathTracerSampler, uv, 0.0); }
    return c.rgb;
}

fn sample_orm(slot: u32, uv: vec2<f32>) -> vec2<f32> {
    var c: vec4<f32>;
    if (slot == 0u) { c = textureSampleLevel(tOrm0, pathTracerSampler, uv, 0.0); }
    else if (slot == 1u) { c = textureSampleLevel(tOrm1, pathTracerSampler, uv, 0.0); }
    else if (slot == 2u) { c = textureSampleLevel(tOrm2, pathTracerSampler, uv, 0.0); }
    else if (slot == 3u) { c = textureSampleLevel(tOrm3, pathTracerSampler, uv, 0.0); }
    else if (slot == 4u) { c = textureSampleLevel(tOrm4, pathTracerSampler, uv, 0.0); }
    else if (slot == 5u) { c = textureSampleLevel(tOrm5, pathTracerSampler, uv, 0.0); }
    else if (slot == 6u) { c = textureSampleLevel(tOrm6, pathTracerSampler, uv, 0.0); }
    else if (slot == 7u) { c = textureSampleLevel(tOrm7, pathTracerSampler, uv, 0.0); }
    else if (slot == 8u) { c = textureSampleLevel(tOrm8, pathTracerSampler, uv, 0.0); }
    else if (slot == 9u) { c = textureSampleLevel(tOrm9, pathTracerSampler, uv, 0.0); }
    else { c = textureSampleLevel(tOrm10, pathTracerSampler, uv, 0.0); }
    return vec2<f32>(c.g, c.b);
}

fn mat_normal_scale(slot: u32) -> f32 {
    if (slot >= MAX_MAT_TEX_SLOTS || slot == MAT_SLOT_NONE) { return 1.0; }
    return max(pathTracerMatFactors[slot], 0.0);
}

fn eval_surface_albedo(
    slot: u32,
    bu: f32,
    bv: f32,
    uvs: mat3x2<f32>,
    baseF: vec3<f32>
) -> vec3<f32> {
    let w0 = 1.0 - bu - bv;
    let uv = uvs[0] * w0 + uvs[1] * bu + uvs[2] * bv;
    var base = baseF;
    if (slot < MAX_MAT_TEX_SLOTS && slot != MAT_SLOT_NONE) {
        let flags = pathTracerTexSlotFlags[slot];
        if ((flags & 1u) != 0u) {
            base = base * sample_albedo(slot, uv);
        }
    }
    return base;
}

fn eval_surface_emissive(
    slot: u32,
    bu: f32,
    bv: f32,
    uvs: mat3x2<f32>,
    baseEmit: vec3<f32>
) -> vec3<f32> {
    let w0 = 1.0 - bu - bv;
    let uv = uvs[0] * w0 + uvs[1] * bu + uvs[2] * bv;
    var e = baseEmit;
    if (slot < MAX_MAT_TEX_SLOTS && slot != MAT_SLOT_NONE) {
        let flags = pathTracerTexSlotFlags[slot];
        if ((flags & 8u) != 0u) {
            e = e * sample_emissive_tex(slot, uv);
        }
    }
    return max(e, vec3<f32>(0.0));
}

fn eval_surface_scalar(slot: u32, bu: f32, bv: f32, uvs: mat3x2<f32>, uvs1: mat3x2<f32>, metF: f32, roughF: f32) -> vec2<f32> {
    let w0 = 1.0 - bu - bv;
    let uv0 = uvs[0] * w0 + uvs[1] * bu + uvs[2] * bv;
    let uv1 = uvs1[0] * w0 + uvs1[1] * bu + uvs1[2] * bv;
    var met = metF;
    var rough = roughF;
    if (slot < MAX_MAT_TEX_SLOTS && slot != MAT_SLOT_NONE) {
        let flags = pathTracerTexSlotFlags[slot];
        if ((flags & 2u) != 0u) {
            let uvOrm = select(uv0, uv1, (flags & TEX_FLAG_ORM_UV1) != 0u);
            let orm = sample_orm(slot, uvOrm);
            rough = rough * orm.x;
            met = met * orm.y;
        }
    }
    return vec2<f32>(clamp(met, 0.0, 1.0), clamp(rough, 0.0, 1.0));
}

/** Per-path contribution luminance cap: glossy BRDF × sun spikes become fireflies once denoised. */
fn firefly_clamp_contrib(c: vec3<f32>, cap: f32) -> vec3<f32> {
    let lum = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
    if (lum <= cap) { return c; }
    return c * (cap / max(lum, 1e-5));
}

fn build_shading_normal(
    matSlot: u32,
    bu: f32,
    bv: f32,
    uvs: mat3x2<f32>,
    N_geom: vec3<f32>,
    T_interp: vec3<f32>,
    B_interp: vec3<f32>
) -> vec3<f32> {
    let N_geo = normalize(N_geom);
    var T_i = T_interp;
    if (length(T_i) < 1e-20) {
        if (abs(N_geo.y) < 0.999) {
            T_i = cross(N_geo, vec3<f32>(0.0, 1.0, 0.0));
        } else {
            T_i = cross(N_geo, vec3<f32>(1.0, 0.0, 0.0));
        }
    }
    T_i = normalize(T_i);
    var B_i = B_interp;
    if (length(B_i) < 1e-20) {
        B_i = cross(N_geo, T_i);
    } else {
        B_i = normalize(B_i);
    }
    var T = T_i - dot(T_i, N_geo) * N_geo;
    if (length(T) < 1e-5) {
        if (abs(N_geo.y) < 0.999) {
            T = normalize(cross(N_geo, vec3<f32>(0.0, 1.0, 0.0)));
        } else {
            T = normalize(cross(N_geo, vec3<f32>(1.0, 0.0, 0.0)));
        }
    } else {
        T = normalize(T);
    }
    let handedness = select(-1.0, 1.0, dot(cross(N_geo, T), B_i) >= 0.0);
    let B = normalize(cross(N_geo, T)) * handedness;
    if (matSlot < MAX_MAT_TEX_SLOTS && matSlot != MAT_SLOT_NONE) {
        let flags = pathTracerTexSlotFlags[matSlot];
        if ((flags & 4u) != 0u) {
            let w0 = 1.0 - bu - bv;
            let uv = uvs[0] * w0 + uvs[1] * bu + uvs[2] * bv;
            let nm = sample_normal_map(matSlot, uv);
            var tn = nm * 2.0 - 1.0;
            let ns = mat_normal_scale(matSlot);
            tn = vec3<f32>(tn.x * ns, tn.y * ns, tn.z);
            tn = normalize(tn);
            return normalize(T * tn.x + B * tn.y + N_geo * tn.z);
        }
    }
    return N_geo;
}

fn pcg_hash(input: u32) -> u32 {
    var state = input * 747796405u + 2891336453u;
    let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

fn rand2(pixel: vec2<u32>, seed: u32) -> vec2<f32> {
    let h0 = pcg_hash(pixel.x + pcg_hash(pixel.y + pcg_hash(seed)));
    let h1 = pcg_hash(h0);
    return vec2<f32>(f32(h0) / 4294967295.0, f32(h1) / 4294967295.0);
}

fn cosine_sample_hemisphere(N: vec3<f32>, pixel: vec2<u32>, bounce: u32, seed: u32) -> vec3<f32> {
    let r = rand2(pixel, seed * 17u + bounce * 31u + 7u);
    let phi = 2.0 * PI * r.x;
    let cosTheta = sqrt(r.y);
    let sinTheta = sqrt(1.0 - r.y);
    var tangent: vec3<f32>;
    if (abs(N.y) < 0.999) {
        tangent = normalize(cross(N, vec3<f32>(0.0, 1.0, 0.0)));
    } else {
        tangent = normalize(cross(N, vec3<f32>(1.0, 0.0, 0.0)));
    }
    let bitangent = cross(N, tangent);
    return normalize(tangent * cos(phi) * sinTheta + bitangent * sin(phi) * sinTheta + N * cosTheta);
}

fn sample_cone_around(axis: vec3<f32>, halfAngle: f32, pixel: vec2<u32>, seed: u32) -> vec3<f32> {
    let r = rand2(pixel, seed);
    let phi = 2.0 * PI * r.x;
    let cosTheta = 1.0 - r.y * (1.0 - cos(halfAngle));
    let sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    var tangent: vec3<f32>;
    if (abs(axis.y) < 0.999) {
        tangent = normalize(cross(axis, vec3<f32>(0.0, 1.0, 0.0)));
    } else {
        tangent = normalize(cross(axis, vec3<f32>(1.0, 0.0, 0.0)));
    }
    let bitangent = cross(axis, tangent);
    return normalize(tangent * cos(phi) * sinTheta + bitangent * sin(phi) * sinTheta + axis * cosTheta);
}

/** HDR cubemap can carry very high radiance; scale down to reduce fireflies vs. analytic sky. */
fn env_sample(rd: vec3<f32>, iblIntensity: f32) -> vec3<f32> {
    return textureSampleLevel(envCubemap, pathTracerSampler, rd, 0.0).rgb * iblIntensity;
}

fn trace_closest_linear(ro: vec3<f32>, rd: vec3<f32>, count: u32) -> vec4<f32> {
    var hitDist = 1e10;
    var hitBu = 0.0;
    var hitBv = 0.0;
    var hitTri = 0u;
    for (var i = 0u; i < count; i++) {
        let pos = get_triangle_positions(i);
        let hb = ray_triangle_hit_bary(ro, rd, pos[0], pos[1], pos[2]);
        if (hb.x > 0.0 && hb.x < hitDist) {
            hitDist = hb.x;
            hitBu = hb.y;
            hitBv = hb.z;
            hitTri = i;
        }
    }
    if (hitDist >= 1e9) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    return vec4<f32>(hitDist, hitBu, hitBv, f32(hitTri));
}

/** Any hit along [minT, maxT] (shadow / short-range AO). Uses same BVH as closest-hit. */
fn trace_any_hit_bvh(
    ro: vec3<f32>,
    rd: vec3<f32>,
    count: u32,
    root: u32,
    nodeCount: u32,
    minT: f32,
    maxT: f32,
) -> bool {
    var stack: array<u32, 64>;
    var sp = 1u;
    stack[0] = root;
    loop {
        if (sp == 0u) { break; }
        sp -= 1u;
        let ni = stack[sp];
        if (ni >= nodeCount) { continue; }
        let node = pathTracerBvhNodes[ni];
        let iv = aabb_ray_interval(ro, rd, node.bmin, node.bmax);
        let tEnter = max(iv.x, minT);
        let tExit = min(iv.y, maxT);
        if (tEnter > tExit) { continue; }
        if (node.left == BVH_LEAF) {
            let ti = node.right;
            if (ti < count) {
                let pos = get_triangle_positions(ti);
                let hb = ray_triangle_hit_bary(ro, rd, pos[0], pos[1], pos[2]);
                if (hb.x > minT && hb.x < maxT) { return true; }
            }
        } else {
            if (sp < 63u) {
                stack[sp] = node.right;
                sp += 1u;
                stack[sp] = node.left;
                sp += 1u;
            }
        }
    }
    return false;
}

fn trace_closest_bvh(ro: vec3<f32>, rd: vec3<f32>, count: u32, root: u32, nodeCount: u32) -> vec4<f32> {
    var hitDist = 1e10;
    var hitBu = 0.0;
    var hitBv = 0.0;
    var hitTri = 0u;
    var stack: array<u32, 64>;
    var sp = 0u;
    stack[0] = root;
    sp = 1u;
    loop {
        if (sp == 0u) { break; }
        sp -= 1u;
        let ni = stack[sp];
        if (ni >= nodeCount) { continue; }
        let node = pathTracerBvhNodes[ni];
        let iv = aabb_ray_interval(ro, rd, node.bmin, node.bmax);
        if (iv.y < 0.0 || iv.x > hitDist) { continue; }
        if (node.left == BVH_LEAF) {
            let ti = node.right;
            if (ti < count) {
                let pos = get_triangle_positions(ti);
                let hb = ray_triangle_hit_bary(ro, rd, pos[0], pos[1], pos[2]);
                if (hb.x > 0.0 && hb.x < hitDist) {
                    hitDist = hb.x;
                    hitBu = hb.y;
                    hitBv = hb.z;
                    hitTri = ti;
                }
            }
        } else {
            if (sp < 63u) {
                stack[sp] = node.right;
                sp += 1u;
                stack[sp] = node.left;
                sp += 1u;
            }
        }
    }
    if (hitDist >= 1e9) { return vec4<f32>(-1.0, 0.0, 0.0, 0.0); }
    return vec4<f32>(hitDist, hitBu, hitBv, f32(hitTri));
}

fn trace_shadow_ray_linear(origin: vec3<f32>, L: vec3<f32>, count: u32) -> bool {
    let minT = 0.001;
    let maxT = 1e20;
    for (var i = 0u; i < count; i++) {
        let pos = get_triangle_positions(i);
        let hit = ray_triangle_hit_bary(origin, L, pos[0], pos[1], pos[2]);
        if (hit.x > minT && hit.x < maxT) { return true; }
    }
    return false;
}

fn trace_shadow_ray_smart(
    origin: vec3<f32>,
    L: vec3<f32>,
    count: u32,
    use_bvh: bool,
    root: u32,
    nodeCount: u32,
) -> bool {
    let minT = 0.001;
    let maxT = 1e20;
    if (use_bvh && nodeCount > 0u) {
        return trace_any_hit_bvh(origin, L, count, root, nodeCount, minT, maxT);
    }
    return trace_shadow_ray_linear(origin, L, count);
}

fn trace_occluded_linear(origin: vec3<f32>, rd: vec3<f32>, count: u32, maxT: f32) -> bool {
    let minT = 0.001;
    for (var i = 0u; i < count; i++) {
        let pos = get_triangle_positions(i);
        let hit = ray_triangle_hit_bary(origin, rd, pos[0], pos[1], pos[2]);
        if (hit.x > minT && hit.x < maxT) { return true; }
    }
    return false;
}

fn trace_occluded_smart(
    origin: vec3<f32>,
    rd: vec3<f32>,
    count: u32,
    maxT: f32,
    use_bvh: bool,
    root: u32,
    nodeCount: u32,
) -> bool {
    let minT = 0.001;
    if (use_bvh && nodeCount > 0u) {
        return trace_any_hit_bvh(origin, rd, count, root, nodeCount, minT, maxT);
    }
    return trace_occluded_linear(origin, rd, count, maxT);
}

fn sample_ao(
    hitPos: vec3<f32>,
    N: vec3<f32>,
    count: u32,
    pixel: vec2<u32>,
    frameIdx: u32,
    use_bvh: bool,
    root: u32,
    nodeCount: u32,
) -> f32 {
    var blocked = 0u;
    for (var i = 0u; i < AO_RAYS; i++) {
        let dir = cosine_sample_hemisphere(N, pixel, i + 100u, frameIdx);
        let origin = hitPos + N * 0.002;
        if (trace_occluded_smart(origin, dir, count, AO_RADIUS, use_bvh, root, nodeCount)) {
            blocked += 1u;
        }
    }
    return f32(blocked) / f32(AO_RAYS);
}

fn sky_color(rd: vec3<f32>) -> vec3<f32> {
    let t = clamp(0.5 * (rd.y + 1.0), 0.0, 1.0);
    let horizon = vec3<f32>(1.0, 1.0, 1.0);
    let zenith  = vec3<f32>(0.5, 0.7, 1.0);
    return mix(horizon, zenith, t);
}

fn fresnel_schlick(cos_theta: f32, F0: vec3<f32>) -> vec3<f32> {
    let ct = clamp(cos_theta, 0.0, 1.0);
    return F0 + (vec3<f32>(1.0) - F0) * pow(1.0 - ct, 5.0);
}

fn distribution_ggx(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let NdotH = max(dot(N, H), 0.0);
    let NdotH2 = NdotH * NdotH;
    let denom = NdotH2 * (a2 - 1.0) + 1.0;
    return a2 / max(PI * denom * denom, 1e-8);
}

fn geometry_schlick_ggx(NdotX: f32, roughness: f32) -> f32 {
    let r = roughness + 1.0;
    let k = (r * r) / 8.0;
    let nx = max(NdotX, 0.0);
    return nx / max(nx * (1.0 - k) + k, 1e-6);
}

fn geometry_smith(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32) -> f32 {
    let NdotV = max(dot(N, V), 0.0);
    let NdotL = max(dot(N, L), 0.0);
    return geometry_schlick_ggx(NdotV, roughness) * geometry_schlick_ggx(NdotL, roughness);
}

fn dielectric_f0_specular_ext(slot: u32) -> vec3<f32> {
    if (slot >= MAX_MAT_TEX_SLOTS || slot == MAT_SLOT_NONE) {
        return vec3<f32>(0.04, 0.04, 0.04);
    }
    let i = slot * 4u;
    let f = pathTracerSpecularParams[i];
    let c = vec3<f32>(pathTracerSpecularParams[i + 1u], pathTracerSpecularParams[i + 2u], pathTracerSpecularParams[i + 3u]);
    return vec3<f32>(0.04, 0.04, 0.04) * c * f;
}

fn pbr_f0(baseColor: vec3<f32>, metallic: f32, dielectric_f0: vec3<f32>) -> vec3<f32> {
    return mix(dielectric_f0, baseColor, metallic);
}

fn transmission_opacity_for_slot(slot: u32) -> vec2<f32> {
    if (slot >= MAX_MAT_TEX_SLOTS || slot == MAT_SLOT_NONE) {
        return vec2<f32>(0.0, 1.0);
    }
    let i = slot * 2u;
    return vec2<f32>(pathTracerTransmissionParams[i], pathTracerTransmissionParams[i + 1u]);
}

fn build_orthonormal_basis(N: vec3<f32>) -> mat3x3<f32> {
    var T: vec3<f32>;
    if (abs(N.y) < 0.999) {
        T = normalize(cross(N, vec3<f32>(0.0, 1.0, 0.0)));
    } else {
        T = normalize(cross(N, vec3<f32>(1.0, 0.0, 0.0)));
    }
    let B = cross(N, T);
    return mat3x3<f32>(T, B, N);
}

fn sample_ggx_H_tangent(roughness: f32, r: vec2<f32>) -> vec3<f32> {
    let a = roughness * roughness;
    let phi = 2.0 * PI * r.x;
    let cosTheta = sqrt((1.0 - r.y) / (1.0 + (a * a - 1.0) * r.y));
    let sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
    return vec3<f32>(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
}

fn sample_reflect_ggx(N: vec3<f32>, V: vec3<f32>, roughness: f32, pixel: vec2<u32>, seed: u32) -> vec3<f32> {
    let basis = build_orthonormal_basis(N);
    let r = rand2(pixel, seed);
    let hLocal = sample_ggx_H_tangent(roughness, r);
    let H = normalize(basis * hLocal);
    return normalize(reflect(-V, H));
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let tileW = pathTracerTileInfo[4];
    let tileH = pathTracerTileInfo[5];
    let bufDims = textureDimensions(pathTraceOutput);
    let p = vec2<i32>(i32(gid.x), i32(gid.y));

    // Active fragment is [0, tileW) × [0, tileH) inside the fixed tileSize² GPU textures. Texels outside
    // that rectangle were previously left unwritten (stale / previous-tile garbage). The denoiser runs a
    // box filter over the full texture and would pull that into the real tile → heavy noise / fireflies.
    if (gid.x >= tileW || gid.y >= tileH) {
        if (gid.x < bufDims.x && gid.y < bufDims.y) {
            textureStore(pathTraceOutput, p, vec4<f32>(0.0));
            textureStore(pathTraceAccumWrite, p, vec4<f32>(0.0));
            textureStore(pathTraceGuide, p, vec4<f32>(0.0));
        }
        return;
    }

    let globalPixel = vec2<u32>(pathTracerTileInfo[0] + gid.x, pathTracerTileInfo[1] + gid.y);
    let fullSize = vec2<f32>(f32(pathTracerTileInfo[2]), f32(pathTracerTileInfo[3]));

    let resetAccum = pathTracerParams[0];
    let shadowsOn  = pathTracerParams[1];
    let frameIdx   = pathTracerParams[2];
    let maxSamples = pathTracerParams[3];
    let maxMirrorBounces = pathTracerParams[4];
    let enableGI = pathTracerParams[5];
    let enableAO = pathTracerParams[6];
    let enableReflection = pathTracerParams[7];
    let traceThisFrame = pathTracerParams[8];
    let featureFlags = pathTracerParams[9];
    let bvhNodeCount = pathTracerParams[10];
    let bvhRoot = pathTracerParams[11];
    let envIblIntensityRaw = bitcast<f32>(pathTracerParams[13]);
    // Backward-safe: if params[13] is absent / zero-initialized, keep legacy behavior (1.0).
    let envIblIntensity = max(select(envIblIntensityRaw, 1.0, pathTracerParams[13] == 0u), 0.0);

    if (traceThisFrame == 0u) {
        if (resetAccum != 0u) {
            if ((featureFlags & FLAG_TRANSPARENT_BG) != 0u) {
                textureStore(pathTraceOutput, p, vec4<f32>(0.0));
                textureStore(pathTraceAccumWrite, p, vec4<f32>(0.0));
            } else {
                textureStore(pathTraceOutput, p, vec4<f32>(0.1, 0.1, 0.15, 1.0));
                textureStore(pathTraceAccumWrite, p, vec4<f32>(0.1, 0.1, 0.15, 1.0));
            }
            textureStore(pathTraceGuide, p, vec4<f32>(0.0));
            textureStore(pathTraceAlbedo, p, vec4<f32>(0.0));
        } else {
            let prev = textureLoad(pathTraceAccumRead, p, 0);
            textureStore(pathTraceOutput, p, prev);
            textureStore(pathTraceAccumWrite, p, prev);
        }
        return;
    }

    let count = get_triangle_count();
    if (count == 0u) {
        if ((featureFlags & FLAG_TRANSPARENT_BG) != 0u) {
            textureStore(pathTraceOutput, p, vec4<f32>(0.0));
            textureStore(pathTraceAccumWrite, p, vec4<f32>(0.0));
        } else {
            textureStore(pathTraceOutput, p, vec4<f32>(0.1, 0.1, 0.15, 1.0));
            textureStore(pathTraceAccumWrite, p, vec4<f32>(0.1, 0.1, 0.15, 1.0));
        }
        textureStore(pathTraceGuide, p, vec4<f32>(0.0));
        textureStore(pathTraceAlbedo, p, vec4<f32>(0.0));
        return;
    }

    let useBvh = ((featureFlags & FLAG_USE_BVH) != 0u) && (bvhNodeCount > 0u);

    let jitter = rand2(globalPixel, frameIdx) - 0.5;
    let uvPix = (vec2<f32>(globalPixel) + 0.5 + jitter) / fullSize;
    let ndc = vec4<f32>(uvPix.x * 2.0 - 1.0, 1.0 - uvPix.y * 2.0, 0.0, 1.0);
    let worldPos = frame.inverseViewProjectionMatrix * ndc;
    let worldPos3 = worldPos.xyz / worldPos.w;

    var currentRo = frame.cameraPosition;
    var currentRd = normalize(worldPos3 - currentRo);

    let Lsun = normalize(vec3<f32>(sunDirection[0], sunDirection[1], sunDirection[2]));
    let sunIntensity = max(sunDirection[3], 0.0);
    let sunColor = vec3<f32>(sunDirection[4], sunDirection[5], sunDirection[6]);
    let sunAngularRadius = max(sunDirection[7], 0.0);

    var color = vec3<f32>(0.0);
    var throughput = vec3<f32>(1.0);
    var firstHitAo = 0.0;
    var mirrorBounces = 0u;
    var wroteGuide = false;
    var sampleAlpha = 1.0;

    for (var bounce = 0u; bounce <= MAX_BOUNCES; bounce++) {
        var hitPack: vec4<f32>;
        if (useBvh) {
            hitPack = trace_closest_bvh(currentRo, currentRd, count, bvhRoot, bvhNodeCount);
        } else {
            hitPack = trace_closest_linear(currentRo, currentRd, count);
        }
        let hitDist = hitPack.x;
        let hitBu = hitPack.y;
        let hitBv = hitPack.z;
        let hitTri = u32(hitPack.w);

        var hitN = vec3<f32>(0.0, 1.0, 0.0);
        var hitTan = vec3<f32>(1.0, 0.0, 0.0);
        var hitBin = vec3<f32>(0.0, 0.0, 1.0);
        if (hitDist > 0.0 && hitDist < 1e9) {
            let norms = get_triangle_normals(hitTri);
            let tangs = get_triangle_tangents(hitTri);
            let bitans = get_triangle_bitangents(hitTri);
            let bw = 1.0 - hitBu - hitBv;
            hitN = normalize(norms[0] * bw + norms[1] * hitBu + norms[2] * hitBv);
            hitTan = tangs[0] * bw + tangs[1] * hitBu + tangs[2] * hitBv;
            hitBin = bitans[0] * bw + bitans[1] * hitBu + bitans[2] * hitBv;
        }

        if (hitDist < 0.0 || hitDist >= 1e9) {
            if (bounce == 0u && (featureFlags & FLAG_TRANSPARENT_BG) != 0u) {
                sampleAlpha = 0.0;
                break;
            }
            if ((featureFlags & FLAG_ENV_CUBEMAP) != 0u) {
                color += firefly_clamp_contrib(
                    throughput * env_sample(normalize(currentRd), envIblIntensity),
                    70.0
                );
            } else {
                color += firefly_clamp_contrib(throughput * sky_color(currentRd), 70.0);
            }
            break;
        }

        let hitPos = currentRo + currentRd * hitDist;
        let matSlot = get_triangle_material_slot(hitTri);
        let uvs = get_triangle_uvs(hitTri);
        let uvs1 = get_triangle_uvs1(hitTri);
        var N = build_shading_normal(matSlot, hitBu, hitBv, uvs, hitN, hitTan, hitBin);
        if (dot(N, currentRd) > 0.0) { N = -N; }
        let met0 = get_triangle_metallic(hitTri);
        let rough0 = get_triangle_roughness(hitTri);
        let baseF = get_triangle_base_color(hitTri);
        let emit0 = get_triangle_emissive(hitTri);

        let mr = eval_surface_scalar(matSlot, hitBu, hitBv, uvs, uvs1, met0, rough0);
        let metallic = mr.x;
        let roughness = mr.y;
        let baseColor = eval_surface_albedo(matSlot, hitBu, hitBv, uvs, baseF);
        let emissive = eval_surface_emissive(matSlot, hitBu, hitBv, uvs, emit0);

        let transOp = transmission_opacity_for_slot(matSlot);
        if (transOp.x > 0.001 && bounce < MAX_BOUNCES) {
            let tr = rand2(globalPixel, frameIdx * 131u + bounce * 9u + 17u);
            let transW = clamp(transOp.x * transOp.y * (1.0 - metallic * 0.95), 0.0, 0.95);
            if (tr.x < transW) {
                throughput *= mix(vec3<f32>(1.0), baseColor, 0.35);
                currentRo = hitPos - N * 0.004;
                continue;
            }
        }

        color += firefly_clamp_contrib(throughput * emissive, 120.0);

        if (bounce == 0u) {
            textureStore(pathTraceAlbedo, p, vec4<f32>(baseColor, 1.0));
        }

        if (bounce == 0u && (featureFlags & FLAG_GUIDED_DENOISE) != 0u && !wroteGuide) {
            let gN = N * 0.5 + 0.5;
            let gz = min(hitDist * 0.02, 1.0);
            textureStore(pathTraceGuide, p, vec4<f32>(gN, gz));
            wroteGuide = true;
        }

        let safeRough = max(roughness, 0.04);
        let dielectricF0 = dielectric_f0_specular_ext(matSlot);
        let F0 = pbr_f0(baseColor, metallic, dielectricF0);
        let V = normalize(-currentRd);

        if (bounce == 0u && enableAO != 0u) {
            firstHitAo = sample_ao(hitPos, N, count, globalPixel, frameIdx, useBvh, bvhRoot, bvhNodeCount);
        }

        var Ld = Lsun;
        if ((featureFlags & FLAG_SOFT_SUN) != 0u && sunAngularRadius > 0.0) {
            Ld = sample_cone_around(Lsun, sunAngularRadius, globalPixel, frameIdx * 401u + bounce * 7u);
        }

        let NdotL = max(dot(N, Ld), 0.0);
        var shadowAtt = 1.0;
        if (shadowsOn != 0u && NdotL > 0.0) {
            let shadowOrigin = hitPos + N * 0.002;
            if ((featureFlags & FLAG_SOFT_SUN_EXTRA) != 0u && (featureFlags & FLAG_SOFT_SUN) != 0u && sunAngularRadius > 0.0) {
                let L2 = sample_cone_around(Lsun, sunAngularRadius, globalPixel, frameIdx * 503u + bounce * 11u);
                let vis0 = select(0.0, 0.5, !trace_shadow_ray_smart(shadowOrigin, Ld, count, useBvh, bvhRoot, bvhNodeCount));
                let vis1 = select(0.0, 0.5, !trace_shadow_ray_smart(shadowOrigin, L2, count, useBvh, bvhRoot, bvhNodeCount));
                shadowAtt = vis0 + vis1;
            } else {
                shadowAtt = select(0.0, 1.0, !trace_shadow_ray_smart(shadowOrigin, Ld, count, useBvh, bvhRoot, bvhNodeCount));
            }
        }

        let radiance = sunColor * sunIntensity;
        let NdotV = max(dot(N, V), 0.001);
        if (NdotL > 0.0 && shadowAtt > 0.0) {
            let H = normalize(Ld + V);
            let VdotH = max(dot(V, H), 0.0);
            let F = fresnel_schlick(VdotH, F0);
            let D = distribution_ggx(N, H, safeRough);
            let G = geometry_smith(N, V, Ld, safeRough);
            let specContrib = D * G * F / (4.0 * NdotV) * radiance * shadowAtt;
            let kS = F;
            let kD = (vec3<f32>(1.0) - kS) * (1.0 - metallic);
            let diffuse = kD * baseColor / PI * radiance * NdotL * shadowAtt;
            var direct = diffuse + specContrib;
            if ((featureFlags & FLAG_ENV_CUBEMAP) != 0u) {
                let amb = 0.12 * env_sample(N, envIblIntensity) * (1.0 - metallic) * baseColor;
                direct += amb;
            }
            color += firefly_clamp_contrib(throughput * direct, 52.0);
        } else if ((featureFlags & FLAG_ENV_CUBEMAP) != 0u) {
            color += firefly_clamp_contrib(
                throughput * 0.12 * env_sample(N, envIblIntensity) * (1.0 - metallic) * baseColor,
                52.0
            );
        }

        if (enableGI == 0u && bounce == 0u) { break; }

        if (bounce >= 2u) {
            let p = max(max(throughput.x, throughput.y), throughput.z);
            let rr = rand2(globalPixel, frameIdx * 7u + bounce * 13u + 1u);
            if (rr.x > p) { break; }
            throughput /= p;
        }

        let Fv = fresnel_schlick(NdotV, F0);
        var specProb = 0.0;
        if (enableReflection != 0u) {
            specProb = clamp(
                0.06 + metallic * 0.55 + (1.0 - safeRough) * 0.3 * (1.0 - metallic * 0.5),
                0.05,
                0.9
            );
        }
        let rnd = rand2(globalPixel, frameIdx * 100u + bounce * 17u + 3u);
        var newDir: vec3<f32>;
        if (enableReflection != 0u && rnd.x < specProb) {
            if ((featureFlags & FLAG_GGX_REFLECTION) != 0u) {
                newDir = sample_reflect_ggx(N, V, safeRough, globalPixel, frameIdx + bounce * 19u);
            } else {
                let R = normalize(reflect(-currentRd, N));
                let cone = safeRough * (PI * 0.5);
                newDir = sample_cone_around(R, cone, globalPixel, frameIdx + bounce * 19u);
            }
            throughput *= Fv / max(specProb, 0.01);
            if (safeRough < 0.05 && mirrorBounces < maxMirrorBounces) {
                mirrorBounces += 1u;
            }
        } else {
            newDir = cosine_sample_hemisphere(N, globalPixel, bounce, frameIdx);
            let kD = (vec3<f32>(1.0) - Fv) * (1.0 - metallic);
            throughput *= kD * baseColor / max(1.0 - specProb, 0.01);
        }
        currentRo = hitPos + N * 0.002;
        currentRd = newDir;
    }

    if (enableAO != 0u) {
        color *= 1.0 - AO_STRENGTH * firstHitAo;
    }

    color = firefly_clamp_contrib(color, FIREFLY_MAX_SAMPLE_LUMINANCE);

    let sampleCount = select(1u, frameIdx, resetAccum == 0u);
    var prev = vec3<f32>(0.0);
    var prevA = 0.0;
    if (sampleCount > 1u && resetAccum == 0u) {
        let prevPix = textureLoad(pathTraceAccumRead, p, 0);
        prev = prevPix.rgb;
        if ((featureFlags & FLAG_TRANSPARENT_BG) != 0u) {
            prevA = prevPix.a;
        }
    }
    var newAccum: vec3<f32>;
    if (maxSamples > 0u && sampleCount >= maxSamples) {
        newAccum = prev;
    } else {
        newAccum = prev + (color - prev) / f32(max(sampleCount, 1u));
    }
    newAccum = firefly_clamp_contrib(newAccum, FIREFLY_MAX_ACCUM_LUMINANCE);
    var newA = 1.0;
    if ((featureFlags & FLAG_TRANSPARENT_BG) != 0u) {
        if (maxSamples > 0u && sampleCount >= maxSamples) {
            newA = prevA;
        } else {
            newA = prevA + (sampleAlpha - prevA) / f32(max(sampleCount, 1u));
        }
    }
    textureStore(pathTraceAccumWrite, p, vec4<f32>(newAccum, newA));
    textureStore(pathTraceOutput, p, vec4<f32>(newAccum, newA));
}

