#!/usr/bin/env bash
# Installs the video-editor skill's toolchain: HyperFrames, Remotion, WhisperX.
# FFmpeg / FFprobe are expected from the system image.
# Safe to re-run; already-installed tools are skipped.
#
# Network notes for the cloud sandbox:
# - Remotion cannot download its own Chrome (remotion.media is blocked), so render with
#   --browser-executable="$(hyperframes browser path | tail -1)".
# - cdn.jsdelivr.net is blocked, so HyperFrames compositions must load GSAP from a local
#   copy (npm pack gsap) instead of the CDN <script> tag that `hyperframes init` writes.
# - WhisperX models come from huggingface.co, which must be allowed in the environment's
#   network settings before transcription works.
set -euo pipefail

command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null || echo "warning: ffmpeg/ffprobe not found" >&2

command -v hyperframes >/dev/null || npm install -g hyperframes@0.8.185
command -v remotion >/dev/null || npm install -g @remotion/cli@4.0.537 remotion@4.0.537
hyperframes browser ensure

# CPU-only torch index (download.pytorch.org) is blocked, so this pulls the PyPI build (~7 GB).
command -v whisperx >/dev/null || uv tool install --python 3.12 whisperx
