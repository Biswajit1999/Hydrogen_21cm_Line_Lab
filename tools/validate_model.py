"""Validate equations used by Hydrogen 21 cm Line Lab."""

from __future__ import annotations

import csv
import math
from pathlib import Path

from generate_21cm_spectrum import (
    C_KM_S,
    REST_FREQ_MHZ,
    SPECTRUM_SAMPLES,
    VELOCITY_SPAN_KM_S,
    galactic_components,
    generate_spectrum,
    integrate_columns,
    observed_frequency,
    radio_frequency_from_velocity,
    tangent_point,
    velocity_conventions,
)


def main() -> None:
    rows_narrow, n_narrow = generate_spectrum(sigma_velocity=8.0, tau_peak=0.01)
    rows_wide, n_wide = generate_spectrum(sigma_velocity=16.0, tau_peak=0.01)
    rows_opaque, _ = generate_spectrum(spin_temperature=120.0, tau_peak=0.8)
    inner_low_longitude = galactic_components(25.0, 220.0, 0.12)[1]["velocity_km_s"]
    inner_high_longitude = galactic_components(60.0, 220.0, 0.12)[1]["velocity_km_s"]
    tangent = tangent_point(30.0, 220.0)
    small_tau = 1e-4
    thin_error = abs((1.0 - math.exp(-small_tau)) / small_tau - 1.0)
    conventions = velocity_conventions(0.01)
    slab_opaque = integrate_columns(rows_opaque, 120.0)
    first_velocity = rows_narrow[0]["velocity_km_s"]
    last_velocity = rows_narrow[-1]["velocity_km_s"]
    channel_spacing = rows_narrow[1]["velocity_km_s"] - rows_narrow[0]["velocity_km_s"]

    output = Path(__file__).resolve().parents[1] / "data" / "validation_summary.csv"
    output.parent.mkdir(exist_ok=True)
    checks = [
        {"check": "zero_redshift_frequency", "value": observed_frequency(0.0), "expected": REST_FREQ_MHZ, "passed": math.isclose(observed_frequency(0.0), REST_FREQ_MHZ)},
        {"check": "redshift_decreases_frequency", "value": observed_frequency(0.1) < REST_FREQ_MHZ, "expected": True, "passed": observed_frequency(0.1) < REST_FREQ_MHZ},
        {"check": "radio_convention_from_redshift", "value": conventions["radio_km_s"], "expected": C_KM_S * 0.01 / 1.01, "passed": math.isclose(conventions["radio_km_s"], C_KM_S * 0.01 / 1.01)},
        {"check": "radio_frequency_linear_coordinate", "value": radio_frequency_from_velocity(100.0), "expected": REST_FREQ_MHZ * (1.0 - 100.0 / C_KM_S), "passed": math.isclose(radio_frequency_from_velocity(100.0), REST_FREQ_MHZ * (1.0 - 100.0 / C_KM_S))},
        {"check": "velocity_conventions_diverge_at_nonzero_z", "value": conventions["optical_km_s"] - conventions["radio_km_s"], "expected": "> 0", "passed": conventions["optical_km_s"] > conventions["radio_km_s"]},
        {"check": "relativistic_velocity_between_radio_and_optical", "value": conventions["relativistic_km_s"], "expected": "radio < relativistic < optical", "passed": conventions["radio_km_s"] < conventions["relativistic_km_s"] < conventions["optical_km_s"]},
        {"check": "optically_thin_limit_error", "value": thin_error, "expected": "< 1e-3", "passed": thin_error < 1e-3},
        {"check": "uniform_slab_exceeds_thin_at_high_tau", "value": slab_opaque["uniform_slab_cm2"] / slab_opaque["thin_cm2"], "expected": "> 1", "passed": slab_opaque["uniform_slab_cm2"] > slab_opaque["thin_cm2"]},
        {"check": "width_increases_column_density", "value": n_wide / n_narrow, "expected": "> 1", "passed": n_wide > n_narrow},
        {"check": "synthetic_rows_match_browser_contract", "value": len(rows_narrow), "expected": SPECTRUM_SAMPLES, "passed": len(rows_narrow) == SPECTRUM_SAMPLES},
        {"check": "velocity_span_contract", "value": last_velocity - first_velocity, "expected": VELOCITY_SPAN_KM_S, "passed": math.isclose(last_velocity - first_velocity, VELOCITY_SPAN_KM_S)},
        {"check": "positive_channel_spacing", "value": channel_spacing, "expected": "> 0", "passed": channel_spacing > 0},
        {"check": "inner_galaxy_tangent_velocity_trend", "value": inner_low_longitude > inner_high_longitude, "expected": True, "passed": inner_low_longitude > inner_high_longitude},
        {"check": "tangent_radius_at_30deg", "value": tangent["radius_kpc"], "expected": 4.1, "passed": math.isclose(float(tangent["radius_kpc"]), 4.1, rel_tol=0.02)},
        {"check": "positive_tangent_velocity", "value": tangent["velocity_km_s"], "expected": "> 0", "passed": float(tangent["velocity_km_s"]) > 0},
    ]
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["check", "value", "expected", "passed"])
        writer.writeheader()
        writer.writerows(checks)
    failures = [check for check in checks if not check["passed"]]
    if failures:
        raise SystemExit(f"Validation failed: {failures}")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
