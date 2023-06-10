// ~~/src/configs.ts

const isProduction: boolean = process.env.NODE_ENV === 'production'
if (!isProduction) {
  let dotenv = require('dotenv')
  dotenv.config()
}

export const bitcoind = { rpc: process.env.BITCOIND_RPC_URL }
export const enableUpdateDescribeGraph = false
export const forwardReserveFee = 0.01 // default 0.01
export const intraHubFee = 0.003 // default to 0.003
export const lnd = {
  host: process.env.LND_SERVICE_HOST || 'localhost',
  macaroonPath: process.env.LND_MACAROON_PATH || './admin.macaroon',
  password: '',
  port: parseInt(process.env.LND_SERVICE_PORT || '10009'),
  protoPath: isProduction ? './dist/rpc.proto' : './public/rpc.proto',
  tlsCertPath: process.env.LND_TLSCERT_PATH || './tls.cert',
}
export const postRateLimit = 100
export const rateLimit = 200
export const redis = {
  port: parseInt(process.env.REDIS_PORT || '6379'),
  host: process.env.REDIS_HOST || 'localhost',
  family: 4,
  db: 0,
}
export const sunset = false

export default {
  enableUpdateDescribeGraph,
  forwardReserveFee,
  intraHubFee,
  lnd,
  postRateLimit,
  rateLimit,
  redis,
  sunset,
}
