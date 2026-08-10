#!/usr/bin/env python3
"""Build compact observational H I assets from public LAB and HI4PI products."""

from __future__ import annotations

import json
from bisect import bisect_left
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "observations"
LAB_DOWNLOAD = "https://www.astro.uni-bonn.de/hisurvey/euhou/LABprofile/download.php"
HI4PI_IMAGE = (
    "https://www.mpifr-bonn.mpg.de/4066377/original-1518434937.jpg"
    "?t=ZXlKM2FXUjBhQ0k2T0RRNExDSm1hV3hsWDJWNGRHVnVjMmx2YmlJNkltcHdaeUlz"
    "SW05aWFsOXBaQ0k2TkRBMk5qTTNOMzA9LS0zZmVlY2Y5ZDNlMjYwYzcwNThkOTU5"
    "ZjFhYzU2YzA5YjVmNTMyYWVj"
)


def retrieve(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "H21-Lab observational asset builder/1.0"})
    with urlopen(request, timeout=90) as response:
        return response.read()


def profile_url(longitude: float) -> str:
    parameters = {
        "ral": f"{longitude:.2f}",
        "decb": "0.00",
        "csys": "0",
        "beam": "0.60",
    }
    return f"{LAB_DOWNLOAD}?{urlencode(parameters)}"


def parse_profile(payload: str) -> tuple[list[float], list[float], list[float], str]:
    velocity = []
    brightness = []
    frequency = []
    header = ""
    for line in payload.splitlines():
        if line.startswith("%  ") and "interpolated" not in line and "AIfA" not in line:
            header = line.strip("% ")
        if not line.strip() or line.lstrip().startswith("%"):
            continue
        columns = line.split()
        if len(columns) >= 3:
            velocity.append(round(float(columns[0]), 2))
            brightness.append(round(float(columns[1]), 3))
            frequency.append(round(float(columns[2]), 6))
    if not velocity:
        raise ValueError("LAB profile response contained no spectral samples")
    return velocity, brightness, frequency, header


def interpolate(values_x: list[float], values_y: list[float], target_x: list[float]) -> list[float]:
    interpolated = []
    for sample in target_x:
        upper = bisect_left(values_x, sample)
        if upper <= 0:
            value = values_y[0]
        elif upper >= len(values_x):
            value = values_y[-1]
        else:
            lower = upper - 1
            fraction = (sample - values_x[lower]) / (values_x[upper] - values_x[lower])
            value = values_y[lower] + fraction * (values_y[upper] - values_y[lower])
        interpolated.append(round(value, 3))
    return interpolated


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    longitudes = [float(value) for value in range(-180, 181, 5)]
    common_velocity = [float(value) for value in range(-300, 301)]
    rest_frequency_mhz = 1420.40575177
    light_speed_km_s = 299792.458
    common_frequency = [
        round(rest_frequency_mhz * (1.0 - value / light_speed_km_s), 6)
        for value in common_velocity
    ]
    profiles = []

    for longitude in longitudes:
        payload = retrieve(profile_url(longitude)).decode("ascii", errors="replace")
        velocity, brightness, _, _ = parse_profile(payload)
        profiles.append({
            "longitudeDeg": longitude,
            "brightnessK": interpolate(velocity, brightness, common_velocity),
        })
        print(
            f"Retrieved LAB l={longitude:6.1f} deg ({len(brightness)} native channels; "
            f"resampled to {len(common_velocity)})"
        )

    dataset = {
        "dataset": "Leiden/Argentine/Bonn (LAB) Galactic H I Survey",
        "product": "Galactic-plane brightness-temperature profiles",
        "beamFwhmDeg": 0.6,
        "latitudeDeg": 0.0,
        "velocityKmS": common_velocity,
        "frequencyMHz": common_frequency,
        "profiles": profiles,
        "provenance": {
            "service": "AIfA EU-HOU LAB profile extraction service",
            "serviceUrl": "https://www.astro.uni-bonn.de/hisurvey/euhou/LABprofile/",
            "query": "Galactic coordinates, b=0.00 deg, FWHM=0.60 deg, l=-180..180 deg in 5 deg increments",
            "processing": (
                "Native LSR-calibrated LAB channels were linearly resampled to a "
                "common -300 to +300 km/s grid at 1 km/s intervals for display."
            ),
            "citation": (
                "Kalberla, P.M.W. et al., 2005. The Leiden/Argentine/Bonn (LAB) "
                "Survey of Galactic HI. Astronomy & Astrophysics, 440, pp.775-782."
            ),
        },
    }
    output_path = DATA_DIR / "lab_plane_profiles.json"
    output_path.write_text(json.dumps(dataset, separators=(",", ":")), encoding="utf-8")

    image_path = DATA_DIR / "hi4pi_allsky.jpg"
    image_path.write_bytes(retrieve(HI4PI_IMAGE))
    image_metadata = {
        "dataset": "HI4PI full-sky H I survey",
        "product": "Official public all-sky visualisation of H I line emission",
        "imageFile": image_path.name,
        "sourcePage": "https://www.mpifr-bonn.mpg.de/pressreleases/2016/13",
        "credit": "HI4PI Collaboration",
        "citation": (
            "HI4PI Collaboration, 2016. HI4PI: A full-sky HI survey based on EBHIS "
            "and GASS. Astronomy & Astrophysics, 594, A116."
        ),
        "interpretation": (
            "This is an observed sky projection from the Solar position, not a "
            "face-on map of the Galactic disk."
        ),
    }
    (DATA_DIR / "hi4pi_allsky_metadata.json").write_text(
        json.dumps(image_metadata, indent=2), encoding="utf-8"
    )
    print(f"Wrote {output_path}")
    print(f"Wrote {image_path}")


if __name__ == "__main__":
    main()
