/**
 * FidelityFX FSR 1.0 — RCAS (Robust Contrast Adaptive Sharpening), RGB HDR.
 * Ported from AMD FSR v1 reference / mpv GLSL (MIT).
 */

struct PathTracerFsrParams {
    con0: vec4<f32>,
    con1: vec4<f32>,
    con2: vec4<f32>,
    con3: vec4<f32>,
    easu_enabled: u32,
    rcas_enabled: u32,
    rcas_sharpness_linear: f32,
    _pad: u32,
}

@group(0) @binding(0) var<storage, read> pathTracerFsrParams: PathTracerFsrParams;
@group(0) @binding(1) var srcHdr: texture_storage_2d<rgba16float, read>;
@group(0) @binding(2) var dstHdr: texture_storage_2d<rgba16float, write>;

const FSR_RCAS_LIMIT: f32 = 0.25 - (1.0 / 16.0);

fn apr_med_rcp_f1(a: f32) -> f32 {
    let b = bitcast<f32>(0x7ef19fffu - bitcast<u32>(a));
    return b * (-b * a + 2.0);
}

fn amin3_f1(x: f32, y: f32, z: f32) -> f32 {
    return min(x, min(y, z));
}

fn amax3_f1(x: f32, y: f32, z: f32) -> f32 {
    return max(x, max(y, z));
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dim = textureDimensions(dstHdr);
    if (gid.x >= dim.x || gid.y >= dim.y) { return; }
    let p = vec2<i32>(i32(gid.x), i32(gid.y));

    if (pathTracerFsrParams.rcas_enabled == 0u) {
        textureStore(dstHdr, p, textureLoad(srcHdr, p));
        return;
    }

    let b = textureLoad(srcHdr, p + vec2<i32>(0, -1)).rgb;
    let d = textureLoad(srcHdr, p + vec2<i32>(-1, 0)).rgb;
    let ee = textureLoad(srcHdr, p);
    let e = ee.rgb;
    let f = textureLoad(srcHdr, p + vec2<i32>(1, 0)).rgb;
    let h = textureLoad(srcHdr, p + vec2<i32>(0, 1)).rgb;

    let sharp = pathTracerFsrParams.rcas_sharpness_linear;

    var outRgb = vec3<f32>(0.0);
    for (var ch = 0u; ch < 3u; ch++) {
        let bC = b[ch];
        let dC = d[ch];
        let eC = e[ch];
        let fC = f[ch];
        let hC = h[ch];

        let mn4 = min(amin3_f1(bC, dC, fC), hC);
        let mx4 = max(amax3_f1(bC, dC, fC), hC);
        let peakC = vec2<f32>(1.0, -4.0);
        let hitMin = min(mn4, eC) * (1.0 / max(4.0 * mx4, 1e-8));
        let hitMax = (peakC.x - max(mx4, eC)) / max(4.0 * mn4 + peakC.y, 1e-8);
        var lobe = max(-hitMin, hitMax);
        lobe = max(-FSR_RCAS_LIMIT, min(lobe, 0.0)) * sharp;

        let nz = 0.25 * bC + 0.25 * dC + 0.25 * fC + 0.25 * hC - eC;
        let cMax = amax3_f1(amax3_f1(bC, dC, eC), fC, hC);
        let cMin = amin3_f1(amin3_f1(bC, dC, eC), fC, hC);
        let nzW = clamp(abs(nz) * apr_med_rcp_f1(max(cMax - cMin, 1e-8)), 0.0, 1.0);
        let nzAtten = -0.5 * nzW + 1.0;
        lobe = lobe * nzAtten;

        let rcpL = apr_med_rcp_f1(4.0 * lobe + 1.0);
        outRgb[ch] = (lobe * bC + lobe * dC + lobe * hC + lobe * fC + eC) * rcpL;
    }

    textureStore(dstHdr, p, vec4<f32>(outRgb, ee.a));
}
