// The end credits, played the way films run their outtakes: the credits crawl on the right while the blooper reels
// play live in a window on the left, with behind-the-scenes photos cut in between reels. The photos are posed in
// the engine itself (the cast on the sets among camera rigs, lights and a boom mic), rendered to images first under
// a black frame, then shown as polaroids while the roll plays over the epic track. Ends on THE END and hack.build.
import * as THREE from 'three';
import MODELS from '../assets/vrm/CREDITS.json';
import MUSIC from '../assets/music/CREDITS.json';
import LOGO from './hackbuild-lockup.svg';
import { CAST } from './cast.js';
import { buildSet, makeProp } from './sets.js';

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const DEG = Math.PI / 180;

// [set, who: [id, x, z, yawDeg, clip?, extra], crew: [prop, x, z, yaw], camera [pos, look], caption]
const PHOTOS = [
  ['bedroom', [['sonic', -1.8, -1.9, 0, 'lie'], ['tails', 0.4, 0.2, -30, 'Idle_TalkingPhone_Loop']], [['camrig', 1.6, 1.2, -140], ['lightstand', -0.6, 1.8, 160]], [[2.4, 1.6, 2.4], [-0.6, 0.8, -0.8]], 'Sonic between takes. He did not learn his lines.'],
  ['hallway', [['knuckles', -1, 0.4, 0, 'tpose'], ['tails', 0.6, 0.6, -60, 'point']], [['boom', 2.2, -0.4, -90], ['camrig', -2.4, 2.6, 150]], [[0.4, 1.6, 3.2], [-0.4, 1.1, 0]], 'Knuckles, mid-glitch. Tails filed the bug report.'],
  ['cafeteria', [['amy', -0.6, 0.92, 180, 'sit'], ['cream', 0.6, 0.92, 180, 'sit'], ['rouge', 0, -0.92, 0, 'sit']], [['lightstand', 2.4, 2.6, -140]], [[1.6, 1.7, 3.6], [0, 0.8, 0]], 'Lunch on set. Catering by Bunnie\'s Diner.'],
  ['gym', [['vector', 0, 0.3, 0, 'sit_chair']], [['dchair', 0, 0.3, 0], ['camrig', -1.6, -1.2, 30], ['clapper', 0.7, 0.9, -20]], [[1.8, 1.5, 3.0], [0, 0.9, 0]], 'Vector would not give up the director\'s chair.'],
  ['stage', [['blaze', -0.9, -3.4, 180, 'Dance_Loop', 0.8], ['silver', 0.9, -3.4, 180, 'Dance_Loop', 0.8]], [['lightstand', -3.2, -1.2, 150], ['lightstand', 3.2, -1.2, -150]], [[0, 2.2, 1.6], [0, 1.5, -3.6]], 'Rehearsing the spring musical.'],
  ['field', [['shadow', 0, 0, 30, 'Idle_FoldArms_Loop']], [['boom', -1.6, 0.8, 60]], [[1.6, 1.5, 2.6], [0, 1.0, 0]], 'Shadow stayed in character all day. Nobody asked him to.'],
  ['street', [['eggman', -0.4, 1.0, 60], ['manic', 1.4, 0.6, -90, 'Dance_Loop']], [['camrig', 0.4, 1.0, 60]], [[1.8, 1.7, 4.4], [0.3, 1.0, 0.6]], 'Eggman insisted on doing his own camera work.'],
  ['schoolfront', [
    ...['cream', 'tails', 'amy', 'sonic', 'knuckles', 'tikal', 'sally'].map((id, i) => [id, (i - 3) * 1.05, 1.0, 0]),
    ...['manic', 'rouge', 'shadow', 'silver', 'blaze', 'espio', 'vector'].map((id, i) => [id, (i - 3) * 1.1 + 0.5, -0.3, 0])],
    [], [[0, 1.8, 7.2], [0, 1.0, 0]], 'The class of Mobius High. Everybody made it into this one.'],
];

export class Credits {
  constructor({ renderer, scene, camera, loadActor, actors, lights, sound, ui, stage }) {
    Object.assign(this, { renderer, scene, camera, loadActor, actors, lights, sound, ui, stage });
    this.el = document.getElementById('roll');
  }

  text() {
    const cast = CAST.filter((c) => !c.extra && !c.costume && !['crowd', 'fangirls', 'narrator', 'teacher', 'mom', 'robot'].includes(c.id));
    const who = (c) => { const m = MODELS[(c.model || '') + '.vrm']; return m ? `${m.title}, by ${m.author}` : 'a stand-in'; };
    const songs = Object.entries(MUSIC).filter(([k]) => !k.startsWith('_') && k !== 'graduation' && k !== 'coldopen').map(([, t]) => t);
    const sec = (h, rows) => `<h4>${h}</h4>` + rows.map((r) => `<p>${r}</p>`).join('');
    const byPub = {};
    for (const [k, m] of Object.entries(MODELS)) if (!k.startsWith('_')) (byPub[m.publisher || 'unknown'] ??= new Map()).set(m.title, m);
    const pubSecs = Object.entries(byPub).map(([pub, list]) => sec(`Models published by ${esc(pub)}`,
      [...list.values()].map((m) => `${esc(m.title)}${m.author && m.author !== 'unknown author' ? `<small>made by ${esc(m.author)}</small>` : ''}`))).join('');
    return `<h2>SONIC AT HIGH SCHOOL 3<br>LOVE STORY</h2>`
      + sec('Based on', ['the YouTube series by <b>tarasdiary</b>'])
      + sec('Adapted with Clanker assistance by', ['<b>Moheeb Zara</b><small>@virgilvox · hack.build</small>'])
      + sec('End credits song', ['"Bit Shift"<small>Kevin MacLeod (incompetech.com), CC BY 4.0</small>'])
      + sec('Starring', cast.map((c) => `<b>${esc(c.name)}</b><small>${esc(who(c))}</small>`))
      + pubSecs
      + sec('Music', songs.map((t) => `"${esc(t)}"<small>Kevin MacLeod (incompetech.com), CC BY 4.0</small>`))
      + sec('Graduation march', ['Pomp and Circumstance March No. 1 (Elgar)<small>United States Marine Band, public domain</small>'])
      + sec('Voices', ['Kyutai Pocket TTS, built-in voices'])
      + sec('Motion', ['Quaternius Universal Animation Library (CC0)'])
      + sec('Sets', ['Kenney Furniture, Nature, Car, Retro Urban and City kits (CC0)'])
      + sec('Sound', ['"Footsteps on different surfaces" by congusbongus, from recordings by swuing, CC BY 3.0', '"Crowd Shouting/Speaking Ambience", OpenGameArt, CC0', 'School chatter: a few dozen Pocket TTS voices talking at once'])
      + sec('Built with', ['three.js and @pixiv/three-vrm'])
      + sec('Camera', ['an algorithm that tried its best'])
      + sec('Ball wrangler', ['Vector'])
      + sec('Catering', ['Bunnie\'s Diner'])
      + sec('No cameras were harmed', ['one camera was harmed'])
      + `<p class="fine">Sonic the Hedgehog characters belong to SEGA. A fan remake for fun, not affiliated with SEGA or tarasdiary.</p>`;
  }

  // Pose one behind-the-scenes photo in the engine and return it as an image URL.
  async photo([setName, who, crew, [pos, look]]) {
    const set = buildSet(setName, 'day');
    this.scene.add(set.group); this.lights.apply(set);
    for (const [type, x, z, yaw] of crew) { const g = makeProp(type); g.position.set(x, 0, z); g.rotation.y = yaw * DEG; set.group.add(g); }
    const used = [];
    for (const [id, x, z, yaw, clip, y = 0] of who) {
      const a = await this.loadActor(id);
      if (!a) continue;
      a.place(x, z, yaw * DEG); a.root.visible = true; a.floorY = y; a.tpose = clip === 'tpose';
      if (clip === 'lie') a.play('Death01', { hold: true, fade: 0.01 });
      else if (clip === 'sit' || clip === 'sit_chair') a.setBase('Sitting_Idle_Loop', 0);
      else if (clip === 'point') a.gesture('point', { dur: 99 });
      else if (clip) a.setBase(clip, 0);
      a.emote('happy', 0.8, 9);
      used.push(a);
    }
    for (let i = 0; i < 40; i++) for (const a of used) a.update(1 / 30);
    this.camera.position.set(...pos); this.camera.lookAt(new THREE.Vector3(...look)); this.camera.fov = 45; this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/jpeg', 0.85);
    for (const a of used) { a.root.visible = false; a.tpose = false; a.floorY = 0; a.stopOneShot(); a.setBase('Idle_Loop', 0); }
    this.scene.remove(set.group);
    return url;
  }

  // Opening: pose the photos under black, then the song starts, the roll begins crawling on the right and the
  // film shrinks into the window on the left where the bloopers play.
  async begin(isLive) {
    this.ui.caption('');
    await this.ui.fade('fadeout');
    for (const a of this.actors.values()) a.root.visible = false;
    const last = this.stage?.();
    if (last) this.scene.remove(last.group);
    this.shots = [];
    for (const p of PHOTOS) { if (!isLive()) return; this.shots.push([await this.photo(p), p[4]]); }
    if (last) this.scene.add(last.group);
    this.sound.ambience([]);
    this.sound.startScore('credits', { vol: 0.8 });
    const roll = this.el.querySelector('.rolltext');
    roll.innerHTML = this.text();
    this.el.querySelector('.rollpics').innerHTML = '';
    this.el.hidden = false;
    document.body.classList.add('credits');
    dispatchEvent(new Event('resize'));
    this.started = performance.now();
    this.dur = Math.max(150, roll.scrollHeight / 26);   // a readable crawl, about the length of the song
    roll.style.transition = 'none'; roll.style.transform = 'translateY(85vh)';
    requestAnimationFrame(() => requestAnimationFrame(() => { roll.style.transition = `transform ${this.dur}s linear`; roll.style.transform = `translateY(-${roll.scrollHeight}px)`; }));
    await this.ui.fade('fadein');
  }

  // Between reels: cut the window to a behind-the-scenes polaroid for a moment.
  async cut(i) {
    const shot = this.shots?.[i % (this.shots.length || 1)];
    if (!shot) return;
    const pics = this.el.querySelector('.rollpics');
    pics.innerHTML = `<figure class="polaroid" style="--tilt:${i % 2 ? 3 : -3}deg"><img src="${shot[0]}" alt=""><figcaption>${esc(shot[1])}</figcaption></figure>`;
    pics.classList.add('on');
    await sleep(3.2);
    pics.classList.remove('on');
    await sleep(0.3);
  }

  // Close: the last photos while the roll finishes, then THE END.
  async end(isLive) {
    for (let i = 7; i < (this.shots?.length || 0) && isLive(); i++) await this.cut(i);
    const left = this.dur - (performance.now() - this.started) / 1000;
    if (left > 0 && isLive()) await sleep(Math.min(left, 25));
    const roll = this.el.querySelector('.rolltext'), pics = this.el.querySelector('.rollpics');
    roll.style.transition = 'none'; roll.innerHTML = '';
    document.body.classList.remove('credits');
    dispatchEvent(new Event('resize'));
    pics.classList.add('on', 'full');
    pics.innerHTML = `<div class="theend"><h2>THE END</h2>${LOGO}<p>made at hack.build</p></div>`;
    await sleep(isLive() ? 7 : 0);
    this.sound.stopScore();
    await this.ui.fade('fadeout');
    pics.classList.remove('on', 'full'); pics.innerHTML = '';
    this.el.hidden = true;
    await this.ui.fade('fadein');
  }
}
