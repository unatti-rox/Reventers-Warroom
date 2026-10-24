# Revisions, versioning, QC and delivery

## Revision workflow

1. Interpret each note; restate ambiguous ones back to the user.
2. Map each to EDL event IDs.
3. Preserve approved elements unless the note changes them.
4. Implement in the EDL, re-run `check_edl.py`, rebuild.
5. Bump the version.
6. Update the change log.
7. Render the revised preview and verify it.
8. Re-run the QC sections the change could affect.

If the revision changes the creative direction (new structure, new hook strategy, new tone), go back to the contact-sheet stage. A limited revision inside the approved direction keeps the existing approval. A new independent project always needs fresh approval.

## Version control

Never overwrite an approved output unless explicitly told to. Use incremental names: `ProjectName_V01`, `_V02`, … (follow the client's naming convention if given). Keep a concise change log:

```
V03
- Shortened opening by 0.8 s (E01 out 54→30)
- Replaced VID_014 with VID_017 at E06
- Increased headline scale 96→112 px
- Music −3 dB under VO
- Updated CTA copy
- Corrected disclaimer wording
```

## Final QC

Report each item as PASS / FAIL / NOT CHECKED (with reason). Never mark PASS for something you didn't actually check.

**Edit** — no unintended black or flash frames, missing clips, freeze frames, gaps or overlaps; no unneeded duplicate shots; transitions intact; runtime correct. Tools: `check_edl.py`; `ffmpeg -i out.mp4 -vf blackdetect=d=0.05:pix_th=0.1 -an -f null -`; `freezedetect`.

**Text** — spelling, grammar, names, project/product names, numbers, CTA, phone, website, contact details, disclaimer, regulatory info, brand terminology — checked against approved copy, character by character for numbers and URLs.

**Brand** — correct logo and variant, colours, fonts, approved typography and style, CTA treatment.

**Audio** — dialogue/VO intelligible, no clipping or distortion, music level, no loudness jumps, no unwanted silence or abrupt cuts, sync, captions in sync. Measure loudness with `loudnorm` and report the numbers.

**Visual** — no stretching, wrong aspect ratio, accidental crop, visible masks, broken graphics, AI artefacts, inconsistent logo, continuity errors; important text inside safe zones; colour consistent. Spot-check with extracted frames at each cut and every text event.

**Compliance** — claims supported, legal copy correct, disclaimer present and on screen long enough, regulatory info correct, mandatory frames present, prohibited claims/visuals absent.

**Export** — `python scripts/validate_export.py <file> --width W --height H --fps F --duration D [--require-audio] [--vcodec h264]`: file exists, size > 0, video stream, audio stream if required, duration, resolution, fps, codec, aspect ratio, file decodes.

## Final export

Only after the required approvals and QC. Follow the approved resolution, fps, codec, aspect ratio, naming, version, destination, language and platform specs. A sensible default if unspecified (label as recommended): H.264 High, yuv420p, AAC 48 kHz stereo, `-movflags +faststart`. Create alternates (16:9, 9:16, 1:1, 4:5, cutdowns, captioned/clean, alt CTA, language versions) only when requested. Validate every file delivered.

## Approval-gate checklist

Keep this updated in progress reports:

```
[ ] Project intake complete
[ ] Current Project Profile created
[ ] Brand Profile created
[ ] Production brief validated
[ ] Asset manifest created
[ ] Assets technically inspected
[ ] Assets creatively analysed
[ ] Selects pool created
[ ] Contact Sheet Option 1 created
[ ] Contact Sheet Option 2 created
[ ] Contact Sheet Option 3 created
[ ] Recommended direction presented
[ ] Contact Sheet direction explicitly approved      ← hard gate
[ ] Hybrid Contact Sheet approved (if applicable)
[ ] Edit Decision List created
[ ] Transcript / audio prep completed (where required)
[ ] Timeline created
[ ] Structure preview reviewed
[ ] Creative preview reviewed
[ ] Final preview reviewed
[ ] Compliance checked
[ ] Technical QC completed
[ ] Final export approved
[ ] Final output validated
```
