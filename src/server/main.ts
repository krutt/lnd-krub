// ~~/src/server/main.js

// imports
import Redis from 'ioredis'
import bodyParser from 'body-parser'
import express, { Express, Response, Router } from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { promisify } from 'node:util'
import { postRateLimit, rateLimit, redis as redisUrl } from '@/configs'
import rateLimiter from 'express-rate-limit'
import { v4 as uuid } from 'uuid'

// services
import bitcoin from '@/server/services/bitcoin'
import lightning from '@/server/services/lightning'
let redis: Redis = new Redis(redisUrl)

// overwrite process and environment variable
process.on('uncaughtException', function (err) {
  console.error(err)
  console.log('Node NOT Exiting...')
})
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// run-time constants
const isProduction = process.env.NODE_ENV === 'production'

// define app
let app: Express = express()

// middlewares
app.enable('trust proxy')
app.use(helmet.hsts())
app.use(helmet.hidePoweredBy())
app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: rateLimit || 200,
  })
)

// special rate limiter for POST endpoints
let postLimiter = rateLimiter({
  max: postRateLimit || 100,
  windowMs: 30 * 60 * 1000,
})

// @ts-ignore
// TODO: Replace this with a service
app.use((req, res, next) => {
  // @ts-ignore
  req.id = uuid()
  next()
})

// @ts-ignore
morgan.token('id', req => req.id)
app.use(
  morgan(
    ':id :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
  )
)

app.use(bodyParser.urlencoded({ extended: false })) // parse application/x-www-form-urlencoded
app.use(bodyParser.json(null)) // parse application/json

// @ts-ignore
let allowCrossDomain = (_, reply, next) => {
  reply.header(
    'Access-Control-Allow-Headers',
    'Authorization,Access-Control-Allow-Origin,Content-Type'
  )
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT')
  next()
}
app.use(allowCrossDomain)

// api routes
let router: Router = Router()
import authenticate from '@/server/routes/authenticate.route'
import addInvoice from '@/server/routes/addInvoice.route'
import balance from '@/server/routes/balance.route'
import bitcoinAddress from '@/server/routes/bitcoinAddress.route'
import chainInfo from '@/server/routes/chainInfo.route'
import channels from '@/server/routes/channels.route'
import checkPayment from '@/server/routes/checkPayment.route'
import checkRouteInvoice from '@/server/routes/checkRouteInvoice.route'
import createAccount from '@/server/routes/createAccount.route'
import decodeInvoice from '@/server/routes/decodeInvoice.route'
import info from '@/server/routes/info.route'
import pendingInvoices from '@/server/routes/pendingInvoices.route'
import payInvoice from '@/server/routes/payInvoice.route'
import queryRoutes from '@/server/routes/queryRoutes.route'
import transactions from '@/server/routes/transactions.route'
import userInvoices from '@/server/routes/userInvoices.route'
router.post('/auth', postLimiter, authenticate(bitcoin, lightning, redis))
router.post('/addinvoice', postLimiter, addInvoice(bitcoin, lightning, redis))
router.get('/balance', postLimiter, balance(bitcoin, lightning, redis))
router.get('/channels', channels(lightning))
router.get('/checkpayment/:payment_hash', checkPayment(bitcoin, lightning, redis))
router.get('/checkrouteinvoice', checkRouteInvoice(bitcoin, lightning, redis))
router.post('/create', postLimiter, createAccount(bitcoin, lightning, redis))
router.get('/decodeinvoice', postLimiter, decodeInvoice(bitcoin, lightning, redis))
router.get('/getbtc', bitcoinAddress(bitcoin, lightning, redis))
router.get('/getchaninfo/:chanid', chainInfo(lightning))
router.get('/getinfo', postLimiter, info(lightning))
router.get('/getpending', postLimiter, pendingInvoices(bitcoin, lightning, redis))
router.get('/gettxs', postLimiter, transactions(bitcoin, lightning, redis))
router.get('/getuserinvoices', postLimiter, userInvoices(bitcoin, lightning, redis))
router.post('/payinvoice', postLimiter, payInvoice(bitcoin, lightning, redis))
router.get('/queryroutes/:source/:dest/:amt', queryRoutes(lightning))
app.use('/', router)

// ######################## SMOKE TESTS ########################
app.on('event:startup', () => {
  const MIN_BTC_BLOCK = 670000
  bitcoin
    .request('getblockchaininfo', [], uuid())
    .then(info => {
      if (info && info.result && info.result.blocks) {
        if (info.result.chain === 'mainnet' && info.result.blocks < MIN_BTC_BLOCK) {
          console.error('bitcoind is not caught up')
          process.exit(1)
        }
        console.log('bitcoind getblockchaininfo:', info)
      }
    })
    .catch(err => {
      console.error('bitcoind failure:', err)
      process.exit(2)
    })
  promisify(lightning.getInfo)
    .bind(lightning)({})
    .then(info => {
      // let identity_pubkey = false
      console.info('lnd getinfo:', info)
      if (!info.synced_to_chain) {
        console.error('lnd not synced')
        // process.exit(4);
      }
      // identity_pubkey = info.identity_pubkey
    })
    .catch(err => {
      console.error('lnd failure')
      console.dir(err)
      process.exit(3)
    })
  redis.info(function (err, info) {
    if (err || !info) {
      console.error('redis failure')
      process.exit(5)
    }
  })
  redis.monitor(function (err, monitor) {
    monitor.on('monitor', function (time, args, source, database) {
      // console.log('REDIS', JSON.stringify(args))
    })
  })
})

let port: number = parseInt(process.env.PORT || '3000')
if (isProduction) {
  let rootDir = process.cwd() + '/dist'
  // static files
  app.use(express.static(rootDir))
  // front-end
  app.get('*', (_, response: Response) => {
    response.sendFile('index.html', { root: rootDir })
  })
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
