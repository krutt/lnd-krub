/**
 * This script goes through all user invoices in LND and if it is settled - marks it
 * so in our database. Does this only for invoices younger than week. *
 */
import { createInvoice, savePreimage } from '@/server/stores/invoice'
// const config = require('../config')

(async () => {
  console.log('unpaid invoices')

  // console.log('fetching listinvoices...')
  // let tempInv = new Invo(redis, bitcoinclient, lightning)

  // let listinvoices = await tempInv.listInvoices()
  // console.log('done', 'got', listinvoices['invoices'].length, 'invoices')
  // fs.writeFileSync('listInvoices.json', '[\n')

  // let markedInvoices = 0
  // for (const invoice of listinvoices['invoices']) {
  //   fs.appendFileSync('listInvoices.json', JSON.stringify(invoice, null, 2) + ',\n')
  //   if (invoice.state === 'SETTLED' && +invoice.creation_date >= +new Date() / 1000 - 3600 * 24 * 7 * 2) {
  //     tempInv.setInvoice(invoice.payment_request)
  //     await tempInv.markAsPaidInDatabase()
  //     markedInvoices++
  //     process.stdout.write(markedInvoices + '\r')
  //   }
  // }

  // fs.appendFileSync('listInvoices.json', ']')

  // console.log('done, marked', markedInvoices, 'invoices')
  process.exit()
})()
