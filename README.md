# Ba Ham Begoozim

A couch co-op browser game. Four baked beans share one clawfoot bathtub, and the
only engine on board is what the beans had for lunch. Everyone blasts from their
own corner, so steering takes teamwork.

Play it at <https://ba-ham-begoozim.vercel.app>.

## Running it

```bash
bun install && bun dev
```

## Controls

| Seat        | Key | Effect                      |
| ----------- | --- | --------------------------- |
| Front left  | `Q` | Pushes back, turns left     |
| Front right | `P` | Pushes back, turns right    |
| Rear left   | `Z` | Pushes forward, turns right |
| Rear right  | `M` | Pushes forward, turns left  |

Playing solo? `←` and `→` work the rear seats and `↓` works both front seats. On
a touch screen each bean owns a quarter of the screen: hold your corner to blast.
`Esc` pauses, `R` restarts.

Blast within a blink of another bean for a **harmony**: a bigger shove, a little
gas back, and a chord.

## How it's built

- `src/features/game/engine` — deterministic, DOM-free simulation and levels.
- `src/features/game/render` — Canvas 2D scene, particles and the WebAudio synth.
- `src/features/game/components` — menu, HUD and the game loop.

`bun test` runs a bot through every level, so a course that can't be finished
fails the suite. The same bot drives the demo behind the menu.
