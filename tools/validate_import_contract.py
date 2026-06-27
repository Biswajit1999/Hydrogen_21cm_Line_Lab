"""Small deterministic check for the documented observed-spectrum CSV contract."""
from __future__ import annotations

import csv
import re
from io import StringIO

COLUMN_FACTOR = 1.823e18
VELOCITY_COLUMNS = {"velocity_km_s", "velocity", "v_lsr_km_s", "v_lsr", "v_km_s", "v"}
TEMPERATURE_COLUMNS = {"brightness_temperature_k", "brightness_temperature", "tb_k", "t_b_k", "temperature_k", "temperature", "tb"}


def normalise(header: str) -> str:
    value = header.strip().lower().lstrip("\ufeff")
    value = re.sub(r"[\s()\[\]{}]", "_", value)
    value = re.sub(r"[^a-z0-9_]", "", value)
    value = re.sub(r"_+", "_", value)
    return value.strip("_")


def parse_csv(text: str) -> list[tuple[float, float]]:
    reader = csv.DictReader(StringIO(text))
    if reader.fieldnames is None:
        raise ValueError("missing header")
    fields = {normalise(name): name for name in reader.fieldnames}
    velocity = next((fields[name] for name in VELOCITY_COLUMNS if name in fields), None)
    temperature = next((fields[name] for name in TEMPERATURE_COLUMNS if name in fields), None)
    if velocity is None or temperature is None:
        raise ValueError("velocity and brightness-temperature columns are required")
    points = sorted((float(row[velocity]), float(row[temperature])) for row in reader)
    if len(points) < 3:
        raise ValueError("at least three rows are required")
    return points


def thin_column(points: list[tuple[float, float]]) -> float:
    integral = sum(0.5 * (t0 + t1) * (v1 - v0) for (v0, t0), (v1, t1) in zip(points, points[1:]))
    return COLUMN_FACTOR * integral


def main() -> None:
    points = parse_csv("velocity_km_s,brightness_temperature_K\n0,1\n1,1\n2,1\n")
    unit_bearing_points = parse_csv("v_LSR [km/s],Tb (K)\n0,1\n1,1\n2,1\n")
    column = thin_column(points)
    assert column == 2 * COLUMN_FACTOR
    assert unit_bearing_points == points
    try:
        parse_csv("velocity_km_s,flux\n0,1\n1,1\n2,1\n")
    except ValueError:
        pass
    else:
        raise AssertionError("missing temperature column should be rejected")
    print(f"PASS CSV import contract: {len(points)} rows, unit-bearing aliases accepted, N_HI thin = {column:.3e} cm^-2")


if __name__ == "__main__":
    main()
