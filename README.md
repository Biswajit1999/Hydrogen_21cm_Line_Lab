# Hydrogen 21 cm Line Lab

Interactive radio-astronomy laboratory for the neutral-hydrogen 21 cm hyperfine line, cosmological frequency shift, spectral-coordinate conventions, synthetic Galactic H I structure, radiative transfer, column-density approximations, and explicitly labelled spectrum overlays.

**Author:** Biswajit Jana

## Research Motivation

The H I 21 cm line is a major diagnostic of neutral gas in the Milky Way and external galaxies. This project is a browser-based scientific explainer: it separates the frequency-redshift relation from local velocity conventions, then uses a deliberately synthetic Galactic model to explore spectra, longitude-velocity structure, and optical-depth effects.

## Scientific Model

The rest frequency is

```text
nu_0 = 1420.40575177 MHz
```

For a cosmological redshift,

```text
nu_obs = nu_0 / (1 + z)
```

The browser reports three coordinate conventions for the same redshift:

```text
v_radio        = c z / (1 + z)
v_optical      = c z
v_relativistic = c [((1 + z)^2 - 1) / ((1 + z)^2 + 1)]
```

These are alternative ways to label a spectrum. A cosmological redshift is not automatically a local peculiar velocity.

The synthetic slab uses

```text
T_B(v) = (T_s - T_c) [1 - exp(-tau(v))]
```

and compares two model-dependent column-density quantities:

```text
N_HI thin = 1.823e18 integral T_B(v) dv
N_HI slab = 1.823e18 T_s integral tau(v) dv
```

The first is the optically thin approximation. The second is exact only within the project's uniform-slab spin-temperature and optical-depth assumptions.

A simplified axisymmetric rotation relation motivates the synthetic longitude-dependent components:

```text
v_los = [Theta(R) R0/R - Theta0] sin(l)
```

## Reproducibility contract

The browser and Python generator now share the same deterministic synthetic-spectrum contract:

```text
rest frequency     = 1420.40575177 MHz
velocity span      = 360 km/s
spectrum channels  = 520
N_HI thin factor   = 1.823e18 cm^-2 per K km/s
```

`tools/validate_model.py` checks the physical equations, velocity convention ordering, tangent-point behaviour, optical-depth limits, velocity span, and channel count. `tools/validate_velocity_conventions.py` independently checks that radio, optical, and relativistic spectral-coordinate labels agree at very low redshift, diverge at high redshift, and remain inverse-consistent with the rest-frequency relation where applicable. `tools/validate_browser_contract.js` statically guards the browser implementation against drifting away from the Python reference constants and equations.

## Observed-spectrum overlay

The default laboratory output is synthetic. The optional CSV overlay lets you compare a user-supplied brightness-temperature spectrum against the synthetic model while preserving a visible provenance status on the page.

For an imported emission spectrum, the browser calculates only

```text
N_HI thin = 1.823e18 integral T_B(v) dv
```

It does **not** infer optical depth, spin temperature, a slab correction, self-absorption, or a best-fitting Galactic model from those data. The overlay never alters the synthetic spectrum or its controls.

See [`docs/observed-spectrum-import.md`](docs/observed-spectrum-import.md) for supported column names, CSV format, provenance notes, and interpretation limits.

## Features

- Exact redshifted frequency readout from `nu_obs = nu_0 / (1 + z)`.
- Radio, optical, and relativistic spectral-coordinate comparison.
- Synthetic multi-component H I spectrum with radiative-transfer and optically-thin curves.
- Uniform-slab and optically-thin N_HI comparison with a visible correction factor.
- Provenance-aware CSV overlay for imported velocity/brightness-temperature spectra.
- Optically-thin N_HI integration for imported emission spectra, visibly separate from the synthetic slab estimate.
- Milky Way top-down line-of-sight view and synthetic longitude-velocity ridge.
- Tangent-point diagnostic for idealised inner-Galaxy circular motion.
- CSV export of the synthetic spectrum.
- Matching Python generator, velocity-convention guard, and browser-contract validation scripts.

## Running Locally

Open `index.html` in a modern browser.

For the synthetic tables and checks:

```bash
python tools/generate_21cm_spectrum.py
python tools/validate_model.py
python tools/validate_velocity_conventions.py
node tools/validate_browser_contract.js
python tools/validate_import_contract.py
```

The generator writes `data/synthetic_21cm_spectrum.csv` and `data/tangent_point_table.csv`.

## Limitations

This is a pedagogical synthetic model with an optional visual data overlay, not a survey-analysis pipeline.

- Galactic components are illustrative Gaussian optical-depth profiles, not observed H I spectra or a fitted rotation curve.
- Imported data are displayed without baseline fitting, calibration checks, velocity-frame conversion, beam correction, resampling, uncertainty propagation, or parameter fitting.
- The slab estimate assumes a uniform spin temperature and does not handle self-absorption, multiple phases, beam filling, or line-of-sight temperature structure.
- The tangent-point construction is meaningful only for idealised inner-Galaxy circular sightlines.
- It does not model telescope beams, calibration, receiver noise, baseline subtraction, bandwidth response, or instrumental selection effects.
- Spectral conventions are shown for clarity; their labels do not turn cosmological redshift into a local velocity measurement.

## Research References

- Ewen & Purcell, 1951, first detection of the 21 cm hydrogen line.
- Field, 1958, spin temperature and the 21 cm line.
- HI4PI Collaboration et al., 2016, *HI4PI: A full-sky H I survey based on EBHIS and GASS*.
- Rohlfs & Wilson, *Tools of Radio Astronomy*.
- Draine, *Physics of the Interstellar and Intergalactic Medium*.
- Furlanetto, Oh & Briggs, 2006, 21 cm cosmology review.

## Suggested GitHub Topics

`radio-astronomy`, `hydrogen-line`, `21cm`, `neutral-hydrogen`, `spectroscopy`, `astrophysics`, `scientific-visualisation`, `javascript`, `python`, `github-pages`
