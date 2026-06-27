# Spectral conventions and opacity boundary

The redshift control uses the exact cosmological frequency relation:

```text
nu observed = nu rest / (1 + z)
```

For that same redshift, the browser displays three velocity conventions:

```text
radio        v = c z / (1 + z)
optical      v = c z
relativistic v = c [((1 + z)^2 - 1) / ((1 + z)^2 + 1)]
```

These are alternative spectral-coordinate conventions. A cosmological redshift should not automatically be interpreted as a local peculiar velocity.

For the synthetic slab, the display compares:

```text
NHI thin = 1.823e18 integral Tb dv
NHI slab = 1.823e18 Ts integral tau dv
```

The first is the familiar optically-thin approximation. The second uses the model optical depth and spin temperature, so it is only exact within this simple uniform-slab model. Neither quantity is a measurement from a real observation.
