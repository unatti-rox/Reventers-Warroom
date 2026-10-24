# Contact sheets — the approval gate

Every new project (and every direction-changing revision) goes through this stage before any production timeline is built. See SKILL.md for why.

## Three meaningfully different directions

The three options must differ in approach — storytelling, shot order, hook, pacing, visual emphasis, typography, narrative structure, motion, rhythm — not be three trims of one sequence. A good test: could a client describe the difference between them in one sentence each?

Name them for the project. Examples of the *kind* of spread to aim for (don't reuse these verbatim every time):
- Cinematic Luxury / Fast Social Hook / Human Story
- Product First / Problem → Solution / Brand Story
- Architecture Led / Lifestyle Led / Location → Property Reveal
- Founder Voice / Customer Proof / Data Story

If the user has dictated one exact style or reference, the three can be closer together (e.g. the same reference grammar with three different hooks or endings), but they must still be real choices.

## Frame count

- Very short edits (≤15 s, or simple jobs): ~5–8 key frames
- Most social/advertising work: ~8–15
- Longer or complex films: ~12–20

For a simple job, lightweight is fine: 5 frames per option and a short summary.

## Visual sheet

Prefer real frames from the selects pool:
1. `scripts/extract_frames.py <clip> --times <t1>,<t2> --out <workdir>/cs/opt1/`
2. `scripts/contact_sheet.py <workdir>/cs/opt1/*.jpg --labels "01 · 0:00 · Hook" "02 · 0:02 …" --title "Option 1 — …" --out <workdir>/cs/option1.jpg`
3. View the result before presenting it.

Use Hyperframe (or another available generation tool) for crop/typography mock-ups or missing key-frame concepts. Anything that is not a real production asset is labelled **CONCEPTUAL VISUALISATION** and must not alter factual elements (architecture, product geometry, location, logos). If no visual tooling works, present a text contact sheet and say that visuals couldn't be produced.

## Per-frame format

```
Frame #:
Approx. timeline position:
Source asset:            (asset ID, or CONCEPTUAL VISUALISATION)
Source timecode:         (if available — real, not invented)
Visual description:
Crop / framing:
On-screen copy:
Typography treatment:
Motion:
Transition / edit note:
Audio / music note:
```

A compact table (one row per frame) is fine when there are many frames.

## Per-option summary

Concept name · core idea · opening strategy · narrative structure · mood · pacing · approx. average shot length · music direction · sound-design direction · typography behaviour · transition style · motion style · ending/CTA strategy · strengths · limitations · why it works.

## Recommendation and stop

```
## RECOMMENDED DIRECTION
Option N — <name>, because <brief, brand, platform, audience, objective,
available assets, narrative strength, retention, feasibility>.

Which direction should I take forward?
• Option 1  • Option 2  • Option 3  • Hybrid (tell me what to take from each)
```

Then end the turn. Do not build the EDL, the Remotion timeline, or render the edit until the user explicitly picks.

## Hybrid

If the user picks Hybrid, spell out exactly what comes from where, e.g.:

```
Opening: Option 2
Main narrative structure: Option 1
Typography: Option 3
Ending: Option 1
```

Then produce a concise HYBRID CONTACT SHEET and get explicit approval of that too.

## Rejection

If all three are rejected, don't proceed. Ask what missed (or infer from the feedback), produce revised directions, and repeat until one is explicitly approved.
