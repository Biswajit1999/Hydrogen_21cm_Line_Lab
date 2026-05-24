# Validation Notes

## Checks Implemented

1. **Zero redshift**

   At `z = 0`, the observed frequency equals the rest frequency.

2. **Redshift scaling**

   Increasing `z` must decrease `nu_obs` according to `nu_0 / (1 + z)`.

3. **Optically thin limit**

   For small optical depth, `1 - exp(-tau)` approaches `tau`.

4. **Column-density scaling**

   In the optically thin limit, doubling the brightness-temperature integral doubles `N_HI`.

5. **Gaussian width scaling**

   At fixed peak optical depth and spin temperature, increasing the velocity width increases the integrated column density.

## Scientific Scope

The validation checks the internal consistency of a one-component educational model. It does not validate real telescope calibration, baseline subtraction, multi-component H I fitting, or interferometric imaging products.
