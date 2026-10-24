# Asset ingest, inspection and selects

## 1. Asset manifest

Start with `scripts/probe_assets.py <folder> --out <workdir>/manifest.json`. It assigns IDs (`VID_001`, `IMG_001`, `AUD_001`…) and records the technical fields from FFprobe. You then fill in the creative fields by actually looking at frames (`extract_frames.py`) and listening.

Per asset:

| Field | Source |
|---|---|
| Asset ID, filename, path, type | script |
| Duration, resolution, fps, VFR flag, rotation, orientation, codec, pixel format, bitrate, audio streams/channels/sample rate | script (FFprobe) — never estimate |
| Source classification (provenance) | user / brief |
| Technical condition | your inspection |
| Content description | your inspection |
| Recommended usage / restrictions / duplicate status | your analysis |

Rename semantic IDs like `VO_001`, `MUSIC_001`, `LOGO_001` in your manifest if useful — but never rename or move the original files.

Present the manifest as a compact table; keep the JSON as the cached source so assets aren't re-probed unnecessarily.

## 2. Provenance

Classify every asset:

`CLIENT_APPROVED` · `CLIENT_REFERENCE_ONLY` · `GENERATED_APPROVED` · `GENERATED_UNAPPROVED` · `STOCK_LICENSED` · `STOCK_PENDING_APPROVAL` · `INTERNAL_ASSET` · `UNKNOWN_SOURCE`

Reference images/videos, AI generations, internet assets, stock, unlicensed music and third-party logos are **not** production assets until approved. If provenance is unclear, mark `UNKNOWN_SOURCE` and ask before using it in the edit.

## 3. Technical & creative inspection

Evaluate: resolution · frame rate (and VFR — conform before editing) · orientation/rotation metadata · exposure · white balance · stability · focus · motion blur · noise · compression · duration · composition · visual consistency · audio quality.

Classify: hero · establishing · detail · lifestyle · people · product · architecture · environment · location · drone · interview · dialogue · graphic · logo · CTA · supporting · weak · duplicate · technically unusable.

Look at frames before judging — sample with `extract_frames.py --every 2` (or more densely on short clips) and view the images. If you couldn't view a clip, say so in the manifest rather than guessing its content.

## 4. Shot analysis (usable footage)

Shot type · subject · action · environment · camera movement and direction · composition · emotional value · narrative value · best usable section (start/end timestamps) · strongest moment · continuity compatibility · text-safe area · reframe suitability (e.g. 16:9 → 9:16 crop safety) · stabilisation need · speed-ramp / slow-motion suitability (needs high fps source for clean slow-mo) · transition opportunities.

Timestamps must come from what you actually checked (frame extraction at known times, or transcript timings). Mark approximations as approximate.

## 5. Selects pool

Choose what best serves story, message, brand, emotional progression, visual quality, platform and objective. Where several clips are similar, pick the strongest and note the alternates. Don't select clips just because they exist. Flag gaps — mandatory shots that are missing, or story beats with no usable coverage — before the contact sheet, so directions are built on real material.

## 6. Reference analysis

For each supplied reference, note: hook · narrative structure · shot rhythm and average shot length · camera language · framing · typography and text hierarchy · colour · music relationship · sound design · transition vocabulary · graphic language · pacing · ending · CTA treatment.

Extract the creative grammar ("hard cuts on kick drum, 0.6–0.8 s shots, kinetic serif headlines bottom-third") and apply it with this project's own assets and brand. Don't replicate another brand's identity or proprietary assets.
