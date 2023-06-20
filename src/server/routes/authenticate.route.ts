/* ~~/src/server/routes/authenticate.route.ts */

// imports
import type { LNDKrubRequest } from '@/types'
import type { Response } from 'express'
import { errorBadAuth, errorBadArguments } from '@/server/exceptions'
import {
  fetchUserAuth,
  loadUserByLoginAndPassword,
  loadUserByRefreshToken,
} from '@/server/stores/user'

/**
 *
 * @param {LNDKrubRequest} request
 * @param {Express.Response} response
 * @returns {Express.Response}
 */
export const route = async (request: LNDKrubRequest, response: Response): Promise<Response> => {
  console.log('/auth', [request.uuid])
  let login: null | string = request.body.login
  let password: null | string = request.body.password
  let refreshToken: null | string = request.body.refreshToken || request.body.refresh_token // bluewallet: compatibility
  if (!(login && password) && !refreshToken) return errorBadArguments(response)
  else if (refreshToken) {
    // need to refresh token
    let userId = await loadUserByRefreshToken(refreshToken)
    if (userId) {
      let tokens = await fetchUserAuth(userId)
      tokens.access_token = tokens.accessToken // bluewallet: compatibility
      tokens.refresh_token = tokens.refreshToken // bluewallet: compatibility
      return response.send(tokens)
    } else {
      return errorBadAuth(response)
    }
  } else {
    // need to authorize user
    let userId = await loadUserByLoginAndPassword(login, password)
    if (userId) {
      let tokens = await fetchUserAuth(userId)
      tokens.access_token = tokens.accessToken // bluewallet: compatibility
      tokens.refresh_token = tokens.refreshToken // bluewallet: compatibility
      return response.send(tokens)
    } else return errorBadAuth(response)
  }
}

export default route
