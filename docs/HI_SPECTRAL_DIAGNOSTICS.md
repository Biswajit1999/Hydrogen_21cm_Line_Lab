# LAB H I spectral robustness: three observational diagnostics

Three reproducible **descriptive** analyses of the bundled LAB 21-cm Galactic-plane profiles. The original JSON and HI4PI image are not modified.

1. **Brightness-temperature spectral moments**: signed `∫ T_B dv` (retains negative baseline-noise samples), positive area, threshold-selected emission area, velocity centroid, dispersion, peak and negative-channel fraction. Threshold-selected moments are *not* optical-depth-corrected column densities; beam blending, baseline systematics and self-absorption are unmodelled.
2. **Longitude reflection test**: compare the measured spectra at `(+l,+v)` and `(-l,-v)` on the existing symmetric LSR velocity grid. Only genuinely paired longitudes are used, excluding the duplicated `±180°` endpoint and `l=0°`. This is a diagnostic of observed Galactic asymmetry, not a test that the Milky Way must be axisymmetric. Pearson r is undefined for constant spectra.
3. **Threshold/smoothing sensitivity**: cross three brightness floors (0.5, 1.5, 3 K) with four odd-channel boxcar widths (1, 3, 5, 9), reporting changes in integrated selected emission and velocity moments. The boxcar is edge-renormalized and can blur narrow physical components.

Run from the repository root:

```sh
python -m unittest discover -s tests -p 'test_hi_spectral_diagnostics.py' -v
python -m research.run_hi_diagnostics --output results/hi_spectral_diagnostics
```

Expected for the frozen input: 73 longitudes, 601 velocity channels, 35 `±l` pairs and 876 threshold/smoothing rows. Outputs are CSV and a provenance manifest. The analysis does not perform kinematic distance inversion or cloud decomposition, and it must not be used as an independent spiral-arm catalogue.

**Data:** Leiden/Argentine/Bonn Galactic H I survey; reduced spectra and acquisition metadata in `data/observations/lab_plane_profiles.json`. The original observational asset checksum remains protected by existing repository validation.
