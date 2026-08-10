# Galactic H I Data And Kernel Equations

## Observed Product

The primary spectrum and longitude-velocity view are measurements from the Leiden/Argentine/Bonn
(LAB) survey. Profiles queried at `b = 0 deg` and `0.60 deg` FWHM are stored at 5-degree
longitude intervals. Since the native LSR-calibrated channels vary slightly between extracted
profiles, the browser display dataset is linearly resampled to:

```text
v_LSR = -300, -299, ..., +300 km/s
```

No rotation curve is needed to display those measured brightness temperatures.

## Optional Model Overlay

The hyperfine rest transition is:

```text
nu0 = 1420.40575177 MHz
```

For a non-relativistic radial velocity in the local standard of rest:

```text
nu = nu0 (1 - vr / c)
```

The planar circular Galactic model locates the Sun at radius `R0` with circular speed `V0`.
For neutral gas on a circular orbit at radius `R`, observed at longitude `l`:

```text
vr(R,l) = [v(R) R0/R - V0] sin(l)
```

When the simulation overlay is enabled, the worker evaluates this velocity along a sightline
through an exponential disk with a smooth two-arm emissivity modulation and adds each gas parcel
as a Gaussian velocity component:

```text
TB(v) = sum_s epsilon(s) exp[-(v - vr(s))^2 / (2 sigma_v^2)]
```

The model spectrum is drawn in amber over the cyan LAB observation. The displayed
longitude-velocity heatmap remains the measured LAB plane slice.
