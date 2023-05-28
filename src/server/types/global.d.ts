declare module 'process' {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        readonly BTC_RPC_URL: string
        readonly LND_MACAROON_PATH: string
        readonly LND_TLSCERT_PATH: string
        readonly NODE_ENV?: 'development' | 'production'
        readonly PORT: string
      }
    }
  }
}
