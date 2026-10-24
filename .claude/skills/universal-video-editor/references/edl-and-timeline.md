# EDL, timeline maths, Remotion build and previews

Only start this after explicit contact-sheet approval.

## 1. Edit Decision List

The EDL is the source of truth for the timeline; the Remotion code is generated from it, not from prose. Write it as JSON (so `check_edl.py` can validate it) and show the user a readable table.

```json
{
  "project": "Brand_Reel",
  "version": "V01",
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "target_duration_s": 30,
  "assets": { "VID_003": { "path": "footage/A003.mp4", "duration_s": 12.4 } },
  "events": [
    {
      "id": "E01",
      "track": "V1",
      "asset": "VID_003",
      "timeline_in": 0,
      "timeline_out": 45,
      "source_in": 90,
      "source_out": 135,
      "speed": 1.0,
      "crop": "center 9:16", "scale": 1.08, "position": "0,0", "reframe": "follow subject left→centre",
      "transition_in": null,
      "transition_out": { "type": "crossfade", "frames": 8 },
      "copy": "Hello, Mumbai",
      "typography": "H1, bottom third, left aligned",
      "graphics": null,
      "audio": "nat sound -18 dB under music",
      "notes": "hook frame"
    }
  ]
}
```

All `timeline_*` and `source_*` values are **integer frames** at the master fps. `timeline_out` is exclusive. `source_out - source_in` must equal `(timeline_out - timeline_in) × speed` (allow ±1 frame rounding). Tracks: `V1`/`V2`… for picture, `T1`… for text/graphics, `A1`… for audio. Only V1 is checked for gaps.

Run `python scripts/check_edl.py edl.json`. Fix every error before building. Warnings (e.g. runtime differs from target) need a deliberate decision.

## 2. Timeline mathematics

- `frame = round(seconds × fps)`; one master fps for the whole project. Conform VFR sources first (FFmpeg `-vsync cfr`/`-fps_mode cfr` on a copy).
- A transition of N frames between two V1 clips means they overlap by N frames: clip B's `timeline_in` = clip A's `timeline_out − N`. Declare it as `transition_out.frames` on A; `check_edl.py` then expects exactly that overlap. Any other overlap or gap on V1 is an error (black frames / flash frames).
- Total runtime = last V1 `timeline_out`. Validate against target, plus CTA and disclaimer display durations (legal copy often has a minimum read time — roughly 1 s per 3–4 words is a sensible floor if none is specified; label it a recommendation).
- Audio and captions use the same frame base; caption times from WhisperX (seconds) are converted with the same formula and offset by the clip's timeline position minus source in.

## 3. Short-form retention logic

| Time | Job |
|---|---|
| 0–1 s | pattern interrupt / immediate visual value |
| 1–3 s | hook confirmation — the viewer knows what this is |
| 3–8 s | escalation / information delivery |
| 8 s → | retention resets every few seconds |
| end | payoff / CTA / loop |

Retention resets: shot change, scale change, punch-in, new information, text change, sound cue, motion change, reveal, camera move, visual contrast. Each must earn its place by helping comprehension, story, emotion, attention or brand — no effects for the sake of movement.

## 4. Editing priority

Story → meaning → visual quality → motion → music beat → effects. Cut on the music where it supports the story; don't turn the edit into a beat-detection demo.

## 5. Remotion implementation

- Check for an existing Remotion project/template first and follow its conventions. Otherwise scaffold one (`npx create-video@latest` or a minimal `remotion` + `@remotion/cli` setup) in a work folder, not over the user's files.
- Load the EDL JSON as data; derive `durationInFrames`, `fps`, `width`, `height` from it. No hard-coded magic timings in components.
- Separate reusable components: `<Clip>` (OffthreadVideo + trim via `startFrom`/`endAt` or `trimBefore`/`trimAfter` depending on the installed version — check the installed docs), `<Still>`, `<Title>`, `<Captions>`, `<Logo>`, `<Transition>`, `<CTA>`, `<Disclaimer>`, `<Audio>` layers, background graphics. Use `<Sequence from durationInFrames>` per EDL event.
- Use the brand fonts from the Brand Profile (load local font files; don't substitute silently — if a font is missing, say so and propose a labelled fallback).
- Reference source media by path to proxies for previews, originals for final render.
- Render with `npx remotion render <entry> <CompositionId> out/<Project>_V01_preview.mp4 --scale=0.5` (preview) and full scale for final. Confirm the CLI flags against the installed version.

## 6. Performance & caching

Reuse `manifest.json`, cached transcripts and extracted frames; generate proxies for heavy footage (e.g. 720p H.264 copies); render low-res previews first; pre-render expensive reusable elements. Don't re-analyse unchanged assets.

## 7. Staged previews

1. **Structure** — shot order, story, timing, hook, runtime, main copy placement. Low-res is fine.
2. **Creative** — typography, graphics, transitions, motion, colour, music, sound design, CTA.
3. **Final QC** — final branding, disclaimer, regulatory info, CTA, final audio and colour.

Get feedback at each stage before spending the next stage's render cost. Name previews with the version (`Project_V01_structure.mp4`) and verify each with `validate_export.py` before sharing.
