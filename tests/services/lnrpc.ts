/* ~~/tests/services/lnrpc.ts */

// imports


import fs from 'fs'
import grpc from '@grpc/grpc-js'
import { lnd } from 'τ/configs'
import * as protoLoader from '@grpc/proto-loader'

// setup lnd rpc

// consts
let loaderOptions: any = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
}

let packageDefinition = protoLoader.loadSync(lnd.protoPath, loaderOptions)
let protoDescriptor = grpc.loadPackageDefinition(packageDefinition)

export type LightningService = {
  addInvoice: Function
  decodePayReq: Function
  getInfo: Function
  getTransactions: Function
  listChannels: Function
  newAddress: Function
  queryRoutes: Function
  sendPayment: Function
}
// @ts-ignore
export const LnRpc = protoDescriptor.lnrpc as { Lightning: Constructable<LightningService> }

// override process env var
process.env.GRPC_SSL_CIPHER_SUITES = 'HIGH+ECDSA'

let lndCert = fs.readFileSync(lnd.tlsCertPath)
let sslCreds = grpc.credentials.createSsl(lndCert)

let macaroon = fs.readFileSync(lnd.macaroonPath).toString('hex')
let macaroonCreds = grpc.credentials.createFromMetadataGenerator((_, callback) => {
  let metadata = new grpc.Metadata()
  metadata.add('macaroon', macaroon)
  callback(null, metadata)
})
export const Creds = grpc.credentials.combineChannelCredentials(sslCreds, macaroonCreds)

// trying to unlock the wallet:
// if (config.lnd.password) {
//   process.env.VERBOSE && console.log('trying to unlock the wallet')
//   var walletUnlocker = new lnrpc.WalletUnlocker(config.lnd.url, creds)
//   walletUnlocker.unlockWallet(
//     {
//       wallet_password: Buffer.from(config.lnd.password).toString('base64'),
//     },
//     function (err, response) {
//       if (err) {
//         process.env.VERBOSE && console.log('unlockWallet failed, probably because its been aleady unlocked')
//       } else {
//         console.log('unlockWallet:', response)
//       }
//     },
//   )
// }

export default { Creds, LnRpc }
