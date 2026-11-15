# Converting a video part into a script part

Source: tarasdiary's "Sonic at High School 3: Love Story" on YouTube, a slideshow of fan art and anime stills with
subtitles. The subtitles were OCR'd into study packs, one folder per playlist position:

    PACKS=/private/tmp/claude-501/-Users-obsidian-Projects-heatsync/949ba623-70f7-45bb-88bc-32a2b0c8663b/scratchpad/yt/parts

Story part k lives in folder `k` for k <= 8 and folder `k + 1` for k >= 9 (playlist position 9 is a duplicate
"Part 8 without music", skip it). Folder numbers are two digits (`$PACKS/07`).

Each folder has
- `lines.txt`: one subtitle per row: number, start second, seconds on screen, text colour, OCR text. Rows like
  `[no subtitles for 40s: pictures over music]` mark song montages.
- `sheetA.jpg`, `sheetB.jpg`, ...: the frame behind each subtitle, numbered in yellow, 20 per sheet. Look at them:
  they show who is speaking (the character pictured), where the scene is, and what is happening.

Speaker clues: the picture usually shows the speaker. The text colour is a faint tint per speaker (for example
blue-white #f8faff is Sonic, green-white #f8fff8 is Manic, pink-white is Amy; grey or dark text is often a teacher
or Eggman). Stage directions in `*asterisks*` describe the speaker's own action. Two subtitles in a row from the
same character are common.

Write `script/partNN.json` (NN = story part, two digits) in the format of `script/README.md`, using
`script/part01.json` as the model. Rules:
- Every subtitle becomes a beat, in order. Fix OCR damage ("sp ikes" -> "spikes", "1'm" -> "I'm", stray "Do"/"De"
  fragments that are image noise, half-read duplicates). Keep the author's wording, slang and caps.
- A subtitle that is only a direction (`*falls to ground*`) becomes `{"do": ..., "who": ..., "cap": ...}` or
  `enter`/`exit`. Onomatopoeia (RIIINNNGGG, *PUNCH*) becomes an `sfx` beat with the text as `cap`.
- Start a new scene when the place changes. Pick the nearest set from the README list; use `time` for night and
  for dreams or flashbacks.
- A montage gap becomes `{"song": mood, "title": "...", "dur": seconds (cap at 20)}`. Never write song lyrics.
- Give each line a fitting `emote` and, when the text or picture implies it, a `do` and a `to`.
- Set `"title"` to a short name for the part (2 to 4 words) based on what happens.
- Use only cast ids from `src/cast.js`. A named character who is not there: use the closest existing id only if it
  is clearly the same person; otherwise note them in your final message and leave their lines with the id you
  propose (lowercase first name) so they can be added.
- Leave out anything sexually explicit and say so in your final message (this story is a teen romance, so this
  should not come up).
- Validate: `node tools/check.mjs script/partNN.json` from the project root must print 0 errors.

Final message: one line per part: part number, title, scenes, lines, any new characters or doubts. Nothing else.
