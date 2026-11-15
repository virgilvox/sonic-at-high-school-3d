"""Turn one Sonic at High School part into timed subtitle lines.

usage: extract.py <video.mp4> <outdir>
Writes <outdir>/lines.json and <outdir>/th/<n>.jpg (a frame thumbnail per line).
"""
import json, os, re, subprocess, sys, shutil, difflib
from pathlib import Path
import numpy as np
from PIL import Image

FPS = 2
BAND = 0.32            # bottom share of the frame that holds subtitles
OCR = Path(__file__).with_name('ocr')

MIN_HOLD = 1.0         # shorter reads are fade in or fade out frames

def reading_order(obs):
    """Group boxes into rows by vertical centre, top row first, then left to right."""
    rows = []
    for o in sorted(obs, key=lambda o: -(o['y'] + o['h'] / 2)):
        c = o['y'] + o['h'] / 2
        if rows and abs(rows[-1][0] - c) < 0.06: rows[-1][1].append(o)
        else: rows.append([c, [o]])
    return [o for _, r in rows for o in sorted(r, key=lambda o: o['x'])]

def norm(t):
    return re.sub(r'[^a-z0-9]', '', t.lower())

def text_colour(img, boxes):
    """Median colour of the bright text pixels inside the OCR boxes (band image, Vision coords)."""
    a = np.asarray(img).astype(np.int16)
    H, W = a.shape[:2]
    px = []
    for b in boxes:
        x0, x1 = int(b['x'] * W), int((b['x'] + b['w']) * W)
        y1, y0 = int((1 - b['y']) * H), int((1 - b['y'] - b['h']) * H)
        r = a[max(0, y0):y1, max(0, x0):x1].reshape(-1, 3)
        if len(r):
            lum = r.mean(1)
            px.append(r[lum > np.percentile(lum, 85)])
    if not px:
        return None
    return [int(v) for v in np.median(np.concatenate(px), 0)]

def main(video, out):
    out = Path(out); fr = out / 'fr'; th = out / 'th'
    shutil.rmtree(fr, ignore_errors=True); fr.mkdir(parents=True); th.mkdir(exist_ok=True)
    subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', video, '-vf', f'fps={FPS}', '-q:v', '3', str(fr / '%05d.jpg')], check=True)
    frames = sorted(fr.glob('*.jpg'))
    bands = []
    for f in frames:
        im = Image.open(f)
        W, H = im.size
        b = im.crop((0, int(H * (1 - BAND)), W, H))
        bp = f.with_suffix('.b.png'); b.save(bp); bands.append(bp)
    res = subprocess.run([str(OCR)], input='\n'.join(map(str, bands)), capture_output=True, text=True, check=True).stdout
    recs = {r['f']: r['o'] for r in map(json.loads, res.splitlines())}
    lines, cur = [], None
    for i, (f, bp) in enumerate(zip(frames, bands)):
        obs = [o for o in recs.get(str(bp), []) if o['c'] >= 0.3 and o['h'] < 0.5]
        txt = ' '.join(o['t'] for o in reading_order(obs)).strip()
        t = i / FPS
        key = norm(txt)
        if cur and key and difflib.SequenceMatcher(None, key, cur['key']).ratio() > 0.8:
            cur['end'] = t + 1 / FPS
            if len(txt) > len(cur['text']):   # keep the fullest read and its colour
                cur['text'] = txt; cur['rgb'] = text_colour(Image.open(bp).convert('RGB'), obs); cur['frame'] = f.name
            continue
        if cur and cur['end'] - cur['start'] >= MIN_HOLD: lines.append(cur)
        cur = None
        if len(key) < 2: continue
        cur = {'key': key, 'text': txt, 'start': t, 'end': t + 1 / FPS,
               'rgb': text_colour(Image.open(bp).convert('RGB'), obs), 'frame': f.name}
    if cur and cur['end'] - cur['start'] >= MIN_HOLD: lines.append(cur)
    for n, l in enumerate(lines):
        im = Image.open(fr / l['frame']); im.thumbnail((320, 180)); im.save(th / f'{n:04d}.jpg', quality=70)
        l['n'] = n; del l['key']; del l['frame']
    (out / 'lines.json').write_text(json.dumps({'duration': len(frames) / FPS, 'lines': lines}, indent=1))
    shutil.rmtree(fr)
    print(out, len(lines), 'lines')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
