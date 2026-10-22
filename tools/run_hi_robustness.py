"""Reproduce conditional diagnostics on the bundled real LAB plane profiles.

Usage: python -m tools.run_hi_robustness --longitude 30 --output results/hi_robustness.json
No archive download or external dependency is required. Does not modify survey assets.
"""
from __future__ import annotations

import argparse
import json
import math
from dataclasses import asdict
from pathlib import Path
from statistics import median

from tools.hi_robustness import (
    column_density_with_noise,
    distance_sensitivity,
    rebin_piecewise_linear,
)

ROOT = Path(__file__).resolve().parents[1]


def analyse_profile(data: dict, longitude: float) -> dict:
    profiles = data["profiles"]
    selected = next((p for p in profiles if float(p["longitudeDeg"]) == longitude), None)
    if selected is None:
        raise ValueError("longitude must match an observed LAB sightline; no interpolation is performed")
    velocity = [float(x) for x in data["velocityKmS"]]
    brightness = [float(x) for x in selected["brightnessK"]]
    off_line = [b for v, b in zip(velocity, brightness) if abs(v) >= 250]
    baseline = median(off_line)
    mad = median(abs(x - baseline) for x in off_line)
    sigma = max(1.4826 * mad, 1e-9)
    # The off-line channels are assumed signal-free for this *diagnostic only*.
    # This is not an empirical estimate of the LAB covariance or opacity.
    band = (-200.0, 200.0)
    columns = {str(rho): asdict(column_density_with_noise(
        velocity, brightness, *band, channel_sigma_k=sigma, rho=rho,
        baseline_k=baseline, baseline_sigma_k=sigma / math.sqrt(len(off_line))))
        for rho in (0.0, 0.3, 0.6)}
    rebinned = rebin_piecewise_linear(velocity, brightness, list(range(-200, 201, 10)))
    peak_index = max((i for i, v in enumerate(velocity) if -200 <= v <= 200),
                     key=lambda i: brightness[i])
    return {
        "dataset": data.get("dataset"), "kind": "real LAB survey profile; model-conditional diagnostics",
        "longitude_deg": longitude, "n_channels": len(velocity),
        "off_line_assumption": "|v| >= 250 km/s treated as line-free; verify per sightline",
        "baseline_k": baseline, "off_line_robust_sigma_k": sigma,
        "column_density_optically_thin": columns,
        "rebinned_area_k_kms": sum(10.0 * value for value in rebinned),
        "peak_velocity_km_s": velocity[peak_index],
        "distance_flat_rotation_assumptions": asdict(distance_sensitivity(
            velocity[peak_index], longitude, sigma_velocity_km_s=2.0,
            sigma_r0_kpc=0.1, sigma_v0_km_s=5.0, n_draws=2000)),
        "limitations": ["No opacity correction", "No observed channel covariance",
                        "Peak is not a decomposed cloud", "Near/far degeneracy unresolved"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--longitude", type=float, default=30.0)
    parser.add_argument("--input", type=Path,
                        default=ROOT / "data/observations/lab_plane_profiles.json")
    parser.add_argument("--output", type=Path, default=ROOT / "results/hi_robustness.json")
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    result = analyse_profile(data, args.longitude)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote conditional LAB diagnostics for l={args.longitude:g} deg: {args.output}")


if __name__ == "__main__":
    main()
