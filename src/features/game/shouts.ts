/**
 * What a player can shout at their team. Rooms only pass these ids along, so nobody has
 * to moderate what strangers type, and everyone reads a shout in their own language.
 */
export const SHOUT_IDS = [
  'more',
  'stop',
  'together',
  'left',
  'right',
  'sorry',
  'nice',
] as const

export type ShoutId = (typeof SHOUT_IDS)[number]

export function isShoutId(value: unknown): value is ShoutId {
  return SHOUT_IDS.includes(value as ShoutId)
}
