# Visual standards: typography, safe zones, colour, continuity, AI visuals, facts

## Typography system

Decide before setting any text: primary font · secondary font · weight hierarchy · case treatment · title / body / caption scale · max line count · alignment · safe margins · emphasis style · CTA treatment · disclaimer treatment. Record it in the Project Profile.

Avoid: arbitrary font switching, too many weights or colours, text hugging edges, over-highlighting, inconsistent sizes, text over key subjects, poor line breaks, decorative motion that hurts readability. Bold editorial typography is composed with the image (scale, placement, negative space), not treated like subtitles.

Legibility floor (recommendation): on 1080-wide vertical video, body text rarely reads below ~40 px; disclaimers often need ~28–32 px minimum and enough time on screen.

## Platform safe zones

Don't assume the whole 9:16 frame is visible. Platform UI (captions bar, username, buttons, progress bar) covers roughly the bottom ~20–25 %, the top ~10–14 % and a strip on the right ~10–15 %. Keep faces, logo, headline, CTA, contact info, disclaimer, product details and legal copy inside the central safe area. Check the current platform spec when the brief names a platform, and state the margins you used. For 16:9 broadcast-style output, use ~5 % action-safe / ~10 % title-safe margins.

## Colour workflow

1. **Technical correction** — white balance, exposure, contrast, clipping, shadow detail, saturation, colour casts, log → Rec.709 conversion with the correct camera transform.
2. **Shot matching** — match cameras and adjacent shots.
3. **Creative grade** — the approved look, applied after matching.

Don't blindly apply one LUT to everything. Protect realistic skin tones unless the approved style deliberately departs. In Remotion/FFmpeg, grades can be baked into graded proxies (FFmpeg `lut3d`, `eq`, `colorbalance`) on copies; keep originals untouched.

## Continuity check

Before locking shot order: screen direction · subject position · camera-move direction · lighting and time of day · architecture · product appearance · wardrobe · props · eyeline · action · geography · weather · environment. Intentional breaks are fine; accidental ones aren't.

## AI-generated visuals

Use generation only where appropriate to the project and approved. Generated material never silently becomes factual source material.

- Track every generated asset in the manifest as `GENERATED_UNAPPROVED` until the user approves it (`GENERATED_APPROVED`), and label it AI-generated internally.
- Lock continuity across generated frames: subject identity and facial structure, clothing, architecture, product geometry, vehicles, furniture, landscape, lighting direction, time of day, camera perspective and lens language, geography, weather, brand placement. Avoid uncontrolled morphing between consecutive frames.
- Never generate and present as factual: non-existent amenities, buildings, roads, infrastructure, views, product features, architecture, location claims or regulatory details.

## Factual integrity

Never invent statistics, prices, offers, discounts, distances, possession dates, developer claims, specifications, awards, customer counts, infrastructure, amenities, government approvals, regulatory numbers or legal claims. Use only approved source material. If supplied copy contains a claim you can't trace to an approved source, flag it before publication with the exact line and what's needed to support it.
