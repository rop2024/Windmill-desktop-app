const BASE_URL = 'https://api.chess.com/pub'

export type ChessComGame = {
  uuid: string
  pgn: string
  time_control: string
  end_time: number
  rated: boolean
  tcn: string
  white: {
    username: string
    rating: number | null
    result: string
    '@id': string
  }
  black: {
    username: string
    rating: number | null
    result: string
    '@id': string
  }
  eco: string | null
  opening: string | null
  accuracies?: { white: number; black: number }
}

export type ChessComArchives = {
  archives: string[]
}

export type ChessComPlayer = {
  username: string
  player_id: number
  status: string
  name: string | null
  location: string | null
  title: string | null
  followers: number
  avatar: string | null
}

function fetchWithTimeout(url: string, timeoutMs = 30000, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  return fetch(url, {
    headers: {
      'User-Agent': 'ChessDesktop/1.0.1 (chess desktop application)'
    },
    signal: controller.signal
  }).finally(() => {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  })
}

export class ChessComService {
  private username: string

  constructor(username: string, private readonly signal?: AbortSignal) {
    this.username = username
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${BASE_URL}${path}`
    const res = await fetchWithTimeout(url, 30000, this.signal)
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Chess.com player not found: ${this.username}`)
      }
      if (res.status === 429) {
        throw new Error('Chess.com rate limit exceeded. Please try again later.')
      }
      throw new Error(`Chess.com API error: ${res.status} ${res.statusText}`)
    }
    return (await res.json()) as T
  }

  async getPlayer(): Promise<ChessComPlayer> {
    return this.request<ChessComPlayer>(`/player/${encodeURIComponent(this.username)}`)
  }

  async getArchives(): Promise<string[]> {
    const data = await this.request<ChessComArchives>(
      `/player/${encodeURIComponent(this.username)}/games/archives`
    )
    return Array.isArray(data.archives) ? data.archives : []
  }

  async getGamesForMonth(year: number, month: number): Promise<ChessComGame[]> {
    const data = await this.request<{ games: ChessComGame[] }>(
      `/player/${encodeURIComponent(this.username)}/games/${year}/${String(month).padStart(2, '0')}`
    )
    return Array.isArray(data.games) ? data.games : []
  }
}

export function injectSourceHeader(pgn: string): string {
  const sourceTag = '[Source "online"]'
  if (pgn.includes(sourceTag)) return pgn
  return `${sourceTag}\n${pgn}`
}