// ~~/src/server/models/Lock.ts

// imports
import type { CacheService } from '@/server/services/cache'

export class Lock {
  _cache: CacheService
  _lock_key: string

  /**
   *
   * @param {CacheService} cache
   * @param {String} lock_key
   */
  constructor(cache: CacheService, lock_key: string) {
    this._cache = cache
    this._lock_key = lock_key
  }

  /**
   * Tries to obtain lock in single-threaded Redis.
   * Returns TRUE if success.
   *
   * @returns {Promise<boolean>}
   */
  obtainLock = async () => {
    const timestamp = +new Date()
    let setResult = await this._cache.setnx(this._lock_key, timestamp)
    if (!setResult) {
      // it already held a value - failed locking
      return false
    }

    // success - got lock
    await this._cache.expire(this._lock_key, 5 * 60)
    // lock expires in 5 mins just for any case
    return true
  }

  /**
   * Releases the lock set on redis
   */
  releaseLock = async () => {
    await this._cache.del(this._lock_key)
  }
}

export default Lock
