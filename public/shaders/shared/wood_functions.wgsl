/**
 * @file wood_functions.wgsl
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-20
 * @description Procedural sawn lumber: stretched grain, knots, saw marks.
 */

fn wood_hash21(p: vec2<f32>) -> vec2<f32> {
    let n = vec2<f32>(dot(p, vec2<f32>(127.1, 311.7)), dot(p, vec2<f32>(269.5, 183.3)));
    return fract(sin(n) * 43758.5453123);
}

fn wood_value_noise(uv: vec2<f32>) -> f32 {
    let i = floor(uv);
    let f = fract(uv);
    let a = wood_hash21(i).x;
    let b = wood_hash21(i + vec2<f32>(1.0, 0.0)).x;
    let c = wood_hash21(i + vec2<f32>(0.0, 1.0)).x;
    let d = wood_hash21(i + vec2<f32>(1.0, 1.0)).x;
    let u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn wood_fbm(p: vec2<f32>) -> f32 {
    var total = 0.0;
    var frequency = 1.0;
    var amplitude = 0.5;
    for (var o: u32 = 0u; o < 4u; o = o + 1u) {
        total += wood_value_noise(p * frequency) * amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return total;
}

/**
 * Sawn-board look in world XZ (grain along Z).
 * x = grain mix, y = knot mask, z = bump, w = extra roughness.
 */
fn wood_look(pos: vec3<f32>, seed: f32, scale: f32, knotAmount: f32) -> vec4<f32> {
    let s = max(scale, 0.08);
    let ka = clamp(knotAmount, 0.0, 1.0);
    let seed2 = vec2<f32>(seed * 1.73, seed * 0.41);

    // Stretch Z so rings read as long fibres; X is growth-ring axis.
    let p = vec2<f32>(pos.x + pos.y * 0.45, pos.z) * s * vec2<f32>(3.6, 0.48) + seed2;
    let warp = vec2<f32>(wood_fbm(p * 0.55), wood_fbm(p * 0.55 + vec2<f32>(19.0, 7.0)));
    let gp = p + warp * 1.65;

    let ringCoord = gp.x + wood_fbm(gp * 0.38) * 2.15;
    let rings = 0.5 + 0.5 * sin(ringCoord * 16.0);
    let pores = wood_fbm(gp * vec2<f32>(22.0, 2.4));
    var grain = mix(rings, pores, 0.38);
    grain = pow(clamp(grain, 0.0, 1.0), 0.55);

    let saw = 0.5 + 0.5 * sin(gp.y * 56.0 + wood_fbm(gp * 9.0) * 2.4);
    let sawMix = saw * 0.28;

    let knotUv = vec2<f32>(pos.x, pos.z) * s * 1.05 + seed2 * 0.6;
    let cell = floor(knotUv);
    var knot = 0.0;
    var knotRings = 0.0;
    for (var j: i32 = -1; j <= 1; j = j + 1) {
        for (var i: i32 = -1; i <= 1; i = i + 1) {
            let c = cell + vec2<f32>(f32(i), f32(j));
            let h = wood_hash21(c + vec2<f32>(seed, 3.1));
            // Sparse spawn; knotAmount raises density.
            if (h.x > mix(0.86, 0.52, ka)) {
                continue;
            }
            let center = c + 0.18 + 0.64 * wood_hash21(c + vec2<f32>(8.2, seed));
            let d = (knotUv - center) * vec2<f32>(1.25, 0.68);
            let ed = length(d);
            let radius = 0.16 + 0.28 * h.y;
            let k = 1.0 - smoothstep(radius * 0.12, radius, ed);
            if (k > knot) {
                knot = k;
                knotRings = 0.5 + 0.5 * sin(ed * 42.0);
            }
        }
    }
    knot *= ka;
    grain = mix(grain + sawMix * 0.35, mix(knotRings, 0.12, knot * 0.45), knot);

    let bump = grain * 0.62 + sawMix * 0.55 + knot * 0.4;
    let extraRough = 0.1 + grain * 0.16 + knot * 0.28 + sawMix * 0.22;
    return vec4<f32>(clamp(grain, 0.0, 1.0), knot, clamp(bump, 0.0, 1.0), extraRough);
}
