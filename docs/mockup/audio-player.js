/**
 * Standalone audio review player (CHESS-B25).
 * Serve docs/ then open /mockup/audio.html — or pnpm review:audio.
 */

const ROOT = '../raw_assets/audio-review';

const ROOMS = [
  { id: 'atelier', label: 'Atelier', thumb: '../ambiances/atelier-kontrast.png' },
  { id: 'salon', label: 'Salon', thumb: '../ambiances/salon-de-minuit.png' },
  { id: 'club', label: 'Club', thumb: '../ambiances/club-neon.png' },
  { id: 'jardin', label: 'Jardin', thumb: '../ambiances/jardin-suspendu.jpg' },
  { id: 'terrasse', label: 'Terrasse', thumb: '../ambiances/terrasse-hiver.jpg' },
];

const TENSIONS = [
  { id: 'calm', label: 'Neutre' },
  { id: 'edge', label: 'Avantage' },
  { id: 'pressure', label: 'Pression' },
];

const GAINS = {
  calm: { calm: 0.5, edge: 0, pressure: 0, music: 1.1, musicEdge: 0, musicPressure: 0 },
  edge: { calm: 0.325, edge: 0.275, pressure: 0, music: 0, musicEdge: 0.9, musicPressure: 0 },
  pressure: { calm: 0.325, edge: 0, pressure: 0.3, music: 0, musicEdge: 0, musicPressure: 0.56 },
};

const BED_LAYERS = ['calm', 'edge', 'pressure', 'music', 'musicEdge', 'musicPressure'];

const SFX_BASE = { drop: 0.55, capture: 0.7, check: 0.4, win: 0.55, lose: 0.5 };

const state = {
  room: 'atelier',
  tension: 'calm',
  sfx: 80,
  ambience: 40,
  playing: false,
};

const lab = {
  ctx: null,
  master: null,
  analyser: null,
  beds: { calm: null, edge: null, pressure: null, music: null, musicEdge: null, musicPressure: null },
  buffers: new Map(),
  raf: 0,
};

const $ = (id) => document.getElementById(id);

function placeThumb(input) {
  if (!input) return;
  const min = Number(input.min);
  const max = Number(input.max);
  const at = (Number(input.value) - min) / (max - min || 1);
  const thumb = input.parentElement?.querySelector('.scale-thumb');
  if (thumb) thumb.style.setProperty('--at', String(at));
}

function hitUrl(kind) {
  if (kind === 'check' || kind === 'win' || kind === 'lose') return `${ROOT}/state/${kind}.wav`;
  return `${ROOT}/hits/${state.room}/${kind}.wav`;
}

function bedUrl(layer) {
  if (layer === 'calm') return `${ROOT}/beds/${state.room}/calm.wav`;
  if (layer === 'music') return `${ROOT}/beds/${state.room}/music.wav`;
  if (layer === 'musicEdge') return `${ROOT}/beds/${state.room}/music-edge.wav`;
  if (layer === 'musicPressure') return `${ROOT}/beds/${state.room}/music-pressure.wav`;
  return `${ROOT}/beds/shared/${layer}.wav`;
}

async function ensureCtx() {
  if (!lab.ctx) {
    lab.ctx = new AudioContext();
    lab.master = lab.ctx.createGain();
    lab.analyser = lab.ctx.createAnalyser();
    lab.analyser.fftSize = 256;
    lab.master.connect(lab.analyser);
    lab.analyser.connect(lab.ctx.destination);
  }
  if (lab.ctx.state === 'suspended') await lab.ctx.resume();
  return lab.ctx;
}

async function loadBuffer(url) {
  if (lab.buffers.has(url)) return lab.buffers.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const raw = await res.arrayBuffer();
  const buffer = await (await ensureCtx()).decodeAudioData(raw.slice(0));
  lab.buffers.set(url, buffer);
  return buffer;
}

function stopBeds() {
  for (const key of Object.keys(lab.beds)) {
    try {
      lab.beds[key]?.stop?.();
    } catch {
      /* already stopped */
    }
    lab.beds[key] = null;
  }
  state.playing = false;
  $('btn-play').textContent = 'Lancer les lits';
  $('now').textContent = 'Arrêté';
}

async function startBeds() {
  const status = $('status');
  try {
    await ensureCtx();
    stopBeds();
    state.playing = true;
    $('btn-play').textContent = 'Relancer';
    const gains = GAINS[state.tension];
    const master = (state.ambience / 100) * 0.045;
    if (master <= 0) {
      status.textContent = 'Ambiance à 0 — lits muets.';
      $('now').textContent = 'Muets';
      return;
    }
    const layers = [];
    for (const layer of BED_LAYERS) {
      if (gains[layer] <= 0) continue;
      const url = bedUrl(layer);
      const buffer = await loadBuffer(url);
      const src = lab.ctx.createBufferSource();
      const gain = lab.ctx.createGain();
      src.buffer = buffer;
      src.loop = true;
      gain.gain.value = master * gains[layer];
      src.connect(gain);
      gain.connect(lab.master);
      src.start();
      lab.beds[layer] = src;
      layers.push(layer);
    }
    $('now').textContent = `${ROOMS.find((r) => r.id === state.room)?.label} · ${state.tension} · ${layers.join(' + ')}`;
    status.textContent = 'Lits en boucle.';
    paintMeter();
  } catch (err) {
    stopBeds();
    status.textContent = `Échec lecture : ${err.message}. Servir docs/ (pnpm review:audio).`;
  }
}

async function playShot(kind) {
  const status = $('status');
  try {
    await ensureCtx();
    const buffer = await loadBuffer(hitUrl(kind));
    const src = lab.ctx.createBufferSource();
    const gain = lab.ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = (state.sfx / 100) * (SFX_BASE[kind] ?? 0.5);
    src.connect(gain);
    gain.connect(lab.master);
    src.start();
    status.textContent = `${kind} · ${state.room}`;
    paintMeter();
  } catch (err) {
    status.textContent = `Coup ${kind} : ${err.message}`;
  }
}

function paintRooms() {
  $('rooms').innerHTML = ROOMS.map(
    (r) =>
      `<button type="button" class="${r.id === state.room ? 'is-selected' : ''}" data-room="${r.id}"><img src="${r.thumb}" alt="" /><span>${r.label}</span></button>`
  ).join('');
}

function paintTension() {
  $('tension').innerHTML = TENSIONS.map(
    (t) =>
      `<button type="button" class="${t.id === state.tension ? 'is-selected' : ''}" data-tension="${t.id}">${t.label}</button>`
  ).join('');
}

function paintMeter() {
  cancelAnimationFrame(lab.raf);
  const canvas = $('meter');
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d || !lab.analyser) return;

  const data = new Uint8Array(lab.analyser.frequencyBinCount);
  const draw = () => {
    lab.raf = requestAnimationFrame(draw);
    lab.analyser.getByteFrequencyData(data);
    const w = canvas.width;
    const h = canvas.height;
    ctx2d.clearRect(0, 0, w, h);
    const bars = 48;
    const step = Math.floor(data.length / bars);
    const gap = 2;
    const bw = w / bars - gap;
    for (let i = 0; i < bars; i++) {
      const v = data[i * step] / 255;
      const bh = Math.max(2, v * h * 0.92);
      ctx2d.fillStyle = `rgba(232, 184, 109, ${0.25 + v * 0.75})`;
      ctx2d.fillRect(i * (bw + gap), h - bh, bw, bh);
    }
  };
  draw();
}

paintRooms();
paintTension();
placeThumb($('vol-sfx'));
placeThumb($('vol-amb'));

document.addEventListener('click', (event) => {
  const el = event.target instanceof Element ? event.target.closest('[data-room], [data-tension], [data-shot], button') : null;
  if (!el) return;
  if (el.id === 'btn-play') {
    void startBeds();
    return;
  }
  if (el.id === 'btn-stop') {
    stopBeds();
    $('status').textContent = 'Stop.';
    return;
  }
  if (el.dataset.room) {
    state.room = el.dataset.room;
    paintRooms();
    if (state.playing) void startBeds();
    return;
  }
  if (el.dataset.tension) {
    state.tension = el.dataset.tension;
    paintTension();
    if (state.playing) void startBeds();
    return;
  }
  if (el.dataset.shot) {
    void playShot(el.dataset.shot);
  }
});

document.addEventListener('input', (event) => {
  const t = event.target;
  if (!(t instanceof HTMLInputElement)) return;
  if (t.id === 'vol-sfx') {
    state.sfx = Number(t.value);
    $('vol-sfx-val').textContent = String(Math.round(state.sfx));
    placeThumb(t);
  }
  if (t.id === 'vol-amb') {
    state.ambience = Number(t.value);
    $('vol-amb-val').textContent = String(Math.round(state.ambience));
    placeThumb(t);
    if (state.playing) void startBeds();
  }
});
