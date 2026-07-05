# Hydrogen 21 cm Line Science Validation Contract

This repository is a synthetic teaching model for neutral-hydrogen 21 cm spectroscopy. Visual panels must preserve physical truth: plotted brightness, optical depth, frequency markers, and longitude-velocity structure must be labelled as synthetic or idealised unless they are generated from observational data.

The dashboard is allowed to look polished, but it must never imply a survey cube, a distance-resolved Milky Way reconstruction, or fitted physical parameters that the code has not computed.

## Constants and unit conventions

The model uses the neutral-hydrogen hyperfine rest frequency:

```text
nu_0 = 1420.40575177 MHz
```

This corresponds to a vacuum wavelength close to 21.106 cm. Frequencies are in MHz, velocities are in km/s, brightness temperatures are in K, and H I column density is reported in cm^-2.

## Redshift and velocity

Cosmological redshift is represented by:

```text
nu_obs = nu_0 / (1 + z)
```

The three velocity labels used for convention comparison are:

```text
v_radio        = c z / (1 + z)
v_optical      = c z
v_relativistic = c [((1 + z)^2 - 1) / ((1 + z)^2 + 1)]
```

For positive non-zero redshift, the required ordering is:

```text
v_radio < v_relativistic < v_optical
```

The local radio velocity frequency coordinate is:

```text
v_radio = c (nu_0 - nu_obs) / nu_0
nu_obs = nu_0 (1 - v_radio / c)
```

This radio convention is appropriate for nearby, non-relativistic velocity demonstrations. It is not the optical velocity convention and is not the full relativistic Doppler relation.

## Radiative-transfer slab

For a uniform spin-temperature slab against a continuum background, the current teaching model uses:

```text
T_B(v) = (T_s - T_c) [1 - exp(-tau(v))]
```

Required behaviour:

1. `T_B >= 0` when `T_s > T_c` and `tau >= 0`.
2. `T_B <= T_s - T_c` for all finite positive optical depths.
3. In the optically thin limit, `(1 - exp(-tau)) / tau -> 1`.
4. Brightness temperature is monotonic with optical depth for fixed `T_s > T_c`.

The visualisation must not imply that this simple slab captures self-absorption, mixed temperature phases, calibration effects, beam dilution, or baseline subtraction.

## H I column density

For optically thin emission, the model uses:

```text
N_HI = 1.823e18 integral T_B(v) dv  cm^-2
```

with `T_B` in K and `dv` in km/s. This should be labelled as an optically thin estimate, not a general solution for arbitrary optical depth.

The uniform-slab comparison is:

```text
N_HI_slab = 1.823e18 T_s integral tau(v) dv  cm^-2
```

At high optical depth, the slab estimate must exceed the optically thin estimate because brightness saturation causes the thin integral to undercount column density.

## Galactic rotation and longitude-velocity panels

The browser uses a simplified circular-rotation motivation:

```text
v_los = [Theta(R) R0/R - Theta0] sin(l)
```

The tangent-point diagnostic is only valid for the idealised inner-Galaxy circular-rotation case:

```text
0 deg < longitude < 90 deg
R_tan = R0 |sin(l)|
v_tan = Theta0 [1 - |sin(l)|]
```

For longitudes outside this interval, the model must report no tangent velocity/frequency rather than extrapolating a fake value.

The synthetic components are illustrative and are not fitted to a real Milky Way mass model, gas distribution, telescope beam, or survey cube. The longitude-velocity heat map is a synthetic diagnostic, not an observational data product.

## Synthetic versus observed data

Synthetic model output and imported user spectra must remain visually and semantically distinct. Imported spectra may be integrated with the optically thin equation only. The browser must not infer optical depth, spin temperature, source association, Galactic coordinates, distance, or a 3D location from a 1D import.

## Required validation checks

The validation suite should check:

1. `z = 0` returns the rest frequency.
2. Positive redshift lowers the observed frequency.
3. Radio, relativistic, and optical velocity conventions are ordered correctly for positive redshift.
4. The radio velocity and frequency formulas are inverse-consistent in the non-relativistic domain.
5. The optically thin brightness approximation converges as optical depth approaches zero.
6. Brightness temperature is monotonic with optical depth for fixed `T_s > T_c`.
7. Brightness temperature remains bounded by `T_s - T_c`.
8. Integrated column density scales linearly with line amplitude in the optically thin regime.
9. A wider Gaussian line with the same peak optical depth produces a larger integrated column density.
10. At high optical depth, the uniform-slab column estimate exceeds the optically thin estimate.
11. The synthetic velocity grid remains ordered and channel-count stable.
12. Inner-Galaxy tangent radius follows `R_t = R0 |sin(l)|` for the simplified geometry.
13. Non-inner-Galaxy longitudes produce no tangent-point solution.
14. Synthetic panels remain clearly labelled as idealised or synthetic.

## Validation command

Run after scientific, documentation, or visual changes:

```bash
python tools/generate_21cm_spectrum.py
python tools/validate_model.py
python tools/validate_velocity_conventions.py
python tools/validate_import_contract.py
python tools/validate_science_contract.py
node tools/validate_browser_contract.js
node tools/validate_dashboard_contract.js
node tools/validate_fits_import.js
```

`tools/validate_science_contract.py` writes `data/science_contract_summary.csv` and fails if any invariant above is broken.

## Next scientific gap

The next defensible upgrade is to add provenance metadata to every rendered panel so the UI can explicitly distinguish synthetic model fields, browser-local imported spectra, and derived estimates. That should happen before any animation or rendering polish.
