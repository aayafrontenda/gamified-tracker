'use strict';

/* =========================================================
   PHANTOM LIFE — data, rules, rendering
   Everything (XP, ranks, levels) is derived from state.log,
   so deleting a journal entry cleanly undoes it.
   ========================================================= */

/* ---------- rules ---------- */
const STATS = {
  knowledge:   { name: 'Knowledge',   ranks: ['Oblivious', 'Learned', 'Scholarly', 'Encyclopedic', 'Erudite'] },
  guts:        { name: 'Guts',        ranks: ['Milquetoast', 'Bold', 'Staunch', 'Dauntless', 'Lionhearted'] },
  proficiency: { name: 'Proficiency', ranks: ['Bumbling', 'Decent', 'Skilled', 'Masterful', 'Transcendent'] },
  kindness:    { name: 'Kindness',    ranks: ['Inoffensive', 'Considerate', 'Empathetic', 'Selfless', 'Angelic'] },
  charm:       { name: 'Charm',       ranks: ['Existent', 'Head-Turning', 'Suave', 'Charismatic', 'Debonair'] },
};
const STAT_ORDER = ['knowledge', 'guts', 'proficiency', 'kindness', 'charm'];
const STAT_T = [0, 40, 120, 280, 560];               // cumulative points for ranks 1..5
const CONF_T = [0, 3, 7, 12, 18, 25, 33, 42, 52, 63]; // cumulative points for confidant ranks 1..10

const INTENSITY = [
  { id: 'light',  label: 'Light',  xp: 10,  cpts: 1, hint: '~15 min' },
  { id: 'normal', label: 'Normal', xp: 25,  cpts: 2, hint: '~45 min' },
  { id: 'heavy',  label: 'Heavy',  xp: 50,  cpts: 3, hint: '~2 hours' },
  { id: 'epic',   label: 'Epic',   xp: 100, cpts: 5, hint: 'a major win' },
];
const intensity = id => INTENSITY.find(x => x.id === id) || INTENSITY[1];
const statPtsFor = xp => Math.round(xp / 5);
const YEN_PER_XP = 10;
const fmtYen = n => '¥' + Math.round(n).toLocaleString('en-US');

const ARCANA = [
  ['0', 'Fool'], ['I', 'Magician'], ['II', 'Priestess'], ['III', 'Empress'], ['IV', 'Emperor'],
  ['V', 'Hierophant'], ['VI', 'Lovers'], ['VII', 'Chariot'], ['VIII', 'Justice'], ['IX', 'Hermit'],
  ['X', 'Fortune'], ['XI', 'Strength'], ['XII', 'Hanged Man'], ['XIII', 'Death'], ['XIV', 'Temperance'],
  ['XV', 'Devil'], ['XVI', 'Tower'], ['XVII', 'Star'], ['XVIII', 'Moon'], ['XIX', 'Sun'],
  ['XX', 'Judgement'], ['XXI', 'World'], ['✦', 'Faith'], ['✧', 'Councillor'],
];

const TITLES = [
  [1, 'Transfer Student'], [3, 'Rookie Thief'], [6, 'Phantom Thief'], [10, 'Trickster'],
  [16, 'Wild Card'], [25, 'Leader of the Heist'], [40, 'Joker'], [60, 'Phantom Legend'], [99, 'God of Rebellion'],
];

const QUOTES = [
  'Take your time.', 'Looking cool, Joker!', 'I am thou, thou art I.', 'Steal back your future.',
  'Wake up. Get up. Get out there.', 'Show me your true form.', 'The game is rigged? Rewrite the rules.',
  'You never see it coming.', 'Rebel against a distorted life.',
];

const MENU = () => SCREENS.filter(s => s.menu !== false);
const SCREENS = [
  { id: 'status',     label: 'Status',     sub: 'Who you are today' },
  { id: 'skills',     label: 'Skills',     sub: 'Grind what matters' },
  { id: 'quests',     label: 'Quests',     sub: 'Habits & missions' },
  { id: 'confidants', label: 'Confidants', sub: 'The bonds that make you' },
  { id: 'journal',    label: 'Journal',    sub: 'Every step you took' },
  { id: 'compendium', label: 'Compendium', sub: 'Every self you have awakened' },
  { id: 'velvet',     label: 'Velvet Room', sub: 'Your weekly appraisal' },
  { id: 'shop',       label: 'Shop',       sub: 'Treat yourself — you earned it' },
  { id: 'system',     label: 'System',     sub: 'Save, load, config', menu: false },
];

/* ---------- platform ---------- */
// Shortcut labels and OS wording: ⌘ / Dock / Finder on macOS, Ctrl / tray / Explorer elsewhere.
const IS_MAC = window.api.platform === 'darwin';
const IS_WIN = window.api.platform === 'win32';
const KEY = IS_MAC
  ? { submit: '⌘↵', hotkey: '⌘⇧L', system: '⌘,' }
  : { submit: 'Ctrl+Enter', hotkey: 'Ctrl+Shift+L', system: 'Ctrl+,' };
const modKey = e => IS_MAC ? e.metaKey : e.ctrlKey;
const OS = IS_MAC
  ? { bg: 'in the Dock', fileMgr: 'Finder', quit: '<kbd>⌘Q</kbd> stops it', notifSettings: 'macOS blocked them — System Settings → Notifications' }
  : {
      bg: 'in the tray', fileMgr: IS_WIN ? 'Explorer' : 'file manager', quit: 'it waits in the tray — Quit from the tray icon stops it',
      notifSettings: IS_WIN ? 'Windows blocked them — Settings → System → Notifications' : 'Notifications are blocked by the system',
    };

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const weekKey = d => dkey(addDays(startOfDay(d), -((d.getDay() + 6) % 7))); // Monday
const daysUntil = key => Math.round((parseKey(key) - startOfDay()) / 86400000);
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const fmtMD = key => { const d = parseKey(key); return `${d.getMonth() + 1}/${d.getDate()}`; };
const fmtTime = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function timeOfDay(h) {
  if (h < 5) return 'Late Night';
  if (h < 8) return 'Early Morning';
  if (h < 12) return 'Morning';
  if (h < 13) return 'Lunchtime';
  if (h < 16) return 'Afternoon';
  if (h < 18) return 'After School';
  if (h < 22) return 'Evening';
  return 'Late Night';
}

// Ransom-note lettering, deterministic per seed so it doesn't flicker on re-render.
function ransom(text, seed = 1) {
  let s = seed * 7919 + text.length * 31;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return `<span class="ransom">${[...text].map(ch => {
    if (ch === ' ') return '<span class="rn-sp"></span>';
    const v = Math.floor(rnd() * 5);
    const r = (rnd() * 14 - 7).toFixed(1);
    const y = (rnd() * 8 - 4).toFixed(1);
    const sz = (0.85 + rnd() * 0.35).toFixed(2);
    return `<span class="rn rn-${v}" style="--r:${r}deg;--y:${y}px;--s:${sz}">${esc(ch)}</span>`;
  }).join('')}</span>`;
}

/* ---------- icons ---------- */
// Monochrome line icons (24×24, stroke = currentColor). Skills store the key in `icon`.
const ICONS = {
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  server: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5" stroke-dasharray="3.4 2.5"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  dumbbell: '<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>',
  ball: '<circle cx="12" cy="12" r="10"/><path d="M4.9 4.9c4 4 10.2 4 14.2 0M4.9 19.1c4-4 10.2-4 14.2 0"/>',
  mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  sword: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.3 1.6 1.3 2.7 2.5 2.7z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/><path d="M6.5 17A2.5 2.5 0 0 0 4 19.5 2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  mask: '<path d="M2 9c0-2 2-3 5-3 2 0 3.5 1 5 2 1.5-1 3-2 5-2 3 0 5 1 5 3 0 4-3 7-6 7-2 0-3-1.5-4-3-1 1.5-2 3-4 3-3 0-6-3-6-7z"/><circle cx="7.5" cy="10.5" r="1.5"/><circle cx="16.5" cy="10.5" r="1.5"/>',
  shirt: '<path d="M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.1a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2z"/>',
  crown: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zM5 20h14"/>',
  star: '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  brush: '<path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L11 15.8l-2.9-2.9z"/><path d="M8 14c-2 0-3.5 1.5-3.5 3.5 0 1.2-.8 2.2-2 2.5 1 .8 2.4 1 3.5 1 2.5 0 4.5-2 4.5-4.5"/>',
  gamepad: '<rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/>',
  chart: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  money: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.2-6"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
};
const ICON_KEYS = Object.keys(ICONS);
const iconSvg = key => ICONS[key]
  ? `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key]}</svg>` : '';
const skillIcon = s => s && ICONS[s.icon] ? iconSvg(s.icon) : '';
const skillBadge = s => ICONS[s.icon] ? iconSvg(s.icon) : `<b class="sk-mono">${esc((s.name || '?').slice(0, 2).toUpperCase())}</b>`;

// Old saves used emoji / free text. Pick an icon from the old emoji or the skill's name.
const ICON_GUESS = [
  [/⚙|devops|ops|infra|k8s|kube|docker/i, 'server'], [/🖥|💻|front|web|code|dev|program|react|js/i, 'code'],
  [/🏋|💪|sport|gym|fit|workout|train/i, 'dumbbell'], [/run|бег/i, 'flame'], [/🕶|style|fashion|стиль/i, 'mask'],
  [/📚|📖|read|book|чтен|книг/i, 'book'], [/🤝|❤|help|volunt|kind|помощ/i, 'heart'],
  [/🎓|univ|study|school|college|учеб|универ|(^|\s)пар[ыа]?(\s|$)/i, 'cap'], [/🎸|🎵|music|guitar|piano|музык/i, 'music'],
  [/lang|english|язык|🌍/i, 'globe'], [/money|financ|invest|trad|💰|деньг/i, 'chart'],
  [/cook|food|кух|готов|🍳/i, 'utensils'], [/game|игр|🎮/i, 'gamepad'], [/sleep|сон|😴/i, 'moon'],
  [/draw|art|design|рис|🎨/i, 'brush'], [/write|blog|писа|✍/i, 'pen'], [/photo|фото|📷/i, 'camera'],
  [/speak|talk|social|общен/i, 'chat'], [/work|job|career|работ|💼/i, 'briefcase'], [/health|здоров|🌿/i, 'leaf'],
];
function guessIcon(s) {
  if (ICONS[s.icon]) return s.icon;
  const hay = `${s.icon || ''} ${s.name || ''}`;
  const hit = ICON_GUESS.find(([re]) => re.test(hay));
  return hit ? hit[1] : '';
}

/* ---------- levels & ranks ---------- */
function levelFrom(xp, base, step, max = 99) {
  let lvl = 1, acc = 0, need = base + step;
  while (lvl < max && xp >= acc + need) { acc += need; lvl++; need = base + step * lvl; }
  return { lvl, into: xp - acc, need, pct: lvl >= max ? 1 : (xp - acc) / need, max: lvl >= max };
}
const skillLevel = xp => levelFrom(xp, 50, 25);
const playerLevel = xp => levelFrom(xp, 100, 50);
const titleFor = lvl => [...TITLES].reverse().find(([l]) => lvl >= l)[1];

function rankFrom(pts, T) {
  let r = 0;
  while (r < T.length - 1 && pts >= T[r + 1]) r++;
  const max = r === T.length - 1;
  return { rank: r + 1, max, pct: max ? 1 : (pts - T[r]) / (T[r + 1] - T[r]), toNext: max ? 0 : T[r + 1] - pts, pts };
}
const statRank = (k, pts) => { const r = rankFrom(pts, STAT_T); return { ...r, name: STATS[k].ranks[r.rank - 1] }; };
const confRank = pts => rankFrom(pts, CONF_T);

/* ---------- state ---------- */
let state = null;
let screen = 'status';
let D = null; // derived cache, refreshed on render
let journalLimit = 40;

function reward(name, price, icon, once = false) {
  return { id: uid(), name, price, icon, once, createdAt: new Date().toISOString() };
}

const newSkill = (name, icon, stat) => ({ id: uid(), name, icon, stat, createdAt: new Date().toISOString() });
const newQuest = (title, type, target, inten) => ({ id: uid(), title, type, target, intensity: inten, deadline: '', createdAt: new Date().toISOString() });

// A blank game: no skills or quests yet — character creation (new game section) fills them in.
function defaultState() {
  return {
    version: 1,
    player: { name: 'Joker' },
    settings: {
      sound: true, hotkey: true, openAtLogin: false,
      remindDailies: true, dailiesAt: '21:00', remindBed: true, bedAt: '23:30', remindVelvet: true,
    },
    rewards: [
      reward('Episode of anime / a series', 300, 'monitor'),
      reward('1 hour of gaming', 500, 'gamepad'),
      reward('Cheat meal', 1000, 'utensils'),
      reward('Order food delivery', 1500, 'flame'),
      reward('New piece of clothing', 8000, 'shirt', true),
    ],
    purchases: [],
    reviews: {},
    conditions: {},
    requests: {},
    compendium: {},
    skills: [],
    quests: [],
    confidants: [],
    log: [],
    timer: null, // the running focus timer, see the focus timer section
  };
}

// A ready-made character for demos, screenshots and tests.
function sampleState() {
  const s = defaultState();
  s.skills = [
    newSkill('DevOps', 'server', 'proficiency'),
    newSkill('Frontend', 'code', 'knowledge'),
    newSkill('Sports', 'dumbbell', 'guts'),
    newSkill('Style', 'mask', 'charm'),
    newSkill('Reading', 'book', 'knowledge'),
    newSkill('Helping Others', 'heart', 'kindness'),
  ];
  const by = n => 'skill:' + s.skills.find(x => x.name === n).id;
  s.quests = [
    newQuest('Work out', 'daily', by('Sports'), 'normal'),
    newQuest('Read 20 pages', 'daily', by('Reading'), 'light'),
    newQuest('Push a commit on a side project', 'daily', by('Frontend'), 'normal'),
    newQuest('Call family', 'weekly', 'stat:kindness', 'normal'),
  ];
  return s;
}

const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

function normalize(s) {
  const base = defaultState();
  if (!s || typeof s !== 'object') return base;
  return {
    version: 1,
    player: { ...base.player, ...(s.player || {}) },
    settings: { ...base.settings, ...(s.settings || {}) },
    skills: Array.isArray(s.skills) ? s.skills.map(sk => ({ ...sk, icon: guessIcon(sk) })) : base.skills,
    quests: Array.isArray(s.quests) ? s.quests : base.quests,
    confidants: Array.isArray(s.confidants) ? s.confidants : [],
    rewards: Array.isArray(s.rewards) ? s.rewards : base.rewards,
    purchases: Array.isArray(s.purchases) ? s.purchases : [],
    conditions: obj(s.conditions), requests: obj(s.requests), compendium: obj(s.compendium),
    reviews: s.reviews && typeof s.reviews === 'object' && !Array.isArray(s.reviews) ? s.reviews : {},
    log: Array.isArray(s.log) ? s.log : [],
    timer: s.timer && Array.isArray(s.timer.tg) && s.timer.startedAt ? s.timer : null,
  };
}

let saveTimer = null;
function persist() {
  window.api.timerChanged(state.timer); // tray readout + away detection live in the main process
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; window.api.save(state); }, 200);
}
window.addEventListener('beforeunload', () => { if (saveTimer) window.api.saveSync(state); });

function derive() {
  const stats = Object.fromEntries(STAT_ORDER.map(k => [k, 0]));
  const skillXp = {}, confPts = {}, byDate = {};
  let total = 0;
  for (const e of state.log) {
    for (const [k, v] of Object.entries(entryStats(e))) if (k in stats) stats[k] += v;
    for (const [id, v] of Object.entries(entrySkills(e))) skillXp[id] = (skillXp[id] || 0) + v;
    for (const id of entryConfs(e)) confPts[id] = (confPts[id] || 0) + (e.cpts || 0);
    total += e.xp || 0;
    byDate[e.date] = (byDate[e.date] || 0) + (e.xp || 0);
  }
  const spent = state.purchases.reduce((a, p) => a + (p.price || 0), 0);
  return { stats, skillXp, confPts, byDate, total, yen: total * YEN_PER_XP - spent, spent };
}

function snapshot() {
  const d = derive();
  return {
    stats: Object.fromEntries(STAT_ORDER.map(k => [k, statRank(k, d.stats[k]).rank])),
    skills: Object.fromEntries(state.skills.map(s => [s.id, skillLevel(d.skillXp[s.id] || 0).lvl])),
    conf: Object.fromEntries(state.confidants.map(c => [c.id, confRank(d.confPts[c.id] || 0).rank])),
    player: playerLevel(d.total).lvl,
  };
}

const skillById = id => state.skills.find(s => s.id === id);
const confById = id => state.confidants.find(c => c.id === id);

// target = "skill:<id>" | "stat:<key>"
function targetInfo(target) {
  const [kind, id] = String(target || '').split(':');
  if (kind === 'skill') {
    const s = skillById(id);
    if (s) return { skillId: s.id, stat: s.stat, label: s.name, icon: skillIcon(s) };
  }
  if (kind === 'stat' && STATS[id]) return { skillId: null, stat: id, label: STATS[id].name, icon: iconSvg('star') };
  return { skillId: null, stat: null, label: 'Unknown', icon: '' };
}

function entryLabel(e) {
  if (e.kind === 'review') return 'Velvet Room';
  const names = entryTargets(e).map(t => {
    const [k, id] = t.split(':');
    return k === 'skill' ? (skillById(id)?.name || 'Deleted skill') : STATS[id]?.name;
  }).filter(Boolean);
  const confs = entryConfs(e);
  if (confs.length) {
    const who = confs.map(id => confById(id)?.name || 'Former confidant').join(' & ');
    return [who, ...names].join(' · ');
  }
  return names.join(' + ') || '—';
}

/* ---------- entry gains ----------
   New entries: { tg: ["skill:<id>"|"stat:<key>"], skills: {id: xp}, stats: {key: pts}, xp }.
   Old entries: { skillId, stat, statPts, xp }. Readers below handle both. */
const entrySkills = e => e.skills || (e.skillId ? { [e.skillId]: e.xp || 0 } : {});
const entryConfs = e => e.confIds || (e.confId ? [e.confId] : []);
const entryStats = e => e.stats || (e.stat ? { [e.stat]: e.statPts || 0 } : {});
const entryTargets = e => e.tg || (e.skillId ? ['skill:' + e.skillId] : e.stat && e.kind !== 'hangout' ? ['stat:' + e.stat] : []);
const statsText = (e, short) => Object.entries(entryStats(e)).filter(([k, v]) => STATS[k] && v)
  .map(([k, v]) => `${short ? STATS[k].name.slice(0, 4) : STATS[k].name} +${v}`).join(' · ');

// Every chosen skill gets the full XP (focus skills ×1.5). Each social stat gets points once,
// even when several chosen skills feed it. The player earns the action's XP once.
function buildGains(targets, baseXp) {
  const skills = {}, stats = {};
  let top = 0, bonus = false, req = false;
  const rq = todaysRequest();
  for (const t of new Set(targets)) {
    const [kind, id] = String(t).split(':');
    if (kind === 'skill') {
      const s = skillById(id);
      if (!s) continue;
      const focus = isFocus(id);
      let xp = focus ? Math.round(baseXp * FOCUS_MULT) : baseXp;
      if (rq && !rq.done && rq.skillId === id) { xp *= 2; req = true; } // Mementos request
      bonus = bonus || focus;
      skills[id] = xp;
      stats[s.stat] = Math.max(stats[s.stat] || 0, statPtsFor(xp));
      top = Math.max(top, xp);
    } else if (kind === 'stat' && STATS[id]) {
      stats[id] = Math.max(stats[id] || 0, statPtsFor(baseXp));
      top = Math.max(top, baseXp);
    }
  }
  return { skills, stats, xp: top, bonus, req };
}

/* ---------- actions that change progress ---------- */
function commit(entry) {
  const before = snapshot();
  const e = { id: uid(), ts: new Date().toISOString(), date: dkey(), ...entry };
  state.log.push(e);
  persist();
  const after = snapshot();
  sfx.ok();
  const label = entryLabel(e);
  const st = statsText(e);
  toast(`+${e.xp} XP`, `${label}${e.req ? ' · REQUEST ×2' : ''}${e.bonus ? ' · FOCUS ×1.5' : ''}${st ? ' · ' + st : ''} · +${fmtYen(e.xp * YEN_PER_XP)}`);
  announce(before, after);
  checkCompendium();
  render();
  return e;
}

function announce(b, a) {
  for (const k of STAT_ORDER) {
    if (a.stats[k] > b.stats[k]) queueRankUp({ kicker: STATS[k].name, big: 'RANK UP!', sub: `Rank ${a.stats[k]} — ${STATS[k].ranks[a.stats[k] - 1]}`, stat: true });
  }
  for (const s of state.skills) {
    if ((a.skills[s.id] || 1) > (b.skills[s.id] || 1)) queueRankUp({ kicker: s.name, big: 'LEVEL UP!', sub: `Level ${a.skills[s.id]}` });
  }
  for (const c of state.confidants) {
    if ((a.conf[c.id] || 1) > (b.conf[c.id] || 1)) {
      const r = a.conf[c.id];
      queueRankUp({ kicker: `${arcanaOf(c)[1]} · ${c.name}`, big: r >= 10 ? 'MAX RANK!' : 'RANK UP!', sub: `Confidant Rank ${r}`, conf: true });
    }
  }
  if (a.player > b.player) queueRankUp({ kicker: state.player.name, big: 'LEVEL UP!', sub: `Lv ${a.player} — ${titleFor(a.player)}`, player: true });
}

// extra: more entry fields, e.g. { minutes } from the timer.
function logActivity(targets, intId, note = '', extra = {}) {
  const I = intensity(intId);
  const tg = [...new Set(targets)];
  const g = buildGains(tg, I.xp);
  if (!g.xp) return;
  commit({ kind: 'activity', tg, skills: g.skills, stats: g.stats, xp: g.xp, intensity: I.id, note, ...extra, ...(g.bonus && { bonus: true }), ...(g.req && { req: dkey() }) });
}

// The entry that completes q this period. Mission-stage entries carry the questId too, so skip them.
function questCompletion(q) {
  const today = dkey(), wk = weekKey(new Date());
  return state.log.find(e => e.questId === q.id && e.kind !== 'stage' && (
    q.type === 'daily' ? e.date === today :
    q.type === 'weekly' ? weekKey(parseKey(e.date)) === wk : true));
}

// Daily quests may run on chosen weekdays only (q.days = [0..6], Sun = 0). Missing = every day.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const isScheduled = (q, d = new Date()) => q.type !== 'daily' || !q.days || q.days.includes(d.getDay());
function scheduleLabel(q) {
  if (q.type !== 'daily' || !q.days || q.days.length === 7) return '';
  const k = WEEK_ORDER.filter(d => q.days.includes(d)).join();
  if (k === '1,2,3,4,5') return 'Weekdays';
  if (k === '6,0') return 'Weekends';
  return WEEK_ORDER.filter(d => q.days.includes(d)).map(d => DAY_SHORT[d]).join(' ');
}

function questStreak(q) {
  if (q.type !== 'daily') return 0;
  const done = new Set(state.log.filter(e => e.questId === q.id && e.kind !== 'stage').map(e => e.date));
  if (!done.size) return 0;
  let d = startOfDay();
  if (!done.has(dkey(d))) d = addDays(d, -1); // today still open
  let n = 0;
  for (let i = 0; i < 3660; i++, d = addDays(d, -1)) {
    if (done.has(dkey(d))) n++;
    else if (isScheduled(q, d)) break; // rest days neither count nor break
  }
  return n;
}

function dayStreak() {
  const days = new Set(state.log.map(e => e.date));
  let d = startOfDay();
  if (!days.has(dkey(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(dkey(d))) { n++; d = addDays(d, -1); }
  return n;
}

async function toggleQuest(id) {
  const q = state.quests.find(x => x.id === id);
  if (!q) return;
  const done = questCompletion(q);
  if (done) {
    state.log = state.log.filter(e => e.id !== done.id);
    persist(); sfx.back(); render();
    return;
  }
  const left = stagesOf(q).filter(s => !stageDone(q, s)).length;
  if (left && !await askConfirm('CLEAR IT NOW?', `${left} stage${left === 1 ? '' : 's'} still open. Clear the whole mission anyway?`, 'Clear mission')) return;
  completeQuest(q);
}

function completeQuest(q) {
  const I = intensity(q.intensity);
  const g = buildGains([q.target], I.xp);
  commit({ kind: 'quest', questId: q.id, tg: [q.target], skills: g.skills, stats: g.stats, xp: g.xp || I.xp, intensity: I.id, note: q.title, ...(g.bonus && { bonus: true }), ...(g.req && { req: dkey() }) });
  if (q.type === 'once') queueRankUp({ kicker: 'MISSION', big: 'TARGET DOWN', sub: q.title });
}

/* ---------- mission stages ----------
   A mission may have q.stages = [{ id, title, deadline }]. Ticking a stage logs a 'stage' entry
   (Normal XP into the mission's target); ticking the last one also clears the mission. Like
   everything else, progress lives in the journal — deleting the entry unticks the stage. */
const STAGE_EFFORT = 'normal';
const stagesOf = q => q && q.type === 'once' && Array.isArray(q.stages) ? q.stages : [];
const stageDone = (q, s) => state.log.find(e => e.kind === 'stage' && e.questId === q.id && e.stageId === s.id);
const nextStage = q => stagesOf(q).find(s => !stageDone(q, s));

// 'on' / 'behind' for an open mission with stages and a deadline: stages done vs the share of time
// gone since the mission was set, and whether the next stage's own deadline has passed.
function missionPace(q) {
  const st = stagesOf(q);
  if (!st.length || !q.deadline || questCompletion(q)) return null;
  const start = startOfDay(new Date(q.createdAt || Date.now())), end = parseKey(q.deadline), now = startOfDay();
  const span = (end - start) / 86400000;
  if (span <= 0) return null;
  const share = Math.min(1, Math.max(0, (now - start) / 86400000 / span));
  const doneN = st.filter(s => stageDone(q, s)).length;
  const ns = nextStage(q);
  const lateStage = ns && ns.deadline && daysUntil(ns.deadline) < 0;
  return lateStage || doneN + 0.5 < share * st.length ? 'behind' : 'on';
}

function toggleStage(questId, stageId) {
  const q = state.quests.find(x => x.id === questId);
  const s = stagesOf(q).find(x => x.id === stageId);
  if (!s) return;
  const done = stageDone(q, s);
  if (done) {
    // unticking a stage also reopens the mission if it was cleared
    const cleared = questCompletion(q);
    state.log = state.log.filter(e => e !== done && e !== cleared);
    persist(); sfx.back(); render();
    return;
  }
  const I = intensity(STAGE_EFFORT);
  const g = buildGains([q.target], I.xp);
  commit({ kind: 'stage', questId: q.id, stageId: s.id, tg: [q.target], skills: g.skills, stats: g.stats, xp: g.xp || I.xp, intensity: I.id, note: `${q.title} — ${s.title}`, ...(g.bonus && { bonus: true }), ...(g.req && { req: dkey() }) });
  if (!nextStage(q) && !questCompletion(q)) completeQuest(q);
}

// "D-3 · 11/26" style chip for a deadline
function dueChip(deadline) {
  const n = daysUntil(deadline);
  return `<span class="chip ${n <= 2 ? 'hot' : ''}">${n < 0 ? `${-n}d overdue` : n === 0 ? 'due today' : `D-${n}`} · ${fmtMD(deadline)}</span>`;
}

/* ---------- focus timer ----------
   One timer at a time, kept in the save (state.timer) so it survives closing the window or the app.
   Stop opens Take Action with its skills, the minutes, and an effort picked from them. The main
   process mirrors it on the tray icon and reports when the computer sat idle while it ran. */
const timerMs = (t = state.timer, now = Date.now()) =>
  t ? Math.max(0, (t.pausedAt ? Date.parse(t.pausedAt) : now) - Date.parse(t.startedAt) - (t.pausedMs || 0)) : 0;
const fmtClock = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
const fmtMin = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
// Matches the effort hints: Light ~15 min, Normal ~45 min, Heavy ~2 h. Epic stays a choice.
const effortFor = min => min < 25 ? 'light' : min < 90 ? 'normal' : 'heavy';
const targetsLabel = tg => tg.map(t => targetInfo(t).label).join(' + ');

function timerChanged() {
  persist();
  render();
}
function startTimer(targets) {
  const tg = [...new Set(targets)].filter(t => targetInfo(t).stat);
  if (!tg.length) return;
  if (state.timer) { toast('TIMER RUNNING', `Stop ${state.timer.label} first`); return; }
  state.timer = { tg, label: targetsLabel(tg), startedAt: new Date().toISOString(), pausedAt: null, pausedMs: 0 };
  timerChanged();
  sfx.ok();
  toast('TIMER STARTED', state.timer.label);
}
function pauseTimer() {
  const t = state.timer;
  if (!t || t.pausedAt) return;
  t.pausedAt = new Date().toISOString();
  timerChanged();
}
function resumeTimer() {
  const t = state.timer;
  if (!t || !t.pausedAt) return;
  t.pausedMs = (t.pausedMs || 0) + Date.now() - Date.parse(t.pausedAt);
  t.pausedAt = null;
  timerChanged();
  sfx.ok();
}
function clearTimer() { state.timer = null; timerChanged(); }
// Stop freezes the clock and asks to log it; cancelling leaves the timer paused.
function stopTimer() {
  if (!state.timer) return;
  pauseTimer();
  closeRankUp();
  openQuickLog(null, { timer: true });
}
// From the main process: the computer sat idle (or asleep) from `from` to `to` while the timer ran.
function timerAway({ from, to }) {
  const t = state.timer;
  if (!t || t.pausedAt) return;
  const ms = to - Math.max(from, Date.parse(t.startedAt));
  if (ms < 60 * 1000) return;
  const min = Math.round(ms / 60000);
  openModal(`
    <h2 class="m-title">${ransom('WELCOME BACK', 9)}</h2>
    <p class="m-text">You were away for <b>${fmtMin(min)}</b> while the ${esc(t.label)} timer kept running.</p>
    <div class="m-actions">
      <button class="btn ghost" data-act="close-modal">Keep the time</button>
      <button class="btn primary" id="away-drop">Remove ${fmtMin(min)}</button>
    </div>`, root => {
    root.querySelector('#away-drop').onclick = () => {
      closeModal();
      if (state.timer !== t) return;
      t.pausedMs = (t.pausedMs || 0) + ms;
      timerChanged();
      toast('TIME REMOVED', fmtMin(min));
    };
  });
}
// Icon buttons: the sidebar is too narrow for the clock plus worded buttons.
const tmIcon = d => `<svg viewBox="0 0 12 12" aria-hidden="true">${d}</svg>`;
const TM_ICON = {
  pause: tmIcon('<rect x="2" y="1.5" width="3" height="9"/><rect x="7" y="1.5" width="3" height="9"/>'),
  play: tmIcon('<path d="M3 1.5v9l7.5-4.5z"/>'),
  stop: tmIcon('<rect x="2" y="2" width="8" height="8"/>'),
};
// The sidebar readout; only the clock text changes every second.
function timerPanel() {
  const t = state.timer;
  if (!t) return '';
  return `<div class="timer-chip ${t.pausedAt ? 'paused' : ''}" role="group" aria-label="Focus timer">
    <div class="tm-top"><span class="tm-dot" aria-hidden="true"></span><b>${esc(t.label)}</b>${t.pausedAt ? '<em>paused</em>' : ''}</div>
    <div class="tm-row">
      <time id="timer-clock">${fmtClock(timerMs(t))}</time>
      ${t.pausedAt
        ? `<button class="tm-btn" data-act="timer-resume" title="Resume" aria-label="Resume the timer">${TM_ICON.play}</button>`
        : `<button class="tm-btn" data-act="timer-pause" title="Pause" aria-label="Pause the timer">${TM_ICON.pause}</button>`}
      <button class="tm-btn stop" data-act="timer-stop" title="Stop and log it" aria-label="Stop the timer and log it">${TM_ICON.stop}</button>
    </div>
  </div>`;
}

/* ---------- sound ---------- */
let actx = null;
function beep(notes, type = 'square', dur = 0.06, gain = 0.04) {
  if (!state?.settings.sound) return;
  try {
    actx = actx || new AudioContext();
    const t0 = actx.currentTime;
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(gain, t0 + i * dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * dur + dur * 1.8);
      o.connect(g).connect(actx.destination);
      o.start(t0 + i * dur); o.stop(t0 + i * dur + dur * 2);
    });
  } catch { /* audio is optional */ }
}
const sfx = {
  nav: () => beep([740], 'triangle', 0.035, 0.035),
  ok: () => beep([880, 1318], 'square', 0.05, 0.03),
  back: () => beep([523, 392], 'triangle', 0.05, 0.035),
  rank: () => beep([523, 659, 784, 1046, 1318, 1568], 'square', 0.07, 0.035),
};

/* ---------- toasts & rank-up ---------- */
function toast(big, small = '') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<b>${esc(big)}</b><span>${esc(small)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
}

const rankQueue = [];
function queueRankUp(r) {
  rankQueue.push(r);
  if (!$('#rankup-root').firstChild) showNextRankUp();
}
function showNextRankUp() {
  const r = rankQueue.shift();
  if (!r) return;
  sfx.rank();
  $('#rankup-root').innerHTML = `
    <div class="rankup ${r.conf ? 'conf' : ''} ${r.velvet ? 'velvet' : ''} ${r.persona ? 'persona' : ''}" data-act="close-rankup">
      <div class="ru-burst"></div>
      <div class="ru-slash"></div><div class="ru-slash two"></div>
      <div class="ru-content">
        <div class="ru-kicker">${esc(r.kicker)}</div>
        <div class="ru-big">${ransom(r.big, r.big.length + r.kicker.length)}</div>
        <div class="ru-sub">${esc(r.sub)}</div>
        <div class="ru-hint">click to continue</div>
      </div>
    </div>`;
}
function closeRankUp() {
  $('#rankup-root').innerHTML = '';
  if (rankQueue.length) setTimeout(showNextRankUp, 120);
}

/* ---------- modal ---------- */
function openModal(html, onMount) {
  $('#modal-root').innerHTML = `<div class="modal-back" data-act="modal-back"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const root = $('#modal-root .modal');
  // Name the dialog after its ransom-letter title (the letters alone read without spaces).
  const title = root.querySelector('.m-title');
  if (title) root.setAttribute('aria-label', [...title.querySelectorAll('.rn, .rn-sp')].map(n => n.classList.contains('rn-sp') ? ' ' : n.textContent).join('') || title.textContent);
  onMount && onMount(root);
  const first = root.querySelector('input:not([type=radio]):not([type=checkbox]), textarea, select');
  first && setTimeout(() => first.focus(), 30);
}
function closeModal() { $('#modal-root').innerHTML = ''; }

function askConfirm(title, msg, yes = 'Do it') {
  return new Promise(res => {
    openModal(`
      <h2 class="m-title">${ransom(title, 3)}</h2>
      <p class="m-text">${esc(msg)}</p>
      <div class="m-actions">
        <button class="btn ghost" id="cf-no">Cancel</button>
        <button class="btn danger" id="cf-yes">${esc(yes)}</button>
      </div>`, root => {
      root.querySelector('#cf-no').onclick = () => { closeModal(); res(false); };
      root.querySelector('#cf-yes').onclick = () => { closeModal(); res(true); };
    });
  });
}

const statSeg = (name, cur) => `<div class="seg">${STAT_ORDER.map(k =>
  `<label><input type="radio" name="${name}" value="${k}" ${cur === k ? 'checked' : ''}><span>${STATS[k].name}</span></label>`).join('')}</div>`;
const intSeg = (name, cur) => `<div class="seg int">${INTENSITY.map(i =>
  `<label><input type="radio" name="${name}" value="${i.id}" ${cur === i.id ? 'checked' : ''}><span><b>${i.label}</b><small>+${i.xp} XP · ${i.hint}</small></span></label>`).join('')}</div>`;
function targetSelect(name, cur) {
  return `<select name="${name}">
    <optgroup label="Skills">${state.skills.map(s => `<option value="skill:${s.id}" ${cur === 'skill:' + s.id ? 'selected' : ''}>${esc(s.name)} → ${STATS[s.stat].name}${isFocus(s.id) ? '  ★ FOCUS ×1.5' : ''}</option>`).join('')}</optgroup>
    <optgroup label="Social stat only">${STAT_ORDER.map(k => `<option value="stat:${k}" ${cur === 'stat:' + k ? 'selected' : ''}>★ ${STATS[k].name}</option>`).join('')}</optgroup>
  </select>`;
}

function targetChips(name, selected, hideStats = []) {
  const chip = (v, label, extra = '') => `<label><input type="checkbox" name="${name}" value="${v}" ${selected.includes(v) ? 'checked' : ''}><span>${label}${extra}</span></label>`;
  return `<div class="tchips">
    <div class="tc-row"><small>Skills</small>${state.skills.map(s => chip('skill:' + s.id, `${skillIcon(s)}${esc(s.name)}`, (isFocus(s.id) ? ' <em>★×1.5</em>' : '') + (isRequest(s.id) ? ' <em>×2 REQ</em>' : ''))).join('')}</div>
    <div class="tc-row"><small>Social stat only</small>${STAT_ORDER.filter(k => !hideStats.includes(k)).map(k => chip('stat:' + k, '★ ' + STATS[k].name)).join('')}</div>
  </div>`;
}

// Live "you will get" line under a target picker. `fixed` = targets always included (e.g. confidant's stat).
// `fixed(fd)` returns targets always included (e.g. the confidants' stats).
function bindGainPreview(root, fixed = () => []) {
  const f = root.querySelector('form'), out = root.querySelector('.gain-preview');
  const update = () => {
    const fd = new FormData(f);
    const I = intensity(fd.get('int'));
    const g = buildGains([...fd.getAll('target'), ...fixed(fd)], I.xp);
    const parts = [
      ...fd.getAll('conf').map(id => `<b>${esc(confById(id)?.name)}</b> bond +${I.cpts}`),
      ...Object.entries(g.skills).map(([id, xp]) => `<b>${esc(skillById(id).name)}</b> +${xp}`),
      ...Object.entries(g.stats).map(([k, v]) => `${STATS[k].name} +${v}`),
    ];
    out.innerHTML = parts.length ? `You get: ${parts.join(' · ')} · <b>Player +${g.xp} XP</b>` : '<i>Pick at least one skill or stat.</i>';
    out.classList.toggle('empty', !parts.length);
  };
  f.addEventListener('change', update);
  update();
}

// opts.timer: log the stopped timer — its skills, its minutes, an effort picked from them.
function openQuickLog(preTarget, opts = {}) {
  const t = opts.timer && state.timer;
  const last = [...state.log].reverse().find(e => e.kind === 'activity');
  const cur = t ? t.tg : preTarget ? [preTarget] : last ? entryTargets(last) : state.skills[0] ? ['skill:' + state.skills[0].id] : ['stat:knowledge'];
  const minutes = t ? Math.max(1, Math.round(timerMs(t) / 60000)) : 0;
  openModal(`
    <h2 class="m-title">${ransom(t ? 'TIME’S UP' : 'TAKE ACTION', 11)}</h2>
    <p class="m-sub">${t ? `Timer stopped at <b>${fmtClock(timerMs(t))}</b>. Check what it trained, then log it.`
      : 'How did you spend your time? Pick everything it trained.'}</p>
    <form id="ql">
      <div class="fld"><span>Trains</span>${targetChips('target', cur)}</div>
      ${t ? `<label class="fld ql-time"><span>Time <i>(minutes)</i></span><input type="number" name="minutes" min="1" max="1440" value="${minutes}" required></label>
        ${minutes > 360 ? '<p class="ql-warn">That’s a long session — check the minutes if the timer kept running by mistake.</p>' : ''}` : ''}
      <div class="fld"><span>Effort</span>${intSeg('int', t ? effortFor(minutes) : 'normal')}</div>
      <div class="gain-preview"></div>
      <label class="fld"><span>Note <i>(optional)</i></span><textarea name="note" rows="2" maxlength="280" placeholder="Deployed the k8s cluster, finally."></textarea></label>
      <div class="m-actions">
        ${t ? '<button type="button" class="btn ghost ql-left" data-act="timer-discard">Discard timer</button>' : ''}
        <button type="button" class="btn ghost" data-act="close-modal">Cancel</button>
        ${t ? '' : '<button type="button" class="btn" id="ql-timer">Start timer</button>'}
        <button class="btn primary">${t ? 'Log it' : 'Spend time'} <kbd>${KEY.submit}</kbd></button>
      </div>
    </form>`, root => {
    const f = root.querySelector('form');
    bindGainPreview(root);
    if (t) {
      // Effort follows the minutes until it's picked by hand.
      let picked = false;
      f.addEventListener('change', e => { if (e.isTrusted && e.target.name === 'int') picked = true; });
      f.minutes.addEventListener('input', () => {
        if (picked || !(f.minutes.value > 0)) return;
        f.querySelector(`input[name=int][value=${effortFor(Number(f.minutes.value))}]`).checked = true;
        f.dispatchEvent(new Event('change'));
      });
    } else {
      root.querySelector('#ql-timer').onclick = () => {
        const tg = new FormData(f).getAll('target');
        if (!tg.length) { toast('PICK ONE', 'Choose at least one skill or stat'); return; }
        closeModal();
        startTimer(tg);
      };
    }
    f.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(f);
      const tg = fd.getAll('target');
      if (!tg.length) { toast('PICK ONE', 'Choose at least one skill or stat'); return; }
      closeModal();
      if (t) {
        logActivity(tg, fd.get('int'), String(fd.get('note') || '').trim(), { minutes: Math.round(Number(fd.get('minutes'))) || minutes });
        clearTimer();
      } else logActivity(tg, fd.get('int'), String(fd.get('note') || '').trim());
    };
    f.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) f.requestSubmit(); });
  });
}

function skillModal(id) {
  const s = id ? skillById(id) : { name: '', icon: '', stat: 'proficiency' };
  openModal(`
    <h2 class="m-title">${ransom(id ? 'EDIT SKILL' : 'NEW SKILL', 5)}</h2>
    <form>
      <label class="fld"><span>Name</span><input name="name" required maxlength="40" value="${esc(s.name)}" placeholder="Guitar, Cooking, Rust…"></label>
      <div class="fld"><span>Icon <i>(optional — none shows the first letters)</i></span>
        <div class="icon-grid">
          <label title="Letters"><input type="radio" name="icon" value="" ${!ICONS[s.icon] ? 'checked' : ''}><span class="sk-mono">${esc((s.name || 'Ab').slice(0, 2).toUpperCase())}</span></label>
          ${ICON_KEYS.map(k => `<label title="${k}"><input type="radio" name="icon" value="${k}" ${s.icon === k ? 'checked' : ''}><span>${iconSvg(k)}</span></label>`).join('')}
        </div>
      </div>
      <div class="fld"><span>Feeds social stat</span>${statSeg('stat', s.stat)}</div>
      <div class="m-actions">
        <button type="button" class="btn ghost" data-act="close-modal">Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>`, root => {
    root.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = { name: String(fd.get('name')).trim(), icon: ICONS[fd.get('icon')] ? fd.get('icon') : '', stat: fd.get('stat') || 'proficiency' };
      if (id) Object.assign(s, data);
      else state.skills.push({ id: uid(), createdAt: new Date().toISOString(), ...data });
      persist(); closeModal(); sfx.ok(); render();
    };
  });
}

// One editable stage in the mission dialog; the hidden id keeps ticked stages ticked after edits.
const stageEditRow = s => `<li>
  <input name="stage-title" maxlength="80" value="${esc(s.title)}" placeholder="Next step" aria-label="Stage">
  <input type="date" name="stage-deadline" value="${esc(s.deadline || '')}" aria-label="Stage deadline (optional)">
  <input type="hidden" name="stage-id" value="${esc(s.id)}">
  <button type="button" class="ic" data-rm aria-label="Remove stage" title="Remove stage">✕</button>
</li>`;

function questModal(id, presetType) {
  const q = id ? state.quests.find(x => x.id === id) : {
    title: '', type: presetType || 'daily', intensity: presetType === 'once' ? 'epic' : 'normal', deadline: '',
    target: state.skills[0] ? 'skill:' + state.skills[0].id : 'stat:knowledge',
  };
  const types = [['daily', 'Daily', 'resets every day'], ['weekly', 'Weekly', 'resets on Monday'], ['once', 'Mission', 'one-time target']];
  openModal(`
    <h2 class="m-title">${ransom(id ? 'EDIT QUEST' : 'NEW QUEST', 9)}</h2>
    <form>
      <label class="fld"><span>Title</span><input name="title" required maxlength="80" value="${esc(q.title)}" placeholder="Meditate 10 minutes"></label>
      <div class="fld"><span>Type</span><div class="seg">${types.map(([v, l, h]) =>
        `<label><input type="radio" name="type" value="${v}" ${q.type === v ? 'checked' : ''}><span><b>${l}</b><small>${h}</small></span></label>`).join('')}</div></div>
      <label class="fld"><span>Rewards</span>${targetSelect('target', q.target)}</label>
      <div class="fld"><span>Reward size</span>${intSeg('int', q.intensity)}</div>
      <div class="fld days-fld"><span>Repeat on</span>
        <div class="seg days">${WEEK_ORDER.map(d => `<label><input type="checkbox" name="days" value="${d}" ${!q.days || q.days.includes(d) ? 'checked' : ''}><span>${DAY_SHORT[d]}</span></label>`).join('')}</div>
        <div class="day-presets">
          <button type="button" class="btn small ghost" data-days="0,1,2,3,4,5,6">Every day</button>
          <button type="button" class="btn small ghost" data-days="1,2,3,4,5">Weekdays</button>
          <button type="button" class="btn small ghost" data-days="6,0">Weekends</button>
        </div>
      </div>
      <label class="fld deadline-fld"><span>Deadline <i>(missions only, optional)</i></span><input type="date" name="deadline" value="${esc(q.deadline || '')}"></label>
      <div class="fld stages-fld"><span>Stages <i>(optional — break the mission into steps; each pays +${intensity(STAGE_EFFORT).xp} XP)</i></span>
        <ol class="stage-edit">${stagesOf(q).map(stageEditRow).join('')}</ol>
        <button type="button" class="btn small ghost" id="add-stage">+ Add stage</button>
      </div>
      <div class="m-actions">
        <button type="button" class="btn ghost" data-act="close-modal">Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>`, root => {
    const f = root.querySelector('form');
    const sync = () => {
      const type = new FormData(f).get('type');
      root.querySelector('.deadline-fld').classList.toggle('hidden', type !== 'once');
      root.querySelector('.stages-fld').classList.toggle('hidden', type !== 'once');
      root.querySelector('.days-fld').classList.toggle('hidden', type !== 'daily');
    };
    f.addEventListener('change', sync); sync();
    const list = root.querySelector('.stage-edit');
    root.querySelector('#add-stage').onclick = () => {
      list.insertAdjacentHTML('beforeend', stageEditRow({ id: '', title: '', deadline: '' }));
      list.lastElementChild.querySelector('input').focus();
    };
    list.addEventListener('click', e => { if (e.target.closest('[data-rm]')) e.target.closest('li').remove(); });
    root.querySelectorAll('[data-days]').forEach(b => b.onclick = () => {
      const on = b.dataset.days.split(',');
      f.querySelectorAll('input[name=days]').forEach(c => { c.checked = on.includes(c.value); });
    });
    f.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(f);
      const days = fd.getAll('days').map(Number);
      if (fd.get('type') === 'daily' && !days.length) { toast('NO DAYS', 'Pick at least one day'); return; }
      const ids = fd.getAll('stage-id'), dls = fd.getAll('stage-deadline');
      const stages = fd.getAll('stage-title').map((t, i) => ({ id: ids[i] || uid(), title: String(t).trim(), deadline: String(dls[i] || '') }))
        .filter(s => s.title);
      const data = {
        title: String(fd.get('title')).trim(), type: fd.get('type'), target: fd.get('target'),
        intensity: fd.get('int'), deadline: fd.get('type') === 'once' ? String(fd.get('deadline') || '') : '',
        days: fd.get('type') === 'daily' && days.length < 7 ? days : undefined,
        stages: fd.get('type') === 'once' && stages.length ? stages : undefined,
      };
      if (id) {
        Object.assign(q, data);
        if (!data.days) delete q.days;
        if (!data.stages) delete q.stages;
      } else {
        state.quests.push({ id: uid(), createdAt: new Date().toISOString(), ...data });
      }
      persist(); closeModal(); sfx.ok(); render();
    };
  });
}

const arcanaOf = c => ARCANA.find(a => a[1] === c.arcana) || ARCANA[0];

function confModal(id) {
  const c = id ? confById(id) : { name: '', arcana: 'Fool', stat: 'kindness', notes: '' };
  openModal(`
    <h2 class="m-title">${ransom(id ? 'EDIT CONFIDANT' : 'NEW CONFIDANT', 13)}</h2>
    <form>
      <label class="fld"><span>Name</span><input name="name" required maxlength="40" value="${esc(c.name)}" placeholder="Mom, Best friend, Mentor…"></label>
      <label class="fld"><span>Arcana</span><select name="arcana">${ARCANA.map(([n, a]) => `<option value="${a}" ${c.arcana === a ? 'selected' : ''}>${n} — ${a}</option>`).join('')}</select></label>
      <div class="fld"><span>Time together grows</span>${statSeg('stat', c.stat)}</div>
      <label class="fld"><span>Notes <i>(what you know, what they like)</i></span><textarea name="notes" rows="3" maxlength="600">${esc(c.notes)}</textarea></label>
      <div class="m-actions">
        <button type="button" class="btn ghost" data-act="close-modal">Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>`, root => {
    root.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = { name: String(fd.get('name')).trim(), arcana: fd.get('arcana'), stat: fd.get('stat') || 'kindness', notes: String(fd.get('notes') || '').trim() };
      if (id) Object.assign(c, data);
      else state.confidants.push({ id: uid(), createdAt: new Date().toISOString(), ...data });
      persist(); closeModal(); sfx.ok(); render();
    };
  });
}

// One meeting can include several confidants: each gets full bond points,
// their stats are credited once each, and the player earns the XP once.
function hangoutModal(id) {
  if (!state.confidants.length) return;
  const first = id ? confById(id) : null;
  const confStats = fd => fd.getAll('conf').map(cid => confById(cid)).filter(Boolean).map(c => 'stat:' + c.stat);
  openModal(`
    <h2 class="m-title">${ransom('HANG OUT', 17)}</h2>
    <p class="m-sub">Who was there? Everyone you pick grows closer.</p>
    <form>
      <div class="fld"><span>With</span><div class="tchips"><div class="tc-row">${state.confidants.map(c =>
        `<label><input type="checkbox" name="conf" value="${c.id}" ${c.id === id ? 'checked' : ''}><span>${esc(arcanaOf(c)[0])} ${esc(c.name)}</span></label>`).join('')}</div></div></div>
      <div class="fld"><span>How deep?</span>${intSeg('int', 'normal')}</div>
      <div class="fld"><span>Also trained <i>(optional · their stats are always included)</i></span>${targetChips('target', first?.lastTg || [])}</div>
      <div class="gain-preview"></div>
      <label class="fld"><span>What happened <i>(optional)</i></span><textarea name="note" rows="2" maxlength="280" placeholder="Ramen and a long talk about the future."></textarea></label>
      <div class="m-actions">
        <button type="button" class="btn ghost" data-act="close-modal">Cancel</button>
        <button class="btn primary">Spend time</button>
      </div>
    </form>`, root => {
    bindGainPreview(root, confStats);
    root.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const confIds = fd.getAll('conf').map(String);
      if (!confIds.length) { toast('WITH WHOM?', 'Pick at least one confidant'); return; }
      const I = intensity(fd.get('int'));
      const extra = fd.getAll('target');
      const g = buildGains([...extra, ...confStats(fd)], I.xp);
      for (const cid of confIds) { const c = confById(cid); if (c) c.lastTg = extra; }
      closeModal();
      commit({ kind: 'hangout', confIds, tg: extra, skills: g.skills, stats: g.stats, xp: g.xp, cpts: I.cpts, intensity: I.id, note: String(fd.get('note') || '').trim(), ...(g.bonus && { bonus: true }), ...(g.req && { req: dkey() }) });
    };
  });
}

/* ---------- shared view bits ---------- */
const bar = (pct, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(1, pct)) * 100}%"></i></div>`;
const pips = (n, total) => `<div class="pips">${Array.from({ length: total }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
function head(id, quote) {
  const s = SCREENS.find(x => x.id === id);
  const q = quote || QUOTES[(new Date().getDate() + SCREENS.indexOf(s)) % QUOTES.length];
  return `<header class="scr-head"><h1>${ransom(s.label.toUpperCase(), SCREENS.indexOf(s) + 2)}</h1><div class="scr-sub"><span>${esc(s.sub)}</span><em>“${esc(q)}”</em></div></header>`;
}
const empty = (big, small, act, btn) => `<div class="empty"><b>${esc(big)}</b><span>${esc(small)}</span>${act ? `<button class="btn primary" data-act="${act}">${esc(btn)}</button>` : ''}</div>`;

function radar() {
  const size = 440, c = size / 2, R = 140;
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / 5;
  const pt = (i, r) => [c + r * Math.cos(ang(i)), c + r * Math.sin(ang(i))];
  const poly = r => STAT_ORDER.map((_, i) => pt(i, r).map(n => n.toFixed(1)).join(',')).join(' ');
  const vals = STAT_ORDER.map(k => { const r = statRank(k, D.stats[k]); return r.max ? 5 : r.rank - 1 + r.pct; });
  const shape = vals.map((v, i) => pt(i, R * (0.1 + 0.9 * v / 5)).map(n => n.toFixed(1)).join(',')).join(' ');
  const rings = [1, 2, 3, 4, 5].map(k => `<polygon points="${poly(R * k / 5)}" class="ring ${k === 5 ? 'outer' : ''}"/>`).join('');
  const spokes = STAT_ORDER.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" class="spoke"/>`; }).join('');
  const labels = STAT_ORDER.map((k, i) => {
    const [x, y] = pt(i, R + 62);
    const r = statRank(k, D.stats[k]);
    return `<div class="rd-label" style="left:${x / size * 100}%;top:${y / size * 100}%"><b>${STATS[k].name}</b><span>${r.max ? 'MAX' : 'Rk ' + r.rank} · ${r.name}</span></div>`;
  }).join('');
  return `<div class="radar">
    <svg viewBox="0 0 ${size} ${size}">
      <polygon points="${poly(R + 22)}" class="halo"/>
      ${rings}${spokes}
      <polygon points="${shape}" class="shape-shadow" transform="translate(7 7)"/>
      <polygon points="${shape}" class="shape"/>
    </svg>${labels}</div>`;
}

function heatmap(weeks) {
  const today = startOfDay();
  const end = addDays(today, 6 - ((today.getDay() + 6) % 7));
  const start = addDays(end, -(weeks * 7) + 1);
  let cols = '';
  for (let w = 0; w < weeks; w++) {
    let cells = '';
    for (let i = 0; i < 7; i++) {
      const dt = addDays(start, w * 7 + i), k = dkey(dt), xp = D.byDate[k] || 0;
      const lv = dt > today ? 'f' : xp === 0 ? 0 : xp < 30 ? 1 : xp < 75 ? 2 : xp < 150 ? 3 : 4;
      cells += `<i class="h${lv} ${k === dkey(today) ? 'today' : ''}" title="${k} · ${xp} XP"></i>`;
    }
    cols += `<div class="hw">${cells}</div>`;
  }
  return `<div class="heat" style="--w:${weeks}">${cols}</div>
    <div class="heat-legend"><span>less</span><i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i><span>more</span></div>`;
}

/* ---------- screens ---------- */
function scrStatus() {
  const pl = playerLevel(D.total);
  const today = dkey();
  const todayXp = D.byDate[today] || 0;
  const todayCount = state.log.filter(e => e.date === today).length;
  const dailies = state.quests.filter(q => q.type === 'daily' && (isScheduled(q) || questCompletion(q)));
  const missions = state.quests.filter(q => q.type === 'once' && q.deadline && !questCompletion(q))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const m = missions[0];

  const statRows = STAT_ORDER.map(k => {
    const r = statRank(k, D.stats[k]);
    return `<div class="stat-row">
      <div class="sr-top"><span class="sr-name">${STATS[k].name}</span><span class="sr-rank">${r.max ? 'MAX' : 'RANK ' + r.rank}</span></div>
      <div class="sr-title">${r.name}</div>
      ${pips(r.rank, 5)}
      ${bar(r.pct, 'thin')}
      <div class="sr-next">${r.max ? 'Mastered. Truly.' : `${r.toNext} pts → ${STATS[k].ranks[r.rank]}`}</div>
    </div>`;
  }).join('');

  let card;
  if (m) {
    const n = daysUntil(m.deadline);
    const st = stagesOf(m), ns = nextStage(m), pace = missionPace(m);
    const doneN = st.filter(s => stageDone(m, s)).length;
    card = `<section class="calling-card" data-act="go" data-id="quests">
      <div class="cc-kicker">TARGET</div>
      <div class="cc-title">${esc(m.title)}</div>
      ${st.length ? `<div class="cc-stages">${bar(doneN / st.length)}<span>${doneN}/${st.length}${pace === 'behind' ? ' · BEHIND' : ''}</span></div>
        ${ns ? `<div class="cc-next">NEXT: ${esc(ns.title)}${ns.deadline ? ` · ${fmtMD(ns.deadline)}` : ''}</div>` : ''}` : ''}
      <div class="cc-foot"><span>DEADLINE ${fmtMD(m.deadline)}</span>
        <span class="cc-days">${n < 0 ? `<b>${-n}</b> DAYS OVERDUE` : n === 0 ? '<b>!</b> TODAY' : `<b>${n}</b> DAY${n === 1 ? '' : 'S'} LEFT`}</span></div>
      ${missions.length > 1 ? `<div class="cc-more">+${missions.length - 1} more target${missions.length > 2 ? 's' : ''}</div>` : ''}
    </section>`;
  } else {
    card = `<section class="calling-card idle" data-act="new-mission">
      <div class="cc-kicker">NO TARGET</div>
      <div class="cc-title">Send a calling card.</div>
      <div class="cc-foot"><span>Set a mission with a deadline →</span></div>
    </section>`;
  }

  return `${head('status')}
  <div class="status-grid">
    <section class="panel player">
      <div class="tag">CODENAME</div>
      <div class="p-name">${esc(state.player.name)}</div>
      <div class="p-title">${esc(titleFor(pl.lvl))}</div>
      <div class="p-lv"><span>LV</span><b>${pl.lvl}</b></div>
      ${bar(pl.pct)}
      <div class="p-xp">${pl.into} / ${pl.need} XP to next level</div>
      <div class="p-nums">
        <div><b>${D.total}</b><span>Total XP</span></div>
        <div><b>${dayStreak()}</b><span>Day streak</span></div>
        <div><b>${state.log.length}</b><span>Actions</span></div>
      </div>
    </section>
    <section class="radar-panel">${radar()}</section>
    <section class="panel stat-list">${statRows}</section>
    <section class="panel today">
      <div class="tag">TODAY'S RESULTS</div>
      <div class="t-nums"><div><b>+${todayXp}</b><span>XP</span></div><div><b>${todayCount}</b><span>actions</span></div>
        <div><b>${dailies.filter(q => questCompletion(q)).length}/${dailies.length}</b><span>dailies</span></div></div>
      <div class="t-quests">${dailies.length ? dailies.map(q => {
        const done = !!questCompletion(q);
        return `<button class="mini-q ${done ? 'done' : ''}" data-act="toggle-quest" data-id="${q.id}"><i></i><span>${esc(q.title)}</span></button>`;
      }).join('') : '<div class="muted">No daily quests yet.</div>'}</div>
    </section>
    ${card}
    ${conditionPanel()}
    ${requestPanel()}
    <section class="panel heat-panel"><div class="tag">ACTIVITY · LAST 26 WEEKS</div>${heatmap(26)}</section>
  </div>`;
}

function scrSkills() {
  const today = dkey();
  const cards = state.skills.map(s => {
    const xp = D.skillXp[s.id] || 0;
    const L = skillLevel(xp);
    const tXp = state.log.filter(e => e.date === today).reduce((a, e) => a + (entrySkills(e)[s.id] || 0), 0);
    const focus = isFocus(s.id);
    const timing = state.timer && state.timer.tg.includes('skill:' + s.id);
    return `<div class="skill-card ${focus ? 'focus' : ''}">
      <div class="sk-top">
        <div class="sk-icon">${skillBadge(s)}</div>
        <div class="sk-name">${esc(s.name)}</div>
        <div class="sk-tools">
          <button class="ic" title="Edit" data-act="edit-skill" data-id="${s.id}">✎</button>
          <button class="ic" title="Delete" data-act="del-skill" data-id="${s.id}">✕</button>
        </div>
      </div>
      <div class="sk-mid">
        <div class="sk-lv"><span>LV</span><b>${L.lvl}</b></div>
        <div class="sk-info">
          <div class="sk-feeds">feeds <b>${STATS[s.stat].name}</b></div>
          ${focus ? '<div class="sk-focus">★ Focus ×1.5</div>' : ''}
          ${tXp ? `<div class="sk-today">+${tXp} today</div>` : ''}
        </div>
      </div>
      ${bar(L.pct)}
      <div class="sk-xp"><span>${L.into} / ${L.need} XP</span><span>${xp} total</span></div>
      <div class="sk-quick">${INTENSITY.map(i => `<button data-act="quick-skill" data-id="${s.id}" data-int="${i.id}" title="${i.label} · ${i.hint}">+${i.xp}</button>`).join('')}
        <button class="note" data-act="log-skill" data-id="${s.id}" title="Log with a note">✎</button>
        ${timing ? `<button class="timer on" data-act="timer-stop" title="Stop the timer" aria-label="Stop the ${esc(s.name)} timer">■</button>`
          : `<button class="timer" data-act="timer-skill" data-id="${s.id}" title="Start a timer" aria-label="Start a timer for ${esc(s.name)}">▶</button>`}</div>
    </div>`;
  }).join('');
  return `${head('skills')}
  <div class="skill-grid">${cards}
    <button class="skill-add" data-act="add-skill"><b>+</b><span>NEW SKILL</span></button>
  </div>`;
}

function questRow(q) {
  const done = questCompletion(q);
  const t = targetInfo(q.target);
  const I = intensity(q.intensity);
  const streak = questStreak(q);
  const dl = q.type === 'once' && q.deadline && !done ? dueChip(q.deadline) : '';
  const sched = scheduleLabel(q);
  const rest = !done && !isScheduled(q);
  const stages = stagesOf(q);
  let stageBlock = '';
  if (stages.length) {
    const doneN = stages.filter(s => stageDone(q, s)).length;
    const pace = missionPace(q);
    stageBlock = `
      <div class="ms-prog">${bar(doneN / stages.length)}<span>${doneN}/${stages.length} stages</span>
        ${pace ? `<span class="chip pace-${pace}">${pace === 'on' ? '● on track' : '● behind'}</span>` : ''}</div>
      ${done ? '' : `<ol class="ms-stages">${stages.map(s => {
        const sd = stageDone(q, s);
        return `<li class="${sd ? 'done' : ''}">
          <button class="ms-check" data-act="toggle-stage" data-id="${q.id}" data-stage="${s.id}" aria-pressed="${!!sd}"
            aria-label="${sd ? 'Undo' : 'Complete'} stage: ${esc(s.title)}" title="${sd ? 'Undo' : `Complete · +${intensity(STAGE_EFFORT).xp} XP`}"><i></i></button>
          <span class="ms-title">${esc(s.title)}</span>
          ${s.deadline && !sd ? dueChip(s.deadline) : sd ? `<span class="ms-when">${fmtMD(sd.date)}</span>` : ''}
        </li>`;
      }).join('')}</ol>`}`;
  }
  return `<div class="quest ${done ? 'done' : ''} ${rest ? 'rest' : ''} ${stages.length ? 'staged' : ''}">
    <button class="q-check" data-act="toggle-quest" data-id="${q.id}" title="${done ? 'Undo' : 'Complete'}"><i></i></button>
    <div class="q-body">
      <div class="q-title">${esc(q.title)}</div>
      <div class="q-meta"><span class="chip">+${I.xp} XP</span><span class="chip ghost">${t.icon}${esc(t.label)}</span>
        ${sched ? `<span class="chip ghost">↻ ${esc(sched)}</span>` : ''}
        ${rest ? '<span class="chip rest">rest day</span>' : ''}
        ${streak ? `<span class="chip fire">🔥 ${streak}</span>` : ''}${dl}
        ${done && q.type === 'once' ? `<span class="chip ghost">cleared ${fmtMD(done.date)}</span>` : ''}</div>
      ${stageBlock}
    </div>
    <div class="q-tools">
      <button class="ic" data-act="edit-quest" data-id="${q.id}" title="Edit">✎</button>
      <button class="ic" data-act="del-quest" data-id="${q.id}" title="Delete">✕</button>
    </div>
  </div>`;
}

function scrQuests() {
  const by = type => state.quests.filter(q => q.type === type);
  const daily = by('daily'), weekly = by('weekly');
  const missions = by('once').filter(q => !questCompletion(q)).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  const cleared = by('once').filter(q => questCompletion(q));
  const section = (title, sub, list, type, emptyMsg) => `
    <section class="q-section">
      <div class="q-head"><h2>${title}</h2><span>${sub}</span><button class="btn small" data-act="add-quest" data-type="${type}">+ Add</button></div>
      ${list.length ? list.map(questRow).join('') : `<div class="muted pad">${emptyMsg}</div>`}
    </section>`;
  return `${head('quests')}
  <div class="quest-cols">
    <div>
      ${section('Daily', `${daily.filter(q => questCompletion(q)).length}/${daily.filter(q => isScheduled(q) || questCompletion(q)).length} today`, daily, 'daily', 'Small things, every day. That’s how hearts get stolen.')}
      ${section('Weekly', 'resets Monday', weekly, 'weekly', 'Nothing weekly yet.')}
    </div>
    <div>
      ${section('Missions', 'one-time targets', missions, 'once', 'No active missions. Pick a big target and give it a deadline.')}
      ${cleared.length ? `<section class="q-section cleared"><div class="q-head"><h2>Cleared</h2><span>${cleared.length} taken down</span></div>${cleared.map(questRow).join('')}</section>` : ''}
    </div>
  </div>`;
}

function scrConfidants() {
  const cards = state.confidants.map(c => {
    const r = confRank(D.confPts[c.id] || 0);
    const [num, name] = arcanaOf(c);
    const last = [...state.log].reverse().find(e => entryConfs(e).includes(c.id));
    const since = last ? -daysUntil(last.date) : null;
    return `<div class="conf-card">
      <div class="arcana"><span class="ar-num">${esc(num)}</span><span class="ar-name">${esc(name)}</span></div>
      <div class="conf-body">
        <div class="conf-top"><div class="conf-name">${esc(c.name)}</div>
          <div class="sk-tools"><button class="ic" data-act="edit-conf" data-id="${c.id}">✎</button><button class="ic" data-act="del-conf" data-id="${c.id}">✕</button></div></div>
        <div class="conf-rank"><span>RANK</span><b>${r.max ? 'MAX' : r.rank}</b></div>
        ${pips(r.rank, 10)}
        <div class="conf-meta">${r.max ? 'Bond complete.' : `${r.toNext} more to rank ${r.rank + 1}`} · grows ${STATS[c.stat].name}
          ${since !== null ? ` · last seen ${since === 0 ? 'today' : since + 'd ago'}` : ''}</div>
        ${c.notes ? `<div class="conf-notes">${esc(c.notes)}</div>` : ''}
        <button class="btn primary small" data-act="hangout" data-id="${c.id}">Spend time</button>
      </div>
    </div>`;
  }).join('');
  return `${head('confidants')}
  ${state.confidants.length > 1 ? '<div class="conf-bar"><button class="btn primary" data-act="hangout">Group hangout</button></div>' : ''}
  ${state.confidants.length ? `<div class="conf-grid">${cards}<button class="skill-add" data-act="add-conf"><b>+</b><span>NEW CONFIDANT</span></button></div>`
    : empty('No confidants yet.', 'Friends, family, mentors — the people you want to grow closer to. Each bond has 10 ranks.', 'add-conf', '+ Add your first confidant')}`;
}

const KIND_TAG = { activity: 'ACTION', quest: 'QUEST', stage: 'STAGE', hangout: 'BOND', review: 'VELVET' };
const jItem = e => `
  <div class="j-item">
    <span class="j-time">${fmtTime(e.ts)}</span>
    <span class="j-kind ${e.kind}">${KIND_TAG[e.kind] || 'ACTION'}</span>
    <span class="j-label">${esc(entryLabel(e))}${e.minutes ? ` <span class="j-min">· ${fmtMin(e.minutes)}</span>` : ''}${e.note ? ` — <i>${esc(e.note)}</i>` : ''}</span>
    <span class="j-xp">+${e.xp}${statsText(e, true) ? ' · ' + statsText(e, true) : ''}</span>
    <button class="ic" data-act="del-entry" data-id="${e.id}" title="Delete (undo)">✕</button>
  </div>`;

let journalTab = 'log';
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calDay = null;

function scrJournal() {
  const tabs = [['log', 'Log'], ['calendar', 'Calendar'], ['charts', 'Charts']];
  const body = journalTab === 'calendar' ? journalCalendar() : journalTab === 'charts' ? journalCharts() : journalLog();
  return `${head('journal')}
  <div class="j-tabs">${tabs.map(([id, l]) => `<button class="j-tab ${journalTab === id ? 'on' : ''}" data-act="j-tab" data-id="${id}">${l}</button>`).join('')}</div>
  ${body}`;
}

function journalLog() {
  const entries = [...state.log].sort((a, b) => b.ts.localeCompare(a.ts));
  const shown = entries.slice(0, journalLimit);
  const groups = [];
  for (const e of shown) {
    if (!groups.length || groups[groups.length - 1].date !== e.date) groups.push({ date: e.date, items: [] });
    groups[groups.length - 1].items.push(e);
  }
  const body = groups.map(g => {
    const dt = parseKey(g.date);
    const cond = state.conditions[g.date];
    return `<div class="j-day">
      <div class="j-date"><b>${dt.getMonth() + 1}/${dt.getDate()}</b><span class="dow ${dt.getDay() === 0 ? 'sun' : dt.getDay() === 6 ? 'sat' : ''}">${DOW[dt.getDay()]}</span><em>+${D.byDate[g.date] || 0} XP</em>
        ${cond ? `<span class="cond-chip c-${cond}">${condLabel(cond)}</span>` : ''}</div>
      <div class="j-items">${g.items.map(jItem).join('')}</div>
    </div>`;
  }).join('');
  return `<section class="panel heat-panel wide"><div class="tag">ACTIVITY · LAST YEAR</div>${heatmap(52)}</section>
  ${entries.length ? `<div class="journal">${body}</div>
    ${entries.length > journalLimit ? `<div class="center"><button class="btn" data-act="more-journal">Show more (${entries.length - journalLimit} left)</button></div>` : ''}`
    : empty('The journal is empty.', 'Press L anywhere to log your first action.', 'quick-log', 'Take action')}`;
}

/* ---------- calendar ---------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function journalCalendar() {
  const first = calMonth;
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const today = dkey();
  const sel = calDay || today;
  const deadlines = {}; // date → labels: mission deadlines and open stages' deadlines
  const addDl = (k, label) => (deadlines[k] = deadlines[k] || []).push(label);
  for (const q of state.quests) {
    if (q.type !== 'once') continue;
    if (q.deadline) addDl(q.deadline, q.title);
    for (const s of stagesOf(q)) if (s.deadline && !stageDone(q, s)) addDl(s.deadline, `${s.title} (${q.title})`);
  }
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const dt = addDays(start, i), k = dkey(dt), xp = D.byDate[k] || 0;
    const lv = xp === 0 ? 0 : xp < 30 ? 1 : xp < 75 ? 2 : xp < 150 ? 3 : 4;
    const cond = state.conditions[k];
    const dl = deadlines[k] || [];
    const tip = [`<b>${fmtMD(k)} ${DOW[dt.getDay()]}</b>`, `${xp} XP`, cond && condLabel(cond), ...dl.map(t => '◆ ' + esc(t))].filter(Boolean).join('<br>');
    cells += `<button class="cal-cell h${lv} ${dt.getMonth() !== first.getMonth() ? 'out' : ''} ${k === today ? 'today' : ''} ${k === sel ? 'sel' : ''}" data-act="cal-day" data-id="${k}" data-tip="${esc(tip)}">
      <span class="cc-n">${dt.getDate()}</span>
      ${cond ? `<i class="cc-cond c-${cond}"></i>` : ''}
      ${xp ? `<span class="cc-xp">${xp}</span>` : ''}
      ${dl.length ? `<span class="cc-dl">◆ ${esc(dl[0])}</span>` : ''}
    </button>`;
  }
  const dayEntries = state.log.filter(e => e.date === sel).sort((a, b) => a.ts.localeCompare(b.ts));
  const sd = parseKey(sel), sc = state.conditions[sel];
  return `<div class="cal-wrap">
    <section class="cal-month">
      <div class="cal-head">
        <button class="vr-arrow" data-act="cal-month" data-dir="-1">◀</button>
        <b>${MONTHS[first.getMonth()]} <span>${first.getFullYear()}</span></b>
        <button class="vr-arrow" data-act="cal-month" data-dir="1">▶</button>
      </div>
      <div class="cal-dows">${['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => `<span class="${d === 'SUN' ? 'sun' : d === 'SAT' ? 'sat' : ''}">${d}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
    </section>
    <section class="panel cal-day">
      <div class="tag">${sd.getMonth() + 1}/${sd.getDate()} · ${DOW[sd.getDay()]}</div>
      <div class="cd-sum"><b>+${D.byDate[sel] || 0} XP</b>${sc ? `<span class="cond-chip c-${sc}">${condLabel(sc)}</span>` : ''}</div>
      ${(deadlines[sel] || []).map(t => `<div class="cd-dl">◆ Deadline: ${esc(t)}</div>`).join('')}
      <div class="j-items">${dayEntries.length ? dayEntries.map(jItem).join('') : '<div class="muted pad">Nothing logged this day.</div>'}</div>
    </section>
  </div>`;
}

/* ---------- charts ---------- */
// Validated categorical palette (dark surface): one fixed hue per social stat.
const STAT_COLORS = { knowledge: '#3987e5', guts: '#d95926', proficiency: '#199e70', kindness: '#c98500', charm: '#d55181' };
function niceMax(v) {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = [1, 2, 2.5, 5, 10].find(f => f * p >= v);
  return m * p;
}

function journalCharts() {
  const weeks = 26, cur = parseKey(weekKey(new Date()));
  const wk = Array.from({ length: weeks }, (_, i) => addDays(cur, -7 * (weeks - 1 - i)));
  const wkKey = wk.map(dkey);
  const idx = Object.fromEntries(wkKey.map((k, i) => [k, i]));
  const xpW = new Array(weeks).fill(0);
  const statW = Object.fromEntries(STAT_ORDER.map(k => [k, new Array(weeks).fill(0)]));
  const base = Object.fromEntries(STAT_ORDER.map(k => [k, 0]));
  const since30 = dkey(addDays(new Date(), -29)), skill30 = {};
  for (const e of state.log) {
    const i = idx[weekKey(parseKey(e.date))];
    const st = entryStats(e);
    if (i === undefined) { if (e.date < wkKey[0]) for (const [k, v] of Object.entries(st)) if (k in base) base[k] += v; }
    else { xpW[i] += e.xp || 0; for (const [k, v] of Object.entries(st)) if (k in base) statW[k][i] += v; }
    if (e.date >= since30) for (const [id, v] of Object.entries(entrySkills(e))) skill30[id] = (skill30[id] || 0) + v;
  }
  // running stat totals at the end of each week
  const cum = Object.fromEntries(STAT_ORDER.map(k => { let run = base[k]; return [k, statW[k].map(v => (run += v))]; }));

  const W = 820, H = 230, L = 44, R = 14, T = 14, B = 26, iw = W - L - R, ih = H - T - B;
  const x = i => L + (i + 0.5) * iw / weeks;
  const grid = max => [0, 0.5, 1].map(f => {
    const y = T + ih - f * ih;
    return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="ch-grid"/><text x="${L - 8}" y="${y + 4}" class="ch-ax" text-anchor="end">${Math.round(max * f)}</text>`;
  }).join('');
  const xLabels = wk.map((d, i) => i % 4 === 1 ? `<text x="${x(i)}" y="${H - 6}" class="ch-ax" text-anchor="middle">${d.getMonth() + 1}/${d.getDate()}</text>` : '').join('');

  // 1) weekly XP — bars with rounded data-ends on the baseline
  const xMax = niceMax(Math.max(...xpW));
  const bw = iw / weeks - 4;
  const bars = xpW.map((v, i) => {
    const h = Math.max(v / xMax * ih, v ? 4 : 0), y = T + ih - h, x0 = x(i) - bw / 2;
    const tip = esc(`<b>Week of ${fmtMD(wkKey[i])}</b><br>${v} XP`);
    return `<g data-tip="${tip}"><rect x="${x0 - 2}" y="${T}" width="${bw + 4}" height="${ih}" class="ch-hit"/>
      ${v ? `<path d="M${x0},${T + ih} V${y + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${T + ih} Z" class="ch-bar ${i === weeks - 1 ? 'cur' : ''}"/>` : ''}</g>`;
  }).join('');

  // 2) social stat totals — lines (legend + hover column)
  const sMax = niceMax(Math.max(1, ...STAT_ORDER.map(k => cum[k][weeks - 1])));
  const yS = v => T + ih - v / sMax * ih;
  const lines = STAT_ORDER.map(k => `<polyline points="${cum[k].map((v, i) => `${x(i).toFixed(1)},${yS(v).toFixed(1)}`).join(' ')}" class="ch-line" stroke="${STAT_COLORS[k]}"/>`).join('');
  const ends = STAT_ORDER.map(k => `<circle cx="${x(weeks - 1)}" cy="${yS(cum[k][weeks - 1])}" r="4.5" fill="${STAT_COLORS[k]}" class="ch-dot"/>`).join('');
  const cols = wk.map((_, i) => {
    const tip = esc(`<b>Week of ${fmtMD(wkKey[i])}</b><br>` + STAT_ORDER.map(k => `<i class="sw" style="background:${STAT_COLORS[k]}"></i>${STATS[k].name}: ${cum[k][i]}`).join('<br>'));
    return `<rect x="${x(i) - iw / weeks / 2}" y="${T}" width="${iw / weeks}" height="${ih}" class="ch-col" data-tip="${tip}"/>`;
  }).join('');
  const legend = STAT_ORDER.map(k => `<span><i class="sw" style="background:${STAT_COLORS[k]}"></i>${STATS[k].name} <b>${cum[k][weeks - 1]}</b></span>`).join('');

  // 3) skills — last 30 days, horizontal bars
  const rows = state.skills.map(s => [s, skill30[s.id] || 0]).sort((a, b) => b[1] - a[1]);
  const kMax = Math.max(1, ...rows.map(r => r[1]));
  const skillBars = rows.map(([s, v]) => `<div class="hb" data-tip="${esc(`<b>${esc(s.name)}</b><br>${v} XP in 30 days`)}">
    <span class="hb-name">${skillIcon(s)}${esc(s.name)}</span>
    <div class="hb-track"><i style="width:${v / kMax * 100}%"></i></div>
    <b>${v}</b></div>`).join('');

  return `<div class="charts">
    <section class="panel chart"><div class="tag">XP PER WEEK</div>
      <svg viewBox="0 0 ${W} ${H}" class="ch">${grid(xMax)}${bars}${xLabels}</svg></section>
    <section class="panel chart"><div class="tag">SOCIAL STATS · TOTAL POINTS</div>
      <div class="ch-legend">${legend}</div>
      <svg viewBox="0 0 ${W} ${H}" class="ch">${grid(sMax)}${lines}${cols}${ends}${xLabels}</svg></section>
    <section class="panel chart"><div class="tag">SKILLS · LAST 30 DAYS</div>
      ${rows.length ? skillBars : '<div class="muted">No skills yet.</div>'}</section>
  </div>`;
}

function scrSystem() {
  return `${head('system')}
  <div class="sys-grid">
    <section class="panel">
      <div class="tag">PLAYER</div>
      <label class="fld"><span>Codename</span><input id="sys-name" maxlength="30" value="${esc(state.player.name)}"></label>
      <label class="toggle"><input type="checkbox" data-setting="sound" ${state.settings.sound ? 'checked' : ''}><span></span>Sound effects</label>
      <label class="toggle"><input type="checkbox" data-setting="hotkey" ${state.settings.hotkey !== false ? 'checked' : ''}><span></span><b class="tg-txt">Global shortcut <kbd>${KEY.hotkey}</kbd> opens Take Action from any app</b></label>
      <label class="toggle"><input type="checkbox" data-setting="openAtLogin" ${state.settings.openAtLogin ? 'checked' : ''}><span></span>Start at login (quietly, ${OS.bg})</label>
    </section>
    <section class="panel morgana">
      <div class="tag">MORGANA · REMINDERS</div>
      <label class="toggle"><input type="checkbox" data-setting="remindDailies" ${state.settings.remindDailies !== false ? 'checked' : ''}><span></span>Unfinished dailies at
        <input type="time" class="time-in" data-setting="dailiesAt" value="${esc(state.settings.dailiesAt || '21:00')}"></label>
      <label class="toggle"><input type="checkbox" data-setting="remindBed" ${state.settings.remindBed !== false ? 'checked' : ''}><span></span>“Let's go to sleep” at
        <input type="time" class="time-in" data-setting="bedAt" value="${esc(state.settings.bedAt || '23:30')}"></label>
      <label class="toggle"><input type="checkbox" data-setting="remindVelvet" ${state.settings.remindVelvet !== false ? 'checked' : ''}><span></span>Velvet Room on Sundays at 19:00</label>
      <p class="muted">Works while Phantom Life is running — closing the window is fine, ${OS.quit}. Turn on “Start at login” to never miss one.</p>
      <div class="btn-row"><button class="btn" data-act="test-notify">Test Morgana</button></div>
    </section>
    <section class="panel">
      <div class="tag">SAVE DATA</div>
      <p class="muted">Autosaves locally after every action. A daily backup is kept for 14 days.</p>
      <p class="mono" id="sys-path">…</p>
      <div class="btn-row">
        <button class="btn" data-act="export">Export save</button>
        <button class="btn" data-act="import">Import save</button>
        <button class="btn ghost" data-act="reveal">Show in ${OS.fileMgr}</button>
      </div>
    </section>
    <section class="panel">
      <div class="tag">HOW IT WORKS</div>
      <ul class="rules">
        <li><b>Effort</b> — Light +10 · Normal +25 · Heavy +50 · Epic +100 XP.</li>
        <li><b>Skills</b> level up from XP, and every action also feeds the skill’s <b>social stat</b> (XP ÷ 5).</li>
        <li><b>Social stats</b> rank up at ${STAT_T.slice(1).join(' / ')} points — just like the game, rank 5 takes real dedication.</li>
        <li><b>Confidants</b> have 10 ranks. Deeper hangouts build the bond faster.</li>
        <li><b>Velvet Room</b> — review your week, seal a contract (+50 XP) and pick up to 3 focus skills that earn ×1.5 XP the following week.</li>
        <li><b>Compendium</b> — personas awaken at milestones. <b>Mementos</b> — Morgana's daily request doubles XP on one skill.</li>
        <li><b>Shop</b> — every XP also pays ¥${YEN_PER_XP}. Spend it on rewards you define.</li>
        <li>Made a mistake? Delete it in the <b>Journal</b> — everything recalculates.</li>
        <li>Keys: <kbd>1</kbd>–<kbd>8</kbd> switch screens · <kbd>${KEY.system}</kbd> System · <kbd>${KEY.hotkey}</kbd> take action from anywhere · <kbd>L</kbd> take action · <kbd>Esc</kbd> close.</li>
      </ul>
    </section>
    <section class="panel danger-zone">
      <div class="tag">DANGER</div>
      <p class="muted">Wipe everything and start a new game. Export first if you might want it back.</p>
      <button class="btn danger" data-act="reset">New game</button>
    </section>
  </div>`;
}

/* ---------- velvet room ---------- */
const FOCUS_MULT = 1.5;
const GRADES = ['S', 'A', 'B', 'C', 'D'];
let velvetWeek = null;
const velvetDraft = {}; // unsaved contract text per week, survives re-renders
const prevWeek = wk => dkey(addDays(parseKey(wk), -7));
const nextWeek = wk => dkey(addDays(parseKey(wk), 7));
// Focus picked in last week's contract applies to this week.
const focusSkills = (d = new Date()) => state.reviews[prevWeek(weekKey(d))]?.focus || [];
const isFocus = id => !!id && focusSkills().includes(id);

function pendingReviewWeek() {
  const now = new Date(), dw = now.getDay();
  const cur = weekKey(now), prev = prevWeek(cur);
  if ((dw === 0 || dw >= 5) && !state.reviews[cur]) return cur;
  if ((dw === 1 || dw === 2) && !state.reviews[prev] && state.log.some(e => weekKey(parseKey(e.date)) === prev)) return prev;
  return null;
}

function weekStats(wk) {
  const start = parseKey(wk);
  const days = new Set(Array.from({ length: 7 }, (_, i) => dkey(addDays(start, i))));
  const acts = state.log.filter(e => days.has(e.date) && e.kind !== 'review');
  const stats = Object.fromEntries(STAT_ORDER.map(k => [k, 0]));
  const skills = {};
  for (const e of acts) {
    for (const [k, v] of Object.entries(entryStats(e))) if (k in stats) stats[k] += v;
    for (const [id, v] of Object.entries(entrySkills(e))) skills[id] = (skills[id] || 0) + v;
  }
  const elapsed = Math.max(1, Math.min(7, Math.round((startOfDay() - start) / 86400000) + 1));
  const dailyQs = state.quests.filter(q => q.type === 'daily');
  const dailyIds = new Set(dailyQs.map(q => q.id));
  const dailyDone = acts.filter(e => dailyIds.has(e.questId)).length;
  let dailyPossible = 0;
  for (let i = 0; i < elapsed; i++) dailyPossible += dailyQs.filter(q => isScheduled(q, addDays(start, i))).length;
  return {
    start, end: addDays(start, 6), elapsed, stats, skills,
    xp: acts.reduce((a, e) => a + e.xp, 0),
    get pace() { return this.xp / this.elapsed; }, // XP per day, fair for an unfinished week
    actions: acts.length,
    activeDays: new Set(acts.map(e => e.date)).size,
    dailyRate: dailyPossible ? Math.min(1, dailyDone / dailyPossible) : null,
  };
}

// Days between the last matching entry (on/before endKey) and endKey; null if never.
function daysSince(pred, endKey) {
  let last = null;
  for (const e of state.log) if (e.date <= endKey && pred(e) && (!last || e.date > last)) last = e.date;
  return last ? Math.round((parseKey(endKey) - parseKey(last)) / 86400000) : null;
}

function igorLines(wk, W, P, rev) {
  const b = s => `<b>${esc(s)}</b>`;
  const today = dkey();
  const endKey = dkey(W.end) < today ? dkey(W.end) : today;
  const isCur = wk === weekKey(new Date());
  const L = [isCur
    ? 'Welcome to the Velvet Room. Let us look upon the week that is still unfolding...'
    : `Welcome to the Velvet Room. Let us look back upon the week of ${b(fmtMD(wk))}.`];

  if (!W.actions) {
    L.push('Hm... not a single action recorded. Even a prisoner paces his cell, Trickster.');
  } else {
    if (P.xp > 0) {
      const d = Math.round((W.pace - P.pace) / P.pace * 100);
      const per = isCur ? ' per day' : '';
      if (d >= 15) L.push(`You earned ${b(W.xp + ' XP')}, ${b(d + '%')} more${per} than the week before. Your rehabilitation proceeds splendidly.`);
      else if (d <= -15) L.push(`${b(W.xp + ' XP')} so far, ${b(-d + '%')} less${per} than before. A lull... or the first sign of distortion?`);
      else L.push(`${b(W.xp + ' XP')}, keeping pace with the week before. Consistency is its own kind of power.`);
    } else {
      L.push(`You earned ${b(W.xp + ' XP')} across ${b(W.actions + ' actions')}. A fine beginning.`);
    }
    L.push(`You acted on ${b(W.activeDays + ' of ' + W.elapsed)} days.${W.activeDays === W.elapsed && W.elapsed >= 5 ? ' Not a single day wasted. Remarkable.' : ''}`);
    const [topStat, topVal] = Object.entries(W.stats).sort((a, b2) => b2[1] - a[1])[0];
    if (topVal > 0) L.push(`Your ${b(STATS[topStat].name)} grew the most (+${topVal}).`);
    const topSkill = Object.entries(W.skills).sort((a, b2) => b2[1] - a[1])[0];
    if (topSkill && skillById(topSkill[0])) L.push(`${b(skillById(topSkill[0]).name)} was your sharpest weapon.`);
  }

  if (W.dailyRate !== null && W.actions) {
    const pct = Math.round(W.dailyRate * 100);
    if (pct >= 80) L.push(`Your daily rituals held firm: ${b(pct + '%')} kept.`);
    else if (pct < 40) L.push(`Your daily vows slipped. Only ${b(pct + '%')} kept. Perhaps they ask too much... or you, too little.`);
  }

  const focus = state.reviews[prevWeek(wk)]?.focus || [];
  for (const id of focus) {
    const s = skillById(id);
    if (!s) continue;
    const xp = W.skills[id] || 0;
    L.push(xp ? `You swore to focus on ${b(s.name)}, and it received ${b(xp + ' XP')}. A promise kept.` : `You swore to focus on ${b(s.name)}... and did not. Hm hm hm.`);
  }

  const old = s => Math.round((parseKey(endKey) - new Date(s.createdAt || 0)) / 86400000) >= 14;
  const dusty = state.skills
    .filter(s => !focus.includes(s.id) && old(s))
    .map(s => [s, daysSince(e => s.id in entrySkills(e), endKey)])
    .filter(([, d]) => d === null || d >= 14)
    .slice(0, 2);
  for (const [s, d] of dusty) L.push(`${b(s.name)} gathers dust${d === null ? ', never once practiced' : `, ${d} days untouched`}.`);

  const distant = state.confidants
    .filter(old)
    .map(c => [c, daysSince(e => entryConfs(e).includes(c.id), endKey)])
    .filter(([, d]) => d === null || d >= 14)
    .slice(0, 2);
  for (const [c, d] of distant) L.push(`You have not seen ${b(c.name)} ${d === null ? 'since you met' : `in ${d} days`}. A bond untended does not grow.`);

  if (isCur || wk === prevWeek(weekKey(new Date()))) {
    const due = state.quests.filter(q => q.type === 'once' && q.deadline && !questCompletion(q))
      .map(q => [q, daysUntil(q.deadline)]).filter(([, n]) => n >= 0 && n <= 10).sort((a, b2) => a[1] - b2[1])[0];
    if (due) L.push(`A deadline approaches: ${b(due[0].title)}, ${due[1] === 0 ? 'today' : `in ${due[1]} day${due[1] === 1 ? '' : 's'}`}.`);
    // the open mission whose next stage is due soonest (or already late)
    const step = state.quests.filter(q => !questCompletion(q) && nextStage(q)?.deadline)
      .map(q => [q, nextStage(q), daysUntil(nextStage(q).deadline)]).filter(([, , n]) => n <= 7).sort((a, b2) => a[2] - b2[2])[0];
    if (step) {
      const [q, s, n] = step;
      L.push(n < 0 ? `${b(s.title)} — a step toward ${b(q.title)} — is ${-n} day${n === -1 ? '' : 's'} late. The path does not walk itself.`
        : `Your next step toward ${b(q.title)}: ${b(s.title)}, ${n === 0 ? 'due today' : `due in ${n} day${n === 1 ? '' : 's'}`}.`);
    }
    const behind = state.quests.find(q => missionPace(q) === 'behind');
    if (behind && !step) L.push(`${b(behind.title)} has fallen behind its pace. Perhaps the next step is smaller than you fear.`);
  }

  const ci = conditionInsight();
  if (ci) L.push(ci);

  L.push(rev
    ? 'Your contract for this week is sealed. Return when the next week ends.'
    : 'Now then... reflect, and choose where your strength will flow next week.');
  return L;
}

function readContract(f) {
  const fd = new FormData(f);
  return {
    grade: fd.get('grade') || '',
    well: String(fd.get('well') || ''), held: String(fd.get('held') || ''), next: String(fd.get('next') || ''),
    focus: fd.getAll('focus').map(String),
  };
}

function sealContract(f) {
  const wk = f.dataset.week;
  const data = readContract(f);
  data.focus = data.focus.slice(0, 3);
  for (const k of ['well', 'held', 'next']) data[k] = data[k].trim();
  const existing = state.reviews[wk];
  const now = new Date().toISOString();
  state.reviews[wk] = { ...existing, ...data, completedAt: existing?.completedAt || now, updatedAt: now };
  delete velvetDraft[wk];
  if (state.log.some(e => e.kind === 'review' && e.week === wk)) {
    persist(); sfx.ok(); render(); toast('AMENDED', 'The contract has been rewritten');
    return;
  }
  commit({ kind: 'review', week: wk, xp: 50, statPts: 0, note: `Weekly contract · week of ${fmtMD(wk)}` });
  const names = data.focus.map(id => skillById(id)?.name).filter(Boolean);
  queueRankUp({ kicker: 'Velvet Room', big: 'SEALED!', sub: names.length ? `Focus: ${names.join(' · ')}` : '+50 XP', velvet: true });
}

function scrVelvet() {
  const cur = weekKey(new Date());
  const wk = velvetWeek || cur;
  const W = weekStats(wk), P = weekStats(prevWeek(wk));
  const rev = state.reviews[wk];
  const draft = velvetDraft[wk] || {};
  const val = k => draft[k] ?? rev?.[k] ?? '';
  const focusSel = draft.focus || rev?.focus || [];
  const grade = val('grade');
  const statMax = Math.max(1, ...Object.values(W.stats));
  const topSkills = Object.entries(W.skills).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const delta = P.xp ? Math.round((W.pace - P.pace) / P.pace * 100) : null;
  const past = Object.keys(state.reviews).sort().reverse();
  const q = (name, label, ph) => `<label class="fld"><span>${label}</span><textarea name="${name}" rows="4" maxlength="1200" placeholder="${ph}">${esc(val(name))}</textarea></label>`;

  return `<div class="velvet">
    ${head('velvet', 'Welcome to the Velvet Room.')}
    <div class="vr-weeknav">
      <button class="vr-arrow" data-act="vr-week" data-dir="-1" title="Previous week">◀</button>
      <div class="vr-week"><span>WEEK OF</span><b>${fmtMD(wk)} – ${fmtMD(dkey(W.end))}</b></div>
      <button class="vr-arrow" data-act="vr-week" data-dir="1" title="Next week" ${wk >= cur ? 'disabled' : ''}>▶</button>
      <span class="vr-status ${rev ? 'done' : ''}">${rev ? `Appraised · Grade ${esc(rev.grade || '—')}` : 'Awaiting appraisal'}</span>
    </div>

    <div class="vr-grid">
      <section class="vr-stage">
        <div class="vr-curtain l"></div><div class="vr-curtain r"></div>
        <div class="vr-igor"><img src="assets/igor.jpg" alt="Igor" draggable="false"></div>
        <div class="vr-dialog"><div class="vr-name">IGOR</div>
          ${igorLines(wk, W, P, rev).map((l, i) => `<p style="--d:${(i * 0.35).toFixed(2)}s">${l}</p>`).join('')}
        </div>
      </section>
      <section class="vr-ledger">
        <div class="vr-tag">LEDGER</div>
        <div class="vr-nums">
          <div><b>${W.xp}</b><span>XP${delta === null ? '' : `<em title="XP per day vs previous week" class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}%</em>`}</span></div>
          <div><b>${W.actions}</b><span>actions</span></div>
          <div><b>${W.activeDays}/${W.elapsed}</b><span>active days</span></div>
          <div><b>${W.dailyRate === null ? '—' : Math.round(W.dailyRate * 100) + '%'}</b><span>dailies kept</span></div>
        </div>
        <div><div class="vr-sub">STAT GROWTH</div>
        ${STAT_ORDER.map(k => `<div class="vr-statbar"><span>${STATS[k].name}</span><div><i style="width:${W.stats[k] / statMax * 100}%"></i></div><b>+${W.stats[k]}</b></div>`).join('')}
        </div>
        <div><div class="vr-sub">STRONGEST ARTS</div>
        ${topSkills.length ? topSkills.map(([id, xp]) => { const s = skillById(id); return `<div class="vr-skill"><span>${skillIcon(s)}${esc(s?.name || 'Deleted skill')}</span><b>${xp} XP</b></div>`; }).join('') : '<div class="vr-muted">Nothing yet.</div>'}
        </div>
      </section>
    </div>

    <form class="vr-contract" id="vr-form" data-week="${wk}">
      <div class="vr-seal">${rev ? '✓' : '§'}</div>
      <div class="vr-tag">THE CONTRACT</div>
      <h2>Reflect, then bind yourself to the week ahead.</h2>
      <div class="fld"><span>Grade this week</span><div class="vr-grades">${GRADES.map(g => `<label><input type="radio" name="grade" value="${g}" ${grade === g ? 'checked' : ''}><span>${g}</span></label>`).join('')}</div></div>
      <div class="vr-qs">
        ${q('well', 'What went well?', 'Shipped the feature. Slept 8h.')}
        ${q('held', 'What held you back?', 'Doomscrolling after midnight.')}
        ${q('next', 'Next week, I will…', 'Train 4 times. Finish chapter 3.')}
      </div>
      <div class="fld"><span>Focus arts for next week <i>— up to 3 · they earn ×${FOCUS_MULT} XP</i></span>
        <div class="vr-focus">${state.skills.map(s => `<label><input type="checkbox" name="focus" value="${s.id}" ${focusSel.includes(s.id) ? 'checked' : ''}><span>${skillIcon(s)}${esc(s.name)}</span></label>`).join('')}</div>
      </div>
      <div class="vr-actions">
        <span class="vr-muted">${rev ? `Sealed ${fmtMD(dkey(new Date(rev.completedAt)))}. You may amend it.` : 'Sealing the contract grants +50 XP.'}</span>
        <button class="btn vr-btn">${rev ? 'Amend contract' : 'Seal the contract'}</button>
      </div>
    </form>

    ${past.length ? `<section class="vr-archive"><div class="vr-tag">PAST CONTRACTS</div>
      ${past.map(k => { const r = state.reviews[k]; return `<button class="vr-past ${k === wk ? 'on' : ''}" data-act="vr-goto" data-week="${k}">
        <b class="g g-${esc(r.grade || 'none')}">${esc(r.grade || '—')}</b>
        <span>${fmtMD(k)} – ${fmtMD(dkey(addDays(parseKey(k), 6)))}</span>
        <em>${esc((r.next || r.well || 'No notes.').slice(0, 110))}</em></button>`; }).join('')}
    </section>` : ''}
  </div>`;
}

document.addEventListener('input', e => {
  const f = e.target.closest && e.target.closest('#vr-form');
  if (!f) return;
  if (e.target.name === 'focus' && e.target.checked && f.querySelectorAll('input[name=focus]:checked').length > 3) {
    e.target.checked = false;
    toast('MAX 3', 'Choose at most three focus arts');
  }
  velvetDraft[f.dataset.week] = readContract(f);
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'vr-form') return;
  e.preventDefault();
  sealContract(e.target);
});

/* ---------- shop ---------- */
function rewardModal(id) {
  const r = id ? state.rewards.find(x => x.id === id) : { name: '', price: 500, icon: 'star', once: false };
  openModal(`
    <h2 class="m-title">${ransom(id ? 'EDIT REWARD' : 'NEW REWARD', 21)}</h2>
    <form>
      <label class="fld"><span>Reward</span><input name="name" required maxlength="60" value="${esc(r.name)}" placeholder="Movie night, new headphones…"></label>
      <label class="fld"><span>Price <i>(¥${YEN_PER_XP} per XP · a normal action ≈ ¥${25 * YEN_PER_XP})</i></span><input name="price" type="number" min="1" step="50" required value="${esc(r.price)}"></label>
      <div class="fld"><span>Icon</span><div class="icon-grid">${ICON_KEYS.map(k => `<label title="${k}"><input type="radio" name="icon" value="${k}" ${r.icon === k ? 'checked' : ''}><span>${iconSvg(k)}</span></label>`).join('')}</div></div>
      <label class="toggle"><input type="checkbox" name="once" ${r.once ? 'checked' : ''}><span></span>One-time purchase (a big thing you buy once)</label>
      <div class="m-actions">
        <button type="button" class="btn ghost" data-act="close-modal">Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>`, root => {
    root.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = { name: String(fd.get('name')).trim(), price: Math.max(1, Math.round(Number(fd.get('price')) || 1)), icon: ICONS[fd.get('icon')] ? fd.get('icon') : 'star', once: fd.get('once') === 'on' };
      if (id) Object.assign(r, data);
      else state.rewards.push({ id: uid(), createdAt: new Date().toISOString(), ...data });
      persist(); closeModal(); sfx.ok(); render();
    };
  });
}

// In-app speech bubble for reminders that fire while the window is focused.
function morganaSays({ title, body, screen: target }) {
  beep([660, 880, 660], 'triangle', 0.08, 0.04);
  const el = document.createElement('div');
  el.className = 'morgana-pop';
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(body)}</span>`;
  el.onclick = () => { el.remove(); if (target) go(target); };
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 7000);
  setTimeout(() => el.remove(), 7600);
}

const sfxCoin = () => beep([988, 1319, 1976], 'square', 0.05, 0.035);

async function buyReward(id) {
  const r = state.rewards.find(x => x.id === id);
  if (!r) return;
  if (D.yen < r.price) { toast('NOT ENOUGH ¥', `${fmtYen(r.price - D.yen)} more to go`); return; }
  if (!await askConfirm('BUY THIS?', `${r.name} for ${fmtYen(r.price)}. You earned it, Joker.`, `Buy · ${fmtYen(r.price)}`)) return;
  state.purchases.push({ id: uid(), rewardId: r.id, name: r.name, price: r.price, icon: r.icon, ts: new Date().toISOString(), date: dkey() });
  persist(); sfxCoin(); checkCompendium(); render();
  toast(`-${fmtYen(r.price)}`, `${r.name} · Thank you, come again!`);
}

function scrShop() {
  const todayYen = (D.byDate[dkey()] || 0) * YEN_PER_XP;
  const count = id => state.purchases.filter(p => p.rewardId === id).length;
  const cards = state.rewards.map(r => {
    const owned = r.once && count(r.id) > 0;
    const short = r.price - D.yen;
    return `<div class="reward ${owned ? 'owned' : ''} ${short > 0 && !owned ? 'locked' : ''}">
      <div class="sk-tools">
        <button class="ic" title="Edit" data-act="edit-reward" data-id="${r.id}">✎</button>
        <button class="ic" title="Delete" data-act="del-reward" data-id="${r.id}">✕</button>
      </div>
      <div class="rw-icon">${iconSvg(r.icon) || iconSvg('star')}</div>
      <div class="rw-name">${esc(r.name)}</div>
      <div class="rw-price">${fmtYen(r.price)}</div>
      <div class="rw-meta">${r.once ? 'one-time' : count(r.id) ? `bought ×${count(r.id)}` : '&nbsp;'}</div>
      ${owned ? '<div class="rw-stamp">OWNED</div>'
        : `<button class="btn ${short > 0 ? 'ghost' : 'primary'} small" data-act="buy" data-id="${r.id}">${short > 0 ? `${fmtYen(short)} to go` : 'Buy'}</button>`}
    </div>`;
  }).join('');
  const hist = [...state.purchases].reverse().slice(0, 30);
  return `${head('shop')}
  <div class="wallet">
    <div class="w-main"><span>WALLET</span><b class="${D.yen < 0 ? 'neg' : ''}">${fmtYen(D.yen)}</b></div>
    <div class="w-side"><b>+${fmtYen(todayYen)}</b><span>earned today</span></div>
    <div class="w-side"><b>${fmtYen(D.spent)}</b><span>spent all-time</span></div>
    <div class="w-side"><b>¥${YEN_PER_XP}</b><span>per XP</span></div>
  </div>
  <div class="shop-grid">${cards}<button class="skill-add" data-act="add-reward"><b>+</b><span>NEW REWARD</span></button></div>
  ${hist.length ? `<section class="q-section"><div class="q-head"><h2>Receipts</h2><span>last ${hist.length}</span></div>
    ${hist.map(p => `<div class="j-item receipt">
      <span class="j-time">${fmtMD(p.date)}</span><span class="j-kind">BOUGHT</span>
      <span class="j-label">${iconSvg(p.icon)}${esc(p.name)}</span><span class="j-xp">-${fmtYen(p.price)}</span>
      <button class="ic" data-act="refund" data-id="${p.id}" title="Refund (undo)">✕</button></div>`).join('')}
  </section>` : ''}`;
}

/* ---------- condition ---------- */
const CONDITIONS = [['great', 'Great'], ['good', 'Good'], ['tired', 'Tired'], ['sick', 'Sick']];
const condLabel = k => (CONDITIONS.find(c => c[0] === k) || [, ''])[1];

function conditionPanel() {
  const cur = state.conditions[dkey()];
  return `<section class="panel cond">
    <div class="tag">CONDITION</div>
    <div class="cond-q">${cur ? `Feeling <b class="c-${cur}">${condLabel(cur)}</b> today.` : 'How do you feel today?'}</div>
    <div class="cond-opts">${CONDITIONS.map(([k, l]) => `<button class="cond-btn c-${k} ${cur === k ? 'on' : ''}" data-act="set-cond" data-id="${k}">${l}</button>`).join('')}</div>
  </section>`;
}

// Igor compares XP on good days vs rough days over the last 60 days.
function conditionInsight() {
  const good = [], bad = [];
  for (let i = 1; i <= 60; i++) {
    const k = dkey(addDays(new Date(), -i)), c = state.conditions[k];
    if (!c) continue;
    (c === 'great' || c === 'good' ? good : bad).push(D.byDate[k] || 0);
  }
  if (good.length < 3 || bad.length < 3) return '';
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const g = avg(good), b = avg(bad);
  if (!g) return '';
  const pct = Math.round((g - b) / g * 100);
  return pct >= 15
    ? `On days you felt tired or sick you earned <b>${pct}% less XP</b>. Rest, too, is part of the heist.`
    : 'Even on your rough days you kept pace. Hm hm... impressive.';
}

/* ---------- mementos requests ---------- */
// Morgana's daily request: one of the three most neglected skills, fixed for the day. First action on it ×2.
function todaysRequest() {
  if (!state.skills.length) return null;
  const today = dkey();
  const last = {};
  for (const e of state.log) for (const id of Object.keys(entrySkills(e))) if (e.date < today && (!last[id] || e.date > last[id])) last[id] = e.date;
  let id = state.requests[today];
  if (!id || !skillById(id)) {
    const pool = [...state.skills].sort((a, b) => (last[a.id] || '').localeCompare(last[b.id] || '')).slice(0, 3);
    const h = [...today].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    id = pool[h % pool.length].id;
    state.requests[today] = id;
    const cutoff = dkey(addDays(new Date(), -60));
    for (const k of Object.keys(state.requests)) if (k < cutoff) delete state.requests[k];
    persist();
  }
  const days = last[id] ? Math.round((parseKey(today) - parseKey(last[id])) / 86400000) : null;
  return { skillId: id, skill: skillById(id), days, done: state.log.some(e => e.req === today) };
}
const isRequest = id => { const r = todaysRequest(); return !!r && !r.done && r.skillId === id; };

function requestPanel() {
  const r = todaysRequest();
  if (!r) return '';
  const name = `<b>${skillIcon(r.skill)}${esc(r.skill.name)}</b>`;
  const text = r.days === null ? `${name} has never been practiced. Today's the day.`
    : r.days <= 2 ? `Keep ${name} going today. Momentum is everything.`
    : `${name} hasn't seen action in <b>${r.days} days</b>. Spend any time on it today.`;
  return `<section class="panel request ${r.done ? 'done' : ''}">
    <div class="tag">MEMENTOS REQUEST</div>
    <div class="rq-from">From Morgana</div>
    <div class="rq-text">${text}</div>
    <div class="rq-foot"><span class="rq-reward">${r.done ? '✓ Cleared · double XP claimed' : 'Reward: ×2 XP on that skill'}</span>
      ${r.done ? '' : `<button class="btn primary small" data-act="log-skill" data-id="${r.skillId}">Take it on</button>`}</div>
  </section>`;
}

/* ---------- compendium ---------- */
function longestStreak() {
  const days = [...new Set(state.log.map(e => e.date))].sort();
  let best = 0, run = 0, prev = null;
  for (const k of days) {
    run = prev && Math.round((parseKey(k) - parseKey(prev)) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

function compendiumCtx() {
  const d = derive();
  return {
    actions: state.log.length,
    ranks: Object.fromEntries(STAT_ORDER.map(k => [k, statRank(k, d.stats[k]).rank])),
    skillLv: state.skills.map(s => skillLevel(d.skillXp[s.id] || 0).lvl),
    confR: state.confidants.map(c => confRank(d.confPts[c.id] || 0).rank),
    streak: longestStreak(),
    missions: state.quests.filter(q => q.type === 'once' && questCompletion(q)).length,
    bigMissions: state.quests.filter(q => stagesOf(q).length >= 5 && questCompletion(q)).length,
    reviews: Object.keys(state.reviews).length,
    maxDay: Math.max(0, ...Object.values(d.byDate)),
    epic: state.log.some(e => e.intensity === 'epic'),
    hangouts: state.log.filter(e => entryConfs(e).length).length,
    group: state.log.some(e => entryConfs(e).length >= 2),
    purchases: state.purchases.length,
    requests: state.log.filter(e => e.req).length,
    player: playerLevel(d.total).lvl,
  };
}

const PERSONAS = [
  ['arsene', 'Arsène', 'Fool', 'Log your first action', c => c.actions >= 1],
  ['zorro', 'Zorro', 'Magician', 'Keep a 7-day streak', c => c.streak >= 7],
  ['pixie', 'Pixie', 'Lovers', 'Spend time with a confidant', c => c.hangouts >= 1],
  ['agathion', 'Agathion', 'Chariot', 'Clear a Mementos request', c => c.requests >= 1],
  ['orpheus', 'Orpheus', 'Fool', 'Seal your first Velvet contract', c => c.reviews >= 1],
  ['mara', 'Mara', 'Tower', 'Buy your first reward', c => c.purchases >= 1],
  ['alice', 'Alice', 'Death', 'Clear a mission', c => c.missions >= 1],
  ['loki', 'Loki', 'Fool', 'Log an Epic action', c => c.epic],
  ['captainkidd', 'Captain Kidd', 'Chariot', 'Reach Guts rank 3', c => c.ranks.guts >= 3],
  ['carmen', 'Carmen', 'Lovers', 'Reach Charm rank 3', c => c.ranks.charm >= 3],
  ['goemon', 'Goemon', 'Emperor', 'Reach Knowledge rank 3', c => c.ranks.knowledge >= 3],
  ['johanna', 'Johanna', 'Priestess', 'Reach Proficiency rank 3', c => c.ranks.proficiency >= 3],
  ['milady', 'Milady', 'Empress', 'Reach Kindness rank 3', c => c.ranks.kindness >= 3],
  ['ishtar', 'Ishtar', 'Lovers', 'Hang out with two confidants at once', c => c.group],
  ['jackfrost', 'Jack Frost', 'Magician', 'Log 50 actions', c => c.actions >= 50],
  ['necronomicon', 'Necronomicon', 'Hermit', 'Get a skill to level 10', c => c.skillLv.some(l => l >= 10)],
  ['hecate', 'Hecate', 'Magician', 'Reach confidant rank 5', c => c.confR.some(r => r >= 5)],
  ['yoshitsune', 'Yoshitsune', 'Tower', 'Earn 300 XP in a single day', c => c.maxDay >= 300],
  ['raoul', 'Raoul', 'Fool', 'Get five skills to level 5', c => c.skillLv.filter(l => l >= 5).length >= 5],
  ['pyrojack', 'Pyro Jack', 'Magician', 'Log 200 actions', c => c.actions >= 200],
  ['robinhood', 'Robin Hood', 'Justice', 'Keep a 30-day streak', c => c.streak >= 30],
  ['blackfrost', 'Black Frost', 'Fool', 'Clear 5 missions', c => c.missions >= 5],
  ['anubis', 'Anubis', 'Judgement', 'Clear a mission with 5+ stages', c => c.bigMissions >= 1],
  ['ardha', 'Ardha', 'Temperance', 'Clear 20 Mementos requests', c => c.requests >= 20],
  ['thanatos', 'Thanatos', 'Death', 'Seal 10 Velvet contracts', c => c.reviews >= 10],
  ['kaguya', 'Kaguya', 'Moon', 'Max out a confidant (rank 10)', c => c.confR.some(r => r >= 10)],
  ['seitentaisei', 'Seiten Taisei', 'Chariot', 'Max out any social stat', c => STAT_ORDER.some(k => c.ranks[k] >= 5)],
  ['lucifer', 'Lucifer', 'Star', 'Reach player level 30', c => c.player >= 30],
  ['satanael', 'Satanael', 'World', 'Max out all five social stats', c => STAT_ORDER.every(k => c.ranks[k] >= 5)],
].map(([id, name, arcana, hint, test]) => ({ id, name, arcana, hint, test }));
const arcanaNum = name => (ARCANA.find(a => a[1] === name) || ['?'])[0];

// Unlocks stick once earned. silent: first launch with existing history — one toast, no fanfare.
function checkCompendium(silent = false) {
  const c = compendiumCtx(), fresh = [];
  for (const p of PERSONAS) if (!state.compendium[p.id] && p.test(c)) { state.compendium[p.id] = dkey(); fresh.push(p); }
  if (!fresh.length) return;
  persist();
  if (silent) toast('COMPENDIUM', `${fresh.length} persona${fresh.length > 1 ? 's' : ''} awakened`);
  else fresh.forEach(p => queueRankUp({ kicker: `${arcanaNum(p.arcana)} · ${p.arcana}`, big: 'NEW PERSONA', sub: `${p.name} — ${p.hint}`, persona: true }));
}

function scrCompendium() {
  const got = PERSONAS.filter(p => state.compendium[p.id]).length;
  const cards = PERSONAS.map(p => {
    const d = state.compendium[p.id];
    return `<div class="pcard ${d ? 'got' : 'locked'}">
      <div class="pc-arc"><span>${esc(arcanaNum(p.arcana))}</span><em>${esc(p.arcana)}</em></div>
      <div class="pc-mask">${iconSvg('mask')}</div>
      <div class="pc-name">${d ? esc(p.name) : '???'}</div>
      <div class="pc-hint">${esc(p.hint)}</div>
      ${d ? `<div class="pc-date">Awakened ${fmtMD(d)}</div>` : ''}
    </div>`;
  }).join('');
  return `${head('compendium', 'I am thou, thou art I.')}
  <div class="pc-progress"><b>${got}<span> / ${PERSONAS.length}</span></b><div>${bar(got / PERSONAS.length)}<em>personas awakened</em></div></div>
  <div class="pc-grid">${cards}</div>`;
}

const SCREEN_FN = { status: scrStatus, skills: scrSkills, quests: scrQuests, confidants: scrConfidants, journal: scrJournal, compendium: scrCompendium, velvet: scrVelvet, shop: scrShop, system: scrSystem };

/* ---------- new game: character creation ----------
   Shown on first launch (no save yet) and from System → New game. Nothing is saved until Start,
   so closing midway — or "Back to my game" — leaves the current save untouched. */
const LIFE_AREAS = [
  // id, skill name, icon, social stat it feeds, suggested quests [title, type, effort]
  ['study', 'Study', 'cap', 'knowledge', [['Study for 45 minutes', 'daily', 'normal'], ["Review the week's notes", 'weekly', 'light']]],
  ['reading', 'Reading', 'book', 'knowledge', [['Read 20 pages', 'daily', 'light']]],
  ['languages', 'Languages', 'globe', 'knowledge', [['15 minutes of practice', 'daily', 'light'], ['Talk with a native speaker', 'weekly', 'heavy']]],
  ['coding', 'Coding', 'code', 'proficiency', [['Push a commit', 'daily', 'normal'], ['Ship something small', 'weekly', 'heavy']]],
  ['career', 'Career', 'briefcase', 'proficiency', [['Finish the most important task', 'daily', 'normal'], ['Plan next week', 'weekly', 'light']]],
  ['finance', 'Finance', 'chart', 'proficiency', [["Log today's spending", 'daily', 'light'], ['Review the budget', 'weekly', 'normal']]],
  ['cooking', 'Cooking', 'utensils', 'proficiency', [['Cook a real meal', 'daily', 'normal'], ['Try a new recipe', 'weekly', 'normal']]],
  ['fitness', 'Fitness', 'dumbbell', 'guts', [['Work out', 'daily', 'normal']]],
  ['running', 'Running', 'flame', 'guts', [['Go for a run', 'daily', 'normal'], ['Long run', 'weekly', 'heavy']]],
  ['health', 'Health & Sleep', 'moon', 'guts', [['Lights out on time', 'daily', 'light'], ['Drink 2 liters of water', 'daily', 'light']]],
  ['music', 'Music', 'music', 'charm', [['Practice for 30 minutes', 'daily', 'normal']]],
  ['art', 'Art & Design', 'brush', 'charm', [['Sketch something', 'daily', 'light'], ['Finish a piece', 'weekly', 'heavy']]],
  ['writing', 'Writing', 'pen', 'charm', [['Write 300 words', 'daily', 'normal']]],
  ['style', 'Style', 'mask', 'charm', [['Plan outfits for the week', 'weekly', 'light']]],
  ['social', 'Social Life', 'chat', 'charm', [['Meet up with a friend', 'weekly', 'normal']]],
  ['helping', 'Helping Others', 'heart', 'kindness', [['Help someone out', 'weekly', 'normal']]],
  ['family', 'Family', 'users', 'kindness', [['Call family', 'weekly', 'normal']]],
  ['mind', 'Mindfulness', 'leaf', 'kindness', [['Meditate for 10 minutes', 'daily', 'light'], ['Journal before bed', 'daily', 'light']]],
].map(([id, name, icon, stat, quests]) => ({ id, name, icon, stat, quests }));
const areaById = id => LIFE_AREAS.find(a => a.id === id);
const NG_STEPS = ['Who are you', 'What you train', 'First quests', 'Ready'];
const NG_QUEST_PICKS = 5; // suggested quests checked by default — start small

let ng = null; // the character being created; null outside character creation

function openNewGame(fromSystem = false) {
  ng = {
    step: 0, reached: 1, fromSystem, error: '',
    name: '', picked: [], names: {}, custom: [], qOn: {}, qTitle: {},
    dailiesAt: state.settings.dailiesAt || '21:00', bedAt: state.settings.bedAt || '23:30',
  };
  closeModal(); closeRankUp();
  document.body.classList.add('ng-open');
  renderNewGame(true);
}
function closeNewGame() {
  ng = null;
  $('#newgame-root').innerHTML = '';
  document.body.classList.remove('ng-open');
}

// Skills as they'll be created: picked life areas (renamable) plus the player's own, in pick order.
function ngSkills() {
  return ng.picked.map(key => {
    const base = areaById(key) || ng.custom.find(c => c.key === key);
    const name = String(ng.names[key] ?? base.name).trim() || base.name;
    return { key, name, icon: base.icon, stat: base.stat };
  });
}
// Suggested quests for the picked areas. Newly seen ones start checked if they're their area's
// first suggestion, until NG_QUEST_PICKS are checked.
function ngQuests() {
  const list = ng.picked.flatMap(key => (areaById(key)?.quests || []).map(([title, type, effort], i) =>
    ({ key: `${key}-${i}`, skill: key, title: ng.qTitle[`${key}-${i}`] ?? title, type, effort, first: i === 0 })));
  let on = list.filter(q => ng.qOn[q.key]).length;
  for (const q of list) if (!(q.key in ng.qOn)) ng.qOn[q.key] = q.first && on++ < NG_QUEST_PICKS;
  return list;
}
const ngChosenQuests = () => ngQuests().filter(q => ng.qOn[q.key] && q.title.trim());

const ngHead = (title, lead, seed) =>
  `<h1 id="ng-h" tabindex="-1" aria-label="${esc(title)}">${ransom(title, seed)}</h1><p class="ng-lead">${lead}</p>`;

function ngTitleScreen() {
  return `<div class="ng ng-title" role="dialog" aria-modal="true" aria-label="Phantom Life">
    <div class="ng-drag"></div>
    <div class="ng-title-in">
      <h1 class="ng-logo" tabindex="-1" aria-label="Phantom Life">${ransom('PHANTOM', 7)}<br>${ransom('LIFE', 12)}</h1>
      <p class="ng-tagline">Your life is the game. Take your time.</p>
      <nav class="ng-menu" aria-label="Start">
        <button class="ng-mi" data-act="ng-new" data-autofocus>New game</button>
        <button class="ng-mi" data-act="ng-load">Load a save file</button>
        ${ng.fromSystem ? '<button class="ng-mi" data-act="ng-cancel">Back to my game</button>' : ''}
      </nav>
    </div>
  </div>`;
}

function ngStepWho() {
  return `${ngHead('WHO ARE YOU?', 'Pick a codename — it’s what the game calls you. You can change it later in System.', 17)}
    <label class="fld ng-name-in"><span>Codename</span>
      <input id="ng-name" maxlength="30" autocomplete="off" spellcheck="false" placeholder="Joker" value="${esc(ng.name)}" data-autofocus></label>
    <div class="ng-name-preview" id="ng-name-preview" aria-hidden="true">${ransom(ng.name.trim() || 'Joker', 13)}</div>`;
}

function ngStepTrain() {
  const tiles = LIFE_AREAS.map(a => `<label class="ng-tile">
      <input type="checkbox" id="area-${a.id}" name="area" value="${a.id}" ${ng.picked.includes(a.id) ? 'checked' : ''}>
      <span>${iconSvg(a.icon)}<b>${esc(a.name)}</b><small>${STATS[a.stat].name}</small></span></label>`).join('');
  const mine = ngSkills();
  return `${ngHead('WHAT WILL YOU TRAIN?', 'Pick the parts of your life you want to grow. Each one becomes a skill that levels up as you log time on it — 3 to 6 is a good start.', 23)}
    <fieldset class="ng-fs"><legend class="sr-only">Life areas</legend><div class="ng-tiles">${tiles}</div></fieldset>
    <fieldset class="ng-fs">
      <legend>Your skills${mine.length ? ` · ${mine.length}` : ''}</legend>
      ${mine.length ? `<ul class="ng-skills">${mine.map(s => `<li>
          <span class="ng-sk-ico">${skillBadge(s)}</span>
          <input id="nm-${s.key}" data-ng-name="${s.key}" maxlength="40" value="${esc(s.name)}" aria-label="Name of skill ${esc(s.name)}">
          <small>feeds ${STATS[s.stat].name}</small>
          <button type="button" class="ic" data-act="ng-drop" data-key="${s.key}" aria-label="Remove ${esc(s.name)}">✕</button>
        </li>`).join('')}</ul>` : '<p class="ng-hint">Nothing picked yet — choose above, or add your own.</p>'}
      <div class="ng-own">
        <input id="ng-own-name" maxlength="40" placeholder="Something else? Guitar, Chess, Rust…" aria-label="Your own skill">
        <select id="ng-own-stat" aria-label="Social stat it feeds">${STAT_ORDER.map(k => `<option value="${k}">${STATS[k].name}</option>`).join('')}</select>
        <button type="button" class="btn small" data-act="ng-add-own">Add</button>
      </div>
    </fieldset>`;
}

function ngStepQuests() {
  const qs = ngQuests();
  const groups = ngSkills().map(s => {
    const mine = qs.filter(q => q.skill === s.key);
    if (!mine.length) return '';
    return `<fieldset class="ng-fs ng-qgroup"><legend>${skillBadge(s)}${esc(s.name)}</legend>${mine.map(q => `
      <div class="ng-q ${ng.qOn[q.key] ? 'on' : ''}">
        <label class="ng-check"><input type="checkbox" id="q-${q.key}" name="q" value="${q.key}" ${ng.qOn[q.key] ? 'checked' : ''}><span></span><span class="sr-only">Take quest: ${esc(q.title)}</span></label>
        <input class="ng-qt" id="qt-${q.key}" data-ng-qt="${q.key}" maxlength="80" value="${esc(q.title)}" aria-label="Quest title">
        <small class="ng-qtype">${q.type === 'daily' ? 'Daily' : 'Weekly'}</small>
      </div>`).join('')}</fieldset>`;
  }).join('');
  const ownOnly = ng.picked.some(k => !areaById(k));
  return `${ngHead('FIRST QUESTS', 'Habits that pay XP each time you tick them off. Start small — you can add more on the Quests screen any time.', 29)}
    ${groups || '<p class="ng-hint">No suggestions for your own skills — add quests for them on the Quests screen.</p>'}
    ${groups && ownOnly ? '<p class="ng-hint">Your own skills get their quests on the Quests screen.</p>' : ''}`;
}

function ngStepReady() {
  const sk = ngSkills().length, qs = ngChosenQuests().length;
  return `${ngHead('READY?', 'Morgana nudges you when dailies are still open and when it’s time for bed. Change these any time in System.', 31)}
    <div class="ng-ready">
      <label class="fld"><span>Dailies reminder</span><input type="time" id="ng-dailies" value="${esc(ng.dailiesAt)}"></label>
      <label class="fld"><span>Bedtime</span><input type="time" id="ng-bed" value="${esc(ng.bedAt)}"></label>
    </div>
    <p class="ng-sum">You start with <b>${sk} skill${sk === 1 ? '' : 's'}</b> and <b>${qs} quest${qs === 1 ? '' : 's'}</b>.</p>
    <p class="ng-first">First move: log something you did today.</p>`;
}

// The live character card in the side panel.
function ngCard() {
  const sk = ngSkills();
  const shown = sk.slice(0, 7);
  const qs = ng.step >= 3 ? ngChosenQuests().length : null;
  return `<div class="tag">PLAYER</div>
    <div class="ng-card-name" id="ng-card-name">${ransom(ng.name.trim() || 'Joker', 13)}</div>
    <div class="ng-card-lv">LV 1 · ${esc(TITLES[0][1])}</div>
    <ul class="ng-card-sk">${shown.length ? shown.map(s => `<li>${skillBadge(s)}<span>${esc(s.name)}</span></li>`).join('')
      : '<li class="ng-card-empty">No skills yet</li>'}${sk.length > shown.length ? `<li class="ng-card-more">+${sk.length - shown.length} more</li>` : ''}</ul>
    <div class="ng-card-stats">${STAT_ORDER.map(k => {
      const n = sk.filter(s => s.stat === k).length;
      return `<span class="${n ? 'on' : ''}">${STATS[k].name}${n ? ` ×${n}` : ''}</span>`;
    }).join('')}</div>
    ${qs === null ? '' : `<div class="ng-card-q">${qs} quest${qs === 1 ? '' : 's'}</div>`}`;
}

function ngWizard() {
  const steps = NG_STEPS.map((label, i) => {
    const n = i + 1, cur = n === ng.step;
    return `<li ${cur ? 'aria-current="step"' : ''}><button type="button" class="ng-step ${cur ? 'on' : ''}" data-act="ng-goto" data-step="${n}"
      ${n > ng.reached ? 'disabled' : ''} style="--i:${i}"><b>${n}</b><span>${label}</span></button></li>`;
  }).join('');
  const body = [null, ngStepWho, ngStepTrain, ngStepQuests, ngStepReady][ng.step]();
  return `<div class="ng ng-wizard" role="dialog" aria-modal="true" aria-labelledby="ng-h">
    <div class="ng-drag"></div>
    <aside class="ng-side">
      <div class="side-bg"></div>
      <ol class="ng-steps" aria-label="Character creation">${steps}</ol>
      <div class="ng-card" id="ng-card">${ngCard()}</div>
    </aside>
    <form class="ng-main" id="ng-form" novalidate>
      <div class="ng-body">${body}</div>
      ${ng.error ? `<p class="ng-error" role="alert">${esc(ng.error)}</p>` : ''}
      <div class="ng-nav">
        <button type="button" class="btn ghost" data-act="ng-back">Back</button>
        <button type="submit" class="btn primary">${ng.step === 4 ? 'Start' : 'Next'} <kbd>Enter</kbd></button>
      </div>
    </form>
  </div>`;
}

// moved: a new step is showing — focus its first field or heading. Otherwise keep focus where it was.
function renderNewGame(moved = false) {
  const root = $('#newgame-root');
  const keepId = !moved && root.contains(document.activeElement) ? document.activeElement.id : '';
  root.innerHTML = ng.step === 0 ? ngTitleScreen() : ngWizard();
  const target = (keepId && document.getElementById(keepId)) || root.querySelector('[data-autofocus]') || root.querySelector('h1');
  target?.focus();
}

// Copies what's typed into `ng` (no re-render, so typing keeps focus) and refreshes the card.
function ngSync() {
  const val = id => document.getElementById(id)?.value;
  if (val('ng-name') !== undefined) ng.name = val('ng-name');
  document.querySelectorAll('[data-ng-name]').forEach(i => { ng.names[i.dataset.ngName] = i.value; });
  document.querySelectorAll('[data-ng-qt]').forEach(i => { ng.qTitle[i.dataset.ngQt] = i.value; });
  if (val('ng-dailies')) ng.dailiesAt = val('ng-dailies');
  if (val('ng-bed')) ng.bedAt = val('ng-bed');
  const card = $('#ng-card');
  if (card) card.innerHTML = ngCard();
  const preview = $('#ng-name-preview');
  if (preview) preview.innerHTML = ransom(ng.name.trim() || 'Joker', 13);
}

function ngNext() {
  ngSync();
  ng.error = '';
  if (ng.step === 2 && !ng.picked.length) { ng.error = 'Pick at least one thing to train.'; renderNewGame(); return; }
  if (ng.step === 4) { finishNewGame(); return; }
  ng.step++;
  ng.reached = Math.max(ng.reached, ng.step);
  sfx.nav();
  renderNewGame(true);
}

function ngAddOwn() {
  ngSync();
  const input = $('#ng-own-name'), name = input.value.trim();
  if (!name) { input.focus(); return; }
  const key = 'own' + uid();
  ng.custom.push({ key, name, stat: $('#ng-own-stat').value, icon: guessIcon({ name }) });
  ng.picked.push(key);
  ng.error = '';
  sfx.ok();
  renderNewGame();
  $('#ng-own-name')?.focus();
}

function finishNewGame() {
  const fresh = defaultState();
  if (ng.fromSystem) fresh.settings = { ...state.settings }; // keep hotkey / login / sound choices
  fresh.settings.dailiesAt = ng.dailiesAt;
  fresh.settings.bedAt = ng.bedAt;
  fresh.player = { name: ng.name.trim() || 'Joker', createdAt: new Date().toISOString() };
  const ids = {};
  fresh.skills = ngSkills().map(s => { const sk = newSkill(s.name, s.icon, s.stat); ids[s.key] = sk.id; return sk; });
  fresh.quests = ngChosenQuests().map(q => newQuest(q.title.trim(), q.type, 'skill:' + ids[q.skill], q.effort));
  state = fresh;
  persist();
  closeNewGame();
  screen = '';
  go('status');
  sfx.rank();
  toast(`WELCOME, ${state.player.name.toUpperCase()}`, 'Your story starts now');
  setTimeout(() => { if (!ng) openQuickLog(); }, 600);
}

// Asks for a save file and checks it looks like one. Returns the data, or null.
async function pickSaveFile() {
  let data;
  try { data = await window.api.importSave(); } catch { toast('ERROR', 'That file is not valid JSON'); return null; }
  if (!data) return null;
  if (!Array.isArray(data.log) || !Array.isArray(data.skills)) { toast('ERROR', 'Not a Phantom Life save'); return null; }
  return data;
}

async function ngLoad() {
  const data = await pickSaveFile();
  if (!data || !ng) return;
  if (ng.fromSystem && !await askConfirm('LOAD SAVE?', `This replaces your current progress with the imported save (${data.log.length} actions).`, 'Load')) return;
  state = normalize(data);
  persist();
  closeNewGame();
  screen = '';
  go('status');
  toast('LOADED', `Welcome back, ${state.player.name}`);
}

/* ---------- render ---------- */
function renderSide() {
  const now = new Date();
  const pl = playerLevel(D ? D.total : 0);
  const dw = now.getDay();
  $('#side').innerHTML = `
    <div class="side-bg"></div>
    <div class="cal">
      <div class="cal-md"><span class="cal-m">${now.getMonth() + 1}</span><span class="cal-slash">/</span><span class="cal-d">${now.getDate()}</span></div>
      <div class="cal-dow ${dw === 0 ? 'sun' : dw === 6 ? 'sat' : ''}">${DOW[dw]}</div>
      <div class="cal-tod">${timeOfDay(now.getHours())}</div>
    </div>
    <nav class="menu">${MENU().map((s, i) => `
      <button class="mi ${screen === s.id ? 'active' : ''}" data-act="go" data-id="${s.id}" style="--i:${i}">
        <span class="mi-k">${i + 1}</span><span class="mi-t">${s.label}</span>
      </button>`).join('')}
    </nav>
    <div class="side-bottom">
      ${pendingReviewWeek() && screen !== 'velvet' ? '<button class="vr-badge" data-act="go" data-id="velvet"><span>🦋</span>The Velvet Room awaits</button>' : ''}
      ${timerPanel()}
      <button class="act-btn" data-act="quick-log"><span>TAKE ACTION</span><kbd>L</kbd></button>
    </div>
    <div class="side-foot">
      <div><b>${esc(state.player.name)}</b><span>LV ${pl.lvl} · ${esc(titleFor(pl.lvl))}</span></div>
      <button class="side-wallet" data-act="go" data-id="shop" title="Shop">${fmtYen(D ? D.yen : 0)}</button>
      <button class="side-gear ${screen === 'system' ? 'on' : ''}" data-act="go" data-id="system" title="System (${KEY.system})">${iconSvg('gear')}</button>
    </div>`;
}

function render() {
  D = derive();
  renderSide();
  const main = $('#main'), y = main.scrollTop;
  main.classList.toggle('vr-mode', screen === 'velvet');
  $('#screen').innerHTML = SCREEN_FN[screen]();
  main.scrollTop = y;
  if (screen === 'system') window.api.savePath().then(p => { const el = $('#sys-path'); if (el) el.textContent = p; });
}

function go(id) {
  if (!SCREEN_FN[id]) return;
  const changed = id !== screen;
  if (changed && id === 'velvet') velvetWeek = pendingReviewWeek() || weekKey(new Date());
  screen = id;
  if (id !== 'journal') journalLimit = 40;
  render();
  if (changed) {
    sfx.nav();
    $('#main').scrollTop = 0;
    const s = $('#screen');
    s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter');
  }
}

/* ---------- events ---------- */
const ACTIONS = {
  go: ds => go(ds.id),
  'quick-log': () => openQuickLog(),
  'close-modal': () => closeModal(),
  'modal-back': (ds, el, e) => { if (e.target === el) closeModal(); },
  'close-rankup': () => closeRankUp(),
  'toggle-quest': ds => toggleQuest(ds.id),
  'toggle-stage': ds => toggleStage(ds.id, ds.stage),
  'add-skill': () => skillModal(),
  'edit-skill': ds => skillModal(ds.id),
  'del-skill': async ds => {
    const s = skillById(ds.id);
    const linked = state.quests.filter(q => q.target === 'skill:' + s.id);
    if (!await askConfirm('DELETE SKILL?', `"${s.name}" will be removed${linked.length ? ` along with ${linked.length} linked quest(s)` : ''}. Social stat points you earned stay.`, 'Delete')) return;
    state.skills = state.skills.filter(x => x.id !== s.id);
    state.quests = state.quests.filter(q => !linked.includes(q));
    persist(); sfx.back(); render();
  },
  'quick-skill': ds => logActivity(['skill:' + ds.id], ds.int),
  'timer-skill': ds => startTimer(['skill:' + ds.id]),
  'timer-pause': () => { pauseTimer(); sfx.back(); },
  'timer-resume': () => resumeTimer(),
  'timer-stop': () => stopTimer(),
  'timer-discard': async () => {
    if (!await askConfirm('DISCARD TIMER?', `${state.timer.label} · ${fmtClock(timerMs())} won’t be logged.`, 'Discard')) return;
    clearTimer(); sfx.back(); toast('TIMER DISCARDED', '');
  },
  'log-skill': ds => openQuickLog('skill:' + ds.id),
  'add-quest': ds => questModal(null, ds.type),
  'new-mission': () => { go('quests'); questModal(null, 'once'); },
  'edit-quest': ds => questModal(ds.id),
  'del-quest': async ds => {
    const q = state.quests.find(x => x.id === ds.id);
    if (!await askConfirm('DELETE QUEST?', `"${q.title}" will be removed. XP already earned stays in your journal.`, 'Delete')) return;
    state.quests = state.quests.filter(x => x.id !== q.id);
    persist(); sfx.back(); render();
  },
  'add-conf': () => confModal(),
  'edit-conf': ds => confModal(ds.id),
  hangout: ds => hangoutModal(ds.id),
  'del-conf': async ds => {
    const c = confById(ds.id);
    if (!await askConfirm('END THIS BOND?', `${c.name} will be removed from your confidants. Their journal entries stay.`, 'Remove')) return;
    state.confidants = state.confidants.filter(x => x.id !== c.id);
    persist(); sfx.back(); render();
  },
  'del-entry': async ds => {
    const e = state.log.find(x => x.id === ds.id);
    if (!await askConfirm('UNDO THIS?', `Remove "${entryLabel(e)}" (+${e.xp} XP) from ${e.date}? Levels and ranks recalculate.`, 'Remove')) return;
    state.log = state.log.filter(x => x.id !== e.id);
    persist(); sfx.back(); render();
  },
  'vr-week': ds => {
    const cur = weekKey(new Date());
    const w = Number(ds.dir) > 0 ? nextWeek(velvetWeek || cur) : prevWeek(velvetWeek || cur);
    velvetWeek = w > cur ? cur : w;
    sfx.nav(); render();
  },
  'vr-goto': ds => { velvetWeek = ds.week; sfx.nav(); render(); $('#main').scrollTop = 0; },
  'add-reward': () => rewardModal(),
  'edit-reward': ds => rewardModal(ds.id),
  'del-reward': async ds => {
    const r = state.rewards.find(x => x.id === ds.id);
    if (!await askConfirm('REMOVE REWARD?', `"${r.name}" will leave the shop. Past receipts stay.`, 'Remove')) return;
    state.rewards = state.rewards.filter(x => x.id !== r.id);
    persist(); sfx.back(); render();
  },
  buy: ds => buyReward(ds.id),
  refund: async ds => {
    const p = state.purchases.find(x => x.id === ds.id);
    if (!await askConfirm('REFUND?', `Undo buying "${p.name}" and get ${fmtYen(p.price)} back.`, 'Refund')) return;
    state.purchases = state.purchases.filter(x => x.id !== p.id);
    persist(); sfx.back(); render();
  },
  'test-notify': async () => {
    const r = await window.api.testNotify();
    if (r === 'scheduled') toast('IN 5 SECONDS', 'Switch to another app to see the banner');
    else toast('NO NOTIFICATIONS', OS.notifSettings);
  },
  'set-cond': ds => {
    const k = dkey();
    if (state.conditions[k] === ds.id) delete state.conditions[k]; else state.conditions[k] = ds.id;
    persist(); sfx.nav(); render();
  },
  'j-tab': ds => { journalTab = ds.id; sfx.nav(); render(); },
  'cal-month': ds => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + Number(ds.dir), 1); sfx.nav(); render(); },
  'cal-day': ds => { calDay = ds.id; render(); },
  'more-journal': () => { journalLimit += 60; render(); },
  export: async () => { if (await window.api.exportSave(state)) toast('SAVED', 'Export written'); },
  import: async () => {
    const data = await pickSaveFile();
    if (!data) return;
    if (!await askConfirm('LOAD SAVE?', `This replaces your current progress with the imported save (${data.log.length} actions).`, 'Load')) return;
    state = normalize(data); persist(); render(); toast('LOADED', 'Welcome back');
  },
  reveal: () => window.api.revealSave(),
  reset: async () => {
    if (!await askConfirm('NEW GAME?', 'You’ll create a new character. Your current progress is replaced when you press Start — until then you can go back. Export it first if you might want it later.', 'Continue')) return;
    openNewGame(true);
  },
  // character creation
  'ng-new': () => { ng.step = 1; sfx.nav(); renderNewGame(true); },
  'ng-load': () => ngLoad(),
  'ng-cancel': () => { closeNewGame(); sfx.back(); render(); },
  'ng-back': () => { ngSync(); ng.error = ''; ng.step--; sfx.back(); renderNewGame(true); },
  'ng-goto': ds => { ngSync(); ng.error = ''; ng.step = Number(ds.step); sfx.nav(); renderNewGame(true); },
  'ng-drop': ds => { ngSync(); ng.picked = ng.picked.filter(k => k !== ds.key); sfx.back(); renderNewGame(); },
  'ng-add-own': () => ngAddOwn(),
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el.dataset, el, e);
});

// Character creation: typing updates the live card; ticking areas/quests re-renders the step.
document.addEventListener('input', e => { if (ng && e.target.closest('#newgame-root')) ngSync(); });
document.addEventListener('submit', e => { if (e.target.id === 'ng-form') { e.preventDefault(); ngNext(); } });

document.addEventListener('change', e => {
  if (ng && e.target.name === 'area') {
    ngSync();
    const id = e.target.value;
    ng.picked = e.target.checked ? [...ng.picked, id] : ng.picked.filter(k => k !== id);
    ng.error = '';
    (e.target.checked ? sfx.ok : sfx.back)();
    renderNewGame();
    return;
  }
  if (ng && e.target.name === 'q') {
    ng.qOn[e.target.value] = e.target.checked;
    e.target.closest('.ng-q').classList.toggle('on', e.target.checked);
    ngSync();
    return;
  }
  if (e.target.id === 'sys-name') {
    state.player.name = e.target.value.trim() || 'Joker';
    persist(); render(); toast('CODENAME SET', state.player.name);
  }
  const key = e.target.dataset && e.target.dataset.setting;
  if (key) {
    state.settings[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    persist(); sfx.ok();
    if (key === 'hotkey') window.api.setHotkey(e.target.checked).then(ok => { if (e.target.checked && !ok) toast('SHORTCUT TAKEN', `${KEY.hotkey} is used by another app`); });
    if (key === 'openAtLogin') window.api.setLogin(e.target.checked);
  }
});

document.addEventListener('keydown', e => {
  if (ng && !$('#modal-root').firstChild) {
    // Enter in "your own skill" adds it instead of moving on; app shortcuts are off meanwhile.
    if (e.key === 'Enter' && e.target.id === 'ng-own-name') { e.preventDefault(); ngAddOwn(); }
    return;
  }
  if ($('#rankup-root').firstChild) {
    if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); closeRankUp(); }
    return;
  }
  if (e.key === 'Escape') { closeModal(); return; }
  if (modKey(e) && e.key === ',') { e.preventDefault(); closeModal(); go('system'); return; }
  const tag = (e.target.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag) || $('#modal-root').firstChild || e.metaKey || e.ctrlKey || e.altKey) return;
  const n = Number(e.key);
  if (n >= 1 && n <= MENU().length) go(MENU()[n - 1].id);
  else if (e.key.toLowerCase() === 'l') { e.preventDefault(); openQuickLog(); }
});

/* ---------- tooltips: any element with data-tip ---------- */
document.addEventListener('mouseover', e => {
  const t = e.target.closest && e.target.closest('[data-tip]'), tip = $('#tip');
  if (!t) { tip.hidden = true; return; }
  tip.innerHTML = t.dataset.tip;
  tip.hidden = false;
});
document.addEventListener('mousemove', e => {
  const tip = $('#tip');
  if (tip.hidden) return;
  tip.style.left = Math.min(e.clientX + 16, innerWidth - tip.offsetWidth - 8) + 'px';
  tip.style.top = Math.min(e.clientY + 16, innerHeight - tip.offsetHeight - 8) + 'px';
});

/* ---------- dev helpers (PL_SHOT screenshots, tests) ---------- */
// First launch shows character creation; this swaps it for the sample character.
window.__skipOnboarding = () => {
  if (!ng) return;
  closeNewGame();
  state = sampleState();
  persist();
  render();
};
// Character creation at a given step (0 = title screen) with a few picks, for screenshots.
window.__ngShot = step => {
  if (!ng) openNewGame();
  Object.assign(ng, { step, reached: 4, name: 'Joker', picked: ['coding', 'fitness', 'reading', 'music'] });
  renderNewGame(true);
};
window.__seedDemo = () => {
  if (ng) closeNewGame();
  if (!state.skills.length) state = sampleState();
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  state.confidants.push(
    { id: uid(), name: 'Ryuji', arcana: 'Chariot', stat: 'guts', notes: 'Gym buddy. Loves ramen.', createdAt: new Date().toISOString() },
    { id: uid(), name: 'Mom', arcana: 'Empress', stat: 'kindness', notes: 'Call on Sundays.', createdAt: new Date().toISOString() },
  );
  const cka = {
    id: uid(), title: 'Pass the CKA exam', type: 'once', target: 'skill:' + state.skills[0].id, intensity: 'epic',
    deadline: dkey(addDays(new Date(), 11)), createdAt: addDays(new Date(), -24).toISOString(),
    stages: [['Kubernetes basics course', -12], ['Practice cluster at home', -5], ['Mock exam #1', -1], ['Mock exam #2', 5], ['Book the exam', 8]]
      .map(([title, d]) => ({ id: uid(), title, deadline: dkey(addDays(new Date(), d)) })),
  };
  state.quests.push(cka);
  cka.stages.slice(0, 3).forEach((s, i) => {
    const dt = addDays(new Date(), [-13, -6, -2][i]);
    state.log.push({ id: uid(), ts: dt.toISOString(), date: dkey(dt), kind: 'stage', questId: cka.id, stageId: s.id, ...targetInfo(cka.target), xp: 25, statPts: 5, intensity: 'normal', note: `${cka.title} — ${s.title}` });
  });
  for (let day = 120; day >= 0; day--) {
    if (Math.random() < 0.25) continue;
    const dt = addDays(new Date(), -day);
    for (let k = 0; k < rnd(1, 4); k++) {
      const s = state.skills[rnd(0, state.skills.length - 1)];
      const I = INTENSITY[rnd(0, 2)];
      dt.setHours(rnd(7, 23), rnd(0, 59));
      state.log.push({ id: uid(), ts: dt.toISOString(), date: dkey(dt), kind: 'activity', skillId: s.id, stat: s.stat, xp: I.xp, statPts: statPtsFor(I.xp), intensity: I.id, note: '' });
    }
    if (Math.random() < 0.2) {
      const c = state.confidants[rnd(0, 1)];
      state.log.push({ id: uid(), ts: dt.toISOString(), date: dkey(dt), kind: 'hangout', confId: c.id, stat: c.stat, xp: 25, statPts: 5, cpts: 2, intensity: 'normal', note: 'Good talk.' });
    }
  }
  for (let day = 60; day >= 0; day--) if (Math.random() < 0.6) state.conditions[dkey(addDays(new Date(), -day))] = ['great', 'good', 'good', 'tired', 'sick'][rnd(0, 4)];
  const lastWk = prevWeek(weekKey(new Date()));
  state.reviews[lastWk] = { grade: 'A', well: 'Shipped the landing page. Gym 4 times.', held: 'Doomscrolling at night.', next: 'Study for CKA every morning.', focus: [state.skills[0].id, state.skills[2].id], completedAt: new Date().toISOString() };
  const q = state.quests[0];
  state.log.push({ id: uid(), ts: new Date().toISOString(), date: dkey(), kind: 'quest', questId: q.id, ...targetInfo(q.target), xp: 25, statPts: 5, intensity: 'normal', note: q.title });
  checkCompendium(true);
  render();
};
window.__demoRankUp = () => queueRankUp({ kicker: 'Knowledge', big: 'RANK UP!', sub: 'Rank 3 — Scholarly', stat: true });

/* ---------- boot ---------- */
(async function boot() {
  const raw = await window.api.load();
  state = normalize(raw);
  checkCompendium(true);
  render();
  $('#screen').classList.add('enter');
  if (!raw) openNewGame(); // first launch: create a character (saved only on Start)
  setInterval(renderSide, 60 * 1000);
  window.api.onQuickLog(() => { if (ng) return; closeRankUp(); closeModal(); openQuickLog(); });
  window.api.onGo(id => { if (ng) return; closeModal(); go(id || 'status'); });
  window.api.onMorgana(m => morganaSays(m));
  // focus timer: tick the sidebar clock, keep the main process (tray, away detection) in sync
  setInterval(() => { const c = $('#timer-clock'); if (c && state.timer) c.textContent = fmtClock(timerMs()); }, 1000);
  window.api.timerChanged(state.timer);
  window.api.onTimerStop(() => { if (!ng) stopTimer(); });
  window.api.onTimerAway(a => { if (!ng) timerAway(a); });
  window.api.pendingAway().then(a => { if (a && !ng) timerAway(a); });
  window.api.setHotkey(state.settings.hotkey !== false);
})();
