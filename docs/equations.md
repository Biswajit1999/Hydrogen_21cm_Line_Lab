# Equations and Assumptions

## Rest Frequency

The neutral hydrogen hyperfine transition has rest frequency:

```text
nu_0 = 1420.40575177 MHz
```

## Redshifted Frequency

For cosmological redshift:

```text
nu_obs = nu_0 / (1 + z)
```

## Radio Velocity Convention

The lab uses the radio convention:

```text
v_radio = c (nu_0 - nu_obs) / nu_0
```

This is not the same as the optical or relativistic velocity convention.

## Optical Depth Profile

The synthetic line uses a Gaussian optical-depth profile:

```text
tau(v) = tau_0 exp[-0.5 (v / sigma_v)^2]
```

## Brightness Temperature

The simplified slab brightness against a continuum background is:

```text
T_B(v) = (T_s - T_c) [1 - exp(-tau(v))]
```

For optically thin emission:

```text
T_B(v) ~= (T_s - T_c) tau(v)
```

## H I Column Density

For optically thin H I emission:

```text
N_HI = 1.823e18 integral T_B(v) dv   cm^-2
```

where `T_B` is measured in kelvin and `dv` in km/s.
