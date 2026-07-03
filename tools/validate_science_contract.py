"""Independent science-contract checks for Hydrogen 21 cm Line Lab."""

from __future__ import annotations

import math

from generate_21cm_spectrum import COLUMN_FACTOR, REST_FREQ_MHZ, R0_KPC, generate_spectrum, tangent_point

C_KM_S = 299792.458


def observed_frequency(redshift: float) -> float:
    return REST_FREQ_MHZ / (1.0 + redshift)


def radio_velocity_from_frequency(freq_mhz: float) -> float:
    return C_KM_S * (REST_FREQ_MHZ - freq_mhz) / REST_FREQ_MHZ


def frequency_from_radio_velocity(velocity_km_s: float) -> float:
    return REST_FREQ_MHZ * (1.0 - velocity_km_s / C_KM_S)


def slab_brightness(spin_temperature: float, continuum: float, optical_depth: float) -> float:
    return (spin_temperature - continuum) * (1.0 - math.exp(-optical_depth))


def thin_brightness(spin_temperature: float, continuum: float, optical_depth: float) -> float:
    return (spin_temperature - continuum) * optical_depth


def gaussian_integral(peak_tau: float, sigma_km_s: float, spin_temperature: float, continuum: float) -> float:
    return COLUMN_FACTOR * (spin_temperature - continuum) * peak_tau * sigma_km_s * math.sqrt(2.0 * math.pi)


def require(name: str, passed: bool, detail: str) -> None:
    status = "PASS" if passed else "FAIL"
    print(f"{status} {name}: {detail}")
    if not passed:
        raise AssertionError(name)


def main() -> None:
    require(
        "zero_redshift_rest_frequency",
        math.isclose(observed_frequency(0.0), REST_FREQ_MHZ, rel_tol=0.0, abs_tol=1e-12),
        f"nu(z=0)={observed_frequency(0.0):.11f} MHz",
    )
    require(
        "positive_redshift_lowers_frequency",
        observed_frequency(0.05) < REST_FREQ_MHZ,
        f"nu(z=0.05)={observed_frequency(0.05):.6f} MHz",
    )

    for velocity in (-120.0, -15.0, 0.0, 35.0, 240.0):
        recovered = radio_velocity_from_frequency(frequency_from_radio_velocity(velocity))
        require(
            f"radio_velocity_inverse_{velocity:+.0f}",
            math.isclose(recovered, velocity, rel_tol=0.0, abs_tol=1e-9),
            f"recovered={recovered:.12f} km/s",
        )

    tau_small = 1e-5
    ratio = slab_brightness(120.0, 2.73, tau_small) / thin_brightness(120.0, 2.73, tau_small)
    require(
        "optically_thin_limit",
        math.isclose(ratio, 1.0, rel_tol=1e-5, abs_tol=1e-5),
        f"slab/thin={ratio:.12f}",
    )
    require(
        "brightness_monotonic_with_tau",
        slab_brightness(120.0, 2.73, 0.30) > slab_brightness(120.0, 2.73, 0.10),
        "T_s > T_c and tau increased from 0.10 to 0.30",
    )

    expected_ratio = gaussian_integral(0.02, 14.0, 120.0, 2.73) / gaussian_integral(0.01, 14.0, 120.0, 2.73)
    require(
        "thin_column_density_linear_in_tau_peak",
        math.isclose(expected_ratio, 2.0, rel_tol=0.0, abs_tol=1e-12),
        f"analytic ratio={expected_ratio:.12f}",
    )

    _, narrow_column = generate_spectrum(sigma_velocity=8.0, tau_peak=0.01)
    _, wide_column = generate_spectrum(sigma_velocity=16.0, tau_peak=0.01)
    require(
        "wider_line_larger_column_density",
        wide_column > narrow_column,
        f"wide/narrow={wide_column / narrow_column:.6f}",
    )

    longitude = 30.0
    tangent = tangent_point(longitude, 220.0)
    expected_radius = R0_KPC * abs(math.sin(math.radians(longitude)))
    require(
        "tangent_radius_geometry",
        math.isclose(float(tangent["radius_kpc"]), expected_radius, rel_tol=0.0, abs_tol=1e-12),
        f"R_t={tangent['radius_kpc']:.12f} kpc",
    )
    require(
        "non_inner_galaxy_has_no_tangent_solution",
        tangent_point(120.0, 220.0)["velocity_km_s"] is None,
        "longitude 120 deg is outside the idealised inner-Galaxy tangent-point domain",
    )


if __name__ == "__main__":
    main()
