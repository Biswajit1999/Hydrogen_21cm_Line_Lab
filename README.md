# Hydrogen 21 cm Line Lab

Interactive radio astronomy laboratory for the neutral hydrogen 21 cm hyperfine line, redshifted observing frequency, Doppler velocity, line broadening, optical depth, brightness temperature, and H I column density.

**Author:** Biswajit Jana

## Research Motivation

The 21 cm line of neutral hydrogen is one of the most important diagnostics in radio astronomy. It maps Galactic H I structure, galaxy rotation curves, neutral gas reservoirs, high-velocity clouds, and the large-scale distribution of matter. This project provides a compact, browser-based research explainer for the spectroscopy behind the line.

## Scientific Background

The rest-frame transition frequency is:

```text
nu_0 = 1420.40575177 MHz
```

corresponding to a wavelength of approximately 21.106 cm. The transition is produced by the hyperfine spin-flip of the ground-state hydrogen atom.

For a cosmological redshift:

```text
nu_obs = nu_0 / (1 + z)
```

For the radio Doppler convention:

```text
v = c (nu_0 - nu_obs) / nu_0
```

The brightness temperature for a simple slab against a continuum background is modelled as:

```text
T_B(v) = (T_s - T_c) [1 - exp(-tau(v))]
```

For optically thin emission, the H I column density is approximated by:

```text
N_HI = 1.823e18 integral T_B(v) dv   cm^-2
```

where `T_B` is in kelvin and `dv` is in km/s.

## Main Features

- Interactive redshift and observed-frequency readout.
- Radio Doppler velocity estimate.
- Gaussian optical-depth line profile.
- Brightness temperature spectrum compared with optically thin approximation.
- H I column density estimate from the synthetic line integral.
- CSV export of synthetic spectrum.
- Python generator and validation scripts.
- GitHub Pages-ready static implementation.

## Research Use Cases

- Teaching how rest frequency, redshift, and radio velocity are connected.
- Building intuition for optically thin H I column-density estimates.
- Creating synthetic 21 cm spectra for plotting and dashboard workflows.
- Serving as a foundation for future H I rotation-curve and Galactic longitude-velocity visualisations.

## Running Locally

Open `index.html` in a browser.

Optional Python generation and validation:

```bash
python tools/generate_21cm_spectrum.py
python tools/validate_model.py
```

## Limitations

- Uses a single Gaussian line component.
- Does not model real telescope beams, calibration, receiver noise, baseline subtraction, self-absorption, multiple gas phases, or radiative transfer through complex Galactic structure.
- Uses synthetic data only.
- The radio velocity convention is appropriate for nearby sources; relativistic and optical conventions are not yet implemented.

## Research References

- Ewen & Purcell, 1951, first detection of the 21 cm hydrogen line.
- Field, 1958, spin temperature and the 21 cm line.
- Rohlfs & Wilson, *Tools of Radio Astronomy*.
- Draine, *Physics of the Interstellar and Intergalactic Medium*.
- Furlanetto, Oh & Briggs, 2006, 21 cm cosmology review.

## README Image Prompt

A README hero image prompt is provided in [`docs/image_prompt.md`](docs/image_prompt.md).

## Suggested GitHub Topics

`radio-astronomy`, `hydrogen-line`, `21cm`, `neutral-hydrogen`, `spectroscopy`, `astrophysics`, `scientific-visualisation`, `javascript`, `python`, `github-pages`
