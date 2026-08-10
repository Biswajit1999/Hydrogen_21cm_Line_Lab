# Hydrogen 21cm Line Lab

An observation-led browser instrument for exploring Galactic neutral atomic hydrogen (H I) at
the 1420.40575177 MHz hyperfine line. The console starts from real survey products and keeps a
forward Galactic rotation model available as an explicitly labelled comparison overlay.

## Observational Products

The default display is not a decorative face-on galaxy. An observer inside the Milky Way cannot
directly photograph a top-down H I disk: such maps require distance and rotation assumptions.
This laboratory therefore opens with measured sky and spectral products.

| Display | Product Used | Processing in This Repository |
| --- | --- | --- |
| H I sky panel | Official HI4PI all-sky public visualisation | Rendered as the observed Galactic sky projection with selectable longitude marker |
| Spectrum panel | Leiden/Argentine/Bonn (LAB) survey profiles at `b = 0.00 deg`, `0.60 deg` FWHM | Profiles downloaded at 5-degree longitude spacing and interpolated between adjacent observed sightlines |
| Longitude-velocity panel | The same LAB profiles | Native LSR spectral samples linearly resampled to a common `-300` to `+300 km s^-1` display grid at `1 km s^-1` intervals |

Bundled reduced assets:

```text
data/observations/
  hi4pi_allsky.jpg
  hi4pi_allsky_metadata.json
  lab_plane_profiles.json
```

The source and processing metadata remain embedded in the JSON products. Credit for the HI4PI
visualisation belongs to the HI4PI Collaboration; LAB spectra are supplied through the AIfA
EU-HOU LAB extraction service.

## Simulation Overlay

Switch on `SIMULATION OVERLAY` to compare the measured LAB spectrum with a controlled forward
model. Amber curves and the model-components table are computed results, never observational
data. Adjustable parameters expose the path length, velocity dispersion, rotation curve, Solar
radius and circular speed, and smooth H I emissivity assumptions.

For rest frequency `nu_0`, the non-relativistic Doppler conversion is:

```text
nu = nu_0 (1 - v_r / c)
```

For circular planar rotation, line-of-sight radial velocity relative to the local standard of
rest is modelled as:

```text
v_r = [v(R) R_0 / R - V_0] sin(l)
```

The synthetic brightness-temperature overlay is produced by integrating emissivity cells along
the sightline and broadening each radial velocity contribution with a Gaussian cloud dispersion.
It is suitable for testing how kinematic assumptions resemble or disagree with survey spectra,
not for claiming a unique Galactic reconstruction.

## Architecture

This is a zero-build application designed for a local HTTP server.

```text
index.html
assets/
  css/style.css                 Mission-control layout and display system
  js/app.js                     Canvas renderer and interaction layer
  js/physicsWorker.js           LAB loading, interpolation and optional forward model
data/observations/              Bundled real-data products and metadata
tools/fetch_lab_observations.py Reproducible public-data acquisition pipeline
```

All spectral interpolation, l-v image preparation and forward modelling run in
`physicsWorker.js`. The main thread handles Canvas rendering and controls only, keeping
interaction smooth even when model settings change rapidly.

## Run

From this directory:

```bash
python -m http.server 8080
```

Open `http://localhost:8080/`. Web Workers and JSON loading require HTTP rather than opening
`index.html` directly from the filesystem.

## Rebuild Observational Assets

The compact browser dataset can be regenerated from the public services:

```bash
python tools/fetch_lab_observations.py
```

This downloads LAB brightness-temperature profiles for Galactic longitudes `-180 deg` through
`+180 deg` in `5 deg` increments at `b = 0 deg`, and retrieves the official HI4PI public image.
The build script records the resampling operation in the JSON provenance block.

## Scientific Limits

- The LAB slice samples the Galactic plane at 5-degree longitude intervals for responsive
  teaching and comparison; it is not the complete LAB data cube.
- Spectral interpolation between adjacent LAB positions is a visual exploration aid.
- The HI4PI panel is a real all-sky projection from the Solar viewpoint, not a face-on disk.
- The optional forward model omits radiative-transfer opacity corrections, non-circular flows,
  distance ambiguity resolution and cloud-by-cloud structure.

## References

Binney, J. and Tremaine, S., 2008. *Galactic dynamics*. 2nd ed. Princeton: Princeton
University Press.

Dickey, J.M. and Lockman, F.J., 1990. H I in the Galaxy. *Annual Review of Astronomy and
Astrophysics*, 28(1), pp.215-261.

HI4PI Collaboration, 2016. HI4PI: A full-sky H I survey based on EBHIS and GASS.
*Astronomy & Astrophysics*, 594, A116. https://doi.org/10.1051/0004-6361/201629178.

Kalberla, P.M.W., Burton, W.B., Hartmann, D., Arnal, E.M., Bajaja, E., Morras, R. and
Poppel, W.G.L., 2005. The Leiden/Argentine/Bonn (LAB) Survey of Galactic H I.
*Astronomy & Astrophysics*, 440, pp.775-782.
