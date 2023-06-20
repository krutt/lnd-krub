// ~~/tests/configs.ts

export const externalLND = {
  host: process.env.LND_TARGET_HOST || 'localhost',
  macaroonPath: process.env.LND_TARGET_MACAROON_PATH || './external.macaroon',
  port: parseInt(process.env.LND_TARGET_PORT || '10010'),
  protoPath: './public/rpc.proto',
  tlsCertPath: process.env.LND_TARGET_TLSCERT_PATH || './external.cert',
}

export default { externalLND }
