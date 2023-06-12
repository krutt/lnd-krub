// ~~/src/server/services/lightning.ts

// imports
import { lnd } from '@/configs'
import * as grpc from '@grpc/grpc-js'
import fs from 'fs'
import * as protoLoader from '@grpc/proto-loader'

// setup lnd rpc

// consts
let loaderOptions = {
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
  describeGraph: Function
  getInfo: Function
  getTransactions: Function
  listChannels: Function
  listInvoices: Function
  listPayments: Function
  lookupInvoice: Function
  newAddress: Function
  queryRoutes: Function
  sendPayment: Function
  sendToRouteSync: Function
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

export default new LnRpc.Lightning(`${lnd.host}:${lnd.port}`, Creds)
