"""Independent LAB H I diagnostics: channel integration, covariance and kinematic geometry.

All uncertainties are conditional on explicitly supplied noise/rotation assumptions.
The LAB brightness profiles alone do not constrain optical depth or distance.
"""
from __future__ import annotations

import math
import random
from collections.abc import Sequence
from dataclasses import dataclass
from itertools import pairwise

COLUMN_FACTOR = 1.8224e18  # cm^-2 per K km/s; optically thin H I emission


def _finite(values: Sequence[float], name: str, minimum: int = 2) -> list[float]:
    result = [float(v) for v in values]
    if len(result) < minimum or any(not math.isfinite(v) for v in result):
        raise ValueError(f"{name} needs at least {minimum} finite samples")
    return result


def integration_weights(velocity_km_s: Sequence[float], lower: float, upper: float) -> list[float]:
    """Exact trapezoidal weights for piecewise-linear interpolation over [lower, upper]."""
    v = _finite(velocity_km_s, "velocity")
    if any(b <= a for a, b in pairwise(v)):
        raise ValueError("velocity grid must be strictly increasing")
    if not all(math.isfinite(x) for x in (lower, upper)) or not v[0] <= lower < upper <= v[-1]:
        raise ValueError("integration bounds must be finite and inside the velocity grid")
    weights = [0.0] * len(v)
    for i, (left, right) in enumerate(pairwise(v)):
        a, b = max(lower, left), min(upper, right)
        if b <= a:
            continue
        ta, tb = (a - left) / (right - left), (b - left) / (right - left)
        width = b - a
        weights[i] += width * (2.0 - ta - tb) / 2.0
        weights[i + 1] += width * (ta + tb) / 2.0
    return weights


@dataclass(frozen=True)
class ColumnEstimate:
    integrated_brightness_k_kms: float
    column_density_cm2: float
    sigma_integrated_k_kms: float
    sigma_column_cm2: float
    noise_correlation_rho: float
    baseline_sigma_k: float


def column_density_with_noise(
    velocity_km_s: Sequence[float], brightness_k: Sequence[float],
    lower_km_s: float, upper_km_s: float, *,
    channel_sigma_k: float | Sequence[float], rho: float = 0.0,
    baseline_k: float = 0.0, baseline_sigma_k: float = 0.0,
) -> ColumnEstimate:
    """Optically thin N_HI and conditional variance for AR(1) channel errors.

    Cov(e_i,e_j) = sigma_i sigma_j rho**|i-j|, plus an independent
    common-mode baseline offset with variance baseline_sigma_k**2.
    Negative baseline-subtracted samples are preserved, not clipped.
    This is an O(n) evaluation of w^T C w, not a fitted LAB noise model.
    """
    v = _finite(velocity_km_s, "velocity")
    y = _finite(brightness_k, "brightness")
    if len(v) != len(y):
        raise ValueError("velocity and brightness lengths differ")
    if isinstance(channel_sigma_k, (float, int)):
        sigma = [float(channel_sigma_k)] * len(v)
    else:
        sigma = _finite(channel_sigma_k, "channel_sigma_k")
    if len(sigma) != len(v) or any(not math.isfinite(s) or s < 0 for s in sigma):
        raise ValueError("channel sigmas must be nonnegative and match the grid")
    if not all(math.isfinite(x) for x in (rho, baseline_k, baseline_sigma_k)) or abs(rho) >= 1 or baseline_sigma_k < 0:
        raise ValueError("invalid correlation or baseline assumptions")
    w = integration_weights(v, lower_km_s, upper_km_s)
    area = math.fsum(wi * (yi - baseline_k) for wi, yi in zip(w, y))
    scaled = [wi * si for wi, si in zip(w, sigma)]
    # Recurrence: previous = sum_{j<i} rho**(i-j) * scaled[j].
    previous, last, variance = 0.0, 0.0, 0.0
    for i, value in enumerate(scaled):
        if i:
            previous = rho * (previous + last)
        variance += value * value + 2.0 * value * previous
        last = value
    variance += (baseline_sigma_k * math.fsum(w)) ** 2
    variance = max(variance, 0.0)  # floating-point roundoff only
    return ColumnEstimate(area, COLUMN_FACTOR * area, math.sqrt(variance),
                          COLUMN_FACTOR * math.sqrt(variance), rho, baseline_sigma_k)


def rebin_piecewise_linear(velocity_km_s: Sequence[float], brightness_k: Sequence[float],
                           new_edges_km_s: Sequence[float]) -> list[float]:
    """Area-conserving bin averages of the original piecewise-linear spectrum.

    The output is a set of bin averages, not point samples; integrated area
    over the union of bins is conserved by construction.
    """
    v = _finite(velocity_km_s, "velocity")
    y = _finite(brightness_k, "brightness")
    edges = _finite(new_edges_km_s, "new edges")
    if len(v) != len(y):
        raise ValueError("velocity and brightness lengths differ")
    if any(b <= a for a, b in pairwise(edges)):
        raise ValueError("new edges must be strictly increasing")
    return [math.fsum(w * z for w, z in zip(integration_weights(v, a, b), y)) / (b - a)
            for a, b in pairwise(edges)]


def _distance_solutions(velocity: float, longitude_deg: float, r0: float, v0: float) -> list[float]:
    sine = math.sin(math.radians(longitude_deg))
    if abs(sine) < 0.05 or r0 <= 0 or v0 <= 0:
        return []
    denominator = 1.0 + velocity / (v0 * sine)
    if denominator <= 0:
        return []
    radius = r0 / denominator
    disc = radius * radius - (r0 * sine) ** 2
    if disc < -1e-10:
        return []
    root = math.sqrt(max(disc, 0.0))
    projected = r0 * math.cos(math.radians(longitude_deg))
    solutions = [x for x in (projected - root, projected + root) if x >= -1e-10]
    return sorted(max(x, 0.0) for x in solutions)


@dataclass(frozen=True)
class DistanceSensitivity:
    n_draws: int
    n_valid: int
    n_two_solutions: int
    n_one_solution: int
    near_quantiles_kpc: tuple[float, float, float] | None
    far_quantiles_kpc: tuple[float, float, float] | None
    single_quantiles_kpc: tuple[float, float, float] | None
    seed: int


def distance_sensitivity(velocity_km_s: float, longitude_deg: float, *,
                         sigma_velocity_km_s: float, r0_kpc: float = 8.2,
                         sigma_r0_kpc: float = 0.0, v0_km_s: float = 236.0,
                         sigma_v0_km_s: float = 0.0, n_draws: int = 2000,
                         seed: int = 20261022) -> DistanceSensitivity:
    """Seeded conditional uncertainty for flat-rotation kinematic distances.

    Independently perturbs radial velocity, Solar radius and circular speed.
    Branch quantiles are conditional on that branch existing; missing branches
    are not imputed. Does not resolve inner-Galaxy near/far ambiguity.
    """
    scalars = (velocity_km_s, longitude_deg, sigma_velocity_km_s, r0_kpc,
               sigma_r0_kpc, v0_km_s, sigma_v0_km_s)
    if not all(math.isfinite(x) for x in scalars) or any(x < 0 for x in
        (sigma_velocity_km_s, sigma_r0_kpc, sigma_v0_km_s)) or r0_kpc <= 0 or v0_km_s <= 0:
        raise ValueError("invalid velocity or rotation assumptions")
    if not isinstance(n_draws, int) or n_draws < 1:
        raise ValueError("n_draws must be positive")
    rng = random.Random(seed)
    near: list[float] = []
    far: list[float] = []
    single: list[float] = []
    n_valid = n_two = n_one = 0
    for _ in range(n_draws):
        v = rng.gauss(velocity_km_s, sigma_velocity_km_s)
        r0 = rng.gauss(r0_kpc, sigma_r0_kpc)
        v0 = rng.gauss(v0_km_s, sigma_v0_km_s)
        solutions = _distance_solutions(v, longitude_deg, r0, v0)
        if solutions:
            n_valid += 1
            if len(solutions) == 2 and abs(solutions[1] - solutions[0]) > 1e-10:
                n_two += 1
                near.append(solutions[0])
                far.append(solutions[1])
            else:
                n_one += 1
                single.append(solutions[0])
    def q(values: list[float]) -> tuple[float, float, float] | None:
        if not values:
            return None
        ordered = sorted(values)
        def at(p: float) -> float:
            k = (len(ordered) - 1) * p
            lo = int(k)
            return ordered[lo] + (ordered[min(lo + 1, len(ordered) - 1)] - ordered[lo]) * (k - lo)
        return (at(0.16), at(0.5), at(0.84))
    return DistanceSensitivity(n_draws, n_valid, n_two, n_one, q(near), q(far), q(single), seed)
