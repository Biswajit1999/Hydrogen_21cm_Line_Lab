"""Analytic invariants for H I velocity and rotation geometry."""
import math
from research.hi21cm_kinematics import (
    REST_MHZ, velocity_to_frequency, frequency_to_velocity,
    rotation_radius, distance_solutions, radius_velocity_sensitivity,
)


def test_doppler_inverse():
    for relativistic in (False, True):
        for velocity in (-200.0, 0.0, 200.0):
            assert math.isclose(frequency_to_velocity(velocity_to_frequency(velocity, relativistic=relativistic), relativistic=relativistic), velocity, abs_tol=1e-7)
    assert velocity_to_frequency(0) == REST_MHZ


def test_radius_and_ambiguity():
    assert math.isclose(rotation_radius(0, 45), 8.2)
    assert rotation_radius(25, 0) is None
    assert len(distance_solutions(4, 30)) == 0
    assert len(distance_solutions(7, 30)) == 2


def test_radius_uncertainty():
    v, l, sigma = 25.0, 60.0, 0.1
    derivative = (rotation_radius(v + sigma, l) - rotation_radius(v - sigma, l)) / (2 * sigma)
    assert math.isclose(radius_velocity_sensitivity(v, l, sigma), abs(derivative) * sigma, rel_tol=1e-5)
