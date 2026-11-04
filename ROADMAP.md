# Roadmap

Listed in the order we plan to build them.

## 1. Deploy to Vercel

Put the game online under the `interaction-dynamics` Vercel account.

- [x] Create the project under `interaction-dynamics` and link it to this repo
- [x] Deploy `master` to production and each PR to a preview URL
- [x] Add the live URL to the README

**Done when** merging to `master` updates the live game without manual steps.

## 2. GitHub Actions

Nothing checks a PR today. The scripts already exist, so this only needs wiring.

- [x] Run on every PR and on pushes to `master`, using Bun
- [x] Run `bun run ci` (lint and format check), `bun run typecheck`, `bun test`
      and `bun run build`
- [x] Make the checks required before merging to `master`

Deployment stays with Vercel. Actions only checks the code.

**Done when** a PR with a lint error, type error or unbeatable level can't merge.

## 3. More levels

There are three levels today. Add more with a steadily rising difficulty curve,
then introduce original content once the existing hazards are used up.

- [x] **Harder levels:** new courses using the existing hazards, with narrower
      channels, tighter pars, and hazards combined in tougher ways
- [x] **New content:** new themes (`Theme`) and new hazards (`LevelItem`), each
      with its own rendering, sound and a level that teaches it
- [x] Rework the menu so it stays readable with many levels

The test suite runs a bot through every level, so a course it can't finish fails.
Harder levels will probably need a better bot in `engine/autopilot.ts`. It must
not become easier to pass by weakening that test.

**Done when** the last level is clearly harder than `The Boiler Room`, and at
least one level uses a theme and a hazard that don't exist today.

## 4. iPad version (touch)

Four corner pads already exist, but they are small, always visible, and labelled
with keyboard keys. The goal is a version that feels made for a shared tablet.

- [x] Detect a touch screen and turn on touch mode only then
- [x] In touch mode, touching a screen corner triggers that bean's blast, with a
      tap target large enough for four people sharing one iPad
- [x] Hide the keyboard labels and adapt the menu hints in touch mode
- [x] Keep the current layout on devices without a touch screen
- [ ] Test on a real iPad: four simultaneous touches, sound unlocking on first
      touch, no page zoom or scroll, portrait and landscape

**Done when** four people can finish a level on one iPad without a keyboard.

## 5. Online co-op

Let players on different devices share one tub, with each player taking one or
more seats.

- [x] **Spike first:** choose the transport and test how latency feels in play
- [x] Rooms: create one, join with a short code or link, choose seats
- [x] Sync the game between players
- [x] Handle latency, disconnects and rejoining, and fill empty seats with the
      local player or the bot
- [x] Retune or scale the harmony window, which depends on near-simultaneous
      blasts and will be the first thing latency breaks. The window stays 140ms
      but compares press times, and four people have finished a level with it.
- [x] Deploy the [room service](workers/rooms/README.md) and measure it on real
      Cloudflare
- [x] Let players name themselves, in the room or from the pause menu

Design notes:

- The engine has no DOM dependency, so it can also run on a server.
- The fixed 120 Hz step in `stepWorld` makes its inputs easy to send over a
  network. Prefer one authoritative simulation over lockstep, because `Math.sin`
  and `Math.exp` aren't guaranteed to match across browsers.
- This is the only item that needs a backend. The spike should compare Vercel
  WebSockets with a managed realtime service, including how a room stays on one
  instance.

**Done when** four players on separate devices can finish a level together over
a normal internet connection.

## 6. Second language: Persian

Offer the whole game in Persian alongside English.

- [x] Move all player-facing text into translation files, including level names,
      blurbs and hints from `engine/levels.ts`
- [ ] Translate into Persian and have a native speaker review the humour
- [x] Pick the language from the browser, with a switcher that remembers the choice
- [x] Support right-to-left layout in the menu, HUD and panels, and add a Persian
      font that suits the game's style
- [x] Show numbers such as times and pars in Persian digits
- [x] Keep the on-screen key labels matching the keys players must press on a
      Persian keyboard (input already uses physical key positions)

**Done when** a Persian speaker can play from the menu to the last level without
seeing English or broken layout.
