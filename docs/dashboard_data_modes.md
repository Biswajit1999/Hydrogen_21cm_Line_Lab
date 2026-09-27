# Dashboard Data Modes and Provenance

The dashboard separates three data classes: bundled observations, an optional
forward model, and browser-local user imports.

## Bundled observational views

The default spectrum and longitude–velocity map are reduced LAB survey
brightness-temperature profiles at `b = 0°`. The 73 downloaded sightlines are
sampled every 5° in longitude and linearly resampled onto a shared 1 km/s LSR
grid. Interpolation between adjacent sightlines is a display operation, not a
new observation. The sky panel is the credited HI4PI public all-sky image.

Negative LAB samples are preserved because baseline noise is part of the
delivered profiles. No positivity clipping is applied to the observations.

## Optional forward model

Enabling the amber overlay runs a smooth circular-rotation/emissivity model.
Its path cells and spectrum are computed illustrations, not fits to the LAB
data. The overlay omits opacity, self-absorption, beam convolution, streaming
motions, warps, and a likelihood function.

## Peak sensitivity and geometry

Displayed local maxima are descriptive candidates, not decomposed clouds or
spiral-arm identifications. The browser reports how often each baseline
candidate is recovered across 12 combinations of four relative thresholds and
three merge radii. `R_GC` is the Galactocentric radius implied by a flat,
circular rotation curve. Heliocentric distance solutions are derived
separately; two values expose the inner-Galaxy near/far ambiguity. A missing
solution means the measured velocity/radius combination is inaccessible under
that simplified geometry.

## Imported user spectra

The dashboard accepts browser-local CSV and a conservative 1D FITS subset.
Imported spectra are used only for the spectrum panel and the optically thin
column estimate `N_HI = 1.823e18 ∫T_B dv`. The browser does not infer optical
depth, spin temperature, distance, Galactic longitude, source association, or
3D placement from a one-dimensional import.
