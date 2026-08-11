"""Independent radiative-transfer and tangent-point physics for the 21 cm science contract.

This module is deliberately separate from generate_21cm_spectrum.py, which implements a
different model (Galactic-rotation line-of-sight density integration for the synthetic
spectrum used by validate_model.py). This module instead implements:

1. Spectral-line velocity conventions (radio / optical / relativistic Doppler), following
   the standard radio-astronomy definitions (e.g. Greisen, Calabretta et al. 2006, A&A 446,
   747, "Representations of spectral coordinates in FITS").
2. Single-slab LTE radiative transfer for an HI cloud against a background continuum
   (e.g. the cosmic microwave background), following the standard brightness-temperature
   equation T_B = (T_s - T_c)(1 - e^-tau).
3. The optically-thin HI column density conversion, N_HI [cm^-2] = 1.8224e18 * Integral(T_B dv)
   [K km/s] (Draine, 2011, "Physics of the Interstellar and Intergalactic Medium", eq. 8.16).
4. The classical tangent-point method for deriving a Galactic rotation curve from HI 21 cm
   emission at 0 < l < 90 deg (e.g. Binney & Merrifield, 1998, "Galactic Astronomy", section 9.1).
"""

from __future__ import annotations

import math

C_KM_S = 299792.458
REST_FREQ_MHZ = 1420.40575177
R0_KPC = 8.2

# Optically-thin HI column density conversion constant [cm^-2 / (K km/s)].
# N_HI = COLUMN_FACTOR * Integral(T_B(v) dv), valid when T_B << T_s (Draine 2011, eq. 8.16).
COLUMN_FACTOR = 1.8224e18

# Continuum (background) brightness temperature assumed throughout this module: the
# cosmic microwave background at the 21 cm frequency, T_c = 2.73 K.
CONTINUUM_K = 2.73


def observed_frequency(redshift: float) -> float:
    """Optical-convention observed frequency: 1 + z = f0 / f."""
    return REST_FREQ_MHZ / (1.0 + redshift)


def radio_frequency_from_velocity(velocity_km_s: float) -> float:
    """Frequency implied by a radio-convention velocity: v = c(f0-f)/f0."""
    return REST_FREQ_MHZ * (1.0 - velocity_km_s / C_KM_S)


def velocity_conventions(redshift: float) -> dict[str, float]:
    """Radio, relativistic and optical Doppler velocities for the same redshift.

    Using the optical-convention redshift z = (f0 - f) / f:
      v_optical      = c * z
      v_radio        = c * z / (1 + z)
      v_relativistic = c * ((1+z)^2 - 1) / ((1+z)^2 + 1)
    For z > 0 these satisfy v_radio < v_relativistic < v_optical, converging as z -> 0.
    """
    one_plus_z = 1.0 + redshift
    optical = C_KM_S * redshift
    radio = C_KM_S * redshift / one_plus_z
    relativistic = C_KM_S * (one_plus_z**2 - 1.0) / (one_plus_z**2 + 1.0)
    return {"radio_km_s": radio, "relativistic_km_s": relativistic, "optical_km_s": optical}


def generate_spectrum(
    sigma_velocity: float = 8.0,
    tau_peak: float = 0.1,
    spin_temperature: float = 120.0,
    continuum: float = CONTINUUM_K,
    bins: int = 257,
    half_width_km_s: float = 200.0,
) -> tuple[list[dict[str, float]], float]:
    """Synthetic single-slab HI line: Gaussian optical depth, LTE brightness temperature.

    tau(v) = tau_peak * exp(-v^2 / (2 sigma_velocity^2))
    T_B(v) = (T_s - T_c) * (1 - exp(-tau(v)))   [standard LTE slab equation]

    Returns (rows, column_density_cm2), where column_density_cm2 is the exact HI column
    implied by this noiseless Gaussian optical-depth profile: N_HI = COLUMN_FACTOR * T_s *
    Integral(tau(v) dv), using the closed-form Gaussian integral
    Integral(tau(v) dv) = tau_peak * sigma_velocity * sqrt(2 pi).
    """
    step = 2.0 * half_width_km_s / (bins - 1)
    rows: list[dict[str, float]] = []
    for index in range(bins):
        velocity = -half_width_km_s + index * step
        tau = tau_peak * math.exp(-0.5 * (velocity / sigma_velocity) ** 2)
        brightness = (spin_temperature - continuum) * (1.0 - math.exp(-tau))
        rows.append({"velocity_km_s": velocity, "brightness_k": brightness, "optical_depth": tau})
    tau_integral = tau_peak * sigma_velocity * math.sqrt(2.0 * math.pi)
    column_density_cm2 = COLUMN_FACTOR * spin_temperature * tau_integral
    return rows, column_density_cm2


def integrate_columns(
    rows: list[dict[str, float]], spin_temperature: float, continuum: float = CONTINUUM_K
) -> dict[str, float]:
    """Two HI column-density estimates from an observed brightness-temperature spectrum.

    thin_cm2: the naive optically-thin estimate, treating T_B itself as proportional to
      optical depth (N = COLUMN_FACTOR * Integral(T_B dv)). This under-estimates the true
      column whenever the line saturates (tau not small), because (1 - e^-tau) < tau there.
    uniform_slab_cm2: recovers the true optical depth by inverting the LTE slab equation,
      tau(v) = -ln(1 - T_B(v) / (T_s - T_c)), then integrates N = COLUMN_FACTOR * T_s *
      Integral(tau(v) dv). This is exact for a single-temperature slab at any optical depth.
    """

    def trapezoid(values: list[float], velocities: list[float]) -> float:
        total = 0.0
        for (v0, y0), (v1, y1) in zip(zip(velocities, values), zip(velocities[1:], values[1:])):
            total += 0.5 * (y0 + y1) * (v1 - v0)
        return total

    velocities = [row["velocity_km_s"] for row in rows]
    brightness = [row["brightness_k"] for row in rows]
    thin_cm2 = COLUMN_FACTOR * trapezoid(brightness, velocities)

    source_function = spin_temperature - continuum
    recovered_tau = [
        -math.log(max(1e-12, 1.0 - min(brightness_value / source_function, 1.0 - 1e-12)))
        for brightness_value in brightness
    ]
    uniform_slab_cm2 = COLUMN_FACTOR * spin_temperature * trapezoid(recovered_tau, velocities)
    return {"thin_cm2": thin_cm2, "uniform_slab_cm2": uniform_slab_cm2}


def tangent_point(longitude_deg: float, v0_km_s: float) -> dict[str, float | None]:
    """Classical tangent-point method for a flat Galactic rotation curve.

    For a flat rotation curve v(R) = v0, the line-of-sight velocity at Galactic longitude l
    is v_r(R, l) = v0 (R0/R - 1) sin(l), which is extremised along the line of sight at the
    tangent point R_tp = R0 |sin(l)| -- the point of closest approach to the Galactic centre.
    Substituting gives the terminal (maximum) velocity v_term(l) = v0 (1 - sin(l)), valid only
    for 0 < l < 90 deg, where the near side of the tangent circle lies along the line of sight.
    """
    longitude_rad = math.radians(longitude_deg)
    radius_kpc = R0_KPC * abs(math.sin(longitude_rad))
    if 0.0 < longitude_deg < 90.0:
        velocity_km_s: float | None = v0_km_s * (1.0 - math.sin(longitude_rad))
    else:
        velocity_km_s = None
    return {"radius_kpc": radius_kpc, "velocity_km_s": velocity_km_s}
