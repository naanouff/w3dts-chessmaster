// Ultra Terrain - Masks (WIP)
// Writes procedural masks into an output storage texture.
// Format: rgba8unorm
// - R: path mask (0..1)  (domain-warped band)
// - G: water mask (0..1) (multi-lake, domain-warped)
// - B: points mask (0..1) (scattered blobs)
// - A: 1

// Buffer layout (64 bytes / 16 floats) -> matches RenderGraph buffer size.
// The goal is natural-looking masks (avoid perfect circles/lines).
struct MaskParams {
    // x: bandWidth, y: bandStrength, z: warpStrength, w: warpFrequency
    path: vec4<f32>,
    // x: lakeRadius, y: shoreWidth, z: lakeStrength, w: waterSeed
    water: vec4<f32>,
    // x: waterCenterX, y: waterCenterY, z: pointsStrength, w: pointsRadius
    misc0: vec4<f32>,
    // x: pointsCount, y: pointsSeed, z: edgeNoiseStrength, w: edgeNoiseFrequency
    misc1: vec4<f32>,
};

fn saturate(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }
fn lerp(a: f32, b: f32, t: f32) -> f32 { return a + (b - a) * t; }
fn fade(t: f32) -> f32 { return t * t * (3.0 - 2.0 * t); }

fn hash12(p: vec2<f32>, seed: f32) -> f32 {
    let h = dot(p, vec2<f32>(127.1, 311.7)) + seed * 19.19;
    return fract(sin(h) * 43758.5453123);
}

fn noise2(p: vec2<f32>, seed: f32) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let a = hash12(i + vec2<f32>(0.0, 0.0), seed);
    let b = hash12(i + vec2<f32>(1.0, 0.0), seed);
    let c = hash12(i + vec2<f32>(0.0, 1.0), seed);
    let d = hash12(i + vec2<f32>(1.0, 1.0), seed);
    let u = vec2<f32>(fade(f.x), fade(f.y));
    return lerp(lerp(a, b, u.x), lerp(c, d, u.x), u.y);
}

fn fbm(p: vec2<f32>, seed: f32) -> f32 {
    var value = 0.0;
    var amp = 0.5;
    var freq = 1.0;
    for (var o = 0; o < 5; o++) {
        value += amp * noise2(p * freq, seed + f32(o) * 13.37);
        freq *= 2.0;
        amp *= 0.5;
    }
    return value;
}

fn domainWarp(uv: vec2<f32>, strength: f32, frequency: f32, seed: f32) -> vec2<f32> {
    if (strength <= 0.0) {
        return uv;
    }
    let p = uv * max(0.0001, frequency);
    let ox = fbm(p + vec2<f32>(17.0, 3.0), seed) - 0.5;
    let oy = fbm(p + vec2<f32>(5.0, 19.0), seed + 101.0) - 0.5;
    return uv + vec2<f32>(ox, oy) * strength;
}

@group(0) @binding(0) var outPathMask: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> params: MaskParams;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = textureDimensions(outPathMask);
    if (gid.x >= dims.x || gid.y >= dims.y) {
        return;
    }

    let uv = vec2<f32>(
        f32(gid.x) / max(1.0, f32(dims.x - 1u)),
        f32(gid.y) / max(1.0, f32(dims.y - 1u))
    );

    // Shared parameters
    let edgeNoiseStrength = max(0.0, params.misc1.z);
    let edgeNoiseFrequency = max(0.0001, params.misc1.w);

    // --- Path mask (R) ---
    let bandWidth = max(0.0001, params.path.x);
    let bandStrength = max(0.0, params.path.y);
    let warpStrength = max(0.0, params.path.z);
    let warpFrequency = max(0.0001, params.path.w);

    // Domain warp the UVs aggressively for curving, serpentine paths.
    let uvWarped = domainWarp(uv, warpStrength * 1.3, warpFrequency * 0.8, 11.0);
    
    // Additional "valley-seeking" warp: curves follow low-frequency noise (like terrain following).
    let valleyWarp = domainWarp(uv, warpStrength * 0.5, warpFrequency * 0.3, 41.0);
    let uvCurved = mix(uvWarped, valleyWarp, 0.4);

    // Multiple parallel bands (not just diagonal) for more organic coverage.
    // Each band has slight offset/phase shift.
    let edgeN1 = (fbm(uvCurved * edgeNoiseFrequency, 23.0) - 0.5) * edgeNoiseStrength;
    let edgeN2 = (fbm(uvCurved * edgeNoiseFrequency * 0.7, 24.0) - 0.5) * edgeNoiseStrength * 0.6;
    
    // Primary band (diagonal-ish but curved).
    let dLine1 = abs((uvCurved.x - uvCurved.y) + edgeN1);
    
    // Secondary bands offset for more path coverage (like tributaries).
    let dLine2 = abs((uvCurved.x - uvCurved.y - 0.35) + edgeN2);
    let dLine3 = abs((uvCurved.x - uvCurved.y + 0.32) + edgeN2);

    // Vary local width along bands.
    let wVar = 0.65 + 0.9 * fbm(uvCurved * (edgeNoiseFrequency * 0.6), 29.0);
    let localWidth = bandWidth * wVar;

    // Combine three bands with OR logic (any band can be a path).
    let path1 = smoothstep(localWidth, 0.0, dLine1);
    let path2 = smoothstep(localWidth * 0.8, 0.0, dLine2) * 0.7;  // Secondary paths slightly fainter
    let path3 = smoothstep(localWidth * 0.8, 0.0, dLine3) * 0.7;
    let pathBase = max(max(path1, path2), path3);

    // Repel paths from water: reduce strength near water mask.
    // Water will be computed next, so we'll modulate after.
    let pathMask = saturate(pathBase * bandStrength);

    // --- Water mask (G) ---
    let lakeRadius = max(0.0, params.water.x);
    let shoreWidth = max(0.0001, params.water.y);
    let lakeStrength = max(0.0, params.water.z);
    let waterSeed = params.water.w;
    let waterCenter = params.misc0.xy;

    // Water has its own warp seed so it doesn't line up with the path.
    let waterUv = domainWarp(uv, warpStrength * 0.8, warpFrequency * 0.9, 71.0 + waterSeed);

    // Multi-lake: small fixed loop (fast). Centers are derived from seed.
    var waterMask = 0.0;
    for (var i = 0u; i < 3u; i++) {
        let fi = f32(i);
        let cx = fract(waterCenter.x + hash12(vec2<f32>(fi, 1.0), 101.0 + waterSeed));
        let cy = fract(waterCenter.y + hash12(vec2<f32>(fi, 2.0), 131.0 + waterSeed));
        let c = vec2<f32>(cx, cy);

        let baseR = lakeRadius * (0.75 + 0.65 * hash12(vec2<f32>(fi, 3.0), 151.0 + waterSeed));
        let shore = shoreWidth * (0.7 + 0.8 * hash12(vec2<f32>(fi, 4.0), 181.0 + waterSeed));

        // Irregular shoreline
        let dn = (fbm(waterUv * edgeNoiseFrequency, 199.0 + fi * 7.0 + waterSeed) - 0.5) * edgeNoiseStrength;
        let dist = length(waterUv - c) + dn * 0.35;

        let lake = smoothstep(baseR, baseR - shore, dist);
        waterMask = max(waterMask, lake);
    }
    waterMask = saturate(waterMask * lakeStrength);

    // --- Shore-parallel paths: run alongside water edges (not perpendicular) ---
    // Sample water mask at 4 cardinal directions to compute water gradient.
    // This detects the direction of water edges for shore-parallel path generation.
    
    // Sample E (right)
    var waterE = 0.0;
    let uvE = waterUv + vec2<f32>(0.03, 0.0);
    for (var i = 0u; i < 3u; i++) {
        let fi = f32(i);
        let cx = fract(waterCenter.x + hash12(vec2<f32>(fi, 1.0), 101.0 + waterSeed));
        let cy = fract(waterCenter.y + hash12(vec2<f32>(fi, 2.0), 131.0 + waterSeed));
        let c = vec2<f32>(cx, cy);
        let baseR = lakeRadius * (0.75 + 0.65 * hash12(vec2<f32>(fi, 3.0), 151.0 + waterSeed));
        let shore = shoreWidth * (0.7 + 0.8 * hash12(vec2<f32>(fi, 4.0), 181.0 + waterSeed));
        let dn = (fbm(uvE * edgeNoiseFrequency, 199.0 + fi * 7.0 + waterSeed) - 0.5) * edgeNoiseStrength;
        let dist = length(uvE - c) + dn * 0.35;
        let lake = smoothstep(baseR, baseR - shore, dist);
        waterE = max(waterE, lake);
    }
    waterE = saturate(waterE * lakeStrength);
    
    // Sample W (left)
    var waterW = 0.0;
    let uvW = waterUv + vec2<f32>(-0.03, 0.0);
    for (var i = 0u; i < 3u; i++) {
        let fi = f32(i);
        let cx = fract(waterCenter.x + hash12(vec2<f32>(fi, 1.0), 101.0 + waterSeed));
        let cy = fract(waterCenter.y + hash12(vec2<f32>(fi, 2.0), 131.0 + waterSeed));
        let c = vec2<f32>(cx, cy);
        let baseR = lakeRadius * (0.75 + 0.65 * hash12(vec2<f32>(fi, 3.0), 151.0 + waterSeed));
        let shore = shoreWidth * (0.7 + 0.8 * hash12(vec2<f32>(fi, 4.0), 181.0 + waterSeed));
        let dn = (fbm(uvW * edgeNoiseFrequency, 199.0 + fi * 7.0 + waterSeed) - 0.5) * edgeNoiseStrength;
        let dist = length(uvW - c) + dn * 0.35;
        let lake = smoothstep(baseR, baseR - shore, dist);
        waterW = max(waterW, lake);
    }
    waterW = saturate(waterW * lakeStrength);
    
    // Sample N (north)
    var waterN = 0.0;
    let uvN = waterUv + vec2<f32>(0.0, 0.03);
    for (var i = 0u; i < 3u; i++) {
        let fi = f32(i);
        let cx = fract(waterCenter.x + hash12(vec2<f32>(fi, 1.0), 101.0 + waterSeed));
        let cy = fract(waterCenter.y + hash12(vec2<f32>(fi, 2.0), 131.0 + waterSeed));
        let c = vec2<f32>(cx, cy);
        let baseR = lakeRadius * (0.75 + 0.65 * hash12(vec2<f32>(fi, 3.0), 151.0 + waterSeed));
        let shore = shoreWidth * (0.7 + 0.8 * hash12(vec2<f32>(fi, 4.0), 181.0 + waterSeed));
        let dn = (fbm(uvN * edgeNoiseFrequency, 199.0 + fi * 7.0 + waterSeed) - 0.5) * edgeNoiseStrength;
        let dist = length(uvN - c) + dn * 0.35;
        let lake = smoothstep(baseR, baseR - shore, dist);
        waterN = max(waterN, lake);
    }
    waterN = saturate(waterN * lakeStrength);
    
    // Sample S (south)
    var waterS = 0.0;
    let uvS = waterUv + vec2<f32>(0.0, -0.03);
    for (var i = 0u; i < 3u; i++) {
        let fi = f32(i);
        let cx = fract(waterCenter.x + hash12(vec2<f32>(fi, 1.0), 101.0 + waterSeed));
        let cy = fract(waterCenter.y + hash12(vec2<f32>(fi, 2.0), 131.0 + waterSeed));
        let c = vec2<f32>(cx, cy);
        let baseR = lakeRadius * (0.75 + 0.65 * hash12(vec2<f32>(fi, 3.0), 151.0 + waterSeed));
        let shore = shoreWidth * (0.7 + 0.8 * hash12(vec2<f32>(fi, 4.0), 181.0 + waterSeed));
        let dn = (fbm(uvS * edgeNoiseFrequency, 199.0 + fi * 7.0 + waterSeed) - 0.5) * edgeNoiseStrength;
        let dist = length(uvS - c) + dn * 0.35;
        let lake = smoothstep(baseR, baseR - shore, dist);
        waterS = max(waterS, lake);
    }
    waterS = saturate(waterS * lakeStrength);
    
    // Gradient direction indicates where water edge is.
    let gradX = waterE - waterW;
    let gradY = waterN - waterS;
    
    // Shore path runs perpendicular to gradient (tangent to shore contours).
    // If gradient points E-W, paths run N-S. If gradient points N-S, paths run E-W.
    // We create horizontal/vertical bands perpendicular to the gradient.
    let perpX = -gradY;  // Perpendicular to gradient
    let perpY = gradX;
    let perpLen = length(vec2<f32>(perpX, perpY)) + 0.0001;
    let perpDir = vec2<f32>(perpX / perpLen, perpY / perpLen);
    
    // Create shore-parallel path bands (run along contours).
    let shorePathStrength = 1.0;  // Same strength as diagonal paths (was too weak at 0.6)
    let shorePathWidth = bandWidth * 1.1;  // Slightly wider shore bands
    
    // Distance to perpendicular "shore lines".
    let dotPerp = abs(dot(waterUv - waterCenter, perpDir));
    let shorePath1 = smoothstep(shorePathWidth, 0.0, dotPerp - 0.08) * shorePathStrength;
    let shorePath2 = smoothstep(shorePathWidth, 0.0, dotPerp - 0.24) * shorePathStrength * 0.7;
    let shorePathBase = max(shorePath1, shorePath2);
    
    // Shore paths activate near water and suppress diagonal paths within proximity.
    let waterDist = distance(waterUv, waterCenter);
    let shoreProximity = saturate(1.0 - waterDist / (lakeRadius * 1.5));  // Tighter radius for more influence
    let shorePathFinal = shorePathBase * shoreProximity * bandStrength;

    // Apply water repulsion to paths: paths avoid water bodies.
    // The further from water, the stronger the path signal.
    let waterRepulsion = 1.0 - saturate(waterMask * 1.2);  // Paths are suppressed in/near water
    let pathMaskDiagonal = pathMask * waterRepulsion;
    
    // Combine diagonal paths with shore-parallel paths: shore paths WIN near water.
    // Near water: shore paths dominate. Far from water: diagonal paths remain.
    let pathMaskFinal = mix(pathMaskDiagonal, shorePathFinal, shoreProximity * 0.95);

    // --- Points mask (B) ---
    let pointsStrength = max(0.0, params.misc0.z);
    let pointsRadius = max(0.0001, params.misc0.w);
    let pointsCount = u32(clamp(params.misc1.x, 0.0, 16.0));
    let pointsSeed = params.misc1.y;

    var pointsMask = 0.0;
    for (var j = 0u; j < pointsCount; j++) {
        let fj = f32(j);
        let px = hash12(vec2<f32>(fj, 11.0), 401.0 + pointsSeed);
        let py = hash12(vec2<f32>(fj, 13.0), 433.0 + pointsSeed);
        let c = vec2<f32>(px, py);

        let rr = pointsRadius * (0.7 + 0.8 * hash12(vec2<f32>(fj, 17.0), 499.0 + pointsSeed));
        let dn = (fbm(uvWarped * edgeNoiseFrequency, 541.0 + fj * 3.0 + pointsSeed) - 0.5) * edgeNoiseStrength;
        let dist = length(uvWarped - c) + dn * 0.25;

        let blob = smoothstep(rr, rr - max(0.0001, shoreWidth * 0.5), dist);
        pointsMask = max(pointsMask, blob);
    }
    pointsMask = saturate(pointsMask * pointsStrength);

    textureStore(outPathMask, vec2<i32>(gid.xy), vec4<f32>(pathMaskFinal, waterMask, pointsMask, 1.0));
}
