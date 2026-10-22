# LAB H I conditional uncertainty and channel-integration study

This independent, stdlib-only Python analysis complements the existing heuristic peak-stability audit. It does not modify the browser or infer clouds/spiral arms.

## Three questions

1. **Column density / correlated channel errors.** Piecewise-linear integration with fractional channel boundaries returns the optically thin proxy `N_HI = 1.8224e18 ∫ T_B dv` (cm^-2). An explicitly *assumed* AR(1) channel covariance, `Cov(e_i,e_j)=sigma_i sigma_j rho^|i-j|`, is propagated as `w^T C w` with an O(n) recurrence. A separately assumed shared baseline offset contributes `sigma_baseline^2 (Σw)^2`. The off-line noise estimator in the runner is a scenario, not a measured LAB covariance. This estimate is not valid for optically thick emission without an opacity model.
2. **Velocity-channel rebinning.** Piecewise-linear, area-conserving bin averages allow coarser spectra to be compared without changing the integrated signal over the same band. This does not preserve peak heights or resolve blended clouds.
3. **Kinematic-distance sensitivity.** Seeded independent Gaussian draws in velocity, `R0` and `V0` propagate through the *flat circular rotation* model. The near and far branches remain separate, and one-solution sightlines have a separate single-solution distribution; the output reports invalid geometry and branch-conditional quantiles. This does not resolve the near/far degeneracy or model noncircular motions.

## Reproduce

```bash
python -m unittest discover -s tests -p 'test_hi_robustness.py' -v
python -m tools.run_hi_robustness --longitude 30 --output results/hi_robustness.json
```

The runner reads the **existing frozen LAB 73-sightline observational JSON**, selects an actual stored longitude (no interpolation), and writes a local JSON diagnostic. It does not alter the source or observational checksum. Its off-line assumption (`|v|>=250 km/s` is signal-free) must be verified per sightline. The selected brightest spectral channel is not a uniquely identified cloud. Output is intentionally not committed as a new measurement.

Synthetic tests cover exact integrals, correlated covariance versus brute force, negative baseline-noise preservation, flux-conserving rebinning, deterministic near/far propagation, and invalid radial sightlines. The tests alone do not validate the flat-rotation model against Galactic dynamics.
