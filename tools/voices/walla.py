"""Background chatter ("walla") for the school sets, made with Pocket TTS's built-in voices: many people saying
ordinary school small talk, staggered across a loop, then softened (low pass, room echo) so no single line is
intelligible. Writes assets/sfx/amb-hallway.mp3, amb-hallway2.mp3 and amb-cafeteria.mp3.

    python tools/voices/walla.py
"""
import random, subprocess, tempfile, wave
from pathlib import Path
import numpy as np
from pocket_tts import TTSModel

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'sfx'
VOICES = ['george', 'michael', 'marius', 'jean', 'paul', 'charles', 'eve', 'mary', 'jane', 'azelma', 'anna', 'vera', 'fantine', 'eponine', 'alba', 'cosette']
LINES = [
    "Did you finish the homework for math?", "No way, that's so funny.", "Wait, what period is it?",
    "I'll see you at lunch, okay?", "Are you going to the game on Friday?", "Hey, give that back!",
    "Did you see what she posted last night?", "I totally forgot my locker combination again.", "Ugh, we have a test today.",
    "Come on, we're gonna be late.", "Okay okay, I'm coming.", "That was the best weekend ever.",
    "What did you get on the quiz?", "Seriously? No way.", "Can I borrow a pencil?", "Meet me by the gym after class.",
    "He said what? Oh my gosh.", "I can't believe it's only Tuesday.", "Save me a seat, okay?", "Who's got the notes from yesterday?",
    "Did you hear about the championship?", "My mom's picking me up early today.", "I'm so hungry, what's for lunch?", "Wait up, guys!",
    "That teacher is so strict.", "Are you trying out for the play?", "I think he likes you.", "Stop it, that's not true!",
    "Let's go to the mall after school.", "I left my jacket in the gym.", "Did you finish the reading?", "Oh no, I forgot my essay.",
    "We should totally hang out this weekend.", "Have you seen my phone?", "This is gonna be the best year ever.", "Shh, here comes the principal.",
]



PARTY = ["This song is so good!", "Let's dance!", "Did you see her dress?", "You look amazing tonight!", "Who's DJing this?", "Turn it up!",
         "I can't believe it's prom already.", "Where's the punch?", "Take a picture of us!", "Come on, come dance!", "Oh my gosh, I love this one!",
         "He asked her! Finally!", "My feet are killing me.", "This is the best night ever."]
AUDIENCE = ["Shh, it's starting.", "Is that the right curtain?", "I can't see from here.", "Where's the program?", "My cousin's in this.",
            "Turn your phone off.", "Ooh, here they come.", "Scoot over a bit.", "I hope they don't mess up."]
GYM = ["Over here! Over here!", "Pass it!", "Watch out!", "You're out!", "No way, that hit me!", "Come on, team!", "Get him!",
       "Duck!", "Nice throw!", "That's not fair!"]


def render(model, voice, text):
    st = model.get_state_for_audio_prompt(voice)
    return np.clip(model.generate_audio(st, text).detach().cpu().numpy().reshape(-1), -1, 1), model.sample_rate


def make(name, people, seed, model, loop, lines=None):
    lines = lines or LINES
    rnd = random.Random(seed)
    rate = model.sample_rate
    mix = np.zeros(int(loop * rate), dtype=np.float32)
    for k in range(people):
        voice = VOICES[k % len(VOICES)]
        pcm, _ = render(model, voice, rnd.choice(lines) + ' ' + rnd.choice(lines))
        gain = rnd.uniform(0.25, 0.6) * (0.6 if k % 3 == 0 else 1.0)   # some voices further away
        start = rnd.randint(0, len(mix) - 1)
        for i in range(0, len(pcm)):   # wrap around so the loop has no seam
            mix[(start + i) % len(mix)] += pcm[i] * gain
        print(f'{name}: voice {k + 1}/{people}', flush=True)
    mix /= max(1e-6, np.abs(mix).max())
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'mix.wav'
        with wave.open(str(wav), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes((mix * 32000).astype('<i2').tobytes())
        OUT.mkdir(parents=True, exist_ok=True)
        subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', str(wav), '-af',
                        'lowpass=f=2400,highpass=f=180,aecho=0.8:0.6:40|70:0.3|0.2,loudnorm=I=-24:TP=-4',
                        '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '48k', str(OUT / f'amb-{name}.mp3')], check=True)


if __name__ == '__main__':
    m = TTSModel.load_model()
    # two loops of different lengths per place, layered in the player, so the pattern almost never lines up
    make('hallway', 24, 1, m, 75.0)
    make('hallway2', 18, 3, m, 53.0)
    make('cafeteria', 30, 2, m, 70.0)
    make('party', 26, 4, m, 64.0, PARTY)
    make('audience', 18, 5, m, 58.0, AUDIENCE)
    make('gym', 16, 6, m, 50.0, GYM)
