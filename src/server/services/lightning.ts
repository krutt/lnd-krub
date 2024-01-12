/* ~~/src/server/services/lightning.ts */

// imports
import { lnd } from '@/configs'
import {
  CallCredentials,
  ChannelCredentials,
  ChannelOptions,
  GrpcObject,
  Metadata,
  credentials,
  loadPackageDefinition,
} from '@grpc/grpc-js'
import { PackageDefinition, loadSync } from '@grpc/proto-loader'
import { promisify } from 'node:util'
import { readFileSync } from 'node:fs'

// consts
const loaderOptions = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
}
const packageDefinition: PackageDefinition = loadSync(lnd.protoPath, loaderOptions)
const protoDescriptor: GrpcObject = loadPackageDefinition(packageDefinition)
interface LnSvc {
  LnSvc: LnSvc
  new (url: string, creds: ChannelCredentials, options: ChannelOptions): LnSvc
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
  sendPaymentSync: Function
  sendToRouteSync: Function
}
interface UnlockSvc {
  Unlocker: UnlockSvc
  new (url: string, cred: ChannelCredentials, options: ChannelOptions): UnlockSvc
  unlockWallet: Function
}
const LnRpc = protoDescriptor.lnrpc as { Lightning?: LnSvc; WalletUnlocker?: UnlockSvc }

export class LightningService extends LnRpc.Lightning {
  constructor(
    host: string = lnd.host,
    macaroonPath: string = lnd.macaroonPath,
    port: number = lnd.port,
    tlsCertPath: string = lnd.tlsCertPath
  ) {
    let lndCert: Buffer = readFileSync(tlsCertPath)
    let sslCreds: ChannelCredentials = credentials.createSsl(lndCert)
    let macaroon: string = readFileSync(macaroonPath).toString('hex')
    let macaroonCreds: CallCredentials = credentials.createFromMetadataGenerator((_, callback) => {
      let metadata: Metadata = new Metadata()
      metadata.add('macaroon', macaroon)
      callback(null, metadata)
    })
    let creds: ChannelCredentials = credentials.combineChannelCredentials(sslCreds, macaroonCreds)
    let options: ChannelOptions = {
      'grpc.max_receive_message_length': 20_000_000,
    }
    super(`${host}:${port}`, creds, options)
  }
}

export class WalletUnlocker extends LnRpc.WalletUnlocker {
  constructor(
    host: string = lnd.host,
    macaroonPath: string = lnd.macaroonPath,
    port: number = lnd.port,
    tlsCertPath: string = lnd.tlsCertPath
  ) {
    let lndCert: Buffer = readFileSync(tlsCertPath)
    let sslCreds: ChannelCredentials = credentials.createSsl(lndCert)
    let macaroon: string = readFileSync(macaroonPath).toString('hex')
    let macaroonCreds: CallCredentials = credentials.createFromMetadataGenerator((_, callback) => {
      let metadata: Metadata = new Metadata()
      metadata.add('macaroon', macaroon)
      callback(null, metadata)
    })
    let creds: ChannelCredentials = credentials.combineChannelCredentials(sslCreds, macaroonCreds)
    let options: ChannelOptions = {
      'grpc.max_receive_message_length': 20_000_000,
    }
    super(`${host}:${port}`, creds, options)
  }
}
if (!!lnd.password) {
  console.log('Unlocking wallet...')
  let unlocker: WalletUnlocker = new WalletUnlocker()
  let wallet_password = Buffer.from(lnd.password).toString('base64')
  promisify(unlocker.unlockWallet)
    .bind(unlocker)({ wallet_password })
    .then(response => {
      console.log('unlockWallet:', response)
    })
    .catch(console.error)
}

export default LnRpc.Lightning
