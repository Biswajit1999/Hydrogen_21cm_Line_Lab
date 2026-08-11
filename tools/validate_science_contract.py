"""Independent science-contract checks for Hydrogen 21 cm Line Lab.

These checks are intentionally independent from the browser UI. They guard the
scientific contract before any rendering or animation polish is accepted.
"""

from __future__ import annotations

import csv
import math
from pathlib import Path

from radiative_transfer_contract import (
    COLUMN_FACTOR,
    REST_FREQ_MHZ,
    R0_KPC,
    generate_spectrum,
    integrate_columns,
    tangent_point,
    velocity_conventions,
)

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


def record(checks: list[dict[str, str]], name: str, passed: bool, value: object, expected: str) -> None:
    checks.append({"check": name, "value": str(value), "expected": expected, "passed": str(bool(passed))})
    status = "PASS" if passed else "FAIL"
    print(f"{status} {name}: value={value} expected={expected}")


def main() -> None:
    checks: list[dict[str, str]] = []

    record(
        checks,
        "zero_redshift_rest_frequency",
        math.isclose(observed_frequency(0.0), REST_FREQ_MHZ, rel_tol=0.0, abs_tol=1e-12),
        f"{observed_frequency(0.0):.11f} MHz",
        f"{REST_FREQ_MHZ:.11f} MHz",
    )
    record(
        checks,
        "positive_redshift_lowers_frequency",
        observed_frequency(0.05) < REST_FREQ_MHZ,
        f"{observed_frequency(0.05):.6f} MHz",
        "below rest frequency",
    )

    conventions = velocity_conventions(0.01)
    record(
        checks,
        "velocity_convention_ordering",
        conventions["radio_km_s"] < conventions["relativistic_km_s"] < conventions["optical_km_s"],
        conventions,
        "radio < relativistic < optical at z=0.01",
    )

    for velocity in (-120.0, -15.0, 0.0, 35.0, 240.0):
        recovered = radio_velocity_from_frequency(frequency_from_radio_velocity(velocity))
        record(
            checks,
            f"radio_velocity_inverse_{velocity:+.0f}",
            math.isclose(recovered, velocity, rel_tol=0.0, abs_tol=1e-9),
            f"{recovered:.12f} km/s",
            f"{velocity:.12f} km/s",
        )

    tau_small = 1e-5
    ratio = slab_brightness(120.0, 2.73, tau_small) / thin_brightness(120.0, 2.73, tau_small)
    record(
        checks,
        "optically_thin_limit",
        math.isclose(ratio, 1.0, rel_tol=1e-5, abs_tol=1e-5),
        f"{ratio:.12f}",
        "slab/thin close to 1",
    )
    record(
        checks,
        "brightness_monotonic_with_tau",
        slab_brightness(120.0, 2.73, 0.30) > slab_brightness(120.0, 2.73, 0.10),
        "T_B(tau=0.30) > T_B(tau=0.10)",
        "monotonic for fixed T_s > T_c",
    )
    record(
        checks,
        "brightness_bounded_by_source_function",
        slab_brightness(120.0, 2.73, 50.0) <= (120.0 - 2.73),
        f"{slab_brightness(120.0, 2.73, 50.0):.12f} K",
        "T_B <= T_s - T_c",
    )

    expected_ratio = gaussian_integral(0.02, 14.0, 120.0, 2.73) / gaussian_integral(0.01, 14.0, 120.0, 2.73)
    record(
        checks,
        "thin_column_density_linear_in_tau_peak",
        math.isclose(expected_ratio, 2.0, rel_tol=0.0, abs_tol=1e-12),
        f"{expected_ratio:.12f}",
        "2.0 when tau_peak doubles",
    )

    narrow_rows, narrow_column = generate_spectrum(sigma_velocity=8.0, tau_peak=0.01)
    wide_rows, wide_column = generate_spectrum(sigma_velocity=16.0, tau_peak=0.01)
    record(
        checks,
        "wider_line_larger_column_density",
        wide_column > narrow_column,
        f"wide/narrow={wide_column / narrow_column:.6f}",
        "ratio > 1",
    )

    opaque_rows, _ = generate_spectrum(spin_temperature=120.0, tau_peak=0.8)
    opaque_columns = integrate_columns(opaque_rows, 120.0)
    record(
        checks,
        "opaque_slab_exceeds_thin_estimate",
        opaque_columns["uniform_slab_cm2"] > opaque_columns["thin_cm2"],
        f"slab/thin={opaque_columns['uniform_slab_cm2'] / opaque_columns['thin_cm2']:.6f}",
        "uniform slab column greater at high optical depth",
    )

    record(
        checks,
        "synthetic_rows_are_ordered",
        all(a["velocity_km_s"] < b["velocity_km_s"] for a, b in zip(narrow_rows, narrow_rows[1:])),
        "strictly increasing velocity grid",
        "monotonic velocity axis",
    )
    record(
        checks,
        "wide_rows_preserve_channel_count",
        len(wide_rows) == len(narrow_rows),
        f"{len(wide_rows)} rows",
        f"{len(narrow_rows)} rows",
    )

    longitude = 30.0
    tangent = tangent_point(longitude, 220.0)
    expected_radius = R0_KPC * abs(math.sin(math.radians(longitude)))
    record(
        checks,
        "tangent_radius_geometry",
        math.isclose(float(tangent["radius_kpc"]), expected_radius, rel_tol=0.0, abs_tol=1e-12),
        f"{tangent['radius_kpc']:.12f} kpc",
        f"{expected_radius:.12f} kpc",
    )
    record(
        checks,
        "non_inner_galaxy_has_no_tangent_solution",
        tangent_point(120.0, 220.0)["velocity_km_s"] is None,
        "None at longitude 120 deg",
        "outside idealised inner-Galaxy tangent-point domain",
    )

    output = Path(__file__).resolve().parents[1] / "data" / "science_contract_summary.csv"
    output.parent.mkdir(exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["check", "value", "expected", "passed"])
        writer.writeheader()
        writer.writerows(checks)

    failures = [check for check in checks if check["passed"] != "True"]
    if failures:
        raise SystemExit(f"Science contract failed: {failures}")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
