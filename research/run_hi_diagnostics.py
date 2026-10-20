"""Analyze the existing 73 LAB profiles without altering survey products."""
import argparse
import csv
import json
from pathlib import Path
from research.hi_spectral_diagnostics import (
    spectral_moments,longitude_reflection_diagnostics,threshold_smoothing_sensitivity,
)


def write_csv(path,rows):
    if not rows:
        return
    with path.open("w",newline="",encoding="utf-8") as handle:
        writer=csv.DictWriter(handle,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--input",type=Path,default=Path("data/observations/lab_plane_profiles.json"))
    parser.add_argument("--output",type=Path,default=Path("results/hi_spectral_diagnostics"))
    args=parser.parse_args()
    payload=json.loads(args.input.read_text(encoding="utf-8"))
    if not payload.get("dataset","").startswith("Leiden/Argentine/Bonn") or "provenance" not in payload:
        raise ValueError("Expected LAB observational product with provenance")
    v=payload["velocityKmS"]
    profiles=payload["profiles"]
    args.output.mkdir(parents=True,exist_ok=True)
    moment_rows=[]; sensitivity_rows=[]
    for profile in profiles:
        lon=profile["longitudeDeg"]
        t=profile["brightnessK"]
        moment_rows.append({"longitude_deg":lon,**spectral_moments(v,t)})
        for row in threshold_smoothing_sensitivity(v,t):
            sensitivity_rows.append({"longitude_deg":lon,**row})
    reflection=longitude_reflection_diagnostics(v,profiles)
    write_csv(args.output/"moments.csv",moment_rows)
    write_csv(args.output/"threshold_smoothing.csv",sensitivity_rows)
    write_csv(args.output/"longitude_reflection.csv",reflection)
    (args.output/"manifest.json").write_text(json.dumps({"source":payload["provenance"],
       "profile_count":len(profiles),"velocity_channels":len(v),
       "reflection_pairs":len(reflection),"sensitivity_settings":12,
       "limitations":"No optical-depth correction, no beam covariance, no kinematic distance inference"},indent=2)+"\n")
    print(json.dumps({"profiles":len(profiles),"velocity_channels":len(v),"reflection_pairs":len(reflection),"sensitivity_rows":len(sensitivity_rows)},indent=2))

if __name__=="__main__": main()
