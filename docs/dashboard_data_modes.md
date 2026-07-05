# Dashboard Data Modes and Provenance

The dashboard deliberately separates model output from imported measurements.

## Synthetic longitude–velocity intensity map

The default central viewport is a synthetic longitude–velocity map:

```text
x = Galactic longitude, l
y = radio velocity, v
colour = relative synthetic brightness temperature, T_B(l, v)
```

For every longitude–velocity sample, the map uses the same Gaussian optical-depth components and uniform-slab radiative-transfer relation as the main spectrum panel:

```text
T_B(v) = (T_s - T_c) [1 - exp(-tau(v))]
```

The selected Galactic longitude is drawn in gold. The map is the primary scientific view because it keeps the two measured/modelled coordinates readable.

## Optional 3D surface view

The optional surface mode is an orthographic rendering of the exact same `T_B(l, v)` field:

```text
x = Galactic longitude
y = radio velocity
z = relative synthetic brightness temperature
colour = the same relative synthetic brightness temperature
```

It does not add a distance axis, source position, survey detections, or additional information. Height and colour redundantly encode the model brightness solely to make the phase-space topology easier to inspect. Surface orbit is user-controlled; there is no automatic motion.

Neither view is a distance-resolved 3D reconstruction of the Milky Way or a catalogue of survey detections.

## Imported user spectra

The dashboard accepts browser-local CSV and a conservative 1D FITS subset. CSV aliases are documented in `docs/observed-spectrum-import.md`; FITS requirements are documented in `docs/fits_velocity_import.md`.

Imported spectra are intentionally used only in the spectrum panel. The browser calculates:

```text
N_HI thin = 1.823e18 integral T_B(v) dv
```

The browser does not infer optical depth, spin temperature, a physical distance, a Galactic longitude, a source association, or a 3D placement from an imported spectrum. The dashboard states this constraint both in the import status and beneath the central viewport.

## What counts as real data

A user may import a real spectrum exported to CSV or a compliant 1D FITS product from a survey or telescope pipeline, provided they supply relevant provenance in the citation field. At minimum, record:

- survey or telescope product;
- sky coordinate or line of sight;
- velocity convention and frame, for example LSRK;
- brightness-temperature units;
- whether baseline subtraction, smoothing, or calibration has been applied.
