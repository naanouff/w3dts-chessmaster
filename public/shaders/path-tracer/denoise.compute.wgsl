/**
 * Spatial denoiser: box blur or edge-aware blend using path trace guide (normal xyz + depth in alpha).
 * denoiserParams[0]: bypass (non-zero → copy input)
 * denoiserParams[1]: kernel radius (pixels), clamped 1–16 when bypass is 0
 * denoiserParams[2]: guided (non-zero → weight neighbors by guide similarity)
 * denoiserParams[3]: firefly suppress (non-zero → pull outliers toward neighbor-weighted mean)
 * denoiserParams[4]: atrous active (used by denoise_atrous; ignored here)
 */

@group(0) @binding(0) var pathTraceInput: texture_storage_2d<rgba16float, read>;
@group(0) @binding(1) var pathTraceGuide: texture_storage_2d<rgba16float, read>;
@group(0) @binding(2) var denoisedOutput: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var<storage, read> denoiserParams: array<u32, 8>;

fn luminance_rgb(c: vec3<f32>) -> f32 {
    return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = textureDimensions(pathTraceInput);
    if (gid.x >= dims.x || gid.y >= dims.y) { return; }

    let xy = vec2<i32>(gid.xy);
    if (denoiserParams[0] != 0u) {
        textureStore(denoisedOutput, xy, textureLoad(pathTraceInput, xy));
        return;
    }

    let rad = i32(clamp(denoiserParams[1], 1u, 16u));
    let guided = denoiserParams[2] != 0u;
    let fireflySuppress = denoiserParams[3] != 0u;
    let centerC = textureLoad(pathTraceInput, xy);
    let centerG = textureLoad(pathTraceGuide, xy);
    var sum = vec4<f32>(0.0);
    var wsum = 0.0;
    var sumNeigh = vec4<f32>(0.0);
    var wsumNeigh = 0.0;
    var maxNeighLum = 0.0;

    for (var dy = -rad; dy <= rad; dy++) {
        for (var dx = -rad; dx <= rad; dx++) {
            let p = xy + vec2<i32>(dx, dy);
            if (p.x >= 0 && p.x < i32(dims.x) && p.y >= 0 && p.y < i32(dims.y)) {
                let c = textureLoad(pathTraceInput, p);
                var w = 1.0;
                if (guided) {
                    let g = textureLoad(pathTraceGuide, p);
                    let dn = g.xyz - centerG.xyz;
                    let dz = g.w - centerG.w;
                    let dist = dot(dn, dn) * 4.0 + dz * dz * 400.0;
                    w = exp(-dist * 2.0);
                }
                sum += c * w;
                wsum += w;
                let isCenter = (dx == 0 && dy == 0);
                if (!isCenter) {
                    sumNeigh += c * w;
                    wsumNeigh += w;
                    maxNeighLum = max(maxNeighLum, luminance_rgb(c.rgb));
                }
            }
        }
    }

    var outC = sum / max(wsum, 1e-6);
    if (fireflySuppress && wsumNeigh > 1e-5) {
        let neighMean = sumNeigh / wsumNeigh;
        let meanNeighLum = luminance_rgb(neighMean.rgb);
        let cLum = luminance_rgb(centerC.rgb);
        let outLum = luminance_rgb(outC.rgb);
        let refLum = max(maxNeighLum, 0.02);
        var pull = false;
        if (cLum > 6.5 * refLum) { pull = true; }
        if (meanNeighLum > 0.008 && outLum > meanNeighLum * 4.5 + 0.06) { pull = true; }
        if (pull) {
            outC = mix(outC, neighMean, 0.86);
        }
    }
    textureStore(denoisedOutput, xy, outC);
}
