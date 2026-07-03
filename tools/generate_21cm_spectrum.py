"""Generate a synthetic neutral hydrogen 21 cm spectrum."""

from __future__ import annotations

import csv
import math
from pathlib import Path

REST_FREQ_MHZ = 1420.40575177
C_KM_S = 299792.458
COLUMN_FACTOR = 1.823e18
R0_KPC = 8.2
SPECTRUM_SAMPLES = 520
VELOCITY_SPAN_KM_S = 360.0


def observed_frequency(redshift: float) -> float:
    """Cosmological frequency relation, not a local velocity conversion."""
    return REST_FREQ_MHZ / (1.0 + redshift)


def radio_frequency_from_velocity(velocity_km_s: float) -> float:
    """Radio spectral-coordinate frequency for a local line-of-sight velocity label."""
    return REST_FREQ_MHZ * (1.0 - velocity_km_s / C_KM_S)


def velocity_conventions(redshift: float) -> dict[str, float]:
    """Radio, optical and relativistic coordinates for one spectral redshift."""
    return {
        "radio_km_s": C_KM_S * redshift / (1.0 + redshift),
        "optical_km_s": C_KM_S * redshift,
        "relativistic_km_s": C_KM_S * (((1.0 + redshift) ** 2 - 1.0) / ((1.0 + redshift) ** 2 + 1.0)),
    }


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
        frequency = radio_frequency_from_velocity(velocity)
    else:
        velocity = None
        frequency = None
    return {"longitude_deg": longitude_deg, "radius_kpc": radius, "velocity_km_s": velocity, "frequency_mhz": frequency}


def integrate_columns(rows: list[dict[str, float]], spin_temperature: float) -> dict[str, float]:
    """Return thin and uniform-slab NHI estimates for the synthetic rows."""
    thin_integral = 0.0
    tau_integral = 0.0
    for previous, current in zip(rows, rows[1:]):
        dv = current["velocity_km_s"] - previous["velocity_km_s"]
        thin_integral += 0.5 * (current["brightness_temperature_K"] + previous["brightness_temperature_K"]) * dv
        tau_integral += 0.5 * (current["optical_depth"] + previous["optical_depth"]) * dv
    return {
        "thin_cm2": COLUMN_FACTOR * thin_integral,
        "uniform_slab_cm2": COLUMN_FACTOR * spin_temperature * tau_integral,
    }


def generate_spectrum(
    spin_temperature: float = 120.0,
    continuum: float = 2.73,
    tau_peak: float = 0.12,
    sigma_velocity: float = 9.0,
    longitude_deg: float = 35.0,
    theta0: float = 220.0,
    samples: int = SPECTRUM_SAMPLES,
) -> tuple[list[dict[str, float]], float]:
    """Return synthetic spectrum rows and the optically-thin NHI estimate."""
    components = galactic_components(longitude_deg, theta0, tau_peak)
    rows: list[dict[str, float]] = []

    for index in range(samples):
        velocity = -VELOCITY_SPAN_KM_S / 2.0 + VELOCITY_SPAN_KM_S * index / (samples - 1)
        tau = 0.0
        for component in components:
            sigma = sigma_velocity * component["width_scale"]
            tau += component["tau"] * math.exp(-0.5 * ((velocity - component["velocity_km_s"]) / sigma) ** 2)
        brightness = (spin_temperature - continuum) * (1.0 - math.exp(-tau))
        thin_brightness = (spin_temperature - continuum) * tau
        rows.append(
            {
                "velocity_km_s": velocity,
                "brightness_temperature_K": brightness,
                "optically_thin_brightness_K": thin_brightness,
                "optical_depth": tau,
            }
        )

    estimates = integrate_columns(rows, spin_temperature)
    return rows, estimates["thin_cm2"]


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "data" / "synthetic_21cm_spectrum.csv"
    output.parent.mkdir(exist_ok=True)
    spin_temperature = 120.0
    rows, column_thin = generate_spectrum(spin_temperature=spin_temperature)
    estimates = integrate_columns(rows, spin_temperature)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["velocity_km_s", "brightness_temperature_K", "optically_thin_brightness_K", "optical_depth"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {output}")
    print(f"N_HI thin = {column_thin:.3e} cm^-2")
    print(f"N_HI uniform slab = {estimates['uniform_slab_cm2']:.3e} cm^-2")

    rotation_output = Path(__file__).resolve().parents[1] / "data" / "tangent_point_table.csv"
    with rotation_output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["longitude_deg", "radius_kpc", "velocity_km_s", "frequency_mhz"])
        writer.writeheader()
        for longitude in range(5, 90):
            writer.writerow(tangent_point(float(longitude), 220.0))
    print(f"Wrote {rotation_output}")


if __name__ == "__main__":
    main()
