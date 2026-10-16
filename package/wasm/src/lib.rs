//! The numeric kernels of `src/pill-shape.worklet.ts`, the loops that spend
//! their time in `exp`, `cos` and `sin`. Each mirrors the TypeScript function
//! of the same name step for step, which stays the reference and the fallback
//! where WebAssembly is unavailable: `src/pill-shape.wasm.test.ts` holds the
//! two together. Rebuild with `vp run build:wasm`.
//!
//! Nothing is allocated. The arrays live at fixed addresses in linear memory,
//! which the caller reads and writes through the `*_ptr` exports.

const STEPS: usize = 512;
const LEN: usize = STEPS + 1;

static mut LOG_ONE_MINUS_T: [f64; LEN] = [0.0; LEN];
static mut LOG_ONE_MINUS_T2: [f64; LEN] = [0.0; LEN];
/// The profile: how much of the turn remains at each node.
static mut REMAINING: [f64; LEN] = [0.0; LEN];
/// Running integrals of `cos` and `sin` of the turn.
static mut COS: [f64; LEN] = [0.0; LEN];
static mut SIN: [f64; LEN] = [0.0; LEN];

#[inline]
fn pow_from_log(log_base: f64, power: f64) -> f64 {
    if power == 0.0 {
        1.0
    } else {
        (power * log_base).exp()
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn init() {
    unsafe {
        for i in 0..LEN {
            let t = i as f64 / STEPS as f64;
            LOG_ONE_MINUS_T[i] = (1.0 - t).ln();
            LOG_ONE_MINUS_T2[i] = (1.0 - t * t).ln();
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn remaining_ptr() -> *mut f64 {
    &raw mut REMAINING as *mut f64
}
#[unsafe(no_mangle)]
pub extern "C" fn cos_ptr() -> *mut f64 {
    &raw mut COS as *mut f64
}
#[unsafe(no_mangle)]
pub extern "C" fn sin_ptr() -> *mut f64 {
    &raw mut SIN as *mut f64
}

/// Fills `REMAINING` with the curvature profile for exponent `q`; returns lambda.
#[unsafe(no_mangle)]
pub extern "C" fn profile(q: f64, continuity: i32) -> f64 {
    unsafe {
        let h = 1.0 / STEPS as f64;
        if continuity == 2 {
            for i in 0..LEN {
                REMAINING[i] = pow_from_log(LOG_ONE_MINUS_T[i], q);
            }
            return q;
        }
        let e = (q - 1.0).max(1.0);
        REMAINING[0] = 0.0;
        let mut k0 = 1.0;
        for i in 1..LEN {
            let k1 = pow_from_log(LOG_ONE_MINUS_T2[i], e);
            REMAINING[i] = REMAINING[i - 1] + ((k0 + k1) / 2.0) * h;
            k0 = k1;
        }
        let total = REMAINING[STEPS];
        for i in 0..LEN {
            REMAINING[i] = 1.0 - REMAINING[i] / total;
        }
        1.0 / total
    }
}

/// Integrates `cos` and `sin` of `beta * REMAINING` into `COS` and `SIN`
/// (running totals; index 0 is 0).
#[unsafe(no_mangle)]
pub extern "C" fn fresnel(beta: f64) {
    unsafe {
        integrate(beta, true);
    }
}

#[inline]
unsafe fn integrate(beta: f64, keep: bool) -> (f64, f64) {
    let h = 1.0 / STEPS as f64;
    let mut c = 0.0;
    let mut s = 0.0;
    let mut c0 = (beta * REMAINING[0]).cos();
    let mut s0 = (beta * REMAINING[0]).sin();
    if keep {
        COS[0] = 0.0;
        SIN[0] = 0.0;
    }
    for i in 1..LEN {
        let angle = beta * REMAINING[i];
        let c1 = angle.cos();
        let s1 = angle.sin();
        c += ((c0 + c1) / 2.0) * h;
        s += ((s0 + s1) / 2.0) * h;
        if keep {
            COS[i] = c;
            SIN[i] = s;
        }
        c0 = c1;
        s0 = s1;
    }
    (c, s)
}

/// Where the easing meets the flat edge, over the cap's half-height, for the
/// profile in `REMAINING` (with `lambda`) eased through `beta`. With `keep`
/// non-zero the running integrals are left in `COS` and `SIN`.
#[unsafe(no_mangle)]
pub extern "C" fn junction_ratio(beta: f64, lambda: f64, keep: i32) -> f64 {
    unsafe {
        let (c, s) = integrate(beta, keep != 0);
        let radius = 1.0 / (beta.cos() + lambda * beta * s);
        radius * (1.0 - beta.sin() + lambda * beta * c)
    }
}
