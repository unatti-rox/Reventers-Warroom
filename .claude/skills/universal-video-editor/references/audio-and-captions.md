# Music, audio post, WhisperX and captions

## Music analysis

Where possible find: BPM · major beats · downbeats · drops · build-ups · breaks · chorus/hook · outro · emotional arc. Tools: `librosa` or `aubio` if installed for beat/onset detection; otherwise listen-derived markers stated as approximate. Only use music whose licence/approval is known (`STOCK_LICENSED`, `CLIENT_APPROVED`); otherwise flag it.

Music supports the edit — cut on structure points that serve the story, not on every beat.

## Audio post-production

Treat separately: dialogue · voiceover · production sound · music · ambience · SFX.

Priority: 1) dialogue/VO intelligibility 2) narrative audio 3) music 4) ambience 5) SFX.

Check for clipping, distortion, background noise, hum, excess reverb, plosives, sibilance, loudness inconsistency, gaps and abrupt cuts. Useful FFmpeg measurements (on copies):

```bash
ffmpeg -i in.wav -af loudnorm=print_format=json -f null -      # integrated LUFS, true peak, LRA
ffmpeg -i in.wav -af astats -f null -                           # peak / clipping indicators
ffmpeg -i in.wav -af silencedetect=noise=-40dB:d=0.4 -f null -  # gaps
```

- Duck music under VO/dialogue (sidechain or keyframed volume in Remotion).
- Use J-cuts and L-cuts where they improve flow; short audio fades (2–4 frames) on hard audio edits avoid clicks.
- Light noise reduction only — a natural voice with a little noise beats a watery, over-processed one.
- If no loudness spec is given, propose one and label it **RECOMMENDED**: e.g. about −14 LUFS integrated / −1 dBTP for social and streaming; −23 LUFS (EBU R128) or −24 LKFS (ATSC A/85) for broadcast.

## WhisperX workflow (only when there is speech)

1. Extract audio on a copy: `ffmpeg -i clip.mp4 -vn -ac 1 -ar 16000 work/clip.wav`
2. Run WhisperX with alignment for word-level timestamps, e.g. `whisperx work/clip.wav --model large-v3 --language en --output_format json --output_dir work/transcripts` (add `--diarize` with a HF token for multi-speaker interviews). Fall back to `openai-whisper`/`faster-whisper` with word timestamps if WhisperX isn't installed — and say so.
3. Cache the JSON; don't re-transcribe unchanged audio.
4. Review: correct obvious errors (names, brand/product terms, numbers) against the brief and approved copy. Mark corrections. Never present a raw automated transcript as checked.
5. Identify the key statements and use word timings to choose in/out points.
6. Segment and sync captions (below).

Never rewrite legally or factually sensitive spoken claims without approval — flag them instead.

## Caption system

Captions are edited for reading, not dumped from the transcript.

- Preserve meaning; fix transcription errors.
- Break at natural linguistic boundaries (phrase/clause), never mid-name or between number and unit; avoid orphan single words.
- Mobile vertical: ~1–2 lines, roughly 20–32 characters per line; landscape: up to ~42. Minimum on-screen time around 0.8–1 s per caption; aim ≤ ~17–20 characters/second reading speed. (Recommendations unless the brief sets rules.)
- Position to avoid faces, products, key architecture, logos, legal copy and platform UI zones.
- Emphasis highlighting (word pops, colour) must land on the spoken word's actual timing and be used sparingly.
- Export sidecar files (SRT/VTT) when requested, generated from the same corrected segments.
