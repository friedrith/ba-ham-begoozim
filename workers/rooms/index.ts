import {
  CLOSE_ABUSE,
  CLOSE_CODES,
  HEARTBEAT,
} from '../../src/features/online/protocol'
import {
  newRoom,
  Room,
  type Peer,
  type RoomHost,
  type SavedRoom,
} from '../../src/features/online/room'

// Just the parts of the Workers runtime used here. @cloudflare/workers-types would
// replace the DOM's global types for the whole project, including the game's.
type HibernatingSocket = WebSocket & {
  serializeAttachment(value: unknown): void
  deserializeAttachment(): unknown
}
type RoomStub = {
  fetch(request: Request | string, init?: RequestInit): Promise<Response>
}
type Namespace = { idFromName(name: string): unknown; get(id: unknown): RoomStub }
type Env = {
  ROOMS: Namespace
  PLAYERS: Namespace
  CREATE_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> }
}
type DurableContext = {
  acceptWebSocket(socket: WebSocket): void
  getWebSockets(): HibernatingSocket[]
  setWebSocketAutoResponse(pair: unknown): void
  blockConcurrencyWhile(callback: () => Promise<void>): Promise<void>
  storage: {
    get<T>(key: string): Promise<T | undefined>
    list<T>(): Promise<Map<string, T>>
    put(
      key: string,
      value: unknown,
      options?: { allowUnconfirmed: boolean },
    ): Promise<void>
    delete(key: string): Promise<boolean>
    setAlarm(time: number): Promise<void>
    deleteAll(): Promise<void>
    deleteAlarm(): Promise<void>
  }
}
declare const WebSocketPair: new () => { 0: WebSocket; 1: HibernatingSocket }
declare const WebSocketRequestResponsePair: new (
  request: string,
  response: string,
) => unknown

const TICK_MS = 16
/** How long a room with nobody in it waits for someone to come back. */
const EMPTY_ROOM_MS = 60 * 60_000
const STORAGE_KEY = 'room'
const CODE = /^\d{6}$/
const CREATE_ATTEMPTS = 5
/** A room with people in it reports at least hourly, at its alarm. */
const REPORT_EXPIRES_MS = 2 * EMPTY_ROOM_MS + 5 * 60_000
const PLAYERS_NAME = 'all'
type RoomReport = { count: number; at: number }
const ALLOWED_ORIGIN =
  /^(https:\/\/(gooz\.zendegi\.io|ba-ham-begoozim((-[a-z0-9-]+)?-interaction-dynamics)?\.vercel\.app)|http:\/\/localhost:\d+)$/

/**
 * One room, on one machine, near whoever created it. The object hibernates between
 * races, and a pending timer is what keeps it awake during one. Timers are chained
 * rather than a `setInterval` because the runtime limits how long one timer can live,
 * and the players' pings are what stop a racing room counting as idle and being evicted.
 */
export class RoomObject {
  private room: Room | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly wrappers = new WeakMap<HibernatingSocket, Peer>()

  private readonly host: RoomHost = {
    // Frozen between I/O in here, which is fine: every tick is a timer firing.
    now: () => Date.now(),
    peers: () =>
      this.ctx
        .getWebSockets()
        .filter((socket) => socket.readyState === WebSocket.OPEN)
        .map((socket) => this.peer(socket)),
    // A lost checkpoint costs a few seconds of a race, so sends needn't wait for one.
    save: (room: SavedRoom) => {
      void this.ctx.storage.put(STORAGE_KEY, room, { allowUnconfirmed: true })
    },
    setTicking: (on: boolean) => {
      if (this.timer) clearTimeout(this.timer)
      this.timer = on ? setTimeout(this.tick, TICK_MS) : null
    },
    // The count is only for show, so a failure here must never reach the game.
    reportPlayers: (code: string, count: number) => {
      const counter = this.env.PLAYERS.get(
        this.env.PLAYERS.idFromName(PLAYERS_NAME),
      )
      void counter
        .fetch('https://players/report', {
          method: 'POST',
          body: JSON.stringify({ code, count }),
        })
        .catch(() => {})
    },
  }

  constructor(
    private readonly ctx: DurableContext,
    private readonly env: Env,
  ) {
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(HEARTBEAT, HEARTBEAT),
    )
    void ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<SavedRoom>(STORAGE_KEY)
      if (saved) this.room = new Room(this.host, saved)
    })
  }

  async fetch(request: Request) {
    if (request.method === 'POST') {
      const { code } = (await request.json()) as { code: string }
      if (this.room) return new Response(null, { status: 409 })
      const saved = newRoom(code)
      // Confirmed before the code is handed out, unlike the checkpoints.
      await this.ctx.storage.put(STORAGE_KEY, saved)
      await this.ctx.storage.setAlarm(Date.now() + EMPTY_ROOM_MS)
      this.room = new Room(this.host, saved)
      return new Response(null, { status: 201 })
    }

    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1])
    // Browsers can't read why an upgrade failed, so this has to be said over a socket.
    if (!this.room) {
      pair[1].send(JSON.stringify({ t: 'error', code: 'missing' }))
      pair[1].close(CLOSE_CODES.missing, 'missing')
    }
    return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit)
  }

  webSocketMessage(socket: HibernatingSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') {
      socket.close(CLOSE_ABUSE, 'text only')
      return
    }
    this.room?.receive(this.peer(socket), message)
  }

  async webSocketClose(socket: HibernatingSocket) {
    await this.closed(socket)
  }

  async webSocketError(socket: HibernatingSocket) {
    await this.closed(socket)
  }

  async alarm() {
    // Clears the count of anyone whose socket died with no close event, like in a deploy.
    this.room?.reportPlayers()
    if (this.host.peers().length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + EMPTY_ROOM_MS)
      return
    }
    this.host.setTicking(false)
    this.room = null
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
  }

  private async closed(socket: HibernatingSocket) {
    this.room?.left(this.peer(socket))
    if (this.host.peers().length === 0) {
      await this.ctx.storage.setAlarm(Date.now() + EMPTY_ROOM_MS)
    }
  }

  private readonly tick = () => {
    if (!this.room || this.timer === null) return
    this.room.tick()
    // Ticking can turn itself off at the finish, which clears the timer.
    if (this.timer !== null) this.timer = setTimeout(this.tick, TICK_MS)
  }

  /** The token lives on the socket, because sockets outlive this object's memory. */
  private peer(socket: HibernatingSocket) {
    let peer = this.wrappers.get(socket)
    if (!peer) {
      peer = {
        get token() {
          return (socket.deserializeAttachment() as string | null) ?? null
        },
        set token(token) {
          socket.serializeAttachment(token)
        },
        send: (text) => {
          // The socket may have closed with its close event still on the way.
          try {
            socket.send(text)
          } catch {}
        },
        close: (code, reason) => {
          try {
            socket.close(code, reason)
          } catch {}
        },
      }
      this.wrappers.set(socket, peer)
    }
    return peer
  }
}

/**
 * How many people are in rooms right now, across all of them. There is one of these, and
 * it's told by the rooms rather than asking them, so a look at the menu wakes no room.
 */
export class PlayerCountObject {
  private rooms = new Map<string, RoomReport>()

  constructor(private readonly ctx: DurableContext) {
    void ctx.blockConcurrencyWhile(async () => {
      this.rooms = await ctx.storage.list<RoomReport>()
    })
  }

  async fetch(request: Request) {
    if (request.method === 'POST') {
      const { code, count } = (await request.json()) as {
        code: string
        count: number
      }
      if (count > 0) {
        const report = { count, at: Date.now() }
        this.rooms.set(code, report)
        await this.ctx.storage.put(code, report)
      } else {
        this.rooms.delete(code)
        await this.ctx.storage.delete(code)
      }
      return new Response(null, { status: 204 })
    }

    let players = 0
    for (const [code, { count, at }] of this.rooms) {
      if (Date.now() - at < REPORT_EXPIRES_MS) {
        players += count
      } else {
        this.rooms.delete(code)
        await this.ctx.storage.delete(code)
      }
    }
    return Response.json({ players })
  }
}

function randomCode() {
  const [value] = crypto.getRandomValues(new Uint32Array(1))
  return String(value % 1_000_000).padStart(6, '0')
}

function corsHeaders(origin: string | null): Record<string, string> {
  return origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}
}

async function createRoom(
  request: Request,
  env: Env,
  cors: Record<string, string>,
) {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const limit = await env.CREATE_LIMIT?.limit({ key: ip })
  if (limit && !limit.success)
    return new Response(null, { status: 429, headers: cors })

  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = randomCode()
    const room = env.ROOMS.get(env.ROOMS.idFromName(code))
    const created = await room.fetch('https://room/init', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
    if (created.ok) return Response.json({ code }, { status: 201, headers: cors })
  }
  return new Response(null, { status: 503, headers: cors })
}

export default {
  async fetch(request: Request, env: Env) {
    // Stops other sites using this service from their pages. Anything that isn't a
    // browser can send what it likes here, which is why rooms trust nothing they receive.
    const origin = request.headers.get('origin')
    if (origin !== null && !ALLOWED_ORIGIN.test(origin)) {
      return new Response(null, { status: 403 })
    }
    const cors = corsHeaders(origin)
    const { pathname } = new URL(request.url)

    if (pathname === '/rooms') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors })
      }
      if (request.method === 'POST') return createRoom(request, env, cors)
      return new Response(null, { status: 405, headers: cors })
    }

    if (pathname === '/players') {
      if (request.method !== 'GET') {
        return new Response(null, { status: 405, headers: cors })
      }
      const counter = env.PLAYERS.get(env.PLAYERS.idFromName(PLAYERS_NAME))
      const answer = await counter.fetch('https://players/count')
      return Response.json(await answer.json(), {
        headers: { ...cors, 'Cache-Control': 'no-store' },
      })
    }

    const code = /^\/rooms\/([^/]+)\/ws$/.exec(pathname)?.[1]
    if (
      code &&
      CODE.test(code) &&
      request.method === 'GET' &&
      request.headers.get('upgrade') === 'websocket'
    ) {
      // The whole answer to "how does a room stay on one machine".
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request)
    }
    return new Response(null, { status: 404, headers: cors })
  },
}
