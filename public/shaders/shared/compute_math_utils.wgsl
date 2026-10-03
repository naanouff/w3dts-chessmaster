/**
 * @file Utility math functions for compute shaders.
 * They provide basic matrix operations for transformations.
 * @author Cyril Tarriet
 */

/**
 * Calculates the inverse of a 4x4 matrix.
 * This function is an implementation of the matrix inversion algorithm,
 * optimized for shaders using the adjugate matrix method.
 * @param m The 4x4 matrix to invert.
 * @returns The inverse matrix.
 */
fn matrix_inverse(m: mat4x4<f32>) -> mat4x4<f32> {
    let Coef00 = m[2][2] * m[3][3] - m[3][2] * m[2][3];
    let Coef02 = m[1][2] * m[3][3] - m[3][2] * m[1][3];
    let Coef03 = m[1][2] * m[2][3] - m[2][2] * m[1][3];
    let Coef04 = m[2][1] * m[3][3] - m[3][1] * m[2][3];
    let Coef06 = m[1][1] * m[3][3] - m[3][1] * m[1][3];
    let Coef07 = m[1][1] * m[2][3] - m[2][1] * m[1][3];
    let Coef08 = m[2][1] * m[3][2] - m[3][1] * m[2][2];
    let Coef10 = m[1][1] * m[3][2] - m[3][1] * m[1][2];
    let Coef11 = m[1][1] * m[2][2] - m[2][1] * m[1][2];
    let Coef12 = m[2][0] * m[3][3] - m[3][0] * m[2][3];
    let Coef14 = m[1][0] * m[3][3] - m[3][0] * m[1][3];
    let Coef15 = m[1][0] * m[2][3] - m[2][0] * m[1][3];
    let Coef16 = m[2][0] * m[3][2] - m[3][0] * m[2][2];
    let Coef18 = m[1][0] * m[3][2] - m[3][0] * m[1][2];
    let Coef19 = m[1][0] * m[2][2] - m[2][0] * m[1][2];
    let Coef20 = m[2][0] * m[3][1] - m[3][0] * m[2][1];
    let Coef22 = m[1][0] * m[3][1] - m[3][0] * m[1][1];
    let Coef23 = m[1][0] * m[2][1] - m[2][0] * m[1][1];
    var Fac0 = vec4<f32>(Coef00, Coef00, Coef02, Coef03);
    var Fac1 = vec4<f32>(Coef04, Coef04, Coef06, Coef07);
    var Fac2 = vec4<f32>(Coef08, Coef08, Coef10, Coef11);
    var Fac3 = vec4<f32>(Coef12, Coef12, Coef14, Coef15);
    var Fac4 = vec4<f32>(Coef16, Coef16, Coef18, Coef19);
    var Fac5 = vec4<f32>(Coef20, Coef20, Coef22, Coef23);
    var Vec0 = vec4<f32>(m[1][0], m[0][0], m[0][0], m[0][0]);
    var Vec1 = vec4<f32>(m[1][1], m[0][1], m[0][1], m[0][1]);
    var Vec2 = vec4<f32>(m[1][2], m[0][2], m[0][2], m[0][2]);
    var Vec3 = vec4<f32>(m[1][3], m[0][3], m[0][3], m[0][3]);
    var Inv0 = Vec1 * Fac0 - Vec2 * Fac1 + Vec3 * Fac2;
    var Inv1 = Vec0 * Fac0 - Vec2 * Fac3 + Vec3 * Fac4;
    var Inv2 = Vec0 * Fac1 - Vec1 * Fac3 + Vec3 * Fac5;
    var Inv3 = Vec0 * Fac2 - Vec1 * Fac4 + Vec2 * Fac5;
    var SignA = vec4<f32>(1.0, -1.0, 1.0, -1.0);
    var SignB = vec4<f32>(-1.0, 1.0, -1.0, 1.0);
    var Inverse = mat4x4<f32>(Inv0 * SignA, Inv1 * SignB, Inv2 * SignA, Inv3 * SignB);
    var Row0 = vec4<f32>(Inverse[0][0], Inverse[1][0], Inverse[2][0], Inverse[3][0]);
    var Dot0 = m[0] * Row0;
    let Dot1 = (Dot0.x + Dot0.y) + (Dot0.z + Dot0.w);
    let OneOverDeterminant = 1.0 / Dot1;
    return Inverse * OneOverDeterminant;
}

/**
 * Creates a 4x4 translation matrix from a 3D vector.
 * @param t The translation vector.
 * @returns The translation matrix.
 */
fn translation(t: vec3<f32>) -> mat4x4<f32> {
    return mat4x4<f32>(
        vec4<f32>(1.0, 0.0, 0.0, 0.0),
        vec4<f32>(0.0, 1.0, 0.0, 0.0),
        vec4<f32>(0.0, 0.0, 1.0, 0.0),
        vec4<f32>(t.x, t.y, t.z, 1.0)
    );
}

/**
 * Creates a 4x4 rotation matrix around the Y-axis.
 * @param angle The rotation angle in radians.
 * @returns The rotation matrix.
 */
fn rotation_y(angle: f32) -> mat4x4<f32> {
    let s = sin(angle);
    let c = cos(angle);
    return mat4x4<f32>(
        vec4<f32>(c, 0.0, -s, 0.0),
        vec4<f32>(0.0, 1.0, 0.0, 0.0),
        vec4<f32>(s, 0.0, c, 0.0),
        vec4<f32>(0.0, 0.0, 0.0, 1.0)
    );
}

/**
 * Creates a 4x4 rotation matrix around the X-axis.
 * @param angle The rotation angle in radians.
 * @returns The rotation matrix.
 */
fn rotation_x(angle: f32) -> mat4x4<f32> {
    let s = sin(angle);
    let c = cos(angle);
    return mat4x4<f32>(
        vec4<f32>(1.0, 0.0, 0.0, 0.0),
        vec4<f32>(0.0, c, s, 0.0),
        vec4<f32>(0.0, -s, c, 0.0),
        vec4<f32>(0.0, 0.0, 0.0, 1.0)
    );
}

/**
 * Creates a 4x4 scaling matrix from a 3D vector.
 * @param s The scaling vector.
 * @returns The scaling matrix.
 */
fn scaling(s: vec3<f32>) -> mat4x4<f32> {
    return mat4x4<f32>(
        vec4(s.x, 0.0, 0.0, 0.0),
        vec4(0.0, s.y, 0.0, 0.0),
        vec4(0.0, 0.0, s.z, 0.0),
        vec4(0.0, 0.0, 0.0, 1.0)
    );
}
