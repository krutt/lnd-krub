// ~~/src/server/services/lightning.ts

// imports
import { Redis } from 'ioredis'
import { redis } from '@/configs'

export class CacheService extends Redis {
  constructor(configurations: { db: number; family: number; host: string; port: number } = redis) {
    super(configurations)
  }
}

export default CacheService
