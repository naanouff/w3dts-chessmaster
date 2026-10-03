/**
 * @file lego_tile_functions.wgsl
 * @project w3dts
 * @description Procedural LEGO plate floor: multi-size bricks, soft bevels, analytic normals.
 * Mosaic stays sharp mid-field (no avg-color melt). AA is hard-capped to bevel width
 * so grazing does not turn plates into a soft wash. Specular sky wash is a material
 * roughness/IBL concern, not LOD.
 *
 * lego_tile_look → rgb albedo, w = final roughness (per-plate gloss + cavity)
 * lego_tile_normal → world-space normal with analytic bevel + stud bump
 */

fn lego_hash31(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453123);
}

fn lego_brick_size(h: f32) -> vec2<f32> {
    if (h < 0.18) {
        return vec2<f32>(1.0, 1.0);
    }
    if (h < 0.42) {
        return vec2<f32>(2.0, 1.0);
    }
    if (h < 0.66) {
        return vec2<f32>(1.0, 2.0);
    }
    if (h < 0.82) {
        return vec2<f32>(2.0, 2.0);
    }
    if (h < 0.91) {
        return vec2<f32>(3.0, 1.0);
    }
    return vec2<f32>(1.0, 3.0);
}

fn lego_brick_covers(origin: vec2<f32>, size: vec2<f32>, cell: vec2<f32>) -> bool {
    return cell.x >= origin.x && cell.x < origin.x + size.x &&
        cell.y >= origin.y && cell.y < origin.y + size.y;
}

fn lego_brick_priority(origin: vec2<f32>, seed: f32) -> f32 {
    return lego_hash31(origin + vec2<f32>(seed * 0.13, 3.17));
}

fn lego_brick_valid(origin: vec2<f32>, size: vec2<f32>, seed: f32) -> bool {
    let pri = lego_brick_priority(origin, seed);
    let maxK = 3;
    for (var j = 0; j < maxK; j = j + 1) {
        for (var i = 0; i < maxK; i = i + 1) {
            if (f32(i) >= size.x || f32(j) >= size.y) {
                continue;
            }
            let c = origin + vec2<f32>(f32(i), f32(j));
            for (var dj = 0; dj < maxK; dj = dj + 1) {
                for (var di = 0; di < maxK; di = di + 1) {
                    let o2 = c - vec2<f32>(f32(di), f32(dj));
                    let s2 = lego_brick_size(lego_hash31(o2 + vec2<f32>(seed, 7.7)));
                    if (!lego_brick_covers(o2, s2, c)) {
                        continue;
                    }
                    let p2 = lego_brick_priority(o2, seed);
                    if (p2 < pri - 1e-6) {
                        return false;
                    }
                    if (abs(p2 - pri) <= 1e-6) {
                        if (o2.x < origin.x || (o2.x == origin.x && o2.y < origin.y)) {
                            return false;
                        }
                    }
                }
            }
        }
    }
    return true;
}

fn lego_find_brick(cell: vec2<f32>, seed: f32) -> vec4<f32> {
    let maxK = 3;
    for (var dj = 0; dj < maxK; dj = dj + 1) {
        for (var di = 0; di < maxK; di = di + 1) {
            let o = cell - vec2<f32>(f32(di), f32(dj));
            let sz = lego_brick_size(lego_hash31(o + vec2<f32>(seed, 7.7)));
            if (!lego_brick_covers(o, sz, cell)) {
                continue;
            }
            if (lego_brick_valid(o, sz, seed)) {
                return vec4<f32>(o.x, o.y, sz.x, sz.y);
            }
        }
    }
    return vec4<f32>(cell.x, cell.y, 1.0, 1.0);
}

/** 8-slot palette: greys dominant, warm base + colourful accents rarer. */
fn lego_pick_color(
    h: f32,
    colorA: vec3<f32>,
    colorB: vec3<f32>,
    colorC: vec3<f32>,
    colorD: vec3<f32>,
    accentA: vec3<f32>,
    accentB: vec3<f32>,
    accentC: vec3<f32>,
    accentD: vec3<f32>
) -> vec3<f32> {
    if (h < 0.28) {
        return colorA;
    }
    if (h < 0.50) {
        return colorB;
    }
    if (h < 0.68) {
        return colorC;
    }
    if (h < 0.80) {
        return colorD;
    }
    if (h < 0.87) {
        return accentA;
    }
    if (h < 0.92) {
        return accentB;
    }
    if (h < 0.96) {
        return accentC;
    }
    return accentD;
}

struct LegoBrickLayout {
    origin: vec2<f32>,
    bsize: vec2<f32>,
    local: vec2<f32>,
    edge: f32,
    edgeGrad: vec2<f32>,
    uv: vec2<f32>,
    px: f32,
    /** Screen pixels across one 1×1 cell (scale-independent LOD). */
    cellPx: f32,
    lod: f32,
    lodSoft: f32,
    /** 1 = full micro-detail, 0 = bevel sub-pixel. */
    detailFade: f32,
    bevelW: f32,
}

fn lego_layout(pos: vec3<f32>, seed: f32, scale: f32, gapWidth: f32) -> LegoBrickLayout {
    var out: LegoBrickLayout;
    let s = max(scale, 0.05);
    out.bevelW = clamp(gapWidth, 0.02, 0.2);
    let seed2 = vec2<f32>(seed * 0.17, seed * 0.41);
    out.uv = vec2<f32>(pos.x, pos.z) * s + seed2;
    // Derivatives first — must stay in uniform control flow (no prior divergent returns).
    let uvFw = fwidth(out.uv);
    let fwMin = max(min(uvFw.x, uvFw.y), 1e-5);
    let fwGeo = max(sqrt(max(uvFw.x, 1e-8) * max(uvFw.y, 1e-8)), 1e-5);
    // AA: geo mean, hard-capped so seams never swallow whole tiles at grazing.
    out.px = min(fwGeo, out.bevelW * 0.85);
    out.cellPx = 1.0 / fwMin;
    // No mid-field mosaic melt — grazing wash was mistaken for LOD blur.
    out.lod = 0.0;
    out.lodSoft = 0.0;
    let bevelPx = out.bevelW / max(fwGeo, 1e-5);
    out.detailFade = smoothstep(0.15, 0.85, bevelPx);

    let cell = floor(out.uv);
    let brick = lego_find_brick(cell, seed);
    out.origin = brick.xy;
    out.bsize = brick.zw;
    out.local = out.uv - out.origin;

    let edgeX = min(out.local.x, out.bsize.x - out.local.x);
    let edgeY = min(out.local.y, out.bsize.y - out.local.y);
    out.edge = min(edgeX, edgeY);
    let useX = select(0.0, 1.0, edgeX < edgeY);
    let sx = select(-1.0, 1.0, out.local.x < out.bsize.x * 0.5);
    let sy = select(-1.0, 1.0, out.local.y < out.bsize.y * 0.5);
    out.edgeGrad = vec2<f32>(useX * sx, (1.0 - useX) * sy);

    return out;
}

fn lego_stud_mask(brickLay: LegoBrickLayout, seed: f32, studAmount: f32) -> f32 {
    let sa = clamp(studAmount, 0.0, 1.0);
    let area = brickLay.bsize.x * brickLay.bsize.y;
    let studBias = mix(0.0, 0.35, clamp((area - 1.0) * 0.35, 0.0, 1.0));
    let hStud = lego_hash31(brickLay.origin + vec2<f32>(4.7, seed * 0.3));
    let hasStud = step(1.0 - (sa + studBias * sa), hStud);
    let studLocal = fract(brickLay.local);
    let dStud = length(studLocal - vec2<f32>(0.5, 0.5));
    let studR = 0.2;
    let studAa = max(brickLay.px * 1.6, 0.014);
    var mask = hasStud * (1.0 - smoothstep(studR - studAa, studR + studAa, dStud));
    // Keep studs while a cell is still several pixels wide.
    let studFade = brickLay.detailFade * smoothstep(3.0, 10.0, brickLay.cellPx);
    mask *= studFade;
    return mask;
}

fn lego_bevel_dhde(edge: f32, bevelW: f32) -> f32 {
    let w = max(bevelW, 1e-4);
    let t = clamp(edge / w, 0.0, 1.0);
    return (6.0 * t * (1.0 - t)) / w;
}

fn lego_tile_look(
    pos: vec3<f32>,
    seed: f32,
    scale: f32,
    gapWidth: f32,
    studAmount: f32,
    colorA: vec3<f32>,
    colorB: vec3<f32>,
    colorC: vec3<f32>,
    colorD: vec3<f32>,
    accentA: vec3<f32>,
    accentB: vec3<f32>,
    accentC: vec3<f32>,
    accentD: vec3<f32>,
    roughness: f32,
    roughnessVary: f32,
    gapRoughness: f32
) -> vec4<f32> {
    let brickLay = lego_layout(pos, seed, scale, gapWidth);
    // Cap AA to bevel so grazing does not turn every tile into a soft grey wash.
    let aa = clamp(brickLay.px * 1.1, 0.004, brickLay.bevelW * 0.7);
    var bevel = 1.0 - smoothstep(brickLay.bevelW - aa, brickLay.bevelW + aa, brickLay.edge);
    var seam = 1.0 - smoothstep(0.0, brickLay.bevelW * 0.5 + aa, brickLay.edge);
    let cover = brickLay.bevelW / (brickLay.bevelW + aa);
    bevel *= cover * brickLay.detailFade;
    seam *= cover * brickLay.detailFade;

    let hColor = lego_hash31(brickLay.origin + vec2<f32>(seed, 2.3));
    var albedo = lego_pick_color(
        hColor, colorA, colorB, colorC, colorD, accentA, accentB, accentC, accentD
    );
    let jitter = mix(0.96, 1.03, lego_hash31(brickLay.origin + vec2<f32>(9.1, seed)));
    albedo *= jitter;

    albedo = mix(albedo, albedo * 0.78, bevel * 0.4);
    albedo = mix(albedo, albedo * 0.55, seam * 0.45);

    let stud = lego_stud_mask(brickLay, seed, studAmount);
    let studVis = stud * (1.0 - bevel);
    albedo = mix(albedo, albedo * 1.04, studVis * 0.18);

    let cavity = clamp((bevel * 0.5 + seam * 0.3) * brickLay.detailFade, 0.0, 1.0);
    // Per-plate gloss: hash → ±roughnessVary around base, then cavity matte boost on bevels.
    let hRough = lego_hash31(brickLay.origin + vec2<f32>(seed * 0.71, 5.9));
    let vary = clamp(roughnessVary, 0.0, 0.45);
    let plateR = clamp(roughness + (hRough - 0.5) * 2.0 * vary, 0.04, 1.0);
    let r = clamp(plateR + cavity * gapRoughness, 0.04, 1.0);
    return vec4<f32>(albedo, r);
}

fn lego_tile_normal(
    pos: vec3<f32>,
    seed: f32,
    scale: f32,
    gapWidth: f32,
    studAmount: f32,
    baseNormal: vec3<f32>,
    normalStrength: f32
) -> vec3<f32> {
    let brickLay = lego_layout(pos, seed, scale, gapWidth);
    let n0 = normalize(baseNormal);
    // No early-return: would make later fwidth (in callees) non-uniform.
    let nFade = brickLay.detailFade * brickLay.detailFade * (1.0 - brickLay.lodSoft);

    let s = max(scale, 0.05);
    let strength = clamp(normalStrength, 0.0, 2.0);

    let dhde = lego_bevel_dhde(brickLay.edge, brickLay.bevelW);
    var gUv = brickLay.edgeGrad * dhde;

    let studLocal = fract(brickLay.local);
    let fromC = studLocal - vec2<f32>(0.5, 0.5);
    let dStud = length(fromC);
    let studR = 0.2;
    let stud = lego_stud_mask(brickLay, seed, studAmount);
    let bevelGate = smoothstep(0.0, brickLay.bevelW * 0.8, brickLay.edge);
    // Branchless stud dome contribution.
    let studW = stud * bevelGate * select(0.0, 1.0, dStud > 1e-4);
    let t = clamp(dStud / studR, 0.0, 1.0);
    let dhdr = -2.0 * t / max(studR, 1e-4);
    let radial = fromC / max(dStud, 1e-4);
    gUv = gUv + radial * dhdr * studW * 0.75;

    let g = gUv * s * strength * 0.38 * nFade;
    var bump = vec3<f32>(g.x, 0.0, g.y);
    bump = bump - n0 * dot(bump, n0);
    return normalize(n0 - bump);
}
