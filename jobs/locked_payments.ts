/* ~/jobs/locked_payments.ts */
/**
 * This script gets all locked payments from our database and cross-checks them with actual
 * sentout payments from LND. If locked payment is in there we move locked payment to array of
 * real payments for the user (it is effectively spent coins by user), if not - we attempt to pay
 * it again (if it is not too old).
 */

// imports
import { CacheService } from '@/server/services/cache'
import { forwardReserveFee } from '@/configs'
import { getLockedPayments } from '@/server/stores/user'
import { listPayments, processSendPaymentResponse } from '@/server/stores/payment'

/**
 * Cross-checks payments from database with sent out payments from LND node.
 */
;(async () => {
  console.log('processing locked payments...')
  await listPayments().then(async payments => {
    let cache: CacheService = new CacheService()
    await cache.keys('locked_payments_for_*').then(keys => {
      keys.forEach(async key => {
        let userId = key.replace('locked_payments_for_', '')
        await getLockedPayments(userId).then(lockedPayments => {
          lockedPayments.forEach(lockedPayment => {
            let elapsed = (+new Date() / 1000 - lockedPayment.timestamp) / 3600 / 24 // in days
            // first things first:
            // trying to lookup this stuck payment in an array of delivered payments
            let isPaid: boolean = false
            for (let sentPayment of payments['payments']) {
              if (lockedPayment.payment_hash === sentPayment.payment_hash) {
                console.log('found this payment in listPayments array, so it is paid successfully')
                // @ts-ignore TODO: fix
                let sendResult = processSendPaymentResponse(lockedPayment, {
                  payment_error: 'already paid',
                })
                if (+sendResult.decoded.num_satoshis == 0) {
                  sendResult.decoded.num_satoshis =
                    lockedPayment.amount + Math.ceil(lockedPayment.amount * forwardReserveFee)
                  // sendResult.decoded.num_msat = sendResult.decoded.num_satoshis * 1000
                  sendResult.payment_route.total_fees = 0
                  // sendResult.payment_route.total_amt = sendResult.decoded.num_satoshis
                }
                console.log('saving paid invoice:', sendResult)
                // await user.savePaidLndInvoice(sendResult) // TODO: implement
                // await user.unlockFunds(lockedPayment.pay_req) // TODO: implement
                isPaid = true
                break
              }
              if (elapsed > 1) {
                // could not find in listpayments array too late to retry
                if (!isPaid) {
                  console.log('very old payment, evict the lock')
                  // await user.unlockFunds(lockedPayment.pay_req) // TODO: implement
                }
              }
            }
          })
        })
      })
    })
  })
  process.exit()
})()
