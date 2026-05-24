"""Generate a synthetic neutral hydrogen 21 cm spectrum."""

from __future__ import annotations

import csv
import math
from pathlib import Path

REST_FREQ_MHZ = 1420.40575177
COLUMN_FACTOR = 1.823e18


def generate_spectrum(
    spin_temperature: float = 120.0,
    continuum: float = 2.73,
    tau_peak: float = 0.12,
    sigma_velocity: float = 9.0,
    samples: int = 420,
) -> tuple[list[dict[str, float]], float]:
    span = max(80.0, sigma_velocity * 8.0)
    rows: list[dict[str, float]] = []
    integral = 0.0
    last_v: float | None = None
    last_tb: float | None = None

    for index in range(samples):
        velocity = -span / 2.0 + span * index / (samples - 1)
        tau = tau_peak * math.exp(-0.5 * (velocity / sigma_velocity) ** 2)
        tb = (spin_temperature - continuum) * (1.0 - math.exp(-tau))
        thin_tb = (spin_temperature - continuum) * tau
        if last_v is not None and last_tb is not None:
            integral += 0.5 * (tb + last_tb) * (velocity - last_v)
        rows.append(
            {
                "velocity_km_s": velocity,
                "brightness_temperature_K": tb,
                "optically_thin_brightness_K": thin_tb,
                "optical_depth": tau,
            }
        )
        last_v = velocity
        last_tb = tb

    return rows, COLUMN_FACTOR * integral


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "data" / "synthetic_21cm_spectrum.csv"
    output.parent.mkdir(exist_ok=True)
    rows, column_density = generate_spectrum()
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["velocity_km_s", "brightness_temperature_K", "optically_thin_brightness_K", "optical_depth"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {output}")
    print(f"N_HI = {column_density:.3e} cm^-2")


if __name__ == "__main__":
    main()
