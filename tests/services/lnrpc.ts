/* ~~/tests/services/lnrpc.ts */

// imports

import fs from 'fs'
import grpc, { ChannelCredentials } from '@grpc/grpc-js'
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
  sendPaymentSync: Function
}
// @ts-ignore
export const LnRpc = protoDescriptor.lnrpc as { Lightning: Constructable<LightningService> }

// override process env var
process.env.GRPC_SSL_CIPHER_SUITES = 'HIGH+ECDSA'

export const createLNDCreds = (macaroonPath: string, tlsCertPath: string): ChannelCredentials => {
  let lndCert = fs.readFileSync(tlsCertPath)
  let sslCreds = grpc.credentials.createSsl(lndCert)
  let macaroon = fs.readFileSync(macaroonPath).toString('hex')
  let macaroonCreds = grpc.credentials.createFromMetadataGenerator((_, callback) => {
    let metadata = new grpc.Metadata()
    metadata.add('macaroon', macaroon)
    callback(null, metadata)
  })
  return grpc.credentials.combineChannelCredentials(sslCreds, macaroonCreds)
}

export default { LnRpc, createLNDCreds }
