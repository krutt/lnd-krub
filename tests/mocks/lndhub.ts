/* ~~/tests/mocks/lndhub.ts */

// imports
// @ts-nocheck
import BearerStrategy from 'passport-http-bearer'
import { LightningService, LnRpc, createLNDCreds } from 'τ/services/lnrpc'
import { Invoice, Tag, Transactions } from 'τ/types'
import bodyParser from 'body-parser'
import { lnd } from 'τ/configs'
import express, { Express } from 'express'
import { randomBytes } from 'crypto'
import passport from 'passport'
import { promisify } from 'node:util'
import sqlite3, { Database, Statement } from 'sqlite3'

// server
export const createLNDHub = (): Express => {
  // initiate lndhub server and grpc client
  let app: Express = express().use(bodyParser.json())
  let db: Database = new sqlite3.Database(':memory:')
  let lnsvc: LightningService = new LnRpc.Lightning(
    `${lnd.host}:${lnd.port}`,
    createLNDCreds(lnd.macaroonPath, lnd.tlsCertPath)
  )

  // set up database on startup
  app.on('event:startup', () => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE addresses (
          address TEXT UNIQUE NOT NULL CHECK ( LENGTH(address) = 44),
          type NUMBER NOT NULL CHECK( type in (0, 1, 2, 3) ) DEFAULT 0,
          userid TEXT UNIQUE NOT NULL CHECK ( LENGTH(userid) = 64)
        );
      `)
      db.run(`
        CREATE TABLE users (
          accounttype TEXT NOT NULL CHECK( accounttype IN ("test", "common") ) DEFAULT "common",
          login TEXT NOT NULL UNIQUE CHECK( LENGTH(login) = 64),
          partnerid TEXT NULL DEFAULT NULL,
          password TEXT NOT NULL CHECK( LENGTH(password) = 64),
          userid TEXT UNIQUE NOT NULL CHECK( LENGTH(userid) = 64)
        );
      `)
      db.run(`
        CREATE TABLE invoices (
          add_index TEXT NOT NULL,
          amount NUMBER NOT NULL CHECK(amount > 0),
          description TEXT NULL DEFAULT NULL,
          expire_time INTEGER NOT NULL DEFAULT 86400,
          ispaid BOOLEAN NOT NULL DEFAULT false,
          payment_request TEXT NOT NULL CHECK( LENGTH(payment_request) = 267 ),
          r_hash TEXT NOT NULL CHECK(r_hash LIKE '[%]'),
          timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          type TEXT NOT NULL CHECK(type LIKE 'user_invoice') DEFAULT 'user_invoice',
          userid TEXT NOT NULL CHECK( LENGTH(userid) = 64)
        );
      `)
      db.run(`
        CREATE TABLE tokens (
          accesstoken TEXT UNIQUE NOT NULL CHECK ( LENGTH(accesstoken) = 40),
          refreshtoken TEXT UNIQUE NOT NULL CHECK ( LENGTH(refreshtoken) = 40),
          userid TEXT UNIQUE NOT NULL CHECK( LENGTH(userid) = 64)
        );
      `)
    })
  })

  // close database on server shutdown
  app.on('event:shutdown', () => db.close())

  // set default http-status and headers
  app.use((_, reply, next) => {
    reply.status(200)
    reply.setHeader('Content-Type', 'application/json')
    next()
  })

  // bearer authenticate some route
  passport.use(
    new BearerStrategy({ scope: 'all' }, async (token: string, done: Function) => {
      let row: { userid: string } = await promisify(db.get).bind(db)(
        `SELECT userid FROM tokens WHERE accesstoken = "${token}" LIMIT 1;`
      )
      if (!row || !row.userid) return done(null, false)
      return done(null, row)
    })
  )
  app.use(passport.initialize())

  // implement routes
  app.post(
    '/addinvoice',
    passport.authenticate('bearer', { session: false }),
    async (request, reply) => {
      let { userid }: { userid: string } = request.user
      let { amt, memo }: { amt: number; memo: string } = request.body
      let r_preimage = Buffer.from(randomBytes(32).toString('hex'), 'hex')
      let invoice = await promisify(lnsvc.addInvoice).bind(lnsvc)({
        expiry: 3600 * 24, // 24 hours
        memo,
        r_preimage: r_preimage.toString('base64'),
        value: amt,
      })
      db.serialize(() => {
        let { add_index, payment_request }: { add_index: string; payment_request: string } = invoice
        let r_hash = JSON.stringify(new Array(...invoice.r_hash))
        let statement: Statement = db.prepare(`
          INSERT INTO invoices (add_index, amount, description, payment_request, r_hash, userid)
          VALUES (?, ?, ?, ?, ?, ?);'
        `)
        statement.run(add_index, amt, memo, payment_request, r_hash, userid)
        statement.finalize()
      })
      reply.send(invoice)
    }
  )

  app.post(
    '/auth',
    async (
      request: { body: { login?: string; password?: string; refresh_token?: string } },
      reply
    ) => {
      let { login, password, refresh_token } = request.body
      let accessToken: string | null = null
      let refreshToken: string | null = null
      if (!!refresh_token) {
        let { accesstoken } = await promisify(db.get).bind(db)(
          `SELECT accesstoken FROM tokens WHERE refreshtoken = "${refresh_token}";`
        )
        if (!accesstoken) {
          reply.send({ err: 'authentication error!' })
          return
        }
        reply.send({ access_token: accesstoken, refresh_token })
      } else if (!!login && !!password) {
        let { userid } = await promisify(db.get).bind(db)(
          `SELECT userid FROM users WHERE login='${login}' AND password='${password}';`
        )
        if (!userid) {
          reply.send({ err: 'authentication error!' })
          return
        }
        accessToken = randomBytes(20).toString('hex')
        refreshToken = randomBytes(20).toString('hex')
        db.serialize(() => {
          let statement = db.prepare(
            'INSERT INTO tokens (accesstoken, refreshtoken, userid) VALUES (?, ?, ?);'
          )
          statement.run(accessToken, refreshToken, userid)
          statement.finalize()
        })
        reply.send({ access_token: accessToken, refresh_token: refreshToken })
      } else {
        reply.send({ err: 'authentication error!' })
      }
    }
  )

  app.get('/balance', async (_, reply) => {
    let { transactions } = await promisify(lnsvc.getTransactions).bind(lnsvc)({})
    let balance: number = 0
    for (let txn of transactions as Transaction[]) {
      if (txn.type === 'bitcoind_tx') {
        balance += 100000000 * parseInt(txn.amount)
      } else {
        balance -= txn.value || 0
      }
    }
    reply.send({ BTC: { AvailableBalance: balance } })
  })

  app.post('/create', async (_, reply) => {
    let login: string = randomBytes(32).toString('hex')
    let password: string = randomBytes(32).toString('hex')
    let userId: string = randomBytes(32).toString('hex')
    db.serialize(() => {
      let statement: Statement = db.prepare(`
        INSERT INTO users (accounttype, login, partnerid, password, userid) VALUES (?, ?, ?, ?, ?);
      `)
      statement.run('test', login, 'walletofwow', password, userId)
      statement.finalize()
    })
    reply.status(201).send({ login, password, userId })
  })

  app.get(
    '/getbtc',
    passport.authenticate('bearer', { session: false }),
    async (request, reply) => {
      let address: string
      let { userid }: { userid: string } = request.user
      let row = await promisify(db.get).bind(db)(
        `SELECT address FROM addresses WHERE userid = "${userid}" LIMIT 1;`
      )
      if (!!row && !!row.address) {
        address = row.address
      } else {
        address = (await promisify(lnsvc.newAddress).bind(lnsvc)({ type: 0 })).address
        db.serialize(() => {
          let statement: Statement = db.prepare(
            'INSERT INTO addresses (address, type, userid) VALUES (?, ?, ?);'
          )
          statement.run(address, 0, userid)
          statement.finalize()
        })
      }
      reply.send({ address })
    }
  )

  app.get('/getinfo', async (_, reply) =>
    reply.send(await promisify(lnsvc.getInfo).bind(lnsvc)({}))
  )

  app.get('/gettxs', passport.authenticate('bearer', { session: false }), async (_, reply) =>
    reply.send(await promisify(lnsvc.getTransactions).bind(lnsvc)({}))
  )

  app.get(
    '/getuserinvoices',
    passport.authenticate('bearer', { session: false }),
    async (request, reply) => {
      let { userid }: { userid: string } = request.user
      let { count }: { count: number } = await promisify(db.get).bind(db)(
        `SELECT COUNT(*) AS count FROM invoices WHERE userid = "${userid}";`
      )
      let invoices: Invoice[] = []
      for (let offset = 0; offset < count; offset++) {
        invoices.push(
          await promisify(db.get)
            .bind(db)(`SELECT * FROM invoices WHERE userid = "${userid}" LIMIT 1 OFFSET ${offset};`)
            .then(row => {
              row.amt = row.amount
              delete row.amount
              row.ispaid = row.ispaid ? true : false
              row.r_hash = Buffer.from(JSON.parse(row.r_hash), 'hex')
              row.timestamp = Math.floor(new Date(row.timestamp).getTime() / 1000)
              return row
            })
        )
      }
      reply.send(invoices)
    }
  )

  app.post('/payinvoice', passport.authenticate('bearer', { session: false }), async (_, reply) =>
    reply.send({ msg: 'TODO' })
  )

  return app
}

export default createLNDHub
