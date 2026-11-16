# Handoff

## State (2026-11-15, late)

Live at https://virgilvox.github.io/sonic-at-high-school-3d/, repo github.com/virgilvox/sonic-at-high-school-3d (public).
Every push to `main` rebuilds and deploys Pages through `.github/workflows/pages.yml` (`WEB_ONLY=1 node tools/build.mjs`,
uploads `dist/web`). `npm run build` locally also writes `dist/love-story.html`, the whole film in one offline file.

The film: a cold open (the original's opening clip over three blue-graded 3D shots), the 16-bit title sequence, 39
parts (each opens on a Sonic 2 style act card), then Part 40: the credits crawl beside a window of blooper reels with
behind-the-scenes polaroids cut between them, over "Bit Shift", ending on THE END. About 1,450 voiced lines, 23 sets,
31 model files.

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
| Film gear (camera rig, softbox, boom, director's chair, slate) and the diner's meals | `src/sets.js` (`PROPS`) |
| Background students (only hallway, school front, classroom, cafeteria, audience, prom) | `src/extras.js` |
| Voices: baked Kyutai bank, browser speech, off; settings panel | `src/voice.js`, `src/voicepanel.js` |
| Music beds, swell and duck, ambience, footsteps, synthesized sound effects | `src/audio.js` |
| Model browser (title screen, MODELS) | `src/gallery.js` |
| End credits: begin, cut between reels, end; behind-the-scenes photos; credits grouped by publisher | `src/credits.js` |
| Where data comes from (embedded in the one-file build, fetched in the web build) | `src/assets.js` |
| Title screen and overlays (retro look, hack.build lockup and links top right, act cards, intro, slates) | `src/template.html`, `src/ui.js` |
| Cold open (rooftop, Amy in the rain, the walk-up) and the rain effect | `src/coldopen.js` |

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

## Staging rules worth knowing

- Every `sit` lands on a real seat (the free one nearest the target or the sitter, within 4 m), and seated people
  never turn their bodies, only their heads. `at` can name a numbered seat: `"seat:12"`.
- Stage scenes list performers in `onstage`; they stand on the platform (a deck at 0.8 m), everyone else takes the
  audience seats. `music` on a scene picks its track (graduation uses Pomp and Circumstance).
- `restrain`, `async` walks, and the blooper gags (`tpose`, `spin`, `grow`, `sink`, `float`, `moonwalk`, `phase`).
- Characters carry `bulk` (how far their quills reach) for camera clearance; very bulky ones get near frontal
  singles and no over-the-shoulder across them.
- Height changes go through `Character.floorY` (beds, the stage, gags); `updateHop` adds to it.
- `enter` can take `at: [x, z]` for an exact mark; a scene's `stand: [ids]` keeps people on their feet in sets that
  seat everyone by default (cafeteria, diner, stage, locker room). `restrain` holds the target facing whoever would
  save them and never grabs thin air.
- Songs: a scene's song beats share one track that dips under the lines and comes back (never restarts). Montages
  last at most `MONTAGE_MAX` (4.5 s); `SONG_TRACK` maps a mood to a fuller track (happy numbers play "Volatile
  Reaction", not the Carefree bed). Performers on a stage dance through a number.
- Laughs are recorded (OpenGameArt CC0, `assets/sfx/laugh-*.mp3`): a line that is only "HAHAHA" plays one instead of
  the voice, a `*laughing*` direction adds one after the words, `do: laugh` beats laugh out loud.
- Per-model repairs live on the cast entry as `fix`: `doubleSided`, `hide` (mesh names), `shrink` (an oversized
  part), `hue`/`sat`/`light` recolour and `headScale` (Amy's mom is Amy, taller and mauve).

## Camera rules worth knowing

- Two shots search closer and up to 40 degrees around on the camera's side of the line before giving up to a wide
  (a fixed spot put the lens outside the room half the time). A single blocked by the person across a table becomes
  an over-the-shoulder. A shot blocked mid-way is widened once, and a waiting cut always wins over that rescue.
- Seated speakers are framed from the front (they keep facing their table); heads lift the lens up to 0.9 m and a
  sightline passing well over someone's head is not blocked by them. Close singles step back with `bulk`.
- Wides hold the speaker, the listener and whoever is within 3 m, not the whole room.
- Stage sets (`stageFront`) are shot like a live show (`Runner.stageShot`): performers from the floor at the stage
  lip, seated audience from over the lip looking down the rows, a house wide from the back. `camZ` keeps the
  camera in front of the backdrop. Standing people on the floor get ordinary coverage.
- `node tools/camaudit.mjs [first] [last] [secs] [page]` measures every part: share of lines with the speaker off
  frame, share of wide shots, and the most lines held on one camera spot. `director.history` lists recent cuts.

## Open threads

- **Licences:** 15 character VRMs say redistribution: disallow in their own metadata. The owner chose to publish them,
  relying on the VRoid Hub page terms. If an author objects, delete that file and the cast falls back to its stand-in.
- **Still on a stand-in:** the teacher (no model given). Cosmo (aschiechan21, VRoid Hub) and Bunnie (mikomagallona,
  Sketchfab CC BY 4.0, rig map `source/rigs/bunnie.json`) have their own models. Amy's mom is Amy recoloured and
  taller (`fix` in `src/cast.js`); Sonia and Fiona use their Sketchfab models with `fix` repairs.
- **Camera (the owner's main complaint, 2026-11-15):** "camera angles fucked up all over the place", shots stuck on
  one spot, speakers out of frame. Fixed this round: blocked re-cuts starving queued cuts, two shots placed outside the
  room, cameras over tables counted as inside them, seated speakers framed from behind, crowd-wide shots, the stage
  backdrop trap, and the minimum hold now runs on wall-clock time. First `camaudit` (before fixes) had most parts at
  60 to 100% wide and up to 14 lines on one spot (Parts 6, 7, 10, 18, 28). Re-run it and compare; anything still
  holding 6+ lines or 80%+ wide needs a look. Audits must not share the CPU with a smoke run (headless timing skews).
  After the fixes (same load): wide share 3 to 57% in all parts but Part 17 (90%) and Part 31 (70%); most lines on
  one spot is 2 to 5 except Part 28 (8, an over-the-shoulder pair). Stage Parts 10 and 11 still miss the speaker on
  27 to 35% of samples (hecklers in back rows); those three and the stage are the next camera work.
- **Stage scenes** (parts 9, 10, 11, 14, 33 to 39) use `stageShot`; Part 10 was checked frame by frame. Tails' tails
  can still crowd a front-of-stage close-up when he stands side-on next to someone. Portrait phones frame tighter.
- **Smoke presence check** flags height mismatches only once a character has settled (`groundY === floorY`);
  skip mode teleports people, so mid-walk mismatches are expected there.
- **Unverified by ear:** the recorded laughs (picked by burst rhythm from a CC0 reel that also holds a cough, a "huh?"
  and a spoken LOL; check `assets/sfx/laugh-0..4.mp3`), the cold open clip level, the Kyutai voice pacing (93 takes
  kept their nearest take) and the overall music and ambience mix.
- **Not checked by ear yet:** the Kyutai voice pacing (93 takes were off pace and kept their nearest take) and the
  music and ambience mix.
- **Download size:** the site pulls about 200 MB, which is heavy on phones.
