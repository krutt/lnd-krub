/* ~~/src/server/routes/createAccount.route.ts */

// imports
import type { Request, Response } from 'express'
import { errorBadArguments, errorSunset } from '@/server/exceptions'
import { sunset } from '@/configs'
import { createUser, saveUserMetadata } from '@/server/stores/user'

/**
 *
 * @param {Express.Request} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: Request, response: Response): Promise<Response> => {
  // Valid if the partnerid isn't there or is a string (same with accounttype)
  if (
    !(
      (!request.body.partnerid ||
        typeof request.body.partnerid === 'string' ||
        request.body.partnerid instanceof String) &&
      (!request.body.accounttype ||
        typeof request.body.accounttype === 'string' ||
        request.body.accounttype instanceof String)
    )
  )
    return errorBadArguments(response)
  if (sunset) return errorSunset(response)
  let { login, password, userId } = await createUser()
  let metadata = {
    accountType: request.body.accounttype?.toString(),
    createdAt: new Date().toISOString(),
    partnerId: request.body.partnerid?.toString(),
  }
  await saveUserMetadata(metadata, userId)
  return response.send({ login, password })
}

export default route
