/**
 * @file ssr_floor.frag.wgsl
 * @description Screen-space reflections limited to upward-facing surfaces (varnished floor).
 *
 * Tabletop: pixel-ish strides near the receiver (avoids lathe "donut" bands), then a
 * world-distance catch-up so close-up zoom still reaches pieces (~0.5 m). Self-hits are
 * rejected by world-Y (table plane), not by G-buffer +Y (that also dropped piece tops).
 * `params.stepSize` is a pixel stride (not metres).
 */

#include "../shared/structs.wgsl"

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

@group(1) @binding(0) var s: sampler;
@group(1) @binding(1) var sceneTex: texture_2d<f32>;
@group(1) @binding(2) var depthTex: texture_depth_2d;
@group(1) @binding(3) var normalTex: texture_2d<f32>;

struct SSRParams {
    stepSize: f32,
    maxSteps: f32,
    thickness: f32,
    intensity: f32,
};
@group(1) @binding(4) var<uniform> params: SSRParams;

const TABLE_PLANE_Y: f32 = 0.0025;
const MAX_TRAVEL_M: f32 = 1.15;

fn getViewPos(uv: vec2<f32>) -> vec3<f32> {
    let dim = textureDimensions(depthTex);
    let coords = vec2<i32>(clamp(floor(uv * vec2<f32>(dim)), vec2<f32>(0.0), vec2<f32>(dim) - 1.0));
    let depth = textureLoad(depthTex, coords, 0);

    let x = uv.x * 2.0 - 1.0;
    let y = (1.0 - uv.y) * 2.0 - 1.0;
    let clipPos = vec4<f32>(x, y, depth, 1.0);

    let worldPosRaw = frame.inverseViewProjectionMatrix * clipPos;
    let worldPos = worldPosRaw.xyz / worldPosRaw.w;
    let viewPos = frame.viewMatrix * vec4<f32>(worldPos, 1.0);
    return viewPos.xyz;
}

fn getWorldPos(uv: vec2<f32>) -> vec3<f32> {
    let dim = textureDimensions(depthTex);
    let coords = vec2<i32>(clamp(floor(uv * vec2<f32>(dim)), vec2<f32>(0.0), vec2<f32>(dim) - 1.0));
    let depth = textureLoad(depthTex, coords, 0);
    let x = uv.x * 2.0 - 1.0;
    let y = (1.0 - uv.y) * 2.0 - 1.0;
    let clipPos = vec4<f32>(x, y, depth, 1.0);
    let worldPosRaw = frame.inverseViewProjectionMatrix * clipPos;
    return worldPosRaw.xyz / worldPosRaw.w;
}

fn viewToWorld(vp: vec3<f32>) -> vec3<f32> {
    let m = frame.viewMatrix;
    let R = mat3x3<f32>(m[0].xyz, m[1].xyz, m[2].xyz);
    return transpose(R) * (vp - m[3].xyz);
}

fn viewToUv(viewP: vec3<f32>) -> vec2<f32> {
    let clipPos = frame.projectionMatrix * vec4<f32>(viewP, 1.0);
    if (abs(clipPos.w) < 1.0e-6) {
        return vec2<f32>(-2.0, -2.0);
    }
    let ndc = vec2<f32>(clipPos.x / clipPos.w, clipPos.y / clipPos.w);
    return vec2<f32>(ndc.x * 0.5 + 0.5, ndc.y * -0.5 + 0.5);
}

fn worldNormalFromGBuffer(uv: vec2<f32>) -> vec3<f32> {
    let viewNormal = normalize(textureSampleLevel(normalTex, s, uv, 0.0).xyz * 2.0 - 1.0);
    let viewRot = mat3x3<f32>(
        frame.viewMatrix[0].xyz,
        frame.viewMatrix[1].xyz,
        frame.viewMatrix[2].xyz
    );
    return normalize(transpose(viewRot) * viewNormal);
}

fn hash21(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

fn inScreen(u: vec2<f32>) -> bool {
    return u.x >= 0.0 && u.x <= 1.0 && u.y >= 0.0 && u.y <= 1.0;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let viewPos = getViewPos(uv);
    if (viewPos.z < -500.0) { return vec4<f32>(0.0); }

    let worldNormal = worldNormalFromGBuffer(uv);
    let floorAmt = smoothstep(0.55, 0.88, worldNormal.y);
    if (floorAmt < 0.02) { return vec4<f32>(0.0); }

    let recvY = viewToWorld(viewPos).y;
    // Studio cloth sits under the slab (~-0.025); varnish SSR is only the checker (~y 0).
    if (recvY < -0.008) { return vec4<f32>(0.0); }

    // Varnish is a horizontal coat: reflect with geometric +Y, not wood-grain G-buffer wobble.
    let viewUp = normalize((frame.viewMatrix * vec4<f32>(0.0, 1.0, 0.0, 0.0)).xyz);
    let viewDir = normalize(viewPos);
    let reflectDir = normalize(reflect(viewDir, viewUp));

    let ndotv = saturate(dot(viewUp, -viewDir));
    let fresnel = 0.04 + 0.96 * pow(1.0 - ndotv, 5.0);

    let texSize = vec2<f32>(textureDimensions(depthTex));
    let pixelStride = max(params.stepSize, 0.75);
    let maxSteps = i32(params.maxSteps);
    let thickness = max(params.thickness, 0.004);

    var pos = viewPos + reflectDir * 0.0012;
    pos += reflectDir * (hash21(uv * texSize) * 0.0006);
    var prevPos = pos;
    var traveled = 0.0;

    var hit = false;
    var hitUV = uv;

    for (var i = 0; i < maxSteps; i++) {
        // Behind the camera / near plane → projection is garbage (typical close-up fade).
        if (pos.z > -0.0004) {
            break;
        }

        let uvA = viewToUv(pos);
        if (!inScreen(uvA)) {
            break;
        }

        let probeUv = viewToUv(pos + reflectDir * 0.003);
        let pixels = length((probeUv - uvA) * texSize);
        var viewStep = 0.003 * (pixelStride / max(pixels, 0.35));

        // First steps stay ~1 px (piece bases). Then catch up so zoom still covers the table.
        let grow = select(min(1.0 + f32(i - 40) * 0.04, 5.0), 1.0, i < 40);
        viewStep *= grow;
        let stepsLeft = f32(max(maxSteps - i, 1));
        let catchUp = (MAX_TRAVEL_M - traveled) / stepsLeft;
        viewStep = max(viewStep, catchUp * 0.55);
        viewStep = clamp(viewStep, 0.0004, 0.014);
        viewStep = min(viewStep, MAX_TRAVEL_M - traveled);

        prevPos = pos;
        pos += reflectDir * viewStep;
        traveled += viewStep;
        if (traveled >= MAX_TRAVEL_M) {
            break;
        }

        let uvB = viewToUv(pos);
        if (!inScreen(uvB)) {
            break;
        }

        let prevSceneZ = getViewPos(uvA).z;
        let sceneZ = getViewPos(uvB).z;
        let prevRayZ = prevPos.z;
        let rayZ = pos.z;

        let wasInFront = prevRayZ > prevSceneZ + 1e-5;
        let nowBehind = rayZ <= sceneZ;
        let closeBehind = (sceneZ - rayZ) > 0.0 && (sceneZ - rayZ) < thickness;
        if (!((wasInFront && nowBehind) || closeBehind)) {
            continue;
        }

        let penetration = sceneZ - rayZ;
        if (penetration > thickness * 2.5) {
            continue;
        }

        // Table plane only — piece crowns are +Y and must still count when zoomed in.
        if (getWorldPos(uvB).y < recvY + TABLE_PLANE_Y) {
            continue;
        }

        var lo = prevPos;
        var hi = pos;
        var refinedUv = uvB;
        for (var j = 0; j < 8; j++) {
            let mid = mix(lo, hi, 0.5);
            refinedUv = viewToUv(mid);
            if (!inScreen(refinedUv)) {
                break;
            }
            let midSceneZ = getViewPos(refinedUv).z;
            if (mid.z > midSceneZ) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        if (getWorldPos(refinedUv).y < recvY + TABLE_PLANE_Y) {
            continue;
        }
        hitUV = refinedUv;
        hit = true;
        break;
    }

    if (!hit) { return vec4<f32>(0.0); }

    let dX = smoothstep(0.0, 0.04, hitUV.x) * smoothstep(1.0, 0.96, hitUV.x);
    let dY = smoothstep(0.0, 0.04, hitUV.y) * smoothstep(1.0, 0.96, hitUV.y);
    let screenEdgeFactor = dX * dY;
    let reflectionColor = textureSampleLevel(sceneTex, s, hitUV, 0.0).rgb;
    // PBR: normalBuffer.a = roughnessIbl — matte tiles contribute less SSR.
    let recvRough = saturate(textureSampleLevel(normalTex, s, uv, 0.0).a);
    let glossAmt = pow(1.0 - recvRough, 2.0);
    let weight = screenEdgeFactor * params.intensity * floorAmt * mix(0.35, 1.0, fresnel) * glossAmt;
    return vec4<f32>(reflectionColor * weight, 1.0);
}
