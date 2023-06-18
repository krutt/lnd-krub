/* ~~/src/server/stores/dashblob.ts */

// imports
import { Dashblob } from '@/types'
import { lightning } from '@/server/stores'
import { promisify } from 'node:util'

export const loadNodeInformation = async (): Promise<Dashblob | void> =>
  await promisify(lightning.getInfo).bind(lightning)({}).catch(console.error)
