/* ~~/src/server/stores/index.ts */

// imports
import { BitcoinService } from '@/server/services/bitcoin'
import { CacheService } from '@/server/services/cache'
import { LightningService } from '@/server/services/lightning'

// exports
export const bitcoin = new BitcoinService()
export const cache = new CacheService()
export const lightning = new LightningService()
