/* ~~/src/index.ts */

// imports
import { BitcoinService } from '@/server/services/bitcoin'
import { CacheService } from '@/server/services/cache'
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import bodyParser from 'body-parser'
import cors from '@/server/middlewares/cors'
import express, { Express, Response, Router } from 'express'
import helmet from 'helmet'
import identifiable from '@/server/middlewares/identifiable'
import { loadNodeInformation } from '@/server/stores/dashblob'
import morgan from 'morgan'
import { postRateLimit, prodFaucet, rateLimit } from '@/configs'
import rateLimiter from 'express-rate-limit'

// services
let bitcoin: BitcoinService = new BitcoinService()
let cache: CacheService = new CacheService()

// run-time constants
const isProduction = process.env.NODE_ENV === 'production'

// define app
let app: Express = express()

// middlewares
app.enable('trust proxy')
app.use(helmet.hsts())
app.use(helmet.hidePoweredBy())
app.use(rateLimiter({ max: rateLimit || 200, windowMs: 15 * 60 * 1000 }))

/**
 * special rate limiter for POST endpoints
 */
let postLimiter = rateLimiter({ max: postRateLimit || 100, windowMs: 30 * 60 * 1000 })

app.use(identifiable)
morgan.token('uuid', (request: LNDKrubRequest) => request.uuid)
app.use(
  morgan(
    ':uuid :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
  )
)
/**
 * parse application/x-www-form-urlencoded
 */
app.use(bodyParser.urlencoded({ extended: false }))
/**
 * parse application/json
 */
app.use(bodyParser.json(null))
app.use(cors)

// api routes
let router: Router = Router()
import authenticate from '@/server/routes/authenticate.route'
import addInvoice from '@/server/routes/addInvoice.route'
import balance from '@/server/routes/balance.route'
import bitcoinAddress from '@/server/routes/bitcoinAddress.route'
import channelInfo from '@/server/routes/channelInfo.route'
import channels from '@/server/routes/channels.route'
import checkPayment from '@/server/routes/checkPayment.route'
import checkRouteInvoice from '@/server/routes/checkRouteInvoice.route'
import createAccount from '@/server/routes/createAccount.route'
import dashboard from '@/server/routes/dashboard.route'
import decodeInvoice from '@/server/routes/decodeInvoice.route'
import faucet from '@/server/routes/faucet.route'
import info from '@/server/routes/info.route'
// import nostrWalletConnect from '@/server/routes/nostrWalletConnect.route'
import pendingTransactions from '@/server/routes/pendingTransactions.route'
import payInvoice from '@/server/routes/payInvoice.route'
// import queryRoutes from '@/server/routes/queryRoutes.route'
import transactions from '@/server/routes/transactions.route'
import userInvoices from '@/server/routes/userInvoices.route'
router.post('/auth', postLimiter, authenticate)
router.post('/addinvoice', postLimiter, addInvoice)
router.get('/balance', postLimiter, balance)
router.get('/channels', channels)
router.get('/checkpayment/:payment_hash', checkPayment)
router.get('/checkrouteinvoice', checkRouteInvoice)
router.post('/create', postLimiter, createAccount)
router.get('/decodeinvoice', postLimiter, decodeInvoice)
router.get('/getbtc', bitcoinAddress)
router.get('/getchaninfo/:channelId', channelInfo)
router.get('/getinfo', postLimiter, info)
router.get('/getpending', postLimiter, pendingTransactions)
router.get('/gettxs', postLimiter, transactions)
router.get('/getuserinvoices', postLimiter, userInvoices)
// router.post('/nwc', postLimiter, nostrWalletConnect)
router.post('/payinvoice', postLimiter, payInvoice)
// router.get('/queryroutes/:source/:dest/:amt', queryRoutes)

/**
 * production: limit dashboard endpoint with cross-site request forgery protection
 */
if (isProduction) {
  let cookieParser = require('cookie-parser')
  app.use(cookieParser(process.env.COOKIE_SECRET))
  let csurf = require('tiny-csrf')
  app.use(csurf(process.env.CSRF_SECRET, ['PUT']))
}
router.put('/dashboard', dashboard)

/**
 * enable faucet endpoint if development environment or production faucet set to true
 */
if (!isProduction || prodFaucet) router.post('/faucet', faucet)

app.use('/', router)

// ######################## SMOKE TESTS ########################
app.on('event:startup', () => {
  const MIN_BTC_BLOCK = 670000
  bitcoin
    .getBlockchainInfo()
    .then(info => {
      if (info && info.result && info.result.blocks) {
        if (info.result.chain === 'mainnet' && info.result.blocks < MIN_BTC_BLOCK) {
          console.error('bitcoind is not caught up')
          process.exit(1)
        }
        // console.log('bitcoind getblockchaininfo:', info)
      }
    })
    .catch(err => {
      console.error('bitcoind failure:', err)
      process.exit(2)
    })
  loadNodeInformation()
    .then(info => {
      if (info && !info.synced_to_chain) {
        console.error('lnd not synced')
        // TODO: uncomment
        // process.exit(4);
      }
    })
    .catch(err => {
      // console.error('lnd failure')
      console.dir(err)
      process.exit(3)
    })
  cache.info(function (err, info) {
    if (err || !info) {
      console.error('cache failure')
      process.exit(5)
    }
  })
  // @ts-ignore
  cache.monitor(function (err, monitor) {
    if (!monitor) return
    // @ts-ignore
    monitor.on('monitor', function (time, args, source, database) {
      // console.log('REDIS', JSON.stringify(args))
    })
  })
})

if (require.main === module) {
  let port: number = parseInt(process.env.PORT || '3000')
  if (isProduction) {
    let rootDir = process.cwd() + '/dist'
    // front-end
    app.get('/', (request: LNDKrubRequest, response: Response) => {
      let req: LNDKrubRequest & { csrfToken?: Function } = request
      let csrfToken: string | undefined = !!req.csrfToken ? req.csrfToken() : void 0
      response.cookie('xsrf-token', csrfToken).sendFile('index.html', { root: rootDir })
    })
    // static files
    app.use(express.static(rootDir))
    // listen
    app.listen(port, () => {
      app.emit('event:startup')
      console.log(`Server is listening on port ${port}...`)
    })
  } else {
    const ViteExpress = require('vite-express')
    ViteExpress.listen(app, port, () => {
      app.emit('event:startup')
      console.log(`Dev-server is listening on port ${port}...`)
    })
  }
}

export default app
