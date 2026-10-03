struct FsIn {
  @location(0) localUv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@fragment
fn main(input: FsIn) -> @location(0) vec4<f32> {
  let r2 = dot(input.localUv, input.localUv);
  if (r2 > 1.0) {
    discard;
  }

  // In the eigenvector basis, uv=1 maps to 3σ in each direction.
  // Gaussian power = -0.5 * (dx/σ)² = -0.5 * (uv * 3σ / σ)² = -0.5 * 9 * uv²  = -4.5 * r²
  let falloff = exp(-4.5 * r2);
  let a = input.color.a * falloff;
  return vec4<f32>(input.color.rgb, a);
}
