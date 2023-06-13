// ~~/tests/configs.ts

export const bitcoind = {
  rpc: process.env.BITCOIND_RPC_URL || 'http://localhost:18443',
}

export const lnd = {
  host: process.env.LND_SERVICE_HOST || 'localhost',
  macaroonPath: process.env.LND_MACAROON_PATH || './admin.macaroon',
  port: parseInt(process.env.LND_SERVICE_PORT || '10009'),
  protoPath: './public/rpc.proto',
  tlsCertPath: process.env.LND_TLSCERT_PATH || './tls.cert',
}

export const lndTarget = {
  host: process.env.LND_TARGET_HOST || 'localhost',
  macaroonPath: process.env.LND_TARGET_MACAROON_PATH || './target.macaroon',
  port: parseInt(process.env.LND_TARGET_PORT || '10010'),
  protoPath: './public/rpc.proto',
  tlsCertPath: process.env.LND_TARGET_TLSCERT_PATH || './target.cert',
}

export default { lnd, lndTarget }
