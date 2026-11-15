"""Speak one test line with every built-in Pocket TTS voice and report each voice's median pitch, so casting can
be checked against evidence. Writes auditions/<voice>.wav. usage: python audition.py <outdir>"""
import sys, wave
from pathlib import Path
import numpy as np
from pocket_tts import TTSModel
from pocket_tts.utils.utils import _ORIGINS_OF_PREDEFINED_VOICES

LINE = "Hey! What's going on here? Why is everyone outside the school?"
FOREIGN = {"giovanni", "lola", "juergen", "rafael", "daan", "estelle"}

def median_f0(pcm, rate):
    """Median fundamental frequency of voiced 40 ms frames by autocorrelation (60 to 400 Hz)."""
    n = int(rate * 0.04); f0 = []
    for i in range(0, len(pcm) - n, n // 2):
        x = pcm[i:i + n] - pcm[i:i + n].mean()
        if np.sqrt((x ** 2).mean()) < 0.02: continue
        ac = np.correlate(x, x, 'full')[n - 1:]
        lo, hi = int(rate / 400), int(rate / 60)
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.3 * ac[0]: f0.append(rate / k)
    return float(np.median(f0)) if f0 else 0.0

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
model = TTSModel.load_model()
for name in _ORIGINS_OF_PREDEFINED_VOICES:
    if name in FOREIGN: continue
    st = model.get_state_for_audio_prompt(name)
    pcm = np.clip(model.generate_audio(st, LINE).detach().cpu().numpy().reshape(-1), -1, 1)
    with wave.open(str(out / f'{name}.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(model.sample_rate); w.writeframes((pcm * 32767).astype('<i2').tobytes())
    print(f'{name:16s} f0={median_f0(pcm, model.sample_rate):5.0f} Hz  {len(pcm) / model.sample_rate:4.1f}s', flush=True)
