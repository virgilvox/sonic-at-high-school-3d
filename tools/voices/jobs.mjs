// List every spoken line in the script as a bake job: { key, speaker, text }, de-duplicated, keyed exactly the way
// the player looks lines up (src/voice.js keyOf + speakable). Writes build/voice-jobs.json.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { keyOf, speakable } from '../../src/voice.js';

// Every spoken line once, in script order.
export function voiceJobs() {
  const jobs = new Map();
  for (const f of readdirSync('script').filter((f) => /^part\d+\.json$/.test(f)).sort()) {
    const part = JSON.parse(readFileSync('script/' + f, 'utf8'));
    for (const sc of part.scenes) for (const b of sc.beats) {
      const speaker = b.say || b.think;
      if (!speaker) continue;
      const text = speakable(b.text);
      if (!text) continue;
      const key = keyOf(speaker, text);
      if (!jobs.has(key)) jobs.set(key, { key, speaker, text, part: part.part });
    }
  }
  return [...jobs.values()];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const jobs = voiceJobs();
  mkdirSync('build', { recursive: true });
  writeFileSync('build/voice-jobs.json', JSON.stringify(jobs, null, 1));
  console.log('voice jobs', jobs.length);
}
