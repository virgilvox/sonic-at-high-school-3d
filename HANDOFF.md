# Handoff

## State (2026-11-15)

Live at https://virgilvox.github.io/sonic-at-high-school-3d/, repo github.com/virgilvox/sonic-at-high-school-3d (public).
Every push to `main` rebuilds and deploys Pages through `.github/workflows/pages.yml` (`WEB_ONLY=1 node tools/build.mjs`,
uploads `dist/web`). `npm run build` locally also writes `dist/love-story.html`, the whole film in one offline file.

The film: 39 parts plus Part 40 (bloopers and the end credits). About 1,430 voiced lines, 20 sets, 29 model files.

## How it fits together

| Area | Where |
|---|---|
| Script, one file per part, format in `script/README.md`, checked by `node tools/check.mjs` | `script/partNN.json` |
| Cast: model, stand-in and tint, height, voice, costume (`amy-popstar` on stage and at sports), `noFoldArms` | `src/cast.js` |
| Beat runner, staging by place (`stageScene`), acting vocabulary (`ACTS`), coverage, scene music and ambience | `src/engine.js` |
| Solid bodies, walk grid A* around furniture, clear spots, detours | `src/bodies.js` |
| Camera rules (180 degree line, singles, wide OTS, re-cut when blocked, phone framing) | `src/director.js` |
| Sets (procedural rooms + Kenney kit pieces, doors that swing, ceilings hidden in free cam) | `src/sets.js`, `src/kit-assets.js` |
| Dodgeball staging and the ball | `src/dodgeball.js` |
| Background students (only hallway, school front, classroom, cafeteria, audience, prom) | `src/extras.js` |
| Voices: baked Kyutai bank, browser speech, off; settings panel | `src/voice.js`, `src/voicepanel.js` |
| Music beds, swell and duck, ambience, footsteps, synthesized sound effects | `src/audio.js` |
| Model browser (title screen, MODELS) | `src/gallery.js` |
| End credits roll and behind-the-scenes photos (the `roll` beat) | `src/credits.js` |
| Where data comes from (embedded in the one-file build, fetched in the web build) | `src/assets.js` |
| Title screen and overlays (retro look, hack.build lockup, links) | `src/template.html`, `src/ui.js` |

## Pipelines

- **Script:** subtitles OCR'd from the videos (`tools/extract/`, transcripts in `source/subtitles/`, playlist position
  9 is a duplicate so story part k is position k+1 from part 9 on). `tools/CONVERT.md` is how parts were written.
- **Voices:**
  - Run `node tools/voices/jobs.mjs`, then `~/.cache/pocket-tts/venv/bin/python tools/voices/bake.py`. It only bakes
    missing lines. Shards run in parallel with `--shard i/n`.
  - Casting is in `tools/voices/cast.json`, built-in voices only. `audition.py` measured each voice's pitch.
  - New or edited lines need a bake before they're voiced. Until then they fall back to browser speech.
- **Chatter:** `tools/voices/walla.py` writes `assets/sfx/amb-*.mp3`.
- **Models:** put a VRM in `assets/vrm/` named after the cast `model` field and credit it in `assets/vrm/CREDITS.json`.
  - A rigged GLB goes through `node tools/glb2vrm.mjs in.glb out.vrm source/rigs/<name>.json`. That file holds the bone
    map, plus `yaw: 180` for glTF facing.
  - Textures are slimmed only on models whose terms allow modification (`tools/slim-vrm.mjs`), and tints only on
    `TINTABLE`.
- **Set pieces:** list them in `src/kit-assets.js`, then run `node tools/kit.mjs`. It copies them from
  `~/Projects/heatsync/3d-assets/kenney` with textures embedded.

## Testing

- `node tools/smoke.mjs [first] [last]` plays every part with skips. It reports page errors, unfinished parts and
  presence problems: anyone on stage who is invisible, out of the room, off the floor, or hidden without an exit.
- `node tools/shot.mjs <part> [secs] [every]` saves frames. Set `PROBE` to log state, `QUERY` for other modes
  (`test=lineup`, `test=walk&who=manic`, `test=set&name=diner`, `autoplay&part=40&scene=6`), and `URL` to test the
  web build over HTTP.
- `node tools/mobile.mjs` emulates a phone: it taps Play, toggles free cam and drags.
- Headless Chrome runs slower than real time, so walk "timeouts" in probes are expected there.

## Open threads

- **Licences:** 15 character VRMs say redistribution: disallow in their own metadata. The owner chose to publish them,
  relying on the VRoid Hub page terms. If an author objects, delete that file and the cast falls back to its stand-in.
- **hack.build YouTube link:** `HACKBUILD_YOUTUBE` in `tools/build.mjs` is empty, so the link stays hidden until the
  channel URL is filled in.
- **Still on stand-ins:** Sonia, Fiona, Cosmo, Bunnie, Amy's mom and the teacher. The Sketchfab Sonia and Fiona
  conversions sit in `source/rigs/unused/`: Fiona's source model has closed eyes, and Sonia's face renders blank.
- **Shots:** close-ups still get partly blocked in the most crowded scenes, about one sample in ten in the 14-player
  dodgeball. Portrait phones frame tighter than landscape.
- **Not checked by ear yet:** the Kyutai voice pacing (93 takes were off pace and kept their nearest take) and the
  music and ambience mix.
- **Download size:** the site pulls about 200 MB, which is heavy on phones.
