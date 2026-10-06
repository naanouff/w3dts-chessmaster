const OPENINGS = [
  { eco: 'C50', name: 'Partie italienne' },
  { eco: 'C60', name: 'Espagnole' },
  { eco: 'C44', name: 'Écossaise' },
  { eco: 'B20', name: 'Sicilienne' },
  { eco: 'C00', name: 'Française' },
  { eco: 'B10', name: 'Caro-Kann' },
  { eco: 'D06', name: 'Gambit de la dame' },
  { eco: 'E60', name: 'Indienne du roi' },
];

const MODES = [
  { id: 'cpu', title: 'Contre l’ordinateur', blurb: 'Une partie contre l’heuristique.' },
  { id: 'hotseat', title: 'À deux, même écran', blurb: 'On se passe la souris.' },
  { id: 'local', title: 'Sur cet ordinateur', blurb: 'Une seconde fenêtre de cette application.' },
  { id: 'online', title: 'En ligne', blurb: 'Créer ou rejoindre une table.' },
  { id: 'learn', title: 'Apprendre', blurb: 'Une courte ligne ECO.' },
  { id: 'training', title: 'Entraînement', blurb: 'Stopper le CPU, annuler un coup, planifier.' },
];

const PRESETS = {
  fluide: { title: 'Fluide', resolution: '1080', textures: 'low', upscale: 'off', shadows: true, shadowMode: 'hard', ao: false, reflections: false, bloom: false },
  equilibre: { title: 'Équilibré', resolution: '1440', textures: 'medium', upscale: 'off', shadows: true, shadowMode: 'soft', ao: false, reflections: false, bloom: true },
  qualite: { title: 'Qualité', resolution: '2160', textures: 'high', upscale: 'quality', shadows: true, shadowMode: 'soft', ao: true, reflections: true, bloom: true },
  natif: { title: 'Natif', resolution: 'native', textures: 'high', upscale: 'quality', shadows: true, shadowMode: 'soft', ao: true, reflections: true, bloom: true },
};

const UPSCALE_MODES = [
  { id: 'off', label: 'Sans' },
  { id: 'quality', label: 'Qualité' },
  { id: 'performance', label: 'Performance' },
];

const SHADOW_MODES = [
  { id: 'off', label: 'Sans' },
  { id: 'hard', label: 'Dure' },
  { id: 'soft', label: 'Douce' },
];

const RESOLUTIONS = [
  { id: '1080', label: '1080p', size: '1920×1080' },
  { id: '1440', label: '1440p', size: '2560×1440' },
  { id: '2160', label: '4K', size: '3840×2160' },
  { id: 'native', label: 'Natif', size: '3840×2160' },
];

const TEXTURES = [
  { id: 'low', label: 'Basse' },
  { id: 'medium', label: 'Normale' },
  { id: 'high', label: 'Haute' },
];

const SETS = [
  { id: 'atelier', label: 'Atelier', thumb: '../ambiances/atelier-kontrast.png' },
  { id: 'salon', label: 'Salon', thumb: '../ambiances/salon-de-minuit.png' },
  { id: 'club', label: 'Club', thumb: '../ambiances/club-neon.png' },
  { id: 'jardin', label: 'Jardin', thumb: '../ambiances/jardin-suspendu.jpg' },
];

const RANKS = {
  local: {
    wins: 12,
    losses: 7,
    draws: 3,
    streak: 2,
    games: ['Victoire · ordinateur', 'Défaite · même écran', 'Nulle · en ligne', 'Victoire · ouverture', 'Victoire · ordinateur'],
  },
  online: {
    wins: 4,
    losses: 2,
    draws: 1,
    streak: 1,
    games: ['Victoire · table K7QM', 'Défaite · table M2LP', 'Nulle · table Q9AD', 'Victoire · table H4CE', 'Défaite · table B8NR'],
  },
};

/** Arrival squares of an example plan. The piece sits on the board; no file or rank is written. */
const PLAN_GHOSTS = [
  { glyph: '♟', side: 'white', file: 3, rank: 4 },
  { glyph: '♟', side: 'black', file: 3, rank: 5 },
  { glyph: '♟', side: 'white', file: 2, rank: 4 },
  { glyph: '♟', side: 'black', file: 4, rank: 6 },
  { glyph: '♞', side: 'white', file: 2, rank: 3 },
];

const state = {
  screen: 'accueil',
  back: 'accueil',
  mode: 'cpu',
  color: 'white',
  level: 2,
  opening: 0,
  hostColor: 'white',
  guestColor: 'black',
  role: 'host',
  code: '',
  link: 'waiting',
  linkOpen: false,
  notice: '',
  assistant: false,
  coachBusy: false,
  trainingHeld: false,
  horizon: 3,
  objecting: false,
  ending: null,
  hasModel: false,
  hasKey: false,
  provider: 'local',
  sfx: 80,
  ambience: 40,
  language: 'fr',
  graphics: { ...PRESETS.fluide, preset: 'fluide' },
  set: 'atelier',
  rank: 'local',
  interrupt: true,
  voluntary: ['local', 'online'],
};

const $ = (id) => document.getElementById(id);

function show(screen, back) {
  if (back) state.back = back;
  state.screen = screen;
  if (screen !== 'partie' && screen !== 'pause') state.assistant = false;
  if (screen === 'partie' && state.reopenAssistant) {
    state.assistant = true;
    state.reopenAssistant = false;
  }
  document.querySelectorAll('[data-screen]').forEach((node) => {
    const on =
      node.dataset.screen === screen ||
      ((screen === 'pause' || screen === 'fin') && node.dataset.screen === 'partie');
    node.hidden = !on;
    node.classList.toggle('is-on', node.dataset.screen === screen);
  });
  $('pause').hidden = screen !== 'pause';
  $('fin').hidden = screen !== 'fin';
  $('assistant').hidden = !(screen === 'partie' && state.assistant);
  $('leave-table').hidden = !(state.mode === 'online' && state.linkOpen);
  paint();
  const root =
    state.assistant && screen === 'partie'
      ? $('assistant')
      : document.querySelector(`[data-screen="${screen}"]`);
  const primary = root?.querySelector('[data-primary]');
  primary?.focus();
}

function paint() {
  paintModes();
  paintSalon();
  paintPartie();
  paintOptions();
  paintSettings();
  paintRanks();
  paintSaves();
}

function paintSaves() {
  const interruptOn = state.interrupt === true;
  $('save-interrupt').hidden = !interruptOn;
  $('home-restore').hidden = !interruptOn;
  $('save-local').hidden = !state.voluntary.includes('local');
  $('save-online').hidden = !state.voluntary.includes('online');
  const voluntaryOn = !$('save-local').hidden || !$('save-online').hidden;
  $('save-voluntary').hidden = !voluntaryOn;
  $('saves-empty').hidden = interruptOn || voluntaryOn;
}

function paintModes() {
  $('mode-grid').innerHTML = MODES.map(
    (mode) =>
      `<button type="button" class="card${mode.id === state.mode ? ' is-selected' : ''}" data-mode="${mode.id}"><strong>${mode.title}</strong><span>${mode.blurb}</span></button>`
  ).join('');
  const extra = $('mode-extra');
  rememberChoiceThumb($('mode-color'));
  rememberChoiceThumb($('mode-openings'));
  if (state.mode === 'cpu' || state.mode === 'training') {
    extra.innerHTML = `<h2>Couleur</h2><div class="choice" id="mode-color">${colorButtons(state.color, 'data-color')}</div>${
      state.mode === 'cpu'
        ? `<label class="field" for="level">Niveau ${state.level}</label>${levelScale(state.level)}`
        : ''
    }`;
  } else if (state.mode === 'learn') {
    extra.innerHTML = `<h2>Ligne</h2><div class="choice" id="mode-openings">${OPENINGS.map(
      (opening, index) =>
        `<button type="button" class="${index === state.opening ? 'is-selected' : ''}" data-opening="${index}">${opening.eco} ${opening.name}</button>`
    ).join('')}</div>`;
  } else {
    extra.innerHTML = '';
  }
  $('start').textContent = state.mode === 'online' ? 'Ouvrir le salon' : 'Commencer';
  placeChoiceThumb($('mode-color'));
  placeChoiceThumb($('mode-openings'));
}

/**
 * Integer slider with one tick and label per step, from 1 to 5.
 * @param {number} value - Selected level.
 * @returns {string}
 */
function levelScale(value) {
  const min = 1;
  const max = 5;
  const marks = [];
  for (let step = min; step <= max; step += 1) {
    marks.push(
      `<button type="button" class="scale-mark${step === value ? ' is-on' : ''}" style="--i:${step - min}" data-level="${step}">${step}</button>`
    );
  }
  const at = (value - min) / (max - min);
  return `<div class="scale"><input id="level" type="range" min="${min}" max="${max}" step="1" value="${value}" /><span class="scale-thumb" style="--at:${at}" aria-hidden="true"></span><div class="scale-marks" style="--last:${max - min}">${marks.join('')}</div></div>`;
}

/**
 * Places the visible thumb from the input value.
 * A float slider eases there on a track click, and follows the pointer while dragging.
 * @param {HTMLInputElement | null} input
 */
function placeRangeThumb(input) {
  if (!input) return;
  const thumb = input.parentElement?.querySelector(':scope > .scale-thumb');
  if (!thumb) return;
  const min = Number(input.min);
  const max = Number(input.max);
  const at = max === min ? 0 : (Number(input.value) - min) / (max - min);
  thumb.style.setProperty('--at', String(at));
}

/**
 * Moves the thumb onto the nearest jalon and plays the catch when the step changes.
 * @param {number} value - Snapped level.
 */
function paintLevelMarks(value) {
  placeRangeThumb($('level'));
  document.querySelectorAll('.scale-mark').forEach((mark) => {
    const on = Number(mark.dataset.level) === value;
    const was = mark.classList.contains('is-on');
    mark.classList.toggle('is-on', on);
    if (!on) {
      mark.classList.remove('is-catch');
      return;
    }
    if (was) return;
    mark.classList.remove('is-catch');
    void mark.offsetWidth;
    mark.classList.add('is-catch');
  });
}

/** Last measured pill, keyed by the segmented control id, so a rebuild can slide from it. */
const choiceThumbFrom = new Map();

/**
 * Stores the glass pill position before the segmented control is rebuilt.
 * @param {HTMLElement | null} choice
 */
function rememberChoiceThumb(choice) {
  if (!choice?.id) return;
  const thumb = choice.querySelector(':scope > .choice-thumb');
  if (!thumb) return;
  choiceThumbFrom.set(choice.id, {
    left: thumb.offsetLeft,
    top: thumb.offsetTop,
    width: thumb.offsetWidth,
    height: thumb.offsetHeight,
  });
}

/**
 * Places the glass pill on the selected option and slides it from the previous one.
 * @param {HTMLElement | null} choice
 */
function placeChoiceThumb(choice) {
  if (!choice) return;
  const selected = choice.querySelector(':scope > button.is-selected');
  if (!selected || selected.offsetWidth === 0) return;
  let thumb = choice.querySelector(':scope > .choice-thumb');
  if (!thumb) {
    thumb = document.createElement('span');
    thumb.className = 'choice-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    choice.prepend(thumb);
  }
  const next = {
    left: selected.offsetLeft,
    top: selected.offsetTop,
    width: selected.offsetWidth,
    height: selected.offsetHeight,
  };
  const previous = choice.id ? choiceThumbFrom.get(choice.id) : undefined;
  const moved =
    previous &&
    (Math.abs(previous.left - next.left) > 0.5 ||
      Math.abs(previous.top - next.top) > 0.5 ||
      Math.abs(previous.width - next.width) > 0.5 ||
      Math.abs(previous.height - next.height) > 0.5);
  thumb.style.transition = 'none';
  if (moved) {
    thumb.style.left = `${previous.left}px`;
    thumb.style.top = `${previous.top}px`;
    thumb.style.width = `${previous.width}px`;
    thumb.style.height = `${previous.height}px`;
    thumb.getBoundingClientRect();
    thumb.style.transition = '';
  }
  thumb.style.left = `${next.left}px`;
  thumb.style.top = `${next.top}px`;
  thumb.style.width = `${next.width}px`;
  thumb.style.height = `${next.height}px`;
  if (!moved) {
    thumb.getBoundingClientRect();
    thumb.style.transition = '';
  }
  if (choice.id) choiceThumbFrom.delete(choice.id);
}

function colorButtons(selected, attr) {
  return [
    ['white', 'Blancs'],
    ['black', 'Noirs'],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" class="${id === selected ? 'is-selected' : ''}" ${attr}="${id}">${label}</button>`
    )
    .join('');
}

function paintSalon() {
  rememberChoiceThumb($('host-color'));
  $('table-code').textContent = state.code || '—';
  $('copy-code').hidden = !state.code;
  $('sim-opponent').hidden = state.link !== 'waiting' || !state.code;
  $('host-color').innerHTML = colorButtons(state.hostColor, 'data-host-color');
  $('host-color').querySelectorAll('button').forEach((button) => {
    button.disabled = state.linkOpen;
  });
  const labels = {
    waiting: 'En attente',
    connecting: 'Connexion',
    connected: 'Connecté',
    disconnected: 'Déconnecté',
  };
  $('salon-status').textContent = labels[state.link];
  $('salon-notice').hidden = !state.notice;
  $('salon-notice').textContent = state.notice;
  placeChoiceThumb($('host-color'));
}

function modeTitle() {
  if (state.mode === 'learn') {
    const opening = OPENINGS[state.opening];
    return `Apprendre · ${opening.eco} ${opening.name}`;
  }
  return MODES.find((mode) => mode.id === state.mode)?.title ?? '';
}

function paintPartie() {
  const chip = $('link-chip');
  const online = state.mode === 'online';
  chip.hidden = !online;
  chip.textContent = online ? $('salon-status').textContent : '';
  const training = state.mode === 'training';
  $('coach-play').hidden = training;
  $('coach-training').hidden = !training;
  $('coach-stop').textContent = state.trainingHeld ? 'Reprendre' : 'Stop';
  $('coach-horizon-label').textContent = `Profondeur ${state.horizon}`;
  const horizon = $('coach-horizon');
  if (horizon && horizon.value !== String(state.horizon)) horizon.value = String(state.horizon);
  const ended = Boolean(state.ending);
  $('play-move').hidden = !training || state.objecting || ended;
  $('open-pause').hidden = ended;
  $('clock').hidden = ended;
  $('reopen-fin').hidden = !ended || state.screen === 'fin';
  if (ended) {
    $('turn-label').textContent = state.ending.title;
    $('mode-label').textContent = state.ending.line;
  } else {
    $('mode-label').textContent = modeTitle();
    if (training && state.trainingHeld) $('turn-label').textContent = 'Partie arrêtée';
    else $('turn-label').textContent = state.color === 'black' ? 'Les noirs jouent' : 'Les blancs jouent';
  }
  paintGhosts();
}

function paintGhosts() {
  const board = $('studio-board');
  const show = state.screen === 'partie' && state.mode === 'training' && state.assistant;
  board.replaceChildren();
  if (!show) return;
  PLAN_GHOSTS.slice(0, state.horizon).forEach((ghost, index) => {
    const node = document.createElement('span');
    node.className = `board-ghost is-${ghost.side}${index === 0 ? ' is-next' : ''}`;
    node.textContent = ghost.glyph;
    node.style.left = `${((ghost.file + 0.5) / 8) * 100}%`;
    node.style.top = `${((8 - ghost.rank + 0.5) / 8) * 100}%`;
    node.style.opacity = String(Math.max(0.28, 0.92 - index * 0.16));
    board.append(node);
  });
}

function resolutionSize() {
  return RESOLUTIONS.find((item) => item.id === state.graphics.resolution)?.size ?? '';
}

function paintOptions() {
  const graphics = state.graphics;
  rememberChoiceThumb($('presets'));
  rememberChoiceThumb($('resolutions'));
  rememberChoiceThumb($('upscale'));
  rememberChoiceThumb($('textures'));
  rememberChoiceThumb($('shadow-mode'));
  $('sets').innerHTML = SETS.map(
    (item) =>
      `<button type="button" class="${state.set === item.id ? 'is-selected' : ''}" data-set="${item.id}"><img src="${item.thumb}" alt="" /><span>${item.label}</span></button>`
  ).join('');
  $('presets').innerHTML = Object.entries(PRESETS)
    .map(
      ([id, preset]) =>
        `<button type="button" class="${graphics.preset === id ? 'is-selected' : ''}" data-preset="${id}">${preset.title}</button>`
    )
    .join('');
  $('resolutions').innerHTML = RESOLUTIONS.map(
    (item) =>
      `<button type="button" class="${graphics.resolution === item.id ? 'is-selected' : ''}" data-resolution="${item.id}">${item.label}</button>`
  ).join('');
  $('upscale').innerHTML = UPSCALE_MODES.map(
    (item) =>
      `<button type="button" class="${graphics.upscale === item.id ? 'is-selected' : ''}" data-upscale="${item.id}">${item.label}</button>`
  ).join('');
  $('textures').innerHTML = TEXTURES.map(
    (item) =>
      `<button type="button" class="${graphics.textures === item.id ? 'is-selected' : ''}" data-texture="${item.id}">${item.label}</button>`
  ).join('');
  $('shadow-mode').innerHTML = SHADOW_MODES.map(
    (item) =>
      `<button type="button" class="${graphics.shadowMode === item.id ? 'is-selected' : ''}" data-shadow="${item.id}">${item.label}</button>`
  ).join('');
  $('opt-ao').checked = graphics.ao;
  $('opt-reflections').checked = graphics.reflections;
  $('opt-bloom').checked = graphics.bloom;
  $('render-line').textContent = `Rendu ${resolutionSize()} · 60 img/s`;
  placeChoiceThumb($('presets'));
  placeChoiceThumb($('resolutions'));
  placeChoiceThumb($('upscale'));
  placeChoiceThumb($('textures'));
  placeChoiceThumb($('shadow-mode'));
}

function paintSettings() {
  rememberChoiceThumb($('languages'));
  rememberChoiceThumb($('coach-provider'));
  $('vol-sfx').value = String(state.sfx);
  $('vol-amb').value = String(state.ambience);
  placeRangeThumb($('vol-sfx'));
  placeRangeThumb($('vol-amb'));
  $('vol-sfx-val').textContent = `${state.sfx}`;
  $('vol-amb-val').textContent = `${state.ambience}`;
  $('languages').innerHTML = [
    ['fr', 'Français'],
    ['en', 'Anglais'],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" class="${state.language === id ? 'is-selected' : ''}" data-lang="${id}">${label}</button>`
    )
    .join('');
  $('coach-provider').innerHTML = [
    ['local', 'Ollama local'],
    ['remote', 'API distante'],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" class="${state.provider === id ? 'is-selected' : ''}" data-provider="${id}">${label}</button>`
    )
    .join('');
  const remote = state.provider === 'remote';
  $('local-url').hidden = remote;
  $('remote-url').hidden = !remote;
  $('remote-url').previousElementSibling.hidden = !remote;
  $('model-select').hidden = remote;
  $('model-select').previousElementSibling.hidden = remote;
  $('remote-model').hidden = !remote;
  $('remote-model').previousElementSibling.hidden = !remote;
  $('api-key').hidden = !remote;
  $('api-key').previousElementSibling.hidden = !remote;
  $('key-state').hidden = !state.hasKey;
  placeChoiceThumb($('languages'));
  placeChoiceThumb($('coach-provider'));
}

function paintRanks() {
  rememberChoiceThumb($('rank-tabs'));
  $('rank-tabs').innerHTML = [
    ['local', 'Local'],
    ['online', 'En ligne'],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" class="${state.rank === id ? 'is-selected' : ''}" data-rank="${id}">${label}</button>`
    )
    .join('');
  const board = RANKS[state.rank];
  $('rank-stats').innerHTML = [
    ['Victoires', board.wins],
    ['Défaites', board.losses],
    ['Nuls', board.draws],
    ['Série', board.streak],
  ]
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('');
  $('rank-games').innerHTML = board.games.map((game) => `<li>${game} · exemple</li>`).join('');
  placeChoiceThumb($('rank-tabs'));
}

function startMode() {
  if (state.mode === 'online') {
    state.notice = '';
    show('salon', 'modes');
    return;
  }
  state.linkOpen = false;
  show('partie');
}

function createTable() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  state.code = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  state.role = 'host';
  state.color = state.hostColor;
  state.link = 'waiting';
  state.linkOpen = false;
  state.notice = '';
  paintSalon();
}

function connectThenPlay() {
  state.link = 'connecting';
  state.notice = '';
  paintSalon();
  window.setTimeout(() => {
    state.link = 'connected';
    state.linkOpen = true;
    state.mode = 'online';
    show('partie');
  }, 700);
}

function joinTable() {
  const code = $('join-code').value.trim().toUpperCase();
  if (code.length !== 4 || code === '0000') {
    state.link = 'disconnected';
    state.notice = 'Code refusé';
    state.linkOpen = false;
    paintSalon();
    return;
  }
  state.code = code;
  state.role = 'guest';
  state.guestColor = state.hostColor === 'white' ? 'black' : 'white';
  state.color = state.guestColor;
  state.notice = state.color === 'white' ? 'Vous jouez les blancs.' : 'Vous jouez les noirs.';
  connectThenPlay();
}

function leaveTable() {
  state.link = 'disconnected';
  state.linkOpen = false;
  state.notice = 'Vous avez quitté la table.';
  show('salon', 'modes');
}

const ENDINGS = {
  won: { title: 'Gagné', line: 'Les noirs sont échec et mat.', flag: false },
  lost: { title: 'Perdu', line: 'Les blancs sont échec et mat.', flag: true },
  draw: { title: 'Nulle', line: 'Pat. Aucun coup légal.', flag: false },
};

let objectionTimers = [];

function clearObjectionTimers() {
  objectionTimers.forEach((id) => window.clearTimeout(id));
  objectionTimers = [];
}

function dismissObjection() {
  clearObjectionTimers();
  state.objecting = false;
  const cry = $('objection');
  cry.hidden = true;
  cry.classList.remove('is-leaving');
  $('studio').classList.remove('is-shaken');
  paintPartie();
}

function raiseObjection() {
  if (state.mode !== 'training' || state.screen !== 'partie' || state.objecting || state.ending) return;
  state.objecting = true;
  state.trainingHeld = true;
  state.assistant = true;
  $('assistant').hidden = false;
  $('coach-body').textContent = 'Ce n’est pas le coup le plus net.';
  paintPartie();
  if (reduceMotion) {
    state.objecting = false;
    paintPartie();
    $('coach-stop').focus();
    return;
  }
  const cry = $('objection');
  cry.classList.remove('is-leaving');
  cry.hidden = false;
  $('studio').classList.add('is-shaken');
  objectionTimers = [
    window.setTimeout(() => cry.classList.add('is-leaving'), 1600),
    window.setTimeout(() => {
      dismissObjection();
      if (state.assistant) $('coach-stop').focus();
    }, 2050),
  ];
}

function openEnding(kind) {
  const ending = ENDINGS[kind];
  if (!ending) return;
  dismissObjection();
  state.ending = ending;
  state.assistant = false;
  $('fin-title').textContent = ending.title;
  $('fin-line').textContent = ending.line;
  $('fin-flag').hidden = !ending.flag;
  show('fin');
}

function replayGame() {
  state.ending = null;
  state.trainingHeld = false;
  show('partie');
}

function askCoach(kind) {
  const body = $('coach-body');
  if (!state.hasModel) {
    body.innerHTML = 'Aucun modèle. <button type="button" id="coach-settings">Ouvrir les paramètres</button>';
    return;
  }
  state.coachBusy = true;
  body.textContent = 'L’assistant réfléchit…';
  window.setTimeout(() => {
    state.coachBusy = false;
    if (state.mode === 'learn') {
      body.textContent =
        kind === 'hint'
          ? 'Comparez le centre et le développement des pièces légères, sans forcer un échange.'
          : 'La ligne enseigne un plan. Le commentaire ne désigne pas le coup attendu.';
      return;
    }
    const replies = {
      explain: 'Les blancs tiennent davantage le centre. Le roi n’est pas encore à l’abri.',
      hint: 'Cherchez un développement qui ouvre une diagonale, sans proposer l’échange tout de suite.',
      ask: 'Le texte commente la position. Il ne propose pas de coup à jouer.',
      mistake:
        'Le coup joué n’est pas le fantôme le plus net. Suivez cette pièce, puis celles qui s’effacent derrière elle.',
      strategy:
        'Gardez le fantôme le plus net. Les suivants montrent la suite, de plus en plus discrets.',
    };
    body.textContent = replies[kind];
  }, 700);
}

function saveSettings() {
  const remote = state.provider === 'remote';
  const model = remote ? $('remote-model').value.trim() : $('model-select').value;
  state.hasModel = model.length > 0;
  const typedKey = $('api-key').value;
  if (remote && typedKey.length > 0) state.hasKey = true;
  $('api-key').value = '';
  paintSettings();
}

function matchPreset() {
  const graphics = state.graphics;
  const found = Object.entries(PRESETS).find(([, preset]) =>
    ['resolution', 'textures', 'upscale', 'shadows', 'shadowMode', 'ao', 'reflections', 'bloom'].every(
      (key) => preset[key] === graphics[key]
    )
  );
  graphics.preset = found ? found[0] : '';
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-go], [data-mode], [data-color], [data-opening], [data-host-color], [data-set], [data-preset], [data-resolution], [data-upscale], [data-texture], [data-shadow], [data-lang], [data-provider], [data-rank], button') : null;
  if (!target) return;
  if (target.dataset.level) {
    const input = $('level');
    if (input) {
      input.value = target.dataset.level;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }
  if (target.dataset.go) {
    const destination = target.dataset.go;
    const back = state.screen === 'pause' ? 'pause' : state.screen;
    show(destination, destination === 'accueil' ? 'accueil' : back);
    return;
  }
  if (target.dataset.mode) {
    state.mode = target.dataset.mode;
    paintModes();
    return;
  }
  if (target.dataset.color) {
    state.color = target.dataset.color;
    paintModes();
    return;
  }
  if (target.dataset.opening) {
    state.opening = Number(target.dataset.opening);
    paintModes();
    return;
  }
  if (target.dataset.hostColor) {
    state.hostColor = target.dataset.hostColor;
    paintSalon();
    return;
  }
  if (target.dataset.set) {
    state.set = target.dataset.set;
    paintOptions();
    return;
  }
  if (target.dataset.preset) {
    state.graphics = { ...PRESETS[target.dataset.preset], preset: target.dataset.preset };
    paintOptions();
    return;
  }
  if (target.dataset.shadow) {
    state.graphics.shadowMode = target.dataset.shadow;
    state.graphics.shadows = target.dataset.shadow !== 'off';
    matchPreset();
    paintOptions();
    return;
  }
  if (target.dataset.resolution || target.dataset.texture || target.dataset.upscale) {
    if (target.dataset.resolution) state.graphics.resolution = target.dataset.resolution;
    if (target.dataset.texture) state.graphics.textures = target.dataset.texture;
    if (target.dataset.upscale) state.graphics.upscale = target.dataset.upscale;
    matchPreset();
    paintOptions();
    return;
  }
  if (target.dataset.lang) {
    state.language = target.dataset.lang;
    paintSettings();
    return;
  }
  if (target.dataset.provider) {
    state.provider = target.dataset.provider;
    paintSettings();
    return;
  }
  if (target.dataset.end) {
    openEnding(target.dataset.end);
    return;
  }
  if (target.dataset.rank) {
    state.rank = target.dataset.rank;
    paintRanks();
    return;
  }
  if (target.dataset.restore) {
    show('partie');
    return;
  }
  if (target.dataset.drop) {
    state.voluntary = state.voluntary.filter((id) => id !== target.dataset.drop);
    paintSaves();
    return;
  }
  const id = target.id;
  if (id === 'start') startMode();
  if (id === 'create-table') createTable();
  if (id === 'copy-code' && state.code) {
    void navigator.clipboard?.writeText(state.code);
    $('copy-code').textContent = 'Copié';
  }
  if (id === 'sim-opponent') connectThenPlay();
  if (id === 'join-table') joinTable();
  if (id === 'play-move') raiseObjection();
  if (id === 'see-board') {
    show('partie');
    $('reopen-fin').focus();
  }
  if (id === 'reopen-fin' && state.ending) show('fin');
  if (id === 'replay') replayGame();
  if (id === 'fin-modes') {
    state.ending = null;
    show('modes', 'accueil');
  }
  if (id === 'fin-home') {
    state.ending = null;
    show('accueil');
  }
  if (id === 'open-assistant') {
    state.assistant = true;
    $('assistant').hidden = false;
    paintGhosts();
    (state.mode === 'training' ? $('coach-stop') : $('coach-explain')).focus();
  }
  if (id === 'coach-stop') {
    state.trainingHeld = !state.trainingHeld;
    paintPartie();
  }
  if (id === 'coach-undo') {
    state.trainingHeld = true;
    paintPartie();
    $('coach-body').textContent = 'Votre coup est annulé. La partie reste en pause.';
  }
  if (id === 'close-assistant') {
    state.assistant = false;
    $('assistant').hidden = true;
    paintGhosts();
    $('open-pause').focus();
  }
  if (id === 'open-pause') show('pause', 'partie');
  if (id === 'resume') show('partie');
  if (id === 'save-game') $('save-confirm').hidden = false;
  if (id === 'home-restore' || id === 'restore-interrupt') show('partie');
  if (id === 'discard-interrupt') {
    state.interrupt = false;
    paintSaves();
  }
  if (id === 'change-mode') show('modes', 'pause');
  if (id === 'leave-table') leaveTable();
  if (id === 'home') show('accueil');
  if (id === 'options-back' || id === 'param-back' || id === 'rank-back' || id === 'propos-back' || id === 'saves-back') {
    show(state.back || 'accueil');
  }
  if (id === 'coach-explain') askCoach('explain');
  if (id === 'coach-hint') askCoach('hint');
  if (id === 'coach-ask') askCoach('ask');
  if (id === 'coach-mistake') askCoach('mistake');
  if (id === 'coach-strategy') askCoach('strategy');
  if (id === 'coach-settings') {
    state.reopenAssistant = true;
    show('parametres', 'partie');
  }
  if (id === 'save-settings') saveSettings();
});

document.addEventListener('pointerdown', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'range') return;
  input.closest('.scale')?.classList.remove('is-dragging');
});

document.addEventListener('pointermove', (event) => {
  if (event.buttons === 0) return;
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'range') return;
  input.closest('.is-float')?.classList.add('is-dragging');
});

document.addEventListener('pointerup', () => {
  document.querySelectorAll('.scale.is-dragging').forEach((node) => node.classList.remove('is-dragging'));
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.id === 'coach-horizon') {
    state.horizon = Number(target.value);
    $('coach-horizon-label').textContent = `Profondeur ${state.horizon}`;
    paintGhosts();
  }
  if (target.id === 'level') {
    state.level = Number(target.value);
    const label = document.querySelector('label[for="level"]');
    if (label) label.textContent = `Niveau ${state.level}`;
    paintLevelMarks(state.level);
  }
  if (target.id === 'vol-sfx') {
    state.sfx = Number(target.value);
    $('vol-sfx-val').textContent = `${Math.round(state.sfx)}`;
    placeRangeThumb(target);
  }
  if (target.id === 'vol-amb') {
    state.ambience = Number(target.value);
    $('vol-amb-val').textContent = `${Math.round(state.ambience)}`;
    placeRangeThumb(target);
  }
  if (target.id === 'opt-ao' || target.id === 'opt-reflections' || target.id === 'opt-bloom') {
    state.graphics.ao = $('opt-ao').checked;
    state.graphics.reflections = $('opt-reflections').checked;
    state.graphics.bloom = $('opt-bloom').checked;
    matchPreset();
    paintOptions();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (state.screen === 'chargement') return;
  if (state.objecting) {
    dismissObjection();
    if (state.assistant) $('coach-stop').focus();
    return;
  }
  if (state.ending && (state.screen === 'fin' || state.screen === 'partie')) {
    state.ending = null;
    show('accueil');
    return;
  }
  if (state.assistant && state.screen === 'partie') {
    state.assistant = false;
    $('assistant').hidden = true;
    paintGhosts();
    $('open-pause').focus();
    return;
  }
  if (state.screen === 'partie') {
    show('pause', 'partie');
    return;
  }
  if (state.screen === 'pause') {
    show('partie');
    return;
  }
  if (state.screen === 'salon') {
    show('modes', 'accueil');
    return;
  }
  if (state.screen === 'modes') {
    show(state.back === 'pause' ? 'pause' : 'accueil');
    return;
  }
  if (
    state.screen === 'options' ||
    state.screen === 'parametres' ||
    state.screen === 'classements' ||
    state.screen === 'propos' ||
    state.screen === 'sauvegardes'
  ) {
    show(state.back || 'accueil');
  }
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const bootMs = reduceMotion ? 0 : 2400;
show('chargement');
window.setTimeout(() => {
  if (state.screen !== 'chargement') return;
  const boot = document.querySelector('[data-screen="chargement"]');
  show('accueil');
  if (reduceMotion || !boot) return;
  boot.hidden = false;
  requestAnimationFrame(() => {
    boot.classList.add('is-leaving');
    boot.addEventListener(
      'transitionend',
      (event) => {
        if (event.propertyName === 'opacity') boot.hidden = true;
      },
      { once: true },
    );
  });
}, bootMs);
