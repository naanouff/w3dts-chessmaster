/**
 * @file noise_functions.wgsl
 * @description Bibliothèque de bruit procédural optimisée pour WebGPU.
 */

// --- 1. FONCTIONS DE BASE (HELPERS) ---

fn random_val(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

/** * Génère une valeur pseudo-aléatoire 3D.
 * Doit être définie AVANT value_noise_3d.
 */
fn random_val_3d(p: vec3<f32>) -> f32 {
    let h = dot(p, vec3<f32>(127.1, 311.7, 74.7));
    return fract(sin(h) * 43758.5453123);
}

fn smoothstep_interp(t: f32) -> f32 {
    return t * t * (3.0 - 2.0 * t);
}

// --- 2. BRUIT 2D ---

fn value_noise(uv: vec2<f32>) -> f32 {
    let i = floor(uv);
    let f = fract(uv);
    let a = random_val(i);
    let b = random_val(i + vec2(1.0, 0.0));
    let c = random_val(i + vec2(0.0, 1.0));
    let d = random_val(i + vec2(1.0, 1.0));
    let u = smoothstep_interp(f.x);
    let v = smoothstep_interp(f.y);
    return mix(mix(a, b, u), mix(c, d, u), v);
}

fn fractal_noise(p: vec2<f32>, octaves: u32) -> f32 {
    var total = 0.0;
    var frequency = 1.0;
    var amplitude = 0.5;
    for (var i: u32 = 0u; i < octaves; i = i + 1u) {
        total += value_noise(p * frequency) * amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return total;
}

// --- 3. BRUIT 3D (Interpolation Trilinéaire) ---

fn value_noise_3d(p: vec3<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);

    // Les 8 sommets du cube unité
    let v000 = random_val_3d(i + vec3(0.0, 0.0, 0.0));
    let v100 = random_val_3d(i + vec3(1.0, 0.0, 0.0));
    let v010 = random_val_3d(i + vec3(0.0, 1.0, 0.0));
    let v110 = random_val_3d(i + vec3(1.0, 1.0, 0.0));
    let v001 = random_val_3d(i + vec3(0.0, 0.0, 1.0));
    let v101 = random_val_3d(i + vec3(1.0, 0.0, 1.0));
    let v011 = random_val_3d(i + vec3(0.0, 1.0, 1.0));
    let v111 = random_val_3d(i + vec3(1.0, 1.0, 1.0));

    let u = vec3(smoothstep_interp(f.x), smoothstep_interp(f.y), smoothstep_interp(f.z));

    return mix(
        mix(mix(v000, v100, u.x), mix(v010, v110, u.x), u.y),
        mix(mix(v001, v101, u.x), mix(v011, v111, u.x), u.y),
        u.z
    );
}

fn fractal_noise_3d(p: vec3<f32>, octaves: u32) -> f32 {
    var total = 0.0;
    var frequency = 1.0;
    var amplitude = 0.5;
    for (var i: u32 = 0u; i < octaves; i = i + 1u) {
        total += value_noise_3d(p * frequency) * amplitude;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return total;
}