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
];

const PRESETS = {
  fluide: { title: 'Fluide', resolution: '1080', textures: 'low', shadows: true, ao: false, reflections: false, bloom: false },
  equilibre: { title: 'Équilibré', resolution: '1440', textures: 'medium', shadows: true, ao: false, reflections: false, bloom: true },
  qualite: { title: 'Qualité', resolution: '2160', textures: 'high', shadows: true, ao: true, reflections: true, bloom: true },
  natif: { title: 'Natif', resolution: 'native', textures: 'high', shadows: true, ao: true, reflections: true, bloom: true },
};

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
  hasModel: false,
  hasKey: false,
  provider: 'local',
  sfx: 80,
  ambience: 40,
  language: 'fr',
  graphics: { ...PRESETS.fluide, preset: 'fluide' },
  rank: 'local',
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
    const on = node.dataset.screen === screen || (screen === 'pause' && node.dataset.screen === 'partie');
    node.hidden = !on;
    node.classList.toggle('is-on', node.dataset.screen === screen);
  });
  $('pause').hidden = screen !== 'pause';
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
}

function paintModes() {
  $('mode-grid').innerHTML = MODES.map(
    (mode) =>
      `<button type="button" class="card${mode.id === state.mode ? ' is-selected' : ''}" data-mode="${mode.id}"><strong>${mode.title}</strong><span>${mode.blurb}</span></button>`
  ).join('');
  const extra = $('mode-extra');
  rememberChoiceThumb($('mode-color'));
  rememberChoiceThumb($('mode-openings'));
  if (state.mode === 'cpu') {
    extra.innerHTML = `<h2>Couleur</h2><div class="choice" id="mode-color">${colorButtons(state.color, 'data-color')}</div><label class="field" for="level">Niveau ${state.level}</label><input id="level" type="range" min="1" max="5" value="${state.level}" />`;
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
  $('mode-label').textContent = modeTitle();
  const chip = $('link-chip');
  const online = state.mode === 'online';
  chip.hidden = !online;
  chip.textContent = online ? $('salon-status').textContent : '';
}

function resolutionSize() {
  return RESOLUTIONS.find((item) => item.id === state.graphics.resolution)?.size ?? '';
}

function paintOptions() {
  const graphics = state.graphics;
  rememberChoiceThumb($('presets'));
  rememberChoiceThumb($('resolutions'));
  rememberChoiceThumb($('textures'));
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
  $('textures').innerHTML = TEXTURES.map(
    (item) =>
      `<button type="button" class="${graphics.textures === item.id ? 'is-selected' : ''}" data-texture="${item.id}">${item.label}</button>`
  ).join('');
  $('opt-shadows').checked = graphics.shadows;
  $('opt-ao').checked = graphics.ao;
  $('opt-reflections').checked = graphics.reflections;
  $('opt-bloom').checked = graphics.bloom;
  $('render-line').textContent = `Rendu ${resolutionSize()} · 60 img/s`;
  placeChoiceThumb($('presets'));
  placeChoiceThumb($('resolutions'));
  placeChoiceThumb($('textures'));
}

function paintSettings() {
  rememberChoiceThumb($('languages'));
  rememberChoiceThumb($('coach-provider'));
  $('vol-sfx').value = String(state.sfx);
  $('vol-amb').value = String(state.ambience);
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
    ['resolution', 'textures', 'shadows', 'ao', 'reflections', 'bloom'].every((key) => preset[key] === graphics[key])
  );
  graphics.preset = found ? found[0] : '';
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-go], [data-mode], [data-color], [data-opening], [data-host-color], [data-preset], [data-resolution], [data-texture], [data-lang], [data-provider], [data-rank], button') : null;
  if (!target) return;
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
  if (target.dataset.preset) {
    state.graphics = { ...PRESETS[target.dataset.preset], preset: target.dataset.preset };
    paintOptions();
    return;
  }
  if (target.dataset.resolution || target.dataset.texture) {
    if (target.dataset.resolution) state.graphics.resolution = target.dataset.resolution;
    if (target.dataset.texture) state.graphics.textures = target.dataset.texture;
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
  if (target.dataset.rank) {
    state.rank = target.dataset.rank;
    paintRanks();
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
  if (id === 'open-assistant') {
    state.assistant = true;
    $('assistant').hidden = false;
    $('coach-explain').focus();
  }
  if (id === 'close-assistant') {
    state.assistant = false;
    $('assistant').hidden = true;
    $('open-pause').focus();
  }
  if (id === 'open-pause') show('pause', 'partie');
  if (id === 'resume') show('partie');
  if (id === 'change-mode') show('modes', 'pause');
  if (id === 'leave-table') leaveTable();
  if (id === 'home') show('accueil');
  if (id === 'options-back' || id === 'param-back' || id === 'rank-back') show(state.back || 'accueil');
  if (id === 'coach-explain') askCoach('explain');
  if (id === 'coach-hint') askCoach('hint');
  if (id === 'coach-ask') askCoach('ask');
  if (id === 'coach-settings') {
    state.reopenAssistant = true;
    show('parametres', 'partie');
  }
  if (id === 'save-settings') saveSettings();
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.id === 'level') {
    state.level = Number(target.value);
    const label = target.previousElementSibling;
    if (label) label.textContent = `Niveau ${state.level}`;
  }
  if (target.id === 'vol-sfx') {
    state.sfx = Number(target.value);
    $('vol-sfx-val').textContent = `${state.sfx}`;
  }
  if (target.id === 'vol-amb') {
    state.ambience = Number(target.value);
    $('vol-amb-val').textContent = `${state.ambience}`;
  }
  if (target.id === 'opt-shadows' || target.id === 'opt-ao' || target.id === 'opt-reflections' || target.id === 'opt-bloom') {
    state.graphics.shadows = $('opt-shadows').checked;
    state.graphics.ao = $('opt-ao').checked;
    state.graphics.reflections = $('opt-reflections').checked;
    state.graphics.bloom = $('opt-bloom').checked;
    matchPreset();
    paintOptions();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (state.assistant && state.screen === 'partie') {
    state.assistant = false;
    $('assistant').hidden = true;
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
  if (state.screen === 'options' || state.screen === 'parametres' || state.screen === 'classements') {
    show(state.back || 'accueil');
  }
});

show('accueil');
