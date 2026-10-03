/**
 * @file hatched_shadows.frag.wgsl
 * @description Replaces standard shadows with pen-and-ink hatching.
 *
 * Uses the shadow factor from normalBuffer.a (written by **toon** / NPR masters).
 * Lit PBR writes roughness into .a for floor SSR instead — do not pair hatch with PBR.
 * In shadowed areas, the color is lifted back to lit brightness and hatching lines
 * are drawn instead. Lit areas are untouched.
 */

#include "../shared/structs.wgsl"

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

@group(1) @binding(0) var s: sampler;
@group(1) @binding(1) var inputTex: texture_2d<f32>;    // scene color (post-outline)
@group(1) @binding(2) var depthTex: texture_depth_2d;   // scene depth
@group(1) @binding(3) var normalTex: texture_2d<f32>;   // normalBuffer (.a = shadow factor)

struct HatchParams {
    spacing:        f32, // pixel spacing between hatch lines
    strength:       f32, // ink opacity 0-1
    lineWidth:      f32, // line thickness as fraction of spacing 0-1
    depthInfluence: f32, // depth-based spacing scale (anti-moiré)
    angle1:         f32, // first hatch direction (radians)
    angle2:         f32, // second hatch direction (radians)
};
@group(1) @binding(4) var<uniform> params: HatchParams;

/// Hatch line pattern: returns 0 (between lines) to 1 (on a line).
fn hatchLine(pixelCoord: vec2<f32>, angle: f32, spacing: f32, width: f32) -> f32 {
    let ca = cos(angle);
    let sa = sin(angle);
    let d = pixelCoord.x * ca + pixelCoord.y * sa;
    let t = fract(d / spacing);
    let halfW = width * 0.5;
    return smoothstep(halfW + 0.01, halfW, abs(t - 0.5));
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let color = textureSample(inputTex, s, uv).rgb;

    // ── Sky guard ────────────────────────────────────────────────────────
    let depthDim    = textureDimensions(depthTex);
    let depthCoords = vec2<i32>(floor(uv * vec2<f32>(depthDim)));
    let rawDepth    = textureLoad(depthTex, depthCoords, 0);
    if (rawDepth >= 0.9999) {
        return vec4<f32>(color, 1.0);
    }

    // ── Read shadow factor from normalBuffer.a ───────────────────────────
    // shadowFactor: 1.0 = fully lit, 0.0 = fully in shadow
    let normalDim   = textureDimensions(normalTex);
    let normalCoords = vec2<i32>(floor(uv * vec2<f32>(normalDim)));
    let shadowFactor = textureLoad(normalTex, normalCoords, 0).a;

    // shadow: 0 = lit, 1 = deep shadow (inverted for hatching intensity)
    let shadow = 1.0 - shadowFactor;

    // Early-out: no hatching on lit pixels
    if (shadow < 0.02) {
        return vec4<f32>(color, 1.0);
    }

    // ── LIFT: brighten shadow areas so hatching replaces the darkening ──
    // We can't perfectly reconstruct the lit color (ambient has different hue
    // than direct light). Instead, gently brighten shadows and let the
    // combination of mild residual darkening + hatch lines convey the shadow.
    // A moderate 1.8x boost keeps the hue natural while making the
    // "paper" between hatch lines much lighter than a raw shadow.
    let liftAmount = mix(1.0, 1.8, shadow);  // 1.0 for lit, 1.8 for deep shadow
    let baseColor = clamp(color * liftAmount, vec3(0.0), vec3(1.0));

    // ── Depth modulation (anti-moiré on distant terrain) ─────────────────
    let cx = uv.x * 2.0 - 1.0;
    let cy = (1.0 - uv.y) * 2.0 - 1.0;
    let clipPos     = vec4<f32>(cx, cy, rawDepth, 1.0);
    let worldPosRaw = frame.inverseViewProjectionMatrix * clipPos;
    let worldPos    = worldPosRaw.xyz / worldPosRaw.w;
    let viewPos     = frame.viewMatrix * vec4<f32>(worldPos, 1.0);
    let linDepth    = -viewPos.z;

    let depthScale = 1.0 + params.depthInfluence * clamp(linDepth / 200.0, 0.0, 2.0);
    let spacing    = params.spacing * depthScale;

    // ── Screen pixel coordinate ──────────────────────────────────────────
    let screenDim = vec2<f32>(textureDimensions(inputTex));
    let pixel     = uv * screenDim;

    // ── Hatching: single direction parallel pencil strokes ──────────────
    let w = params.lineWidth;

    // All strokes go in the same direction (angle1) — like pencil hatching.
    // Shadow intensity only controls density (spacing gets tighter).
    let baseDensity = smoothstep(0.0, 0.3, shadow);   // 0..1
    let denseBoost  = smoothstep(0.5, 0.9, shadow);   // extra tightening in deep shadow

    // Tighter spacing in deeper shadow (spacing shrinks from 100% to 50%)
    let adaptedSpacing = spacing * mix(1.0, 0.5, denseBoost);

    let h = hatchLine(pixel, params.angle1, adaptedSpacing, w);
    let hatchMask = h * baseDensity;

    // ── Composite: ink lines on the lifted base color ────────────────────
    let inkColor     = baseColor * 0.12;  // near-black ink
    let hatchedColor = mix(baseColor, inkColor, hatchMask * params.strength);

    return vec4<f32>(hatchedColor, 1.0);
}
