#!/usr/bin/env python3
"""Technical export QC with ffprobe (+ a full decode check).

Usage:
  validate_export.py out.mp4 [--width 1080 --height 1920] [--fps 30] [--duration 30]
                     [--duration-tolerance 0.1] [--vcodec h264] [--require-audio] [--skip-decode]

Prints PASS/FAIL per check; exit code 1 if any check fails.
"""
import argparse
import json
import subprocess
import sys
from fractions import Fraction
from pathlib import Path


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file")
    ap.add_argument("--width", type=int)
    ap.add_argument("--height", type=int)
    ap.add_argument("--fps", type=float)
    ap.add_argument("--duration", type=float)
    ap.add_argument("--duration-tolerance", type=float, default=0.1)
    ap.add_argument("--vcodec")
    ap.add_argument("--require-audio", action="store_true")
    ap.add_argument("--skip-decode", action="store_true")
    a = ap.parse_args()

    results = []

    def check(name, ok, detail=""):
        results.append(ok)
        print(f"{'PASS' if ok else 'FAIL'}  {name}{('  — ' + detail) if detail else ''}")

    p = Path(a.file)
    check("file exists", p.is_file(), str(p))
    if not p.is_file():
        sys.exit(1)
    size = p.stat().st_size
    check("file size > 0", size > 0, f"{size} bytes")

    res = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(p)],
                         capture_output=True, text=True)
    if res.returncode != 0:
        check("ffprobe readable", False, res.stderr.strip())
        sys.exit(1)
    info = json.loads(res.stdout)
    streams = info.get("streams", [])
    v = next((s for s in streams if s.get("codec_type") == "video"), None)
    aud = [s for s in streams if s.get("codec_type") == "audio"]
    check("video stream present", v is not None)
    if a.require_audio:
        check("audio stream present", bool(aud), f"{len(aud)} audio stream(s)")
    else:
        print(f"INFO  audio streams: {len(aud)}")

    dur = float(info.get("format", {}).get("duration", 0) or 0)
    if a.duration is not None:
        check("duration", abs(dur - a.duration) <= a.duration_tolerance, f"{dur:.3f}s vs {a.duration}s")
    else:
        print(f"INFO  duration: {dur:.3f}s")

    if v:
        w, h = v.get("width"), v.get("height")
        if a.width and a.height:
            check("resolution", (w, h) == (a.width, a.height), f"{w}x{h} vs {a.width}x{a.height}")
            check("aspect ratio", w * a.height == h * a.width, f"{Fraction(w, h)} vs {Fraction(a.width, a.height)}")
        else:
            print(f"INFO  resolution: {w}x{h}")
        fps = float(Fraction(v.get("avg_frame_rate", "0/1"))) if v.get("avg_frame_rate", "0/0") != "0/0" else 0
        if a.fps:
            check("frame rate", abs(fps - a.fps) < 0.01, f"{fps:.3f} vs {a.fps}")
        else:
            print(f"INFO  fps: {fps:.3f}")
        if a.vcodec:
            check("video codec", v.get("codec_name") == a.vcodec, f"{v.get('codec_name')} vs {a.vcodec}")
        else:
            print(f"INFO  video codec: {v.get('codec_name')} {v.get('pix_fmt')}")

    if not a.skip_decode:
        dec = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "null", "-"], capture_output=True, text=True)
        errs = dec.stderr.strip()
        check("decodes without errors", dec.returncode == 0 and not errs, errs[:300])

    failed = results.count(False)
    print("ALL CHECKS PASSED" if not failed else f"{failed} CHECK(S) FAILED")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
