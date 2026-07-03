# HI4PI-style observed-spectrum overlay guide

The browser overlay accepts a local CSV spectrum. It is deliberately not a survey client and does not fetch, fit, or reinterpret external data.

## Minimum CSV contract

Provide at least three rows with two numeric columns:

```text
velocity_km_s,brightness_temperature_K
-20.0,4.12
-19.5,4.45
-19.0,4.87
```

The importer also recognises common variants such as `v_LSR [km/s]`, `velocity`, `Tb (K)`, and `brightness_temperature_K` after deterministic header normalisation.

## Metadata that must accompany an overlay

Enter the survey or dataset citation in the interface and retain the following information in your own notes or file header:

- sky coordinate and coordinate frame;
- velocity reference frame, such as LSRK, LSRD, heliocentric, or barycentric;
- velocity unit and sign convention;
- brightness-temperature unit; convert mK to K before import;
- angular resolution, spectral resolution, smoothing, baseline subtraction, and any masking;
- whether the spectrum is emission only or combined with absorption information.

## What the browser does

For an imported brightness-temperature spectrum, the overlay is drawn separately from the synthetic model. The browser evaluates only the optically thin emission integral:

```text
N_HI thin = 1.823e18 integral T_B dv
```

It does not infer optical depth, spin temperature, self-absorption, slab column density, phase fractions, distances, a rotation curve, or a source association.

## HI4PI context

HI4PI is a public all-sky Galactic H I survey built from EBHIS and GASS. It distributes both column-density products and spectroscopic data. A local HI4PI-derived CSV can therefore be used as a provenance-labelled overlay after its units, velocity frame, direction, and processing choices have been retained.

The synthetic Galactic panels in this project remain illustrative even when a real overlay is loaded.
