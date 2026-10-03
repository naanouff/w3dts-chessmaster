/**
 * @file vegetation_functions.wgsl
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-08-20
 * @description Procedural bark (triplanar plates) and dense leaflet-card tufts
 * with species serration and thin-card transmission.
 */

fn veg_hash21(p: vec2<f32>) -> vec2<f32> {
    let n = vec2<f32>(dot(p, vec2<f32>(127.1, 311.7)), dot(p, vec2<f32>(269.5, 183.3)));
    return fract(sin(n) * 43758.5453123);
}

fn veg_value_noise(uv: vec2<f32>) -> f32 {
    let i = floor(uv);
    let f = fract(uv);
    let a = veg_hash21(i).x;
    let b = veg_hash21(i + vec2<f32>(1.0, 0.0)).x;
    let c = veg_hash21(i + vec2<f32>(0.0, 1.0)).x;
    let d = veg_hash21(i + vec2<f32>(1.0, 1.0)).x;
    let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn veg_fbm(p: vec2<f32>) -> f32 {
    let px = max(fwidth(p.x), fwidth(p.y));
    var total = 0.0;
    var frequency = 1.0;
    var amplitude = 0.5;
    for (var o: u32 = 0u; o < 4u; o = o + 1u) {
        let fade = 1.0 - smoothstep(0.3, 0.85, frequency * px);
        total += veg_value_noise(p * frequency) * amplitude * fade;
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return total;
}

/** Smooth 0..1 groove (C-inf), 1 = trough. */
fn veg_groove(phase: f32) -> f32 {
    return pow(0.5 - 0.5 * cos(phase), 1.55);
}

/** F1, F2, cell id. */
fn veg_voronoi(uv: vec2<f32>) -> vec3<f32> {
    let cell = floor(uv);
    let f = fract(uv);
    var f1 = 8.0;
    var f2 = 8.0;
    var hid = 0.0;
    for (var j: i32 = -1; j <= 1; j = j + 1) {
        for (var i: i32 = -1; i <= 1; i = i + 1) {
            let g = vec2<f32>(f32(i), f32(j));
            let o = veg_hash21(cell + g);
            let d = length(g + o * 0.82 - f);
            if (d < f1) {
                f2 = f1;
                f1 = d;
                hid = o.x;
            } else if (d < f2) {
                f2 = d;
            }
        }
    }
    return vec3<f32>(f1, f2, hid);
}

/**
 * One triplanar plane. `style`: 0 oak, 1 birch, 2 pine, 3 spruce, 4 fruit, 5 bush,
 * 6 grass stem, 7 mushroom stipe, 8 flower stem.
 */
fn bark_height(uv: vec2<f32>, seed: f32, style: f32) -> vec4<f32> {
    let seed2 = vec2<f32>(seed * 0.13, seed * 0.07);
    var gp = uv + seed2;
    let px = max(fwidth(gp.x), fwidth(gp.y));
    let hiFade = 1.0 - smoothstep(0.04, 0.14, px);
    let warp = veg_fbm(gp * 0.45);
    let warp2 = veg_fbm(gp * 0.7 + vec2<f32>(4.1, 1.7));
    gp = gp + vec2<f32>(warp * 0.55, warp2 * 0.45) * hiFade;
    let cork = veg_fbm(gp * 3.2 + vec2<f32>(2.0, seed2.x));

    if (style > 0.5 && style < 1.5) {
        // Birch: pale paper bark + horizontal lenticels.
        let dashUv = vec2<f32>(gp.x * 2.4, gp.y * 7.2);
        let cell = floor(dashUv);
        var lenticel = 0.0;
        for (var j: i32 = -1; j <= 1; j = j + 1) {
            for (var i: i32 = -1; i <= 1; i = i + 1) {
                let c = cell + vec2<f32>(f32(i), f32(j));
                let h = veg_hash21(c + seed2);
                if (h.x > 0.38) {
                    continue;
                }
                let center = c + 0.2 + 0.6 * veg_hash21(c + vec2<f32>(3.1, seed));
                let d = (dashUv - center) * vec2<f32>(0.55, 2.8);
                lenticel = max(lenticel, 1.0 - smoothstep(0.1, 0.38, length(d)));
            }
        }
        lenticel = lenticel * hiFade;
        let paper = 0.05 + cork * 0.1;
        let height = 0.82 + cork * 0.08 - lenticel * 0.22;
        return vec4<f32>(clamp(paper + lenticel * 0.22, 0.0, 1.0), 0.0, clamp(height, 0.0, 1.0), 0.18 + lenticel * 0.12);
    }

    if (style > 1.5 && style < 3.5) {
        // Pine / spruce: flaky scales, less deep vertical grooves.
        let fine = select(1.15, 0.85, style < 2.5);
        let cell = veg_voronoi(vec2<f32>(gp.x, gp.y) * fine);
        let gap = cell.y - cell.x;
        let gapW = max(fwidth(gap) * 2.2, 0.02);
        let plateEdge = (1.0 - smoothstep(0.03 - gapW, 0.14 + gapW, gap)) * hiFade;
        let flake = veg_groove(gp.y * 4.2 + gp.x * 3.8 + cork * 1.4);
        let flakeW = max(fwidth(flake) * 2.0, 0.04);
        let flakeCrack = smoothstep(0.62 - flakeW, 0.94 + flakeW, flake) * hiFade;
        let grooveMask = smoothstep(0.28, 0.7, veg_groove(gp.x * 2.4 + gp.y * 0.55 + warp * 1.4)) * 0.4 * hiFade;
        let height = (1.0 - plateEdge * 0.45) * (1.0 - flakeCrack * 0.28) * (1.0 - grooveMask * 0.35);
        let albedoMix = plateEdge * 0.22 + flakeCrack * 0.14 + grooveMask * 0.18;
        return vec4<f32>(
            clamp(albedoMix, 0.0, 1.0),
            0.05,
            clamp(mix(0.22, 1.0, height), 0.0, 1.0),
            0.22 + plateEdge * 0.1
        );
    }

    if (style > 5.5 && style < 6.5) {
        // Grass stem: vertical fibers, no bark plates.
        let fiber = veg_groove(gp.x * 9.5 + warp * 0.8);
        let height = 0.88 + cork * 0.06 - fiber * 0.1 * hiFade;
        return vec4<f32>(clamp(fiber * 0.18, 0.0, 1.0), 0.0, clamp(height, 0.0, 1.0), 0.28 + fiber * 0.08);
    }

    if (style > 6.5 && style < 7.5) {
        // Mushroom stipe: pale, faint rings, soft pores.
        let ring = veg_groove(gp.y * 5.4 + cork * 1.2);
        let fiber = veg_groove(gp.x * 5.8 + warp * 0.4);
        let pore = veg_voronoi(gp * 4.6).x;
        let height = 0.9 - ring * 0.1 * hiFade - fiber * 0.05 - pore * 0.04;
        let albedoMix = ring * 0.14 + fiber * 0.06 + pore * 0.08;
        return vec4<f32>(clamp(albedoMix, 0.0, 1.0), 0.0, clamp(height, 0.0, 1.0), 0.34 + ring * 0.08);
    }

    if (style > 7.5 && style < 8.5) {
        // Flower stem: fine green ribs.
        let fiber = veg_groove(gp.x * 11.0 + warp * 0.5);
        let height = 0.9 + cork * 0.04 - fiber * 0.08 * hiFade;
        return vec4<f32>(clamp(fiber * 0.14, 0.0, 1.0), 0.0, clamp(height, 0.0, 1.0), 0.26 + fiber * 0.06);
    }

    // Oak (and milder fruit trees when style >= 4).
    let oakAmt = select(0.55, 1.0, style < 0.5);
    let groove = veg_groove(gp.x * 2.8 + gp.y * 0.75 + warp * 1.8);
    let grooveW = max(fwidth(groove) * 2.4, 0.04);
    var grooveMask = smoothstep(0.18 - grooveW, 0.58 + grooveW, groove) * oakAmt;
    let cell = veg_voronoi(vec2<f32>(gp.x * 0.95, gp.y * 0.7));
    let gap = cell.y - cell.x;
    let gapW = max(fwidth(gap) * 2.2, 0.02);
    let plateEdge = (1.0 - smoothstep(0.03 - gapW, 0.13 + gapW, gap)) * hiFade;
    let plateBreak = plateEdge * (1.0 - grooveMask * 0.85);
    let flake = veg_groove(gp.y * 4.8 + gp.x * 1.2 + cork * 1.6);
    let flakeW = max(fwidth(flake) * 2.0, 0.04);
    let flakeCrack = smoothstep(0.68 - flakeW, 0.94 + flakeW, flake) * (1.0 - grooveMask) * 0.32 * hiFade;
    var height = (1.0 - grooveMask * 0.72) * (1.0 - plateBreak * 0.4) * (1.0 - flakeCrack);
    height = mix(0.22, 1.0, clamp(height, 0.0, 1.0));
    height = height * (0.82 + cork * 0.18);
    let albedoMix = clamp(
        grooveMask * 0.32 + plateBreak * 0.14 + flakeCrack * 0.08 + (1.0 - cork) * 0.05 * (1.0 - grooveMask),
        0.0,
        1.0
    );
    let lichen = grooveMask * smoothstep(0.56, 0.84, veg_fbm(gp * 0.4 + vec2<f32>(8.0, 3.0))) * 0.7;
    let extraRough = 0.2 + grooveMask * 0.12 + plateBreak * 0.08 + cork * 0.06;
    return vec4<f32>(albedoMix, clamp(lichen, 0.0, 1.0), clamp(height, 0.0, 1.0), extraRough);
}

/** `pos` / `normal` are object-space (mesh local), not world. */
fn bark_look(pos: vec3<f32>, seed: f32, scale: f32, normal: vec3<f32>, style: f32) -> vec4<f32> {
    let s = max(scale, 0.08) * 2.15;
    let p = pos * s;
    let n = normalize(normal);
    var w = pow(abs(n), vec3<f32>(2.15));
    w = w / (w.x + w.y + w.z + 0.0001);

    let yz = bark_height(vec2<f32>(p.z, p.y), seed, style);
    let xy = bark_height(vec2<f32>(p.x, p.y), seed + 1.7, style);
    let xz = bark_height(vec2<f32>(p.x, p.z), seed + 3.1, style);
    let blended = yz * w.x + xz * w.y + xy * w.z;
    // Dominant-plane height: blending three high-freq heights explodes dpdx at 45° seams.
    var h = yz.z;
    if (w.y >= w.x && w.y >= w.z) {
        h = xz.z;
    } else if (w.z >= w.x) {
        h = xy.z;
    }
    return vec4<f32>(blended.x, blended.y, h, blended.w);
}

fn leaflet_mask(
    uv: vec2<f32>,
    center: vec2<f32>,
    angle: f32,
    size: vec2<f32>,
    seed: f32,
    style: f32
) -> vec2<f32> {
    let c = cos(angle);
    let s = sin(angle);
    let d = uv - center;
    let p = vec2<f32>(c * d.x + s * d.y, -s * d.x + c * d.y) / max(size, vec2<f32>(0.04));
    let r = length(p / vec2<f32>(0.72, 1.0));
    let phi = atan2(p.x, p.y);
    var lobe = 0.0;
    var tooth = 0.0;
    if (style < 0.5) {
        // Oak: deep lobes + coarse teeth.
        lobe = 0.22 * pow(abs(sin(phi * 3.0 + 0.18)), 0.52);
        tooth = 0.06 * sin(phi * 14.0 + seed);
    } else if (style < 1.5) {
        // Birch: ovate, fine double-serrate.
        lobe = 0.035 * abs(sin(phi * 2.0));
        tooth = 0.075 * sin(phi * 26.0 + seed) + 0.028 * sin(phi * 52.0 + seed * 1.7);
    } else if (style >= 3.5 && style < 4.5) {
        // Apple / cherry: milder saw.
        lobe = 0.055 * abs(sin(phi * 2.4));
        tooth = 0.042 * sin(phi * 16.0 + seed);
    } else {
        // Bush / plants (pine uses needles, not this mask).
        lobe = 0.04 * abs(sin(phi * 2.2));
        tooth = 0.035 * sin(phi * 18.0 + seed);
    }
    let outline = r - lobe + tooth;
    let w = max(fwidth(outline), 0.012);
    var alpha = 1.0 - smoothstep(0.82 - w, 0.96 + w, outline);
    alpha = alpha * (1.0 - (1.0 - smoothstep(0.0, 0.18, p.y + 0.95)) * (1.0 - smoothstep(0.0, 0.16, abs(p.x))));
    let midrib = 1.0 - smoothstep(0.0, 0.09, abs(p.x) + abs(p.y) * 0.02);
    let side = abs(sin((p.y * 5.2 + abs(p.x) * 1.6) * 3.14159265 + seed));
    let veins = max(midrib * 0.85, smoothstep(0.64, 1.0, side) * (1.0 - abs(p.x)) * 0.45);
    return vec2<f32>(clamp(alpha, 0.0, 1.0), veins * alpha);
}

/**
 * Dense tuft: filled canopy blob + overlapping leaflets. Photo albedo passes through.
 */
fn leaf_look(
    uv: vec2<f32>,
    seed: f32,
    tex: vec4<f32>,
    leafColor: vec3<f32>,
    veinColor: vec3<f32>,
    style: f32,
    card: f32
) -> vec4<f32> {
    let texDev = abs(tex.r - 1.0) + abs(tex.g - 1.0) + abs(tex.b - 1.0) + abs(tex.a - 1.0);
    let useTex = smoothstep(0.05, 0.18, texDev);

    var alpha = 0.0;
    var veins = 0.0;
    let blotch = veg_fbm(uv * 5.5 + vec2<f32>(seed * 0.07, 2.4)) * 0.16;
    let pore = veg_voronoi(uv * vec2<f32>(5.6, 5.6) + vec2<f32>(seed * 0.03, 0.7)).x;
    let pollenRgb = mix(veinColor, leafColor, clamp(blotch * 1.4, 0.0, 0.45));
    let berryRgb = mix(
        vec3<f32>(0.48, 0.08, 0.14),
        vec3<f32>(0.16, 0.04, 0.06),
        clamp(blotch * 1.8 + (1.0 - pore) * 0.4, 0.0, 1.0)
    );

    if (style > 5.5 && style < 6.5) {
        // Grass: one tapered blade per card (base at uv.y=1).
        let along = 1.0 - uv.y;
        let x = (uv.x - 0.5) * 2.0;
        let halfW = mix(0.92, 0.07, pow(clamp(along, 0.0, 1.0), 1.18));
        let w = max(fwidth(x), 0.018);
        alpha = 1.0 - smoothstep(halfW, halfW + w * 2.2, abs(x));
        alpha = alpha * smoothstep(-0.02, 0.07, along) * (1.0 - smoothstep(0.9, 1.04, along));
        veins = (1.0 - smoothstep(0.0, 0.1, abs(x))) * alpha;
    } else if (style > 6.5 && style < 7.5) {
        // Mushroom cap: spots on top, gills underneath. No cutout.
        alpha = 1.0;
        let gill = abs(sin(uv.x * 48.0 * 3.14159265 + seed));
        let underside = 1.0 - smoothstep(0.38, 0.5, uv.y);
        veins = gill * underside * 0.85;
        let spots = veg_voronoi(uv * vec2<f32>(7.2, 5.4) + vec2<f32>(seed * 0.04, 1.3));
        let spot = (1.0 - smoothstep(0.12, 0.28, spots.x)) * smoothstep(0.48, 0.62, uv.y);
        veins = max(veins, spot * 0.7);
    } else if (style > 7.5 && style < 8.5) {
        // Flower petal: teardrop, yellow throat at the base.
        let along = 1.0 - uv.y;
        let x = (uv.x - 0.5) * 2.0;
        let mid = mix(0.62, 0.95, smoothstep(0.0, 0.38, along));
        let halfW = mid * mix(1.0, 0.08, smoothstep(0.68, 1.02, along));
        let w = max(fwidth(x), 0.02);
        alpha = 1.0 - smoothstep(halfW, halfW + w * 2.0, abs(x));
        alpha = alpha * smoothstep(-0.03, 0.08, along) * (1.0 - smoothstep(0.94, 1.06, along));
        veins = (1.0 - smoothstep(0.55, 0.9, along)) * alpha;
    } else if (style > 1.5 && style < 3.5) {
        // Pine / spruce needle spray.
        for (var k: u32 = 0u; k < 11u; k = k + 1u) {
            let h = veg_hash21(vec2<f32>(f32(k) * 2.1 + seed * 0.03, seed * 0.02 + f32(k)));
            let ang = f32(k) * 0.52 + (h.x - 0.5) * 0.45;
            let c = cos(ang);
            let s = sin(ang);
            let d = uv - vec2<f32>(0.5, 0.42);
            let p = vec2<f32>(c * d.x + s * d.y, -s * d.x + c * d.y);
            let along = clamp(p.y * 1.15 + 0.08, 0.0, 1.0);
            let needle = (1.0 - smoothstep(0.012, 0.045, abs(p.x))) * (1.0 - smoothstep(0.62, 0.92, along)) * smoothstep(0.0, 0.08, along);
            alpha = max(alpha, needle);
        }
    } else {
        let q = (uv - vec2<f32>(0.5, 0.52)) / vec2<f32>(0.46, 0.5);
        // Inner fill only — leaflets must stick out so serration reads on the silhouette.
        let tuftNoise = veg_fbm(uv * 3.4 + vec2<f32>(seed * 0.05, 1.2)) * 0.14;
        alpha = 1.0 - smoothstep(0.42, 0.78, length(q) + tuftNoise);
        let count = select(10u, 8u, style < 0.5 || style >= 1.5);
        for (var k: u32 = 0u; k < 10u; k = k + 1u) {
            if (k >= count) {
                break;
            }
            let h = veg_hash21(vec2<f32>(f32(k) * 1.7 + seed * 0.031, seed * 0.017 + f32(k)));
            let center = vec2<f32>(0.5, 0.5) + (h - vec2<f32>(0.5)) * vec2<f32>(0.28, 0.26);
            let angle = (h.x - 0.5) * 1.15 + f32(k) * 0.38;
            var size = vec2<f32>(0.22 + h.y * 0.09, 0.36 + h.x * 0.1);
            if (style > 0.5 && style < 1.5) {
                size = vec2<f32>(0.15 + h.y * 0.05, 0.3 + h.x * 0.08);
            }
            let lf = leaflet_mask(uv, center, angle, size, seed + f32(k), style);
            alpha = max(alpha, lf.x);
            veins = max(veins, lf.y);
        }
    }

    var rgb = mix(leafColor, veinColor, clamp(veins * 0.65 + blotch, 0.0, 1.0));
    let isFlower = style > 7.5 && style < 8.5;
    let isMushroom = style > 6.5 && style < 7.5;
    let usePollen = select(0.0, 1.0, card < 0.5 && isFlower);
    let useBerry = select(0.0, 1.0, card < 0.5 && !isMushroom && !isFlower);
    alpha = mix(alpha, 1.0, max(usePollen, useBerry));
    rgb = mix(rgb, pollenRgb, usePollen);
    rgb = mix(rgb, berryRgb, useBerry);
    let proc = vec4<f32>(rgb, clamp(alpha, 0.0, 1.0));
    return mix(proc, tex, useTex);
}

/**
 * Thin-card backlight wrap (not refraction). Higher at the margin, lower on midrib.
 * Scale by `transmissionFactor` (~0.35) so MASK cutout stays intact.
 */
fn leaf_transmission(uv: vec2<f32>, seed: f32, style: f32) -> f32 {
    if (style > 6.5 && style < 7.5) {
        return 0.08;
    }
    if (style > 5.5 && style < 6.5) {
        let along = 1.0 - uv.y;
        return mix(0.22, 0.95, smoothstep(0.15, 0.85, along));
    }
    if (style > 7.5 && style < 8.5) {
        let rim = 1.0 - abs(uv.x - 0.5) * 2.0;
        return mix(0.85, 0.28, clamp(rim, 0.0, 1.0));
    }
    if (style > 1.5 && style < 3.5) {
        return 0.52;
    }
    let q = (uv - vec2<f32>(0.5, 0.52)) / vec2<f32>(0.46, 0.5);
    let rim = smoothstep(0.22, 0.92, length(q));
    let midrib = 1.0 - smoothstep(0.0, 0.11, abs(uv.x - 0.5));
    let veinWave = abs(sin((uv.y * 7.5 + abs(uv.x - 0.5) * 3.2) * 3.14159265 + seed));
    let veins = smoothstep(0.62, 0.98, veinWave) * (1.0 - rim);
    let blotch = veg_fbm(uv * 5.8 + vec2<f32>(seed * 0.06, 2.2));
    var t = mix(0.28, 1.0, rim);
    t = t * (1.0 - midrib * 0.5);
    t = t * (1.0 - veins * 0.28);
    t = t * (0.86 + blotch * 0.28);
    return clamp(t, 0.14, 1.0);
}
