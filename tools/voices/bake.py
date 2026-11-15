"""Bake every spoken line with Kyutai Pocket TTS into assets/voice/lines/<key>.mp3.

    python tools/voices/bake.py [--shard i/n] [--only speaker,speaker] [--redo]

Reads build/voice-jobs.json (node tools/voices/jobs.mjs) and tools/voices/cast.json (who gets which built-in voice,
pitch shift and effect). Lines already baked are skipped, so it can be stopped and resumed, and shards can run in
parallel. Each take is checked for a plausible speaking pace (the model now and then cuts a line short or runs on);
it retries a few times and keeps the take nearest a natural pace. Post: pitch shift, optional chorus or robot,
silence trim, loudness, mono 32 kb/s MP3.
"""
import argparse, json, subprocess, sys, tempfile, wave
from pathlib import Path
import numpy as np
from pocket_tts import TTSModel

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'voice' / 'lines'
MS_PER_CHAR = (40, 120, 65)   # plausible pace: low, high, aim (milliseconds of speech per character)
TRIES = 5


def speech_seconds(pcm, rate):
    """Seconds between the first and last 20 ms frame loud enough to be speech."""
    frame = int(rate * 0.02); n = len(pcm) // frame
    if n == 0: return 0.0
    e = np.sqrt((pcm[: n * frame].reshape(n, frame) ** 2).mean(axis=1))
    on = np.nonzero(e > max(0.003, e.max() * 0.02))[0]
    return 0.0 if len(on) == 0 else (on[-1] + 1 - on[0]) * 0.02


def take(model, state, text):
    """Generate until the pace is plausible; otherwise the take nearest the aim."""
    lo, hi, aim = MS_PER_CHAR
    chars = max(len(text), 8)
    hi += 50 if chars < 24 else 0   # short lines run long on their pauses
    best, best_err = None, 1e9
    for _ in range(TRIES):
        pcm = np.clip(model.generate_audio(state, text).detach().cpu().numpy().reshape(-1), -1, 1)
        ms = speech_seconds(pcm, model.sample_rate) * 1000 / chars
        if lo <= ms <= hi: return pcm, True
        if abs(ms - aim) < best_err: best, best_err = pcm, abs(ms - aim)
    return best, False


def post_filter(semitones, fx, rate):
    """ffmpeg filter chain: pitch shift (asetrate + atempo keeps duration), effects, trim, loudness."""
    f = []
    if semitones:
        k = 2 ** (semitones / 12)
        f += [f'asetrate={int(rate * k)}', f'aresample={rate}', f'atempo={1 / k:.5f}']
    if fx == 'chorus':
        f.append('chorus=0.6:0.9:45|60|38:0.45|0.38|0.32:0.3|0.45|0.25:2|2.4|1.6')
    elif fx == 'robot':
        f += ['aecho=0.8:0.7:8|14:0.5|0.35', 'aphaser=type=t:speed=2']
    f += ['silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.35:stop_threshold=-45dB',
          'loudnorm=I=-17:TP=-2:LRA=9', 'apad=pad_dur=0.08']
    return ','.join(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shard', default='0/1')
    ap.add_argument('--only', default='')
    ap.add_argument('--redo', action='store_true')
    a = ap.parse_args()
    i, n = map(int, a.shard.split('/'))
    jobs = json.loads((ROOT / 'build' / 'voice-jobs.json').read_text())
    cast = {k: v for k, v in json.loads((ROOT / 'tools' / 'voices' / 'cast.json').read_text()).items() if not k.startswith('_')}
    only = set(filter(None, a.only.split(',')))
    OUT.mkdir(parents=True, exist_ok=True)
    todo = [j for k, j in enumerate(jobs) if k % n == i and (not only or j['speaker'] in only)
            and (a.redo or not (OUT / f"{j['key']}.mp3").exists())]
    missing = sorted({j['speaker'] for j in todo if j['speaker'] not in cast})
    if missing: sys.exit(f'no casting in tools/voices/cast.json for: {", ".join(missing)}')
    print(f'shard {i}/{n}: {len(todo)} lines to bake', flush=True)
    if not todo: return
    model = TTSModel.load_model()
    states = {}
    with tempfile.TemporaryDirectory() as tmp:
        for k, j in enumerate(todo):
            c = cast[j['speaker']]
            if c['voice'] not in states: states[c['voice']] = model.get_state_for_audio_prompt(c['voice'])
            pcm, ok = take(model, states[c['voice']], j['text'])
            wav = Path(tmp) / 'take.wav'
            with wave.open(str(wav), 'wb') as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(model.sample_rate)
                w.writeframes((pcm * 32767).astype('<i2').tobytes())
            subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', str(wav),
                            '-af', post_filter(c.get('semitones', 0), c.get('fx'), model.sample_rate),
                            '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '32k', str(OUT / f"{j['key']}.mp3")], check=True)
            flag = '' if ok else '  (off pace, best of tries)'
            print(f"{k + 1}/{len(todo)} {j['speaker']}: {j['text'][:60]}{flag}", flush=True)


if __name__ == '__main__':
    main()
