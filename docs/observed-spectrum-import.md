# Observed-spectrum CSV import

The browser model is synthetic by default. This optional overlay is deliberately separate: it plots a user-supplied spectrum without silently changing the synthetic line model, Galactic-plane illustration, longitude-velocity ridge, or optical-depth parameters.

## Required CSV columns

The importer needs one velocity column and one brightness-temperature column. It accepts comma-separated or tab-separated text with a header row. Supported names are:

```text
velocity_km_s, velocity, v_lsr_km_s, v_lsr, v_km_s, v
brightness_temperature_K, brightness_temperature, Tb_K, T_B_K, temperature_K, temperature, Tb
```

For example:

```csv
velocity_km_s,brightness_temperature_K
-20.0,3.14
-19.0,3.42
-18.0,3.68
```

Comment lines beginning with `#` are ignored. Rows with non-numeric velocity or temperature values are ignored. At least three valid rows are required. The browser sorts rows by velocity before plotting and integrating.

## What is and is not derived

For an imported brightness-temperature spectrum, the lab displays only

```text
N_HI thin = 1.823e18 integral T_B(v) dv
```

This is the optically-thin emission conversion. The browser does not infer optical depth, spin temperature, self-absorption, beam filling factor, line-of-sight structure, or a uniform-slab correction from an imported emission spectrum alone.

## Provenance requirement

Use the `Dataset or survey citation` field to record the survey, pointing or Galactic coordinates, velocity frame, intensity unit, processing steps, and any baseline treatment. The text is displayed in the page status card but is not written back into the source file.

For HI4PI-based work, retain the data release and any cutout/extraction method in your project notes. HI4PI is a full-sky Galactic H I survey with spectroscopic data; this application does not download, query, or redistribute its data.

## Interpretation boundary

An overlay is a visual comparison, not a fit. No parameter optimisation, likelihood, residual statistic, or physical association is performed between the imported spectrum and the synthetic model.