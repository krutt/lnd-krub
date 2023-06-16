// ~~/tests/configs.ts

export const externalLND = {
  host: process.env.LND_TARGET_HOST || 'localhost',
  macaroonPath: process.env.LND_TARGET_MACAROON_PATH || './target.macaroon',
  port: parseInt(process.env.LND_TARGET_PORT || '10010'),
  protoPath: './public/rpc.proto',
  tlsCertPath: process.env.LND_TARGET_TLSCERT_PATH || './target.cert',
}

export default { externalLND }
