// ~~/src/server/routes/createAccount.route.ts

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import { errorBadArguments, errorSunset } from '@/server/exceptions'
import { sunset } from '@/configs'
import { createUser, saveMetadata } from '@/server/stores/user'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {
  console.log('/create', [request.uuid])
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
  await saveMetadata(
    {
      partnerid: request.body.partnerid,
      accounttype: request.body.accounttype,
      created_at: new Date().toISOString(),
    },
    userId
  )
  return response.send({ login, password })
}

export default route
