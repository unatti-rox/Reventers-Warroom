#!/usr/bin/env python3
"""Probe media files with ffprobe and draft the technical half of an asset manifest.

Usage:
  probe_assets.py <folder-or-file> [...] [--out manifest.json]

Read-only: never modifies, renames or moves source files. Every value comes
from ffprobe; fields ffprobe can't read are reported as null, never guessed.
"""
import argparse
import json
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".avi", ".mxf", ".webm", ".mts", ".m2ts", ".r3d", ".braw"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".heic", ".bmp", ".exr", ".dpx", ".gif", ".svg"}
AUDIO_EXT = {".wav", ".mp3", ".aac", ".m4a", ".flac", ".aif", ".aiff", ".ogg", ".opus"}
PREFIX = {"video": "VID", "image": "IMG", "audio": "AUD"}


def kind_of(path):
    ext = path.suffix.lower()
    if ext in VIDEO_EXT:
        return "video"
    if ext in IMAGE_EXT:
        return "image"
    if ext in AUDIO_EXT:
        return "audio"
    return None


def ratio(value):
    try:
        f = Fraction(value)
        return float(f) if f.denominator else None
    except (ValueError, ZeroDivisionError, TypeError):
        return None


def ffprobe(path):
    cmd = ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        return None, res.stderr.strip() or "ffprobe failed"
    return json.loads(res.stdout), None


def rotation_of(stream):
    rot = stream.get("tags", {}).get("rotate")
    if rot is not None:
        return int(float(rot))
    for sd in stream.get("side_data_list", []):
        if "rotation" in sd:
            return int(float(sd["rotation"]))
    return 0


def describe(path, kind):
    info, err = ffprobe(path)
    entry = {"filename": path.name, "path": str(path), "type": kind, "size_bytes": path.stat().st_size}
    if err:
        entry.update({"technical_condition": f"UNREADABLE: {err}"})
        return entry
    fmt = info.get("format", {})
    streams = info.get("streams", [])
    v = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = [s for s in streams if s.get("codec_type") == "audio"]
    dur = fmt.get("duration")
    entry["duration_s"] = round(float(dur), 3) if dur and kind != "image" else None
    entry["container"] = fmt.get("format_name")
    entry["bitrate_bps"] = int(fmt["bit_rate"]) if fmt.get("bit_rate") else None

    if v:
        w, h = v.get("width"), v.get("height")
        rot = rotation_of(v)
        dw, dh = (h, w) if rot in (90, -90, 270, -270) else (w, h)
        r_fps = ratio(v.get("r_frame_rate"))
        avg_fps = ratio(v.get("avg_frame_rate"))
        entry.update({
            "video_codec": v.get("codec_name"),
            "pixel_format": v.get("pix_fmt"),
            "coded_resolution": f"{w}x{h}" if w and h else None,
            "rotation": rot,
            "display_resolution": f"{dw}x{dh}" if dw and dh else None,
            "orientation": None if not (dw and dh) else ("landscape" if dw > dh else "portrait" if dh > dw else "square"),
        })
        if kind == "video":
            entry["fps"] = round(avg_fps or r_fps, 3) if (avg_fps or r_fps) else None
            entry["variable_frame_rate_suspected"] = bool(r_fps and avg_fps and abs(r_fps - avg_fps) > 0.01)
            entry["frame_count"] = int(v["nb_frames"]) if v.get("nb_frames", "").isdigit() else None
            entry["color"] = {k: v.get(k) for k in ("color_space", "color_transfer", "color_primaries") if v.get(k)}
    entry["audio_present"] = bool(audio)
    entry["audio_streams"] = [
        {"codec": a.get("codec_name"), "channels": a.get("channels"),
         "sample_rate": int(a["sample_rate"]) if a.get("sample_rate") else None,
         "language": a.get("tags", {}).get("language")}
        for a in audio
    ]
    entry["technical_condition"] = "readable"
    # Creative fields are filled in by inspection, not by this script.
    for k in ("source_classification", "content_description", "recommended_usage", "restrictions", "duplicate_status"):
        entry[k] = "TBC"
    return entry


def collect(inputs):
    files = []
    for raw in inputs:
        p = Path(raw)
        if p.is_dir():
            files += sorted(f for f in p.rglob("*") if f.is_file() and not f.name.startswith("."))
        elif p.is_file():
            files.append(p)
        else:
            print(f"warning: not found: {raw}", file=sys.stderr)
    return files


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--out", help="write manifest JSON here (default: stdout)")
    args = ap.parse_args()

    counters = {"video": 0, "image": 0, "audio": 0}
    assets, skipped = [], []
    for f in collect(args.inputs):
        kind = kind_of(f)
        if not kind:
            skipped.append(str(f))
            continue
        counters[kind] += 1
        entry = {"asset_id": f"{PREFIX[kind]}_{counters[kind]:03d}"}
        entry.update(describe(f, kind))
        assets.append(entry)

    manifest = {"assets": assets, "skipped_non_media": skipped}
    text = json.dumps(manifest, indent=2)
    if args.out:
        Path(args.out).write_text(text)
        print(f"wrote {args.out}: {len(assets)} assets ({counters}), {len(skipped)} non-media skipped")
        for a in assets:
            print(f"  {a['asset_id']}  {a['filename']}  {a.get('display_resolution') or ''}  "
                  f"{str(a['fps']) + 'fps' if a.get('fps') else ''}  {a.get('duration_s') or ''}s  audio={a.get('audio_present')}  "
                  f"{'VFR?' if a.get('variable_frame_rate_suspected') else ''}  {a['technical_condition']}")
    else:
        print(text)


if __name__ == "__main__":
    main()
