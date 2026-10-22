"""Analytic and seeded negative-control tests for optically thin LAB diagnostics."""
import unittest

from tools.hi_robustness import (
    COLUMN_FACTOR, column_density_with_noise, distance_sensitivity,
    integration_weights, rebin_piecewise_linear,
)


class HiRobustnessTests(unittest.TestCase):
    def test_constant_spectrum_exact_area_irregular_grid(self):
        v = [-4.0, -1.0, 2.0, 5.0]
        result = column_density_with_noise(v, [3.0] * 4, -2, 4,
                                           channel_sigma_k=0.0)
        self.assertAlmostEqual(result.integrated_brightness_k_kms, 18.0)
        self.assertAlmostEqual(result.column_density_cm2, 18 * COLUMN_FACTOR)

    def test_linear_spectrum_fractional_edges(self):
        v = [0, 2, 5]
        self.assertAlmostEqual(sum(a*b for a,b in zip(
            integration_weights(v, 0.5, 4.0), v)), (4.0**2 - 0.5**2)/2)

    def test_ar1_variance_matches_brute_force(self):
        v = [0, 1, 2, 3, 4]
        sig = [1, 2, 1.5, 0.5, 1]
        w = integration_weights(v, 0.5, 3.5)
        rho = -0.35
        expected = sum(w[i]*sig[i]*w[j]*sig[j]*rho**abs(i-j)
                       for i in range(5) for j in range(5))
        result = column_density_with_noise(v, [1]*5, 0.5, 3.5,
                                           channel_sigma_k=sig, rho=rho)
        self.assertAlmostEqual(result.sigma_integrated_k_kms**2, expected, places=11)

    def test_common_mode_baseline_does_not_average_down(self):
        v = [0, 1, 2]
        r = column_density_with_noise(v, [0]*3, 0, 2, channel_sigma_k=0,
                                      baseline_sigma_k=0.5)
        self.assertAlmostEqual(r.sigma_integrated_k_kms, 1.0)

    def test_negative_noise_not_censored(self):
        r = column_density_with_noise([0, 1], [-2, -2], 0, 1,
                                      channel_sigma_k=0.1)
        self.assertLess(r.column_density_cm2, 0)

    def test_flux_conserving_rebin(self):
        v = [-3, -1, 0, 2, 6]
        y = [2, 5, 1, 8, 3]
        edges = [-3, -2, 0.4, 3, 6]
        out = rebin_piecewise_linear(v, y, edges)
        rebinned = sum((b-a)*z for a,b,z in zip(edges, edges[1:], out))
        expected = sum(w*z for w,z in zip(integration_weights(v,-3,6),y))
        self.assertAlmostEqual(rebinned, expected, places=12)

    def test_invalid_inputs_rejected(self):
        with self.assertRaises(ValueError):
            integration_weights([1, 0], 0, 1)
        with self.assertRaises(ValueError):
            column_density_with_noise([0, 1], [1, 2], 0, 1,
                                      channel_sigma_k=1, rho=1)
        with self.assertRaises(ValueError):
            rebin_piecewise_linear([0, 1], [2, 3], [0, 0.5, 0.2])

    def test_kinematic_near_far_and_seed(self):
        a = distance_sensitivity(50, 30, sigma_velocity_km_s=2,
                                 sigma_r0_kpc=0.1, sigma_v0_km_s=5,
                                 n_draws=500, seed=9)
        b = distance_sensitivity(50, 30, sigma_velocity_km_s=2,
                                 sigma_r0_kpc=0.1, sigma_v0_km_s=5,
                                 n_draws=500, seed=9)
        self.assertEqual(a, b)
        self.assertEqual(a.n_two_solutions, 500)
        self.assertLess(a.near_quantiles_kpc[1], a.far_quantiles_kpc[1])

    def test_single_outer_galaxy_solution_not_called_near(self):
        r = distance_sensitivity(-50, 120, sigma_velocity_km_s=0, n_draws=10)
        self.assertEqual(r.n_one_solution, 10)
        self.assertIsNone(r.near_quantiles_kpc)
        self.assertIsNotNone(r.single_quantiles_kpc)

    def test_radial_sightline_not_invertible(self):
        r = distance_sensitivity(20, 0, sigma_velocity_km_s=2, n_draws=20)
        self.assertEqual(r.n_valid, 0)
        self.assertIsNone(r.near_quantiles_kpc)


if __name__ == "__main__":
    unittest.main()
