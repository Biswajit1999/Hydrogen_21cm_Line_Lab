# Conservative 1D FITS Import for H I Spectra

The browser can now import a restricted, explicit FITS subset for a user-provided H I brightness-temperature spectrum. The goal is to accept a real, well-described 1D spectrum without silently guessing its spectral coordinate, units, or astrophysical interpretation.

## Accepted FITS subset

The parser accepts only a **primary Image HDU** with:

```text
NAXIS   = 1
BITPIX  = 8, 16, 32, -32, or -64
BUNIT   = K or Kelvin
CTYPE1  = a velocity coordinate containing VELO, VRAD, or VOPT
CUNIT1  = km/s or m/s
CRVAL1, CDELT1, CRPIX1 = present
```

The linear coordinate is evaluated with FITS pixel convention:

```text
v_i = CRVAL1 + [(i + 1) - CRPIX1] CDELT1
```

The result is converted internally to km/s. `BSCALE` and `BZERO` are applied to the primary-array values before the imported line profile is plotted.

## Rejected intentionally

The browser rejects the following rather than making assumptions:

- data cubes and images with `NAXIS` other than 1;
- binary or ASCII table spectra;
- missing `CRVAL1`, `CDELT1`, `CRPIX1`, or `CUNIT1`;
- frequency-only axes, including `CTYPE1=FREQ`;
- flux-density or ambiguous units such as Jy/beam;
- velocity units other than km/s or m/s.

A frequency-axis FITS spectrum can be scientifically valid, but conversion to a velocity coordinate depends on a declared rest frequency and convention. This release therefore requires the user to perform that step deliberately before import rather than applying an unlabelled browser conversion.

## Imported-data interpretation

A successful import yields an overlay in the spectrum panel and an optically-thin line integral:

```text
N_HI thin = 1.823e18 integral T_B(v) dv
```

The lab does not infer optical depth, spin temperature, a slab correction, distance, Galactic longitude, source identity, or a 3D point from a user-imported FITS file.

## Provenance expected from the user

Record a citation or survey product name in the interface and, where available, include the line of sight, `SPECSYS`/velocity frame, baseline treatment, angular resolution, and any smoothing or regridding applied before export.

## Validation

`tools/validate_fits_import.js` builds deterministic in-memory FITS byte streams and verifies:

1. a 1D `VELO-LSR` primary spectrum;
2. m/s-to-km/s conversion;
3. `BSCALE` and `BZERO` application;
4. retention of spectral-frame metadata;
5. rejection of frequency-only and non-Kelvin files.
