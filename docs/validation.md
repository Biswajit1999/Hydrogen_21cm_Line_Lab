# Validation Protocol

Run:

```bash
python tools/validate_observations.py
python tools/validate_peak_sensitivity.py
python tools/generate_21cm_spectrum.py
python tools/validate_model.py
```

`validate_observations.py` checks that the bundled LAB product covers the Galactic plane from
`-180 deg` through `+180 deg`, includes 73 extracted sightlines on a documented common
601-channel velocity axis, contains finite brightness temperatures while preserving negative
baseline-noise samples, and is paired with the credited HI4PI image and metadata. SHA-256 checks
fail closed if either bundled observational asset changes.

`validate_peak_sensitivity.py` regenerates all 356 baseline candidates, verifies the 12-setting
selection fractions, preserves the near/far distance ambiguity, and rejects a radius inference
on radial sightlines. These are algorithm and geometry checks, not cloud identifications.

The model reference checks confirm the `1420.40575177 MHz` rest frequency, required Doppler
conversion, zero radial velocity toward the Galactic centre for circular motion, sign reversal
between positive and negative longitudes in a symmetric rotation field, and finite
multi-component brightness-temperature integration. Those latter checks establish internal
overlay consistency; they are not a calibration of the LAB survey.
