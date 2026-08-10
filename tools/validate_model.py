"""Validate Galactic H I Doppler and circular-rotation relationships."""

from __future__ import annotations

import csv
import math
from pathlib import Path

from generate_21cm_spectrum import (
    Galaxy,
    REST_FREQUENCY_MHZ,
    doppler_frequency,
    generate_spectrum,
    radial_velocity,
)


def main() -> None:
    galaxy = Galaxy()
    positive = radial_velocity(5.0, math.radians(32.0), galaxy)
    negative = radial_velocity(5.0, math.radians(-32.0), galaxy)
    spectrum = generate_spectrum(galaxy)
    maximum_brightness = max(row["brightness_temperature_k"] for row in spectrum)
    rows = [
        {"check": "zero_velocity_rest_frequency", "value": doppler_frequency(0.0), "expected": REST_FREQUENCY_MHZ, "passed": doppler_frequency(0.0) == REST_FREQUENCY_MHZ},
        {"check": "receding_doppler_shift", "value": doppler_frequency(40.0), "expected": f"< {REST_FREQUENCY_MHZ}", "passed": doppler_frequency(40.0) < REST_FREQUENCY_MHZ},
        {"check": "centre_line_zero_velocity", "value": radial_velocity(4.0, 0.0, galaxy), "expected": 0.0, "passed": radial_velocity(4.0, 0.0, galaxy) == 0.0},
        {"check": "longitude_velocity_sign_symmetry", "value": positive + negative, "expected": 0.0, "passed": math.isclose(positive, -negative, rel_tol=1e-14)},
        {"check": "spectrum_has_emission", "value": maximum_brightness, "expected": "> 0", "passed": maximum_brightness > 0.0},
        {"check": "spectral_channel_count", "value": len(spectrum), "expected": 512, "passed": len(spectrum) == 512},
    ]
    output = Path(__file__).resolve().parents[1] / "data" / "validation_summary.csv"
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["check", "value", "expected", "passed"])
        writer.writeheader()
        writer.writerows(rows)
    failed = [row["check"] for row in rows if not row["passed"]]
    if failed:
        raise SystemExit(f"Validation failed: {', '.join(str(item) for item in failed)}")
    print(f"Validated {len(rows)} H I kinematic invariants; wrote {output}")


if __name__ == "__main__":
    main()
