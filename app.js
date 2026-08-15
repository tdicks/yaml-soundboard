// Full class strings so Tailwind's CDN JIT can see them.
const COLOURS = {
  slate: 'bg-slate-600 hover:bg-slate-500 focus-visible:outline-slate-400',
  red: 'bg-red-600 hover:bg-red-500 focus-visible:outline-red-400',
  orange: 'bg-orange-600 hover:bg-orange-500 focus-visible:outline-orange-400',
  amber: 'bg-amber-600 hover:bg-amber-500 focus-visible:outline-amber-400',
  yellow: 'bg-yellow-600 hover:bg-yellow-500 focus-visible:outline-yellow-400',
  lime: 'bg-lime-600 hover:bg-lime-500 focus-visible:outline-lime-400',
  green: 'bg-green-600 hover:bg-green-500 focus-visible:outline-green-400',
  emerald: 'bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-emerald-400',
  teal: 'bg-teal-600 hover:bg-teal-500 focus-visible:outline-teal-400',
  cyan: 'bg-cyan-600 hover:bg-cyan-500 focus-visible:outline-cyan-400',
  sky: 'bg-sky-600 hover:bg-sky-500 focus-visible:outline-sky-400',
  blue: 'bg-blue-600 hover:bg-blue-500 focus-visible:outline-blue-400',
  indigo: 'bg-indigo-600 hover:bg-indigo-500 focus-visible:outline-indigo-400',
  violet: 'bg-violet-600 hover:bg-violet-500 focus-visible:outline-violet-400',
  purple: 'bg-purple-600 hover:bg-purple-500 focus-visible:outline-purple-400',
  fuchsia: 'bg-fuchsia-600 hover:bg-fuchsia-500 focus-visible:outline-fuchsia-400',
  pink: 'bg-pink-600 hover:bg-pink-500 focus-visible:outline-pink-400',
  rose: 'bg-rose-600 hover:bg-rose-500 focus-visible:outline-rose-400',
};

const BASE_CLASSES =
  'relative isolate flex min-h-24 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl ' +
  'px-4 pb-6 pt-3 text-center text-sm font-semibold text-white shadow transition active:scale-95 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50';

const PLAYING_CLASSES = ['ring-2', 'ring-white', 'ring-offset-2', 'ring-offset-slate-900', 'scale-[1.02]'];
const EQ_BAR_COUNT = 24;
const EQ_MIN_HZ = 40;
const EQ_MAX_HZ = 16000;

const board = document.getElementById('board');
const statusEl = document.getElementById('status');
const volumeEl = document.getElementById('volume');
const stopEl = document.getElementById('stop');
const audio = new Audio();
let playingButton = null;

let analyser = null;
let frequencyData = null;
let bands = [];

// Log-spaced bin ranges so each bar covers a similar musical interval.
function buildBands(sampleRate, binCount) {
  const binWidth = sampleRate / 2 / binCount;
  const ratio = EQ_MAX_HZ / EQ_MIN_HZ;

  return Array.from({ length: EQ_BAR_COUNT }, (_, index) => {
    const low = EQ_MIN_HZ * ratio ** (index / EQ_BAR_COUNT);
    const high = EQ_MIN_HZ * ratio ** ((index + 1) / EQ_BAR_COUNT);
    const start = Math.min(binCount - 1, Math.floor(low / binWidth));
    const end = Math.min(binCount, Math.max(start + 1, Math.ceil(high / binWidth)));
    return { start, end };
  });
}

// The audio graph can only be built after a user gesture, so it is created on first play.
function ensureAnalyser() {
  if (analyser) return;
  const context = new (window.AudioContext ?? window.webkitAudioContext)();
  const source = context.createMediaElementSource(audio);
  analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.7;
  source.connect(analyser);
  analyser.connect(context.destination);
  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  bands = buildBands(context.sampleRate, analyser.frequencyBinCount);
  context.resume();
}

function renderEqualiser() {
  requestAnimationFrame(renderEqualiser);
  if (!playingButton || !analyser) return;

  analyser.getByteFrequencyData(frequencyData);
  const bars = playingButton.querySelectorAll('.eq-bar');

  bars.forEach((bar, index) => {
    const { start, end } = bands[index];
    let peak = 0;
    for (let i = start; i < end; i += 1) peak = Math.max(peak, frequencyData[i]);
    bar.style.transform = `scaleY(${Math.max(0.04, peak / 255)})`;
  });
}

requestAnimationFrame(renderEqualiser);

function showError(message) {
  statusEl.textContent = message;
  statusEl.classList.remove('hidden');
}

function setPlayingButton(button) {
  if (playingButton === button) return;
  if (playingButton) {
    playingButton.classList.remove(...PLAYING_CLASSES);
    playingButton.querySelector('[data-equaliser]').classList.add('opacity-0');
    playingButton.querySelector('[data-progress]').classList.add('invisible');
    playingButton.querySelector('[data-progress] > span').style.width = '0%';
    const badge = playingButton.querySelector('[data-duration]');
    if (badge) badge.textContent = badge.dataset.duration;
  }
  playingButton = button;
  stopEl.classList.toggle('invisible', !playingButton);
  if (playingButton) {
    playingButton.classList.add(...PLAYING_CLASSES);
    playingButton.querySelector('[data-equaliser]').classList.remove('opacity-0');
    playingButton.querySelector('[data-progress]').classList.remove('invisible');
  }
}

function stop() {
  audio.pause();
  audio.currentTime = 0;
  setPlayingButton(null);
}

function play(src, button) {
  ensureAnalyser();
  audio.pause();
  audio.src = src;
  audio.currentTime = 0;
  audio.volume = Number(volumeEl.value);
  setPlayingButton(button);
  audio.play().catch(() => {
    showError(`Could not play: ${src}`);
    setPlayingButton(null);
  });
}

// Full-bleed bars behind the button content, driven by the analyser while the sound plays.
function createEqualiser() {
  const equaliser = document.createElement('span');
  equaliser.dataset.equaliser = '';
  equaliser.className =
    'pointer-events-none absolute inset-0 -z-10 flex items-end gap-px opacity-0 transition-opacity duration-200';

  for (let i = 0; i < EQ_BAR_COUNT; i += 1) {
    const bar = document.createElement('span');
    bar.className = 'eq-bar h-full flex-1 rounded-t-sm bg-white/25';
    equaliser.append(bar);
  }
  return equaliser;
}

function createProgressBar() {
  const track = document.createElement('span');
  track.dataset.progress = '';
  track.className = 'invisible absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-black/30';

  const fill = document.createElement('span');
  fill.className = 'block h-full w-0 rounded-full bg-white/90';
  track.append(fill);
  return track;
}

function pickRandom(files, button) {
  if (files.length === 1) return files[0];
  let choice;
  do {
    choice = files[Math.floor(Math.random() * files.length)];
  } while (choice === button.dataset.last);
  button.dataset.last = choice;
  return choice;
}

// Resolves a random button's sources: inline `files` plus any named `list` entries.
function resolveFiles(config, lists) {
  const names = Array.isArray(config.list) ? config.list : config.list ? [config.list] : [];
  const missing = names.filter((name) => !Array.isArray(lists[name]));
  if (missing.length > 0) {
    showError(`Unknown list(s) for "${config.label}": ${missing.join(', ')}`);
  }

  const files = [
    ...(Array.isArray(config.files) ? config.files : []),
    ...names.flatMap((name) => lists[name] ?? []),
  ];
  return [...new Set(files)];
}

function formatDuration(seconds) {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// Duration comes from a metadata-only probe, so it appears once the browser has it.
function addDuration(button, src) {
  const badge = document.createElement('span');
  badge.dataset.duration = '';
  badge.className = 'absolute right-2 top-2 text-xs font-normal tabular-nums text-white/70';
  button.append(badge);

  const probe = new Audio();
  probe.preload = 'metadata';
  probe.addEventListener('loadedmetadata', () => {
    if (!Number.isFinite(probe.duration)) return;
    badge.dataset.duration = formatDuration(probe.duration);
    if (playingButton !== button) badge.textContent = badge.dataset.duration;
  });
  probe.src = src;
}

function createButton(config, lists, categories) {
  const category = categories[config.category];
  if (config.category && !category) {
    showError(`Unknown category for "${config.label}": ${config.category}`);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${BASE_CLASSES} ${COLOURS[config.colour ?? category?.colour] ?? COLOURS.slate}`;

  if (category?.name && config.type !== 'random') {
    const tag = document.createElement('span');
    tag.className = 'absolute left-2 top-2 text-xs font-normal text-white/70';
    tag.textContent = category.name;
    button.append(tag);
  }

  const label = document.createElement('span');
  label.textContent = config.label ?? 'Untitled';
  button.append(label, createEqualiser(), createProgressBar());

  // Clicking the button that is already playing stops it.
  const toggle = (chooseSrc) => () => {
    if (playingButton === button && !audio.paused) {
      stop();
      return;
    }
    play(chooseSrc(), button);
  };

  if (config.type === 'random') {
    const files = resolveFiles(config, lists);
    if (files.length === 0) {
      button.disabled = true;
      button.title = 'No files configured';
      return button;
    }
    button.addEventListener('click', toggle(() => pickRandom(files, button)));
  } else {
    if (!config.file) {
      button.disabled = true;
      button.title = 'No file configured';
      return button;
    }
    addDuration(button, config.file);
    button.addEventListener('click', toggle(() => config.file));
  }

  return button;
}

volumeEl.addEventListener('input', () => {
  audio.volume = Number(volumeEl.value);
});

audio.addEventListener('ended', () => setPlayingButton(null));
audio.addEventListener('error', () => setPlayingButton(null));

audio.addEventListener('timeupdate', () => {
  if (!playingButton || !Number.isFinite(audio.duration) || audio.duration === 0) return;
  const percent = (audio.currentTime / audio.duration) * 100;
  playingButton.querySelector('[data-progress] > span').style.width = `${percent}%`;

  const badge = playingButton.querySelector('[data-duration]');
  if (badge) badge.textContent = `${formatDuration(audio.currentTime)} / ${formatDuration(audio.duration)}`;
});

stopEl.addEventListener('click', stop);

async function init() {
  let config;
  try {
    const response = await fetch('sounds.yaml', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    config = jsyaml.load(await response.text());
  } catch (error) {
    showError(`Failed to load sounds.yaml (${error.message}). Serve this folder over HTTP.`);
    return;
  }

  if (config?.title) {
    document.getElementById('title').textContent = config.title;
    document.title = config.title;
  }

  const buttons = Array.isArray(config?.buttons) ? config.buttons : [];
  if (buttons.length === 0) {
    showError('No buttons defined in sounds.yaml.');
    return;
  }

  const lists = config?.lists ?? {};
  const categories = config?.categories ?? {};
  board.append(...buttons.map((button) => createButton(button, lists, categories)));
}

init();
