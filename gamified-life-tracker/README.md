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
npm run package   # → dist/Phantom Life-darwin-arm64/Phantom Life.app
```

## How it works

- **Take action** (`L`): pick a skill (or a social stat directly) and an effort level —
  Light +10 · Normal +25 · Heavy +50 · Epic +100 XP.
- **Skills** level up from XP. Each skill feeds one **social stat** (XP ÷ 5 points).
- **Social stats** — Knowledge, Guts, Proficiency, Kindness, Charm — have 5 ranks with the
  in-game rank names, at 40 / 120 / 280 / 560 points.
- **Quests**: daily (with streaks), weekly (reset Monday), and one-off **missions** with
  deadlines that show up as a calling card on the Status screen.
- **Confidants**: people you want to grow closer to. 10 ranks each, pick their arcana.
- **Journal**: full history + yearly heatmap. Delete an entry to undo it — every level and
  rank is recalculated from the journal.

Keys: `1`–`6` switch screens · `L` take action · `⌘↵` submit · `Esc` close.

## Data

Saved to `~/Library/Application Support/Phantom Life/save.json` after every action, with a
daily backup (last 14 days) in `backups/`. Export/import from the System screen.
