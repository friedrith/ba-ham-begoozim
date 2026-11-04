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
type Env = {
  ROOMS: { idFromName(name: string): unknown; get(id: unknown): RoomStub }
  CREATE_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> }
}
type DurableContext = {
  acceptWebSocket(socket: WebSocket): void
  getWebSockets(): HibernatingSocket[]
  setWebSocketAutoResponse(pair: unknown): void
  blockConcurrencyWhile(callback: () => Promise<void>): Promise<void>
  storage: {
    get<T>(key: string): Promise<T | undefined>
    put(
      key: string,
      value: unknown,
      options?: { allowUnconfirmed: boolean },
    ): Promise<void>
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
const ALLOWED_ORIGIN =
  /^(https:\/\/ba-ham-begoozim((-[a-z0-9-]+)?-interaction-dynamics)?\.vercel\.app|http:\/\/localhost:\d+)$/

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
  }

  constructor(
    private readonly ctx: DurableContext,
    _env: Env,
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
