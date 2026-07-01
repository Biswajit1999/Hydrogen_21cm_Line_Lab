# Hydrogen 21 cm Line Science Validation Contract

This repository is a synthetic teaching model for neutral-hydrogen 21 cm spectroscopy. Visual panels must preserve physical truth: plotted brightness, optical depth, frequency markers, and longitude-velocity structure must be labelled as synthetic or idealised unless they are generated from observational data.

## Constants and unit conventions

The model uses the neutral-hydrogen hyperfine rest frequency:

```text
nu_0 = 1420.40575177 MHz
```

This corresponds to a vacuum wavelength close to 21.106 cm. Frequencies are in MHz, velocities are in km/s, brightness temperatures are in K, and H I column density is reported in cm^-2.

## Redshift and velocity

Cosmological redshift is represented by:

```text
nu_obs = nu_0 / (1 + z)
```

The local radio velocity convention is represented by:

```text
v_radio = c (nu_0 - nu_obs) / nu_0
nu_obs = nu_0 (1 - v_radio / c)
```

This radio convention is appropriate for nearby, non-relativistic velocity demonstrations. It is not the optical velocity convention and is not the full relativistic Doppler relation.

## Radiative transfer slab

For a uniform spin-temperature slab against a continuum background, the current teaching model uses:

```text
T_B(v) = (T_s - T_c) [1 - exp(-tau(v))]
```

In the optically thin limit, this approaches:

```text
T_B(v) approx (T_s - T_c) tau(v)
```

The visualisation must not imply that this simple slab captures self-absorption, mixed temperature phases, calibration effects, beam dilution, or baseline subtraction.

## H I column density

For optically thin emission, the model uses:

```text
N_HI = 1.823e18 integral T_B(v) dv  cm^-2
```

with `T_B` in K and `dv` in km/s. This should be labelled as an optically thin estimate, not a general solution for arbitrary optical depth.

## Galactic rotation and longitude-velocity panels

The browser uses a simplified circular-rotation motivation:

```text
v_los = [Theta(R) R0/R - Theta0] sin(l)
```

The synthetic components are illustrative and are not fitted to a real Milky Way mass model, gas distribution, telescope beam, or survey cube. The longitude-velocity heat map is a synthetic diagnostic, not an observational data product.

## Required validation checks

The validation suite should check:

1. `z = 0` returns the rest frequency.
2. Positive redshift lowers the observed frequency.
3. The radio velocity and frequency formulas are inverse-consistent in the non-relativistic domain.
4. The optically thin brightness approximation converges as optical depth approaches zero.
5. Brightness temperature is monotonic with optical depth for fixed `T_s > T_c`.
6. Integrated column density scales linearly with line amplitude in the optically thin regime.
7. A wider Gaussian line with the same peak optical depth produces a larger integrated column density.
8. Inner-Galaxy tangent radius follows `R_t = R0 |sin(l)|` for the simplified geometry.
9. Synthetic panels remain clearly labelled as idealised or synthetic.

## Next scientific gap

The next defensible upgrade is to add explicit optical, radio, and relativistic velocity conventions, with tests showing their agreement at low velocity and divergence at high velocity. This should happen before any animation or rendering polish.