"""Study pack per part for script conversion: lines.txt (n, start, seconds, text colour, text) and numbered
contact sheets sheetA.jpg, sheetB.jpg... (5x4 thumbnails, line number in the corner)."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1])
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 22)
for d in sorted(p for p in root.iterdir() if (p / 'lines.json').exists()):
    data = json.loads((d / 'lines.json').read_text())
    L = data['lines']
    out, prev_end = [], 0
    for l in L:
        gap = l['start'] - prev_end
        if gap > 12: out.append(f'      [no subtitles for {gap:.0f}s: pictures over music]')
        rgb = '#%02x%02x%02x' % tuple(l['rgb']) if l.get('rgb') else '-'
        out.append(f"{l['n']:3d} {l['start']:6.1f} {l['end']-l['start']:4.1f}s {rgb} {l['text']}")
        prev_end = l['end']
    tail = data['duration'] - prev_end
    if tail > 12: out.append(f'      [no subtitles for the last {tail:.0f}s: pictures over music]')
    (d / 'lines.txt').write_text('\n'.join(out) + '\n')
    per = 20
    for s in range(0, len(L), per):
        sheet = Image.new('RGB', (5 * 320, 4 * 180), 'black')
        dr = ImageDraw.Draw(sheet)
        for i, l in enumerate(L[s:s + per]):
            im = Image.open(d / 'th' / f"{l['n']:04d}.jpg").convert('RGB').resize((320, 180))
            x, y = (i % 5) * 320, (i // 5) * 180
            sheet.paste(im, (x, y))
            dr.rectangle([x, y, x + 52, y + 28], fill='black'); dr.text((x + 4, y + 2), str(l['n']), fill='yellow', font=font)
        sheet.save(d / f'sheet{chr(65 + s // per)}.jpg', quality=72)
    print(d.name, len(L), 'lines')
