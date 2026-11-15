# Sonic at High School 3: Love Story, in 3D

**Watch it: https://virgilvox.github.io/sonic-at-high-school-3d/**

Around 2010, tarasdiary uploaded *Sonic at High School 3: Love Story* to YouTube: 39 parts of fan art slideshows,
subtitles, and emo songs between scenes. This is that story acted out in a browser by 3D models, every line voiced,
with a camera director doing its best. It is a meme, a remake made for fun. Nothing here is meant seriously, least of
all the dodgeball.

The original playlist: https://www.youtube.com/playlist?list=PLRxk4957KpcxexcS8N13wW0BW2MupqD1m

## Watching

Pick a part or play from the start. Space pauses, the right arrow skips a line, N and P jump between scenes, C toggles
captions, F frees the camera (drag to orbit, right-drag or two fingers to pan, scroll or pinch to zoom). The Voices
button switches between the baked voices and your browser's own speech, where you can recast anyone.

It works on phones and tablets (landscape frames best), but the site pulls about 200 MB of models, voices and music,
so a desktop browser on decent wifi is the comfortable way to watch.

## How it was made

The videos are pictures with the dialogue as subtitles, so the subtitles were read off the frames with macOS's text
recognizer, cleaned up, and turned into a script of beats: who speaks, to whom, what they do, where they are
(`script/`, one file per part). The player stages each scene from that: sets built from kit pieces, characters seated
or standing where the scene puts them, a director that follows dialogue coverage rules, music picked per scene, and
voice clips baked ahead of time. Characters that have no model of their own wear a recoloured stand-in.

Build it yourself:

    npm install
    npm run build     # dist/web is the site, dist/love-story.html is the whole thing in one offline file

`tools/` holds the pipeline (subtitle extraction, voice baking with Kyutai Pocket TTS, set kit packing, model
conversion, tests).

## Credits

- **Story:** *Sonic at High School 3: Love Story* by tarasdiary on YouTube. The script follows the subtitles.
- **Characters:** Sonic the Hedgehog and friends belong to SEGA. This is a non-commercial fan project with no
  affiliation to SEGA or tarasdiary.
- **Character models:**
  - **VRoid Hub, shared by Artyom4ik_72Rus** (https://hub.vroid.com/en/users/92039721):
    - Sonic by ANDRENYA
    - Amy Rose by waleedtariqmmd
    - Knuckles by kurokishi
    - Shadow and Tails by Artyom4ik_72Rus
    - Tikal, Rouge, Blaze, Sally, Silver, Cream and Vanilla
  - **VRoid Hub, shared by TheBlueBlurHERO:** Espio by samlssms; Scourge and Vector
  - **VRoid Hub, shared by DragonXEOUi:** Eggman and Metal Sonic
  - **VRoid Hub, single models:**
    - Maria Robotnik by Milkie Artz
    - Amy Rose 7.0 (Popstar Outfit) by SweetPassion
    - Silvia The Hedgehog by Iliana
  - **Sketchfab:** Manic The Hedgehog by anderlenolan, CC BY 4.0, converted to VRM here
  - **Background students:** VRoid Project sample avatars by pixiv (CC0)
  - **Full list:** `assets/vrm/CREDITS.json`
- **Motion:** Quaternius Universal Animation Library (CC0).
- **Voices:** Kyutai Pocket TTS, using its built-in voices.
- **Music:** Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0.
  Tracks: Carefree, Touching Moments Two - Higher, Heartbreaking, Hidden Agenda, Dreamer, Easy Lemon, Volatile
  Reaction, Run Amok, Long Note Four, Heroic Age, Sneaky Adventure.
- **Sets:** Kenney (kenney.nl) Furniture, Nature, Car, Retro Urban and City kits (CC0).
- **Sound:**
  - "Footsteps on different surfaces" by congusbongus (OpenGameArt), from recordings by swuing (freesound.org),
    CC BY 3.0.
  - "Crowd Shouting/Speaking Ambience" (OpenGameArt), CC0.
  - School chatter generated with Pocket TTS voices.
- **Libraries:** three.js and @pixiv/three-vrm (MIT).

If you made one of these models, or the original series, and want your work credited differently or taken out,
open an issue and it will be handled.

## Licence

The code is MIT (see `LICENSE`). Models, music, sounds and the story belong to their creators under the terms above.
