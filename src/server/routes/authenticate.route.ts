// ~~/src/server/routes/authenticate.route.ts

// imports
import type { LNDKrubRequest } from '@/types/LNDKrubRequest'
import type { LNDKrubRouteFunc } from '@/types/LNDKrubRouteFunc'
import type { Response } from 'express'
import { errorBadAuth, errorBadArguments } from '@/server/exceptions'
import {
  fetchAccessTokens,
  loadUserByLoginAndPassword,
  loadUserByRefreshToken,
} from '@/server/models/user'

export default (): LNDKrubRouteFunc =>
  /**
   *
   * @param {LNDKrubRequest} request
   * @param {Express.Response} response
   * @returns {Express.Response}
   */
  async (request: LNDKrubRequest, response: Response): Promise<Response> => {
    console.log('/auth', [request.uuid])
    if (!((request.body.login && request.body.password) || request.body.refresh_token))
      return errorBadArguments(response)
    if (request.body.refresh_token) {
      // need to refresh token
      let userId = await loadUserByRefreshToken(request.body.refresh_token)
      if (userId) {
        let { access_token, refresh_token } = await fetchAccessTokens(userId)
        return response.send({ access_token, refresh_token })
      } else {
        return errorBadAuth(response)
      }
    } else {
      // need to authorize user
      let userId = await loadUserByLoginAndPassword(request.body.login, request.body.password)
      if (userId) {
        let { access_token, refresh_token } = await fetchAccessTokens(userId)
        return response.send({ access_token, refresh_token })
      } else return errorBadAuth(response)
    }
  }
