/**
 * Edge-aware à-trous wavelet step (3×3), spacing `step` pixels. Used in a chain (e.g. step 1,2,4,8).
 * denoiserParams[4]: non-zero → run filter; zero → copy input (cheap no-op when spatial A-trous disabled).
 */

@group(0) @binding(0) var inputTex: texture_storage_2d<rgba16float, read>;
@group(0) @binding(1) var guideTex: texture_storage_2d<rgba16float, read>;
@group(0) @binding(2) var outputTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var<storage, read> denoiserParams: array<u32, 8>;
@group(0) @binding(44) var<storage, read> pathTracerTileInfo: array<u32>;

fn atrous_kernel(gid: vec3<u32>, step: i32) {
    let dims = textureDimensions(inputTex);
    if (gid.x >= dims.x || gid.y >= dims.y) { return; }
    let xy = vec2<i32>(i32(gid.x), i32(gid.y));
    let tileW = i32(pathTracerTileInfo[4]);
    let tileH = i32(pathTracerTileInfo[5]);

    if (denoiserParams[4] == 0u) {
        textureStore(outputTex, xy, textureLoad(inputTex, xy));
        return;
    }
    // Keep a small guard-band untouched near tile borders to avoid visible seams
    // caused by missing neighbors across tile boundaries.
    let edgeGuard = max(1, step);
    if (xy.x < edgeGuard || xy.y < edgeGuard || xy.x >= tileW - edgeGuard || xy.y >= tileH - edgeGuard) {
        textureStore(outputTex, xy, textureLoad(inputTex, xy));
        return;
    }

    let centerC = textureLoad(inputTex, xy);
    let centerG = textureLoad(guideTex, xy);

    let w00 = 0.0625;
    let w01 = 0.125;
    let w02 = 0.0625;
    let w10 = 0.125;
    let w11 = 0.25;
    let w12 = 0.125;
    let w20 = 0.0625;
    let w21 = 0.125;
    let w22 = 0.0625;

    var weights = array<f32, 9>(w00, w01, w02, w10, w11, w12, w20, w21, w22);

    var sum = vec4<f32>(0.0);
    var wsum = 0.0;
    var ki = 0;
    for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
            let p = xy + vec2<i32>(dx * step, dy * step);
            var baseW = weights[ki];
            ki = ki + 1;
            if (p.x < 0 || p.y < 0 || p.x >= i32(dims.x) || p.y >= i32(dims.y)) {
                continue;
            }
            let c = textureLoad(inputTex, p);
            let g = textureLoad(guideTex, p);
            let dn = g.xyz - centerG.xyz;
            let dz = g.w - centerG.w;
            let dc = c.rgb - centerC.rgb;
            let distG = dot(dn, dn) * 4.0 + dz * dz * 400.0;
            let distC = dot(dc, dc) * 2.5;
            let w = baseW * exp(-distG * 2.0) * exp(-distC * 0.25);
            sum += c * w;
            wsum += w;
        }
    }

    let filtered = sum / max(wsum, 1e-6);
    let atrousBlendRaw = bitcast<f32>(denoiserParams[5]);
    let atrousBlend = clamp(select(atrousBlendRaw, 0.45, denoiserParams[5] == 0u), 0.0, 1.0);
    // Conservative blend reduces over-blur on fine details.
    let outC = mix(centerC, filtered, atrousBlend);
    textureStore(outputTex, xy, outC);
}

@compute @workgroup_size(8, 8, 1)
fn main_s1(@builtin(global_invocation_id) gid: vec3<u32>) {
    atrous_kernel(gid, 1);
}

@compute @workgroup_size(8, 8, 1)
fn main_s2(@builtin(global_invocation_id) gid: vec3<u32>) {
    atrous_kernel(gid, 2);
}

@compute @workgroup_size(8, 8, 1)
fn main_s4(@builtin(global_invocation_id) gid: vec3<u32>) {
    atrous_kernel(gid, 4);
}

@compute @workgroup_size(8, 8, 1)
fn main_s8(@builtin(global_invocation_id) gid: vec3<u32>) {
    atrous_kernel(gid, 8);
}

