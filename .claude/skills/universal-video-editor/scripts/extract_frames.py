#!/usr/bin/env python3
"""Extract still frames from a video for shot analysis and contact sheets.

Usage:
  extract_frames.py <video> --times 1.2,4.5,8 --out frames/
  extract_frames.py <video> --every 2 --out frames/ [--max 40] [--width 640]

Writes new JPEG files only (named <stem>_t<seconds>.jpg so the source time is
in the filename); the source video is never modified.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path


def duration(path):
    res = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "json", str(path)], capture_output=True, text=True)
    try:
        return float(json.loads(res.stdout)["format"]["duration"])
    except (KeyError, ValueError, json.JSONDecodeError):
        return None


def grab(src, t, dest, width):
    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(src), "-frames:v", "1",
           "-vf", f"scale={width}:-2", "-q:v", "3", str(dest)]
    return subprocess.run(cmd, capture_output=True, text=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--times", help="comma-separated seconds")
    g.add_argument("--every", type=float, help="sample every N seconds")
    ap.add_argument("--out", required=True)
    ap.add_argument("--max", type=int, default=60)
    ap.add_argument("--width", type=int, default=640)
    args = ap.parse_args()

    src = Path(args.video)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    dur = duration(src)
    if dur is None:
        sys.exit(f"error: could not read duration of {src}")

    if args.times:
        times = [float(t) for t in args.times.split(",") if t.strip()]
    else:
        times, t = [], 0.0
        while t < dur and len(times) < args.max:
            times.append(round(t, 3))
            t += args.every

    ok = 0
    for t in times:
        if t >= dur:
            print(f"skip {t}s: beyond duration {dur:.3f}s", file=sys.stderr)
            continue
        dest = out / f"{src.stem}_t{t:07.3f}.jpg"
        res = grab(src, t, dest, args.width)
        if res.returncode == 0 and dest.exists() and dest.stat().st_size > 0:
            ok += 1
            print(dest)
        else:
            print(f"failed at {t}s: {res.stderr.strip()}", file=sys.stderr)
    print(f"extracted {ok}/{len(times)} frames from {src.name} (duration {dur:.3f}s)", file=sys.stderr)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
