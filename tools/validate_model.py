"""Validate equations used by Hydrogen 21 cm Line Lab."""

from __future__ import annotations

import csv
import math
from pathlib import Path

from generate_21cm_spectrum import REST_FREQ_MHZ, galactic_components, generate_spectrum, tangent_point

C_KM_S = 299792.458
COLUMN_FACTOR = 1.823e18


def observed_frequency(redshift: float) -> float:
    return REST_FREQ_MHZ / (1.0 + redshift)


def radio_velocity(nu_obs: float) -> float:
    return C_KM_S * (REST_FREQ_MHZ - nu_obs) / REST_FREQ_MHZ


def main() -> None:
    rows_narrow, n_narrow = generate_spectrum(sigma_velocity=8.0, tau_peak=0.01)
    rows_wide, n_wide = generate_spectrum(sigma_velocity=16.0, tau_peak=0.01)
    inner_low_longitude = galactic_components(25.0, 220.0, 0.12)[1]["velocity_km_s"]
    inner_high_longitude = galactic_components(60.0, 220.0, 0.12)[1]["velocity_km_s"]
    tangent = tangent_point(30.0, 220.0)
    small_tau = 1e-4
    thin_error = abs((1.0 - math.exp(-small_tau)) / small_tau - 1.0)

    output = Path(__file__).resolve().parents[1] / "data" / "validation_summary.csv"
    output.parent.mkdir(exist_ok=True)
    checks = [
        {"check": "zero_redshift_frequency", "value": observed_frequency(0.0), "expected": REST_FREQ_MHZ, "passed": math.isclose(observed_frequency(0.0), REST_FREQ_MHZ)},
        {"check": "redshift_decreases_frequency", "value": observed_frequency(0.1) < REST_FREQ_MHZ, "expected": True, "passed": observed_frequency(0.1) < REST_FREQ_MHZ},
        {"check": "positive_radio_velocity_for_redshift", "value": radio_velocity(observed_frequency(0.01)), "expected": "> 0", "passed": radio_velocity(observed_frequency(0.01)) > 0},
        {"check": "optically_thin_limit_error", "value": thin_error, "expected": "< 1e-3", "passed": thin_error < 1e-3},
        {"check": "width_increases_column_density", "value": n_wide / n_narrow, "expected": "> 1", "passed": n_wide > n_narrow},
        {"check": "synthetic_rows", "value": len(rows_narrow), "expected": 420, "passed": len(rows_narrow) == 420},
        {"check": "inner_galaxy_tangent_velocity_trend", "value": inner_low_longitude > inner_high_longitude, "expected": True, "passed": inner_low_longitude > inner_high_longitude},
        {"check": "tangent_radius_at_30deg", "value": tangent["radius_kpc"], "expected": 4.1, "passed": math.isclose(float(tangent["radius_kpc"]), 4.1, rel_tol=0.02)},
        {"check": "positive_tangent_velocity", "value": tangent["velocity_km_s"], "expected": "> 0", "passed": float(tangent["velocity_km_s"]) > 0},
    ]
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["check", "value", "expected", "passed"])
        writer.writeheader()
        writer.writerows(checks)
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
