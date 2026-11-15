# Script format

One file per part: `script/partNN.json` (NN is 01 to 39). The build merges them into `script/parts.json`.

```json
{ "part": 1, "title": "The Nightmare", "scenes": [
  { "set": "hallway", "time": "dream", "cast": ["sonic"], "at": { "sonic": "bed" }, "beats": [ ... ] }
] }
```

Scene fields
- `set`: one of hallway, classroom, bedroom, bathroom, kitchen, livingroom, cafeteria, gym, office, stage,
  schoolfront, street, park, field, void. Pick the closest; a new place is a new scene.
- `time`: day, sunset, night or dream (dreams, flashbacks and nightmares).
- `cast`: ids on stage when the scene opens. Anyone who appears later uses `enter`.
- `game` (optional): `dodgeball` lines the cast up as two teams (worked out from who throws at whom), puts balls on the
  centre line and flies a ball on every `throw` with a `to`. `coach`: an id who stands on the sideline instead.
- `at` (optional): put someone on a named spot when the scene opens: `bed` (bedroom, lying), `couch`, `bench`, `teacher`, `seat1`, `seat2`.

Beats, played in order
- `{"say": "sonic", "text": "Amy? *walking through the corridors*", "to": "amy", "emote": "worried", "do": "walk"}`
  `text` is the original subtitle with OCR mistakes fixed, stage directions kept in `*asterisks*` (shown, not spoken).
  `to`, `emote` and `do` are optional. `do` is acted while the line plays.
- `{"think": "sonic", "text": "..."}` for thoughts.
- `{"do": "run", "who": "sonic", "to": "amy", "cap": "*running towards her*"}` an action with no line. `cap` is the
  original direction text when the subtitle was only a direction. `to` is an actor id, a spot, or `off`.
- `{"enter": "amy", "cap": "*walks in*", "run": true}` and `{"exit": "manic", "cap": "*walking into the bathroom*"}`.
- `{"sfx": "bell", "cap": "RRIIINNNGGG!"}` sounds: bell, alarm, punch, thud, door, knock, phone, crowd, whoosh, sparkle, gasp, brush, spit, zap.
- `{"card": "The next morning"}` a title card (for the opening title, time skips, "To be continued").
- `{"song": "sad", "title": "a song plays", "dur": 10}` a montage where the video plays music over pictures with no
  dialogue. Moods: sad, love, happy, tense, dream. Do not copy song lyrics; `title` describes the moment.
- `{"fx": "flash"}` flash, shake, dream, fadeout, fadein. `{"wait": 1.5}` a pause.

Actions for `do`: walk, run, approach, turn, face, wave, point, clap, cheer, shrug, think, beckon, fist, present, hands,
nod, no, punch, jab, slap, hit, knockback, fall, faint, getup, wake, jump, throw, pickup, grab, knock, use, eat, drink,
brush, sit, stand, crossarms, phone, dance, kneel, struggle, push, idle, freeze, cry, laugh, smile, blush, wink, smirk,
glare, gasp, sigh, hug, kiss, lie, sleep.

Emotes: happy, sad, angry, surprised, relaxed, scared, worried, smirk, blush, annoyed, shocked, crying, excited, neutral.

Cast ids: sonic, amy, knuckles, tikal, tails, manic, sonia, sally, cream, rouge, blaze, maria, shadow, silver, espio,
vector, eggman, robot, crowd, fangirls, narrator. Add new people to src/cast.js first.

Keep it faithful: every subtitle line from the video becomes a beat, in order, with its wording (typos fixed only
where OCR broke them; keep the author's own spelling and style).
