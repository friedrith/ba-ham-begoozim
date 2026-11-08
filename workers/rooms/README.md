# Room service

Online play's backend: one Cloudflare Durable Object per room, each running the real
game engine at 120 Hz and sending snapshots to its players at 30 Hz. The game itself
stays on Vercel, and hides online play unless `NEXT_PUBLIC_ROOMS_URL` is set.

`index.ts` is only the Cloudflare wrapper. The room itself is `Room` in
`src/features/online/room.ts`, which doesn't know where it runs, so it can be tested
with plain objects and moved to another host by replacing this one file.

## Why it works this way

- **A server runs the simulation, not a player's browser.** Browsers throttle hidden
  tabs, so one player switching tabs would freeze everyone, and no player should be
  special when someone drops out.
- **A Durable Object rather than Vercel WebSockets,** because a room code maps to
  exactly one object. Vercel can't route sockets to a particular instance, so every
  message would have to cross Redis, at about 50 times the cost.
- **Harmony compares press times, not arrival times.** Each client stamps its presses
  with a synced clock. Unequal ping is what breaks harmony, not ping: at 15ms and
  100ms, players trying to press together get 59% by arrival and 95% by press time.
  The window stays 140ms, since widening it to 280ms makes 58% of unrelated presses
  count as harmony.
- **Clients predict their own seats,** so a press moves the tub at once. Bots holding
  all four seats stay level up to 500ms round trip with prediction, and start to
  struggle at about 150ms without. Teammates' blasts can't be predicted, so the tub
  drifts slightly until they arrive, by about 12px at 20ms and 90ms.
- **Rooms report their player counts to one `PlayerCountObject`,** and the menu reads the
  total from `GET /players` once a minute, so looking at the menu never wakes a room. A
  count can stay too high for up to an hour if a room dies without its sockets closing,
  which lasts until that room's alarm next fires.

Press times trust the client, within a 250ms limit. This is co-op, so the worst a
cheat can do is help the team.

## Running it locally

```bash
bun run rooms:dev
```

Then `bun dev` in another terminal, which finds it through `.env.development`. Open a
room in two windows, since each tab counts as its own player. For a slow network, add
`&lag=100&jitter=20` to the URL, and `&debug=1` shows the round trip and the room's
largest gap between ticks. `lag` works only in development.

## Deploying

The free plan is enough to start. It fails rather than bills when it runs out.

1. Create a Cloudflare account, then run `bunx wrangler@4.157.0 login`.
2. Run `bun run rooms:deploy`, which prints the service's URL. If Cloudflare refuses
   the `ratelimits` block in `wrangler.jsonc`, delete it: creating rooms then has no
   rate limit, and everything else works the same.
3. Measure it, ideally from two places:

   ```bash
   bun workers/rooms/probe.ts https://your-service.workers.dev 40
   ```

   Look at `snapshotGapMs`, measured where the snapshots arrive. They should come about
   every 33ms, and a worst case above about 100ms would be felt in play. Don't rely on
   `roomTickGapMs`, because a Worker's clock only moves on I/O. If snapshots aren't
   steady, the fallback is one always-on Fly.io machine, at about $3 a month, by writing
   a new host for `Room`.

4. Set `NEXT_PUBLIC_ROOMS_URL` to that URL in the Vercel project, then redeploy the
   game. Without this step, nobody sees online play.

The service refuses pages from any other site, so a new domain for the game has to be
added to `ALLOWED_ORIGIN` in `index.ts` and the service deployed again. It answers those
pages with a 403.

To deploy on every merge, add the repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`, and set the repository variable `ROOMS_DEPLOY` to `true`.

## Limits and cost

| Thing               | Limit                                                |
| ------------------- | ---------------------------------------------------- |
| Devices in a room   | 8                                                    |
| Messages            | 200 a second per device, 512 characters each         |
| A dropped seat      | Kept for its owner; a bot drives it after 15 seconds |
| A race nobody plays | Back to the lobby after 5 minutes                    |
| An empty room       | Deleted after an hour                                |

A race costs about $0.006 per room-hour. The free plan covers about 29 room-hours a
day, and the $5 paid plan includes 889 a month. Lobbies hibernate and cost almost
nothing, which is why a room stops its timer whenever nobody is racing.

## When the game and the service disagree

They deploy separately, so `PROTOCOL` in `src/features/online/protocol.ts` hashes the
snapshot layout and the levels. A client that doesn't match is told to refresh. Bump
`PROTOCOL_VERSION` when messages change in a way the hash can't see.

A Durable Object can restart at any time, including for a deploy. Rooms save every 5
seconds during a race, and clients reconnect by themselves, so players lose at most a
few seconds. Taking the local service down mid-race is a good way to test this.

## What hasn't been tested

- **Real Cloudflare, barely.** The probe has run from one place only, with all four
  bots in one process. Over two runs of 40 trials, harmony was 98% and 95%, with 30
  snapshots a second and round trips of about 50ms at the median and 122-134ms at p95.
  Snapshots still arrive in bursts: about one gap in 20 reaches 100ms, and the worst
  were 138ms and 153ms. Against a local service the same probe has a p95 gap of 39ms,
  so the bursts aren't the probe's, but they could be the room's timers or the network.
  Whether players feel them is for a playtest to say.
- **Packet loss hasn't been tried.** WebSockets run over TCP, so a lost packet holds up
  everything behind it.
- **Harmony rates with people.** Four people on separate devices have finished a level,
  but their harmony rate wasn't measured. The simulated rates assume a 50ms spread in
  player timing and a cue outside the game, like counting aloud. Syncing off the screen,
  where each player sees the same moment at a different time, drops harmony to 82% at
  20ms and 90ms, and 62% at 15ms and 100ms.
- **Bots filling seats beside real people.** Bots finish every run of the first six
  levels beside a simulated person, but that person copies the bot's own plan with a
  delay. An idle person in a rear seat stops the tub from getting anywhere.
