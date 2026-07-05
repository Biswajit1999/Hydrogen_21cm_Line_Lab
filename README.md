# Hydrogen 21 cm Line Lab

Interactive radio-astronomy laboratory for the neutral-hydrogen 21 cm hyperfine line, cosmological frequency shift, spectral-coordinate conventions, synthetic Galactic H I structure, radiative transfer, column-density approximations, and provenance-aware user spectrum import.

**Author:** Biswajit Jana

## Research Motivation

The H I 21 cm line is a major diagnostic of neutral gas in the Milky Way and external galaxies. This project is a browser-based scientific explainer: it separates the frequency-redshift relation from local velocity conventions, then uses a deliberately synthetic Galactic model to explore spectra, longitude-velocity structure, and optical-depth effects.

The premium dashboard is a **research cockpit**, not a fake survey console. The central interactive field is generated from the same synthetic radiative-transfer model as the spectrum panel, and imported observations remain visibly distinct from model output.

## Scientific Model

```text
nu_0 = 1420.40575177 MHz
nu_obs = nu_0 / (1 + z)

v_radio        = c z / (1 + z)
v_optical      = c z
v_relativistic = c [((1 + z)^2 - 1) / ((1 + z)^2 + 1)]

T_B(v) = (T_s - T_c) [1 - exp(-tau(v))]

N_HI thin = 1.823e18 integral T_B(v) dv
N_HI slab = 1.823e18 T_s integral tau(v) dv

v_los = [Theta(R) R0/R - Theta0] sin(l)
```

The velocity expressions are alternative spectral-coordinate labels. A cosmological redshift is not automatically a local peculiar velocity. The uniform-slab column estimate is exact only inside the stated spin-temperature and optical-depth assumptions.

For the explicit physical-truth checklist used by the validation suite, see [`docs/science_validation_contract.md`](docs/science_validation_contract.md).

## Interactive Dashboard

- Responsive dark research-cockpit layout with a parameter rail, metrics, diagnostics, and navigation.
- Interactive `l-v-T_B` viewport: Galactic longitude, radio velocity, and **synthetic** brightness temperature.
- Drag rotation, wheel zoom, reset, and an explicit auto-rotation control.
- Synthetic H I spectrum, Galactic plane view, longitude-velocity ridge, frequency-convention panel, and tangent-point diagnostic.
- Export of the current synthetic spectrum as CSV.

The central field is not a 3D distance reconstruction of the Milky Way and not a catalogue of H I detections. Its colour and geometry encode the active teaching-model state only. See [`docs/dashboard_data_modes.md`](docs/dashboard_data_modes.md).

## Importing Your Data

The default laboratory output is synthetic. Imported spectra are browser-local overlays and never change the synthetic model.

### CSV

CSV input requires a velocity column and a brightness-temperature column. Supported aliases are documented in [`docs/observed-spectrum-import.md`](docs/observed-spectrum-import.md).

### Conservative 1D FITS

The browser also accepts a restricted FITS subset:

```text
primary Image HDU
NAXIS = 1
BUNIT = K or Kelvin
CTYPE1 contains VELO, VRAD, or VOPT
CUNIT1 = km/s or m/s
CRVAL1, CDELT1, CRPIX1 present
```

It applies `BSCALE` and `BZERO`, converts m/s to km/s, and rejects cubes, tables, non-Kelvin products, missing WCS metadata, and frequency-only axes rather than guessing a convention. See [`docs/fits_velocity_import.md`](docs/fits_velocity_import.md).

For imported emission spectra, the browser computes only:

```text
N_HI thin = 1.823e18 integral T_B(v) dv
```

It does **not** infer optical depth, spin temperature, slab correction, source association, Galactic coordinates, distance, or a 3D location.

## Reproducibility Contract

The browser and Python generator share:

```text
rest frequency     = 1420.40575177 MHz
velocity span      = 360 km/s
spectrum channels  = 520
N_HI thin factor   = 1.823e18 cm^-2 per K km/s
```

Validation protects the physical and interface contracts:

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

The generator writes `data/synthetic_21cm_spectrum.csv` and `data/tangent_point_table.csv`. The science-contract validation writes `data/science_contract_summary.csv`.

## Running Locally

Open `index.html` in a modern browser. No build step is required.

## Limitations

This remains a pedagogical synthetic model with a provenance-aware import layer, not a survey-analysis pipeline.

- Galactic components are illustrative Gaussian optical-depth profiles, not a fitted Milky Way model.
- The central `l-v-T_B` field is synthetic phase space, not a distance-resolved H I map.
- FITS support is limited to a safe 1D primary image subset; cubes, tables, and frequency axes are intentionally rejected.
- Imported data are not baseline-fitted, calibration-checked, velocity-frame-converted, beam-corrected, resampled, uncertainty-propagated, or parameter-fitted.
- The slab estimate assumes uniform spin temperature and does not model self-absorption, multiple phases, beam filling, or line-of-sight temperature structure.
- The tangent-point construction is meaningful only for idealised inner-Galaxy circular sightlines.

## Research References

- Ewen & Purcell, 1951, first detection of the 21 cm hydrogen line.
- Field, 1958, spin temperature and the 21 cm line.
- HI4PI Collaboration et al., 2016, *HI4PI: A full-sky H I survey based on EBHIS and GASS*.
- Rohlfs & Wilson, *Tools of Radio Astronomy*.
- Draine, *Physics of the Interstellar and Intergalactic Medium*.
- NASA/IAU FITS Standard, primary HDU and WCS conventions.
