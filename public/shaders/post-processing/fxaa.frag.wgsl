/**
 * @file fxaa.frag.wgsl
 * @description Fast Approximate Anti-Aliasing.
 * Lisse les bords crénelés en post-process.
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var inputTex: texture_2d<f32>;

// Helper pour calculer la luminance (perceptuelle)
fn rgb2luma(rgb: vec3<f32>) -> f32 {
    return dot(rgb, vec3<f32>(0.299, 0.587, 0.114));
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let dimensions = vec2<f32>(textureDimensions(inputTex));
    let pixelSize = vec2<f32>(1.0 / dimensions.x, 1.0 / dimensions.y);

    // Paramètres FXAA (Réglages standards pour la qualité)
    let FXAA_SPAN_MAX = 8.0;
    let FXAA_REDUCE_MUL = 1.0 / 8.0;
    let FXAA_REDUCE_MIN = 1.0 / 128.0;

    // 1. Échantillonnage des voisins (Croix)
    let rgbNW = textureSample(inputTex, s, uv + vec2<f32>(-1.0, -1.0) * pixelSize).rgb;
    let rgbNE = textureSample(inputTex, s, uv + vec2<f32>(1.0, -1.0) * pixelSize).rgb;
    let rgbSW = textureSample(inputTex, s, uv + vec2<f32>(-1.0, 1.0) * pixelSize).rgb;
    let rgbSE = textureSample(inputTex, s, uv + vec2<f32>(1.0, 1.0) * pixelSize).rgb;
    let rgbM  = textureSample(inputTex, s, uv).rgb;

    // 2. Calcul Luminance
    let lumaNW = rgb2luma(rgbNW);
    let lumaNE = rgb2luma(rgbNE);
    let lumaSW = rgb2luma(rgbSW);
    let lumaSE = rgb2luma(rgbSE);
    let lumaM  = rgb2luma(rgbM);

    // 3. Détection de bord (Contraste Min/Max)
    let lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    let lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

    // 4. Calcul de la direction du flou
    let dir = vec2<f32>(
        -((lumaNW + lumaNE) - (lumaSW + lumaSE)),
        ((lumaNW + lumaSW) - (lumaNE + lumaSE))
    );

    let dirReduce = max(
        (lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL),
        FXAA_REDUCE_MIN
    );

    let rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);

    let finalDir = min(
        vec2<f32>(FXAA_SPAN_MAX, FXAA_SPAN_MAX),
        max(
            vec2<f32>(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),
            dir * rcpDirMin
        )
    ) * pixelSize;

    // 5. Échantillonnage final (Mélange)
    let rgbA = 0.5 * (
        textureSample(inputTex, s, uv + finalDir * (1.0 / 3.0 - 0.5)).rgb +
        textureSample(inputTex, s, uv + finalDir * (2.0 / 3.0 - 0.5)).rgb
    );

    let rgbB = rgbA * 0.5 + 0.25 * (
        textureSample(inputTex, s, uv + finalDir * -0.5).rgb +
        textureSample(inputTex, s, uv + finalDir * 0.5).rgb
    );

    let lumaB = rgb2luma(rgbB);

    var color = vec3<f32>(0.0);
    if ((lumaB < lumaMin) || (lumaB > lumaMax)) {
        color = rgbA;
    } else {
        color = rgbB;
    }

    return vec4<f32>(color, 1.0);
}