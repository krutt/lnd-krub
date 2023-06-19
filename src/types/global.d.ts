/* ~~/src/types/global.d.ts */

declare module 'process' {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        readonly BITCOIND_RPC_URL: string
        readonly COOKIE_SECRET: string
        readonly CSRF_SECRET: string
        readonly LND_MACAROON_PATH: string
        readonly LND_SERVICE_HOST: string
        readonly LND_SERVICE_PORT: string
        readonly LND_TLSCERT_PATH: string
        readonly NODE_ENV?: 'development' | 'production'
        readonly PORT: string
        readonly REDIS_HOST: string
        readonly REDIS_PORT: string
      }
    }
  }
}
