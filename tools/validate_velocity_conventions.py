"""Validate optical, radio, and relativistic 21 cm spectral-coordinate conventions.

These checks deliberately separate three uses of redshift-like quantities:

1. Cosmological frequency shift: nu_obs = nu0 / (1 + z).
2. Radio velocity coordinate: v_rad = c (nu0 - nu) / nu0 = c z / (1 + z).
3. Optical velocity coordinate: v_opt = c (nu0 - nu) / nu = c z.
4. Relativistic Doppler velocity coordinate for a pure radial Doppler shift.

The tests guard against a common visualisation error: treating all velocity labels as
identical physical velocities.
"""

from __future__ import annotations

import csv
import math
from pathlib import Path

C_KM_S = 299792.458
REST_FREQ_MHZ = 1420.40575177


def frequency_from_redshift(z: float) -> float:
    if z <= -1.0:
        raise ValueError("redshift must be greater than -1")
    return REST_FREQ_MHZ / (1.0 + z)


def z_from_frequency(nu_mhz: float) -> float:
    if nu_mhz <= 0.0:
        raise ValueError("frequency must be positive")
    return REST_FREQ_MHZ / nu_mhz - 1.0


def radio_velocity_from_z(z: float) -> float:
    return C_KM_S * z / (1.0 + z)


def z_from_radio_velocity(v_km_s: float) -> float:
    if v_km_s >= C_KM_S:
        raise ValueError("radio velocity coordinate must be below c")
    return v_km_s / (C_KM_S - v_km_s)


def optical_velocity_from_z(z: float) -> float:
    return C_KM_S * z


def z_from_optical_velocity(v_km_s: float) -> float:
    return v_km_s / C_KM_S


def relativistic_velocity_from_z(z: float) -> float:
    factor = (1.0 + z) ** 2
    return C_KM_S * (factor - 1.0) / (factor + 1.0)


def z_from_relativistic_velocity(v_km_s: float) -> float:
    beta = v_km_s / C_KM_S
    if abs(beta) >= 1.0:
        raise ValueError("relativistic beta must satisfy |beta| < 1")
    return math.sqrt((1.0 + beta) / (1.0 - beta)) - 1.0


def near(a: float, b: float, rel: float = 1e-12, abs_tol: float = 1e-12) -> bool:
    return math.isclose(a, b, rel_tol=rel, abs_tol=abs_tol)


def main() -> None:
    redshifts = [-0.02, 0.0, 0.001, 0.01, 0.1, 1.0]
    rows: list[dict[str, object]] = []

    for z in redshifts:
        nu = frequency_from_redshift(z)
        radio = radio_velocity_from_z(z)
        optical = optical_velocity_from_z(z)
        relativistic = relativistic_velocity_from_z(z)
        rows.extend(
            [
                {"check": f"frequency_inverse_z={z}", "value": z_from_frequency(nu), "expected": z, "passed": near(z_from_frequency(nu), z)},
                {"check": f"radio_inverse_z={z}", "value": z_from_radio_velocity(radio), "expected": z, "passed": near(z_from_radio_velocity(radio), z)},
                {"check": f"optical_inverse_z={z}", "value": z_from_optical_velocity(optical), "expected": z, "passed": near(z_from_optical_velocity(optical), z)},
                {"check": f"relativistic_inverse_z={z}", "value": z_from_relativistic_velocity(relativistic), "expected": z, "passed": near(z_from_relativistic_velocity(relativistic), z)},
            ]
        )

    z = 0.1
    rows.append(
        {
            "check": "positive_redshift_velocity_ordering",
            "value": f"radio={radio_velocity_from_z(z):.6f}, relativistic={relativistic_velocity_from_z(z):.6f}, optical={optical_velocity_from_z(z):.6f}",
            "expected": "radio < relativistic < optical",
            "passed": radio_velocity_from_z(z) < relativistic_velocity_from_z(z) < optical_velocity_from_z(z),
        }
    )
    z_blue = -0.02
    rows.append(
        {
            "check": "negative_redshift_velocity_ordering",
            "value": f"optical={optical_velocity_from_z(z_blue):.6f}, relativistic={relativistic_velocity_from_z(z_blue):.6f}, radio={radio_velocity_from_z(z_blue):.6f}",
            "expected": "optical < relativistic < radio",
            "passed": optical_velocity_from_z(z_blue) < relativistic_velocity_from_z(z_blue) < radio_velocity_from_z(z_blue),
        }
    )
    rows.append(
        {
            "check": "local_small_z_conventions_agree_to_first_order",
            "value": abs(radio_velocity_from_z(1e-6) - optical_velocity_from_z(1e-6)),
            "expected": "< 1e-3 km/s",
            "passed": abs(radio_velocity_from_z(1e-6) - optical_velocity_from_z(1e-6)) < 1e-3,
        }
    )

    failures = [row for row in rows if not row["passed"]]
    output = Path(__file__).resolve().parents[1] / "data" / "velocity_convention_validation.csv"
    output.parent.mkdir(exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["check", "value", "expected", "passed"])
        writer.writeheader()
        writer.writerows(rows)
    if failures:
        raise SystemExit(f"Velocity convention validation failed: {failures}")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
