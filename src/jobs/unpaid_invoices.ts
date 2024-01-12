/* ~/jobs/unpaid_invoices.ts */

// imports
import { listInvoices, markAsPaidInDatabase } from '@/server/stores/invoice'

/**
 * Go through all user invoices in LND and checks if it has been settled, mark it as
 * such on the database if its creation time is maximally with two weeks prior.
 */
;(async () => {
  await listInvoices().then(invoices => {
    invoices['invoices'].forEach(async invoice => {
      invoice.state == 'SETTLED' && +invoice.creation_date >= +new Date() / 1000 - 3600 * 24 * 7 * 2
        ? await markAsPaidInDatabase(invoice.payment_request)
        : void 0
    })
  })
  process.exit()
})()
