#!/usr/bin/env python3
"""Validate the frame maths of an EDL JSON (format: references/edl-and-timeline.md).

Usage:
  check_edl.py edl.json

Checks: integer frames, in < out, V1 gaps and overlaps (overlap allowed only
where the outgoing event declares transition_out.frames of the same length),
source range vs. timeline length x speed, source range within asset duration,
runtime vs. target. Exit code 1 on any error.
"""
import json
import sys


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    edl = json.load(open(sys.argv[1]))
    fps = edl.get("fps")
    errors, warnings = [], []
    if not isinstance(fps, (int, float)) or fps <= 0:
        sys.exit("error: EDL needs a positive 'fps'")
    assets = edl.get("assets", {})
    events = edl.get("events", [])

    for e in events:
        eid = e.get("id", "?")
        for k in ("timeline_in", "timeline_out"):
            if not isinstance(e.get(k), int):
                errors.append(f"{eid}: {k} must be an integer frame (got {e.get(k)!r})")
        if errors and errors[-1].startswith(eid):
            continue
        tin, tout = e["timeline_in"], e["timeline_out"]
        if tout <= tin:
            errors.append(f"{eid}: timeline_out ({tout}) must be > timeline_in ({tin})")
        if "source_in" in e and "source_out" in e and e["source_in"] is not None:
            sin, sout = e["source_in"], e["source_out"]
            speed = e.get("speed", 1.0) or 1.0
            expected = (tout - tin) * speed
            if abs((sout - sin) - expected) > 1:
                errors.append(f"{eid}: source length {sout - sin}f != timeline length {tout - tin}f x speed {speed} = {expected:g}f")
            a = assets.get(e.get("asset"))
            if a and a.get("duration_s") is not None:
                max_f = round(a["duration_s"] * fps)
                if sin < 0 or sout > max_f:
                    errors.append(f"{eid}: source range {sin}-{sout}f outside asset {e.get('asset')} (0-{max_f}f)")
            elif e.get("asset") and e.get("asset") not in assets:
                warnings.append(f"{eid}: asset {e.get('asset')} not listed in 'assets' (duration not checked)")

    v1 = sorted((e for e in events if e.get("track", "V1") == "V1" and isinstance(e.get("timeline_in"), int)),
                key=lambda e: e["timeline_in"])
    if v1:
        if v1[0]["timeline_in"] != 0:
            errors.append(f"V1 starts at frame {v1[0]['timeline_in']}, not 0 (leading black)")
        for a, b in zip(v1, v1[1:]):
            trans = (a.get("transition_out") or {}).get("frames", 0) or 0
            overlap = a["timeline_out"] - b["timeline_in"]
            if overlap < 0:
                errors.append(f"gap of {-overlap}f between {a.get('id')} and {b.get('id')} at frame {a['timeline_out']}")
            elif overlap != trans:
                errors.append(f"{a.get('id')}->{b.get('id')}: overlap {overlap}f but transition_out declares {trans}f")
        runtime = max(e["timeline_out"] for e in v1)
        print(f"V1 runtime: {runtime} frames = {runtime / fps:.3f}s @ {fps}fps, {len(v1)} events")
        target = edl.get("target_duration_s")
        if target is not None and runtime != round(target * fps):
            warnings.append(f"runtime {runtime}f ({runtime / fps:.3f}s) differs from target {round(target * fps)}f ({target}s)")
        for e in events:
            if e.get("track", "V1") != "V1" and isinstance(e.get("timeline_out"), int) and e["timeline_out"] > runtime:
                warnings.append(f"{e.get('id')} on {e.get('track')} ends at {e['timeline_out']}f, after picture ends ({runtime}f)")
    else:
        errors.append("no V1 events")

    for w in warnings:
        print("WARNING:", w)
    for er in errors:
        print("ERROR:", er)
    print("OK" if not errors else f"{len(errors)} error(s)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
