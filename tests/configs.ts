// ~~/tests/configs.ts

import 'dotenv/config'
export const lnd = {
  host: process.env.LND_SERVICE_HOST || 'localhost',
  password: '',
  port: parseInt(process.env.LND_SERVICE_PORT || '10009'),
  protoPath: process.env.NODE_ENV === 'production' ? './dist/rpc.proto' : './public/rpc.proto',
}

export default { lnd }
