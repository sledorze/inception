/**
 * Differential-privacy noise mechanisms (L1.7).
 *
 * Laplace mechanism for ℓ₁-sensitivity queries (counts, sums);
 * Gaussian mechanism for ℓ₂-sensitivity queries.
 * Uses Effect's Random service so tests can inject deterministic seeds via
 * Random.withSeed(seed).
 *
 * Bootstrap parameters (§12, bootstrap=true): ε_per_query=0.1, ε_max=1.0,
 * δ=1e-5 (conservative proxy for 1/(10·n_rows)), max_sensitivity=1.0.
 */
import { Effect, Random } from 'effect'

// ── constants (§12, bootstrap=true) ──────────────────────────────────────────

export const DEFAULT_EPSILON_PER_QUERY = 0.1
export const DEFAULT_EPSILON_MAX = 1
export const DEFAULT_DELTA = 1e-5
export const DEFAULT_MAX_SENSITIVITY_L1 = 1
export const DEFAULT_MAX_SENSITIVITY_L2 = 1

// ── Laplace sampling via inverse CDF ─────────────────────────────────────────

// Sample from Laplace(0, scale).  u ~ Uniform(0,1) from Random.next.
const sampleLaplace = (scale: number): Effect.Effect<number> =>
  Effect.gen(function* () {
    const u = yield* Random.next
    const v = u - 0.5
    if (v === 0) {
      return 0
    }
    return -scale * Math.sign(v) * Math.log(1 - 2 * Math.abs(v))
  })

// ── Gaussian sampling via Box-Muller ─────────────────────────────────────────

const sampleGaussian = (stddev: number): Effect.Effect<number> =>
  Effect.gen(function* () {
    const u1 = yield* Random.next
    const u2 = yield* Random.next
    const z = Math.sqrt(-2 * Math.log(u1 === 0 ? Number.EPSILON : u1)) * Math.cos(2 * Math.PI * u2)
    return stddev * z
  })

// ── DP bit-count estimation ───────────────────────────────────────────────────

export interface DpSensitivity {
  readonly norm: 'l1' | 'l2'
  readonly value: number
}

export interface NoisedEstimate {
  readonly noisyBits: number
  readonly mechanism: 'laplace' | 'gaussian'
}

/**
 * Apply calibrated DP noise to a true bit count.
 *
 * Laplace(sensitivity_bits / ε) for ℓ₁; Gaussian(σ) for ℓ₂.
 * Result clamped to ≥ 0.
 */
export const dpBitsEstimate = (
  trueBits: number,
  sensitivity: DpSensitivity,
  epsilon: number,
  delta: number,
): Effect.Effect<NoisedEstimate> =>
  Effect.gen(function* () {
    const sensitivityBits = sensitivity.value * 8
    if (sensitivity.norm === 'l1') {
      const scale = sensitivityBits / epsilon
      const noise = yield* sampleLaplace(scale)
      return { mechanism: 'laplace', noisyBits: Math.max(0, trueBits + noise) }
    }
    const stddev = (sensitivityBits * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon
    const noise = yield* sampleGaussian(stddev)
    return { mechanism: 'gaussian', noisyBits: Math.max(0, trueBits + noise) }
  })
