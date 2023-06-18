/* ~~/src/server/stores/channel.ts */

// imports
import { Channel } from '@/types'
import { cache, lightning } from '@/server/stores'
import { promisify } from 'node:util'

// constants
const KEY: string = 'lightning_channels'
const TTL: number = 120000

/**
 * Fetches a list of channels connected to LND instance either from LRU or from LND instance itself
 * @returns {Channel[]} list of channels connected to LND instance
 */
export const listChannels = async (): Promise<Channel[]> => {
  let channels: Channel[] = JSON.parse(await cache.get(KEY))
  if (!channels || channels.length == 0) {
    let info = await promisify(lightning.listChannels).bind(lightning)({}).catch(console.error)
    if (info) {
      channels = info.channels
      /*await */ cache.setex(KEY, TTL, JSON.stringify(channels))
    }
  }
  return channels
}

/**
 * Unsets the cached list of channels connected LND instance
 * @returns {Number}
 */
export const releaseChannelList = async (): Promise<number> => await cache.del(KEY)
