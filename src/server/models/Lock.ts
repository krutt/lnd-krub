// ~~/src/server/models/Lock.ts

// imports
import type { CacheService } from '@/server/services/cache'

export class Lock {
  cache: CacheService
  lock_key: string

  /**
   *
   * @param {CacheService} cache
   * @param {String} lock_key
   */
  constructor(cache: CacheService, lock_key: string) {
    this.cache = cache
    this.lock_key = lock_key
  }

  /**
   * Tries to obtain lock in single-threaded Redis.
   * Returns TRUE if success.
   *
   * @returns {Promise<boolean>}
   */
  obtainLock = async () => {
    const timestamp = +new Date()
    let setResult = await this.cache.setnx(this.lock_key, timestamp)
    if (!setResult) {
      // it already held a value - failed locking
      return false
    }

    // success - got lock
    await this.cache.expire(this.lock_key, 5 * 60)
    // lock expires in 5 mins just for any case
    return true
  }

  /**
   * Releases the lock set on redis
   */
  releaseLock = async () => {
    await this.cache.del(this.lock_key)
  }
}

export default Lock
