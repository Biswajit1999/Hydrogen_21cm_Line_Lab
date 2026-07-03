# Hydrogen 21 cm Spectral Velocity Conventions

This project intentionally separates cosmological frequency shift from local spectral-coordinate labels. The same observed frequency can be labelled using different conventions; those labels should not be silently treated as identical physical velocities.

## Rest frequency

```text
nu0 = 1420.40575177 MHz
```

## Cosmological frequency shift

For a redshift `z`:

```text
nu_obs = nu0 / (1 + z)
z = nu0 / nu_obs - 1
```

This relation is exact for the frequency-redshift mapping used by the lab. It does not by itself decide whether the shift is cosmological expansion, local Doppler motion, Galactic rotation, or instrumental calibration.

## Radio velocity coordinate

The radio convention labels a frequency shift relative to the rest frequency:

```text
v_radio = c (nu0 - nu) / nu0 = c z / (1 + z)
z = v_radio / (c - v_radio)
```

This is common in H I spectral cubes and is a coordinate convention, not a universal physical speed.

## Optical velocity coordinate

The optical convention labels the same redshift as:

```text
v_optical = c z
nz = v_optical / c
```

For positive redshift, `v_optical` is larger than `v_radio`. At very small `z`, the two are approximately equal to first order.

## Relativistic Doppler coordinate

For a pure radial special-relativistic Doppler interpretation:

```text
v_rel = c [((1 + z)^2 - 1) / ((1 + z)^2 + 1)]
z = sqrt((1 + beta) / (1 - beta)) - 1
beta = v_rel / c
```

For positive redshift in this convention:

```text
v_radio < v_rel < v_optical
```

For blueshift, the ordering reverses appropriately:

```text
v_optical < v_rel < v_radio
```

## Validation contract

`tools/validate_velocity_conventions.py` checks:

1. Frequency-redshift inverse consistency.
2. Radio, optical, and relativistic velocity inverse consistency.
3. Positive-redshift ordering: radio < relativistic < optical.
4. Blueshift ordering: optical < relativistic < radio.
5. First-order agreement of conventions at very small redshift.

## Visualisation rule

Any plot using these quantities must label them as coordinate conventions unless a physical model has explicitly justified a Doppler or Galactic-rotation interpretation.
