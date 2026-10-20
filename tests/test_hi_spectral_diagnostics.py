import math
import unittest
from research.hi_spectral_diagnostics import (
    spectral_moments, longitude_reflection_diagnostics, boxcar_smooth,
    threshold_smoothing_sensitivity,
)


class SpectralDiagnosticsTests(unittest.TestCase):
    def test_flat_top_centroid(self):
        result=spectral_moments([-2,-1,0,1,2],[0,2,2,2,0],1)
        self.assertAlmostEqual(result["centroid_km_s"],0)
        self.assertAlmostEqual(result["selected_integral_k_km_s"],6)
        self.assertAlmostEqual(result["signed_integral_k_km_s"],6)

    def test_negative_baseline_preserved(self):
        result=spectral_moments([-1,0,1],[-2,3,-2],1)
        self.assertAlmostEqual(result["signed_integral_k_km_s"],1)
        self.assertAlmostEqual(result["selected_integral_k_km_s"],3)
        self.assertAlmostEqual(result["negative_channel_fraction"],2/3)

    def test_empty_emission(self):
        result=spectral_moments([-1,0,1],[0,0,0],1)
        self.assertIsNone(result["centroid_km_s"])
        self.assertIsNone(result["width_km_s"])

    def test_moment_shift(self):
        result=spectral_moments([-1,0,1],[0,0,2],0)
        self.assertAlmostEqual(result["centroid_km_s"],1)
        self.assertAlmostEqual(result["width_km_s"],0)

    def test_nonmonotonic_rejected(self):
        with self.assertRaises(ValueError): spectral_moments([0,2,1],[1,1,1])

    def test_symmetric_longitude_pair(self):
        profiles=[{"longitudeDeg":-10,"brightnessK":[1,2,3,4,5]},
                  {"longitudeDeg":10,"brightnessK":[5,4,3,2,1]}]
        result=longitude_reflection_diagnostics([-2,-1,0,1,2],profiles,1)
        self.assertEqual(len(result),1)
        self.assertAlmostEqual(result[0]["reflection_rms_difference_k"],0)
        self.assertAlmostEqual(result[0]["reflection_pearson_r"],1)
        self.assertAlmostEqual(result[0]["signed_integral_difference_k_km_s"],0)

    def test_asymmetric_pair(self):
        profiles=[{"longitudeDeg":-10,"brightnessK":[0,0,0]},
                  {"longitudeDeg":10,"brightnessK":[2,2,2]}]
        result=longitude_reflection_diagnostics([-1,0,1],profiles,1)
        self.assertAlmostEqual(result[0]["reflection_rms_difference_k"],2)
        self.assertIsNone(result[0]["reflection_pearson_r"])

    def test_asymmetric_velocity_rejected(self):
        with self.assertRaises(ValueError): longitude_reflection_diagnostics([-1,0,2],[])

    def test_boxcar_preserves_constant_edges(self):
        self.assertEqual(boxcar_smooth([3,3,3,3],3),[3,3,3,3])

    def test_boxcar_invalid_even(self):
        with self.assertRaises(ValueError): boxcar_smooth([1,2,3],2)

    def test_threshold_monotonic_area(self):
        out=threshold_smoothing_sensitivity([-2,-1,0,1,2],[0,1,3,1,0],(0,1.5,3.5),(1,))
        self.assertEqual(len(out),3)
        self.assertGreater(out[0]["selected_integral_k_km_s"],out[1]["selected_integral_k_km_s"])
        self.assertEqual(out[2]["selected_integral_k_km_s"],0)

    def test_smoothing_sensitivity_length(self):
        out=threshold_smoothing_sensitivity([-1,0,1],[0,2,0])
        self.assertEqual(len(out),12)
        self.assertTrue(all(math.isfinite(r["selected_integral_k_km_s"]) for r in out))

if __name__=="__main__": unittest.main()
