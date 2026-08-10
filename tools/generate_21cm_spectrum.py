"""Generate a Galactic-rotation synthetic neutral-hydrogen 21 cm spectrum."""

from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from pathlib import Path

REST_FREQUENCY_MHZ = 1420.40575177
SPEED_OF_LIGHT_KM_S = 299792.458


@dataclass(frozen=True)
class Galaxy:
    longitude_degrees: float = 32.0
    path_length_kpc: float = 24.0
    solar_radius_kpc: float = 8.2
    local_speed_km_s: float = 236.0
    disk_scale_kpc: float = 3.5
    spiral_contrast: float = 0.55
    velocity_dispersion_km_s: float = 7.0
    brightness_k_per_kpc: float = 38.0


def rotation_speed(radius_kpc: float, galaxy: Galaxy) -> float:
    return galaxy.local_speed_km_s


def radial_velocity(radius_kpc: float, longitude_radians: float, galaxy: Galaxy) -> float:
    if radius_kpc < 0.04:
        return 0.0
    return (
        rotation_speed(radius_kpc, galaxy) * galaxy.solar_radius_kpc / radius_kpc
        - galaxy.local_speed_km_s
    ) * math.sin(longitude_radians)


def doppler_frequency(velocity_km_s: float) -> float:
    return REST_FREQUENCY_MHZ * (1.0 - velocity_km_s / SPEED_OF_LIGHT_KM_S)


def density(x_kpc: float, y_kpc: float, galaxy: Galaxy) -> float:
    radius = math.hypot(x_kpc, y_kpc)
    radial = math.exp(-(radius - galaxy.solar_radius_kpc) / galaxy.disk_scale_kpc)
    central_hole = 1.0 - math.exp(-(radius / 2.4) ** 2)
    theta = math.atan2(y_kpc, x_kpc)
    phase = 2.0 * (theta - math.log(max(radius, 0.3) / galaxy.solar_radius_kpc) / math.tan(0.22))
    arms = 1.0 + galaxy.spiral_contrast * ((1.0 + math.cos(phase)) / 2.0) ** 3
    return max(0.0, radial * central_hole * arms)


def generate_spectrum(galaxy: Galaxy = Galaxy(), bins: int = 512) -> list[dict[str, float]]:
    velocities = [-300.0 + index * 600.0 / (bins - 1) for index in range(bins)]
    brightness = [0.0] * bins
    longitude = math.radians(galaxy.longitude_degrees)
    path_steps = 180
    distance_step = galaxy.path_length_kpc / path_steps
    for index in range(path_steps):
        distance = (index + 0.5) * distance_step
        x = galaxy.solar_radius_kpc - distance * math.cos(longitude)
        y = distance * math.sin(longitude)
        radius = math.hypot(x, y)
        centre_velocity = radial_velocity(radius, longitude, galaxy)
        weight = (
            density(x, y, galaxy)
            * galaxy.brightness_k_per_kpc
            * distance_step
            / (math.sqrt(2.0 * math.pi) * galaxy.velocity_dispersion_km_s)
        )
        for bin_index, velocity in enumerate(velocities):
            brightness[bin_index] += weight * math.exp(
                -0.5 * ((velocity - centre_velocity) / galaxy.velocity_dispersion_km_s) ** 2
            )
    return [
        {
            "velocity_lsr_km_s": velocity,
            "frequency_mhz": doppler_frequency(velocity),
            "brightness_temperature_k": brightness[index],
        }
        for index, velocity in enumerate(velocities)
    ]


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "data" / "synthetic_21cm_spectrum.csv"
    rows = generate_spectrum()
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    peak = max(rows, key=lambda row: row["brightness_temperature_k"])
    print(
        f"Wrote {len(rows)} channels to {output}; peak at "
        f"{peak['velocity_lsr_km_s']:.2f} km/s ({peak['frequency_mhz']:.6f} MHz)"
    )


if __name__ == "__main__":
    main()
