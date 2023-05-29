// ~~/src/server/routes/exceptions.ts

// imports
import type { Response } from 'express'

export const errorBadAuth = (response: Response): Response =>
  response.send({
    error: true,
    code: 1,
    message: 'bad auth',
  })

export const errorNotEnoughBalance = (response: Response): Response =>
  response.send({
    error: true,
    code: 2,
    message: 'not enough balance. Make sure you have at least 1% reserved for potential fees',
  })

export const errorNotAValidInvoice = (response: Response): Response =>
  response.send({
    error: true,
    code: 4,
    message: 'not a valid invoice',
  })

export const errorLnd = (response: Response): Response =>
  response.send({
    error: true,
    code: 7,
    message: 'LND failue',
  })

export const errorGeneralServerError = (response: Response): Response =>
  response.send({
    error: true,
    code: 6,
    message: 'Something went wrong. Please try again later',
  })

export const errorBadArguments = (response: Response): Response =>
  response.send({
    error: true,
    code: 8,
    message: 'Bad arguments',
  })

export const errorTryAgainLater = (response: Response): Response =>
  response.send({
    error: true,
    code: 9,
    message: 'Your previous payment is in transit. Try again in 5 minutes',
  })

export const errorPaymentFailed = (response: Response): Response =>
  response.send({
    error: true,
    code: 10,
    message: 'Payment failed. Does the receiver have enough inbound capacity?',
  })

export const errorSunset = (response: Response): Response =>
  response.send({
    error: true,
    code: 11,
    message: 'This LNDKrub instance is not accepting any more users',
  })

export const errorSunsetAddInvoice = (response: Response): Response =>
  response.send({
    error: true,
    code: 11,
    message: 'This LNDKrub instance is scheduled to shut down. Withdraw any remaining funds',
  })
