"""Compare each extracted part's duration with its real length from the playlist page; remove short or failed ones
so run_all.sh redoes them. Prints a table."""
import json, re, shutil, sys
from pathlib import Path
root = Path(sys.argv[1])
real = {l.split()[0]: float(l.split()[1]) for l in (root / 'durations.txt').read_text().splitlines() if len(l.split()) == 2 and l.split()[1] != 'NA'}
ids = (root / 'ids.txt').read_text().split()
redo = []
for n, vid in enumerate(ids, 1):
    p = root / 'parts' / f'{n:02d}'
    got = json.loads((p / 'lines.json').read_text())['duration'] if (p / 'lines.json').exists() else 0
    want = real.get(vid, 0)
    ok = want and abs(got - want) <= 3
    print(n, f'{got:.0f}/{want}', 'ok' if ok else 'REDO')
    if not ok:
        redo.append(n)
        shutil.rmtree(p, ignore_errors=True)
print('real lengths known:', len(real), ' redo:', redo)
