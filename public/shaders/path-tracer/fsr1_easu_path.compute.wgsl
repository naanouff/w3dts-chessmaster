/**
 * FidelityFX FSR 1.0 — EASU (Edge Adaptive Spatial Upsampling), RGB path-traced HDR.
 * Based on AMD FSR v1.0.2 reference (MIT) and mpv GLSL port by agyild; luma analysis drives vec3 taps.
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

const FSR_EASU_DIR_THRESHOLD: f32 = 32768.0;

fn apr_lo_rcp_f1(a: f32) -> f32 {
    return bitcast<f32>(0x7ef07ebbu - bitcast<u32>(a));
}

fn apr_lo_rsq_f1(a: f32) -> f32 {
    return bitcast<f32>(0x5f347d74u - (bitcast<u32>(a) >> 1u));
}

fn amin3_f1(x: f32, y: f32, z: f32) -> f32 {
    return min(x, min(y, z));
}

fn amax3_f1(x: f32, y: f32, z: f32) -> f32 {
    return max(x, max(y, z));
}

fn easu_luma(c: vec3<f32>) -> f32 {
    return c.b * 0.5 + (c.r * 0.5 + c.g);
}

fn fsr_easu_tap(
    aC: ptr<function, vec3<f32>>,
    aW: ptr<function, f32>,
    off: vec2<f32>,
    dir: vec2<f32>,
    len: vec2<f32>,
    lob: f32,
    clp: f32,
    c: vec3<f32>
) {
    var v = vec2<f32>(
        off.x * dir.x + off.y * dir.y,
        off.x * (-dir.y) + off.y * dir.x
    );
    v = v * len;
    var d2 = v.x * v.x + v.y * v.y;
    d2 = min(d2, clp);
    var wB = (2.0 / 5.0) * d2 - 1.0;
    var wA = lob * d2 - 1.0;
    wB = wB * wB;
    wA = wA * wA;
    wB = (25.0 / 16.0) * wB + (-(25.0 / 16.0 - 1.0));
    let w = wB * wA;
    *aC = *aC + c * w;
    *aW = *aW + w;
}

fn fsr_easu_set(
    dir: ptr<function, vec2<f32>>,
    len: ptr<function, f32>,
    pp: vec2<f32>,
    biS: bool,
    biT: bool,
    biU: bool,
    biV: bool,
    lA: f32,
    lB: f32,
    lC: f32,
    lD: f32,
    lE: f32
) {
    var w = 0.0;
    if (biS) { w = (1.0 - pp.x) * (1.0 - pp.y); }
    if (biT) { w = pp.x * (1.0 - pp.y); }
    if (biU) { w = (1.0 - pp.x) * pp.y; }
    if (biV) { w = pp.x * pp.y; }
    let dc = lD - lC;
    let cb = lC - lB;
    var lenX = max(abs(dc), abs(cb));
    lenX = apr_lo_rcp_f1(lenX);
    let dirX = lD - lB;
    lenX = clamp(abs(dirX) * lenX, 0.0, 1.0);
    lenX = lenX * lenX;
    let ec = lE - lC;
    let ca = lC - lA;
    var lenY = max(abs(ec), abs(ca));
    lenY = apr_lo_rcp_f1(lenY);
    let dirY = lE - lA;
    lenY = clamp(abs(dirY) * lenY, 0.0, 1.0);
    lenY = lenY * lenY;
    *dir = *dir + vec2<f32>(dirX, dirY) * w;
    *len = *len + w * lenX + w * lenY;
}

fn load_rgb_clamped(p: vec2<f32>, dim: vec2<u32>) -> vec3<f32> {
    let pi = vec2<i32>(i32(floor(p.x)), i32(floor(p.y)));
    let mx = i32(dim.x) - 1;
    let my = i32(dim.y) - 1;
    let cx = clamp(pi.x, 0, mx);
    let cy = clamp(pi.y, 0, my);
    return textureLoad(srcHdr, vec2<i32>(cx, cy)).rgb;
}

fn load_rgba_clamped(p: vec2<f32>, dim: vec2<u32>) -> vec4<f32> {
    let pi = vec2<i32>(i32(floor(p.x)), i32(floor(p.y)));
    let mx = i32(dim.x) - 1;
    let my = i32(dim.y) - 1;
    let cx = clamp(pi.x, 0, mx);
    let cy = clamp(pi.y, 0, my);
    return textureLoad(srcHdr, vec2<i32>(cx, cy));
}

fn load_rgba_bilinear(p: vec2<f32>, dim: vec2<u32>) -> vec4<f32> {
    let p0 = floor(p);
    let f = p - p0;
    let c00 = load_rgba_clamped(p0 + vec2<f32>(0.0, 0.0), dim);
    let c10 = load_rgba_clamped(p0 + vec2<f32>(1.0, 0.0), dim);
    let c01 = load_rgba_clamped(p0 + vec2<f32>(0.0, 1.0), dim);
    let c11 = load_rgba_clamped(p0 + vec2<f32>(1.0, 1.0), dim);
    return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let outDim = textureDimensions(dstHdr);
    if (gid.x >= outDim.x || gid.y >= outDim.y) { return; }
    let ip = vec2<u32>(gid.xy);

    if (pathTracerFsrParams.easu_enabled == 0u) {
        let inDim = textureDimensions(srcHdr);
        let uv = (vec2<f32>(f32(gid.x) + 0.5, f32(gid.y) + 0.5)) / vec2<f32>(f32(outDim.x), f32(outDim.y));
        let src_f = uv * vec2<f32>(f32(inDim.x), f32(inDim.y)) - vec2<f32>(0.5, 0.5);
        let c0 = load_rgba_bilinear(src_f, inDim);
        textureStore(dstHdr, vec2<i32>(i32(gid.x), i32(gid.y)), c0);
        return;
    }

    let con0 = pathTracerFsrParams.con0;
    let con1 = pathTracerFsrParams.con1;
    let con2 = pathTracerFsrParams.con2;
    let con3 = pathTracerFsrParams.con3;

    let pp = vec2<f32>(f32(ip.x), f32(ip.y)) * con0.xy + con0.zw;
    let fp = floor(pp);
    let fpf = pp - fp;
    let inDim = textureDimensions(srcHdr);

    let b = load_rgb_clamped(fp + vec2<f32>(0.5, -0.5), inDim);
    let c = load_rgb_clamped(fp + vec2<f32>(1.5, -0.5), inDim);
    let e = load_rgb_clamped(fp + vec2<f32>(-0.5, 0.5), inDim);
    let f = load_rgb_clamped(fp + vec2<f32>(0.5, 0.5), inDim);
    let g = load_rgb_clamped(fp + vec2<f32>(1.5, 0.5), inDim);
    let h = load_rgb_clamped(fp + vec2<f32>(2.5, 0.5), inDim);
    let i = load_rgb_clamped(fp + vec2<f32>(-0.5, 1.5), inDim);
    let j = load_rgb_clamped(fp + vec2<f32>(0.5, 1.5), inDim);
    let k = load_rgb_clamped(fp + vec2<f32>(1.5, 1.5), inDim);
    let l = load_rgb_clamped(fp + vec2<f32>(2.5, 1.5), inDim);
    let n = load_rgb_clamped(fp + vec2<f32>(0.5, 2.5), inDim);
    let o = load_rgb_clamped(fp + vec2<f32>(1.5, 2.5), inDim);

    let bL = easu_luma(b);
    let cL = easu_luma(c);
    let iL = easu_luma(i);
    let jL = easu_luma(j);
    let fL = easu_luma(f);
    let eL = easu_luma(e);
    let kL = easu_luma(k);
    let lL = easu_luma(l);
    let hL = easu_luma(h);
    let gL = easu_luma(g);
    let oL = easu_luma(o);
    let nL = easu_luma(n);

    var dir = vec2<f32>(0.0);
    var len = 0.0;
    fsr_easu_set(&dir, &len, fpf, true, false, false, false, bL, eL, fL, gL, jL);
    fsr_easu_set(&dir, &len, fpf, false, true, false, false, cL, fL, gL, hL, kL);
    fsr_easu_set(&dir, &len, fpf, false, false, true, false, fL, iL, jL, kL, nL);
    fsr_easu_set(&dir, &len, fpf, false, false, false, true, gL, jL, kL, lL, oL);

    let dir2 = dir * dir;
    var dirR = dir2.x + dir2.y;
    let zro = dirR < (1.0 / FSR_EASU_DIR_THRESHOLD);
    dirR = apr_lo_rsq_f1(dirR);
    dirR = select(dirR, 1.0, zro);
    if (zro) { dir.x = 1.0; }
    dir = dir * vec2<f32>(dirR, dirR);

    var lenS = len * 0.5;
    lenS = lenS * lenS;
    let stretch = (dir.x * dir.x + dir.y * dir.y) * apr_lo_rcp_f1(max(abs(dir.x), abs(dir.y)));
    let len2 = vec2<f32>(
        1.0 + (stretch - 1.0) * lenS,
        1.0 + -0.5 * lenS
    );
    let lob = 0.5 + ((1.0 / 4.0 - 0.04) - 0.5) * lenS;
    let clp = apr_lo_rcp_f1(lob);

    var aC = vec3<f32>(0.0);
    var aW = 0.0;
    fsr_easu_tap(&aC, &aW, vec2<f32>(0.0, -1.0) - fpf, dir, len2, lob, clp, b);
    fsr_easu_tap(&aC, &aW, vec2<f32>(1.0, -1.0) - fpf, dir, len2, lob, clp, c);
    fsr_easu_tap(&aC, &aW, vec2<f32>(-1.0, 1.0) - fpf, dir, len2, lob, clp, i);
    fsr_easu_tap(&aC, &aW, vec2<f32>(0.0, 1.0) - fpf, dir, len2, lob, clp, j);
    fsr_easu_tap(&aC, &aW, vec2<f32>(0.0, 0.0) - fpf, dir, len2, lob, clp, f);
    fsr_easu_tap(&aC, &aW, vec2<f32>(-1.0, 0.0) - fpf, dir, len2, lob, clp, e);
    fsr_easu_tap(&aC, &aW, vec2<f32>(1.0, 1.0) - fpf, dir, len2, lob, clp, k);
    fsr_easu_tap(&aC, &aW, vec2<f32>(2.0, 1.0) - fpf, dir, len2, lob, clp, l);
    fsr_easu_tap(&aC, &aW, vec2<f32>(2.0, 0.0) - fpf, dir, len2, lob, clp, h);
    fsr_easu_tap(&aC, &aW, vec2<f32>(1.0, 0.0) - fpf, dir, len2, lob, clp, g);
    fsr_easu_tap(&aC, &aW, vec2<f32>(1.0, 2.0) - fpf, dir, len2, lob, clp, o);
    fsr_easu_tap(&aC, &aW, vec2<f32>(0.0, 2.0) - fpf, dir, len2, lob, clp, n);

    var pix = aC / max(aW, 1e-8);
    let lo = vec3<f32>(
        min(amin3_f1(f.r, g.r, j.r), k.r),
        min(amin3_f1(f.g, g.g, j.g), k.g),
        min(amin3_f1(f.b, g.b, j.b), k.b)
    );
    let hi = vec3<f32>(
        max(amax3_f1(f.r, g.r, j.r), k.r),
        max(amax3_f1(f.g, g.g, j.g), k.g),
        max(amax3_f1(f.b, g.b, j.b), k.b)
    );
    pix = clamp(pix, lo, hi);
    let aIn = textureLoad(srcHdr, vec2<i32>(i32(gid.x), i32(gid.y))).a;
    textureStore(dstHdr, vec2<i32>(i32(gid.x), i32(gid.y)), vec4<f32>(pix, aIn));
}
