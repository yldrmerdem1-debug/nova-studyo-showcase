# Architecture

Nova Studyo is an Electron desktop app. The window is a plain web UI; all work happens in a local
Express server that owns a job queue. A documentary job runs through these stages, each of which
writes its result to the job folder so the job can be resumed after a crash or a restart.

## 1. Script

- Claude Opus plans the story (hook, chapters, turning points), then writes each chapter as scenes:
  narration (`say`) with ElevenLabs v3 voice tags, a scene type (photo, film, map, counter, chart,
  headline, quote, document, montage, title card, ...), search terms for archive footage and an
  image prompt as a fallback.
- Every response is structured JSON validated against a schema. Invalid output is repaired with a
  follow-up call; an overloaded model falls back to the next one; token usage and cost are summed per
  job and checked against a budget.

## 2. Archive and era audit

- Each scene searches open archives (Openverse, Wikimedia Commons) and keeps the licence, author and
  source URL so the YouTube description can credit every image.
- The story's year is detected from the script. A vision model checks candidate pictures against the
  era: for a story before ~1850 photographs are rejected outright, and anachronisms (modern clothes,
  cars, buildings) are replaced. Perceptual hashes stop the same photo appearing twice.
- AI-generated images are used only when the archive cannot cover a scene.

## 3. Art direction

- Per video the art director picks a look (grade, grain, paper, typography), a text style for
  on-screen labels, an opening treatment (headlines, timestamps, cold open, evidence board, map dive,
  quote, classic montage) and a topic motif. The choice is constrained by what the script can support
  and by a channel history, so consecutive videos do not share an
  opening or a look.
- A design gate renders still frames and rejects repetitive or empty-looking layouts.

## 4. Narration, music, sound

- ElevenLabs v3 narration with word-level timestamps. Those timestamps drive subtitles, cut points
  and when on-screen text lands.
- Music comes from a local library that was tagged once by an AI pass (mood, energy, genre,
  instruments, era/culture fit, licence). The audio director builds a cue sheet from the script's
  moods, prefers period-appropriate instruments (medieval for 1453, jazz for 1929), avoids repeating
  tracks used in recent videos, and places hits, whooshes, ambience beds and foley on a beat grid.
  Sounds that read as cheap (for example a mechanical counter tick) are on a ban list.
- The final mix is loudness-normalised for YouTube.

## 5. Render

- The engine is a Remotion 4 project (React + TypeScript). A script becomes a props file; the
  composition draws 20+ scene types with camera moves, transitions and overlays.
- The timeline is split into chunks rendered one at a time to keep memory use within a 16 GB laptop.
  Chunks are cached under a fingerprint of the engine bundle and the chunk's own props, so a re-render
  after a small fix only redoes the affected chunks. Chunks are joined and muxed with ffmpeg.

## 6. Packaging and Shorts

- **YouTube package:** candidate frames from the video are ranked by a vision model; Claude plans three
  thumbnail concepts and five titles; thumbnails are rendered by the same engine and checked for text
  legibility at 320×180. The description includes chapters and the full credit list.
- **Shorts teaser:** Claude writes a new 45-55 s teaser from the
  finished video's subtitles and a description of what is on screen for every line, so each teaser
  sentence is shown over the right shot. It is voiced with the same narrator, captioned word by word,
  and assembled in 1080×1920 without cropping the 16:9 picture.
