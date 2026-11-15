// Where the page's data comes from. The single-file build embeds everything as <script> blocks; the web build
// (dist/web, for GitHub Pages, where files must stay under 100 MB) ships a manifest and fetches models and data
// banks from files beside the page. Everything else asks this module and does not care which build it is.
const manifestEl = typeof document !== 'undefined' && document.getElementById('manifest');
const manifest = manifestEl ? JSON.parse(manifestEl.textContent) : null;
export const WEB = !!manifest;
const cache = new Map();

function b64(text) {
  const raw = atob(text.trim()), out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function hasModel(name) {
  return WEB ? manifest.models.includes(name) : !!document.getElementById('vrm-' + name);
}

// A model file's bytes.
export async function model(name) {
  if (!WEB) return b64(document.getElementById('vrm-' + name).textContent).buffer;
  const r = await fetch(`models/${name}.vrm`);
  if (!r.ok) throw new Error(`model ${name}: ${r.status}`);
  return r.arrayBuffer();
}

// A data bank (animData, voiceBank, musicBank, sfxBank, kitBank), or null when this build has none.
export function bank(name) {
  if (!WEB) { const el = document.getElementById(name); return Promise.resolve(el ? JSON.parse(el.textContent) : null); }
  if (!manifest.banks.includes(name)) return Promise.resolve(null);
  if (!cache.has(name)) cache.set(name, fetch(`data/${name}.json`).then((r) => (r.ok ? r.json() : null)));
  return cache.get(name);
}
