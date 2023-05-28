// ~~/src/server/models/Lock.ts

// imports
import type Redis from 'ioredis'

export class Lock {
  _redis: Redis
  _lock_key: string

  /**
   *
   * @param {String} lock_key
   * @param {Redis} redis
   */
  constructor(lock_key: string, redis: Redis) {
    this._redis = redis
    this._lock_key = lock_key
  }

  /**
   * Tries to obtain lock in single-threaded Redis.
   * Returns TRUE if success.
   *
   * @returns {Promise<boolean>}
   */
  async obtainLock() {
    const timestamp = +new Date()
    let setResult = await this._redis.setnx(this._lock_key, timestamp)
    if (!setResult) {
      // it already held a value - failed locking
      return false
    }

    // success - got lock
    await this._redis.expire(this._lock_key, 5 * 60)
    // lock expires in 5 mins just for any case
    return true
  }

  async releaseLock() {
    await this._redis.del(this._lock_key)
  }
}

export default Lock
