'use strict';

/* =========================================================
   Languages. English is the source text: tr('English text', { vars }) looks it up in RU when the
   interface is Russian and fills {placeholders}. trn(n, one, other) picks a plural form; Russian has
   three (1 навык, 2 навыка, 5 навыков), keyed in RU_N by the English singular.
   Loaded before app.js. A missing translation falls back to English and is recorded in
   window.__missingRu (tests check it stays empty).
   ========================================================= */
let LANG = 'en';
const RU_PLURAL = new Intl.PluralRules('ru');
const missingRu = new Set();
window.__missingRu = missingRu;

// The interface language: the setting, or the system's for 'auto'. Tells the main process too
// (tray menu, reminders).
function applyLang() {
  const pref = (typeof state !== 'undefined' && state?.settings?.lang) || 'auto';
  LANG = pref === 'en' || pref === 'ru' ? pref : String(navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  document.documentElement.lang = LANG;
  document.getElementById('toasts')?.setAttribute('aria-label', tr('Notifications')); // static in index.html
  window.api.setLang?.(LANG);
}

const fill = (s, vars) => vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;

function tr(s, vars) {
  if (LANG === 'ru') {
    if (s in RU) s = RU[s];
    else if (s) missingRu.add(s);
  }
  return fill(s, vars);
}

// The same English word translated differently by context: RU['Daily|heading'] vs RU['Daily'].
const trc = (ctx, s, vars) => LANG === 'ru' && `${s}|${ctx}` in RU ? fill(RU[`${s}|${ctx}`], vars) : tr(s, vars);

function trn(n, one, other, vars) {
  vars = { n, ...vars };
  if (LANG === 'ru') {
    const f = RU_N[one];
    if (f) {
      const c = RU_PLURAL.select(n);
      return fill(f[c === 'one' ? 0 : c === 'few' ? 1 : 2], vars);
    }
    missingRu.add(one);
  }
  return fill(n === 1 ? one : other, vars);
}

const LOCALES = {
  en: {
    dow: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    dayShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    pip: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
  ru: {
    dow: ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'],
    dayShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    pip: ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'],
    months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  },
};
const LOC = () => LOCALES[LANG];

/* ---------- Russian: plural forms [1, 2–4, 5+] ---------- */
const RU_N = {
  '{n} stage still open. Clear the whole mission anyway?': ['Остался {n} этап. Всё равно завершить миссию целиком?', 'Осталось {n} этапа. Всё равно завершить миссию целиком?', 'Осталось {n} этапов. Всё равно завершить миссию целиком?'],
  '<b>{n}</b> DAY OVERDUE': ['ПРОСРОЧЕНО НА <b>{n}</b> ДЕНЬ', 'ПРОСРОЧЕНО НА <b>{n}</b> ДНЯ', 'ПРОСРОЧЕНО НА <b>{n}</b> ДНЕЙ'],
  '<b>{n}</b> DAY LEFT': ['ОСТАЛСЯ <b>{n}</b> ДЕНЬ', 'ОСТАЛОСЬ <b>{n}</b> ДНЯ', 'ОСТАЛОСЬ <b>{n}</b> ДНЕЙ'],
  '+{n} more target': ['ещё {n} цель', 'ещё {n} цели', 'ещё {n} целей'],
  '{n} action': ['{n} действие', '{n} действия', '{n} действий'],
  '{skill} — untouched for {n} day.': ['Навык {skill} не прокачивался {n} день.', 'Навык {skill} не прокачивался {n} дня.', 'Навык {skill} не прокачивался {n} дней.'],
  'No time with {name} for {n} day.': ['С {name} не было встреч {n} день.', 'С {name} не было встреч {n} дня.', 'С {name} не было встреч {n} дней.'],
  'Deadline in {n} day: {title}.': ['Срок через {n} день: {title}.', 'Срок через {n} дня: {title}.', 'Срок через {n} дней: {title}.'],
  'Stage {step} of {mission} is {n} day late.': ['Этап {step} миссии {mission} опаздывает на {n} день.', 'Этап {step} миссии {mission} опаздывает на {n} дня.', 'Этап {step} миссии {mission} опаздывает на {n} дней.'],
  'Next stage of {mission} is due in {n} day: {step}.': ['Следующий этап миссии {mission} — через {n} день: {step}.', 'Следующий этап миссии {mission} — через {n} дня: {step}.', 'Следующий этап миссии {mission} — через {n} дней: {step}.'],
  '{n} persona awakened': ['пробуждена {n} персона', 'пробуждено {n} персоны', 'пробуждено {n} персон'],
  '{n} mission cleared': ['выполнена {n} миссия', 'выполнено {n} миссии', 'выполнено {n} миссий'],
  '{n} mission stage': ['{n} этап миссии', '{n} этапа миссий', '{n} этапов миссий'],
  "{name} hasn't seen action in <b>{n} day</b>. Spend any time on it today.": ['Навык {name} не прокачивался уже <b>{n} день</b>. Удели ему сегодня хоть немного времени.', 'Навык {name} не прокачивался уже <b>{n} дня</b>. Удели ему сегодня хоть немного времени.', 'Навык {name} не прокачивался уже <b>{n} дней</b>. Удели ему сегодня хоть немного времени.'],
  '{n} skill': ['{n} навык', '{n} навыка', '{n} навыков'],
  '{n} quest': ['{n} квест', '{n} квеста', '{n} квестов'],
  'This replaces your current progress with the imported save ({n} action).': ['Текущий прогресс заменится импортированным сохранением ({n} действие).', 'Текущий прогресс заменится импортированным сохранением ({n} действия).', 'Текущий прогресс заменится импортированным сохранением ({n} действий).'],
  '“{name}” will be removed along with {n} linked quest.': ['Навык «{name}» будет удалён вместе с {n} связанным квестом.', 'Навык «{name}» будет удалён вместе с {n} связанными квестами.', 'Навык «{name}» будет удалён вместе с {n} связанными квестами.'],
};

/* ---------- Russian: everything else ---------- */
const RU = {
  // social stats and their ranks
  Knowledge: 'Знания', Guts: 'Смелость', Proficiency: 'Сноровка', Kindness: 'Доброта', Charm: 'Обаяние',
  Oblivious: 'Невежда', Learned: 'Начитанный', Scholarly: 'Учёный', Encyclopedic: 'Энциклопедист', Erudite: 'Эрудит',
  Milquetoast: 'Тихоня', Bold: 'Смельчак', Staunch: 'Стойкий', Dauntless: 'Бесстрашный', Lionhearted: 'Львиное сердце',
  Bumbling: 'Растяпа', Decent: 'Сносный', Skilled: 'Умелый', Masterful: 'Мастер', Transcendent: 'Непревзойдённый',
  Inoffensive: 'Безобидный', Considerate: 'Внимательный', Empathetic: 'Чуткий', Selfless: 'Самоотверженный', Angelic: 'Ангел во плоти',
  Existent: 'Существующий', 'Head-Turning': 'Притягательный', Suave: 'Обходительный', Charismatic: 'Харизматичный', Debonair: 'Неотразимый',

  // effort
  Light: 'Лёгкое', Normal: 'Обычное', Heavy: 'Тяжёлое', Epic: 'Эпичное',
  '~15 min': '~15 мин', '~45 min': '~45 мин', '~2 hours': '~2 часа', 'a major win': 'большая победа',

  // arcana
  Fool: 'Шут', Magician: 'Маг', Priestess: 'Жрица', Empress: 'Императрица', Emperor: 'Император',
  Hierophant: 'Иерофант', Lovers: 'Влюблённые', Chariot: 'Колесница', Justice: 'Справедливость', Hermit: 'Отшельник',
  Fortune: 'Фортуна', Strength: 'Сила', 'Hanged Man': 'Повешенный', Death: 'Смерть', Temperance: 'Умеренность',
  Devil: 'Дьявол', Tower: 'Башня', Star: 'Звезда', Moon: 'Луна', Sun: 'Солнце',
  Judgement: 'Суд', World: 'Мир', Faith: 'Вера', Councillor: 'Советник',

  // titles
  'Transfer Student': 'Новенький', 'Rookie Thief': 'Вор-новичок', 'Phantom Thief': 'Призрачный вор', Trickster: 'Трикстер',
  'Wild Card': 'Дикая карта', 'Leader of the Heist': 'Главарь налёта', Joker: 'Джокер', 'Phantom Legend': 'Легенда Призраков',
  'God of Rebellion': 'Бог восстания',

  // quotes
  'Take your time.': 'Не торопись.', 'Looking cool, {name}!': 'Выглядишь круто, {name}!',
  'Wake up. Get up. Get out there.': 'Проснись. Встань. Вперёд.', 'Show me your true form.': 'Покажи своё истинное лицо.',
  'The game is rigged? Rewrite the rules.': 'Игра нечестная? Перепиши правила.', 'You never see it coming.': 'Этого никто не ждёт.',
  'Rebel against a distorted life.': 'Восстань против искажённой жизни.', 'I am thou, thou art I.': 'Я — это ты, а ты — это я.',

  // screens
  Status: 'Статус', 'Who you are today': 'Кто ты сегодня',
  Skills: 'Навыки', 'Grind what matters': 'Прокачивай то, что важно',
  Quests: 'Квесты', 'Habits & missions': 'Привычки и миссии',
  Confidants: 'Доверенные лица', 'The bonds that make you': 'Связи, которые тебя создают',
  Journal: 'Журнал', 'Every step you took': 'Каждый твой шаг',
  Compendium: 'Компендиум', 'Every self you have awakened': 'Все пробуждённые тобой «я»',
  'Velvet Room': 'Бархатная комната', 'Your weekly appraisal': 'Итоги твоей недели',
  Shop: 'Магазин', 'Treat yourself — you earned it': 'Побалуй себя — заслуженно',
  System: 'Система', 'Save, load, config': 'Сохранения и настройки',

  // platform
  'in the Dock': 'в Dock', 'in the tray': 'в трее', Explorer: 'Проводнике', 'file manager': 'файловом менеджере',
  '<kbd>⌘Q</kbd> stops it': '<kbd>⌘Q</kbd> закрывает его',
  'it waits in the tray — Quit from the tray icon stops it': 'оно ждёт в трее — «Выйти» в меню значка закрывает его',
  'macOS blocked them — System Settings → Notifications': 'macOS их блокирует — Системные настройки → Уведомления',
  'Windows blocked them — Settings → System → Notifications': 'Windows их блокирует — Параметры → Система → Уведомления',
  'Notifications are blocked by the system': 'Уведомления заблокированы системой',

  // time of day
  'Late Night': 'Глубокая ночь', 'Early Morning': 'Раннее утро', Morning: 'Утро', Lunchtime: 'Обед',
  Afternoon: 'День', 'After School': 'После учёбы', Evening: 'Вечер',

  // default rewards
  'Episode of anime / a series': 'Серия аниме / сериала', '1 hour of gaming': '1 час игр', 'Cheat meal': 'Читмил',
  'Order food delivery': 'Заказать доставку еды', 'New piece of clothing': 'Новая вещь из одежды',

  // journal labels, toasts, rank-ups
  Unknown: 'Неизвестно', 'Deleted skill': 'Удалённый навык', 'Former confidant': 'Бывшее доверенное лицо',
  yesterday: 'вчера', 'REQUEST ×2': 'ПРОСЬБА ×2', 'FOCUS ×1.5': 'ФОКУС ×1.5', Undo: 'Отменить', UNDONE: 'ОТМЕНЕНО',
  'RANK UP!': 'НОВЫЙ РАНГ!', 'Rank {n} — {name}': 'Ранг {n} — {name}', 'LEVEL UP!': 'НОВЫЙ УРОВЕНЬ!', 'Level {n}': 'Уровень {n}',
  'MAX RANK!': 'МАКС. РАНГ!', 'Confidant Rank {n}': 'Ранг доверенного лица: {n}',
  Weekdays: 'Будни', Weekends: 'Выходные',
  'CLEAR IT NOW?': 'ЗАВЕРШИТЬ СЕЙЧАС?', 'Clear mission': 'Завершить миссию', MISSION: 'МИССИЯ', 'TARGET DOWN': 'ЦЕЛЬ ПОВЕРЖЕНА',
  '{n}d overdue': 'просрочено на {n} дн.', 'due today': 'срок сегодня', '{n} min': '{n} мин', '{n} h': '{n} ч',

  // focus timer
  'TIMER RUNNING': 'ТАЙМЕР ИДЁТ', 'Stop {label} first': 'Сначала останови «{label}»', 'TIMER STARTED': 'ТАЙМЕР ЗАПУЩЕН',
  'WELCOME BACK': 'С ВОЗВРАЩЕНИЕМ',
  'You were away for <b>{min}</b> while the {label} timer kept running.': 'Тебя не было <b>{min}</b>, а таймер «{label}» продолжал идти.',
  'Keep the time': 'Оставить время', 'Remove {min}': 'Убрать {min}', 'TIME REMOVED': 'ВРЕМЯ УБРАНО',
  'Focus timer': 'Таймер фокуса', paused: 'пауза', Resume: 'Продолжить', 'Resume the timer': 'Продолжить таймер',
  Pause: 'Пауза', 'Pause the timer': 'Поставить таймер на паузу', 'Stop and log it': 'Остановить и записать',
  'Stop the timer and log it': 'Остановить таймер и записать', 'click to continue': 'нажми, чтобы продолжить',
  'Do it': 'Да', Cancel: 'Отмена',

  // pickers
  'Social stat only': 'Только качество', '×2 REQ': '×2 ПРОСЬБА',
  '<b>{name}</b> bond +{n}': '<b>{name}</b>: связь +{n}',
  'You get: {parts} · <b>Player +{xp} XP</b>': 'Получишь: {parts} · <b>Игрок +{xp} XP</b>',
  'Pick at least one skill or stat.': 'Выбери хотя бы один навык или качество.',

  // take action
  'TIME’S UP': 'ВРЕМЯ ВЫШЛО', 'TAKE ACTION': 'ДЕЙСТВУЙ',
  'Timer stopped at <b>{clock}</b>. Check what it trained, then log it.': 'Таймер остановлен на <b>{clock}</b>. Проверь, что он прокачал, и запиши.',
  'How did you spend your time? Pick everything it trained.': 'На что ушло время? Отметь всё, что это прокачало.',
  Trains: 'Прокачивает', 'Time <i>(minutes)</i>': 'Время <i>(минуты)</i>',
  'That’s a long session — check the minutes if the timer kept running by mistake.': 'Длинная сессия — проверь минуты, если таймер шёл по ошибке.',
  Effort: 'Усилие', When: 'Когда', Today: 'Сегодня', Yesterday: 'Вчера', 'Earlier…': 'Раньше…', 'Date it happened': 'Когда это было',
  'Note <i>(optional)</i>': 'Заметка <i>(необязательно)</i>', 'Deployed the k8s cluster, finally.': 'Кластер k8s наконец развёрнут.',
  'Discard timer': 'Сбросить таймер', 'Start timer': 'Запустить таймер', 'Log it': 'Записать', 'Spend time': 'Записать время',
  'PICK ONE': 'ВЫБЕРИ', 'Choose at least one skill or stat': 'Выбери хотя бы один навык или качество',
  'PICK A DATE': 'ВЫБЕРИ ДАТУ', 'Up to a year back, not in the future': 'Не больше года назад и не в будущем',

  // skill dialog
  'EDIT SKILL': 'НАВЫК', 'NEW SKILL': 'НОВЫЙ НАВЫК', Name: 'Название', 'Guitar, Cooking, Rust…': 'Гитара, кулинария, Rust…',
  'Icon <i>(optional — none shows the first letters)</i>': 'Иконка <i>(необязательно — без неё будут первые буквы)</i>',
  Letters: 'Буквы', 'Feeds social stat': 'Прокачивает качество', Save: 'Сохранить',

  // entry dialog
  'EDIT ENTRY': 'ЗАПИСЬ',
  'Fix what it trained, the effort or the day — XP, levels and ranks recalculate.': 'Исправь, что прокачалось, усилие или день — XP, уровни и ранги пересчитаются.',
  'Its reward comes from the bond; you can change the note and the day.': 'Награда идёт от связи; можно изменить заметку и день.',
  'Its reward comes from the quest; you can change the note and the day.': 'Награда идёт от квеста; можно изменить заметку и день.',
  Day: 'День', 'PICK A DAY': 'ВЫБЕРИ ДЕНЬ', 'Not in the future': 'Не в будущем', EDITED: 'ИЗМЕНЕНО',

  // quest dialog
  'Next step': 'Следующий шаг', Stage: 'Этап', 'Stage deadline (optional)': 'Срок этапа (необязательно)', 'Remove stage': 'Удалить этап',
  'EDIT QUEST': 'КВЕСТ', 'NEW QUEST': 'НОВЫЙ КВЕСТ', Title: 'Название', 'Meditate 10 minutes': 'Медитация 10 минут', Type: 'Тип',
  Daily: 'Ежедневный', Weekly: 'Еженедельный', Mission: 'Миссия', 'Daily|heading': 'Ежедневные', 'Weekly|heading': 'Еженедельные',
  'resets every day': 'сбрасывается каждый день', 'resets on Monday': 'сбрасывается в понедельник', 'one-time target': 'разовая цель',
  Rewards: 'Награда идёт в', 'Reward size': 'Размер награды', 'Repeat on': 'Повторять по', 'Every day': 'Каждый день',
  'Deadline <i>(missions only, optional)</i>': 'Срок <i>(только для миссий, необязательно)</i>',
  'Stages <i>(optional — break the mission into steps; each pays +{xp} XP)</i>': 'Этапы <i>(необязательно — разбей миссию на шаги; каждый даёт +{xp} XP)</i>',
  '+ Add stage': '+ Добавить этап', 'NO DAYS': 'НЕТ ДНЕЙ', 'Pick at least one day': 'Выбери хотя бы один день',

  // confidant dialogs
  'EDIT CONFIDANT': 'ДОВЕРЕННОЕ ЛИЦО', 'NEW CONFIDANT': 'НОВОЕ ДОВЕРЕННОЕ ЛИЦО', 'Mom, Best friend, Mentor…': 'Мама, лучший друг, наставник…',  Arcana: 'Аркан', 'Time together grows': 'Время вместе прокачивает',
  'Notes <i>(what you know, what they like)</i>': 'Заметки <i>(что ты знаешь о человеке, что он любит)</i>',
  'HANG OUT': 'ВСТРЕЧА', 'Who was there? Everyone you pick grows closer.': 'Кто был рядом? Со всеми отмеченными связь станет крепче.',
  With: 'С кем', 'How deep?': 'Насколько глубоко?',
  'Also trained <i>(optional · their stats are always included)</i>': 'Ещё прокачал <i>(необязательно · их качества учитываются всегда)</i>',
  'What happened <i>(optional)</i>': 'Что было <i>(необязательно)</i>', 'Ramen and a long talk about the future.': 'Рамен и долгий разговор о будущем.',
  'WITH WHOM?': 'С КЕМ?', 'Pick at least one confidant': 'Выбери хотя бы одно доверенное лицо',

  // status
  MAX: 'МАКС', 'Rk {n}': 'Рг {n}', less: 'меньше', more: 'больше', 'RANK {n}': 'РАНГ {n}', 'Mastered. Truly.': 'Освоено. По-настоящему.',
  '{n} pts → {rank}': '{n} очк. → {rank}', TARGET: 'ЦЕЛЬ', BEHIND: 'ОТСТАЁШЬ', 'NEXT:': 'ДАЛЕЕ:', DEADLINE: 'СРОК', TODAY: 'СЕГОДНЯ',
  'NO TARGET': 'НЕТ ЦЕЛИ', 'Send a calling card.': 'Отправь визитную карточку.', 'Set a mission with a deadline →': 'Поставь миссию со сроком →',
  CODENAME: 'КОДОВОЕ ИМЯ', '{into} / {need} XP to next level': '{into} / {need} XP до следующего уровня',
  'Total XP': 'Всего XP', 'Day streak': 'Дней подряд', Actions: 'Действия', "TODAY'S RESULTS": 'ИТОГИ ДНЯ',
  actions: 'действий', dailies: 'ежедневных', 'No daily quests yet.': 'Ежедневных квестов пока нет.',
  'ACTIVITY · LAST 26 WEEKS': 'АКТИВНОСТЬ · 26 НЕДЕЛЬ',

  // skills
  Edit: 'Изменить', Delete: 'Удалить', 'feeds <b>{stat}</b>': 'качает <b>{stat}</b>', 'Focus ×1.5': 'Фокус ×1.5',
  '+{n} today': '+{n} сегодня', '{n} total': '{n} всего', 'Log with a note': 'Записать с заметкой',
  'Stop the timer': 'Остановить таймер', 'Stop the {name} timer': 'Остановить таймер «{name}»',
  'Start a timer': 'Запустить таймер', 'Start a timer for {name}': 'Запустить таймер для «{name}»',

  // quests
  '{done}/{all} stages': 'этапы: {done}/{all}', 'on track': 'в графике', behind: 'отстаёшь',
  'Undo stage: {title}': 'Отменить этап: {title}', 'Complete stage: {title}': 'Выполнить этап: {title}',
  'Complete · +{xp} XP': 'Выполнить · +{xp} XP', Complete: 'Выполнить', 'rest day': 'день отдыха', 'cleared {date}': 'выполнено {date}',
  '+ Add': '+ Добавить', '{done}/{all} today': '{done}/{all} сегодня', 'resets Monday': 'сброс в понедельник',
  'one-time targets': 'разовые цели', Cleared: 'Выполнено', '{n} taken down': 'повержено: {n}', Missions: 'Миссии',
  'Small things, every day. That’s how hearts get stolen.': 'Маленькие дела каждый день. Так и похищают сердца.',
  'Nothing weekly yet.': 'Еженедельных пока нет.',
  'No active missions. Pick a big target and give it a deadline.': 'Активных миссий нет. Выбери большую цель и назначь ей срок.',

  // confidants
  RANK: 'РАНГ', 'Bond complete.': 'Связь завершена.', '{n} more to rank {next}': 'ещё {n} до ранга {next}', 'grows {stat}': 'качает {stat}',
  'last seen today': 'виделись сегодня', 'last seen {n}d ago': 'виделись {n} дн. назад', 'Group hangout': 'Встреча компанией',
  'No confidants yet.': 'Доверенных лиц пока нет.',
  'Friends, family, mentors — the people you want to grow closer to. Each bond has 10 ranks.': 'Друзья, семья, наставники — люди, с которыми хочется стать ближе. У каждой связи 10 рангов.',
  '+ Add your first confidant': '+ Добавить первое доверенное лицо',

  // journal
  ACTION: 'ДЕЙСТВИЕ', QUEST: 'КВЕСТ', STAGE: 'ЭТАП', BOND: 'СВЯЗЬ', VELVET: 'КОМНАТА',
  'Edit entry': 'Изменить запись', 'Delete (undo)': 'Удалить (отменить)', 'Delete entry': 'Удалить запись',
  Log: 'Записи', Calendar: 'Календарь', Charts: 'Графики', 'ACTIVITY · LAST YEAR': 'АКТИВНОСТЬ · ЗА ГОД',
  'Show more ({n} left)': 'Показать ещё (осталось {n})', 'The journal is empty.': 'Журнал пуст.',
  'Press L anywhere to log your first action.': 'Нажми L где угодно, чтобы записать первое действие.', 'Take action': 'Действовать',
  'Deadline:': 'Срок:', 'Nothing logged this day.': 'В этот день записей нет.',
  'Week of {date}': 'Неделя с {date}', '{n} XP in 30 days': '{n} XP за 30 дней', 'XP PER WEEK': 'XP ЗА НЕДЕЛЮ',
  'SOCIAL STATS · TOTAL POINTS': 'КАЧЕСТВА · ВСЕГО ОЧКОВ', 'SKILLS · LAST 30 DAYS': 'НАВЫКИ · 30 ДНЕЙ', 'No skills yet.': 'Навыков пока нет.',
  'No charts yet.': 'Графиков пока нет.',
  'They fill in as you log actions: XP per week, social stat growth, your skills over the last 30 days.': 'Они заполнятся по мере записей: XP по неделям, рост качеств, навыки за последние 30 дней.',

  // system
  PLAYER: 'ИГРОК', Codename: 'Кодовое имя', Language: 'Язык', 'System language': 'Как в системе', 'Sound effects': 'Звуковые эффекты',
  'Global shortcut <kbd>{key}</kbd> opens Take Action from any app': 'Сочетание <kbd>{key}</kbd> открывает «Действуй» из любого приложения',
  'Start at login (quietly, {where})': 'Запускать при входе в систему (тихо, {where})',
  'MORGANA · REMINDERS': 'МОРГАНА · НАПОМИНАНИЯ', 'Unfinished dailies at': 'Невыполненные ежедневные в',
  "“Let's go to sleep” at": '«Пора спать» в', 'Velvet Room on Sundays at 19:00': 'Бархатная комната по воскресеньям в 19:00',
  'Works while Phantom Life is running — closing the window is fine, {quit}. Turn on “Start at login” to never miss one.': 'Работает, пока Phantom Life запущено — окно можно закрыть, {quit}. Включи запуск при входе, чтобы ничего не пропустить.',
  'Test Morgana': 'Проверить Моргану', 'SAVE DATA': 'СОХРАНЕНИЕ',
  'Autosaves locally after every action. A daily backup is kept for 14 days.': 'Сохраняется на компьютере после каждого действия. Ежедневная копия хранится 14 дней.',
  'Export save': 'Экспорт сохранения', 'Import save': 'Импорт сохранения', 'Show in {app}': 'Показать в {app}', 'HOW IT WORKS': 'КАК ЭТО РАБОТАЕТ',
  '<b>Effort</b> — Light +10 · Normal +25 · Heavy +50 · Epic +100 XP.': '<b>Усилие</b> — лёгкое +10 · обычное +25 · тяжёлое +50 · эпичное +100 XP.',
  '<b>Skills</b> level up from XP, and every action also feeds the skill’s <b>social stat</b> (XP ÷ 5).': '<b>Навыки</b> растут от XP, а каждое действие ещё и качает <b>качество</b> навыка (XP ÷ 5).',
  '<b>Social stats</b> rank up at {points} points — just like the game, rank 5 takes real dedication.': '<b>Качества</b> повышают ранг на {points} очках — как в игре, ранг 5 требует настоящего упорства.',
  '<b>Confidants</b> have 10 ranks. Deeper hangouts build the bond faster.': '<b>Доверенные лица</b> — 10 рангов. Чем глубже встречи, тем быстрее крепнет связь.',
  '<b>Velvet Room</b> — review your week, seal a contract (+50 XP) and pick up to 3 focus skills that earn ×1.5 XP the following week.': '<b>Бархатная комната</b> — подведи итоги недели, заключи контракт (+50 XP) и выбери до 3 навыков в фокус: на следующей неделе они дают ×1.5 XP.',
  '<b>Compendium</b> — personas awaken at milestones. <b>Mementos</b> — Morgana’s daily request doubles XP on one skill.': '<b>Компендиум</b> — персоны пробуждаются на важных рубежах. <b>Мементос</b> — ежедневная просьба Морганы удваивает XP одного навыка.',
  '<b>Shop</b> — every XP also pays ¥{yen}. Spend it on rewards you define.': '<b>Магазин</b> — каждый XP приносит ещё и ¥{yen}. Трать их на награды, которые придумаешь сам.',
  'Made a mistake? Delete it in the <b>Journal</b> — everything recalculates.': 'Ошибка? Удали запись в <b>Журнале</b> — всё пересчитается.',
  'Keys: <kbd>1</kbd>–<kbd>8</kbd> switch screens · <kbd>{system}</kbd> System · <kbd>{hotkey}</kbd> take action from anywhere · <kbd>L</kbd> take action · <kbd>Esc</kbd> close.': 'Клавиши: <kbd>1</kbd>–<kbd>8</kbd> экраны · <kbd>{system}</kbd> система · <kbd>{hotkey}</kbd> действие из любого приложения · <kbd>L</kbd> действие · <kbd>Esc</kbd> закрыть.',
  DANGER: 'ОПАСНО', 'Wipe everything and start a new game. Export first if you might want it back.': 'Стереть всё и начать новую игру. Сначала сделай экспорт, если прогресс может понадобиться.',
  'New game': 'Новая игра',

  // velvet room: week in review
  'WEEK IN REVIEW': 'РАЗБОР НЕДЕЛИ', 'No actions logged this week yet.': 'На этой неделе пока нет ни одного действия.',
  '{xp} — {pct} more per day than the week before.': '{xp} — на {pct} больше в день, чем неделей раньше.',
  '{xp} — {pct} less per day than the week before.': '{xp} — на {pct} меньше в день, чем неделей раньше.',
  '{xp} — the same pace as the week before.': '{xp} — тот же темп, что и неделей раньше.',
  '{xp} from {actions}.': '{xp} за {actions}.',
  'Active on {days} days.': 'Активных дней: {days}.', '{n} of {all}': '{n} из {all}', 'Not a day missed.': 'Ни одного пропуска.',
  '{stat} grew the most: +{n}.': 'Больше всего выросло качество {stat}: +{n}.',
  '{skill} earned the most XP ({xp}).': 'Больше всего XP у навыка {skill} ({xp}).',
  'Dailies kept: {pct}.': 'Ежедневные выполнены на {pct}.',
  'Only {pct} of dailies kept — maybe there are too many.': 'Ежедневные выполнены лишь на {pct} — возможно, их слишком много.',
  'Focus skill {skill}: {xp}.': 'Навык в фокусе {skill}: {xp}.', 'Focus skill {skill} got no XP.': 'Навык в фокусе {skill} не получил XP.',
  '{skill} — never practiced yet.': 'Навык {skill} ещё ни разу не прокачивался.', 'No time with {name} yet.': 'С {name} ещё не было встреч.',
  'Deadline today: {title}.': 'Срок сегодня: {title}.', 'Next stage of {mission} is due today: {step}.': 'Следующий этап миссии {mission} — сегодня: {step}.',
  '{title} is behind schedule.': 'Миссия {title} отстаёт от графика.',
  'On tired or sick days you earned <b>{pct}% less XP</b>.': 'В дни усталости или болезни XP было на <b>{pct}% меньше</b>.',
  'Your pace held up on rough days too.': 'Даже в тяжёлые дни темп не падал.',
  'This week’s contract is sealed.': 'Контракт на эту неделю заключён.',
  'Fill in the contract below and pick next week’s focus skills.': 'Заполни контракт ниже и выбери навыки в фокус на следующую неделю.',

  // velvet room: page
  AMENDED: 'ИЗМЕНЕНО', 'The contract has been rewritten': 'Контракт переписан',
  'Weekly contract · week of {date}': 'Контракт недели · неделя с {date}', 'SEALED!': 'ЗАКЛЮЧЁН!', 'Focus: {names}': 'Фокус: {names}',
  'Previous week': 'Предыдущая неделя', 'WEEK OF': 'НЕДЕЛЯ С', 'Next week': 'Следующая неделя', 'Share week': 'Поделиться неделей',
  'Appraised · Grade {g}': 'Оценено · {g}', 'Awaiting appraisal': 'Ждёт оценки', LEDGER: 'СЧЁТ',
  'XP per day vs previous week': 'XP в день по сравнению с прошлой неделей', 'active days': 'активных дней', 'dailies kept': 'ежедневных выполнено',
  'STAT GROWTH': 'РОСТ КАЧЕСТВ', 'STRONGEST ARTS': 'СИЛЬНЕЙШИЕ НАВЫКИ', 'Nothing yet.': 'Пока ничего.', 'THE CONTRACT': 'КОНТРАКТ',
  'Reflect, then bind yourself to the week ahead.': 'Подумай — и свяжи себя обязательством на новую неделю.',
  'Grade this week': 'Оценка недели', 'What went well?': 'Что получилось?', 'Shipped the feature. Slept 8h.': 'Фича выпущена. Сон по 8 часов.',
  'What held you back?': 'Что мешало?', 'Doomscrolling after midnight.': 'Думскроллинг после полуночи.',
  'Next week, I will…': 'На следующей неделе я…', 'Train 4 times. Finish chapter 3.': 'Потренируюсь 4 раза. Дочитаю 3 главу.',
  'Focus arts for next week <i>— up to 3 · they earn ×{mult} XP</i>': 'Навыки в фокусе на следующую неделю <i>— до 3 · они дают ×{mult} XP</i>',
  'Sealed {date}. You may amend it.': 'Заключён {date}. Его можно изменить.', 'Sealing the contract grants +50 XP.': 'Контракт даёт +50 XP.',
  'Amend contract': 'Изменить контракт', 'Seal the contract': 'Заключить контракт', 'PAST CONTRACTS': 'ПРОШЛЫЕ КОНТРАКТЫ', 'No notes.': 'Без заметок.',
  'MAX 3': 'МАКС. 3', 'Choose at most three focus arts': 'В фокусе может быть не больше трёх навыков',

  // week card
  '{pct}% dailies kept': 'ежедневных выполнено: {pct}%', 'XP this week': 'XP за неделю', '{n}/7 days': 'дней: {n}/7', '{n}-day streak': 'серия {n} дн.',
  GRADE: 'ОЦЕНКА', 'TOP SKILLS': 'ЛУЧШИЕ НАВЫКИ', 'No skills trained': 'Навыки не прокачивались', 'SOCIAL STATS': 'КАЧЕСТВА',
  "NEXT WEEK'S FOCUS": 'ФОКУС СЛЕДУЮЩЕЙ НЕДЕЛИ', 'SHARE THE WEEK': 'ПОДЕЛИСЬ НЕДЕЛЕЙ',
  'A 1080×1080 image of your week. Numbers only — your Velvet Room notes stay private.': 'Картинка 1080×1080 с итогами недели. Только цифры — заметки из Бархатной комнаты останутся при тебе.',
  'Week of {date}: +{xp} XP over {n} active days': 'Неделя с {date}: +{xp} XP, активных дней: {n}',
  Close: 'Закрыть', 'Save PNG': 'Сохранить PNG', 'Copy image': 'Копировать', COPIED: 'СКОПИРОВАНО', SAVED: 'СОХРАНЕНО',
  'Paste it anywhere with {key}': 'Вставь куда угодно через {key}', 'Week card saved': 'Карточка недели сохранена',
  ERROR: 'ОШИБКА', 'Could not make the image': 'Не удалось создать картинку',

  // shop
  'EDIT REWARD': 'НАГРАДА', 'NEW REWARD': 'НОВАЯ НАГРАДА', Reward: 'Награда', 'Movie night, new headphones…': 'Вечер кино, новые наушники…',
  'Price <i>(¥{yen} per XP · a normal action ≈ ¥{normal})</i>': 'Цена <i>(¥{yen} за XP · обычное действие ≈ ¥{normal})</i>', Icon: 'Иконка',
  'One-time purchase (a big thing you buy once)': 'Разовая покупка (что-то крупное, что покупаешь один раз)',
  'NOT ENOUGH ¥': 'НЕ ХВАТАЕТ ¥', '{yen} more to go': 'Не хватает {yen}', 'BUY THIS?': 'КУПИТЬ?',
  '{name} for {price}. You earned it, {player}.': '{name} за {price}. Заслуженно, {player}.', 'Buy · {price}': 'Купить · {price}',
  'Thank you, come again!': 'Спасибо, заходи ещё!', 'one-time': 'разовая', 'bought ×{n}': 'куплено ×{n}', OWNED: 'КУПЛЕНО',
  '{yen} to go': 'ещё {yen}', Buy: 'Купить', WALLET: 'КОШЕЛЁК', 'earned today': 'заработано сегодня', 'spent all-time': 'потрачено всего',
  'per XP': 'за XP', Receipts: 'Чеки', 'last {n}': 'последние {n}', BOUGHT: 'КУПЛЕНО', 'Refund (undo)': 'Вернуть (отменить)',

  // condition, Mementos
  CONDITION: 'САМОЧУВСТВИЕ', 'Feeling {cond} today.': 'Сегодня: {cond}.', 'How do you feel today?': 'Как ты сегодня?',
  Great: 'Отлично', Good: 'Хорошо', Tired: 'Усталость', Sick: 'Болею',
  "{name} has never been practiced. Today's the day.": 'Навык {name} ещё ни разу не прокачивался. Сегодня — самое время.',
  'Keep {name} going today. Momentum is everything.': 'Не бросай навык {name} и сегодня. Главное — не сбавлять ход.',
  'MEMENTOS REQUEST': 'ПРОСЬБА ИЗ МЕМЕНТОСА', 'From Morgana': 'От Морганы',
  '✓ Cleared · double XP claimed': '✓ Выполнено · двойной XP получен', 'Reward: ×2 XP on that skill': 'Награда: ×2 XP на этот навык',
  'Take it on': 'Взяться',

  // compendium
  COMPENDIUM: 'КОМПЕНДИУМ', 'NEW PERSONA': 'НОВАЯ ПЕРСОНА', 'Awakened {date}': 'Пробуждена {date}', 'personas awakened': 'персон пробуждено',
  'Log your first action': 'Запиши первое действие', 'Keep a 7-day streak': 'Продержи серию 7 дней',
  'Spend time with a confidant': 'Проведи время с доверенным лицом', 'Clear a Mementos request': 'Выполни просьбу из Мементоса',
  'Seal your first Velvet contract': 'Заключи первый контракт в Бархатной комнате', 'Buy your first reward': 'Купи первую награду',
  'Clear a mission': 'Выполни миссию', 'Log an Epic action': 'Запиши эпичное действие',
  'Reach Guts rank 3': 'Смелость — ранг 3', 'Reach Charm rank 3': 'Обаяние — ранг 3', 'Reach Knowledge rank 3': 'Знания — ранг 3',
  'Reach Proficiency rank 3': 'Сноровка — ранг 3', 'Reach Kindness rank 3': 'Доброта — ранг 3',
  'Hang out with two confidants at once': 'Встреться сразу с двумя доверенными лицами', 'Log 50 actions': 'Запиши 50 действий',
  'Get a skill to level 10': 'Прокачай навык до 10 уровня', 'Reach confidant rank 5': 'Доверенное лицо — ранг 5',
  'Earn 300 XP in a single day': 'Набери 300 XP за один день', 'Get five skills to level 5': 'Прокачай пять навыков до 5 уровня',
  'Log 200 actions': 'Запиши 200 действий', 'Keep a 30-day streak': 'Продержи серию 30 дней', 'Clear 5 missions': 'Выполни 5 миссий',
  'Clear a mission with 5+ stages': 'Выполни миссию из 5+ этапов', 'Clear 20 Mementos requests': 'Выполни 20 просьб из Мементоса',
  'Seal 10 Velvet contracts': 'Заключи 10 контрактов', 'Max out a confidant (rank 10)': 'Доверенное лицо на максимуме (ранг 10)',
  'Max out any social stat': 'Любое качество на максимуме', 'Reach player level 30': 'Достигни 30 уровня',
  'Max out all five social stats': 'Все пять качеств на максимуме',

  // character creation
  'Your life is the game. Take your time.': 'Твоя жизнь — это игра. Не торопись.', Start: 'Начать', 'Load a save file': 'Загрузить сохранение',
  'Back to my game': 'Вернуться к своей игре', 'WHO ARE YOU?': 'КТО ТЫ?',
  'Pick a codename — it’s what the game calls you. You can change it later in System.': 'Выбери кодовое имя — так тебя будет звать игра. Его можно сменить позже в Системе.',
  'WHAT WILL YOU TRAIN?': 'ЧТО БУДЕШЬ КАЧАТЬ?',
  'Pick the parts of your life you want to grow. Each one becomes a skill that levels up as you log time on it — 3 to 6 is a good start.': 'Выбери, в чём хочешь расти. Каждая область станет навыком, который растёт, когда ты записываешь на него время. Для начала хватит 3–6.',
  'Life areas': 'Области жизни', 'Your skills': 'Твои навыки', 'Name of skill {name}': 'Название навыка {name}', 'feeds {stat}': 'качает {stat}',
  'Remove {name}': 'Убрать {name}', 'Nothing picked yet — choose above, or add your own.': 'Пока ничего не выбрано — отметь выше или добавь своё.',
  'Something else? Guitar, Chess, Rust…': 'Что-то ещё? Гитара, шахматы, Rust…', 'Your own skill': 'Свой навык',
  'Social stat it feeds': 'Какое качество качает', Add: 'Добавить', 'Take quest: {title}': 'Взять квест: {title}', 'Quest title': 'Название квеста',
  'FIRST QUESTS': 'ПЕРВЫЕ КВЕСТЫ',
  'Habits that pay XP each time you tick them off. Start small — you can add more on the Quests screen any time.': 'Привычки, которые приносят XP каждый раз, когда ты их отмечаешь. Начни с малого — добавить ещё можно в любой момент на экране Квестов.',
  'No suggestions for your own skills — add quests for them on the Quests screen.': 'Для своих навыков подсказок нет — добавь им квесты на экране Квестов.',
  'Your own skills get their quests on the Quests screen.': 'Квесты для своих навыков добавляются на экране Квестов.',
  'READY?': 'ВСЁ ГОТОВО?',
  'Morgana nudges you when dailies are still open and when it’s time for bed. Change these any time in System.': 'Моргана напомнит о невыполненных ежедневных и о том, что пора спать. Время можно поменять в Системе.',
  'Dailies reminder': 'Напоминание о ежедневных', Bedtime: 'Отбой', 'You start with {skills} and {quests}.': 'На старте: {skills} и {quests}.',
  'First move: log something you did today.': 'Первый ход: запиши любое дело за сегодня.', 'No skills yet': 'Навыков пока нет',
  '+{n} more': 'ещё {n}', 'Character creation': 'Создание персонажа', Back: 'Назад', Next: 'Далее',
  'Pick at least one thing to train.': 'Выбери хотя бы одну область.', 'WELCOME, {name}': 'ДОБРО ПОЖАЛОВАТЬ, {name}',
  'Your story starts now': 'Твоя история начинается', 'Who are you': 'Кто ты', 'What you train': 'Что качаешь', 'First quests': 'Первые квесты', Ready: 'Готово',
  Study: 'Учёба', Reading: 'Чтение', Languages: 'Языки', Coding: 'Программирование', Career: 'Карьера', Finance: 'Финансы',
  Cooking: 'Кулинария', Fitness: 'Фитнес', Running: 'Бег', 'Health & Sleep': 'Здоровье и сон', Music: 'Музыка',
  'Art & Design': 'Рисование и дизайн', Writing: 'Тексты', Style: 'Стиль', 'Social Life': 'Общение', 'Helping Others': 'Помощь людям',
  Family: 'Семья', Mindfulness: 'Осознанность',
  'Study for 45 minutes': 'Позаниматься 45 минут', "Review the week's notes": 'Повторить конспекты за неделю', 'Read 20 pages': 'Прочитать 20 страниц',
  '15 minutes of practice': '15 минут практики', 'Talk with a native speaker': 'Поговорить с носителем языка', 'Push a commit': 'Запушить коммит',
  'Ship something small': 'Выпустить что-то небольшое', 'Finish the most important task': 'Закончить самую важную задачу',
  'Plan next week': 'Спланировать следующую неделю', "Log today's spending": 'Записать траты за день', 'Review the budget': 'Пересмотреть бюджет',
  'Cook a real meal': 'Приготовить нормальную еду', 'Try a new recipe': 'Попробовать новый рецепт', 'Work out': 'Тренировка',
  'Go for a run': 'Пробежка', 'Long run': 'Длинная пробежка', 'Lights out on time': 'Лечь спать вовремя', 'Drink 2 liters of water': 'Выпить 2 литра воды',
  'Practice for 30 minutes': 'Позаниматься 30 минут', 'Sketch something': 'Сделать набросок', 'Finish a piece': 'Закончить работу',
  'Write 300 words': 'Написать 300 слов', 'Plan outfits for the week': 'Продумать образы на неделю', 'Meet up with a friend': 'Встретиться с другом',
  'Help someone out': 'Помочь кому-нибудь', 'Call family': 'Позвонить родным', 'Meditate for 10 minutes': 'Медитация 10 минут',
  'Journal before bed': 'Записать мысли перед сном',
  Sports: 'Спорт', 'Push a commit on a side project': 'Запушить коммит в пет-проект', // the sample character

  // save files
  'That file is not valid JSON': 'Этот файл — не корректный JSON', 'Not a Phantom Life save': 'Это не сохранение Phantom Life',
  'LOAD SAVE?': 'ЗАГРУЗИТЬ?', Load: 'Загрузить', LOADED: 'ЗАГРУЖЕНО', 'Welcome back, {name}': 'С возвращением, {name}', 'Welcome back': 'С возвращением',
  'Export written': 'Экспорт сохранён',

  // sidebar, page
  'The Velvet Room awaits': 'Бархатная комната ждёт', Notifications: 'Уведомления',

  // icon names (tooltips in the icon pickers)
  code: 'код', terminal: 'терминал', server: 'сервер', cloud: 'облако', gear: 'шестерёнка', monitor: 'монитор', bolt: 'молния',
  dumbbell: 'гантель', ball: 'мяч', mountain: 'гора', sword: 'меч', shield: 'щит', flame: 'пламя', book: 'книга',
  cap: 'шапочка выпускника', bulb: 'лампочка', pen: 'ручка', globe: 'глобус', chat: 'чат', mask: 'маска', shirt: 'футболка',
  crown: 'корона', star: 'звезда', heart: 'сердце', users: 'люди', music: 'музыка', mic: 'микрофон', camera: 'камера',
  brush: 'кисть', gamepad: 'геймпад', chart: 'график', money: 'деньги', briefcase: 'портфель', utensils: 'приборы',
  leaf: 'лист', moon: 'луна', target: 'мишень',

  // confirmations
  'DELETE SKILL?': 'УДАЛИТЬ НАВЫК?', '“{name}” will be removed.': 'Навык «{name}» будет удалён.',
  'Social stat points you earned stay.': 'Заработанные очки качеств останутся.',
  'DISCARD TIMER?': 'СБРОСИТЬ ТАЙМЕР?', '{label} · {clock} won’t be logged.': '{label} · {clock} не попадёт в журнал.', Discard: 'Сбросить',
  'TIMER DISCARDED': 'ТАЙМЕР СБРОШЕН', 'DELETE QUEST?': 'УДАЛИТЬ КВЕСТ?',
  '“{title}” will be removed. XP already earned stays in your journal.': 'Квест «{title}» будет удалён. Уже заработанный XP останется в журнале.',
  'END THIS BOND?': 'РАЗОРВАТЬ СВЯЗЬ?',
  '{name} will be removed from your confidants. Their journal entries stay.': '{name} исчезнет из доверенных лиц. Записи в журнале останутся.',
  Remove: 'Удалить', 'UNDO THIS?': 'ОТМЕНИТЬ?',
  'Remove “{label}” (+{xp} XP) from {date}? Levels and ranks recalculate.': 'Удалить «{label}» (+{xp} XP) за {date}? Уровни и ранги пересчитаются.',
  'REMOVE REWARD?': 'УБРАТЬ НАГРАДУ?', '“{name}” will leave the shop. Past receipts stay.': '«{name}» исчезнет из магазина. Старые чеки останутся.',
  'REFUND?': 'ВЕРНУТЬ?', 'Undo buying “{name}” and get {price} back.': 'Отменить покупку «{name}» и вернуть {price}.', Refund: 'Вернуть',
  'IN 5 SECONDS': 'ЧЕРЕЗ 5 СЕКУНД', 'Switch to another app to see the banner': 'Переключись на другое приложение, чтобы увидеть уведомление',
  'NO NOTIFICATIONS': 'УВЕДОМЛЕНИЙ НЕТ', 'NEW GAME?': 'НОВАЯ ИГРА?',
  'You’ll create a new character. Your current progress is replaced when you press Start — until then you can go back. Export it first if you might want it later.': 'Ты создашь нового персонажа. Текущий прогресс заменится, когда нажмёшь «Начать», — до этого можно вернуться. Сделай экспорт, если прогресс может пригодиться.',
  Continue: 'Продолжить', 'CODENAME SET': 'ИМЯ ИЗМЕНЕНО', 'SHORTCUT TAKEN': 'СОЧЕТАНИЕ ЗАНЯТО', '{key} is used by another app': '{key} занято другим приложением',
};
