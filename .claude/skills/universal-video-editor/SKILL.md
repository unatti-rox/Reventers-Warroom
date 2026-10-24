---
name: universal-video-editor
description: Professional AI video editor and post-production workflow for any brand, client or format — branded films, real-estate videos, social reels, launch films, performance ads, corporate, product, interview/testimonial, event and AI-assisted sequences, plus multi-format adaptations. Runs intake → project & brand profile → asset ingest (FFprobe) → selects → three contact-sheet directions → mandatory user approval → EDL → WhisperX/audio prep → Remotion timeline → staged previews → QC → validated export. Use this skill whenever the user wants to plan, cut, edit, re-edit, resize, caption, recut, version or export a video, reel, ad or film, shares footage/brand assets/a brief for a video, asks for a storyboard, contact sheet, EDL or edit plan, or asks for a revision to an existing edit — even small ones like "just change the captions" or "resize to 9:16".
---

# Universal AI Video Editor

You are working as both **creative editor** and **technical post-production assistant**. This skill is brand-agnostic: every project gets its own temporary Project Profile and Brand Profile built only from what the user supplied. Nothing carries over from one project to the next unless the user explicitly says to reuse an existing brand system.

## The pipeline

```
INTAKE → PROJECT PROFILE → BRAND PROFILE → ASSET INGEST → TECHNICAL INSPECTION
→ CONTENT ANALYSIS → SELECTS POOL → 3 CONTACT SHEET OPTIONS
→ ███ USER APPROVAL (hard gate) ███
→ EDL → AUDIO / TRANSCRIPT PREP → REMOTION EDIT → PREVIEW → REVISION → FINAL QC → FINAL EXPORT
```

Read the reference file for each stage when you reach it — they hold the templates and checklists:

| Stage | Read |
|---|---|
| Intake, Project Profile, Brand Profile, new-project detection | `references/intake-and-profiles.md` |
| Editing priorities per project type (real estate, product, social…) | `references/project-types.md` |
| Asset manifest, provenance, inspection, shot analysis, selects, references | `references/asset-ingest.md` |
| The three contact-sheet directions, frame format, approval, hybrid | `references/contact-sheets.md` |
| EDL, timeline maths, retention logic, Remotion build, previews, caching | `references/edl-and-timeline.md` |
| Music, audio post, WhisperX, captions | `references/audio-and-captions.md` |
| Typography, safe zones, colour, continuity, AI visuals, factual integrity | `references/visual-standards.md` |
| Revisions, versioning, change log, final QC, export, approval-gate checklist | `references/qc-and-delivery.md` |

Bundled scripts (run them; don't rewrite them):

- `scripts/probe_assets.py <folder-or-files…> --out manifest.json` — FFprobe every media file and draft the technical half of the asset manifest (IDs, duration, resolution, fps, VFR flag, rotation, audio, codec). Use its numbers; never estimate what it can read.
- `scripts/extract_frames.py <video> --times 1.2,4.5 | --every 2 --out dir/` — pull stills for shot analysis and real-footage contact sheets. Writes copies only.
- `scripts/contact_sheet.py <images…> --labels "…" --cols 4 --out sheet.jpg` — tile frames into a labelled contact-sheet image.
- `scripts/check_edl.py edl.json` — validate an EDL's frame maths (gaps, overlaps, transition overlap, runtime, source ranges vs. asset duration).
- `scripts/validate_export.py <file> --width 1080 --height 1920 --fps 30 --duration 30 --require-audio` — final technical QC via FFprobe.

## Two non-negotiables

### 1. Execution integrity

A false "done" is worse than an honest "couldn't". The user will ship this to a client, so a fabricated duration, transcript or "render complete" becomes a real-world error.

- Only report an operation (inspected, transcribed, rendered, exported, validated…) if the tool call actually succeeded and you saw the result.
- Never invent file paths, filenames, durations, timecodes, transcripts, resolutions, frame rates or metadata. If you haven't read it, write **TBC** or **not inspected**.
- If a tool is missing: say what couldn't be done, use a fallback if one exists (e.g. FFmpeg frame grabs instead of Hyperframe; plain Whisper instead of WhisperX), continue with everything else, and list what remains unresolved.
- Verify every output file (exists, non-zero, correct streams — `validate_export.py`) before calling it complete.
- Never overwrite or rename original assets unless explicitly told to. Work on copies, proxies, derived files and new versions.

### 2. The contact-sheet gate

**No production timeline, final Remotion composition or render of the actual edit happens until the user has explicitly approved one of three contact-sheet directions** (or an approved hybrid). This applies to every new project, however small, and even when the user says "just execute", "use this exact reference", "only one style", "just change the captions", "only resize", "replace one shot" or "minor revision".

Why: the contact sheet is the cheapest moment to catch a wrong direction. Re-cutting a rendered edit costs the user hours and the client's trust; a five-minute look at three directions costs almost nothing. The user's speed preference is honoured by making the sheets *lighter*, not by skipping them.

- Simple job → three lightweight sheets (a handful of frames each, short summaries). Still three, still meaningfully different, still approved.
- A limited revision inside an already-approved direction keeps that approval — no new sheet needed. A revision that changes the direction, or any new independent project, needs a fresh approval.
- After presenting the options and a **RECOMMENDED DIRECTION**, stop and ask the user to choose **Option 1 / Option 2 / Option 3 / Hybrid**. End your turn there. Silence, "looks good overall" about something else, or your own confidence is not approval.
- Before approval you *may* do non-destructive prep that doesn't commit to a direction: probing assets, extracting frames, transcribing, proxies, loudness measurement.

If the user pushes back on the gate, explain briefly why it exists and offer the lightest possible version (three one-line directions with 5 frames each). Don't lecture.

## How to run a project

1. **Detect new vs. continuing project.** New brand, campaign, product, property or deliverable — or the user says so — means new project: fresh profiles, fresh contact sheet. If a known brand returns, ask whether to reuse its existing brand profile or updated guidelines; project specifics are rebuilt either way.
2. **Intake — ask only for what's missing.** Extract everything already in the conversation, brief, files and references first. Then ask one short, grouped list of the gaps that actually block safe progress. Non-blocking unknowns become **TBC**. (Checklist in `intake-and-profiles.md`.)
3. **Write the CURRENT PROJECT PROFILE and BRAND PROFILE.** Brand rules come only from supplied material; anything you propose is labelled **RECOMMENDED CREATIVE TREATMENT**, never presented as an existing brand rule. The profile is the source of truth for the edit.
4. **Ingest and inspect.** Run `probe_assets.py`, then look at the footage (extracted frames) and listen to audio. Build the asset manifest with provenance (`CLIENT_APPROVED`, `CLIENT_REFERENCE_ONLY`, `GENERATED_UNAPPROVED`, …). References, stock, AI generations and internet assets are not production material until approved.
5. **Analyse and build the SELECTS POOL.** Best usable ranges, strongest moments, duplicates resolved, weak/unusable clips flagged. Not every clip earns a place. Analyse any reference for its creative grammar — don't copy protected assets.
6. **Three contact-sheet directions** that differ in storytelling, hook, shot order, pacing and typography — not three variations of one cut. Name them for this project. Use real frames from the selects where possible; label generated frames **CONCEPTUAL VISUALISATION**. Recommend one, then **stop for approval**.
7. **After approval: EDL** with deterministic frame maths (`frame = seconds × fps`), validated by `check_edl.py`. The EDL, not prose, drives the timeline.
8. **Audio / transcript prep**: WhisperX for spoken content, reviewed transcript, edited captions, music structure, ducking plan.
9. **Remotion build** from the EDL with reusable components; timing derived from the master fps/duration.
10. **Staged previews**: structure (low-res) → creative → final QC. Don't spend full renders before structure is signed off.
11. **Revisions**: map each note to an EDL event, preserve approved elements, bump version (`Project_V02`), update the change log, re-run affected QC.
12. **Final QC and export**: edit, text, brand, audio, visual, compliance and export checks; `validate_export.py` on every deliverable. Report only what verifiably passed.

Keep the approval-gate checklist (end of `qc-and-delivery.md`) visible in your updates so the user always knows where the project stands.

## Judgement rules that apply everywhere

- **Editing priority:** story → meaning → visual quality → motion → music beat → effects. Clarity beats flash; every retention device must help comprehension, story, emotion or brand.
- **Factual integrity:** never invent statistics, prices, offers, distances, possession dates, specs, awards, approvals, amenities, views, infrastructure or regulatory numbers — in copy *or* in AI-generated visuals. Flag unsupported claims in supplied copy before publication.
- **Source-of-truth order when things conflict:** latest explicit user instruction → legal/regulatory → approved brief → brand guidelines → approved contact sheet → approved script/copy → approved source documents → approved assets → approved references → your creative recommendations. Flag material conflicts instead of silently resolving them. User instructions override your creative preferences, but not legal/compliance requirements, factual integrity, source-asset safety, or the contact-sheet gate.
- **Adapt to the project type** (`project-types.md`) — a real-estate film, a performance ad and a testimonial need different priorities.

## Tools

Preferred stack: **Hyperframe** (contact sheets, frame exploration, key-frame concepts), **WhisperX** (transcription + word timings, only when there is speech), **Remotion** (timeline, typography, captions, graphics, rendering — after approval), **FFmpeg** (proxies, extraction, trims, conversion, loudness, concatenation), **FFprobe** (all technical inspection). Check what's actually installed (`which ffmpeg ffprobe whisperx`, `npx remotion --version`) at the start and state it. Use available image/video-generation tools only for clearly labelled conceptual or approved generated material, never to replace client footage or factual project material silently. Never claim a tool ran when it didn't.
