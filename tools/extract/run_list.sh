#!/bin/zsh
# Extract the given playlist positions (1-based). usage: run_list.sh 6 8 9
cd "${0:A:h}/.."
for n in "$@"; do
  p=$(printf %02d $n); id=$(sed -n "${n}p" yt/ids.txt)
  [[ -f yt/parts/$p/lines.json ]] && continue
  ytenv/bin/yt-dlp -q --no-warnings -f 136 -o "yt/vid/$p.mp4" "https://www.youtube.com/watch?v=$id" </dev/null || { echo "FAIL dl $p"; continue; }
  ytenv/bin/python -I tools/extract.py yt/vid/$p.mp4 yt/parts/$p </dev/null || echo "FAIL ex $p"
  rm -f yt/vid/$p.mp4
done
echo LIST DONE "$@"
