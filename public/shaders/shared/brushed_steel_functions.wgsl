/**
 * @file brushed_steel_functions.wgsl
 * @project w3dts
 * @description Procedural brushed steel (Metal010-style): fine horizontal grain + blotches.
 *
 * Object Y is across-grain (dense hair lines). XZ is along-grain (long broken streaks)
 * so lathe pieces read as circumferential brushing.
 *
 * Return: x = albedo mix, y = blotch, z = unused bump, w = extra roughness.
 */

fn bs_hash21(p: vec2<f32>) -> vec2<f32> {
    let n = vec2<f32>(dot(p, vec2<f32>(127.1, 311.7)), dot(p, vec2<f32>(269.5, 183.3)));
    return fract(sin(n) * 43758.5453123);
}

fn bs_value_noise(uv: vec2<f32>) -> f32 {
    let i = floor(uv);
    let f = fract(uv);
    let a = bs_hash21(i).x;
    let b = bs_hash21(i + vec2<f32>(1.0, 0.0)).x;
    let c = bs_hash21(i + vec2<f32>(0.0, 1.0)).x;
    let d = bs_hash21(i + vec2<f32>(1.0, 1.0)).x;
    let u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn bs_fbm(p: vec2<f32>, octaves: u32) -> f32 {
    var total = 0.0;
    var frequency = 1.0;
    var amplitude = 0.5;
    for (var o: u32 = 0u; o < octaves; o = o + 1u) {
        total += bs_value_noise(p * frequency) * amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return total;
}

fn brushed_steel_look(pos: vec3<f32>, seed: f32, scale: f32) -> vec4<f32> {
    let s = max(scale, 0.15);
    let seed2 = vec2<f32>(seed * 0.17, seed * 0.31);
    let h = pos.y * s;
    let xz = vec2<f32>(pos.x, pos.z) * s;

    // Slow warp so streaks are not infinite / perfectly parallel.
    let warp = bs_fbm(vec2<f32>(xz.x + xz.y, h * 6.0) + seed2, 3u) * 0.45;

    // Fine hair lines: huge stretch along XZ, high frequency along Y (Metal010).
    let uvFine = vec2<f32>(xz.x * 2.4 + xz.y * 2.4 + warp, h * 720.0) + seed2;
    let fineA = bs_value_noise(uvFine);
    let fineB = bs_value_noise(uvFine * vec2<f32>(1.6, 2.3) + vec2<f32>(19.0, 7.0));
    var grain = mix(fineA, fineB, 0.42);
    grain = pow(clamp(grain, 0.0, 1.0), 1.75);

    // Broken stroke length (short nicks vs long streaks).
    let breaks = bs_fbm(xz * 22.0 + vec2<f32>(h * 1.2, seed), 3u);
    grain *= mix(0.42, 1.0, breaks);

    // Medium layer for overlapping scratch scales.
    let uvMed = vec2<f32>(xz.x * 1.1 + xz.y * 1.1, h * 180.0) + seed2 * 1.7;
    let med = pow(clamp(bs_value_noise(uvMed), 0.0, 1.0), 1.35);
    grain = mix(grain, max(grain, med * 0.7), 0.35);

    // Low-frequency patina / uneven polish (non-directional).
    let blotch = bs_fbm(xz * 7.5 + vec2<f32>(h * 6.0, seed * 0.2), 4u);
    let blotchSoft = smoothstep(0.32, 0.7, blotch);

    let albedoMix = clamp(grain * 0.62 + blotchSoft * 0.22, 0.0, 1.0);
    let extraRough = 0.06 + grain * 0.2 + blotchSoft * 0.14;
    let bump = grain * 0.22;
    return vec4<f32>(albedoMix, blotchSoft, bump, extraRough);
}
