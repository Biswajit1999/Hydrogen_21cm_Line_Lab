"""Generate a synthetic neutral hydrogen 21 cm spectrum."""

from __future__ import annotations

import csv
import math
from pathlib import Path

REST_FREQ_MHZ = 1420.40575177
COLUMN_FACTOR = 1.823e18
R0_KPC = 8.2


def galactic_components(longitude_deg: float, theta0: float, tau_peak: float) -> list[dict[str, float]]:
    longitude = math.radians(longitude_deg)
    sin_l = max(0.05, math.sin(longitude))
    tangent_velocity = theta0 * (1.0 - sin_l)
    local_arm = 8.0 * math.sin(2.0 * longitude)
    perseus_arm = -45.0 * math.sin(longitude) if longitude_deg < 95.0 else -25.0 * math.sin(longitude)
    inner_arm = tangent_velocity if longitude_deg < 90.0 else -0.35 * theta0 * math.sin(longitude)
    return [
        {"name": "local gas", "velocity_km_s": local_arm, "tau": tau_peak * 0.85, "width_scale": 1.1, "radius_kpc": R0_KPC},
        {"name": "inner/tangent gas", "velocity_km_s": inner_arm, "tau": tau_peak * (1.25 if longitude_deg < 90.0 else 0.45), "width_scale": 0.85, "radius_kpc": max(R0_KPC * sin_l, 2.2)},
        {"name": "outer arm", "velocity_km_s": perseus_arm, "tau": tau_peak * 0.55, "width_scale": 1.35, "radius_kpc": 10.8},
    ]


def tangent_point(longitude_deg: float, theta0: float) -> dict[str, float | None]:
    longitude = math.radians(longitude_deg)
    radius = R0_KPC * abs(math.sin(longitude))
    if 0.0 < longitude_deg < 90.0:
        velocity = theta0 * (1.0 - abs(math.sin(longitude)))
        frequency = REST_FREQ_MHZ * (1.0 - velocity / 299792.458)
    else:
        velocity = None
        frequency = None
    return {"longitude_deg": longitude_deg, "radius_kpc": radius, "velocity_km_s": velocity, "frequency_mhz": frequency}


def generate_spectrum(
    spin_temperature: float = 120.0,
    continuum: float = 2.73,
    tau_peak: float = 0.12,
    sigma_velocity: float = 9.0,
    longitude_deg: float = 35.0,
    theta0: float = 220.0,
    samples: int = 420,
) -> tuple[list[dict[str, float]], float]:
    span = 360.0
    components = galactic_components(longitude_deg, theta0, tau_peak)
    rows: list[dict[str, float]] = []
    integral = 0.0
    last_v: float | None = None
    last_tb: float | None = None

    for index in range(samples):
        velocity = -span / 2.0 + span * index / (samples - 1)
        tau = 0.0
        for component in components:
            sigma = sigma_velocity * component["width_scale"]
            tau += component["tau"] * math.exp(-0.5 * ((velocity - component["velocity_km_s"]) / sigma) ** 2)
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

    rotation_output = Path(__file__).resolve().parents[1] / "data" / "tangent_point_table.csv"
    with rotation_output.open("w", newline="", encoding="utf-8") as handle:
      writer = csv.DictWriter(handle, fieldnames=["longitude_deg", "radius_kpc", "velocity_km_s", "frequency_mhz"])
      writer.writeheader()
      for longitude in range(5, 90):
          writer.writerow(tangent_point(float(longitude), 220.0))
    print(f"Wrote {rotation_output}")


if __name__ == "__main__":
    main()
