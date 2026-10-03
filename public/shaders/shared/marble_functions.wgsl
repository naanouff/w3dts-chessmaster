/**
 * @file marble_functions.wgsl
 * @project w3dts
 * @description Procedural Crema Marfil marble (Marble020-style): cloudy base, jagged veins, pits.
 *
 * Return: x = rust vein, y = grey vein, z = cloud, w = extra roughness.
 * Normals stay geometric (reference normal maps are flat).
 */

fn mar_hash31(p: vec3<f32>) -> f32 {
    return fract(sin(dot(p, vec3<f32>(127.1, 311.7, 74.7))) * 43758.5453123);
}

fn mar_hash33(p: vec3<f32>) -> vec3<f32> {
    let n = vec3<f32>(
        dot(p, vec3<f32>(127.1, 311.7, 74.7)),
        dot(p, vec3<f32>(269.5, 183.3, 246.1)),
        dot(p, vec3<f32>(113.5, 271.9, 124.6))
    );
    return fract(sin(n) * 43758.5453123);
}

fn mar_hash21(p: vec2<f32>) -> vec2<f32> {
    let n = vec2<f32>(dot(p, vec2<f32>(127.1, 311.7)), dot(p, vec2<f32>(269.5, 183.3)));
    return fract(sin(n) * 43758.5453123);
}

fn mar_value_noise(uv: vec2<f32>) -> f32 {
    let i = floor(uv);
    let f = fract(uv);
    let a = mar_hash21(i).x;
    let b = mar_hash21(i + vec2<f32>(1.0, 0.0)).x;
    let c = mar_hash21(i + vec2<f32>(0.0, 1.0)).x;
    let d = mar_hash21(i + vec2<f32>(1.0, 1.0)).x;
    let u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn mar_fbm2(p: vec2<f32>, octaves: u32) -> f32 {
    var total = 0.0;
    var frequency = 1.0;
    var amplitude = 0.5;
    for (var o: u32 = 0u; o < octaves; o = o + 1u) {
        total += mar_value_noise(p * frequency) * amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return total;
}

fn mar_value_noise3(p: vec3<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    var acc = 0.0;
    for (var z: i32 = 0; z <= 1; z = z + 1) {
        for (var y: i32 = 0; y <= 1; y = y + 1) {
            for (var x: i32 = 0; x <= 1; x = x + 1) {
                let b = vec3<f32>(f32(x), f32(y), f32(z));
                let h = mar_hash31(i + b);
                let w = mix(1.0 - u, u, b);
                acc += h * w.x * w.y * w.z;
            }
        }
    }
    return acc;
}

fn mar_fbm3(p: vec3<f32>, octaves: u32) -> f32 {
    var total = 0.0;
    var frequency = 1.0;
    var amplitude = 0.5;
    for (var o: u32 = 0u; o < octaves; o = o + 1u) {
        total += mar_value_noise3(p * frequency) * amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return total;
}

/** F1–F2 Voronoi edges: 1 on cell borders (crackle veins). */
fn mar_crackle3(p: vec3<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    var f1 = 8.0;
    var f2 = 8.0;
    for (var z: i32 = -1; z <= 1; z = z + 1) {
        for (var y: i32 = -1; y <= 1; y = y + 1) {
            for (var x: i32 = -1; x <= 1; x = x + 1) {
                let b = vec3<f32>(f32(x), f32(y), f32(z));
                let r = mar_hash33(i + b);
                let d = length(b + r - f);
                if (d < f1) {
                    f2 = f1;
                    f1 = d;
                } else if (d < f2) {
                    f2 = d;
                }
            }
        }
    }
    return 1.0 - clamp((f2 - f1) * 3.4, 0.0, 1.0);
}

fn marble_look(pos: vec3<f32>, seed: f32, scale: f32) -> vec4<f32> {
    let s = max(scale, 0.2);
    let seed3 = vec3<f32>(seed * 0.19, seed * 0.37, seed * 0.11);
    let p = pos * s + seed3 * 0.04;

    let warp = (mar_fbm3(p * 2.2, 4u) - 0.5) * 0.55;
    let q = p + vec3<f32>(warp, warp * 0.7, -warp);

    // Primary rust veins (thin, sharp) + secondary grey web.
    let crackA = mar_crackle3(q * 7.5);
    let crackB = mar_crackle3(q * 13.0 + vec3<f32>(4.2, 1.1, 8.6));
    let rustVein = pow(clamp(crackA, 0.0, 1.0), 7.5);
    let greyVein = pow(clamp(crackB, 0.0, 1.0), 4.2) * (1.0 - rustVein * 0.7);

    let cloud = mar_fbm3(p * 3.4, 5u);
    let speckle = mar_value_noise(p.xy * 52.0 + p.z * 17.0);
    let pits = step(0.93, speckle);

    let rustVeinOut = clamp(rustVein + pits * 0.35, 0.0, 1.0);
    let extraRough = 0.03 + rustVein * 0.1 + greyVein * 0.07 + pits * 0.12 + cloud * 0.025;
    return vec4<f32>(rustVeinOut, clamp(greyVein, 0.0, 1.0), cloud, extraRough);
}
