"""Independent validation for 21 cm spectral velocity conventions.

The browser presents radio, optical, and relativistic velocities as spectral
coordinate labels for the same redshift. These checks are intentionally kept
separate from rendering so that visual changes cannot quietly alter the physics
contract.
"""

from __future__ import annotations

import math

from generate_21cm_spectrum import C_KM_S, REST_FREQ_MHZ, observed_frequency, radio_frequency_from_velocity, velocity_conventions


def require(name: str, passed: bool, detail: str) -> None:
    status = "PASS" if passed else "FAIL"
    print(f"{status} {name}: {detail}")
    if not passed:
        raise AssertionError(name)


def radio_velocity_from_frequency(freq_mhz: float) -> float:
    return C_KM_S * (REST_FREQ_MHZ - freq_mhz) / REST_FREQ_MHZ


def optical_velocity_from_frequency(freq_mhz: float) -> float:
    redshift = REST_FREQ_MHZ / freq_mhz - 1.0
    return C_KM_S * redshift


def relativistic_velocity_from_redshift(redshift: float) -> float:
    one_plus_z_sq = (1.0 + redshift) ** 2
    return C_KM_S * (one_plus_z_sq - 1.0) / (one_plus_z_sq + 1.0)


def main() -> None:
    require(
        "zero_redshift_frequency_is_rest_frequency",
        math.isclose(observed_frequency(0.0), REST_FREQ_MHZ, rel_tol=0.0, abs_tol=1e-12),
        f"nu(z=0)={observed_frequency(0.0):.11f} MHz",
    )

    for redshift in (1e-6, 1e-4, 0.01, 0.1, 1.0):
        freq = observed_frequency(redshift)
        conventions = velocity_conventions(redshift)
        radio_from_freq = radio_velocity_from_frequency(freq)
        optical_from_freq = optical_velocity_from_frequency(freq)
        relativistic_from_z = relativistic_velocity_from_redshift(redshift)

        require(
            f"radio_frequency_inverse_z_{redshift:g}",
            math.isclose(radio_from_freq, conventions["radio_km_s"], rel_tol=0.0, abs_tol=1e-9),
            f"radio={radio_from_freq:.12f} km/s",
        )
        require(
            f"optical_frequency_inverse_z_{redshift:g}",
            math.isclose(optical_from_freq, conventions["optical_km_s"], rel_tol=0.0, abs_tol=1e-9),
            f"optical={optical_from_freq:.12f} km/s",
        )
        require(
            f"relativistic_formula_z_{redshift:g}",
            math.isclose(relativistic_from_z, conventions["relativistic_km_s"], rel_tol=0.0, abs_tol=1e-9),
            f"relativistic={relativistic_from_z:.12f} km/s",
        )
        require(
            f"ordering_positive_z_{redshift:g}",
            conventions["radio_km_s"] < conventions["relativistic_km_s"] < conventions["optical_km_s"],
            "radio < relativistic < optical for positive redshift",
        )

    low_z = velocity_conventions(1e-6)
    high_z = velocity_conventions(1.0)
    low_spread = low_z["optical_km_s"] - low_z["radio_km_s"]
    high_spread = high_z["optical_km_s"] - high_z["radio_km_s"]
    require(
        "conventions_agree_at_low_redshift",
        low_spread < 1e-3,
        f"optical-radio spread at z=1e-6 is {low_spread:.6e} km/s",
    )
    require(
        "conventions_diverge_at_high_redshift",
        high_spread > 1.0e5,
        f"optical-radio spread at z=1 is {high_spread:.3f} km/s",
    )

    for velocity in (-240.0, -35.0, 0.0, 120.0, 240.0):
        recovered = radio_velocity_from_frequency(radio_frequency_from_velocity(velocity))
        require(
            f"local_radio_coordinate_round_trip_{velocity:+.0f}",
            math.isclose(recovered, velocity, rel_tol=0.0, abs_tol=1e-9),
            f"recovered={recovered:.12f} km/s",
        )

    print("Velocity convention validation completed.")


if __name__ == "__main__":
    main()
