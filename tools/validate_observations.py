#!/usr/bin/env python3
"""Validate the reduced observational H I assets bundled for the browser lab."""

from __future__ import annotations

import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OBSERVATIONS = ROOT / "data" / "observations"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    profile_path = OBSERVATIONS / "lab_plane_profiles.json"
    image_path = OBSERVATIONS / "hi4pi_allsky.jpg"
    metadata_path = OBSERVATIONS / "hi4pi_allsky_metadata.json"
    require(profile_path.exists(), "LAB observational profile asset is missing")
    require(image_path.exists(), "HI4PI all-sky image asset is missing")
    require(metadata_path.exists(), "HI4PI metadata asset is missing")

    dataset = json.loads(profile_path.read_text(encoding="utf-8"))
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    velocity = dataset["velocityKmS"]
    profiles = dataset["profiles"]
    longitudes = [profile["longitudeDeg"] for profile in profiles]

    require(dataset["dataset"].startswith("Leiden/Argentine/Bonn"), "LAB identity is absent")
    require(dataset["latitudeDeg"] == 0.0, "plane product must remain at b=0 degrees")
    require(dataset["beamFwhmDeg"] == 0.6, "unexpected LAB extraction beam")
    require(len(profiles) == 73, "expected 73 five-degree longitude profiles")
    require(longitudes == [float(value) for value in range(-180, 181, 5)], "longitude coverage changed")
    require(len(velocity) == 601 and velocity[0] == -300.0 and velocity[-1] == 300.0, "velocity axis changed")
    require(all(velocity[index] < velocity[index + 1] for index in range(len(velocity) - 1)), "velocity axis is not monotonic")

    temperatures = [value for profile in profiles for value in profile["brightnessK"]]
    require(all(math.isfinite(value) for value in temperatures), "non-finite LAB brightness sample")
    require(max(temperatures) > 100, "LAB plane brightness content is unexpectedly weak")
    require(all(len(profile["brightnessK"]) == len(velocity) for profile in profiles), "profile length mismatch")

    image_bytes = image_path.read_bytes()
    require(image_bytes[:2] == b"\xff\xd8", "HI4PI visualisation is not a JPEG")
    require(len(image_bytes) > 10000, "HI4PI visualisation is unexpectedly small")
    require(metadata["dataset"].startswith("HI4PI"), "HI4PI metadata identity is absent")
    require("HI4PI Collaboration" in metadata["credit"], "HI4PI credit is absent")

    print(
        "Validated observational bundle: "
        f"{len(profiles)} LAB profiles x {len(velocity)} channels; "
        f"peak T_B={max(temperatures):.3f} K; HI4PI image={len(image_bytes)} bytes"
    )


if __name__ == "__main__":
    main()
