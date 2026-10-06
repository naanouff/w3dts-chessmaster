// =============================================================================
// === PBR MASTER NODE (Complete: AO + Anisotropy + Emission + Normal Map) ===
// =============================================================================
// Blocs optionnels KHR sont délimités par `// [[PBR_STRIP:s:khr_*]]` … `// [[PBR_STRIP:e:khr_*]]` ; le compilateur
// (`stripPbrMasterWgslForKhrExtensions`) retire le code mort selon `pbrKhrExtensionFlags` du matériau.
// Toute modification ici doit rester alignée avec `pbrKhrExtensionStrip.ts` et ses tests.

// --- 1. Récupération des Entrées ---

// Albedo & Opacité
let albedo_sample = {{albedo}};
let albedo = albedo_sample.rgb;
let opacity_factor = {{opacity_factor}}; 
let alpha = albedo_sample.a * opacity_factor;

// ORM: glTF allows occlusionTexture.texCoord ≠ metallicRoughnessTexture.texCoord (same image, two UV sets).
// UV sets + KHR_texture_transform via packed uniforms (loader fills defaults = identity).
let roughness_factor = {{roughness_factor}};
let metallic_factor = {{metallic_factor}};
let uv_orm_mr = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfOrmMrOs, material.uvTfOrmMrRs);
let uv_orm_ao = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfOrmAoOs, material.uvTfOrmAoRs);
let orm_mr = textureSample(metallicRoughnessTexture, textureSampler, uv_orm_mr);
let orm_ao = textureSample(metallicRoughnessTexture, textureSampler, uv_orm_ao);
let ao = orm_ao.r;
let roughness = clamp(orm_mr.g * roughness_factor, 0.04, 1.0);
// Authored roughness for IBL (SpecularTest is 0). The 0.04 floor stays on direct GGX only.
let roughnessIbl = clamp(orm_mr.g * roughness_factor, 0.0, 1.0);
let metallic = clamp(orm_mr.b * metallic_factor, 0.0, 1.0);

// Emission (Sécurisée)
let emission_sample = {{emission}};
let emission = max(emission_sample.rgb, vec3<f32>(0.0));


// --- 2. ANISOTROPIE (KHR_materials_anisotropy) ---

let anisotropyStrengthUniformRaw = {{anisotropy}};
// Debug: visualize anisotropyTexture RGB when material property pbrDebugAnisoTex > 0.5 (see PBRGraph.json).
let showAnisoTextureDebug = {{debug_aniso_tex}} > 0.5;

// Physical strength ∈ [0,1] per glTF (do not use negative values for BRDF).
let anisotropyStrength = clamp(anisotropyStrengthUniformRaw, 0.0, 1.0);
let anisotropyRotation = {{anisotropy_rotation}};

// Texture: R/G direction in [-1,1] tangent space, B = strength multiplier [0,1]
let uv_aniso = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfAnisoOs, material.uvTfAnisoRs);
let anisoTex = textureSample(anisotropyTexture, textureSampler, uv_aniso);
let anisoDirectionTex = anisoTex.rg * 2.0 - 1.0;
// Filtered opposite RG at a UV island edge averages to ~0. Fade strength instead of
// substituting +T (that fallback drew a white streak along cylindrical unwrap cuts).
let anisoDirLen = length(anisoDirectionTex);
let anisotropy = anisotropyStrength * anisoTex.b * smoothstep(0.0, 0.15, anisoDirLen);


// --- 3. Vecteurs Monde & Normale ---

let V_World = normalize(frame.cameraPosition - input.world_position);
let L_World = normalize(-frame.lightDirection);

// --- MODIFICATION CRITIQUE : Utilisation de la Normal Map ---
// On utilise la normale fournie par le graphe (qui inclut la Normal Map)
// au lieu de la normale géométrique brute.
let N = normalize({{normal}}) * select(-1.0, 1.0, is_front); 

let V = V_World;
let L = L_World;
let H = normalize(V + L);
let NdotV = max(dot(N, V), 0.001); // Epsilon pour éviter div/0


// --- 4. Base TBN Anisotrope (Alignée sur la Normal Map) ---

var T_interp = normalize(input.world_tangent);
var B_interp = normalize(input.world_bitangent);

// ORTHOGONALISATION (Gram-Schmidt)
// On force la Tangente (T) à être parfaitement perpendiculaire à la nouvelle Normale (N).
// Ainsi, si la Normal Map "penche" la surface, l'anisotropie suit cette inclinaison.
let t_rej = T_interp - dot(T_interp, N) * N;
let t_rej_len = length(t_rej);
var T = select(T_interp, t_rej / t_rej_len, t_rej_len > 1e-5);
// IMPORTANT (glTF): la main (handedness) vient de tangent.w.
// Ici on la préserve via la bitangente fournie (déjà signée côté CPU).
let handedness = select(-1.0, 1.0, dot(cross(N, T), B_interp) >= 0.0);
let b_raw = cross(N, T);
let b_len = length(b_raw);
var B = select(B_interp, (b_raw / max(b_len, 1e-5)) * handedness, b_len > 1e-5);

// Application de la rotation Anisotrope
if (anisotropy != 0.0) {
    let cosRot = cos(anisotropyRotation);
    let sinRot = sin(anisotropyRotation);
    let rotMat = mat2x2<f32>(vec2(cosRot, sinRot), vec2(-sinRot, cosRot));
    
    // Direction depuis la texture (ou par défaut)
    // IMPORTANT (glTF Sample Assets): l'anisotropyTexture peut contenir des pixels neutres.
    // Éviter un normalize(0) qui produirait des NaNs.
    let dirParams = select(vec2<f32>(1.0, 0.0), anisoDirectionTex / max(anisoDirLen, 1e-5), anisoDirLen > 1e-5);
    let finalDir = rotMat * dirParams;
    
    // Rotation du repère TBN autour de la normale N
    let rotT = T * finalDir.x + B * finalDir.y;
    let rotB = B * finalDir.x - T * finalDir.y;
    
    T = normalize(rotT);
    B = normalize(rotB);
}

// Rugosités α (alpha = linearRoughness²) — normatif Khronos KHR_materials_anisotropy:
// directionAlphaRoughness = mix(materialAlphaRoughness, 1.0, strength²);
// perpendicular alpha = materialAlphaRoughness (unchanged).
let alphaRoughness = roughness * roughness;
let aniMix = clamp(anisotropy, 0.0, 1.0);
let at0 = mix(alphaRoughness, 1.0, aniMix * aniMix);
let ab0 = alphaRoughness;
let at = max(at0, 1e-4);
let ab = max(ab0, 1e-4);


// --- 5. ÉCLAIRAGE DIRECT (MULTI-LIGHTS) ---
// Diffuse / specular séparés pour KHR_materials_transmission (approximation sans refraction écran).

var totalDirectDiffuse = vec3<f32>(0.0);
var totalDirectSpecular = vec3<f32>(0.0);
var totalTransmittedDirect = vec3<f32>(0.0);
var minShadowFactor: f32 = 1.0;  // track darkest shadow for hatching (1=lit, 0=full shadow)

// Sample transmission before the light loop: interior punctual lights sit on the back
// hemisphere and never appear in sceneOpaqueColor (SSR only sees opaques + sky).
let uv_transmission = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfTransmissionOs, material.uvTfTransmissionRs);
let trans_tex_r = textureSample(transmissionTexture, textureSampler, uv_transmission).r;
let transmissionAmt = clamp({{transmissionFactor}} * trans_tex_r, 0.0, 1.0);

// Dielectric F0 from IOR (KHR_materials_ior / glTF): F0 = ((n-1)/(n+1))² at normal incidence (air).
// KHR_materials_specular scales dielectric reflectance (metals unchanged: albedo as conductor).
let ior_safe = max({{ior}}, 1.001);
let f0_dielectric = pow((ior_safe - 1.0) / (ior_safe + 1.0), 2.0);
let uv_spec = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfSpecOs, material.uvTfSpecRs);
let spec_tex_a = textureSample(specularTexture, textureSampler, uv_spec).a;
let spec_col_tex = textureSample(specularColorTexture, textureSampler, uv_spec).rgb;
let specularFactorExt = material.specularFactor * spec_tex_a;
let specularColorExt = material.specularColorFactor * spec_col_tex;
// Khronos: dielectric F0 = min(iorF0 * specularColor, 1) * specularFactor ; F90 = specularFactor.
let f0_dielectric_scaled = min(vec3<f32>(f0_dielectric) * specularColorExt, vec3<f32>(1.0)) * specularFactorExt;
let F0_base = mix(f0_dielectric_scaled, albedo, metallic);
let F90 = mix(vec3<f32>(specularFactorExt), vec3<f32>(1.0), metallic);
// [[PBR_STRIP:s:khr_diffuse_transmission]]
// Thin-surface wrap (Khronos): share of non-specular diffuse that exits the back face.
let uv_dt = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfDiffTransOs, material.uvTfDiffTransRs);
let dt_tex_a = textureSample(diffuseTransmissionTexture, textureSampler, uv_dt).a;
let dt_col_tex = textureSample(diffuseTransmissionColorTexture, textureSampler, uv_dt).rgb;
let dtAmt = clamp(material.diffuseTransmissionFactor * dt_tex_a, 0.0, 1.0) * (1.0 - metallic);
let dtColor = material.diffuseTransmissionColorFactor * dt_col_tex;
// [[PBR_STRIP:e:khr_diffuse_transmission]]
// [[PBR_STRIP:s:khr_iridescence]]
let uv_irid = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfIridescenceOs, material.uvTfIridescenceRs);
let uv_irid_thick = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfIridThickOs, material.uvTfIridThickRs);
let irid_tex_r = textureSample(iridescenceTexture, textureSampler, uv_irid).r;
let irid_thick_g = textureSample(iridescenceThicknessTexture, textureSampler, uv_irid_thick).g;
let iridAmtRaw = clamp(material.iridescenceFactor * irid_tex_r, 0.0, 1.0);
let thickNm = mix(material.iridescenceThicknessMinimum, material.iridescenceThicknessMaximum, irid_thick_g);
// Thickness 0 → no film (Khronos). evalIridescence is the thin-film Fresnel, not a tint of F0.
let iridAmt = select(0.0, iridAmtRaw, thickNm > 1e-3);
let F_irid = evalIridescence(1.0, material.iridescenceIor, NdotV, thickNm, F0_base);
let F0 = mix(F0_base, F_irid, iridAmt);
// [[PBR_STRIP:e:khr_iridescence]]
// [[PBR_STRIP:s:khr_clearcoat]]
let uv_clearcoat = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfClearcoatOs, material.uvTfClearcoatRs);
let uv_ccRough = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfCcRoughOs, material.uvTfCcRoughRs);
let uv_ccNorm = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfCcNormOs, material.uvTfCcNormRs);
let clearcoatTex = textureSample(clearcoatTexture, textureSampler, uv_clearcoat).r;
let clearcoatRoughTex = textureSample(clearcoatRoughnessTexture, textureSampler, uv_ccRough).g;
let clearcoatAmt = clamp(material.clearcoatFactor * clearcoatTex, 0.0, 1.0);
let clearcoatRoughness = clamp(material.clearcoatRoughnessFactor * clearcoatRoughTex, 0.04, 1.0);
let Nc = normal_map_world(clearcoatNormalTexture, textureSampler, uv_ccNorm, material.clearcoatNormalScale, input.world_normal, input.world_tangent, input.world_bitangent);
let NcdotV = max(dot(Nc, V), 0.001);
// [[PBR_STRIP:e:khr_clearcoat]]
// [[PBR_STRIP:s:khr_sheen]]
let uv_sheenCol = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfSheenColOs, material.uvTfSheenColRs);
let uv_sheenRough = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfSheenRoughOs, material.uvTfSheenRoughRs);
let sheenColTex = textureSample(sheenColorTexture, textureSampler, uv_sheenCol).rgb;
let sheenRoughTex = textureSample(sheenRoughnessTexture, textureSampler, uv_sheenRough).a;
let sheenColor = material.sheenColorFactor * sheenColTex;
let sheenRoughness = clamp(material.sheenRoughnessFactor * sheenRoughTex, 0.0, 1.0);
// [[PBR_STRIP:e:khr_sheen]]
// Note: NdotV est déjà déclaré section 3, on ne le redéclare pas.

let lightCount = sceneLights.lightCount;
for (var i: u32 = 0u; i < lightCount; i = i + 1u) {
    let rawLight = sceneLights.lights[i];

    // --- DÉPAQUETAGE DES DONNÉES (Unpack) ---
    // On extrait les valeurs des vec4 pour les rendre lisibles
    
    let position = rawLight.positionAndRange.xyz;
    let range = rawLight.positionAndRange.w;
    
    let direction = rawLight.dirAndIntensity.xyz;
    let intensity = rawLight.dirAndIntensity.w;
    
    let color = rawLight.colorAndType.rgb;
    // Conversion float -> uint pour le type (ajout 0.1 pour sécurité d'arrondi)
    let lightType = u32(rawLight.colorAndType.w + 0.1); 
    
    let innerConeCos = rawLight.params.x;
    let outerConeCos = rawLight.params.y;

    if (lightType == 3u) {
        // Area lights need the LTC LUTs ltcMat / ltcAmp. Those textures are not
        // bound in this client, and referencing them fails shader compilation.
        continue;
    }

    // --- LOGIQUE D'ÉCLAIRAGE ---
    
    var dirToLight: vec3<f32>;
    var attenuation: f32 = 1.0;
    
    if (lightType == 0u) { 
        // DIRECTIONAL
        dirToLight = normalize(-direction);
        attenuation = 1.0;
    } else if (lightType == 1u) { 
        // POINT
        let offset = position - input.world_position;
        let dist = length(offset);
        dirToLight = normalize(offset);
        attenuation = getPointLightAttenuation(dist, range);
    } else if (lightType == 2u) { 
        // SPOT
        let offset = position - input.world_position;
        let dist = length(offset);
        dirToLight = normalize(offset);
        
        let distAttn = getPointLightAttenuation(dist, range);
        let coneAttn = getSpotLightAttenuation(dirToLight, direction, innerConeCos, outerConeCos);
        attenuation = distAttn * coneAttn;
    } else {
        // Fallback
        dirToLight = vec3<f32>(0.0, 1.0, 0.0);
        attenuation = 0.0;
    }
    
    // --- BRDF ---
    if (attenuation > 0.0001) {
        let NdotL = max(dot(N, dirToLight), 0.0);
        
        if (NdotL > 0.0) {
            let H_loop = normalize(V + dirToLight);
            let NdotH = max(dot(N, H_loop), 0.0);
            let VdotH = max(dot(V, H_loop), 0.0);
            
            var D: f32;
            var G: f32;

            if (anisotropy != 0.0) {
                D = D_GGX_Anisotropic(NdotH, H_loop, T, B, at, ab);
                G = V_SmithGGXCorrelated_Anisotropic(at, ab, dot(T, V), dot(B, V), dot(T, dirToLight), dot(B, dirToLight), NdotV, NdotL);
            } else {
                D = DistributionGGX(N, H_loop, roughness);
                G = GeometrySmith4(N, V, dirToLight, roughness);
            }

            let F = fresnelSchlickF90(VdotH, F0, F90);

            let kS = F;
            var kD = vec3<f32>(1.0) - kS;
            kD *= (1.0 - metallic);

            // Keep Cook-Torrance specular at high roughness (metals rely on it; hard-zero → black panels).
            let specular = (D * G * F) / (4.0 * NdotV * NdotL + 0.0001);
            let Hcc = H_loop;
            let NcdotL = max(dot(Nc, dirToLight), 0.0);
            let Dcc = DistributionGGX(Nc, Hcc, clearcoatRoughness);
            let Gcc = GeometrySmith4(Nc, V, dirToLight, clearcoatRoughness);
            let Fcc = fresnelSchlick(max(dot(Hcc, V), 0.0), vec3<f32>(0.04));
            let clearcoatSpec = (Dcc * Gcc * Fcc) / (4.0 * NcdotV * max(NcdotL, 0.001) + 0.0001) * clearcoatAmt;
            let sheenLobe = sheenColor * (1.0 - metallic) * (1.0 - sheenRoughness * 0.6) * NdotL;
            
            // Note: On utilise 'color' et 'intensity' extraits plus haut
            let radiance = color * intensity * attenuation;
            
            // --- GESTION OMBRE ---
            var shadow: f32 = 1.0;
            if (rawLight.params.z > -0.5) { 
                let shadowIdx = i32(rawLight.params.z + 0.1);
                
                // NOUVEL APPEL : On passe 'lightType' (0, 1, 2)
                shadow = fetchShadow(lightType, shadowIdx, input.world_position, N, NdotL, position);
                minShadowFactor = min(minShadowFactor, shadow);
            }
            
            let diffuseTerm = (kD * albedo / PI) * radiance * NdotL * shadow * (1.0 - dtAmt);
            let specularTerm = (specular + clearcoatSpec + sheenLobe) * radiance * shadow;
            totalDirectDiffuse += diffuseTerm;
            totalDirectSpecular += specularTerm;
        }
        // Wrap must run when the light is behind (NdotL==0) — that is the Khronos test case.
        if (dtAmt > 1e-5) {
            let NdotL_back = max(dot(-N, dirToLight), 0.0);
            if (NdotL_back > 0.0) {
                let radianceBack = color * intensity * attenuation;
                totalDirectDiffuse += ((1.0 - metallic) * dtColor / PI) * radianceBack * NdotL_back * dtAmt;
            }
        }
        // Thin KHR_materials_transmission (Sample Viewer mirrored-L GGX).
        // Inlined: a missing helper + stale ShaderLoader cache compiled to solid white.
        if (transmissionAmt > 1e-5) {
            let radianceT = color * intensity * attenuation;
            let l_mirror = normalize(dirToLight + 2.0 * N * dot(-dirToLight, N));
            let n_dot_lm = max(dot(N, l_mirror), 0.001);
            let h_t = normalize(V + l_mirror);
            let D_t = DistributionGGX(N, h_t, roughness);
            let G_t = GeometrySmith4(N, V, l_mirror, roughness);
            let transSpec = min((D_t * G_t) / (4.0 * NdotV * n_dot_lm + 0.0001), 4.0);
            totalTransmittedDirect += albedo * transSpec * n_dot_lm * radianceT * transmissionAmt;
            // Rough paper fill. Clamp candela/d² so 180 cd at 5 cm stays tinted, not white.
            let wrap = saturate(dot(-N, dirToLight) * 0.5 + 0.5);
            let paper = roughnessIbl * roughnessIbl;
            let glow = min(radianceT, vec3<f32>(6.0));
            totalTransmittedDirect += (albedo / PI) * glow * wrap * wrap * transmissionAmt * paper * 0.4;
        }
    }
}

// --- 6. IBL (INDIRECT LIGHTING) ---
// (Lo est défini après transmissionAmt, une fois l'IBL assemblé.)
// Irradiance / prefilter maps use world directions; Y vs env cubemap is fixed in ibl/*.frag when baking.

// Split-sum IBL (Karis / Khronos): F0 * brdf.x + F90 * brdf.y.
// lod 0: implicit textureSample LOD explodes at the silhouette (dFdx(NdotV) huge) and
// wipes brdf.y — exactly the F90 rims SpecularTest rows 3–6 need.
// Smooth: split-sum == Schlick; prefer it so rims don't depend on a 1-mip LUT filter.
let brdfIbl = textureSampleLevel(brdfLUT, iblSampler, vec2(NdotV, roughnessIbl), 0.0).rg;
let FssEss_lut = F0 * brdfIbl.x + F90 * brdfIbl.y;
let FssEss_schlick = fresnelSchlickF90(NdotV, F0, F90);
let FssEss = mix(FssEss_schlick, FssEss_lut, roughnessIbl);
let kS_IBL = FssEss;
let kD_IBL = (1.0 - kS_IBL) * (1.0 - metallic);

var irradiance = textureSample(irradianceMap, iblSampler, N).rgb;
let irradianceBack = textureSample(irradianceMap, iblSampler, -N).rgb;
var diffuseIBL = irradiance * albedo * (1.0 - dtAmt);
let diffuseIBL_dt = irradianceBack * dtColor * dtAmt;

// Other-side irradiance (inside the shade), not the front studio (that looked like white plastic).
let transmittedDiffuse = irradianceBack * albedo;

// Screen-space refraction : copie sceneColor (opaques + skybox) avant la passe transparente.
// @builtin(position) en fragment = coordonnées framebuffer (pixels), PAS le clip space.
// Diviser par w comme du NDC échantillonnait le bord de l’écran (fond sombre) → cubes noirs face-on.
let opaqueSize = vec2<f32>(textureDimensions(sceneOpaqueColor));
let uv_s = input.clip_position.xy / max(opaqueSize, vec2<f32>(1.0));
// Thin-surface raster stand-in: objects behind (DiffuseTransmissionTest pink bars).
// Path-trace only in the Khronos note; without this, factor 0→1 looks identical in raster.
let dtBehind = textureSampleLevel(sceneOpaqueColor, sceneOpaqueSampler, uv_s, 0.0).rgb * dtColor;
let pos_v = (frame.viewMatrix * vec4<f32>(input.world_position, 1.0)).xyz;
let I_view = normalize(pos_v);
let N_view = normalize((frame.viewMatrix * vec4<f32>(N, 0.0)).xyz);
let eta = 1.0 / ior_safe;
let T_view = refract(I_view, N_view, eta);
// 8% of screen UV was tuned on full-frame TransmissionTest spheres. Tiny glass
// (Barn Lamp bulb, thicknessFactor 0.01) otherwise samples unrelated HDR pixels →
// white halo at the silhouette and sparkle/grid inside the shade.
let ssrScale =
    0.08 * transmissionAmt * mix(0.08, 1.0, saturate(material.thicknessFactor * 8.0));
let T_ok = dot(T_view, T_view) > 1e-8;
let parallax = T_view.xy * ssrScale;
// Clamp-to-edge samples the framebuffer clear (≈0.02) → black prism faces at grazing /
// high IOR. Fall back to aligned uv_s so the background stays visible (DispersionTest).
let uv_r_raw = uv_s + parallax;
let ssrUvLo = vec2<f32>(0.02);
let ssrUvHi = vec2<f32>(0.98);
let ssrInBounds = all(uv_r_raw > ssrUvLo) && all(uv_r_raw < ssrUvHi);
let uv_r = select(uv_s, uv_r_raw, T_ok && ssrInBounds);
// [[PBR_STRIP:s:khr_dispersion]]
// KHR_materials_dispersion: halfSpread is an IOR delta (20/V_d). (T_r − T_b)×ssrScale
// is ~1 px on sloped faces — unreadable vs Sample Viewer. Extrapolate the RGB offset
// from the green direction; D2 still holds (dispersion=0 → T_r = T_view).
let halfSpread = (ior_safe - 1.0) * 0.025 * material.dispersionFactor;
let ior_r = max(ior_safe - halfSpread, 1.001);
let ior_b = ior_safe + halfSpread;
let T_r = refract(I_view, N_view, 1.0 / ior_r);
let T_b = refract(I_view, N_view, 1.0 / ior_b);
let chromaBoost = 1.0 + 6.0 * saturate(material.dispersionFactor / 5.0);
// DispersionTest thicknessFactor ≈ 0.018 — the Barn Lamp ssrScale floor would
// leave RGB split at ~1 px. Chromatic scale is independent of that attenuation.
let chromaScale = max(ssrScale, 0.07 * transmissionAmt * saturate(material.dispersionFactor / 5.0));
let uv_disp_r_raw = uv_s + mix(T_view.xy, T_r.xy, chromaBoost) * chromaScale;
let uv_disp_b_raw = uv_s + mix(T_view.xy, T_b.xy, chromaBoost) * chromaScale;
let ok_disp_r = dot(T_r, T_r) > 1e-8 && all(uv_disp_r_raw > ssrUvLo) && all(uv_disp_r_raw < ssrUvHi);
let ok_disp_b = dot(T_b, T_b) > 1e-8 && all(uv_disp_b_raw > ssrUvLo) && all(uv_disp_b_raw < ssrUvHi);
let uv_disp_r = select(uv_r, uv_disp_r_raw, ok_disp_r);
let uv_disp_b = select(uv_r, uv_disp_b_raw, ok_disp_b);
// lod 0: refraction UVs are discontinuous across 2×2 quads — textureSample mip/aniso
// from those derivatives draws horizontal combing on clear glass (TransmissionTest).
let bgParallax = min(
    vec3<f32>(
        textureSampleLevel(sceneOpaqueColor, sceneOpaqueSampler, uv_disp_r, 0.0).r,
        textureSampleLevel(sceneOpaqueColor, sceneOpaqueSampler, uv_r, 0.0).g,
        textureSampleLevel(sceneOpaqueColor, sceneOpaqueSampler, uv_disp_b, 0.0).b
    ),
    vec3<f32>(8.0)
);
// [[PBR_STRIP:e:khr_dispersion]]
// Layered ping-pong composites prior transparents at uv_s. Parallax (~0.6% UV on
// TransmissionTest, thickness 0) still hits fat spheres but skips thin MASK hoops.
// Do not mix toward uv_s when dispersion is authored — that greys out RGB split
// (DispersionTest rainbow / D3–D5).
let bgAligned = min(
    textureSampleLevel(sceneOpaqueColor, sceneOpaqueSampler, uv_s, 0.0).rgb,
    vec3<f32>(8.0)
);
let nestedAlignAmt = select(0.75, 0.0, material.dispersionFactor > 1e-4);
let refractedBg = mix(bgParallax, bgAligned, nestedAlignAmt);
// Transmission tint: glTF baseColor filters transmitted light (Sample Color answer key).
// See-through is in RGB (SSR × tint); alpha stays ~1 to avoid a second framebuffer blend.
// Khronos: baseColor filters transmitted light. Do not zero out metals —
// LightsPunctualLamp shade reuses the body MR atlas (B often ≈ 1).
let glassTint = albedo;
// Sharp SSR is for clear glass. Rough paper (LightsPunctualLamp) must not
// become a white window onto the studio — (1-roughness)^4 ≈ 0 at roughness 0.5.
let ssrAmt = clamp(transmissionAmt, 0.0, 1.0) * pow(1.0 - roughnessIbl, 4.0);
let transmittedEnv = mix(transmittedDiffuse, refractedBg * glassTint, ssrAmt);
// [[PBR_STRIP:s:khr_volume]]
let uv_thickness = w3dts_uv_transform_from_packed(input.uv, input.uv1, material.uvTfThicknessOs, material.uvTfThicknessRs);
let thickTex = textureSample(thicknessTexture, textureSampler, uv_thickness).g;
// thicknessFactor is mesh-local (Khronos); do not clamp to 1 — AttenuationTest uses values up to 2.
let thicknessMesh = max(material.thicknessFactor * thickTex, 0.0);
// thicknessFactor is mesh-local; attenuationDistance is world-space (Khronos Node Scale row).
let thicknessWorld = thicknessMesh * max(input.world_scale, 1e-5);
let attDist = material.attenuationDistance;
let attDistSafe = select(1e6, attDist, attDist > 1e-5);
let absorptionCoeff = -log(max(material.attenuationColor, vec3<f32>(1e-5))) / attDistSafe;
let volumeTransmittance = exp(-absorptionCoeff * thicknessWorld);
let transmittedEnvVol = transmittedEnv * volumeTransmittance;
// [[PBR_STRIP:e:khr_volume]]

var R_vec: vec3<f32>;

if (anisotropy != 0.0) {
    // Bent normal heuristic (Khronos non-normative IBL sample)
    var bentNormal = N;
    let bent_c0 = cross(B, V);
    let bent_c0_len = length(bent_c0);
    let bent_c1 = cross(bent_c0, B);
    let bent_c1_len = length(bent_c1);
    if (bent_c0_len > 1e-5 && bent_c1_len > 1e-5) {
        bentNormal = bent_c1 / bent_c1_len;
    }
    let term = 1.0 - anisotropy * (1.0 - roughness);
    let a_mix = term * term * term * term;
    bentNormal = normalize(mix(bentNormal, N, a_mix));
    R_vec = reflect(-V, bentNormal);
    // Reduce light from behind tangent plane; improves rough materials
    R_vec = normalize(mix(R_vec, bentNormal, roughness * roughness));
} else {
    R_vec = reflect(-V, N);
    R_vec = normalize(mix(R_vec, N, roughness * roughness));
}

const MAX_REFLECTION_LOD: f32 = 4.0;
var prefilteredColor = textureSampleLevel(prefilterMap, iblSampler, R_vec, roughnessIbl * MAX_REFLECTION_LOD).rgb;
let specularIBL = prefilteredColor * FssEss;
// Clearcoat IBL follows clearcoat normal Nc (MultiTest Clearcoat Normal). Keep a stable
// face-on intensity so clearcoatTexture checkmarks stay readable (pure F0=0.04 is too dim).
var R_cc = reflect(-V, Nc);
R_cc = normalize(mix(R_cc, Nc, clearcoatRoughness * clearcoatRoughness));
let prefilteredClearcoat = textureSampleLevel(prefilterMap, iblSampler, R_cc, clearcoatRoughness * MAX_REFLECTION_LOD).rgb;
let Fcc_ibl = fresnelSchlickRoughness(NcdotV, vec3<f32>(0.04), clearcoatRoughness);
let clearcoatIBL =
  prefilteredClearcoat * clearcoatAmt * (1.0 - clearcoatRoughness * 0.85) * max(Fcc_ibl, vec3<f32>(0.22));
let sheenIBL = irradiance * sheenColor * (1.0 - sheenRoughness * 0.7) * (1.0 - metallic) * 0.35;

let diffuseIBL_surf = kD_IBL * (diffuseIBL + diffuseIBL_dt) * (1.0 - transmissionAmt);
let transmittedIBL = transmittedEnvVol * transmissionAmt + dtBehind * dtAmt * (1.0 - transmissionAmt);
// Surface reflection on transmissive dielectrics is Fresnel-only. Full GGX + IBL specular
// (plus the orbiting key light) painted AttenuationTest as opaque blue/white plastic.
let Fnv_glass = fresnelSchlickF90(NdotV, F0, F90);
let fresnelMean = (Fnv_glass.x + Fnv_glass.y + Fnv_glass.z) / 3.0;
// Face-on F0 (~0.04–0.17) unchanged. Cap grazing so studio HDR + key light do not
// paint transmissive faces as white plastic (DispersionTest orbit).
let specTransGate = mix(1.0, clamp(fresnelMean, 0.035, 0.4), transmissionAmt);
let specularIBL_glass = specularIBL * specTransGate;
let sheenIBL_surf = sheenIBL * (1.0 - transmissionAmt);
// Diffuse IBL stays at map energy. Specular IBL is scaled by Renderer.iblIntensity
// (default 1). SpecularTest raises it so black-albedo F0≈0.04 stays readable.
let ambient =
  (diffuseIBL_surf + transmittedIBL +
    (specularIBL_glass + clearcoatIBL + sheenIBL_surf) * frame.ambientLightIntensity) *
  ao;

// Direct: diffuse replaced by transmission; specular kept only as Fresnel highlights.
var Lo = totalDirectDiffuse * (1.0 - transmissionAmt) + totalDirectSpecular * specTransGate + totalTransmittedDirect;

// =============================================================================
// === DEBUG VISUEL (A SUPPRIMER UNE FOIS CORRIGÉ) ===
// =============================================================================

// TEST 1 : Est-ce que je reçois des lumières ?
// SI VERT = J'ai reçu des lumières (> 0).
// SI ROUGE = Le buffer dit qu'il y a 0 lumières (Problème CPU/Upload).
/*if (sceneLights.lightCount > 0u) {
    Lo = vec3<f32>(0.0, 1.0, 0.0); // VERT
} else {
    Lo = vec3<f32>(1.0, 0.0, 0.0); // ROUGE
}*/

// TEST 2 (Décommente pour tester) : Est-ce que la boucle tourne et trouve un type valide ?

/*for (var k: u32 = 0u; k < sceneLights.lightCount; k = k + 1u) {
    let debugLight = sceneLights.lights[k];
    let debugType = u32(debugLight.colorAndType.w + 0.1);
    
    if (debugType == 1u) { // Si on trouve une PointLight
        Lo = vec3<f32>(0.0, 0.0, 1.0); // BLEU
    }
}*/


// =============================================================================


// --- 7. AMBIENT FALLBACK (scènes sans IBL) ---
// Quand aucune irradiance map n'est chargée, diffuseIBL ≈ 0 et l'ambient IBL est nul.
// On ajoute un terme d'ambient plat seulement si l'irradiance est quasi-nulle.
let ibl_active = length(irradiance) > 0.01;
let flat_ambient = select(
    sceneLights.ambientColor.rgb * albedo * (1.0 - metallic) * 0.12 * frame.ambientLightIntensity,
    vec3<f32>(0.0),
    ibl_active
);

// --- 7. SORTIE ---
var final_color = Lo + ambient + flat_ambient + emission;
// MASK cutout uses authored baseColor.a (TransmissionTest opacity columns).
// Must run before glassAlpha, which raises alpha to 1 and would skip discard.
if (ALPHA_MODE == 2u) {
    if (alpha < material.alphaCutoff) {
        discard;
    }
}
// Alpha : transmission SSR déjà compose le fond dans le RGB — un alpha « verre » bas
// (Fresnel face-on ≈ 0.09) re-blend sur le framebuffer et lave attenuationColor / Sample Color.
// Matériaux sans transmission : garder l’alpha matériau. Avec transmission : monter vers 1.
let edgeGlassAlpha = clamp(fresnelMean * 0.52 + 0.07, 0.06, 0.95);
let glassAlpha = mix(edgeGlassAlpha, 1.0, transmissionAmt);
var final_alpha = mix(alpha, glassAlpha, transmissionAmt);
if (ALPHA_MODE == 2u) {
    final_alpha = 1.0;
}
let emission_peak = max(emission.r, max(emission.g, emission.b));
// Peak, not luminance: a magenta neon has almost no green, so Rec.709 puts it under the cut
// while a white specular on a pawn sails over it. The shell keeps this only when it exceeds 1.
if (emission_peak > 1.0) {
    final_alpha = emission_peak;
}

// Export roughness for floor SSR (Kart/Chess). NPR hatch uses toon_master shadow in .a instead.
var shadow_factor_out = roughnessIbl;

// Debug: set material pbrDebugAnisoTex = 1 (and re-upload) to visualize anisotropy map RGB.
if (showAnisoTextureDebug) {
    final_color = anisoTex.rgb;
    final_alpha = 1.0;
}