# Phantom Life

A Persona 5 styled life tracker for macOS. Treat your life like an RPG: skills level up,
social stats rank up, confidants deepen, missions have deadlines.

## Run

```bash
npm install
npm start
```

Build a standalone app (drag it into /Applications):

```bash
npm run install_app   # builds and copies Phantom Life.app into /Applications
```

## How it works

- **Take action** (`L`): pick every skill (or social stat) the activity trained, plus an effort
  level — Light +10 · Normal +25 · Heavy +50 · Epic +100 XP. Each chosen skill gets the full XP;
  each social stat is credited once even if several chosen skills feed it; player XP counts once.
- **Skills** level up from XP. Each skill feeds one **social stat** (XP ÷ 5 points).
- **Social stats** — Knowledge, Guts, Proficiency, Kindness, Charm — have 5 ranks with the
  in-game rank names, at 40 / 120 / 280 / 560 points.
- **Quests**: daily (with streaks, optionally on chosen weekdays only), weekly (reset Monday), and one-off **missions** with
  deadlines that show up as a calling card on the Status screen.
- **Confidants**: people you want to grow closer to. 10 ranks each, pick their arcana. Time
  together always grows their stat and can also train any skills you pick. One meeting can
  include several confidants — each gets full bond points.
- **Velvet Room**: weekly appraisal. Igor reviews your week (XP pace, stat growth, neglected
  skills, distant confidants, upcoming deadlines). Grade the week, reflect, and seal a contract
  (+50 XP) choosing up to 3 **focus skills** that earn ×1.5 XP the following week.
- **Shop**: every XP also pays ¥10. Define your own rewards (repeatable or one-time) and buy
  them with what you earned. Receipts can be refunded.
- **Morgana**: macOS reminders for unfinished dailies, bedtime and the Sunday Velvet Room — they
  run in the background while the app is open (window closed is fine). Times are set in System.
- **Global shortcut** `⌘⇧L` opens Take Action from any app.
- **Compendium**: 28 personas that awaken at milestones (streaks, ranks, missions, contracts…).
- **Mementos requests**: each day Morgana picks a neglected skill — the first action on it earns ×2 XP.
- **Condition**: log how you feel each day; Igor points out how it affects your output.
- **Journal**: full history + yearly heatmap, a P5-style month calendar, and charts (XP per week,
  social stat growth, skills over the last 30 days). Delete an entry to undo it — every level and
  rank is recalculated from the journal.

Keys: `1`–`8` switch screens · `⌘,` System · `⌘⇧L` take action from anywhere · `L` take action · `⌘↵` submit · `Esc` close.

## Data

Saved to `~/Library/Application Support/Phantom Life/save.json` after every action, with a
daily backup (last 14 days) in `backups/`. Export/import from the System screen.
