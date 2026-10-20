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

const SCREENS = [
  { id: 'status',     label: 'Status',     sub: 'Who you are today' },
  { id: 'skills',     label: 'Skills',     sub: 'Grind what matters' },
  { id: 'quests',     label: 'Quests',     sub: 'Habits & missions' },
  { id: 'confidants', label: 'Confidants', sub: 'The bonds that make you' },
  { id: 'journal',    label: 'Journal',    sub: 'Every step you took' },
  { id: 'system',     label: 'System',     sub: 'Save, load, config' },
];

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

function defaultState() {
  const sk = (name, icon, stat) => ({ id: uid(), name, icon, stat, createdAt: new Date().toISOString() });
  const skills = [
    sk('DevOps', '⚙️', 'proficiency'),
    sk('Frontend', '🖥️', 'knowledge'),
    sk('Sports', '🏋️', 'guts'),
    sk('Style', '🕶️', 'charm'),
    sk('Reading', '📚', 'knowledge'),
    sk('Helping Others', '🤝', 'kindness'),
  ];
  const by = n => 'skill:' + skills.find(s => s.name === n).id;
  const q = (title, type, target, inten) => ({ id: uid(), title, type, target, intensity: inten, deadline: '', createdAt: new Date().toISOString() });
  return {
    version: 1,
    player: { name: 'Joker' },
    settings: { sound: true },
    skills,
    quests: [
      q('Work out', 'daily', by('Sports'), 'normal'),
      q('Read 20 pages', 'daily', by('Reading'), 'light'),
      q('Push a commit on a side project', 'daily', by('Frontend'), 'normal'),
      q('Call family', 'weekly', 'stat:kindness', 'normal'),
    ],
    confidants: [],
    log: [],
  };
}

function normalize(s) {
  const base = defaultState();
  if (!s || typeof s !== 'object') return base;
  return {
    version: 1,
    player: { ...base.player, ...(s.player || {}) },
    settings: { ...base.settings, ...(s.settings || {}) },
    skills: Array.isArray(s.skills) ? s.skills : base.skills,
    quests: Array.isArray(s.quests) ? s.quests : base.quests,
    confidants: Array.isArray(s.confidants) ? s.confidants : [],
    log: Array.isArray(s.log) ? s.log : [],
  };
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; window.api.save(state); }, 200);
}
window.addEventListener('beforeunload', () => { if (saveTimer) window.api.saveSync(state); });

function derive() {
  const stats = Object.fromEntries(STAT_ORDER.map(k => [k, 0]));
  const skillXp = {}, confPts = {}, byDate = {};
  let total = 0;
  for (const e of state.log) {
    if (e.stat in stats) stats[e.stat] += e.statPts || 0;
    if (e.skillId) skillXp[e.skillId] = (skillXp[e.skillId] || 0) + (e.xp || 0);
    if (e.confId) confPts[e.confId] = (confPts[e.confId] || 0) + (e.cpts || 0);
    total += e.xp || 0;
    byDate[e.date] = (byDate[e.date] || 0) + (e.xp || 0);
  }
  return { stats, skillXp, confPts, byDate, total };
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
    if (s) return { skillId: s.id, stat: s.stat, label: s.name, icon: s.icon };
  }
  if (kind === 'stat' && STATS[id]) return { skillId: null, stat: id, label: STATS[id].name, icon: '★' };
  return { skillId: null, stat: null, label: 'Unknown', icon: '?' };
}

function entryLabel(e) {
  if (e.confId) { const c = confById(e.confId); return c ? c.name : 'Former confidant'; }
  if (e.skillId) { const s = skillById(e.skillId); return s ? s.name : 'Deleted skill'; }
  if (e.stat) return STATS[e.stat]?.name || '—';
  return '—';
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
  toast(`+${e.xp} XP`, `${label}${e.stat ? ` · +${e.statPts} ${STATS[e.stat].name}` : ''}`);
  announce(before, after);
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

function logActivity(target, intId, note = '') {
  const t = targetInfo(target);
  const I = intensity(intId);
  commit({ kind: 'activity', skillId: t.skillId, stat: t.stat, xp: I.xp, statPts: statPtsFor(I.xp), intensity: I.id, note });
}

function questCompletion(q) {
  const today = dkey(), wk = weekKey(new Date());
  return state.log.find(e => e.questId === q.id && (
    q.type === 'daily' ? e.date === today :
    q.type === 'weekly' ? weekKey(parseKey(e.date)) === wk : true));
}

function questStreak(q) {
  if (q.type !== 'daily') return 0;
  const days = new Set(state.log.filter(e => e.questId === q.id).map(e => e.date));
  let d = startOfDay();
  if (!days.has(dkey(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(dkey(d))) { n++; d = addDays(d, -1); }
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

function toggleQuest(id) {
  const q = state.quests.find(x => x.id === id);
  if (!q) return;
  const done = questCompletion(q);
  if (done) {
    state.log = state.log.filter(e => e.id !== done.id);
    persist(); sfx.back(); render();
    return;
  }
  const t = targetInfo(q.target);
  const I = intensity(q.intensity);
  commit({ kind: 'quest', questId: q.id, skillId: t.skillId, stat: t.stat, xp: I.xp, statPts: statPtsFor(I.xp), intensity: I.id, note: q.title });
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
    <div class="rankup ${r.conf ? 'conf' : ''}" data-act="close-rankup">
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
  $('#modal-root').innerHTML = `<div class="modal-back" data-act="modal-back"><div class="modal" role="dialog">${html}</div></div>`;
  const root = $('#modal-root .modal');
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
    <optgroup label="Skills">${state.skills.map(s => `<option value="skill:${s.id}" ${cur === 'skill:' + s.id ? 'selected' : ''}>${esc(s.icon || '')} ${esc(s.name)} → ${STATS[s.stat].name}</option>`).join('')}</optgroup>
    <optgroup label="Social stat only">${STAT_ORDER.map(k => `<option value="stat:${k}" ${cur === 'stat:' + k ? 'selected' : ''}>★ ${STATS[k].name}</option>`).join('')}</optgroup>
  </select>`;
}

function openQuickLog(preTarget) {
  const last = [...state.log].reverse().find(e => e.kind === 'activity');
  const cur = preTarget || (last ? (last.skillId ? 'skill:' + last.skillId : 'stat:' + last.stat) : (state.skills[0] ? 'skill:' + state.skills[0].id : 'stat:knowledge'));
  openModal(`
    <h2 class="m-title">${ransom('TAKE ACTION', 11)}</h2>
    <p class="m-sub">How did you spend your time?</p>
    <form id="ql">
      <label class="fld"><span>Activity</span>${targetSelect('target', cur)}</label>
      <div class="fld"><span>Effort</span>${intSeg('int', 'normal')}</div>
      <label class="fld"><span>Note <i>(optional)</i></span><textarea name="note" rows="2" maxlength="280" placeholder="Deployed the k8s cluster, finally."></textarea></label>
      <div class="m-actions">
        <button type="button" class="btn ghost" data-act="close-modal">Cancel</button>
        <button class="btn primary">Spend time <kbd>⌘↵</kbd></button>
      </div>
    </form>`, root => {
    const f = root.querySelector('form');
    f.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(f);
      closeModal();
      logActivity(fd.get('target'), fd.get('int'), String(fd.get('note') || '').trim());
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
      <label class="fld"><span>Icon <i>(emoji or letters)</i></span><input name="icon" maxlength="4" value="${esc(s.icon)}" placeholder="🎸"></label>
      <div class="fld"><span>Feeds social stat</span>${statSeg('stat', s.stat)}</div>
      <div class="m-actions">
        <button type="button" class="btn ghost" data-act="close-modal">Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>`, root => {
    root.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = { name: String(fd.get('name')).trim(), icon: String(fd.get('icon')).trim(), stat: fd.get('stat') || 'proficiency' };
      if (id) Object.assign(s, data);
      else state.skills.push({ id: uid(), createdAt: new Date().toISOString(), ...data });
      persist(); closeModal(); sfx.ok(); render();
    };
  });
}

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
      <label class="fld deadline-fld"><span>Deadline <i>(missions only, optional)</i></span><input type="date" name="deadline" value="${esc(q.deadline || '')}"></label>
      <div class="m-actions">
        <button type="button" class="btn ghost" data-act="close-modal">Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>`, root => {
    const f = root.querySelector('form');
    const sync = () => root.querySelector('.deadline-fld').classList.toggle('hidden', new FormData(f).get('type') !== 'once');
    f.addEventListener('change', sync); sync();
    f.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(f);
      const data = {
        title: String(fd.get('title')).trim(), type: fd.get('type'), target: fd.get('target'),
        intensity: fd.get('int'), deadline: fd.get('type') === 'once' ? String(fd.get('deadline') || '') : '',
      };
      if (id) Object.assign(q, data);
      else state.quests.push({ id: uid(), createdAt: new Date().toISOString(), ...data });
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

function hangoutModal(id) {
  const c = confById(id);
  if (!c) return;
  openModal(`
    <h2 class="m-title">${ransom('HANG OUT', 17)}</h2>
    <p class="m-sub">Spend time with <b>${esc(c.name)}</b> · ${esc(arcanaOf(c)[0])} ${esc(c.arcana)}</p>
    <form>
      <div class="fld"><span>How deep?</span>${intSeg('int', 'normal')}</div>
      <label class="fld"><span>What happened <i>(optional)</i></span><textarea name="note" rows="2" maxlength="280" placeholder="Ramen and a long talk about the future."></textarea></label>
      <div class="m-actions">
        <button type="button" class="btn ghost" data-act="close-modal">Cancel</button>
        <button class="btn primary">Spend time</button>
      </div>
    </form>`, root => {
    root.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const I = intensity(fd.get('int'));
      closeModal();
      commit({ kind: 'hangout', confId: c.id, stat: c.stat, xp: I.xp, statPts: statPtsFor(I.xp), cpts: I.cpts, intensity: I.id, note: String(fd.get('note') || '').trim() });
    };
  });
}

/* ---------- shared view bits ---------- */
const bar = (pct, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(1, pct)) * 100}%"></i></div>`;
const pips = (n, total) => `<div class="pips">${Array.from({ length: total }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
function head(id) {
  const s = SCREENS.find(x => x.id === id);
  const q = QUOTES[(new Date().getDate() + SCREENS.indexOf(s)) % QUOTES.length];
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
  const dailies = state.quests.filter(q => q.type === 'daily');
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
    card = `<section class="calling-card" data-act="go" data-id="quests">
      <div class="cc-kicker">TARGET</div>
      <div class="cc-title">${esc(m.title)}</div>
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
    <section class="panel heat-panel"><div class="tag">ACTIVITY · LAST 26 WEEKS</div>${heatmap(26)}</section>
  </div>`;
}

function scrSkills() {
  const today = dkey();
  const cards = state.skills.map(s => {
    const xp = D.skillXp[s.id] || 0;
    const L = skillLevel(xp);
    const tXp = state.log.filter(e => e.skillId === s.id && e.date === today).reduce((a, e) => a + e.xp, 0);
    return `<div class="skill-card">
      <div class="sk-top">
        <div class="sk-icon">${esc(s.icon || s.name.slice(0, 2).toUpperCase())}</div>
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
          ${tXp ? `<div class="sk-today">+${tXp} today</div>` : ''}
        </div>
      </div>
      ${bar(L.pct)}
      <div class="sk-xp"><span>${L.into} / ${L.need} XP</span><span>${xp} total</span></div>
      <div class="sk-quick">${INTENSITY.map(i => `<button data-act="quick-skill" data-id="${s.id}" data-int="${i.id}" title="${i.label} · ${i.hint}">+${i.xp}</button>`).join('')}
        <button class="note" data-act="log-skill" data-id="${s.id}" title="Log with a note">✎</button></div>
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
  let dl = '';
  if (q.type === 'once' && q.deadline && !done) {
    const n = daysUntil(q.deadline);
    dl = `<span class="chip ${n <= 2 ? 'hot' : ''}">${n < 0 ? `${-n}d overdue` : n === 0 ? 'due today' : `D-${n}`} · ${fmtMD(q.deadline)}</span>`;
  }
  return `<div class="quest ${done ? 'done' : ''}">
    <button class="q-check" data-act="toggle-quest" data-id="${q.id}" title="${done ? 'Undo' : 'Complete'}"><i></i></button>
    <div class="q-body">
      <div class="q-title">${esc(q.title)}</div>
      <div class="q-meta"><span class="chip">+${I.xp} XP</span><span class="chip ghost">${esc(t.icon || '')} ${esc(t.label)}</span>
        ${streak ? `<span class="chip fire">🔥 ${streak}</span>` : ''}${dl}
        ${done && q.type === 'once' ? `<span class="chip ghost">cleared ${fmtMD(done.date)}</span>` : ''}</div>
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
      ${section('Daily', `${daily.filter(q => questCompletion(q)).length}/${daily.length} today`, daily, 'daily', 'Small things, every day. That’s how hearts get stolen.')}
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
    const last = [...state.log].reverse().find(e => e.confId === c.id);
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
  ${state.confidants.length ? `<div class="conf-grid">${cards}<button class="skill-add" data-act="add-conf"><b>+</b><span>NEW CONFIDANT</span></button></div>`
    : empty('No confidants yet.', 'Friends, family, mentors — the people you want to grow closer to. Each bond has 10 ranks.', 'add-conf', '+ Add your first confidant')}`;
}

function scrJournal() {
  const entries = [...state.log].sort((a, b) => b.ts.localeCompare(a.ts));
  const shown = entries.slice(0, journalLimit);
  const groups = [];
  for (const e of shown) {
    if (!groups.length || groups[groups.length - 1].date !== e.date) groups.push({ date: e.date, items: [] });
    groups[groups.length - 1].items.push(e);
  }
  const kindTag = { activity: 'ACTION', quest: 'QUEST', hangout: 'BOND' };
  const body = groups.map(g => {
    const dt = parseKey(g.date);
    const xp = D.byDate[g.date] || 0;
    return `<div class="j-day">
      <div class="j-date"><b>${dt.getMonth() + 1}/${dt.getDate()}</b><span class="dow ${dt.getDay() === 0 ? 'sun' : dt.getDay() === 6 ? 'sat' : ''}">${DOW[dt.getDay()]}</span><em>+${xp} XP</em></div>
      <div class="j-items">${g.items.map(e => `
        <div class="j-item">
          <span class="j-time">${fmtTime(e.ts)}</span>
          <span class="j-kind ${e.kind}">${kindTag[e.kind] || 'ACTION'}</span>
          <span class="j-label">${esc(entryLabel(e))}${e.note ? ` — <i>${esc(e.note)}</i>` : ''}</span>
          <span class="j-xp">+${e.xp}${e.stat ? ` · ${STATS[e.stat].name.slice(0, 4)} +${e.statPts}` : ''}</span>
          <button class="ic" data-act="del-entry" data-id="${e.id}" title="Delete (undo)">✕</button>
        </div>`).join('')}</div>
    </div>`;
  }).join('');
  return `${head('journal')}
  <section class="panel heat-panel wide"><div class="tag">ACTIVITY · LAST YEAR</div>${heatmap(52)}</section>
  ${entries.length ? `<div class="journal">${body}</div>
    ${entries.length > journalLimit ? `<div class="center"><button class="btn" data-act="more-journal">Show more (${entries.length - journalLimit} left)</button></div>` : ''}`
    : empty('The journal is empty.', 'Press L anywhere to log your first action.', 'quick-log', 'Take action')}`;
}

function scrSystem() {
  return `${head('system')}
  <div class="sys-grid">
    <section class="panel">
      <div class="tag">PLAYER</div>
      <label class="fld"><span>Codename</span><input id="sys-name" maxlength="30" value="${esc(state.player.name)}"></label>
      <label class="toggle"><input type="checkbox" id="sys-sound" ${state.settings.sound ? 'checked' : ''}><span></span>Sound effects</label>
    </section>
    <section class="panel">
      <div class="tag">SAVE DATA</div>
      <p class="muted">Autosaves locally after every action. A daily backup is kept for 14 days.</p>
      <p class="mono" id="sys-path">…</p>
      <div class="btn-row">
        <button class="btn" data-act="export">Export save</button>
        <button class="btn" data-act="import">Import save</button>
        <button class="btn ghost" data-act="reveal">Show in Finder</button>
      </div>
    </section>
    <section class="panel">
      <div class="tag">HOW IT WORKS</div>
      <ul class="rules">
        <li><b>Effort</b> — Light +10 · Normal +25 · Heavy +50 · Epic +100 XP.</li>
        <li><b>Skills</b> level up from XP, and every action also feeds the skill’s <b>social stat</b> (XP ÷ 5).</li>
        <li><b>Social stats</b> rank up at ${STAT_T.slice(1).join(' / ')} points — just like the game, rank 5 takes real dedication.</li>
        <li><b>Confidants</b> have 10 ranks. Deeper hangouts build the bond faster.</li>
        <li>Made a mistake? Delete it in the <b>Journal</b> — everything recalculates.</li>
        <li>Keys: <kbd>1</kbd>–<kbd>6</kbd> switch screens · <kbd>L</kbd> take action · <kbd>Esc</kbd> close.</li>
      </ul>
    </section>
    <section class="panel danger-zone">
      <div class="tag">DANGER</div>
      <p class="muted">Wipe everything and start a new game. Export first if you might want it back.</p>
      <button class="btn danger" data-act="reset">New game</button>
    </section>
  </div>`;
}

const SCREEN_FN = { status: scrStatus, skills: scrSkills, quests: scrQuests, confidants: scrConfidants, journal: scrJournal, system: scrSystem };

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
    <nav class="menu">${SCREENS.map((s, i) => `
      <button class="mi ${screen === s.id ? 'active' : ''}" data-act="go" data-id="${s.id}" style="--i:${i}">
        <span class="mi-k">${i + 1}</span><span class="mi-t">${s.label}</span>
      </button>`).join('')}
    </nav>
    <button class="act-btn" data-act="quick-log"><span>TAKE ACTION</span><kbd>L</kbd></button>
    <div class="side-foot"><b>${esc(state.player.name)}</b><span>LV ${pl.lvl} · ${esc(titleFor(pl.lvl))}</span></div>`;
}

function render() {
  D = derive();
  renderSide();
  const main = $('#main'), y = main.scrollTop;
  $('#screen').innerHTML = SCREEN_FN[screen]();
  main.scrollTop = y;
  if (screen === 'system') window.api.savePath().then(p => { const el = $('#sys-path'); if (el) el.textContent = p; });
}

function go(id) {
  if (!SCREEN_FN[id]) return;
  const changed = id !== screen;
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
  'quick-skill': ds => logActivity('skill:' + ds.id, ds.int),
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
  'more-journal': () => { journalLimit += 60; render(); },
  export: async () => { if (await window.api.exportSave(state)) toast('SAVED', 'Export written'); },
  import: async () => {
    let data;
    try { data = await window.api.importSave(); } catch { toast('ERROR', 'That file is not valid JSON'); return; }
    if (!data) return;
    if (!Array.isArray(data.log) || !Array.isArray(data.skills)) { toast('ERROR', 'Not a Phantom Life save'); return; }
    if (!await askConfirm('LOAD SAVE?', `This replaces your current progress with the imported save (${data.log.length} actions).`, 'Load')) return;
    state = normalize(data); persist(); render(); toast('LOADED', 'Welcome back');
  },
  reveal: () => window.api.revealSave(),
  reset: async () => {
    if (!await askConfirm('NEW GAME?', 'All skills, quests, confidants and history will be erased.', 'Erase everything')) return;
    state = defaultState(); persist(); go('status'); toast('NEW GAME', 'A new journey begins');
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el.dataset, el, e);
});

document.addEventListener('change', e => {
  if (e.target.id === 'sys-name') {
    state.player.name = e.target.value.trim() || 'Joker';
    persist(); render(); toast('CODENAME SET', state.player.name);
  }
  if (e.target.id === 'sys-sound') { state.settings.sound = e.target.checked; persist(); sfx.ok(); }
});

document.addEventListener('keydown', e => {
  if ($('#rankup-root').firstChild) {
    if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); closeRankUp(); }
    return;
  }
  if (e.key === 'Escape') { closeModal(); return; }
  const tag = (e.target.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag) || $('#modal-root').firstChild || e.metaKey || e.ctrlKey || e.altKey) return;
  const n = Number(e.key);
  if (n >= 1 && n <= SCREENS.length) go(SCREENS[n - 1].id);
  else if (e.key.toLowerCase() === 'l') { e.preventDefault(); openQuickLog(); }
});

/* ---------- dev helpers (used by PL_SHOT screenshots) ---------- */
window.__seedDemo = () => {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  state.confidants.push(
    { id: uid(), name: 'Ryuji', arcana: 'Chariot', stat: 'guts', notes: 'Gym buddy. Loves ramen.', createdAt: new Date().toISOString() },
    { id: uid(), name: 'Mom', arcana: 'Empress', stat: 'kindness', notes: 'Call on Sundays.', createdAt: new Date().toISOString() },
  );
  state.quests.push({ id: uid(), title: 'Pass the CKA exam', type: 'once', target: 'skill:' + state.skills[0].id, intensity: 'epic', deadline: dkey(addDays(new Date(), 11)), createdAt: new Date().toISOString() });
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
  const q = state.quests[0];
  state.log.push({ id: uid(), ts: new Date().toISOString(), date: dkey(), kind: 'quest', questId: q.id, ...targetInfo(q.target), xp: 25, statPts: 5, intensity: 'normal', note: q.title });
  render();
};
window.__demoRankUp = () => queueRankUp({ kicker: 'Knowledge', big: 'RANK UP!', sub: 'Rank 3 — Scholarly', stat: true });

/* ---------- boot ---------- */
(async function boot() {
  const raw = await window.api.load();
  state = normalize(raw);
  if (!raw) persist();
  render();
  $('#screen').classList.add('enter');
  setInterval(renderSide, 60 * 1000);
})();
