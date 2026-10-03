/**
 * @file procedural_skybox_realtime.wgsl
 */

#include "../shared/structs.wgsl"
#include "../shared/noise_functions.wgsl"

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

struct SkyboxParams {
    sunSize: f32,
    sunBloom: f32,
    cloudDensity: f32,
    cloudScale: f32,
    cloudSpeed: f32,
    cloudBrightness: f32,
    starsThreshold: f32,
    timeOfDay: f32, 
};

@group(1) @binding(0) var<uniform> params: SkyboxParams;
@group(1) @binding(1) var gradientRamp: texture_2d<f32>;
@group(1) @binding(2) var rampSampler: sampler;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
    let pos = array<vec3<f32>, 36>(
        vec3(-1.0, -1.0, 1.0), vec3(1.0, -1.0, 1.0), vec3(1.0, 1.0, 1.0),
        vec3(-1.0, -1.0, 1.0), vec3(1.0, 1.0, 1.0), vec3(-1.0, 1.0, 1.0),
        vec3(-1.0, -1.0, -1.0), vec3(-1.0, 1.0, -1.0), vec3(1.0, 1.0, -1.0),
        vec3(-1.0, -1.0, -1.0), vec3(1.0, 1.0, -1.0), vec3(1.0, -1.0, -1.0),
        vec3(-1.0, 1.0, -1.0), vec3(-1.0, 1.0, 1.0), vec3(1.0, 1.0, 1.0),
        vec3(-1.0, 1.0, -1.0), vec3(1.0, 1.0, 1.0), vec3(1.0, 1.0, -1.0),
        vec3(-1.0, -1.0, -1.0), vec3(1.0, -1.0, -1.0), vec3(1.0, -1.0, 1.0),
        vec3(-1.0, -1.0, -1.0), vec3(1.0, -1.0, 1.0), vec3(-1.0, -1.0, 1.0),
        vec3(1.0, -1.0, -1.0), vec3(1.0, 1.0, -1.0), vec3(1.0, 1.0, 1.0),
        vec3(1.0, -1.0, -1.0), vec3(1.0, 1.0, 1.0), vec3(1.0, -1.0, 1.0),
        vec3(-1.0, -1.0, -1.0), vec3(-1.0, -1.0, 1.0), vec3(-1.0, 1.0, 1.0),
        vec3(-1.0, -1.0, -1.0), vec3(-1.0, 1.0, 1.0), vec3(-1.0, 1.0, -1.0)
    );

    var view_no_trans = frame.viewMatrix;
    view_no_trans[3] = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    let p = pos[vertexIndex];
    var output: VertexOutput;
    output.clip_position = (frame.projectionMatrix * view_no_trans * vec4<f32>(p, 1.0)).xyww;
    output.world_position = p;
    output.uv = vec2(0.0);
    output.world_normal = p;
    output.color = vec4(0.0);
    output.shadowPos = vec4(0.0);
    output.tangent_space_light_dir = vec3(0.0);
    output.tangent_space_view_dir = vec3(0.0);
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let dir = normalize(input.world_position);
    let h = params.timeOfDay;
    
    // 1. MÉCANIQUE CÉLESTE
    let sunAngle = ((h - 6.0) / 24.0) * 6.283185; 
    let sunDir = normalize(vec3<f32>(cos(sunAngle), sin(sunAngle), 0.2));
    let moonDir = -sunDir;

    let nightFactor = smoothstep(0.1, -0.3, sunDir.y);
    let sunsetFactor = exp(-pow(sunDir.y * 4.0, 2.0));

    // 2. GRADIENT RAMP
    let ramp_u = dir.y * 0.5 + 0.5;
    let ramp_v = h / 24.0;
    var skyColor = textureSampleLevel(gradientRamp, rampSampler, vec2(ramp_u, ramp_v), 0.0).rgb;

    // 3. SOLEIL & LUNE
    let sunDot = max(dot(dir, sunDir), 0.0);
    let sunDisk = smoothstep(1.0 - params.sunSize, 1.0 - params.sunSize + 0.005, sunDot);
    let sunColor = mix(vec3(1.0, 0.9, 0.8), vec3(1.0, 0.4, 0.1), sunsetFactor);
    skyColor += sunColor * (sunDisk * 40.0 + pow(sunDot, 1.0 / params.sunBloom) * 0.8) * (1.0 - nightFactor);

    let moonDot = max(dot(dir, moonDir), 0.0);
    let moonDisk = smoothstep(1.0 - params.sunSize * 1.1, 1.0 - params.sunSize * 1.1 + 0.005, moonDot);
    skyColor += (moonDisk * 3.0 + pow(moonDot, 16.0) * 0.4) * vec3(0.4, 0.5, 0.8) * nightFactor;

    // 4. VOIE LACTÉE (APPEL 3D CORRIGÉ)
    if (nightFactor > 0.0) {
        let galacticDir = normalize(vec3<f32>(dir.x + dir.y, dir.y - dir.x, dir.z));
        let galacticPlane = 1.0 - abs(galacticDir.y);
        let bandMask = pow(galacticPlane, 12.0);

        let nebulaNoise = fractal_noise_3d(dir.xyz * 2.5 + 42.0, 3u);
        let nebulaEffect = smoothstep(0.3, 0.8, nebulaNoise) * bandMask;
        let nebulaCol = mix(vec3(0.02, 0.02, 0.05), vec3(0.1, 0.05, 0.15), nebulaNoise);
        skyColor += nebulaEffect * nebulaCol * nightFactor * 6.0;

        let starSeed = dot(dir.xyz, vec3(12.9898, 78.233, 45.543));
        let starNoise = fract(sin(starSeed) * 43758.5453);
        let dynamicThreshold = params.starsThreshold - (bandMask * 0.02);

        if (starNoise > dynamicThreshold) {
            let flicker = sin(frame.totalTime * 1.0 + starNoise * 100.0) * (0.05 * starNoise) + 0.95;
            let starIntensity = (starNoise - dynamicThreshold) / (1.0 - dynamicThreshold);
            skyColor += mix(vec3(0.9, 0.9, 1.0), vec3(1.0, 0.8, 0.6), starNoise) * starIntensity * flicker * nightFactor * 2.5;
        }
    }

    // 5. NUAGES (APPEL 2D)
    if (params.cloudDensity > 0.0 && dir.y > 0.0) {
        let cloudUV = (dir.xz / (dir.y + 0.2)) * params.cloudScale;
        let t = frame.totalTime * params.cloudSpeed;
        let n1 = fractal_noise(cloudUV + vec2(t, t * 0.5), 4u);
        let n2 = fractal_noise(cloudUV * 1.5 - vec2(t * 0.5, t), 3u);
        let pulse = sin(t * 0.5) * 0.05;
        let cloudAlpha = smoothstep(1.0 - (params.cloudDensity + pulse), 1.0 - (params.cloudDensity + pulse) + 0.2, (n1 + n2) * 0.5);
        
        var finalCloudColor = mix(vec3(params.cloudBrightness), vec3(1.0, 0.5, 0.2) * 1.5, sunsetFactor * 0.8);
        finalCloudColor = mix(finalCloudColor, vec3(0.02, 0.02, 0.08), nightFactor);
        skyColor = mix(skyColor, finalCloudColor, cloudAlpha * smoothstep(0.0, 0.3, dir.y));
    }

    return vec4<f32>(skyColor, 1.0);
}