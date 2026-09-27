"""Regression checks for the declared peak-sensitivity analysis."""

import math

from analyze_peak_sensitivity import distance_solutions, implied_radius, main


def require(condition, message):
    if not condition:
        raise AssertionError(message)


rows = main()
require(rows, "peak-sensitivity table is empty")
require(all(0 <= row["stability_fraction"] <= 1 for row in rows), "invalid stability fraction")
require(all(row["configuration_count"] == 12 for row in rows), "configuration grid changed")
require(implied_radius(20, 0) is None, "radial sightline should be undefined")
radius = implied_radius(50, 30)
require(radius is not None and radius < 8.2, "positive inner-Galaxy velocity should imply R < R0")
solutions = distance_solutions(radius, 30)
require(len(solutions) == 2 and solutions[0] < solutions[1], "near/far ambiguity not preserved")
require(all(math.isfinite(float(value)) for row in rows for value in (
    row["longitude_deg"], row["peak_velocity_km_s"], row["peak_brightness_k"]
)), "non-finite candidate value")
print("Peak sensitivity and kinematic-geometry checks passed.")
