"""Descriptive LAB H I line-profile and Galactic-longitude diagnostics.

Uses measured brightness-temperature spectra without replacing them with a
kinematic-distance model. All analyses are model- and threshold-conditional.
Only the Python standard library is required.
"""
from __future__ import annotations

import math
from typing import Mapping, Sequence


def _validated_spectrum(velocity: Sequence[float], brightness: Sequence[float]):
    if len(velocity) != len(brightness) or len(velocity) < 3:
        raise ValueError("Spectrum needs at least three matching samples")
    v = [float(x) for x in velocity]
    t = [float(x) for x in brightness]
    if any(not math.isfinite(x) for x in v + t):
        raise ValueError("Nonfinite velocity/temperature")
    if any(b <= a for a, b in zip(v, v[1:])):
        raise ValueError("Velocity axis must increase strictly")
    return v, t


def _trapz(x: Sequence[float], y: Sequence[float]) -> float:
    return math.fsum((b-a)*(p+q)/2 for a,b,p,q in zip(x,x[1:],y,y[1:]))


def spectral_moments(
    velocity: Sequence[float], brightness: Sequence[float], threshold_k: float = 1.5
) -> dict[str, float | None]:
    """Signed line integral and thresholded emission-weighted centroid/width.

    Brightness samples are not clipped in the signed integral. Thresholded
    moments use T when T>threshold and zero otherwise, not (T-threshold).
    The threshold is a *selection rule*, not a measured noise standard deviation.
    """
    v, t = _validated_spectrum(velocity, brightness)
    threshold = float(threshold_k)
    if not math.isfinite(threshold) or threshold < 0:
        raise ValueError("Threshold must be finite and nonnegative")
    positive = [max(0.0, z) for z in t]
    emission = [z if z > threshold else 0.0 for z in t]
    signed = _trapz(v,t)
    area = _trapz(v,emission)
    centroid = _trapz(v,[x*z for x,z in zip(v,emission)])/area if area > 0 else None
    variance = (_trapz(v,[(x-centroid)**2*z for x,z in zip(v,emission)])/area
                if centroid is not None else None)
    return {
        "signed_integral_k_km_s": signed,
        "positive_integral_k_km_s": _trapz(v,positive),
        "selected_integral_k_km_s": area,
        "centroid_km_s": centroid,
        "width_km_s": math.sqrt(max(variance,0)) if variance is not None else None,
        "peak_k": max(t),
        "negative_channel_fraction": sum(z < 0 for z in t)/len(t),
    }


def longitude_reflection_diagnostics(
    velocity: Sequence[float],
    profiles: Sequence[Mapping[str, object]],
    brightness_floor_k: float = 1.5,
) -> list[dict[str, float | int | None]]:
    """Compare (l,v) against (-l,-v) using *actual* paired sightlines.

    The measured LAB velocity grid must be symmetric, or interpolation would
    be required; in that case this function fails rather than fabricating it.
    Bright-channel selection requires either counterpart above the floor.
    These comparisons do NOT assume exact Milky Way axisymmetry.
    """
    v=[float(x) for x in velocity]
    if any(abs(a+b)>1e-8 for a,b in zip(v,reversed(v))):
        raise ValueError("Velocity grid must be symmetric around zero")
    floor=float(brightness_floor_k)
    if not math.isfinite(floor) or floor < 0:
        raise ValueError("Brightness floor must be finite and nonnegative")
    by_lon={}
    for profile in profiles:
        lon=float(profile["longitudeDeg"])
        if not math.isfinite(lon) or lon in by_lon:
            raise ValueError("Invalid/duplicate longitude")
        _, values=_validated_spectrum(v,profile["brightnessK"])
        by_lon[lon]=values
    output=[]
    for lon in sorted(k for k in by_lon if 0 < k < 180 and -k in by_lon):
        plus=by_lon[lon]
        minus=list(reversed(by_lon[-lon]))
        selected=[(a,b) for a,b in zip(plus,minus) if a>floor or b>floor]
        n=len(selected)
        rms=math.sqrt(math.fsum((a-b)**2 for a,b in selected)/n) if n else None
        mean_a=math.fsum(a for a,b in selected)/n if n else None
        mean_b=math.fsum(b for a,b in selected)/n if n else None
        denom=math.sqrt(math.fsum((a-mean_a)**2 for a,b in selected)*math.fsum((b-mean_b)**2 for a,b in selected)) if n else 0
        corr=(math.fsum((a-mean_a)*(b-mean_b) for a,b in selected)/denom) if denom>0 else None
        output.append({"abs_longitude_deg":lon,"selected_channels":n,
                       "reflection_rms_difference_k":rms,"reflection_pearson_r":corr,
                       "signed_integral_difference_k_km_s":_trapz(v,[a-b for a,b in zip(plus,minus)])})
    return output


def boxcar_smooth(values: Sequence[float], width: int) -> list[float]:
    """Edge-renormalized odd-width smoothing (no zero-padding bias)."""
    if not isinstance(width,int) or width<1 or width%2!=1:
        raise ValueError("Width must be a positive odd integer")
    y=[float(v) for v in values]
    if any(not math.isfinite(v) for v in y):
        raise ValueError("Nonfinite samples")
    h=width//2
    return [math.fsum(y[max(0,i-h):min(len(y),i+h+1)])/
            (min(len(y),i+h+1)-max(0,i-h)) for i in range(len(y))]


def threshold_smoothing_sensitivity(
    velocity: Sequence[float],
    brightness: Sequence[float],
    thresholds_k: Sequence[float] = (0.5,1.5,3.0),
    smoothing_widths: Sequence[int] = (1,3,5,9),
) -> list[dict[str,float | int | None]]:
    """Sensitivity grid; never label changes as physical-cloud discoveries."""
    v,t=_validated_spectrum(velocity,brightness)
    out=[]
    for width in smoothing_widths:
        smoothed=boxcar_smooth(t,width)
        for threshold in thresholds_k:
            result=spectral_moments(v,smoothed,threshold)
            out.append({"boxcar_channels":width,"threshold_k":float(threshold),
                        "selected_integral_k_km_s":result["selected_integral_k_km_s"],
                        "centroid_km_s":result["centroid_km_s"],
                        "width_km_s":result["width_km_s"]})
    return out
