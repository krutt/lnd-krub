// ~~/tests/configs.ts

import 'dotenv/config'
export const lnd = {
  host: process.env.LND_SERVICE_HOST || 'localhost',
  macaroonPath: process.env.LND_MACAROON_PATH || './admin.macaroon',
  password: '',
  port: parseInt(process.env.LND_SERVICE_PORT || '10009'),
  protoPath: './public/rpc.proto',
  tlsCertPath: process.env.LND_TLSCERT_PATH || './tls.cert',
}

export default { lnd }
