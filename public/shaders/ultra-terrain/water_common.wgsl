// Shared water shading helpers (TER-A4) — included by water.vert.wgsl / water.frag.wgsl

struct GerstnerWave {
    direction : vec2<f32>,
    amplitude : f32,
    wavelength: f32,
    steepness : f32,
    speed     : f32,
};

fn gerstner_offset(posXZ: vec2<f32>, time: f32, wave: GerstnerWave) -> vec3<f32> {
    let k = 6.2831853 / max(wave.wavelength, 0.001);
    let c = sqrt(9.81 / k);
    let d = normalize(wave.direction);
    let a = wave.amplitude;
    let q = wave.steepness / max(k * a, 0.001);
    let f = k * (dot(d, posXZ) - c * wave.speed * time);
    let qacos = q * a * cos(f);
    return vec3<f32>(d.x * qacos, a * sin(f), d.y * qacos);
}

/// Sum of 6 Gerstner waves — wavelengths in world units, island-scale chop.
fn ocean_displacement(worldXZ: vec2<f32>, time: f32, ampScale: f32) -> vec3<f32> {
    let s = max(ampScale, 0.0);
    let w0 = GerstnerWave(vec2<f32>(1.0, 0.2), 0.12 * s, 8.0, 0.35, 1.0);
    let w1 = GerstnerWave(vec2<f32>(0.6, 0.8), 0.07 * s, 5.0, 0.3, 1.15);
    let w2 = GerstnerWave(vec2<f32>(-0.4, 0.9), 0.04 * s, 3.0, 0.28, 0.85);
    let w3 = GerstnerWave(vec2<f32>(-0.9, -0.2), 0.02 * s, 1.8, 0.22, 1.3);
    let w4 = GerstnerWave(vec2<f32>(0.3, -0.7), 0.015 * s, 2.4, 0.2, 0.95);
    let w5 = GerstnerWave(vec2<f32>(-0.2, -0.5), 0.01 * s, 1.2, 0.18, 1.1);
    return gerstner_offset(worldXZ, time, w0)
         + gerstner_offset(worldXZ, time, w1)
         + gerstner_offset(worldXZ, time, w2)
         + gerstner_offset(worldXZ, time, w3)
         + gerstner_offset(worldXZ, time, w4)
         + gerstner_offset(worldXZ, time, w5);
}

fn fresnel_schlick(cosTheta: f32, f0: f32) -> f32 {
    return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
}

fn beer_lambert(absorption: vec3<f32>, depth: f32) -> vec3<f32> {
    return exp(-absorption * max(depth, 0.0));
}

/// Sample baked heightmap (r32float, unfilterable) at world XZ; returns 0 when out of bounds.
fn sample_terrain_height(
    worldXZ: vec2<f32>,
    heightmap: texture_2d<f32>,
    originXZ: vec2<f32>,
    worldSize: f32,
) -> f32 {
    if (worldSize <= 0.0) { return 0.0; }
    let uv = (worldXZ - originXZ) / worldSize;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { return 0.0; }
    let dims = vec2<i32>(textureDimensions(heightmap));
    let maxCoord = max(dims - vec2<i32>(1), vec2<i32>(0));
    let texel = uv * vec2<f32>(dims) - vec2<f32>(0.5);
    let i0 = vec2<i32>(floor(texel));
    let f = fract(texel);
    let p00 = textureLoad(heightmap, clamp(i0, vec2<i32>(0), maxCoord), 0).r;
    let p10 = textureLoad(heightmap, clamp(i0 + vec2<i32>(1, 0), vec2<i32>(0), maxCoord), 0).r;
    let p01 = textureLoad(heightmap, clamp(i0 + vec2<i32>(0, 1), vec2<i32>(0), maxCoord), 0).r;
    let p11 = textureLoad(heightmap, clamp(i0 + vec2<i32>(1, 1), vec2<i32>(0), maxCoord), 0).r;
    return mix(mix(p00, p10, f.x), mix(p01, p11, f.x), f.y);
}

fn shore_foam(depth: f32, shoreWidth: f32) -> f32 {
    return 1.0 - smoothstep(0.0, max(shoreWidth, 0.01), depth);
}

/// Animated streak foam along flow UV (river TER-A5).
fn river_flow_foam(flowUv: vec2<f32>, time: f32, flowSpeed: f32) -> f32 {
    let streak = sin(flowUv.x * 56.0 - time * flowSpeed * 8.0 + flowUv.y * 4.0);
    let ripple = sin(flowUv.x * 28.0 - time * flowSpeed * 4.5) * 0.5 + 0.5;
    let pulse = sin(flowUv.x * 12.0 - time * flowSpeed * 2.0) * 0.25 + 0.75;
    return smoothstep(0.45, 0.92, streak * ripple * pulse);
}

/// Bank foam where ribbon cross-UV approaches the shore edge.
fn river_bank_foam(crossUv: f32, shoreWidth: f32) -> f32 {
    let edgeDist = 1.0 - abs(crossUv);
    return 1.0 - smoothstep(0.0, max(shoreWidth * 0.08, 0.02), edgeDist);
}
