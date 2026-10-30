import { Game } from '@shared/game'

export type IPCChannels = {
  'app.getVersion': { args: []; returns: Promise<string> }
  'db.ping': { args: []; returns: Promise<{ ok: true; data: { version: number } } | { ok: false; error: unknown }> }
  'games.getAll': { args: { filters?: Partial<import('@shared/game').GameFilters> }; returns: Promise<{ ok: true; data: Game[] } | { ok: false; error: unknown }> }
  'games.getById': { args: [id: string]; returns: Promise<{ ok: true; data: Game } | { ok: false; error: unknown }> }
  'games.create': { args: [game: Omit<Game, 'id' | 'createdAt' | 'updatedAt'>]; returns: Promise<{ ok: true; data: Game } | { ok: false; error: unknown }> }
}

export type IPCChannelName = keyof IPCChannels

export type IPCArgs<C extends IPCChannelName> = IPCChannels[C]['args']
export type IPCReturn<C extends IPCChannelName> = IPCChannels[C]['returns']
