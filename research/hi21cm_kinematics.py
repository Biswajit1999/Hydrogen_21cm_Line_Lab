"""Conditioned H I 21-cm kinematic diagnostics (no cloud-distance inference)."""
import math

REST_MHZ = 1420.40575177
C_KMS = 299792.458


def velocity_to_frequency(v_kms, *, relativistic=False):
    """Radio convention by default; optional special-relativistic Doppler."""
    if not math.isfinite(v_kms) or abs(v_kms) >= C_KMS:
        raise ValueError("velocity must be finite and subluminal")
    beta = v_kms / C_KMS
    return REST_MHZ * (math.sqrt((1 - beta) / (1 + beta)) if relativistic else 1 - beta)


def frequency_to_velocity(freq_mhz, *, relativistic=False):
    """Invert the chosen frequency convention; output km/s."""
    if not math.isfinite(freq_mhz) or freq_mhz <= 0:
        raise ValueError("frequency must be positive and finite")
    ratio = freq_mhz / REST_MHZ
    if relativistic:
        return C_KMS * (1 - ratio * ratio) / (1 + ratio * ratio)
    return C_KMS * (1 - ratio)


def rotation_radius(v_lsr, longitude_deg, *, r0=8.2, v0=238.0):
    """Flat-rotation Galactocentric radius in kpc; None if degenerate/unphysical."""
    if not all(map(math.isfinite, (v_lsr, longitude_deg, r0, v0))) or r0 <= 0 or v0 <= 0:
        raise ValueError("invalid rotation parameters")
    s = math.sin(math.radians(longitude_deg))
    if abs(s) < 1e-8:
        return None
    denominator = 1 + v_lsr / (v0 * s)
    return r0 / denominator if denominator > 0 else None


def distance_solutions(radius, longitude_deg, *, r0=8.2, tolerance=1e-10):
    """Nonnegative heliocentric solutions in the Galactic plane, in kpc."""
    if radius is None:
        return ()
    if not all(map(math.isfinite, (radius, longitude_deg, r0))) or radius <= 0 or r0 <= 0:
        raise ValueError("invalid geometry")
    l = math.radians(longitude_deg)
    projection = r0 * math.cos(l)
    discriminant = radius * radius - (r0 * math.sin(l)) ** 2
    if discriminant < -tolerance:
        return ()
    root = math.sqrt(max(0.0, discriminant))
    return tuple(sorted(set(round(d, 12) for d in (projection - root, projection + root) if d >= -tolerance)))


def radius_velocity_sensitivity(v_lsr, longitude_deg, sigma_v, *, r0=8.2, v0=238.0):
    """First-order |dR/dv| sigma_v; excludes uncertain rotation parameters."""
    if not math.isfinite(sigma_v) or sigma_v < 0:
        raise ValueError("invalid velocity uncertainty")
    r = rotation_radius(v_lsr, longitude_deg, r0=r0, v0=v0)
    if r is None:
        return None
    return r * r * sigma_v / (r0 * v0 * abs(math.sin(math.radians(longitude_deg))))
