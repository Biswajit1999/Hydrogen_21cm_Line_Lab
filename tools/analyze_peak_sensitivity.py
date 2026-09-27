"""Audit the heuristic LAB local-maximum catalogue across tuning choices.

This is a descriptive sensitivity calculation, not cloud decomposition or
spiral-arm identification. It mirrors the browser's declared threshold and
merge-radius grid and publishes every baseline candidate for inspection.
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "observations" / "lab_plane_profiles.json"
OUTPUT = ROOT / "data" / "peak_sensitivity.csv"
R0_KPC = 8.2
V0_KM_S = 236.0
THRESHOLDS = (0.04, 0.06, 0.08, 0.10)
MERGE_RADII = (6.0, 8.0, 10.0)


def detect_peaks(velocity, brightness, threshold_fraction=0.06, merge_radius=8.0):
    noise_floor = max(1.5, max(brightness) * threshold_fraction)
    candidates = []
    for index in range(2, len(brightness) - 2):
        value = brightness[index]
        if value < noise_floor:
            continue
        if (value >= brightness[index - 1] and value >= brightness[index + 1]
                and value > brightness[index - 2] and value > brightness[index + 2]):
            candidates.append((velocity[index], value))
    retained = []
    for candidate in sorted(candidates, key=lambda item: item[1], reverse=True):
        if not any(abs(candidate[0] - kept[0]) < merge_radius for kept in retained):
            retained.append(candidate)
    return sorted(retained)[:6]


def implied_radius(velocity_km_s, longitude_deg):
    sine = math.sin(math.radians(longitude_deg))
    if abs(sine) < 0.05:
        return None
    denominator = 1 + velocity_km_s / (V0_KM_S * sine)
    return None if denominator <= 0.05 else R0_KPC / denominator


def distance_solutions(radius_kpc, longitude_deg):
    if radius_kpc is None:
        return []
    longitude = math.radians(longitude_deg)
    discriminant = radius_kpc**2 - (R0_KPC * math.sin(longitude)) ** 2
    if discriminant < 0:
        return []
    projected, root = R0_KPC * math.cos(longitude), math.sqrt(discriminant)
    return sorted({round(value, 12) for value in (projected - root, projected + root) if value >= 0})


def main():
    dataset = json.loads(INPUT.read_text(encoding="utf-8"))
    velocity = dataset["velocityKmS"]
    rows = []
    for profile in dataset["profiles"]:
        longitude = profile["longitudeDeg"]
        brightness = profile["brightnessK"]
        configuration_peaks = [
            detect_peaks(velocity, brightness, threshold, merge)
            for threshold in THRESHOLDS for merge in MERGE_RADII
        ]
        for peak_velocity, peak_brightness in detect_peaks(velocity, brightness):
            selected = sum(
                any(abs(candidate_velocity - peak_velocity) <= 3 for candidate_velocity, _ in peaks)
                for peaks in configuration_peaks
            )
            radius = implied_radius(peak_velocity, longitude)
            distances = distance_solutions(radius, longitude)
            rows.append({
                "longitude_deg": longitude,
                "peak_velocity_km_s": peak_velocity,
                "peak_brightness_k": peak_brightness,
                "galactocentric_radius_kpc": "" if radius is None else radius,
                "heliocentric_distance_solutions_kpc": ";".join(f"{value:.6f}" for value in distances),
                "distance_solution_count": len(distances),
                "selection_count": selected,
                "configuration_count": len(configuration_peaks),
                "stability_fraction": selected / len(configuration_peaks),
            })
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0])
        writer.writeheader()
        writer.writerows(rows)
    stable = sum(row["stability_fraction"] == 1 for row in rows)
    ambiguous = sum(row["distance_solution_count"] == 2 for row in rows)
    print(f"Wrote {len(rows)} baseline candidates; {stable} stable in all 12 settings; "
          f"{ambiguous} have two model distance solutions")
    return rows


if __name__ == "__main__":
    main()
