# Dashboard Data Modes and Provenance

The dashboard deliberately separates model output from imported measurements.

## Synthetic longitude-velocity-brightness field

The central interactive viewport is a synthetic phase-space field with axes:

```text
x = Galactic longitude
 y = radio velocity
 z = brightness temperature
```

For each longitude-velocity sample it uses the same Gaussian optical-depth components and uniform-slab radiative-transfer relation as the main spectrum panel:

```text
T_B(v) = (T_s - T_c) [1 - exp(-tau(v))]
```

It is a view transform of the teaching model, not a distance-resolved 3D reconstruction of the Milky Way and not a catalogue of survey detections. Point colour encodes relative synthetic brightness for the active controls. The selected longitude curve is highlighted in gold.

## Imported user spectra

The dashboard accepts browser-local CSV files with a velocity and brightness-temperature column. Accepted header aliases are documented in `docs/observed-spectrum-import.md`.

Imported spectra are intentionally used only in the spectrum panel. The browser calculates:

```text
N_HI thin = 1.823e18 integral T_B(v) dv
```

The browser does not infer optical depth, spin temperature, a physical distance, a Galactic longitude, a source association, or a 3D placement from an imported spectrum. The dashboard states this constraint both in the import status and beneath the interactive viewport.

## What counts as real data

A user may import a real spectrum exported to CSV from a survey or telescope pipeline, provided they supply the relevant provenance in the citation field. At minimum, the user should record:

- survey or telescope product;
- sky coordinate or line of sight;
- velocity convention and frame, for example LSRK;
- brightness-temperature units;
- whether baseline subtraction, smoothing, or calibration has been applied.

FITS parsing is not implemented in this browser-only release. A future data-pipeline upgrade can add validated FITS ingestion and coordinate metadata without changing the model/data separation above.
